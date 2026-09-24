import { describe, expect, it } from 'vitest';
import { QUEST_DATA, type QuestData } from '../data/questData';
import type { UnlockState } from '../types';
import { analyzeJournalQuestRecommendations, recommendNextAction } from './JournalSummaryCard';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';

const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
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
