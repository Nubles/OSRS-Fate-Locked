import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import type { UnlockState } from '../types';
import { getUnlockRevealTransition } from './useUnlockReveal';

const unlocks = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
  ...over,
});

const completedTierTasksExcept = (tierId: string, taskId: string): string[] => (
  ALL_DIARY_TASKS
    .filter(task => task.tierId === tierId && task.id !== taskId)
    .map(task => task.id)
);

describe('getUnlockRevealTransition', () => {
  it('does not announce Prying Times while its manual Sailing check is unresolved', () => {
    const previous = unlocks({
      quests: ['Pandemonium', "The Knight's Sword"],
      skills: { Smithing: 3, Sailing: 2 },
      levels: { Smithing: 30, Sailing: 12 },
    });
    const current = { ...previous, regions: ['The Open Seas'] };

    expect(getUnlockRevealTransition(previous, current)?.newQuestsAvailable)
      .not.toContainEqual(expect.objectContaining({ id: 'Prying Times' }));
  });

  it('does not announce Varrock Hard while its Kudos check is unresolved', () => {
    const completedTasks = completedTierTasksExcept('Varrock Hard', 'var_hard_2');
    const previous = unlocks({ completedTasks });
    const current = { ...previous, regions: ['Varrock'] };

    expect(getUnlockRevealTransition(previous, current)?.newDiaryTiersAvailable)
      .not.toContain('Varrock Hard');
  });

  it('still announces automatically eligible quest and diary transitions', () => {
    const questPrevious = unlocks();
    const questCurrent = { ...questPrevious, regions: ['Asgarnia'] };
    expect(getUnlockRevealTransition(questPrevious, questCurrent)?.newQuestsAvailable)
      .toContainEqual({ id: "Witch's Potion", name: "Witch's Potion" });

    const completedTasks = completedTierTasksExcept('Ardougne Easy', 'ard_easy_3');
    const diaryPrevious = unlocks({ completedTasks });
    const diaryCurrent = { ...diaryPrevious, regions: ['East Ardougne'] };
    expect(getUnlockRevealTransition(diaryPrevious, diaryCurrent)?.newDiaryTiersAvailable)
      .toContain('Ardougne Easy');
  });

  it('retains the quest, region, or boss trigger boundary', () => {
    const previous = unlocks();
    const current = { ...previous, completedTasks: ['var_easy_1'] };

    expect(getUnlockRevealTransition(previous, current)).toBeNull();
  });
});
