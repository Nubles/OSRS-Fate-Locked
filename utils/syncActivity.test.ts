import { describe, expect, it } from 'vitest';
import { BOSSES_LIST, DROP_RATES } from '../constants';
import { BRUTUS_BOSS_NAME } from '../config/vanillaKeyEconomy';
import { DropSource, type LogEntry } from '../types';
import {
  BOSS_METRICS, baselineScores, clueMetric, planActivitySync, readScores, recordScores, SCORE_METRICS, scoreMinimum,
  type ScoreReading, type SyncScores,
} from './syncActivity';

const NOT_ON_HISCORES = ['Tormented Demons', 'Gemstone Crab', "TzHaar-Ket-Rak's Challenges"];

describe('Wise Old Man boss mapping', () => {
  it('maps every boss on the hiscores, and only our own bosses', () => {
    for (const name of Object.keys(BOSS_METRICS)) expect([...BOSSES_LIST, BRUTUS_BOSS_NAME]).toContain(name);
    const unmapped = BOSSES_LIST.filter(name => !BOSS_METRICS[name]);
    expect(unmapped.sort()).toEqual([...NOT_ON_HISCORES].sort());
    // No metric counts toward two of our bosses.
    const metrics = Object.values(BOSS_METRICS).flat();
    expect(new Set(metrics).size).toBe(metrics.length);
  });

  it('reads kills and caskets, unranked and absent', () => {
    const reading = readScores({
      bosses: { vorkath: { kills: 120, rank: 5 }, zulrah: { kills: -1, rank: -1 } },
      activities: { clue_scrolls_easy: { score: 7 } },
    });
    expect(reading.vorkath).toBe(120);
    expect(reading.zulrah).toBe('unranked');
    expect(reading.nex).toBeNull();
    expect(reading[clueMetric('Easy')]).toBe(7);
    const base = baselineScores(reading);
    expect(base.zulrah).toBe(scoreMinimum('zulrah') - 1);
    expect(base.mimic).toBeNull();
    expect(baselineScores({ mimic: 'unranked', clue_scrolls_hard: 'unranked' })).toMatchObject({ mimic: 0, clue_scrolls_hard: 0 });
    expect(Object.keys(base).sort()).toEqual([...SCORE_METRICS].sort());
  });

  it('takes a baseline once per name and only fills what it could not read', () => {
    const first = recordScores(undefined, 'Whim', 'whim', { vorkath: 10, nex: null }, 100)!;
    expect(first).toEqual({ account: 'Whim', scores: { vorkath: 10, nex: null }, takenAt: 100 });
    expect(recordScores(first, 'Whim', 'Whim', { vorkath: 50, nex: 3 }, 200)).toEqual({ ...first, scores: { vorkath: 10, nex: 3 } });
    expect(recordScores(first, 'Whim', 'Whim', { vorkath: 50 }, 200)).toBe(first);
    expect(recordScores(first, 'Whim', 'Other', { vorkath: 1 }, 200)).toBe(first);
    expect(recordScores(first, 'New Name', 'New Name', { vorkath: 60 }, 300)).toEqual({ account: 'New Name', scores: { vorkath: 60 }, takenAt: 300 });
    expect(recordScores(undefined, undefined, 'Whim', { vorkath: 1 }, 1)).toBeUndefined();
  });
});

describe('planActivitySync', () => {
  const takenAt = 1_000;
  const scores: SyncScores = {
    account: 'Whim', takenAt,
    scores: { ...Object.fromEntries(SCORE_METRICS.map(m => [m, 0])), vorkath: 10, dagannoth_prime: 5, dagannoth_rex: 4, nex: null },
  };
  const reading: Record<string, ScoreReading> = {
    ...Object.fromEntries(SCORE_METRICS.map(m => [m, 0])),
    vorkath: 15, dagannoth_prime: 7, dagannoth_rex: 'unranked', dagannoth_supreme: 1, nex: 40, zulrah: 3,
    clue_scrolls_easy: 4,
  };
  const roll = (timestamp: number, over: Partial<LogEntry>): LogEntry =>
    ({ id: `r${timestamp}`, timestamp, type: 'ROLL_FAIL', message: 'No Key.', ...over });

  it('rolls new kills of unlocked bosses from their stash, less rolls since the baseline', () => {
    const history = [
      roll(500, { source: DropSource.BOSS_MID, meta: { bossName: 'Vorkath' } }), // before the baseline: ignored
      roll(1_500, { source: DropSource.BOSS_MID, meta: { bossName: 'Vorkath' } }),
      roll(1_600, { source: DropSource.BOSS_MID, meta: { bossName: 'Vorkath' } }),
      roll(1_700, { source: DropSource.CLUE_EASY, meta: { clueTier: 'Easy' } }),
    ];
    const plan = planActivitySync({ scores, linkedAccount: 'whim', reading, history, gameModeId: 'vanilla', reserves: true, bosses: ['Vorkath', 'Zulrah'] });
    const by = Object.fromEntries(plan.map(p => [p.label, p]));
    expect(by.Vorkath).toMatchObject({ gained: 5, rolled: 2, count: 3, context: { kind: 'boss', bossName: 'Vorkath' } });
    expect(by.Zulrah).toMatchObject({ gained: 3, count: 3 });
    // Locked: shown, never rolled. Summed metrics; unranked and unknown add nothing.
    expect(by['Dagannoth Kings']).toMatchObject({ gained: 3, count: 0, hold: 'locked' });
    expect(by.Nex).toBeUndefined();
    expect(by['Easy clues']).toMatchObject({ gained: 4, rolled: 1, count: 3, source: DropSource.CLUE_EASY, context: { kind: 'clue', clueTier: 'Easy' } });
  });

  it('rolls kills per tier outside Vanilla and Chunked, with no clue context', () => {
    const history = [roll(2_000, { source: DropSource.BOSS_MID })];
    const plan = planActivitySync({ scores, linkedAccount: 'Whim', reading, history, gameModeId: 'xtreme', reserves: false, bosses: [] });
    const mid = plan.find(p => p.source === DropSource.BOSS_MID)!;
    // Vorkath 5 + Zulrah 3, less the one mid-tier roll; Dagannoth Kings are low tier.
    expect(mid).toMatchObject({ gained: 8, rolled: 1, count: 7, rate: DROP_RATES[DropSource.BOSS_MID] });
    expect(plan.find(p => p.source === DropSource.BOSS_LOW)).toMatchObject({ label: 'Low-tier boss kills', gained: 3, count: 3 });
    expect(mid.context).toBeUndefined();
    expect(plan.find(p => p.kind === 'clue')!.context).toBeUndefined();
  });

  it('rolls nothing for another name, or before a baseline', () => {
    expect(planActivitySync({ scores, linkedAccount: 'Someone', reading, history: [], gameModeId: 'vanilla', reserves: true, bosses: ['Vorkath'] })).toEqual([]);
    expect(planActivitySync({ scores: undefined, linkedAccount: 'Whim', reading, history: [], gameModeId: 'vanilla', reserves: true, bosses: ['Vorkath'] })).toEqual([]);
  });
});
