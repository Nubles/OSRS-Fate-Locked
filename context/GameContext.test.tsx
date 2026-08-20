// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileWriterLeaseOptions } from '../hooks/useProfileWriterLease';
import type { GameState } from '../types';
import { serializeCurrent, type ImportResult } from '../utils/gamePersistence';
import {
  discardPendingSave,
  getPendingSave,
  resetPendingSavesForTest,
  stagePendingSave,
} from '../utils/pendingSaves';
import { profileBackupKey } from '../utils/profileStorage';
import { parseAndMigrateSave } from '../utils/saveSchema';
import {
  writerLeaseKey,
  WRITER_LEASE_ARBITRATION_MS,
  WRITER_LEASE_TTL_MS,
} from '../utils/profileWriterLease';
import {
  GameProvider,
  initialState,
  gameReducerForTest,
  prepareDetectedEventAcceptanceAction,
  migrateSaveForTest,
  newRunIdForTest,
  subscribeToPendingSaveChanges,
  useGame,
} from './GameContext';


type Game = ReturnType<typeof useGame>;

const GameCapture = ({ onGame }: { onGame: (game: Game) => void }) => {
  onGame(useGame());
  return null;
};

beforeEach(() => {
  resetPendingSavesForTest();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  });
});

afterEach(() => {
  cleanup();
  resetPendingSavesForTest();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ordinary save recovery', () => {
  const installStorage = () => {
    const values = new Map<string, string>();
    let writesFail = false;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (writesFail) throw new DOMException('full', 'QuotaExceededError');
        values.set(key, value);
      },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => values.clear(),
    });
    return {
      values,
      failWrites: () => { writesFail = true; },
      allowWrites: () => { writesFail = false; },
    };
  };

  let storage: ReturnType<typeof installStorage>;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = installStorage();
  });

  const renderGame = (
    storageKey: string,
    leaseOptions: ProfileWriterLeaseOptions = { ownerId: 'test-tab' },
  ) => {
    let current: Game | undefined;
    const rendered = render(
      <GameProvider storageKey={storageKey} leaseOptions={leaseOptions}>
        <GameCapture onGame={game => { current = game; }} />
      </GameProvider>,
    );
    return {
      ...rendered,
      current: () => {
        if (!current) throw new Error('Game provider did not initialize');
        return current;
      },
    };
  };

  const settleOwnership = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
    });
  };

  const seedForeignWriterLease = (storageKey: string, ownerId: string) => {
    storage.values.set(writerLeaseKey(storageKey), JSON.stringify({
      version: 1,
      ownerId,
      expiresAt: Date.now() + WRITER_LEASE_TTL_MS,
    }));
  };

  const readStoredNote = (storageKey: string, noteId: string): string | undefined =>
    JSON.parse(storage.values.get(storageKey) ?? '{}').userNotes?.[noteId];

  const leaseStorageThatCanFailReads = () => {
    let readsFail = false;
    return {
      storage: {
        getItem: (key: string) => {
          if (readsFail) throw new DOMException('blocked', 'SecurityError');
          return storage.values.get(key) ?? null;
        },
        setItem: (key: string, value: string) => { storage.values.set(key, value); },
        removeItem: (key: string) => { storage.values.delete(key); },
      },
      failReads: () => { readsFail = true; },
    };
  };

  const seedCanonicalSave = (storageKey: string) => {
    const parsed = parseAndMigrateSave(serializeCurrent(initialState), initialState);
    if (parsed.ok === false) throw new Error(parsed.message);
    const durable = serializeCurrent(parsed.state);
    storage.values.set(storageKey, durable);
    return durable;
  };

  it('contains a failed write and retries the newest in-memory state', async () => {
    const game = renderGame('profile');
    await settleOwnership();
    storage.failWrites();

    act(() => game.current().saveNote('goal', 'first'));
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(game.current().saveStatus).toBe('failed');

    act(() => game.current().saveNote('goal', 'newest'));
    expect(game.current().saveStatus).toBe('failed');
    storage.allowWrites();
    act(() => { expect(game.current().retrySave()).toBe(true); });

    expect(JSON.parse(storage.values.get('profile')!).userNotes.goal).toBe('newest');
    expect(game.current().saveStatus).toBe('saved');
  });

  it('shows storage failure after initial lease access fails on an unchanged durable save', async () => {
    const durable = seedCanonicalSave('profile');
    const leaseStorage = {
      getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const game = renderGame('profile', { storage: leaseStorage, ownerId: 'tab-a' });

    await act(async () => Promise.resolve());

    expect(game.current().saveOwnershipStatus).toBe('blocked');
    expect(game.current().saveOwnershipBlockReason).toBe('storage_unavailable');
    expect(game.current().saveStatus).toBe('failed');
    expect(game.current().hasPendingChanges).toBe(false);
    expect(storage.values.get('profile')).toBe(durable);
  });

  it('classifies ordinary flush verification storage failure without durable mutation', async () => {
    const durable = seedCanonicalSave('profile');
    const lease = leaseStorageThatCanFailReads();
    const game = renderGame('profile', { storage: lease.storage, ownerId: 'tab-a' });
    await settleOwnership();
    lease.failReads();

    act(() => game.current().saveNote('goal', 'local only'));
    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(storage.values.get('profile')).toBe(durable);
    expect(getPendingSave('profile')).toMatchObject({
      status: 'failed',
      reason: 'storage_unavailable',
    });
    expect(game.current().saveOwnershipStatus).toBe('blocked');
    expect(game.current().saveOwnershipBlockReason).toBe('storage_unavailable');
    expect(game.current().saveStatus).toBe('failed');
  });

  it('rejects import as storage unavailable before durable backup or profile access', async () => {
    seedCanonicalSave('profile');
    const lease = leaseStorageThatCanFailReads();
    const game = renderGame('profile', { storage: lease.storage, ownerId: 'tab-a' });
    await settleOwnership();
    const candidate = game.current().getExportData();
    lease.failReads();
    const getItem = vi.spyOn(localStorage, 'getItem');
    const setItem = vi.spyOn(localStorage, 'setItem');

    let result: ImportResult | undefined;
    act(() => { result = game.current().importSave(candidate); });

    expect(result).toMatchObject({ ok: false, code: 'storage_unavailable' });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(game.current().saveStatus).toBe('failed');
    expect(game.current().saveOwnershipBlockReason).toBe('storage_unavailable');
  });

  it('rejects restore as storage unavailable before reading the backup ring', async () => {
    const durable = seedCanonicalSave('profile');
    storage.values.set(profileBackupKey('profile'), JSON.stringify([{
      ts: 7,
      reason: 'fixture',
      summary: 'fixture',
      data: durable,
    }]));
    const lease = leaseStorageThatCanFailReads();
    const game = renderGame('profile', { storage: lease.storage, ownerId: 'tab-a' });
    await settleOwnership();
    lease.failReads();
    const getItem = vi.spyOn(localStorage, 'getItem');
    const setItem = vi.spyOn(localStorage, 'setItem');

    let result: ImportResult | undefined;
    act(() => { result = game.current().restoreBackup(7); });

    expect(result).toMatchObject({ ok: false, code: 'storage_unavailable' });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(game.current().saveStatus).toBe('failed');
    expect(game.current().saveOwnershipBlockReason).toBe('storage_unavailable');
  });

  it('rejects a manual backup as storage unavailable before backup access', async () => {
    seedCanonicalSave('profile');
    const lease = leaseStorageThatCanFailReads();
    const game = renderGame('profile', { storage: lease.storage, ownerId: 'tab-a' });
    await settleOwnership();
    lease.failReads();
    const getItem = vi.spyOn(localStorage, 'getItem');
    const setItem = vi.spyOn(localStorage, 'setItem');

    let result: ReturnType<Game['createBackup']> | undefined;
    act(() => { result = game.current().createBackup('manual'); });

    expect(result).toEqual({ stored: false, reason: 'storage_unavailable' });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(game.current().saveStatus).toBe('failed');
    expect(game.current().saveOwnershipBlockReason).toBe('storage_unavailable');
  });

  it('loads a failed pending snapshot before an older stored snapshot', async () => {
    const first = renderGame('profile');
    await settleOwnership();

    act(() => first.current().saveNote('goal', 'older'));
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(JSON.parse(storage.values.get('profile')!).userNotes.goal).toBe('older');

    storage.failWrites();
    act(() => first.current().saveNote('goal', 'newest'));
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(first.current().saveStatus).toBe('failed');
    first.unmount();

    const second = renderGame('profile');
    expect(second.current().userNotes.goal).toBe('newest');
  });

  it('flushes the newest state when unmounted inside the debounce window', async () => {
    const game = renderGame('profile');
    await settleOwnership();

    act(() => game.current().saveNote('goal', 'safe on teardown'));
    game.unmount();

    expect(JSON.parse(storage.values.get('profile')!).userNotes.goal).toBe('safe on teardown');
  });

  it('persists a same-batch action before owner teardown releases the lease', async () => {
    const game = renderGame('profile', { ownerId: 'tab-a' });
    await settleOwnership();
    await act(async () => vi.advanceTimersByTimeAsync(500));

    act(() => {
      game.current().saveNote('goal', 'same-batch unmount');
      game.unmount();
    });

    expect(readStoredNote('profile', 'goal')).toBe('same-batch unmount');
    expect(storage.values.get(writerLeaseKey('profile'))).toBeUndefined();
  });

  it('persists a same-batch action before owner pagehide releases the lease', async () => {
    const game = renderGame('profile', { ownerId: 'tab-a' });
    await settleOwnership();
    await act(async () => vi.advanceTimersByTimeAsync(500));

    act(() => {
      game.current().saveNote('goal', 'same-batch pagehide');
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(readStoredNote('profile', 'goal')).toBe('same-batch pagehide');
    expect(storage.values.get(writerLeaseKey('profile'))).toBeUndefined();
  });

  it('synchronously retains a blocked same-batch pagehide snapshot without releasing the foreign lease', async () => {
    seedForeignWriterLease('profile', 'tab-a');
    const foreignLease = storage.values.get(writerLeaseKey('profile'));
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();

    act(() => {
      game.current().saveNote('goal', 'blocked pagehide');
      window.dispatchEvent(new Event('pagehide'));
      expect(getPendingSave('profile')?.data).toContain('blocked pagehide');
    });

    expect(readStoredNote('profile', 'goal')).not.toBe('blocked pagehide');
    expect(storage.values.get(writerLeaseKey('profile'))).toBe(foreignLease);
  });

  it('retains a failed same-batch teardown snapshot and keeps the owned lease', async () => {
    const game = renderGame('profile', { ownerId: 'tab-a' });
    await settleOwnership();
    await act(async () => vi.advanceTimersByTimeAsync(500));
    const ownedLease = storage.values.get(writerLeaseKey('profile'));
    storage.failWrites();

    act(() => {
      game.current().saveNote('goal', 'failed unmount');
      game.unmount();
    });

    expect(getPendingSave('profile')?.data).toContain('failed unmount');
    expect(readStoredNote('profile', 'goal')).not.toBe('failed unmount');
    expect(storage.values.get(writerLeaseKey('profile'))).toBe(ownedLease);
  });

  it('retains the newest blocked-tab state without writing the profile', async () => {
    seedForeignWriterLease('profile', 'tab-a');
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();
    expect(game.current().saveOwnershipStatus).toBe('blocked');

    act(() => game.current().saveNote('goal', 'first'));
    act(() => game.current().saveNote('goal', 'newest'));
    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(game.current().hasPendingChanges).toBe(true);
    expect(getPendingSave('profile')?.data).toContain('newest');
    expect(readStoredNote('profile', 'goal')).not.toBe('newest');
  });

  it('stops a queued save after ownership changes before the debounce', async () => {
    const game = renderGame('profile', { ownerId: 'tab-a' });
    await settleOwnership();
    await act(async () => vi.advanceTimersByTimeAsync(500));
    const durableBeforeChange = storage.values.get('profile');

    act(() => game.current().saveNote('goal', 'must stay local'));
    const writerKey = writerLeaseKey('profile');
    storage.values.set(writerKey, JSON.stringify({
      version: 1,
      ownerId: 'tab-b',
      expiresAt: Date.now() + WRITER_LEASE_TTL_MS,
    }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: writerKey })));
    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(game.current().saveOwnershipStatus).toBe('blocked');
    expect(storage.values.get('profile')).toBe(durableBeforeChange);
    expect(getPendingSave('profile')?.data).toContain('must stay local');
  });

  it('takes over and flushes the newest blocked state', async () => {
    seedForeignWriterLease('profile', 'tab-a');
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();
    act(() => game.current().saveNote('goal', 'first'));
    act(() => game.current().saveNote('goal', 'newest'));

    let tookOver = false;
    await act(async () => {
      const takeover = game.current().takeOverSaveOwnership();
      await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
      tookOver = await takeover;
    });

    expect(tookOver).toBe(true);
    expect(game.current().saveOwnershipStatus).toBe('owner');
    expect(readStoredNote('profile', 'goal')).toBe('newest');
    expect(getPendingSave('profile')).toBeNull();
  });

  it('does not authorize other writes during takeover arbitration', async () => {
    seedForeignWriterLease('profile', 'tab-a');
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();
    act(() => game.current().saveNote('goal', 'wait for verification'));
    const durableBefore = storage.values.get('profile');
    const backupsBefore = storage.values.get(profileBackupKey('profile'));

    let takeover: Promise<boolean> | undefined;
    act(() => {
      takeover = game.current().takeOverSaveOwnership();
    });
    expect(game.current().saveOwnershipStatus).toBe('checking');

    let retryDuringArbitration = true;
    let backupDuringArbitration: ReturnType<Game['createBackup']> | undefined;
    act(() => {
      retryDuringArbitration = game.current().retrySave();
      backupDuringArbitration = game.current().createBackup('too soon');
    });
    expect(retryDuringArbitration).toBe(false);
    expect(backupDuringArbitration).toEqual({
      stored: false,
      reason: 'ownership_conflict',
    });
    expect(storage.values.get('profile')).toBe(durableBefore);
    expect(storage.values.get(profileBackupKey('profile'))).toBe(backupsBefore);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
      expect(await takeover).toBe(true);
    });
  });

  it('blocks every ordinary and explicit write while an owner re-arbitrates takeover', async () => {
    const game = renderGame('profile', { ownerId: 'tab-a' });
    await settleOwnership();
    await act(async () => vi.advanceTimersByTimeAsync(500));

    act(() => game.current().saveNote('goal', 'wait for re-verification'));
    const durableBefore = storage.values.get('profile');
    const backupsBefore = storage.values.get(profileBackupKey('profile'));
    const candidate = game.current().getExportData();

    let takeover: Promise<boolean> | undefined;
    let retryDuringArbitration = true;
    let backupDuringArbitration: ReturnType<Game['createBackup']> | undefined;
    let importDuringArbitration: ImportResult | undefined;
    act(() => {
      takeover = game.current().takeOverSaveOwnership();
      retryDuringArbitration = game.current().retrySave();
      backupDuringArbitration = game.current().createBackup('too soon');
      importDuringArbitration = game.current().importSave(candidate);
    });

    expect(retryDuringArbitration).toBe(false);
    expect(backupDuringArbitration).toEqual({
      stored: false,
      reason: 'ownership_conflict',
    });
    expect(importDuringArbitration).toMatchObject({
      ok: false,
      code: 'ownership_conflict',
    });
    expect(storage.values.get('profile')).toBe(durableBefore);
    expect(storage.values.get(profileBackupKey('profile'))).toBe(backupsBefore);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
      expect(await takeover).toBe(true);
    });
    expect(readStoredNote('profile', 'goal')).toBe('wait for re-verification');
  });

  it('reloads the latest valid durable state and clears local pending data', async () => {
    seedForeignWriterLease('profile', 'tab-a');
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();
    const durable = JSON.parse(game.current().getExportData());
    durable.userNotes.goal = 'durable';
    storage.values.set('profile', JSON.stringify(durable));

    act(() => game.current().saveNote('goal', 'local-only'));
    expect(game.current().hasPendingChanges).toBe(true);
    let result: ImportResult | undefined;
    act(() => { result = game.current().reloadLatestSave(); });

    expect(result?.ok).toBe(true);
    expect(game.current().userNotes.goal).toBe('durable');
    expect(game.current().hasPendingChanges).toBe(false);
    expect(game.current().saveOwnershipStatus).toBe('blocked');
  });

  it('leaves local state and pending data untouched when reload validation fails', async () => {
    seedForeignWriterLease('profile', 'tab-a');
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();
    act(() => game.current().saveNote('goal', 'keep me'));
    const pendingBefore = getPendingSave('profile')?.data;
    const stateBefore = game.current().getExportData();
    storage.values.set('profile', '{bad');

    let result: ImportResult | undefined;
    act(() => { result = game.current().reloadLatestSave(); });

    expect(result?.ok).toBe(false);
    expect(game.current().getExportData()).toBe(stateBefore);
    expect(getPendingSave('profile')?.data).toBe(pendingBefore);
  });

  it('blocks import, restore, and backup writes behind foreign ownership', async () => {
    seedForeignWriterLease('profile', 'tab-a');
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();
    const candidate = game.current().getExportData();
    storage.values.set(profileBackupKey('profile'), JSON.stringify([{
      ts: 7,
      reason: 'fixture',
      summary: 'fixture',
      data: candidate,
    }]));
    const durableBefore = storage.values.get('profile');
    const backupsBefore = storage.values.get(profileBackupKey('profile'));

    expect(game.current().importSave(candidate)).toMatchObject({
      ok: false,
      code: 'ownership_conflict',
    });
    expect(game.current().restoreBackup(7)).toMatchObject({
      ok: false,
      code: 'ownership_conflict',
    });
    expect(game.current().createBackup('blocked')).toEqual({
      stored: false,
      reason: 'ownership_conflict',
    });
    expect(storage.values.get('profile')).toBe(durableBefore);
    expect(storage.values.get(profileBackupKey('profile'))).toBe(backupsBefore);
  });

  it('keeps a blocked reset in memory without writing a backup', async () => {
    seedForeignWriterLease('profile', 'tab-a');
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();
    const backupsBefore = storage.values.get(profileBackupKey('profile'));

    act(() => game.current().resetGame());

    expect(game.current().hasPendingChanges).toBe(true);
    expect(getPendingSave('profile')).not.toBeNull();
    expect(storage.values.get(profileBackupKey('profile'))).toBe(backupsBefore);
  });

  it('backs up the captured session-start state after deferred ownership acquisition', async () => {
    const initialSessionState = gameReducerForTest(
      { ...structuredClone(initialState), lastEvent: null },
      {
        type: 'ROLL_RESULT',
        payload: {
          success: false,
          omni: false,
          pity: false,
          roll: 99,
          baseThreshold: 50,
          threshold: 50,
          source: 'Session-start fixture',
          failureFate: 1,
        },
      },
    );
    const initialSessionData = serializeCurrent(initialSessionState);
    storage.values.set('profile', initialSessionData);
    seedForeignWriterLease('profile', 'tab-a');
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();

    act(() => game.current().saveNote('goal', 'edited while blocked'));
    const writerKey = writerLeaseKey('profile');
    storage.values.delete(writerKey);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: writerKey })));
    await settleOwnership();

    const backups = JSON.parse(
      storage.values.get(profileBackupKey('profile')) ?? '[]',
    ) as Array<{ reason: string; data: string }>;
    const sessionStart = backups.find(entry => entry.reason === 'Session start');
    const captured = JSON.parse(sessionStart?.data ?? '{}');
    expect(captured.runRevision).toBe(initialSessionState.runRevision);
    expect(captured.history[0]?.message).toBe('No Key.');
    expect(captured.userNotes.goal).toBeUndefined();
    expect(game.current().userNotes.goal).toBe('edited while blocked');
  });

  it('rewrites a migrated save because the baseline keeps the exact durable input', async () => {
    const legacy = structuredClone(initialState) as unknown as Record<string, unknown>;
    legacy.version = 2;
    delete legacy.runId;
    delete legacy.runRevision;
    legacy.userNotes = { goal: 'legacy migration' };
    const legacyData = JSON.stringify(legacy);
    storage.values.set('profile', legacyData);

    const game = renderGame('profile', { ownerId: 'tab-a' });
    expect(game.current().userNotes.goal).toBe('legacy migration');
    await settleOwnership();
    await act(async () => vi.advanceTimersByTimeAsync(500));

    const rewritten = storage.values.get('profile')!;
    expect(rewritten).not.toBe(legacyData);
    expect(JSON.parse(rewritten)).toMatchObject({
      version: 4,
      userNotes: { goal: 'legacy migration' },
    });
    expect(getPendingSave('profile')).toBeNull();
  });

  it('restages pending-ahead state against the exact durable baseline on pagehide', async () => {
    const durableState = structuredClone(initialState);
    durableState.userNotes = { goal: 'durable' };
    const pendingState = structuredClone(initialState);
    pendingState.userNotes = { goal: 'pending ahead' };
    const durableData = serializeCurrent(durableState);
    storage.values.set('profile', durableData);
    stagePendingSave('profile', serializeCurrent(pendingState));
    seedForeignWriterLease('profile', 'tab-a');
    const foreignLease = storage.values.get(writerLeaseKey('profile'));
    const game = renderGame('profile', { ownerId: 'tab-b' });
    await settleOwnership();
    expect(game.current().userNotes.goal).toBe('pending ahead');

    act(() => {
      discardPendingSave('profile');
      window.dispatchEvent(new Event('pagehide'));
      expect(JSON.parse(getPendingSave('profile')?.data ?? '{}').userNotes.goal)
        .toBe('pending ahead');
    });

    expect(storage.values.get('profile')).toBe(durableData);
    expect(storage.values.get(writerLeaseKey('profile'))).toBe(foreignLease);
  });

  it('subscribes to pending changes for the active profile', async () => {
    const game = renderGame('profile');
    await settleOwnership();
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(game.current().hasPendingChanges).toBe(false);

    await act(async () => {
      stagePendingSave('other-profile', game.current().getExportData());
      await Promise.resolve();
    });
    expect(game.current().hasPendingChanges).toBe(false);

    await act(async () => {
      stagePendingSave('profile', game.current().getExportData());
      await Promise.resolve();
    });
    expect(game.current().hasPendingChanges).toBe(true);

    await act(async () => {
      discardPendingSave('profile');
      await Promise.resolve();
    });
    expect(game.current().hasPendingChanges).toBe(false);
  });

  it('ignores a queued pending notification after unsubscribe', () => {
    const queued: Array<() => void> = [];
    vi.stubGlobal('queueMicrotask', (task: () => void) => { queued.push(task); });
    let notifications = 0;
    const unsubscribe = subscribeToPendingSaveChanges(() => { notifications += 1; });
    stagePendingSave('profile', serializeCurrent(initialState));
    expect(queued).toHaveLength(1);

    unsubscribe();
    queued[0]();
    expect(notifications).toBe(0);
  });
});

