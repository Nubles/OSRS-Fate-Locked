/**
 * Pure (side-effect-free) status computation for Journal items.
 * Mirrors the logic inside QuestLog / DiaryLog but accepts an explicit
 * `unlocks` snapshot so callers can diff two snapshots (e.g. before/after
 * a quest completion) without needing component context.
 */

import {
  QuestData, QuestLocationRequirement, QuestRequirementOption, QUEST_DATA,
  hasCompletedQuestCapeRequirements, questAccessPolicyStructureErrors,
} from '../data/questData';
import { ALL_DIARY_TASKS, DiaryTaskRequirementOption } from '../data/diaryTasks';
import { DiaryTier } from '../data/diaryData';
import { UnlockState } from '../types';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';
import { isAreaReachable } from './reachability';
import { actualCombatLevel } from './slayerReach';
import { evaluatePredicate, type RequirementPredicate } from './requirementPredicates';
import { actualSkillLevel } from './skillLevels';
import { questOperationalRequirements } from '../data/questOperationalRequirements';
import { canonicalQuestUnlocks, questPointsForReferences } from '../data/questCatalog';
import { evaluateChunkQuestGeography } from './questChunkGeography';

export type QuestStatus = 'UNKNOWN' | 'NEEDS_CONFIRMATION' | 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';
export type DiaryStatus = 'NEEDS_CONFIRMATION' | 'UNKNOWN' | 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';

export type DiaryStatusUnlocks =
  Omit<UnlockState, 'cas' | 'completedTasks'>
  & Partial<Pick<UnlockState, 'cas' | 'completedTasks'>>;

export type SkillEligibilityRequirement =
  | { type: 'single'; skill: string; level: number }
  | { type: 'any'; level: number }
  | { type: 'combined'; skills: string[]; level: number }
  | { type: 'anyOf'; skills: string[]; level: number };

export type DirectEligibilityBlocker =
  | { kind: 'requirement'; label: string; internalOnly?: boolean }
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

/** Compatibility fields are constrained together so callers cannot invent contradictory readiness. */
export type ManualEligibility =
  | { eligible: true; machineEligible: true; confirmable: true; manualChecks: [] }
  | { eligible: false; machineEligible: true; confirmable: true; manualChecks: string[] }
  | { eligible: false; machineEligible: false; confirmable: false; manualChecks: string[] };

const uniqueStrings = (values: readonly string[]): string[] => [
  ...new Set(values),
];

const readinessFields = (
  blockers: readonly EligibilityBlocker[],
  manualChecks: readonly string[],
): ManualEligibility => {
  const checks = uniqueStrings(manualChecks);
  if (blockers.length) return { eligible: false, machineEligible: false, confirmable: false, manualChecks: checks };
  if (checks.length) return { eligible: false, machineEligible: true, confirmable: true, manualChecks: checks };
  return { eligible: true, machineEligible: true, confirmable: true, manualChecks: [] };
};

export type QuestEligibility = ManualEligibility & {
  blockers: EligibilityBlocker[];
  evidence: string[];
} & (
  | { eligible: true; status: 'AVAILABLE' | 'COMPLETED' }
  | { eligible: false; status: Exclude<QuestStatus, 'AVAILABLE' | 'COMPLETED'> }
);

const questEligibility = (
  status: QuestStatus, blockers: EligibilityBlocker[], evidence: string[], manualChecks: string[],
): QuestEligibility => {
  const readiness = readinessFields(blockers, manualChecks);
  if (readiness.eligible === true) return { ...readiness, status: status === 'COMPLETED' ? 'COMPLETED' : 'AVAILABLE', blockers, evidence };
  return { ...readiness, status: status === 'AVAILABLE' || status === 'COMPLETED' ? 'NEEDS_CONFIRMATION' : status, blockers, evidence };
};

