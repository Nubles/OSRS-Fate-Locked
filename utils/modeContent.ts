/**
 * What a run's mode can do, for the screens that list or count content.
 * Free-to-play runs see only free-to-play quests, skills and gear, and no
 * Achievement Diaries; every other mode sees everything.
 */
import { QUEST_DATA, type QuestData } from '../data/questData';
import { DIARY_DATA, type DiaryTier } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { f2pQuestMembershipFor } from '../data/f2pQuestMembership';
import { F2P_CA_TASK_IDS, F2P_EQUIPMENT_TIER_MAX, F2P_PET_IDS, F2P_SKILLS, f2pEquipmentTierCap } from '../data/f2pContent';
import { ALL_CA_TASKS, type CATask } from '../data/caTasks';
import { SKILLS_LIST } from '../data/items';
import { EQUIPMENT_TIER_MAX } from '../config/rules';
import { isF2PMode } from '../config/gameModes';

const ALL_QUESTS = Object.values(QUEST_DATA);
const F2P_QUESTS = ALL_QUESTS.filter(quest => f2pQuestMembershipFor(quest.id) !== undefined);
const ALL_DIARIES = Object.values(DIARY_DATA);

/** The quests a run can do: the free-to-play quests in Free-to-play, every quest otherwise. */
export const questsForMode = (gameModeId?: string): QuestData[] => (isF2PMode(gameModeId) ? F2P_QUESTS : ALL_QUESTS);

/** Achievement Diary tiers a run can do: none in Free-to-play. */
export const diariesForMode = (gameModeId?: string): DiaryTier[] => (isF2PMode(gameModeId) ? [] : ALL_DIARIES);

/** Achievement Diary tasks a run can do: none in Free-to-play. */
export const diaryTasksForMode = (gameModeId?: string): typeof ALL_DIARY_TASKS => (isF2PMode(gameModeId) ? [] : ALL_DIARY_TASKS);

/** The skills a run can unlock. */
export const skillsForMode = (gameModeId?: string): readonly string[] => (isF2PMode(gameModeId) ? F2P_SKILLS : SKILLS_LIST);

/**
 * The highest equipment tier a run can reach, in one slot or in its best slot:
 * in Free-to-play rune (5) at best, and less where a slot has no rune item.
 */
export const equipmentTierMaxFor = (gameModeId?: string, slot?: string): number => {
  if (!isF2PMode(gameModeId)) return EQUIPMENT_TIER_MAX;
  return slot === undefined ? F2P_EQUIPMENT_TIER_MAX : f2pEquipmentTierCap(slot);
};

const F2P_CA_TASK_SET = new Set<string>(F2P_CA_TASK_IDS);
const F2P_CA_TASKS = ALL_CA_TASKS.filter(task => F2P_CA_TASK_SET.has(task.id));

/** Whether a run can do this Combat Achievement task. */
export const caTaskInMode = (taskId: string, gameModeId?: string): boolean => !isF2PMode(gameModeId) || F2P_CA_TASK_SET.has(taskId);

/** Whether a run can claim this pet. */
export const petInMode = (petId: number, gameModeId?: string): boolean => !isF2PMode(gameModeId) || F2P_PET_IDS.includes(petId);

/** Combat Achievement tasks a run can do: only free-to-play monsters in Free-to-play. */
export const caTasksForMode = (gameModeId?: string): CATask[] => (isF2PMode(gameModeId) ? F2P_CA_TASKS : ALL_CA_TASKS);
