// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { initialState, gameReducerForTest } from './GameContext';
import { auditHistory, hashEntry, replayInvariants, verifyChain } from '../utils/integrity';
import { resolveModeRules } from '../config/gameModes';
import type { LogEntry } from '../types';

describe.each([1, 0.5])('recorded ritual effects at multiplier %s', multiplier => {
  it.each([
    { type: 'RITUAL_LUCK' as const },
    { type: 'RITUAL_GREED' as const },
    { type: 'RITUAL_CHAOS' as const },
    { type: 'RITUAL_TRANSMUTE' as const },
    { type: 'RITUAL_GAMBIT' as const, payload: { won: true, stake: 40, keysWon: 2 } },
    { type: 'RITUAL_GAMBIT' as const, payload: { won: false, stake: 40, keysWon: 0 } },
    { type: 'RITUAL_CARTOGRAPHER' as const, payload: { chunkKey: '50,50', label: 'Test frontier' } },
  ])('replays actual reducer balances for $type', action => {
    let previous = 'GENESIS';
    const history: LogEntry[] = Array.from({ length: 40 }, (_, i) => {
      const entry: LogEntry = { id: String(i), timestamp: i, type: 'ROLL_FAIL', message: 'No Key.', meta: { fatePointsEarned: 1 } };
      const linked = { ...entry, prevHash: previous, hash: hashEntry(entry, previous) };
      previous = linked.hash;
      return linked;
    });
    const state = { ...initialState, keys: 10, fatePoints: 40, history, lastEvent: null, gameModeId: 'custom', customMode: { ...resolveModeRules('vanilla'), ritualCostMultiplier: multiplier } };
    const next = gameReducerForTest(state, action);
    const replay = replayInvariants(next.history, 10, resolveModeRules(next.gameModeId, next.customMode));
    expect(verifyChain(next.history).ok).toBe(true);
    expect(replay.uncertainAt).toEqual([]);
    expect(replay.violations).toEqual([]);
    expect(replay.final.keys).toBe(next.keys);
    expect(replay.final.specialKeys).toBe(next.specialKeys);
    expect(replay.final.chaosKeys).toBe(next.chaosKeys);
    expect(replay.final.fatePoints).toBe(next.fatePoints);
  });
});


describe('replacement history preserves imported evidence', () => {
  it.each([0, 1, 3])('does not hash a legacy import against a previous history of length %s', previousLength => {
    const legacy: LogEntry = { id: 'imported', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.' };
    const state = { ...initialState, history: Array.from({ length: previousLength }, (_, i) => ({ ...legacy, id: String(i) })), lastEvent: null };
    const imported = { ...initialState, history: [legacy], runRevision: 7 };
    const next = gameReducerForTest(state, { type: 'LOAD_SAVE', payload: imported });
    expect(next.history).toBe(imported.history);
    expect(next.history[0].hash).toBeUndefined();
    expect(next.runRevision).toBe(7);
    expect(auditHistory(next.history).verdict).toBe('warning');
  });
  it('preserves a mixed imported chain rather than filling in absent links', () => {
    const legacy: LogEntry = { id: 'mixed', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.' };
    const imported = { ...initialState, history: [{ ...legacy, prevHash: 'GENESIS', hash: hashEntry(legacy, 'GENESIS') }, { ...legacy, id: 'missing' }] };
    const next = gameReducerForTest({ ...initialState, lastEvent: null }, { type: 'LOAD_SAVE', payload: imported });
    expect(next.history).toBe(imported.history);
    expect(auditHistory(next.history).verdict).toBe('tampered');
  });
});
