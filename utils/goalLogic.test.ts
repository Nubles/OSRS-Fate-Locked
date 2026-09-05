import { describe, expect, it } from 'vitest';
import { REGION_GROUPS } from '../constants';
import { TableType, type UnlockState } from '../types';
import { calculateGoalProgress } from './goalLogic';

const unlocks = (regions: string[]): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions,
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

describe('calculateGoalProgress region groups', () => {
  it('does not count a continent until all of its child areas are unlocked', () => {
    const requirement = {
      id: 'Wilderness access', category: TableType.QUESTS,
      regions: ['Wilderness'], skills: {}, quests: [],
    };

    expect(calculateGoalProgress(
      requirement,
      unlocks(REGION_GROUPS.Wilderness.slice(0, -1)),
    ).missing).toContain('Region: Wilderness');
    expect(calculateGoalProgress(
      requirement,
      unlocks([...REGION_GROUPS.Wilderness]),
    ).missing).not.toContain('Region: Wilderness');
  });
});


describe('canonical pinned goal readiness', () => {
  it('preserves uncertainty when a legacy goal has no complete access model', () => {
    const progress = calculateGoalProgress({ id: 'Ectoplasmator', category: TableType.MINIGAMES,
      regions: [], skills: {} }, { ...unlocks([]), minigames: ['Ectoplasmator'] });
    expect(progress.percentage).toBeLessThan(100);
    expect(progress.missing.join(' ')).toContain('review');
  });
  it('uses canonical quest requirements and attained levels instead of legacy summaries', () => {
    const progress = calculateGoalProgress({ id: 'Cook\'s Assistant', category: TableType.QUESTS,
      regions: ['Unknown legacy area'], skills: { Cooking: 99 } }, unlocks(['Lumbridge']));
    expect(progress.percentage).toBeLessThan(100);
    expect(progress.missing.join(' ')).not.toContain('legacy');
    expect(progress.missing.join(' ')).toContain('Egg');
  });
});


it('ignores obsolete strategy skill and quest gates for a canonical activity', () => {
  const state = { ...unlocks([]), arcana: ['Arceuus Spellbook'] };
  const progress = calculateGoalProgress({ id: 'Arceuus Spellbook', category: TableType.ARCANA,
    regions: ['Unknown obsolete area'], skills: { Magic: 99 }, quests: ['Unknown obsolete quest'] }, state);
  expect(progress.missing.join(' ')).not.toContain('obsolete');
  expect(progress.missing.join(' ')).not.toContain('Magic');
});
