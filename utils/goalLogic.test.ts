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
