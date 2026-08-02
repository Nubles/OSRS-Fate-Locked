// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SaveAuthorizationError,
  SaveOwnershipConflictError,
} from '../utils/gamePersistence';
import { parseAndMigrateSave } from '../utils/saveSchema';
import { serializeCurrent } from '../utils/gamePersistence';
import type { SaveWriteAuthorization } from '../utils/profileWriterLease';
import * as GameContext from './GameContext';
import {
  getPendingSave,
  resetPendingSavesForTest,
} from '../utils/pendingSaves';
import {
  writerLeaseKey,
  WRITER_LEASE_ARBITRATION_MS,
} from '../utils/profileWriterLease';

type DurableWriter = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
  data: string,
  pending: { current: number | null },
  cancel: (handle: number) => void,
  authorizeWrite: () => SaveWriteAuthorization,
) => void;

describe('explicit replacement persistence', () => {
  it('cancels the obsolete debounce only after a durable write succeeds', () => {
    const writeReplacementNow = (
      GameContext as unknown as { writeReplacementNow?: DurableWriter }
    ).writeReplacementNow;
    expect(writeReplacementNow).toBeTypeOf('function');
    if (!writeReplacementNow) return;

    const events: string[] = [];
    const pending = { current: 17 };
    writeReplacementNow({
      setItem: (_key, data) => { events.push('write:' + JSON.parse(data).keys); },
    }, 'profile', '{"keys":9}', pending, handle => { events.push('cancel:' + handle); }, () => ({ ok: true }));
    expect(events).toEqual(['write:9', 'cancel:17']);
    expect(pending.current).toBeNull();

    events.length = 0;
    pending.current = 23;
    expect(() => writeReplacementNow({
      setItem: () => {
        events.push('write');
        throw new Error('quota');
      },
    }, 'profile', '{"keys":9}', pending, handle => { events.push('cancel:' + handle); }, () => ({ ok: true })))
      .toThrow('quota');
    expect(events).toEqual(['write']);
    expect(pending.current).toBe(23);

    events.length = 0;
    expect(() => writeReplacementNow({
      setItem: () => { events.push('write'); },
    }, 'profile', '{"keys":9}', pending, handle => {
      events.push('cancel:' + handle);
    }, () => ({
      ok: false, reason: 'ownership_conflict',
    }))).toThrow(SaveOwnershipConflictError);
    expect(events).toEqual([]);
    expect(pending.current).toBe(23);
  });

  it('throws a typed storage denial before touching durable state', () => {
    const writeReplacementNow = (
      GameContext as unknown as { writeReplacementNow?: DurableWriter }
    ).writeReplacementNow;
    expect(writeReplacementNow).toBeTypeOf('function');
    if (!writeReplacementNow) return;

    const setItem = vi.fn();
    const cancelPending = vi.fn();
    const pending = { current: 23 };
    let thrown: unknown;
    try {
      writeReplacementNow(
        { setItem },
        'profile',
        '{"keys":9}',
        pending,
        cancelPending,
        () => ({ ok: false, reason: 'storage_unavailable' }),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SaveAuthorizationError);
    expect(thrown).toMatchObject({
      name: 'SaveAuthorizationError',
      code: 'storage_unavailable',
    });
    expect(setItem).not.toHaveBeenCalled();
    expect(cancelPending).not.toHaveBeenCalled();
    expect(pending.current).toBe(23);
  });
});

describe('roll history persistence', () => {
  it('round-trips a production decimal roll through the strict save schema', () => {
    const rolled = GameContext.gameReducer(
      { ...structuredClone(GameContext.initialState), lastEvent: null },
      {
        type: 'ROLL_RESULT',
        payload: {
          success: true,
          omni: false,
          pity: false,
          roll: 8.2,
          baseThreshold: 8.2,
          threshold: 9.2,
          source: 'Attack Level 41',
        },
      },
    );

    const parsed = parseAndMigrateSave(
      serializeCurrent(rolled),
      GameContext.initialState,
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) throw new Error(`${parsed.code}: ${parsed.path ?? ''}`);
    expect(parsed.state.history.at(-1)).toMatchObject({
      rollValue: 8.2,
      baseThreshold: 8.2,
      threshold: 9.2,
      meta: { fatePointsEarned: 0 },
    });
  });

  it('continues accepting legacy roll history without a base threshold', () => {
    const legacy = structuredClone(GameContext.initialState);
    legacy.history = [{
      id: 'legacy-roll',
      timestamp: 1,
      type: 'ROLL_SUCCESS',
      message: 'Key Found!',
      rollValue: 8,
      threshold: 9,
    }];

    const parsed = parseAndMigrateSave(JSON.stringify(legacy), GameContext.initialState);

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) throw new Error(`${parsed.code}: ${parsed.path ?? ''}`);
    expect(parsed.state.history[0]).toMatchObject({ rollValue: 8, threshold: 9 });
    expect(parsed.state.history[0]).not.toHaveProperty('baseThreshold');
    expect(parsed.state.history[0].meta).toBeUndefined();
  });
});

describe('forced profile eviction persistence', () => {
  const storageKey = 'FATE_PROFILE_target';
  const values = new Map<string, string>();
  const baseWrites: string[] = [];
  let pendingObservedAtRelease: ReturnType<typeof getPendingSave> = null;

  beforeEach(() => {
    vi.useFakeTimers();
    values.clear();
    baseWrites.length = 0;
    pendingObservedAtRelease = null;
    resetPendingSavesForTest();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === storageKey) baseWrites.push(value);
        values.set(key, value);
      },
      removeItem: (key: string) => {
        if (key === writerLeaseKey(storageKey)) {
          pendingObservedAtRelease = getPendingSave(storageKey);
        }
        values.delete(key);
      },
      clear: () => values.clear(),
    });
  });

  afterEach(() => {
    cleanup();
    resetPendingSavesForTest();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stages and blocks the newest snapshot before releasing ownership and prevents later writes', async () => {
    type Game = ReturnType<typeof GameContext.useGame>;
    let current: Game | undefined;
    const Capture = ({ onGame }: { onGame: (game: Game) => void }) => {
      onGame(GameContext.useGame());
      return null;
    };
    render(React.createElement(
      GameContext.GameProvider,
      {
        storageKey,
        leaseOptions: { ownerId: 'evicted-tab' },
        children: React.createElement(Capture, {
          onGame: (game: Game) => { current = game; },
        }),
      },
    ));
    const game = () => {
      if (!current) throw new Error('Game provider did not initialize');
      return current;
    };

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
    });
    expect(game().saveOwnershipStatus).toBe('owner');

    act(() => {
      game().saveNote('latest', 'newest snapshot');
      game().stageForProfileEviction();
    });

    const pending = getPendingSave(storageKey);
    expect(pending).toMatchObject({
      status: 'saving',
      reason: 'ownership_conflict',
    });
    expect(JSON.parse(pending?.data ?? '{}').userNotes.latest).toBe('newest snapshot');
    expect(pendingObservedAtRelease).toMatchObject({
      reason: 'ownership_conflict',
    });
    expect(values.has(writerLeaseKey(storageKey))).toBe(false);

    act(() => {
      game().saveNote('later', 'must not write');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(game().retrySave()).toBe(false);
    expect(baseWrites).toEqual([]);
    expect(getPendingSave(storageKey)?.reason).toBe('ownership_conflict');
  });
});
