import { describe, expect, it, vi } from 'vitest';

vi.mock('./unlockImpact', async () => {
  const actual = await vi.importActual<typeof import('./unlockImpact')>('./unlockImpact');
  return { ...actual, computeUnlockImpact: vi.fn(actual.computeUnlockImpact) };
});
import { UnlockState } from '../types';
import { MISTHALIN_AREAS, REGIONS_LIST, SKILLS_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { rankAvailableQuests } from './questAdvisor';
import * as unlockImpact from './unlockImpact';

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

  it('simulates every candidate against one shared impact context, with unchanged results', () => {
    const unlocks: UnlockState = {
      ...unlocksReadyForPryingTimes(),
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
      regions: [...MISTHALIN_AREAS, ...REGIONS_LIST],
      quests: [],
    };
    const impact = vi.mocked(unlockImpact.computeUnlockImpact);
    impact.mockClear();

    const ranked = rankAvailableQuests(unlocks, 'vanilla');
    expect(ranked.length).toBeGreaterThan(10);
    const contexts = impact.mock.calls.map(call => call[3]?.context);
    expect(contexts[0]).toBeDefined();
    expect(contexts.every(context => context === contexts[0])).toBe(true);

    // Each candidate still scores exactly as a standalone simulation does.
    for (const row of ranked) {
      const alone = unlockImpact.computeUnlockImpact(unlocks, { ...unlocks, quests: [row.id] }, 'vanilla');
      expect(row).toEqual({
        id: row.id, name: QUEST_DATA[row.id].name, points: QUEST_DATA[row.id].points,
        newQuestNames: alone.directQuestNames, newDiaryIds: alone.directDiaryIds,
        cascadeQuestNames: alone.cascadeQuestNames, cascadeDiaryIds: alone.cascadeDiaryIds,
        score: alone.directScore, cascadeScore: alone.cascadeScore,
      });
    }
  });
});
