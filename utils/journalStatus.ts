/**
 * Pure (side-effect-free) status computation for Journal items.
 * Mirrors the logic inside QuestLog / DiaryLog but accepts an explicit
 * `unlocks` snapshot so callers can diff two snapshots (e.g. before/after
 * a quest completion) without needing component context.
 */

import {
  QuestData, QuestLocationRequirement, QuestRequirementOption, QUEST_DATA,
  hasCompletedQuestCapeRequirements,
} from '../data/questData';
import { ALL_DIARY_TASKS, DiaryTaskRequirementOption } from '../data/diaryTasks';
import { DiaryTier } from '../data/diaryData';
import { UnlockState } from '../types';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';
import { isAreaReachable } from './reachability';
import { effectiveCombatLevel, effectiveSkillLevel } from './slayerReach';

export type QuestStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';
export type DiaryStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';

export type DiaryStatusUnlocks =
  Omit<UnlockState, 'cas' | 'completedTasks'>
  & Partial<Pick<UnlockState, 'cas' | 'completedTasks'>>;

export type SkillEligibilityRequirement =
  | { type: 'single'; skill: string; level: number }
  | { type: 'any'; level: number }
  | { type: 'combined'; skills: string[]; level: number }
  | { type: 'anyOf'; skills: string[]; level: number };

export type DirectEligibilityBlocker =
  | { kind: 'region'; label: string }
  | { kind: 'skill'; label: string; requirement?: SkillEligibilityRequirement }
  | { kind: 'combat'; label: string }
  | { kind: 'quest'; label: string };

export interface AlternativeEligibilityRoute {
  label: string;
  blockers: DirectEligibilityBlocker[];
}

export type EligibilityBlocker = DirectEligibilityBlocker | {
  kind: 'alternative';
  label: string;
  blockerKinds: DirectEligibilityBlocker['kind'][];
  routes: AlternativeEligibilityRoute[];
};

export interface ManualEligibility {
  machineEligible: boolean;
  manualChecks: string[];
  confirmable: boolean;
}

const uniqueStrings = (values: readonly string[]): string[] => [
  ...new Set(values),
];

const readinessFields = (
  blockers: readonly EligibilityBlocker[],
  manualChecks: readonly string[],
): ManualEligibility & { eligible: boolean } => {
  const machineEligible = blockers.length === 0;
  const checks = uniqueStrings(manualChecks);
  return {
    machineEligible,
    manualChecks: checks,
    confirmable: machineEligible,
    eligible: machineEligible && checks.length === 0,
  };
};

export interface QuestEligibility extends ManualEligibility {
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
  return tier > 0 && effectiveSkillLevel(unlocks, skill) >= required;
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
    return {
      ...readinessFields([], []),
      status: 'COMPLETED',
      blockers: [],
      evidence: ['Completed'],
    };
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
    const label = skill + ' ' + required;
    if (skill === 'Quest Points') {
      if (qp >= required) evidence.push(label);
      else blockers.push({ kind: 'quest', label });
    } else if (meetsSkillRequirement(unlocks, skill, required)) {
      evidence.push(label);
    } else {
      blockers.push({
        kind: 'skill', label,
        requirement: { type: 'single', skill, level: required },
      });
    }
  }
  if (quest.combatLevel !== undefined) {
    if (effectiveCombatLevel(unlocks) >= quest.combatLevel) evidence.push('Combat level ' + quest.combatLevel);
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
  const manual = readinessFields(blockers, quest.manualRequirements ?? []);
  return { ...manual, status, blockers, evidence };
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
  items?: string[];
  quests?: string[];
  regions?: string[];
  cas?: string[];
  questPoints?: number;
  manualRequirements?: string[];
  combatLevel?: number;
  allQuests?: true;
  anySkillLevel?: number;
  combinedSkillLevel?: { skills: string[]; level: number };
  anyOfSkillsLevel?: { skills: string[]; level: number };
  oneOf?: DiaryTaskRequirementOption[];
}

export interface DoableDiaryTask extends DoableTask {
  tierId: string;
}

export interface DiaryTaskEligibility extends ManualEligibility {
  eligible: boolean;
  blockers: EligibilityBlocker[];
  evidence: string[];
}

