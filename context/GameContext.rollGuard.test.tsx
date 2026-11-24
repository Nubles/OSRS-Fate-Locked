// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  saveBootstrapResultFromDecision,
  type SaveBootstrapResult,
} from '../components/SaveBootstrap';
import { serializeCurrent } from '../utils/gamePersistence';
import { resetPendingSavesForTest } from '../utils/pendingSaves';
import { writerLeaseKey, WRITER_LEASE_TTL_MS } from '../utils/profileWriterLease';
import { openRecoveryDatabase } from '../utils/recoveryDatabase';
import type { RecoveryHead, RecoveryRepository } from '../utils/recoveryTypes';
import { checksumSave } from '../utils/saveIntegrity';
import { resolveSaveRecovery, type SaveRecoveryDecision } from '../utils/saveRecovery';
import { profileMirrorMetadataKey } from '../utils/storageRecovery';
import { GameProvider, initialState, useGame } from './GameContext';
import { TableType } from '../types';

/**
 * A roll is saved before it is revealed, and a roll whose save fails takes the
 * run off screen until Retry save lands. So a roll is refused while its save
 * cannot be written: another tab saved newer progress (the choice is on the
 * conflict banner) or the browser save is already failing (Export backup is on
 * the failure banner). Rolling then hid both behind a Retry that never landed.
 */
type Game = ReturnType<typeof useGame>;

const GameCapture = ({ onGame }: { onGame: (game: Game) => void }) => {
  onGame(useGame());
  return null;
};

let values: Map<string, string>;
let failKey: string | null;
let repository: RecoveryRepository;
let toasts: string[];
const onToast = (event: Event) => {
  toasts.push((event as CustomEvent<{ message: string }>).detail.message);
};

beforeEach(async () => {
  resetPendingSavesForTest();
  failKey = null;
  values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (key === failKey) throw new DOMException('full', 'QuotaExceededError'); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  });
  repository = await openRecoveryDatabase();
  toasts = [];
  window.addEventListener('fate:toast', onToast);
});

afterEach(() => {
  window.removeEventListener('fate:toast', onToast);
  cleanup();
  repository.close();
  resetPendingSavesForTest();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const run = (note: string) => ({ ...structuredClone(initialState), keys: 5, userNotes: { goal: note } });

const recordFor = async (
  profileId: string,
  note: string,
  persistenceRevision: number,
): Promise<RecoveryHead> => {
  const state = run(note);
  const data = serializeCurrent(state);
  return {
    profileId,
    persistenceRevision,
    runId: state.runId,
    runRevision: state.runRevision,
    capturedAt: persistenceRevision * 100,
    checksum: await checksumSave(data),
    data,
  };
};

const keyFor = (profileId: string): string => `FATE_PROFILE_${profileId}`;

const writeJournal = async (record: RecoveryHead): Promise<void> => {
  await repository.putHead(record, () => ({ ok: true }));
};

/** The browser's copy of a journal record: the save and its sidecar. */
const writeBrowserCopy = (record: RecoveryHead): void => {
  const storageKey = keyFor(record.profileId);
  values.set(storageKey, record.data);
  values.set(profileMirrorMetadataKey(storageKey), JSON.stringify({
    version: 1,
    persistenceRevision: record.persistenceRevision,
    capturedAt: record.capturedAt,
    checksum: record.checksum,
  }));
};

const holdLeaseElsewhere = (profileId: string): void => {
  values.set(writerLeaseKey(keyFor(profileId)), JSON.stringify({
    version: 1,
    ownerId: 'other-tab',
    expiresAt: Date.now() + WRITER_LEASE_TTL_MS,
  }));
};

const endLeaseElsewhere = (profileId: string): void => {
  const leaseKey = writerLeaseKey(keyFor(profileId));
  values.delete(leaseKey);
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: leaseKey })); });
};

/** What a page load decides from the saved copies as they stand. */
const startupDecision = async (profileId: string): Promise<SaveRecoveryDecision> => {
  const storageKey = keyFor(profileId);
  return resolveSaveRecovery({
    profileId,
    pendingRaw: null,
    primaryRaw: values.get(storageKey) ?? null,
    mirrorMetadataRaw: values.get(profileMirrorMetadataKey(storageKey)) ?? null,
    head: await repository.getHead(profileId),
    checkpoints: await repository.listCheckpoints(profileId),
    defaults: initialState,
  });
};

const openTab = async (profileId: string) => {
  const bootstrap = saveBootstrapResultFromDecision(await startupDecision(profileId)) as SaveBootstrapResult;
  let current: Game | undefined;
  render(
    <GameProvider
      storageKey={keyFor(profileId)}
      bootstrap={bootstrap}
      leaseOptions={{ ownerId: 'this-tab' }}
    >
      <GameCapture onGame={game => { current = game; }} /><div data-testid="run-ui">Run</div>
    </GameProvider>,
  );
  return { bootstrap, game: () => current! };
};

const runShown = (): string =>
  (document.querySelector('[data-testid="run-ui"]')!.parentElement as HTMLElement).style.display;
const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });

describe('a roll whose save cannot be written', () => {
  it('is refused while another tab saved newer progress, and the choice stays on screen', async () => {
    const profileId = 'roll-guard-newer-save';
    const loaded = await recordFor(profileId, 'loaded by both tabs', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));
    act(() => game().saveNote('goal', 'this tab'));
    await writeJournal(await recordFor(profileId, 'other tab progress', 5));
    endLeaseElsewhere(profileId);
    await waitFor(() => expect(game().saveOwnershipBlockReason).toBe('newer_save'));
    // The lease is this tab's again; only the newer save holds the write.
    act(() => game().rollUnlock(TableType.SKILLS));
    await wait(50);
    expect(game().keys).toBe(5);
    expect(game().pendingUnlock).toBeUndefined();
    expect(toasts).toContain('Save ownership is unavailable. Restore save access before rolling.');
    expect(runShown()).toBe('contents');
  });

  it('is refused while the browser save is failing, and the run (with Export backup) stays on screen', async () => {
    const profileId = 'roll-guard-storage-full';
    const loaded = await recordFor(profileId, 'start', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    // Neither the journal nor the browser copy can be written; the small lease still can.
    vi.spyOn(indexedDB, 'open').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    failKey = keyFor(profileId);
    act(() => game().saveNote('goal', 'progress after storage filled'));
    await wait(900);
    expect(game().saveDurability.primary).toBe('failed');
    act(() => game().rollUnlock(TableType.SKILLS));
    await wait(50);
    expect(game().keys).toBe(5);
    expect(game().pendingUnlock).toBeUndefined();
    expect(toasts).toContain("Your progress isn't saving right now. Retry the save or export a backup before rolling.");
    expect(runShown()).toBe('contents');
    expect(document.body.textContent).not.toContain('Your roll is waiting to be saved');
  });
});
