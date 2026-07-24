import { describe, expect, it } from 'vitest';
import * as guide from './StrategyGuide';
import { TableType } from '../types';

describe('StrategyGuide requirement analysis', () => {
  it('uses method-capped levels for diary blockers and prophecy scoring', () => {
    const unlocks = {
      equipment: {},
      skills: { Smithing: 1 },
      levels: { Smithing: 99 },
      regions: [],
      mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
      bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
      quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
    };
    const requirement = {
      id: 'Falador Easy',
      category: TableType.DIARIES,
      skills: { Smithing: 13 },
      regions: [],
      quests: [],
    };

    const analysis = (guide as any).analyzeRequirement(requirement, unlocks);
    expect(analysis.missingSkills).toContainEqual(
      expect.objectContaining({ skill: 'Smithing', currentLevel: 10, reqLevel: 13 }),
    );
    expect((guide as any).calculateProphecyScore(requirement, analysis))
      .toBeGreaterThanOrEqual(3);
  });
});