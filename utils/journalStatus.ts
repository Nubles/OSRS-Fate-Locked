/**
 * Pure (side-effect-free) status computation for Journal items.
 * Mirrors the logic inside QuestLog / DiaryLog but accepts an explicit
 * `unlocks` snapshot so callers can diff two snapshots (e.g. before/after
 * a quest completion) without needing component context.
 */

import {
  QuestData, QuestLocationRequirement, QuestRequirementOption, QUEST_DATA,
} from '../data/questData';
import { ALL_DIARY_TASKS, DiaryTaskRequirementOption } from '../data/diaryTasks';
import { DiaryTier } from '../data/diaryData';
import { UnlockState } from '../types';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';
import { isAreaReachable } from './reachability';
import { combatLevel } from './slayerReach';

export type QuestStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';
export type DiaryStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';

export type DiaryStatusUnlocks =
  Omit<UnlockState, 'cas' | 'completedTasks'>
  & Partial<Pick<UnlockState, 'cas' | 'completedTasks'>>;

export type EligibilityBlocker =
  | { kind: 'region'; label: string }
  | { kind: 'skill'; label: string }
  | { kind: 'combat'; label: string }
  | { kind: 'quest'; label: string }
  | { kind: 'alternative'; label: string };

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
  cas?: string[];
  combatLevel?: number;
  allQuests?: true;
  anySkillLevel?: number;
  oneOf?: DiaryTaskRequirementOption[];
}

export interface DoableDiaryTask extends DoableTask {
  tierId: string;
}

export interface DiaryTaskEligibility {
  eligible: boolean;
  blockers: EligibilityBlocker[];
  evidence: string[];
}

const requirementOptionParts = (option: DiaryTaskRequirementOption): string[] => [
  ...Object.entries(option.skills ?? {}).map(([skill, level]) => skill + ' ' + level),
  ...(option.quests ?? []),
  ...(option.cas ?? []).map(tier => tier + ' Combat Achievements'),
  ...(option.regions ?? []),
  ...(option.combatLevel ? ['Combat level ' + option.combatLevel] : []),
  ...(option.allQuests ? ['All quests'] : []),
  ...(option.anySkillLevel ? ['Any skill ' + option.anySkillLevel] : []),
];

export const diaryRequirementOptionLabel = (
  option: DiaryTaskRequirementOption,
): string => {
  const requirements = requirementOptionParts(option).join(' + ');
  if (option.label && requirements) return option.label + ': ' + requirements;
  return option.label ?? requirements;
};

const evaluateDiaryRequirement = (
  requirement: Omit<DoableTask, 'id' | 'oneOf'>,
  unlocks: UnlockState,
  gameModeId?: string,
): DiaryTaskEligibility => {
  const blockers: EligibilityBlocker[] = [];
  const evidence: string[] = [];

  for (const [skill, required] of Object.entries(requirement.skills ?? {})) {
    const label = skill + ' ' + required;
    if (meetsSkillRequirement(unlocks, skill, required)) evidence.push(label);
    else blockers.push({ kind: 'skill', label });
  }
  for (const quest of requirement.quests ?? []) {
    if (unlocks.quests.includes(quest)) evidence.push(quest);
    else blockers.push({ kind: 'quest', label: quest });
  }
  for (const tier of requirement.cas ?? []) {
    const label = tier + ' Combat Achievements';
    if (unlocks.cas.includes(tier)) evidence.push(label);
    else blockers.push({ kind: 'combat', label });
  }
  for (const region of requirement.regions ?? []) {
    if (isAreaReachable(region, unlocks, gameModeId)) evidence.push(region);
    else blockers.push({ kind: 'region', label: region });
  }
  if (requirement.combatLevel !== undefined) {
    const label = 'Combat level ' + requirement.combatLevel;
    if (combatLevel(unlocks.levels) >= requirement.combatLevel) evidence.push(label);
    else blockers.push({ kind: 'combat', label });
  }
  if (requirement.allQuests) {
    const allCompleted = Object.keys(QUEST_DATA).every(quest => unlocks.quests.includes(quest));
    if (allCompleted) evidence.push('All quests');
    else blockers.push({ kind: 'quest', label: 'All quests' });
  }
  if (requirement.anySkillLevel !== undefined) {
    const anySkillMet = Object.keys(unlocks.levels).some(skill => (
      meetsSkillRequirement(unlocks, skill, requirement.anySkillLevel!)
    ));
    const label = 'Any skill ' + requirement.anySkillLevel;
    if (anySkillMet) evidence.push(label);
    else blockers.push({ kind: 'skill', label });
  }

  return { eligible: blockers.length === 0, blockers, evidence };
};

