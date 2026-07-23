/**
 * Pure (side-effect-free) status computation for Journal items.
 * Mirrors the logic inside QuestLog / DiaryLog but accepts an explicit
 * `unlocks` snapshot so callers can diff two snapshots (e.g. before/after
 * a quest completion) without needing component context.
 */

import { QuestData, QuestRequirementOption, QUEST_DATA } from '../data/questData';
import { DiaryTier } from '../data/diaryData';
import { UnlockState } from '../types';
import { isAreaReachable } from './reachability';

export type QuestStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';
export type DiaryStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_QUEST';

export interface QuestStatusOptions {
  requiredRegionsReachable?: boolean;
}

export const meetsSkillRequirement = (
  unlocks: Pick<UnlockState, 'skills' | 'levels'>,
  skill: string,
  required: number,
): boolean => {
  const tier = unlocks.skills[skill] ?? 0;
  const level = unlocks.levels[skill] ?? 1;
  const cap = Math.min(99, tier * 10);
  return tier > 0 && level >= required && cap >= required;
};

export const countMetSkillRequirements = (
  requirements: Record<string, number> | undefined,
  unlocks: Pick<UnlockState, 'skills' | 'levels'>,
): number => Object.entries(requirements ?? {}).filter(
  ([skill, required]) => meetsSkillRequirement(unlocks, skill, required),
).length;

export const questRequirementOptionMet = (
  option: QuestRequirementOption,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean =>
  (option.regions ?? []).every(region =>
    isAreaReachable(region, unlocks, gameModeId)) &&
  (option.guilds ?? []).every(guild =>
    unlocks.guilds.includes(guild));

export const questAlternativesMet = (
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean =>
  !quest.oneOf?.length ||
  quest.oneOf.some(option =>
    questRequirementOptionMet(option, unlocks, gameModeId));

export const questRequirementOptionLabel = (
  option: QuestRequirementOption,
): string => [...(option.regions ?? []), ...(option.guilds ?? [])].join(' + ');

export function getQuestStatus(
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
  options: QuestStatusOptions = {},
): QuestStatus {
  if (unlocks.quests.includes(quest.id)) return 'COMPLETED';

  const regionsMet = options.requiredRegionsReachable ??
    quest.regions.every(region =>
      isAreaReachable(region, unlocks, gameModeId));
  if (!regionsMet || !questAlternativesMet(quest, unlocks, gameModeId)) {
    return 'LOCKED_REGION';
  }

  const qp = unlocks.quests.reduce(
    (total, id) => total + (QUEST_DATA[id]?.points ?? 0), 0);
  const missingSkill = Object.entries(quest.skills).some(
    ([skill, level]) => skill === 'Quest Points'
      ? qp < level
      : !meetsSkillRequirement(unlocks, skill, level));
  if (missingSkill) return 'LOCKED_SKILL';

  if (quest.prereqs.some(id => !unlocks.quests.includes(id))) {
    return 'LOCKED_QUEST';
  }
  return 'AVAILABLE';
}

export function getDiaryStatus(diary: DiaryTier, unlocks: any, gameModeId?: string): DiaryStatus {
  if (unlocks.diaries.includes(diary.id)) return 'COMPLETED';

  const missingRegion = diary.requiredRegions.some(r => !isAreaReachable(r, unlocks, gameModeId));
  if (missingRegion) return 'LOCKED_REGION';

  const missingQuest = diary.quests.some((qid: string) => !unlocks.quests.includes(qid));
  if (missingQuest) return 'LOCKED_QUEST';

  return 'AVAILABLE';
}

/**
 * Counts how many of `tasks` the player can complete right now:
 *   • not yet done
 *   • all skill reqs met (skill unlocked AND level reached)
 *   • all quest reqs met
 *   • all region reqs unlocked (Misthalin is always free)
 * "Closest first" ranking and the diary insights both use this, so a tier
 * with few-but-blocked tasks never outranks one the player can finish today.
 */
export interface DoableTask {
  id: string;
  skills?: Record<string, number>;
  quests?: string[];
  regions?: string[];
}

export interface DoableDiaryTask extends DoableTask {
  tierId: string;
}

export function countDoableTasks(tasks: DoableTask[], unlocks: UnlockState, gameModeId?: string): number {
  return tasks.filter(task => {
    if (unlocks.completedTasks.includes(task.id)) return false;
    if (task.skills && !Object.entries(task.skills).every(
      ([skill, level]) => meetsSkillRequirement(unlocks, skill, level),
    )) return false;
    if (task.quests && !task.quests.every(q => unlocks.quests.includes(q))) return false;
    if (task.regions && !task.regions.every(
      r => isAreaReachable(r, unlocks, gameModeId),
    )) return false;
    return true;
  }).length;
}

export function countDoableDiaryTasks(
  tasks: DoableDiaryTask[],
  unlocks: UnlockState,
  gameModeId?: string,
): number {
  const incompleteTiers = tasks.filter(task => !unlocks.diaries.includes(task.tierId));
  return countDoableTasks(incompleteTiers, unlocks, gameModeId);
}
