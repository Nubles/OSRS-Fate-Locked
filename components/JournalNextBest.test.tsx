import { describe, expect, it } from 'vitest';
import { SKILLS_LIST } from '../constants';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import { selectJournalNextBestActions } from './JournalNextBest';

describe('Journal next-best diary readiness', () => {
  it('uses canonical remaining task blockers instead of stale tier aggregates', () => {
    const unlocks = {
      equipment: {},
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => task.regions ?? []))],
      mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
      bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
      quests: Object.keys(QUEST_DATA).filter(quest => quest !== 'Biohazard'),
      diaries: Object.keys(DIARY_DATA).filter(diary => diary !== 'Ardougne Easy'),
      cas: ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'],
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Ardougne Easy' || task.id !== 'ard_easy_6')
        .map(task => task.id),
      collectionLog: {},
    };

    expect(selectJournalNextBestActions(unlocks)).toContainEqual(
      expect.objectContaining({
        kind: 'diary',
        id: 'Ardougne Easy',
        unmet: 1,
        firstBlocker: 'Biohazard',
      }),
    );
  });
});