describe('run identity and revision', () => {
  it('assigns a stable run id to an old save', () => {
    const first = migrateSaveForTest({ history: [] });
    const second = migrateSaveForTest(first);

    expect(first.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(first.runRevision).toBe(0);
    expect(second.runId).toBe(first.runId);
  });

  it('increments revision for a persistent mutation but not a no-op', () => {
    const start = {
      ...migrateSaveForTest({ history: [] }),
      runRevision: 7,
      lastEvent: null,
    };
    const changed = gameReducerForTest(start, {
      type: 'SET_LINKED_ACCOUNT',
      payload: 'Nubles',
    });
    expect(changed.runRevision).toBe(8);

    const noOp = gameReducerForTest(changed, {
      type: 'SET_LINKED_ACCOUNT',
      payload: 'Other',
    });
    expect(noOp).toBe(changed);
    expect(noOp.runRevision).toBe(8);
  });

  it('creates an RFC 4122 id through the random-byte fallback', () => {
    const id = newRunIdForTest({
      getRandomValues(bytes: Uint8Array) {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    });

    expect(id).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });
});


describe('level-up feedback integration', () => {
  it('keeps the exact Chaos reward metadata on the final observable event', () => {
    const storageKey = 'level-up-feedback';
    const seeded = {
      ...structuredClone(initialState),
      unlocks: {
        ...initialState.unlocks,
        levels: { ...initialState.unlocks.levels, Attack: 29 },
      },
    };
    localStorage.setItem(storageKey, serializeCurrent(seeded));
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.01)
      .mockReturnValue(0.99);
    let current: Game | undefined;

    render(
      <GameProvider storageKey={storageKey}>
        <GameCapture onGame={game => { current = game; }} />
      </GameProvider>,
    );

    act(() => current?.levelUpSkill('Attack'));

    expect(current?.lastEvent).toMatchObject({
      type: 'ROLL_FAIL',
      meta: { chaosKeysAwarded: 2, chaosKeyAwarded: true },
    });
    expect(random).toHaveBeenCalledTimes(3);
  });
});
describe('quest completion integration', () => {
  type ProviderSnapshot = {
    state: GameState;
    lastEvent: Game['lastEvent'];
  };

  const persistedState = (game: Game): GameState =>
    JSON.parse(game.getExportData()) as GameState;

  const providerSnapshot = (game: Game): ProviderSnapshot => ({
    state: persistedState(game),
    lastEvent: structuredClone(game.lastEvent),
  });

  const keyRollHistory = (state: GameState) => state.history.filter(entry =>
    ['ROLL_SUCCESS', 'ROLL_FAIL', 'ROLL_OMNI', 'PITY'].includes(entry.type),
  );

  const stableStateProjection = (state: GameState, removeAcceptedDeltas: boolean) => {
    const {
      runRevision: _runRevision,
      fatePoints: _fatePoints,
      history,
      unlocks,
      ...stable
    } = state;
    return {
      ...stable,
      unlocks: {
        ...unlocks,
        quests: removeAcceptedDeltas
          ? unlocks.quests.slice(0, -1)
          : unlocks.quests,
      },
      history: removeAcceptedDeltas ? history.slice(0, -1) : history,
    };
  };

  const expectAcceptedCompletion = (
    before: ProviderSnapshot,
    after: ProviderSnapshot,
    id: string,
    source: string,
    threshold: number,
    successProbability: number,
    failureFate = 1,
  ) => {
    expect(after.state.runRevision).toBe(before.state.runRevision + 2);
    expect(after.state.unlocks.quests).toEqual([...before.state.unlocks.quests, id]);
    expect(after.state.history.slice(0, -1)).toEqual(before.state.history);
    expect(after.state.history).toHaveLength(before.state.history.length + 1);
    expect(keyRollHistory(after.state)).toHaveLength(keyRollHistory(before.state).length + 1);
    expect(after.state.history.at(-1)).toMatchObject({
      type: 'ROLL_FAIL',
      source,
      result: 'FAIL',
      rollValue: 100,
      baseThreshold: threshold,
      threshold,
      meta: {
        roll: 100,
        baseThreshold: threshold,
        threshold,
        source,
        fatePointsEarned: failureFate,
      },
    });
    expect(after.state).toMatchObject({
      keys: before.state.keys,
      specialKeys: before.state.specialKeys,
      chaosKeys: before.state.chaosKeys,
      bossStandardKeysAwarded: before.state.bossStandardKeysAwarded,
      clueStandardKeysAwarded: before.state.clueStandardKeysAwarded,
      fatePoints: before.state.fatePoints + failureFate,
      activeBuff: before.state.activeBuff,
    });
    expect(stableStateProjection(after.state, true)).toEqual(
      stableStateProjection(before.state, false),
    );
    expect(after.lastEvent).toEqual({
      id: expect.any(String),
      type: 'ROLL_FAIL',
      x: undefined,
      y: undefined,
      meta: {
        roll: 100,
        baseThreshold: threshold,
        threshold,
        successProbability,
        luckApplied: false,
        drawResolution: 1000,
        standardKeysAwarded: 0,
        rewardKind: 'none',
      },
    });
  };

  const renderStoredGame = (storageKey: string, save: unknown) => {
    localStorage.setItem(storageKey, JSON.stringify(save));
    let current: Game | undefined;
    render(
      <GameProvider storageKey={storageKey}>
        <GameCapture onGame={next => { current = next; }} />
      </GameProvider>,
    );
    return () => {
      if (!current) throw new Error('Game provider did not initialize');
      return current;
    };
  };

  it("leaves the complete run unchanged when Witch's Potion is machine-blocked", () => {
    const current = renderStoredGame('blocked-witch-completion', {
      unlocks: { regions: ['Asgarnia'] },
    });
    const before = providerSnapshot(current());
    let result: ReturnType<Game['completeQuest']> | undefined;

    act(() => {
      result = current().completeQuest(
        "Witch's Potion",
        undefined,
        undefined,
        { manualConfirmed: true },
      );
    });

    expect(result).toEqual({ ok: false, reason: 'Requires: Rimmington' });
    expect(providerSnapshot(current())).toEqual(before);
  });

  it('leaves the complete run unchanged when Murder Mystery is machine-blocked', () => {
    const current = renderStoredGame('blocked-murder-mystery-completion', {
      unlocks: { regions: ['Kandarin'] },
    });
    const before = providerSnapshot(current());
    let result: ReturnType<Game['completeQuest']> | undefined;

    act(() => {
      result = current().completeQuest(
        'Murder Mystery',
        undefined,
        undefined,
        { manualConfirmed: true },
      );
    });

    expect(result).toEqual({
      ok: false,
      reason: "Requires: Sinclair Mansion, Seers' Village",
    });
    expect(providerSnapshot(current())).toEqual(before);
  });

  it('completes a valid quest with exactly one roll and makes its repeat a full-state no-op', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const current = renderStoredGame('valid-quest-completion', {
      unlocks: { regions: ['Asgarnia', 'Rimmington'] },
    });
    const before = providerSnapshot(current());
    let first: ReturnType<Game['completeQuest']> | undefined;

    act(() => { first = current().completeQuest("Witch's Potion"); });

    const afterFirst = providerSnapshot(current());
    expect(first).toEqual({ ok: true });
    expectAcceptedCompletion(
      before,
      afterFirst,
      "Witch's Potion",
      'Quest (Novice)',
      25,
      0.25,
    );

    let repeated: ReturnType<Game['completeQuest']> | undefined;
    act(() => { repeated = current().completeQuest("Witch's Potion"); });

    expect(repeated).toEqual({ ok: false, reason: 'Already completed' });
    expect(providerSnapshot(current())).toEqual(afterFirst);
  });

  it('completes a valid miniquest with exactly one roll and makes its repeat a full-state no-op', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const current = renderStoredGame('valid-miniquest-completion', {
      unlocks: { regions: ['Kourend & Kebos'] },
    });
    const before = providerSnapshot(current());
    let first: ReturnType<Game['completeQuest']> | undefined;

    act(() => { first = current().completeQuest('In Search of Knowledge'); });

    const afterFirst = providerSnapshot(current());
    expect(first).toEqual({ ok: true });
    expectAcceptedCompletion(
      before,
      afterFirst,
      'In Search of Knowledge',
      'Quest (Experienced)',
      75,
      0.75,
      2,
    );

    let repeated: ReturnType<Game['completeQuest']> | undefined;
    act(() => { repeated = current().completeQuest('In Search of Knowledge'); });

    expect(repeated).toEqual({ ok: false, reason: 'Already completed' });
    expect(providerSnapshot(current())).toEqual(afterFirst);
  });
});

