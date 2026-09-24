import { describe, it, expect } from 'vitest';
import { createFreshState, gameReducer, prepareKeyRollAction } from './GameContext';
import { auditHistory, replayInvariants, verifyChain, ensureChain } from '../utils/integrity';
import { seededContext, drawDice } from '../utils/seededRng';
import { resolveModeRules, GAME_MODES } from '../config/gameModes';
import { validateAndMigrateSave } from '../utils/saveSchema';
import { DropSource, TableType, type LogEntry } from '../types';

const fresh = () => ({ ...createFreshState(), lastEvent: null });
const persisted = (state: ReturnType<typeof fresh>) => { const { lastEvent, ...save } = state; return JSON.parse(JSON.stringify(save)); };
const failures = (n: number, customMultiplier = 1) => {
  let state = { ...fresh(), gameModeId: 'custom', customMode: { ...resolveModeRules('vanilla'), ritualCostMultiplier: customMultiplier } };
  for (let i = 0; i < n; i++) state = gameReducer(state, prepareKeyRollAction(state, DropSource.CLUE_BEGINNER, 5, 1, (_p, _i, max = 100) => max)!) as typeof state;
  return state;
};

describe('audited process repairs', () => {
  it.each([['RITUAL_LUCK', 8, 1], ['RITUAL_GREED', 15, 1], ['RITUAL_LUCK', 12, 1.5], ['RITUAL_GREED', 9, 0.6], ['RITUAL_CHAOS', 25, 1]] as const)(
    'replays exact paid cost for %s at %i Fate', (type, cost, multiplier) => {
      const state = gameReducer(failures(cost, multiplier), { type });
      const report = auditHistory(state.history);
      expect(state.history.at(-1)?.meta?.fateCost).toBe(cost);
      expect(report.verdict).toBe('verified');
      expect(report.final).toMatchObject({ fatePoints: state.fatePoints, keys: state.keys, chaosKeys: state.chaosKeys });
    });

  it.each([true, false])('replays Gambit and subsequent spending (won=%s)', won => {
    let state = gameReducer(failures(30), { type: 'RITUAL_GAMBIT', payload: { won, stake: 30, keysWon: 2 } });
    if (won) for (let i = 0; i < 5; i++) state = gameReducer(state, { type: 'UNLOCK', payload: { table: TableType.SKILLS, item: 'Attack', costType: 'key', cost: 1 } });
    const report = auditHistory(state.history);
    expect(report.verdict).toBe('verified');
    expect(report.final).toMatchObject({ keys: state.keys, fatePoints: 0 });
  });

  it('replays Cartographer spending and a granted chunk', () => {
    const state = gameReducer({ ...failures(40), gameModeId: 'chunked' }, { type: 'RITUAL_CARTOGRAPHER', payload: { chunkKey: '46,51', label: 'Falador' } });
    expect(auditHistory(state.history)).toMatchObject({ verdict: 'verified', final: { fatePoints: 0, unlocks: 1 } });
    expect(state.unlocks.chunks).toContain('46,51');
    expect(state.history.at(-1)?.meta).toMatchObject({ ritual: 'CARTOGRAPHER', fateCost: 40, chunk: '46,51' });
  });

  it('trusts exact Cartographer metadata without evaluating a missing-details fallback', () => {
    const state = failures(40);
    const history: LogEntry[] = [...state.history, { id: 'cart', timestamp: 1, type: 'ALTAR', message: 'Cartographer', meta: { ritual: 'CARTOGRAPHER', fateCost: 40, chunk: '46,51' } }];
    const report = auditHistory(history);
    expect(report.verdict).toBe('verified');
    expect(report.violations).toEqual([]);
    expect(report.final).toMatchObject({ fatePoints: 0, unlocks: 1 });
  });

  it('preserves old hash bodies and explicitly qualifies unrecorded ritual prices', () => {
    const history = ensureChain([{ id: 'old', timestamp: 1, type: 'ALTAR', message: 'Ritual of Clarity' }]);
    const before = JSON.stringify(history);
    const result = auditHistory(history);
    expect(result.verdict).toBe('warning');
    expect(result.violations.map(v => v.kind)).toEqual(['LEGACY_RITUAL_ESTIMATE']);
    expect(JSON.stringify(history)).toBe(before);
    expect(verifyChain(history).ok).toBe(true);
  });

  it('replays a Cartographer chart of Chaos Temple as Cartographer, not a Ritual of Chaos', () => {
    const start = { ...fresh(), gameModeId: 'chunked', fatePoints: 40 };
    const charted = gameReducer(start, {
      type: 'RITUAL_CARTOGRAPHER',
      payload: { chunkKey: '50,56', label: 'Chaos Temple (50, 56)' },
    });
    expect(charted.history.at(-1)?.message).toMatch(/Chaos/);

    // Replay counts the chart as an unlock and awards no Chaos Key.
    const audit = auditHistory(charted.history);
    expect(audit.final).toMatchObject({ chaosKeys: 0, unlocks: 1 });
    expect(charted.chaosKeys).toBe(0);
  });

  it('recovers legacy Gambit payout and Cartographer cost from their recorded messages', () => {
    const history: LogEntry[] = [
      { id: '1', timestamp: 1, type: 'ALTAR', message: 'Void Gambit WON — 2 Keys!', details: 'Staked 30 Fate; the Void blinked.' },
      { id: '2', timestamp: 2, type: 'ROLL_FAIL', message: 'No key', meta: { fatePointsEarned: 40 } },
      { id: '3', timestamp: 3, type: 'ALTAR', message: 'Cartographer charted Falador', details: 'Chose a frontier chunk for 40 Fate — the one decision Fate allows.' },
    ];
    expect(auditHistory(history)).toMatchObject({ verdict: 'verified', final: { keys: 5, fatePoints: 0, unlocks: 1 } });
  });

  it('accepts all valid 0.01–0.09 boss/clue rolls and rejects zero, non-finite and >100', () => {
    for (let i = 1; i < 10; i++) {
      const state = fresh();
      const action = prepareKeyRollAction(state, DropSource.CLUE_BEGINNER, 5, 1, (_p, index, max = 100) => index === 2 ? max : i, undefined, undefined, undefined, { kind: 'clue', clueTier: 'Beginner' })!;
      const next = gameReducer(state, action);
      expect(next.history[0].rollValue).toBe(i / 100);
      expect(auditHistory(next.history).verdict).toBe('verified');
    }
    for (const rollValue of [0, NaN, Infinity, 100.01]) {
      expect(replayInvariants([{ id: 'x', timestamp: 1, type: 'ROLL_FAIL', message: '', rollValue }]).violations.map(v => v.kind)).toContain('ROLL_OUT_OF_RANGE');
    }
  });

  it('keeps the old conversion only for existing seeded runs', () => {
    const dice = (_purpose: string, index?: number, max = 100) => index === 2 ? max : 4;
    const roll = (version?: 1 | 2) => prepareKeyRollAction({ ...fresh(), rngSeed: 'OLD', rngVersion: version }, DropSource.CLUE_BEGINNER, 5, 1, dice, undefined, undefined, undefined, { kind: 'clue', clueTier: 'Beginner' })!.payload.roll;
    expect(roll()).toBe(0.03);
    expect(roll(1)).toBe(0.03);
    expect(roll(2)).toBe(0.04);
  });

  it('gives two real fresh runs the same multi-roll sequence despite different event IDs', () => {
    const play = () => {
      let state = gameReducer(fresh(), { type: 'SET_SEED', payload: 'SHARED-RACE' });
      for (let i = 0; i < 8; i++) {
        const dice = (purpose: string, index = 0, max = 100) => drawDice(state.rngSeed!, seededContext(state), purpose, index, max);
        state = gameReducer(state, prepareKeyRollAction(state, DropSource.CLUE_BEGINNER, 5, 1, dice)!);
      }
      return state;
    };
    const a = play(), b = play();
    expect(a.history[0].id).not.toBe(b.history[0].id);
    expect(a.history.map(e => e.rollValue)).toEqual(b.history.map(e => e.rollValue));
    expect(seededContext(a)).toBe(seededContext(b));
    const roundtrip = validateAndMigrateSave(persisted(a as ReturnType<typeof fresh>), createFreshState());
    expect(roundtrip.ok).toBe(true);
    if (roundtrip.ok) { expect(roundtrip.state.rngVersion).toBe(2); expect(seededContext(roundtrip.state)).toBe(seededContext(a)); }
    const legacy = { ...a, rngVersion: undefined };
    expect(seededContext(legacy)).toBe(a.history.at(-1)?.hash);
    const legacyRoundtrip = validateAndMigrateSave(persisted(legacy as ReturnType<typeof fresh>), createFreshState());
    expect(legacyRoundtrip.ok).toBe(true);
    if (legacyRoundtrip.ok) expect(legacyRoundtrip.state.rngVersion).toBeUndefined();
    expect(gameReducer(a, { type: 'SET_SEED', payload: 'CHANGED' })).toBe(a);
  });

  it('restores retired preset rules without returning them to the picker', () => {
    expect(GAME_MODES.map(m => m.id)).toEqual(['vanilla', 'chunked']);
    expect(resolveModeRules('casual')).toMatchObject({ pityThreshold: 30, omniChanceBase: 4, ritualCostMultiplier: 0.6 });
    expect(resolveModeRules('hardcore')).toMatchObject({ pityEnabled: false, omniChanceBase: 1, ritualCostMultiplier: 1.5 });
    expect(resolveModeRules('region-rush')).toMatchObject({ pityThreshold: 45, regionModifiers: true });
    expect(resolveModeRules('xtreme')).toMatchObject({ startArea: 'lumbridge' });
    for (const mode of ['casual', 'hardcore', 'region-rush', 'xtreme']) {
      const loaded = validateAndMigrateSave(persisted({ ...fresh(), gameModeId: mode, gameModeLocked: true }), createFreshState());
      expect(loaded.ok).toBe(true);
      if (loaded.ok) expect(resolveModeRules(loaded.state.gameModeId)).toEqual(resolveModeRules(mode));
    }
  });
});