const requirementOptionParts = (option: DiaryTaskRequirementOption): string[] => [
  ...Object.entries(option.skills ?? {}).map(([skill, level]) => skill + ' ' + level),
  ...(option.items ?? []),
  ...(option.combinedSkillLevel ? [
    option.combinedSkillLevel.skills.join(' + ') + ' combined ' + option.combinedSkillLevel.level,
  ] : []),
  ...(option.anyOfSkillsLevel ? [
    option.anyOfSkillsLevel.skills.join(' or ') + ' ' + option.anyOfSkillsLevel.level,
  ] : []),
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
  const blockers: DirectEligibilityBlocker[] = [];
  const evidence: string[] = [...(requirement.items ?? [])];

  for (const [skill, required] of Object.entries(requirement.skills ?? {})) {
    const label = skill + ' ' + required;
    if (meetsSkillRequirement(unlocks, skill, required)) evidence.push(label);
    else blockers.push({
      kind: 'skill', label,
      requirement: { type: 'single', skill, level: required },
    });
  }
  for (const quest of requirement.quests ?? []) {
    if (unlocks.quests.includes(quest)) evidence.push(quest);
    else blockers.push({ kind: 'quest', label: quest });
  }
  if (requirement.questPoints !== undefined) {
    const label = 'Quest Points ' + requirement.questPoints;
    if (currentQuestPoints(unlocks) >= requirement.questPoints) evidence.push(label);
    else blockers.push({ kind: 'quest', label });
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
    if (effectiveCombatLevel(unlocks) >= requirement.combatLevel) evidence.push(label);
    else blockers.push({ kind: 'combat', label });
  }
  if (requirement.allQuests) {
    const allCompleted = hasCompletedQuestCapeRequirements(unlocks.quests);
    if (allCompleted) evidence.push('All quests');
    else blockers.push({ kind: 'quest', label: 'All quests' });
  }
  if (requirement.anySkillLevel !== undefined) {
    const anySkillMet = Object.keys(unlocks.levels).some(skill => (
      meetsSkillRequirement(unlocks, skill, requirement.anySkillLevel!)
    ));
    const label = 'Any skill ' + requirement.anySkillLevel;
    if (anySkillMet) evidence.push(label);
    else blockers.push({
      kind: 'skill', label,
      requirement: { type: 'any', level: requirement.anySkillLevel },
    });
  }
  if (requirement.combinedSkillLevel) {
    const { skills, level } = requirement.combinedSkillLevel;
    const label = skills.join(' + ') + ' combined ' + level;
    const total = skills.reduce(
      (sum, skill) => sum + effectiveSkillLevel(unlocks, skill), 0,
    );
    if (total >= level) evidence.push(label);
    else blockers.push({
      kind: 'skill', label,
      requirement: { type: 'combined', skills, level },
    });
  }
  if (requirement.anyOfSkillsLevel) {
    const { skills, level } = requirement.anyOfSkillsLevel;
    const label = skills.join(' or ') + ' ' + level;
    if (skills.some(skill => meetsSkillRequirement(unlocks, skill, level))) evidence.push(label);
    else blockers.push({
      kind: 'skill', label,
      requirement: { type: 'anyOf', skills, level },
    });
  }

  const manual = readinessFields(blockers, requirement.manualRequirements ?? []);
  return { ...manual, blockers, evidence };
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
  const eligibleRouteIndex = routeResults.findIndex(result => result.eligible);
  const confirmableRouteIndex = routeResults.findIndex(result => result.confirmable);
  const selectedRouteIndex = eligibleRouteIndex >= 0
    ? eligibleRouteIndex
    : confirmableRouteIndex;
  if (selectedRouteIndex >= 0) {
    const route = routeResults[selectedRouteIndex];
    const routeLabel = diaryRequirementOptionLabel(task.oneOf[selectedRouteIndex]);
    const manualChecks = uniqueStrings([
      ...shared.manualChecks,
      ...route.manualChecks,
    ]);
    const manual = readinessFields(shared.blockers, manualChecks);
    return {
      ...manual,
      blockers: shared.blockers,
      evidence: [...shared.evidence, ...(routeLabel ? [routeLabel] : [])],
    };
  }

  const routes: AlternativeEligibilityRoute[] = task.oneOf.map((option, index) => ({
    label: diaryRequirementOptionLabel(option),
    blockers: routeResults[index].blockers as DirectEligibilityBlocker[],
  }));
  const alternativeLabel = routes.map(route => route.label).join(' or ');
  const blockerKinds = [...new Set(routes.flatMap(route => (
    route.blockers.map(blocker => blocker.kind)
  )))];
  const blockers: EligibilityBlocker[] = [
    ...shared.blockers,
    { kind: 'alternative', label: alternativeLabel, blockerKinds, routes },
  ];
  const manual = readinessFields(blockers, shared.manualChecks);
  return { ...manual, blockers, evidence: shared.evidence };
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
  const alternatives = blockers.filter(
    (blocker): blocker is Extract<EligibilityBlocker, { kind: 'alternative' }> => (
      blocker.kind === 'alternative'
    ),
  );
  const alternativeHasSkillRoute = alternatives.some(alternative => (
    alternative.routes.every(route => route.blockers.every(
      blocker => blocker.kind === 'skill' || blocker.kind === 'combat',
    ))
  ));
  const alternativesRequireRegion = alternatives.some(alternative => (
    alternative.routes.every(route => route.blockers.some(blocker => blocker.kind === 'region'))
  ));
  const status: DiaryStatus = blockers.some(blocker => blocker.kind === 'region')
    || alternativesRequireRegion
    ? 'LOCKED_REGION'
    : blockers.some(blocker => blocker.kind === 'skill' || blocker.kind === 'combat')
      || alternativeHasSkillRoute
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
    return evaluateDiaryTaskEligibility(task, unlocks, gameModeId).eligible;
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
