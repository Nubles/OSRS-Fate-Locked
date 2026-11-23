import { describe, expect, it } from 'vitest';
import { gameReducer, initialState, prepareKeyRollAction } from '../context/GameContext';
import { DropSource, type LogEntry } from '../types';
import { DROP_RATES } from '../config/rules';
import { resolveModeRules } from '../config/gameModes';
import { auditHistory, replayInvariants } from './runAudit';

type RunState = Parameters<typeof gameReducer>[0];
const alwaysMiss = (_purpose: string, _index: number, sides = 100) => sides;
const miss = (s: RunState) => gameReducer(s, prepareKeyRollAction(s, DropSource.QUEST_NOVICE, DROP_RATES[DropSource.QUEST_NOVICE], 1, alwaysMiss)!);
const start = (over: Partial<RunState> = {}): RunState => ({
  ...initialState, runId: 'greed-run', runRevision: 0, gameModeId: 'vanilla', achievementsClaimed: [], lastEvent: null, ...over,
});
const tenFate = { type: 'SETTLE_ACHIEVEMENTS', payload: [{ id: 'bosses-10', title: 'Boss Slayer', description: 'Unlock 10 bosses', fate: 10, freeRituals: 0, chaosKeys: 0 }] } as const;

// Greed's refund comes after the pity decision ("half the Fate comes back, unless
// the fail brings a Pity Key"), so an honest miss can leave Fate above the line.
describe("The run audit and Greed's refund (audit engine-rolls 1)", () => {
  it('does not flag Fate a Greed refund carried over the pity line', () => {
    const rules = resolveModeRules('vanilla', undefined);
    let s = start();
    for (let i = 0; i < 49; i++) s = miss(s);
    s = gameReducer(s, { type: 'RITUAL_GREED' } as never);
    s = gameReducer(s, tenFate as never);
    s = miss(s);
    expect(s.fatePoints).toBeGreaterThan(rules.pityThreshold);
    expect(s.history.at(-1)?.message).toMatch(/Greed refunded \d+ Fate/);
    expect(replayInvariants(s.history, 3, rules).violations).toEqual([]);
    expect(auditHistory(s.history, rules, s).verdict).toBe('intact');
    // The next miss pays the Pity Key and the audit still follows it.
    s = miss(s);
    expect(s.history.at(-1)?.type).toBe('PITY');
    expect(replayInvariants(s.history, 3, rules).violations).toEqual([]);
  });

  it('still flags Fate above the line that no refund explains', () => {
    const rules = resolveModeRules('vanilla', undefined);
    const forged: LogEntry = { id: 'f', timestamp: 1, type: 'ROLL_FAIL', message: 'No. (Greed refunded 2 Fate)', result: 'FAIL', rollValue: 100, threshold: 25, meta: { fatePointsEarned: 9 } } as LogEntry;
    const kinds = replayInvariants([forged], 3, rules, { fatePoints: 45 }).violations.map(v => v.kind);
    expect(kinds).toContain('FATE_OVERFLOW');
  });
});
