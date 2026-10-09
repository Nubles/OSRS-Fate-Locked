import { describe, expect, it } from 'vitest';
import { QUEST_DATA, type QuestData } from '../data/questData';
import type { UnlockState } from '../types';
import { analyzeJournalQuestRecommendations, questsReadyLabel, recommendNextAction } from './JournalSummaryCard';
import type { AreaRoutes } from '../utils/areaRoutes';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';

const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
  // Food Shops sell the redberry pie the quest needs.
  mobility: [], arcana: [], housing: [], merchants: ['Food Shops'], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

describe('analyzeJournalQuestRecommendations', () => {
  it('excludes Prying Times from both the available count and quest recommendation', () => {
    const analysis = analyzeJournalQuestRecommendations(
      [QUEST_DATA['Prying Times']],
      [],
      pryingTimesUnlocks(),
    );

    expect(analysis.available).toBe(0);
    expect(analysis.candidates).toEqual([]);
    expect(analysis.best).toBeNull();
  });

  it('keeps an automatically eligible quest in the count and recommendation pool', () => {
    const automatic: QuestData = {
      ...QUEST_DATA['Prying Times'],
      id: 'Automatic test quest',
      name: 'Automatic test quest',
      manualRequirements: [],
    };
    const analysis = analyzeJournalQuestRecommendations(
      [automatic],
      [],
      pryingTimesUnlocks(),
    );

    expect(analysis.available).toBe(1);
    expect(analysis.candidates.map(quest => quest.id)).toEqual([automatic.id]);
    expect(analysis.best).toEqual(expect.objectContaining({ name: automatic.name }));
  });
});

/**
 * A player reported on 7 October 2026 that the Journal summary said 9 quests
 * were ready to complete while the Quest Log listed 6: the summary didn't
 * read the routes the Quest Log reads, so it counted quests in owned areas
 * no route reaches.
 */
describe('the Journal summary counts what the Quest Log lists', () => {
  const barcrawl = QUEST_DATA["Alfred Grimhand's Barcrawl"];
  const bars: UnlockState = {
    ...pryingTimesUnlocks(),
    skills: {}, levels: {}, quests: [], merchants: ['Bars & Inns'],
    regions: [...new Set(barcrawl.locations!.flatMap(location => location.standardAreas))],
  };
  const strandedAt = (...areas: string[]): AreaRoutes => ({ strandedAreas: new Set(areas), strandedChunks: new Set() });

  it('leaves out a quest no route reaches', () => {
    expect(analyzeJournalQuestRecommendations([barcrawl], [], bars, 'vanilla').available).toBe(1);
    const stranded = analyzeJournalQuestRecommendations([barcrawl], [], bars, 'vanilla', strandedAt('Brimhaven'));
    expect(stranded.available).toBe(0);
    expect(stranded.best).toBeNull();
  });

  it('names miniquests apart, as the Quest Log lists them', () => {
    expect(barcrawl.kind).toBe('miniquest');
    expect(analyzeJournalQuestRecommendations([barcrawl], [], bars, 'vanilla').availableMiniquests).toBe(1);
    expect(questsReadyLabel(9, 0)).toBe('9');
    expect(questsReadyLabel(9, 3)).toBe('6 quests and 3 miniquests');
    expect(questsReadyLabel(2, 1)).toBe('1 quest and 1 miniquest');
    expect(questsReadyLabel(2, 2)).toBe('2 miniquests');
  });
});

describe('journal completion recommendations in Vanilla', () => {
  const completedAccount = (): UnlockState => ({
    ...pryingTimesUnlocks(),
    quests: Object.keys(QUEST_DATA),
    diaries: Object.keys(DIARY_DATA),
    completedTasks: ALL_DIARY_TASKS.map(task => task.id),
  });

  it('does not celebrate completion while a quest still needs manual preparation', () => {
    const unlocks = completedAccount();
    unlocks.quests = unlocks.quests.filter(id => id !== 'Sheep Shearer');
    const recommendation = recommendNextAction(unlocks, 0, 0, 'vanilla');
    expect(recommendation.tab).toBe('QUESTS');
    expect(recommendation.headline).not.toBe("Everything's done!");
    expect(recommendation.detail).toMatch(/requirement|confirmation|unlock/i);
  });

  it('points to unfinished diaries when no tasks are currently doable', () => {
    const unlocks = { ...completedAccount(), diaries: [] };
    const recommendation = recommendNextAction(unlocks, 0, 0, 'vanilla');
    expect(recommendation.tab).toBe('DIARIES');
    expect(recommendation.headline).not.toBe("Everything's done!");
  });

  it('celebrates only when all journal content is completed', () => {
    expect(recommendNextAction(completedAccount(), 0, 0, 'vanilla'))
      .toMatchObject({ tab: null, headline: "Everything's done!" });
  });
});
