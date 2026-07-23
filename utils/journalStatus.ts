/**
 * Pure (side-effect-free) status computation for Journal items.
 * Mirrors the logic inside QuestLog / DiaryLog but accepts an explicit
 * `unlocks` snapshot so callers can diff two snapshots (e.g. before/after
 * a quest completion) without needing component context.
 */

import {
  QuestData, QuestLocationRequirement, QuestRequirementOption, QUEST_DATA,
} from '../data/questData';
import { DiaryTier } from '../data/diaryData';
import { UnlockState } from '../types';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';
import { isAreaReachable } from './reachability';
import { combatLevel } from './slayerReach';

export type QuestStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';
export type DiaryStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_QUEST';

export type EligibilityBlocker =
  | { kind: 'region'; label: string }
  | { kind: 'skill'; label: string }
  | { kind: 'combat'; label: string }
  | { kind: 'quest'; label: string };

export interface QuestEligibility {
  eligible: boolean;
  status: QuestStatus;
  blockers: EligibilityBlocker[];
  evidence: string[];
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

export const locationRequirementMet = (
  location: QuestLocationRequirement,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean => gameModeId === 'chunked'
  ? location.chunkOptions.some(coord =>
      isChunkUnlocked(chunkKey(coord), unlocks.chunks ?? []))
  : location.standardAreas.every(area =>
      isAreaReachable(area, unlocks, gameModeId));

export const questRequirementOptionMet = (
  option: QuestRequirementOption,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean =>
  (option.regions ?? []).every(region =>
    isAreaReachable(region, unlocks, gameModeId)) &&
  (option.guilds ?? []).every(guild =>
    unlocks.guilds.includes(guild)) &&
  (option.locations ?? []).every(location =>
    locationRequirementMet(location, unlocks, gameModeId));

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
): string => [
  ...(option.regions ?? []),
  ...(option.guilds ?? []),
  ...(option.locations ?? []).map(location => location.label),
].join(' + ');

const currentQuestPoints = (unlocks: UnlockState): number =>
  unlocks.quests.reduce(
    (total, id) => total + (QUEST_DATA[id]?.points ?? 0), 0);

export function evaluateQuestEligibility(
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): QuestEligibility {
  if (unlocks.quests.includes(quest.id)) {
    return { eligible: true, status: 'COMPLETED', blockers: [], evidence: ['Completed'] };
  }
  const blockers: EligibilityBlocker[] = [];
  const evidence: string[] = [];
  for (const region of quest.regions) {
    if (isAreaReachable(region, unlocks, gameModeId)) evidence.push(region);
    else blockers.push({ kind: 'region', label: region });
  }
  for (const location of quest.locations ?? []) {
    if (locationRequirementMet(location, unlocks, gameModeId)) evidence.push(location.label);
    else blockers.push({ kind: 'region', label: location.label });
  }
  if (!questAlternativesMet(quest, unlocks, gameModeId)) {
    blockers.push({ kind: 'region', label: quest.oneOf!.map(questRequirementOptionLabel).join(' or ') });
  }
  const qp = currentQuestPoints(unlocks);
  for (const [skill, required] of Object.entries(quest.skills)) {
    const met = skill === 'Quest Points'
      ? qp >= required
      : meetsSkillRequirement(unlocks, skill, required);
    if (met) evidence.push(skill + ' ' + required);
    else blockers.push({ kind: 'skill', label: skill + ' ' + required });
  }
  if (quest.combatLevel !== undefined) {
    if (combatLevel(unlocks.levels) >= quest.combatLevel) evidence.push('Combat level ' + quest.combatLevel);
    else blockers.push({ kind: 'combat', label: 'Combat level ' + quest.combatLevel });
  }
  for (const prereq of quest.prereqs) {
    if (unlocks.quests.includes(prereq)) evidence.push(prereq);
    else blockers.push({ kind: 'quest', label: prereq });
  }
  const status: QuestStatus = blockers.some(x => x.kind === 'region') ? 'LOCKED_REGION'
    : blockers.some(x => x.kind === 'skill' || x.kind === 'combat') ? 'LOCKED_SKILL'
    : blockers.some(x => x.kind === 'quest') ? 'LOCKED_QUEST'
    : 'AVAILABLE';
  return { eligible: status === 'AVAILABLE', status, blockers, evidence };
}

export function getQuestStatus(
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): QuestStatus {
  return evaluateQuestEligibility(quest, unlocks, gameModeId).status;
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
