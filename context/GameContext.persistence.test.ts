import { describe, expect, it, vi } from 'vitest';
import {
  SaveAuthorizationError,
  SaveOwnershipConflictError,
} from '../utils/gamePersistence';
import { parseAndMigrateSave } from '../utils/saveSchema';
import { serializeCurrent } from '../utils/gamePersistence';
import type { SaveWriteAuthorization } from '../utils/profileWriterLease';
import * as GameContext from './GameContext';

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
