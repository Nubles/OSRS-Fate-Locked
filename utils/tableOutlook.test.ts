import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { TableType, type UnlockState } from '../types';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { randomUnlockPool } from './gameEngine';
import { evaluateDiaryTaskEligibility, evaluateQuestEligibility } from './journalStatus';
import { areaOpens, OUTLOOK_TABLES, tableOutlook } from './tableOutlook';
import { outlookLine, outlookOdds, outlookShort } from './tableOutlookText';

/** Every drawable area tried against every quest and task: what areaOpens' shortcut must match. */
const bruteForceOpens = (unlocks: UnlockState, mode: string): string[] => {
  const pool = randomUnlockPool(unlocks, mode, 'key', TableType.REGIONS).map(c => c.item);
  const quests = Object.values(QUEST_DATA).filter(q => !unlocks.quests.includes(q.id)
    && evaluateQuestEligibility(q, unlocks, mode).status !== 'AVAILABLE');
  const done = new Set(unlocks.completedTasks ?? []);
  const tasks = ALL_DIARY_TASKS.filter(t => !done.has(t.id) && !evaluateDiaryTaskEligibility(t, unlocks, mode).machineEligible);
  return pool.filter(area => {
    const after = { ...unlocks, regions: [...unlocks.regions, area] };
    return quests.some(q => evaluateQuestEligibility(q, after, mode).status === 'AVAILABLE')
      || tasks.some(t => evaluateDiaryTaskEligibility(t, after, mode).machineEligible);
  }).sort();
};

describe('table outlook', () => {
  const fresh = createFreshState();

  it('finds the same areas as trying every one', () => {
    const fast = areaOpens(fresh.unlocks, 'vanilla').opens.map(o => o.area).sort();
    expect(fast.length).toBeGreaterThan(0);
    expect(fast).toEqual(bruteForceOpens(fresh.unlocks, 'vanilla'));
  }, 30_000);

  it('gives each outlook table an outlook in Vanilla, and Chunked no Areas one', () => {
    for (const table of OUTLOOK_TABLES) {
      const o = tableOutlook(table, fresh.unlocks, 'vanilla');
      expect(o, table).not.toBeNull();
      expect(o!.useful).toBeLessThanOrEqual(o!.left);
      expect(o!.examples.length).toBeLessThanOrEqual(Math.min(3, o!.useful));
    }
    expect(tableOutlook(TableType.REGIONS, fresh.unlocks, 'chunked')).toBeNull();
    expect(tableOutlook(TableType.SKILLS, fresh.unlocks, 'vanilla')).toBeNull();
  });

  it('words the outlook', () => {
    const o = { table: TableType.BOSSES, kind: 'ready' as const, left: 66, useful: 6, examples: ['Obor', 'Bryophyta', 'Giant Mole'] };
    expect(outlookOdds(o)).toBe('1 in 11');
    expect(outlookLine(o)).toBe('6 of 66 ready if drawn (1 in 11): Obor, Bryophyta, Giant Mole and more.');
    expect(outlookShort(o)).toBe('6/66 ready');
    expect(outlookLine({ ...o, useful: 0, examples: [] })).toContain('Nothing on this table is ready');
    expect(outlookOdds({ left: 3, useful: 3 })).toBe('every draw');
  });
});
