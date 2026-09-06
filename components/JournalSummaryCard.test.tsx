import { describe, expect, it } from 'vitest';
import { QUEST_DATA, type QuestData } from '../data/questData';
import type { UnlockState } from '../types';
import { analyzeJournalQuestRecommendations } from './JournalSummaryCard';

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
      operationalRequirements: [],
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
