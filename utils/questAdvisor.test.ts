import { describe, expect, it } from 'vitest';
import { UnlockState } from '../types';
import { rankAvailableQuests } from './questAdvisor';

const unlocksReadyForPryingTimes = (): UnlockState => ({
  equipment: {}, skills: { Smithing: 3, Sailing: 2 }, levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Open Seas'], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: ['Pandemonium', "The Knight's Sword"], diaries: [], cas: [],
  completedTasks: [], collectionLog: {},
});

describe('rankAvailableQuests', () => {
  it('excludes quests that still need manual confirmation', () => {
    expect(rankAvailableQuests(unlocksReadyForPryingTimes()).map(quest => quest.id))
      .not.toContain('Prying Times');
  });

  it('excludes completed quests even when their requirements are otherwise eligible', () => {
    const unlocks = unlocksReadyForPryingTimes();
    expect(rankAvailableQuests({
      ...unlocks,
      quests: [...unlocks.quests, 'Prying Times'],
    }).map(quest => quest.id)).not.toContain('Prying Times');
  });
});