export function evaluateDiaryTaskEligibility(
  task: DoableTask,
  unlocks: UnlockState,
  gameModeId?: string,
): DiaryTaskEligibility {
  const shared = evaluateDiaryRequirement(task, unlocks, gameModeId);
  if (!task.oneOf?.length) return shared;

  const routeResults = task.oneOf.map(option => (
    evaluateDiaryRequirement(option, unlocks, gameModeId)
  ));
  const metRouteIndex = routeResults.findIndex(result => result.eligible);
  if (metRouteIndex >= 0) {
    const routeLabel = diaryRequirementOptionLabel(task.oneOf[metRouteIndex]);
    return {
      eligible: shared.eligible,
      blockers: shared.blockers,
      evidence: [...shared.evidence, ...(routeLabel ? [routeLabel] : [])],
    };
  }

  const alternativeLabel = task.oneOf.map(diaryRequirementOptionLabel).join(' or ');
  const blockers = [
    ...shared.blockers,
    { kind: 'alternative' as const, label: alternativeLabel },
  ];
  return { eligible: false, blockers, evidence: shared.evidence };
}

export function taskEligibilityBlockers(
  task: DoableTask,
  unlocks: UnlockState,
  gameModeId?: string,
): EligibilityBlocker[] {
  return evaluateDiaryTaskEligibility(task, unlocks, gameModeId).blockers;
}

export interface DiaryTierEligibility {
  eligible: boolean;
  status: DiaryStatus;
  blockers: EligibilityBlocker[];
  evidence: string[];
}

const uniqueBlockers = (blockers: EligibilityBlocker[]): EligibilityBlocker[] => {
  const seen = new Set<string>();
  return blockers.filter(blocker => {
    const key = blocker.kind + '|' + blocker.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function evaluateDiaryTierEligibility(
  diary: Pick<DiaryTier, 'id'>,
  unlocks: DiaryStatusUnlocks,
  gameModeId?: string,
): DiaryTierEligibility {
  if (unlocks.diaries.includes(diary.id)) {
    return { eligible: true, status: 'COMPLETED', blockers: [], evidence: ['Completed'] };
  }

  const normalizedUnlocks: UnlockState = {
    ...unlocks,
    cas: unlocks.cas ?? [],
    completedTasks: unlocks.completedTasks ?? [],
  };
  const taskResults = ALL_DIARY_TASKS
    .filter(task => task.tierId === diary.id && !normalizedUnlocks.completedTasks.includes(task.id))
    .map(task => evaluateDiaryTaskEligibility(task, normalizedUnlocks, gameModeId));
  const blockers = uniqueBlockers(taskResults.flatMap(result => result.blockers));
  const evidence = [...new Set(taskResults.flatMap(result => result.evidence))];
  const status: DiaryStatus = blockers.some(blocker => blocker.kind === 'region')
    ? 'LOCKED_REGION'
    : blockers.some(blocker => blocker.kind === 'skill' || blocker.kind === 'combat')
      ? 'LOCKED_SKILL'
      : blockers.some(blocker => blocker.kind === 'quest' || blocker.kind === 'alternative')
        ? 'LOCKED_QUEST'
        : 'AVAILABLE';

  return { eligible: status === 'AVAILABLE', status, blockers, evidence };
}

export function getDiaryStatus(
  diary: DiaryTier,
  unlocks: DiaryStatusUnlocks,
  gameModeId?: string,
): DiaryStatus {
  return evaluateDiaryTierEligibility(diary, unlocks, gameModeId).status;
}

export function countDoableTasks(tasks: DoableTask[], unlocks: UnlockState, gameModeId?: string): number {
  return tasks.filter(task => {
    if (unlocks.completedTasks.includes(task.id)) return false;
    return taskEligibilityBlockers(task, unlocks, gameModeId).length === 0;
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