describe('detected progress reconciliation', () => {
  const start = () => ({
    ...migrateSaveForTest({ history: [] }),
    runRevision: 0,
    lastEvent: null,
  });

  it('reconciles a quest without producing a roll history entry', () => {
    const next = gameReducerForTest(start(), {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'QUEST', questId: 'Dragon Slayer I' },
    });

    expect(next.unlocks.quests).toContain('Dragon Slayer I');
    expect(next.history).toHaveLength(0);
  });

  it('uses max/set semantics and makes replay a no-op', () => {
    const skill = gameReducerForTest(start(), {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'SKILL_LEVEL', skill: 'Attack', level: 73 },
    });
    expect(skill.unlocks.levels.Attack).toBe(73);

    const replay = gameReducerForTest(skill, {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'SKILL_LEVEL', skill: 'Attack', level: 72 },
    });
    expect(replay).toBe(skill);

    const task = gameReducerForTest(replay, {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'CA_TASK', taskId: 'ca_0' },
    });
    expect(task.unlocks.completedTasks).toContain('ca_0');

    const item = gameReducerForTest(task, {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'COLLECTION_ITEM', itemId: 101001 },
    });
    expect(item.unlocks.collectionLog[101001]).toBe(1);
    expect(item.history).toHaveLength(0);
  });

  it('records detector metadata only on the invoked roll', () => {
    const next = gameReducerForTest(start(), {
      type: 'ROLL_RESULT',
      payload: {
        success: false,
        omni: false,
        pity: false,
        roll: 99,
        baseThreshold: 75,
        threshold: 75,
        source: 'Quest (Experienced)',
        failureFate: 2,
        meta: {
          fateEventId: 'evt-1',
          detectorId: 'quest-widget-v1',
          detectorVersion: 1,
        },
      },
    });

    expect(next.history.at(-1)?.meta).toMatchObject({
      fateEventId: 'evt-1',
      detectorId: 'quest-widget-v1',
      detectorVersion: 1,
    });
  });

  it('accepts detected progress and its prepared roll in one revision', () => {
    const initial = { ...start(), runId: 'run-1', runRevision: 11, linkedAccount: 'Nubles' };
    const action = prepareDetectedEventAcceptanceAction(
      initial,
      { kind: 'QUEST', questId: 'Dragon Slayer I' },
      { source: 'Quest (Experienced)', threshold: 75, failureFate: 2, target: 'Dragon Slayer I' },
      () => 999,
      { fateEventId: 'evt-atomic', detectorId: 'quest-widget-v1', detectorVersion: 1 },
      { runId: 'run-1', account: 'Nubles', runRevision: 11 },
    );
    const next = gameReducerForTest(initial, action);

    expect(next.runRevision).toBe(12);
    expect(next.unlocks.quests).toContain('Dragon Slayer I');
    expect(next.history).toHaveLength(1);
    expect(next.history[0].meta?.fateEventId).toBe('evt-atomic');
  });

  it('grants a detected skill milestone with one independent chaos draw', () => {
    const initial = {
      ...start(),
      runId: 'run-1',
      runRevision: 11,
      linkedAccount: 'Nubles',
      unlocks: {
        ...start().unlocks,
        levels: { ...start().unlocks.levels, Attack: 29 },
      },
    };
    let draws = 0;
    const action = prepareDetectedEventAcceptanceAction(
      initial,
      { kind: 'SKILL_LEVEL', skill: 'Attack', level: 30 },
      { source: 'Attack Level 30', threshold: 6, failureFate: 2, target: 'Attack Level 30' },
      (_purpose, _index, max = 100) => {
        draws += 1;
        return max;
      },
      { fateEventId: 'evt-skill-30', detectorId: 'skill-level-v1', detectorVersion: 1 },
      { runId: 'run-1', account: 'Nubles', runRevision: 11 },
    );
    expect(draws).toBe(3);
    const next = gameReducerForTest(initial, action);
    expect(draws).toBe(3);
    expect(next.unlocks.levels.Attack).toBe(30);
    expect(next.chaosKeys).toBe(initial.chaosKeys + 1);
    expect(next.history).toHaveLength(1);
    expect(next.history[0].type).toBe('ROLL_FAIL');
  });

  it('awards every crossed detected skill milestone plus one independent chaos draw atomically', () => {
    const initial = {
      ...start(),
      runId: 'run-1',
      runRevision: 11,
      linkedAccount: 'Nubles',
      unlocks: {
        ...start().unlocks,
        levels: { ...start().unlocks.levels, Attack: 29 },
      },
    };
    const draws: Array<{ purpose: string; index: number }> = [];
    const action = prepareDetectedEventAcceptanceAction(
      initial,
      { kind: 'SKILL_LEVEL', skill: 'Attack', level: 41 },
      { source: 'Attack Level 41', threshold: 8.2, failureFate: 3, target: 'Attack Level 41' },
      (purpose, index = 0, max = 100) => {
        draws.push({ purpose, index });
        return purpose === 'detected-skill-chaos' ? 1 : max;
      },
      { fateEventId: 'evt-skill-41', detectorId: 'skill-level-v1', detectorVersion: 1 },
      { runId: 'run-1', account: 'Nubles', runRevision: 11 },
    );

    expect(draws).toEqual([
      { purpose: 'detected-skill-chaos', index: 0 },
      { purpose: 'roll', index: 0 },
      { purpose: 'roll', index: 1 },
    ]);

    const next = gameReducerForTest(initial, action);

    expect(next).toMatchObject({
      runRevision: 12,
      chaosKeys: initial.chaosKeys + 3,
      unlocks: { levels: { Attack: 41 } },
    });
    expect(next.history.at(-1)?.meta).toMatchObject({
      chaosKeysAwarded: 3,
      guaranteedChaosKeysAwarded: 2,
      randomChaosKeysAwarded: 1,
    });
    expect(draws).toHaveLength(3);
  });

  it('cannot partially reconcile when roll preparation fails', () => {
    const initial = start();

    expect(() => prepareDetectedEventAcceptanceAction(
      initial,
      { kind: 'QUEST', questId: 'Dragon Slayer I' },
      { source: 'Quest (Experienced)', threshold: 75, failureFate: 2, target: 'Dragon Slayer I' },
      () => { throw new Error('rng unavailable'); },
      { fateEventId: 'evt-failed' },
      { runId: initial.runId, account: 'Nubles', runRevision: 0 },
    )).toThrow('rng unavailable');
    expect(initial.runRevision).toBe(0);
    expect(initial.unlocks.quests).not.toContain('Dragon Slayer I');
    expect(initial.history).toHaveLength(0);
  });

  it.each([
    ['run id', { runId: 'run-2' }],
    ['account', { linkedAccount: 'Other' }],
    ['revision', { runRevision: 12 }],
  ] as const)('authoritatively rejects acceptance after the live %s changes', (_field, override) => {
    const original = {
      ...start(),
      runId: 'run-1',
      runRevision: 11,
      linkedAccount: 'Nubles',
    };
    const action = prepareDetectedEventAcceptanceAction(
      original,
      { kind: 'QUEST', questId: 'Dragon Slayer I' },
      { source: 'Quest (Experienced)', threshold: 75, failureFate: 2, target: 'Dragon Slayer I' },
      () => 999,
      { fateEventId: 'evt-stale' },
      { runId: 'run-1', account: 'Nubles', runRevision: 11 },
    );
    const current = { ...original, ...override };

    const next = gameReducerForTest(current, action);

    expect(next).toBe(current);
    expect(next.unlocks.quests).not.toContain('Dragon Slayer I');
    expect(next.history).toHaveLength(0);
  });

  it('reconciles diary task IDs as completed tasks, not completed tiers', () => {
    const next = gameReducerForTest(start(), {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'DIARY_TASK', taskId: 'Ardougne Easy:0' },
    });

    expect(next.unlocks.completedTasks).toContain('Ardougne Easy:0');
    expect(next.unlocks.diaries).not.toContain('Ardougne Easy:0');
  });
});