export const meetsSkillRequirement = (
  unlocks: Pick<UnlockState, 'skills' | 'levels'>,
  skill: string,
  required: number,
): boolean => {
  return actualSkillLevel(unlocks, skill) >= required;
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
  questPointsForReferences(unlocks.quests);

export function evaluateQuestEligibility(
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): QuestEligibility {
  unlocks = canonicalQuestUnlocks(unlocks);
  if (unlocks.quests.includes(quest.id)) {
    return questEligibility('COMPLETED', [], ['Completed'], []);
  }
  const configurationErrors = questAccessPolicyStructureErrors(quest);
  if (configurationErrors.length) {
    const blocker: EligibilityBlocker = {
      kind: 'quest',
      label: `Invalid quest access configuration: ${configurationErrors.join('; ')}`,
    };
    return questEligibility('LOCKED_QUEST', [blocker], [], quest.manualRequirements ?? []);
  }
  const blockers: EligibilityBlocker[] = [];
  const evidence: string[] = [];
  const chunkGeography = gameModeId === 'chunked' ? quest.chunkedGeography : undefined;
  const chunkResult = chunkGeography ? evaluateChunkQuestGeography(chunkGeography, unlocks, unlocks) : undefined;
  if (chunkResult) {
    evidence.push(...chunkResult.evidence);
    blockers.push(...chunkResult.blockers.map(label => ({kind: 'region' as const, label})));
    blockers.push(...chunkResult.unknowns.map(label => ({kind: 'requirement' as const, label, internalOnly: true})));
  }
  const enforceRegions =
    !chunkGeography && (quest.accessPolicy === 'regions' ||
    quest.accessPolicy === 'regions-and-locations');
  const enforceLocations =
    !chunkGeography && (quest.accessPolicy === 'locations' ||
    quest.accessPolicy === 'regions-and-locations');
  for (const region of enforceRegions ? quest.regions : []) {
    if (isAreaReachable(region, unlocks, gameModeId)) evidence.push(region);
    else blockers.push({ kind: 'region', label: region });
  }
  for (const location of enforceLocations ? (quest.locations ?? []) : []) {
    if (locationRequirementMet(location, unlocks, gameModeId)) evidence.push(location.label);
    else blockers.push({ kind: 'region', label: location.label });
  }
  if (!chunkGeography && !questAlternativesMet(quest, unlocks, gameModeId)) {
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
    if (actualCombatLevel(unlocks) >= quest.combatLevel) evidence.push('Combat level ' + quest.combatLevel);
    else blockers.push({ kind: 'combat', label: 'Combat level ' + quest.combatLevel });
  }
  for (const prereq of quest.prereqs) {
    if (unlocks.quests.includes(prereq)) evidence.push(prereq);
    else blockers.push({ kind: 'quest', label: prereq });
  }
  const operationPredicates = questOperationalRequirements(quest);
  const operations = evaluatePredicate({ kind: 'all', of: operationPredicates }, { unlocks, gameModeId });
  // Group checks also contain unresolved notes. Only proven hard gates belong
  // in player-facing blocker rows; retain every other check as internal evidence.
  const hardChecks = (predicate: RequirementPredicate): string[] => {
    const evaluated = evaluatePredicate(predicate, { unlocks, gameModeId });
    if (evaluated.status !== 'LOCKED') return [];
    if (predicate.kind === 'all' || predicate.kind === 'any') return predicate.of.flatMap(hardChecks);
    return evaluated.checks;
  };
  const visibleOperationChecks = new Set(
    operations.status === 'LOCKED' || operations.status === 'UNKNOWN'
      ? operationPredicates.flatMap(hardChecks) : [],
  );
  const manualChecks = [...(quest.manualRequirements ?? []), ...(operations.status === 'NEEDS_CONFIRMATION' ? operations.checks : [])];
  if (operations.status === 'LOCKED' || operations.status === 'UNKNOWN') blockers.push(...operations.checks.map(label => ({ kind: 'requirement' as const, label, ...(!visibleOperationChecks.has(label) ? { internalOnly: true } : {}) })));
  const status: QuestStatus = blockers.some(x => x.kind === 'region') ? 'LOCKED_REGION'
    : blockers.some(x => x.kind === 'skill' || x.kind === 'combat') ? 'LOCKED_SKILL'
    : blockers.some(x => x.kind === 'quest') || operations.status === 'LOCKED' ? 'LOCKED_QUEST'
    : operations.status === 'UNKNOWN' || chunkResult?.unknowns.length ? 'UNKNOWN'
    : blockers.some(x => x.kind === 'requirement') ? 'LOCKED_QUEST'
    : manualChecks.length ? 'NEEDS_CONFIRMATION' : 'AVAILABLE';
  return questEligibility(status, blockers, evidence, manualChecks);
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
  predicates?: RequirementPredicate[];
  id: string;
  skills?: Record<string, number>;
  items?: string[];
  quests?: string[];
  regions?: string[];
  anyOfRegions?: string[];
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

export type DiaryTaskEligibility = ManualEligibility & {
  unknownChecks: string[];
  blockers: EligibilityBlocker[];
  evidence: string[];
};

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
  unlocks = canonicalQuestUnlocks(unlocks);
  const blockers: EligibilityBlocker[] = [];
  const evidence: string[] = [];
  const evaluated = evaluatePredicate({ kind: 'all', of: [
    ...(requirement.predicates ?? []),
    ...(requirement.items ?? []).map(label => ({ kind: 'item' as const, id: label, label, usage: 'hold' as const })),
  ] }, { unlocks, gameModeId });
  if (evaluated.status === 'LOCKED' || evaluated.status === 'UNKNOWN') blockers.push(...evaluated.checks.map(label => ({ kind: 'requirement' as const, label })));
  const externalChecks = evaluated.status === 'NEEDS_CONFIRMATION' ? evaluated.checks : [];

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
  if (requirement.anyOfRegions?.length) {
    const reachableRegion = requirement.anyOfRegions.find(region => (
      isAreaReachable(region, unlocks, gameModeId)
    ));
    if (reachableRegion) {
      evidence.push(reachableRegion);
    } else {
      blockers.push({
        kind: 'alternative',
        label: requirement.anyOfRegions.join(' or '),
        blockerKinds: ['region'],
        routes: requirement.anyOfRegions.map(region => ({
          label: region,
          blockers: [{ kind: 'region', label: region }],
        })),
      });
    }
  }
  if (requirement.combatLevel !== undefined) {
    const label = 'Combat level ' + requirement.combatLevel;
    if (actualCombatLevel(unlocks) >= requirement.combatLevel) evidence.push(label);
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
      (sum, skill) => sum + actualSkillLevel(unlocks, skill), 0,
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

  const manual = readinessFields(blockers, [...(requirement.manualRequirements ?? []), ...externalChecks]);
  return { ...manual, blockers, evidence, unknownChecks: evaluated.status === 'UNKNOWN' ? evaluated.checks : [] };
};

export function evaluateDiaryTaskEligibility(
  task: DoableTask,
  unlocks: UnlockState,
  gameModeId?: string,
): DiaryTaskEligibility {
  const shared = evaluateDiaryRequirement(task, unlocks, gameModeId);
  if (!task.oneOf?.length) return shared;

  const routeResults = task.oneOf.map(option => {
    const hasGate = Object.entries(option).some(([key, value]) => key !== 'label' && (Array.isArray(value) ? value.length > 0 : value && (typeof value !== 'object' || Object.keys(value).length > 0)));
    return evaluateDiaryRequirement(hasGate ? option : { predicates: [{ kind: 'unknown', key: 'unclassified-alternative', label: option.label ?? 'Unclassified alternative' }] }, unlocks, gameModeId);
  });
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
      unknownChecks: shared.unknownChecks,
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
  return { ...manual, blockers, evidence: shared.evidence, unknownChecks: uniqueStrings([...shared.unknownChecks, ...routeResults.flatMap(route => route.unknownChecks)]) };
}

export function taskEligibilityBlockers(
  task: DoableTask,
  unlocks: UnlockState,
  gameModeId?: string,
): EligibilityBlocker[] {
  return evaluateDiaryTaskEligibility(task, unlocks, gameModeId).blockers;
}

export type DiaryTierEligibility = {
  manualChecks: string[];
  unverifiedTaskIds: string[];
  blockers: EligibilityBlocker[];
  evidence: string[];
} & (
  | { eligible: true; status: 'AVAILABLE' | 'COMPLETED' }
  | { eligible: false; status: Exclude<DiaryStatus, 'AVAILABLE' | 'COMPLETED'> }
);

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
    return { eligible: true, status: 'COMPLETED', blockers: [], evidence: ['Completed'], manualChecks: [], unverifiedTaskIds: [] };
  }

  const normalizedUnlocks: UnlockState = {
    ...unlocks,
    cas: unlocks.cas ?? [],
    completedTasks: unlocks.completedTasks ?? [],
  };
  const pendingTasks = ALL_DIARY_TASKS.filter(task => task.tierId === diary.id && !normalizedUnlocks.completedTasks.includes(task.id));
  const taskResults = pendingTasks.map(task => evaluateDiaryTaskEligibility(task, normalizedUnlocks, gameModeId));
  const manualChecks = uniqueStrings(taskResults.flatMap(result => result.manualChecks));
  const unverifiedTaskIds = pendingTasks.filter((_, index) => taskResults[index].manualChecks.length > 0 || taskResults[index].unknownChecks.length > 0).map(task => task.id);
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
  const status: DiaryStatus = taskResults.some(result => result.unknownChecks.length > 0) ? 'UNKNOWN' : blockers.some(blocker => blocker.kind === 'region')
    || alternativesRequireRegion
    ? 'LOCKED_REGION'
    : blockers.some(blocker => blocker.kind === 'skill' || blocker.kind === 'combat')
      || alternativeHasSkillRoute
      ? 'LOCKED_SKILL'
      : blockers.some(blocker => blocker.kind === 'quest' || blocker.kind === 'alternative' || blocker.kind === 'requirement')
        ? 'LOCKED_QUEST'
        : manualChecks.length > 0 ? 'NEEDS_CONFIRMATION' : 'AVAILABLE';

  return status === 'AVAILABLE'
    ? { eligible: true, status, blockers, evidence, manualChecks, unverifiedTaskIds }
    : { eligible: false, status, blockers, evidence, manualChecks, unverifiedTaskIds };
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
