import { describe, expect, it } from 'vitest';
import { levelsToLog, summarizeLevelBatch, type LevelBatchSummary } from './setLevel';
import { formatLevelBatchSummary, planSetLevel } from './setLevelText';
import type { LogEntry } from '../types';

describe('planSetLevel', () => {
  it('logs every level from the next one up to the level typed', () => {
    expect(planSetLevel(18, 3, '30')).toEqual({ ok: true, from: 18, to: 30, count: 12 });
    expect(planSetLevel(1, 1, 99)).toEqual({ ok: true, from: 1, to: 99, count: 98 });
    expect(planSetLevel(42, 5, ' 43 ')).toEqual({ ok: true, from: 42, to: 43, count: 1 });
  });

  it('keeps the click rules: a tier unlocked, never down, never past 99', () => {
    expect(planSetLevel(5, 0, 10)).toEqual({ ok: false, reason: 'Unlock a tier of this skill first.' });
    expect(planSetLevel(99, 10, 99)).toEqual({ ok: false, reason: 'Already level 99.' });
    expect(planSetLevel(30, 3, 30)).toEqual({ ok: false, reason: "Already level 30. Levels can't go down." });
    expect(planSetLevel(30, 3, 12)).toEqual({ ok: false, reason: "Already level 30. Levels can't go down." });
    expect(planSetLevel(30, 3, 100)).toEqual({ ok: false, reason: 'The highest level is 99.' });
    expect(planSetLevel(30, 3, '')).toEqual({ ok: false, reason: 'Type a level from 31 to 99.' });
    expect(planSetLevel(30, 3, '40.5')).toEqual({ ok: false, reason: 'Type a whole level from 31 to 99.' });
    expect(planSetLevel(30, 3, 'abc')).toEqual({ ok: false, reason: 'Type a whole level from 31 to 99.' });
  });
});

describe('levelsToLog', () => {
  it('is the rule the typed-level messages follow, for every level and tier', () => {
    for (const tier of [0, 1, 5, 10]) {
      for (const current of [1, 10, 50, 98, 99]) {
        for (let target = 0; target <= 101; target++) {
          const plan = planSetLevel(current, tier, String(target));
          expect(plan.ok ? plan.count : 0).toBe(levelsToLog(current, tier, target));
        }
      }
    }
    expect(levelsToLog(18, 3, 30.5)).toBe(0);
  });
});

describe('the Set level summary', () => {
  const run = (level: number, counters: Partial<{ keys: number; specialKeys: number; chaosKeys: number; fatePoints: number }>, history: Partial<LogEntry>[] = []) => ({
    keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0, ...counters,
    history: history as LogEntry[],
    unlocks: { levels: { Attack: level } } as never,
  });

  it('counts what the levels brought, and the Chunked levels that rolled nothing', () => {
    const before = run(18, { keys: 1, fatePoints: 4 }, [{ message: 'old', meta: { fatePointsEarned: 9 } }]);
    // A Key found reset the Fate bar, so Fate is what the misses earned, not the bar's change.
    const after = run(30, { keys: 3, chaosKeys: 1, fatePoints: 2 }, [
      { message: 'old', meta: { fatePointsEarned: 9 } },
      { message: 'Attack Level 21: no roll', meta: { pastTierCap: 20 } },
      { message: 'No Key.', meta: { level: 22, fatePointsEarned: 38 } },
      { message: 'Key Found!', meta: { level: 23, fatePointsEarned: 0 } },
      { message: 'No Key.', meta: { level: 24, fatePointsEarned: 2 } },
    ]);
    expect(summarizeLevelBatch(before, after, 'Attack')).toEqual({
      skill: 'Attack', from: 18, to: 30, levels: 12, keys: 2, omniKeys: 0, chaosKeys: 1, fate: 40, noRoll: 1,
    });
  });

  it('reads as one plain line', () => {
    const base: LevelBatchSummary = { skill: 'Attack', from: 18, to: 30, levels: 12, keys: 0, omniKeys: 0, chaosKeys: 0, fate: 0, noRoll: 0 };
    expect(formatLevelBatchSummary({ ...base, keys: 2, fate: 40 })).toBe('12 levels logged: 2 Keys found, +40 Fate');
    expect(formatLevelBatchSummary({ ...base, levels: 1, keys: 1, omniKeys: 1, chaosKeys: 2, fate: 0 }))
      .toBe('1 level logged: 1 Key found, 1 Omni-Key found, 2 Chaos Keys');
    expect(formatLevelBatchSummary({ ...base, levels: 7, noRoll: 7 })).toBe('7 levels logged: 7 past the tier cap with no roll');
    expect(formatLevelBatchSummary({ ...base, levels: 3 })).toBe('3 levels logged: no Keys this time');
  });
});
