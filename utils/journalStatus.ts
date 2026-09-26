/**
 * Pure (side-effect-free) status computation for Journal items.
 * Mirrors the logic inside QuestLog / DiaryLog but accepts an explicit
 * `unlocks` snapshot so callers can diff two snapshots (e.g. before/after
 * a quest completion) without needing component context.
 */

import {
  QuestData, QuestLocationRequirement, QuestRequirementOption, QUEST_DATA,
  hasCompletedQuestCapeRequirements, questAccessPolicyStructureErrors,
  type EquipmentSlot,
} from '../data/questData';
import { chunkUnlocked, placeOf, chunkUnlockRequirement } from './chunkLocations';
import { ALL_DIARY_TASKS, DiaryTaskRequirementOption, DiaryLocationRequirement, DiaryEquipmentRequirement } from '../data/diaryTasks';
import { DiaryTier } from '../data/diaryData';
import { UnlockState } from '../types';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';
import { isAreaReachable } from './reachability';
import { getFreeAreas } from './freeAreas';
import { actualCombatLevel, effectiveSkillLevel } from './slayerReach';
import { pendingQuestProgress, type QuestProgressRequirement } from '../data/questProgress';
import { AREA_ENTRY_ROUTES } from '../data/areaAccess';
import { canonicalAreaName } from '../data/areaMapPolicy';
import type { AreaRoutes } from './areaRoutes';

export type QuestStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_EQUIPMENT' | 'LOCKED_QUEST';
export type DiaryStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_EQUIPMENT' | 'LOCKED_MOBILITY' | 'LOCKED_ARCANA' | 'LOCKED_MERCHANT' | 'LOCKED_MINIGAME' | 'LOCKED_BOSS' | 'LOCKED_QUEST';

export type DiaryStatusUnlocks =
  Omit<UnlockState, 'cas' | 'completedTasks'>
  & Partial<Pick<UnlockState, 'cas' | 'completedTasks'>>;

export type SkillEligibilityRequirement =
  | { type: 'single'; skill: string; level: number }
  | { type: 'any'; level: number }
  | { type: 'combined'; skills: string[]; level: number }
  | { type: 'anyOf'; skills: string[]; level: number };

/**
 * What unlocks a named quest location: its unreachable standard areas, or in
 * Chunked mode any one of its exact chunks. Its label is only a place name.
 */
export interface LocationUnlockTargets {
  areas: string[];
  chunks: Array<{ cx: number; cy: number }>;
}

export type DirectEligibilityBlocker =
  | {
      kind: 'region';
      label: string;
      chunk?: { cx: number; cy: number };
      location?: LocationUnlockTargets;
      /** Any one of these areas clears it: a travel route's choice of departure. */
      anyOf?: string[];
    }
  | { kind: 'skill'; label: string; requirement?: SkillEligibilityRequirement }
  | { kind: 'combat'; label: string }
  | { kind: 'equipment'; label: string; slot: EquipmentSlot; tier: number }
  | { kind: 'merchant'; label: string }
  | { kind: 'mobility'; label: string }
  | { kind: 'arcana'; label: string }
  | { kind: 'minigame'; label: string }
  | { kind: 'boss'; label: string }
  | { kind: 'quest'; label: string };

export interface AlternativeEligibilityRoute {
  label: string;
  blockers: DirectEligibilityBlocker[];
  /** The owned area this route travels to (data/areaAccess.ts). */
  travel?: string;
}

export type EligibilityBlocker = DirectEligibilityBlocker | {
  kind: 'alternative';
  label: string;
  blockerKinds: DirectEligibilityBlocker['kind'][];
  routes: AlternativeEligibilityRoute[];
  /** "Travel to <area>": an owned island or enclave no route reaches yet. */
  travel?: string;
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

/**
 * Skills the game lets a player train only after a quest. Wiki requirement
 * lists name the skill level and leave this quest implicit, so every skill
 * requirement also needs it, at any level (see withSkillGateQuests).
 *
 * - Herblore: training it, or even boosting it, needs Druidic Ritual.
 *   https://oldschool.runescape.wiki/w/Herblore (Requirements)
 * - Sailing: training starts with the Pandemonium quest.
 *   https://oldschool.runescape.wiki/w/Sailing (Getting started)
 *
 * Runecraft is deliberately absent: Rune Mysteries gates mining rune essence,
 * not the skill. https://oldschool.runescape.wiki/w/Runecraft
 */
export const SKILL_QUEST_GATES: Readonly<Record<string, string>> = Object.freeze({
  Herblore: 'Druidic Ritual',
  Sailing: 'Pandemonium',
});

/**
 * The unlocking quests (SKILL_QUEST_GATES) that the named skills add, leaving
 * out any quest already in `listedQuests`.
 */
export const skillGateQuests = (
  skills: Iterable<string>,
  listedQuests: readonly string[] = [],
): string[] => uniqueStrings([...skills].flatMap(skill => (
  Object.hasOwn(SKILL_QUEST_GATES, skill) ? [SKILL_QUEST_GATES[skill]] : []
))).filter(quest => !listedQuests.includes(quest));

/**
 * The quests a requirement needs: the ones it lists, then the unlocking quest
 * of each gated skill it names that it doesn't list already. `self` is the
 * quest being evaluated, which never needs itself.
 */
export const withSkillGateQuests = (
  quests: readonly string[] | undefined,
  skills: Readonly<Record<string, number>> | undefined,
  self?: string,
): string[] => [
  ...(quests ?? []),
  ...skillGateQuests(Object.keys(skills ?? {}), [...(quests ?? []), ...(self === undefined ? [] : [self])]),
];

export const locationRequirementMet = (
  location: QuestLocationRequirement,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean => gameModeId === 'chunked'
  ? location.chunkOptions.some(coord =>
      isChunkUnlocked(chunkKey(coord), unlocks.chunks ?? []))
  : location.standardAreas.every(area =>
      isAreaReachable(area, unlocks, gameModeId));

export const locationUnlockTargets = (
  location: QuestLocationRequirement,
  unlocks: UnlockState,
  gameModeId?: string,
): LocationUnlockTargets => locationRequirementMet(location, unlocks, gameModeId)
  ? { areas: [], chunks: [] }
  : gameModeId === 'chunked'
    ? { areas: [], chunks: location.chunkOptions }
    : { areas: location.standardAreas.filter(area => !isAreaReachable(area, unlocks, gameModeId)), chunks: [] };

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
    locationRequirementMet(location, unlocks, gameModeId)) &&
  Object.entries(option.skills ?? {}).every(([skill, level]) =>
    meetsSkillRequirement(unlocks, skill, level));

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
  ...Object.entries(option.skills ?? {}).map(([skill, level]) => skill + ' ' + level),
].join(' + ');

export const currentQuestPoints = (unlocks: { readonly quests: readonly string[] }): number =>
  [...new Set(unlocks.quests)].reduce(
    (total, id) => total + (
      QUEST_DATA[id]?.kind === 'quest' ? QUEST_DATA[id].points : 0
    ), 0);

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
  const configurationErrors = questAccessPolicyStructureErrors(quest);
  if (configurationErrors.length) {
    const blocker: EligibilityBlocker = {
      kind: 'quest',
      label: `Invalid quest access configuration: ${configurationErrors.join('; ')}`,
    };
    return {
      ...readinessFields([blocker], quest.manualRequirements ?? []),
      status: 'LOCKED_QUEST',
      blockers: [blocker],
      evidence: [],
    };
  }
  const blockers: EligibilityBlocker[] = [];
  const evidence: string[] = [];
  const enforceRegions =
    quest.accessPolicy === 'regions' ||
    quest.accessPolicy === 'regions-and-locations';
  const enforceLocations =
    quest.accessPolicy === 'locations' ||
    quest.accessPolicy === 'regions-and-locations';
  for (const region of enforceRegions ? quest.regions : []) {
    if (isAreaReachable(region, unlocks, gameModeId)) evidence.push(region);
    else blockers.push({ kind: 'region', label: region });
  }
  for (const location of enforceLocations ? (quest.locations ?? []) : []) {
    if (locationRequirementMet(location, unlocks, gameModeId)) evidence.push(location.label);
    else blockers.push({ kind: 'region', label: location.label, location: locationUnlockTargets(location, unlocks, gameModeId) });
  }
  if (!questAlternativesMet(quest, unlocks, gameModeId)) {
    blockers.push({ kind: 'region', label: quest.oneOf!.map(questRequirementOptionLabel).join(' or ') });
  }
  const manualChecks = [...(quest.manualRequirements ?? []), ...pendingQuestProgress(quest.questProgress, unlocks.quests)];
  for (const preparation of quest.preparationRequirements ?? []) {
    if (meetsSkillRequirement(unlocks, preparation.skill, preparation.level)) {
      evidence.push(`${preparation.skill} ${preparation.level} to ${preparation.action}`);
    } else {
      manualChecks.push(`Unlock ${preparation.skill} (level ${preparation.level}) to ${preparation.action}, or confirm ${preparation.alternative}`);
    }
  }
  const qp = currentQuestPoints(unlocks);
  for (const [skill, required] of Object.entries(quest.skills)) {
    const label = skill + ' ' + required;
    if (skill === 'Quest Points') {
      if (qp >= required) evidence.push(label);
      else blockers.push({ kind: 'quest', label });
    } else if (meetsSkillRequirement(unlocks, skill, required)) {
      evidence.push(label);
    } else if (quest.skillAlternatives?.some(option => option.skill === skill && option.quests.every(id => unlocks.quests.includes(id)))) {
      const option = quest.skillAlternatives.find(option => option.skill === skill && option.quests.every(id => unlocks.quests.includes(id)))!;
      manualChecks.push(...option.manualRequirements);
    } else {
      blockers.push({
        kind: 'skill', label: quest.skillAlternatives?.some(option => option.skill === skill)
          ? label + ' or ' + quest.skillAlternatives.filter(option => option.skill === skill).map(option => option.quests.join(' + ') + ': ' + option.manualRequirements.join('; ')).join(' or ')
          : label,
        requirement: { type: 'single', skill, level: required },
      });
    }
  }
  if (quest.combatLevel !== undefined) {
    if (actualCombatLevel(unlocks) >= quest.combatLevel) evidence.push('Combat level ' + quest.combatLevel);
    else blockers.push({ kind: 'combat', label: 'Combat level ' + quest.combatLevel });
  }
  for (const requirement of quest.equipmentRequirements ?? []) {
    const label = `${requirement.slot} T${requirement.tier}: ${requirement.reason}`;
    const tier = unlocks.equipment?.[requirement.slot] ?? 0;
    if (Number.isFinite(tier) && tier >= requirement.tier) evidence.push(label);
    else blockers.push({ kind: 'equipment', slot: requirement.slot, tier: requirement.tier, label });
  }
  // Includes Druidic Ritual for a Herblore level, and Pandemonium for Sailing.
  for (const prereq of withSkillGateQuests(quest.prereqs, quest.skills, quest.id)) {
    if (unlocks.quests.includes(prereq)) evidence.push(prereq);
    else blockers.push({ kind: 'quest', label: prereq });
  }
  const status: QuestStatus = blockers.some(x => x.kind === 'region') ? 'LOCKED_REGION'
    : blockers.some(x => x.kind === 'skill' || x.kind === 'combat') ? 'LOCKED_SKILL'
    : blockers.some(x => x.kind === 'equipment') ? 'LOCKED_EQUIPMENT'
    : blockers.some(x => x.kind === 'quest') ? 'LOCKED_QUEST'
    : 'AVAILABLE';
  const manual = readinessFields(blockers, manualChecks);
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
  locations?: DiaryLocationRequirement[];
  id: string;
  skills?: Record<string, number>;
  items?: string[];
  merchants?: string[];
  mobility?: string[];
  arcana?: string[];
  minigames?: string[];
  bosses?: string[];
  equipmentRequirements?: DiaryEquipmentRequirement[];
  quests?: string[];
  regions?: string[];
  anyOfRegions?: string[];
  cas?: string[];
  questPoints?: number;
  manualRequirements?: string[];
  questProgress?: QuestProgressRequirement[];
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
  ...(option.merchants ?? []),
  ...(option.mobility ?? []),
  ...(option.arcana ?? []),
  ...(option.minigames ?? []),
  ...(option.bosses ?? []),
  ...(option.equipmentRequirements ?? []).map(item => `${item.slot} T${item.tier}: ${item.reason}${item.unlessDiary ? ` (unless ${item.unlessDiary} is complete)` : ''}`),
  ...(option.combinedSkillLevel ? [
    option.combinedSkillLevel.skills.join(' + ') + ' combined ' + option.combinedSkillLevel.level,
  ] : []),
  ...(option.anyOfSkillsLevel ? [
    option.anyOfSkillsLevel.skills.join(' or ') + ' ' + option.anyOfSkillsLevel.level,
  ] : []),
  ...(option.quests ?? []),
  ...(option.cas ?? []).map(tier => tier + ' Combat Achievements'),
  ...(option.locations ?? []).map(location => location.label),
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

type AlternativeBlocker = Extract<EligibilityBlocker, { kind: 'alternative' }>;

const isTravelBlocker = (blocker: EligibilityBlocker): blocker is AlternativeBlocker => (
  blocker.kind === 'alternative' && blocker.travel !== undefined
);

/** An unmet departure: any one of several areas, each a plain area unlock. */
const isAreaChoice = (blocker: AlternativeBlocker): boolean => (
  blocker.travel === undefined
  && blocker.routes.length > 1
  && blocker.routes.every(route => (
    route.blockers.length === 1
    && route.blockers[0].kind === 'region'
    && route.blockers[0].label === route.label
    && !route.blockers[0].anyOf
  ))
);

/**
 * A route's blockers as direct requirements that planners can list and plan.
 * A choice of departure areas becomes one "any of these areas" requirement; a
 * nested trip, or a map chunk, becomes one variant per way through it.
 */
const expandRoute = (
  label: string,
  blockers: readonly EligibilityBlocker[],
): AlternativeEligibilityRoute[] => {
  let expanded: AlternativeEligibilityRoute[] = [{ label, blockers: [] }];
  for (const blocker of blockers) {
    if (blocker.kind !== 'alternative') {
      expanded = expanded.map(route => ({ ...route, blockers: [...route.blockers, blocker] }));
    } else if (isAreaChoice(blocker)) {
      const departure: DirectEligibilityBlocker = {
        kind: 'region',
        label: blocker.label,
        anyOf: blocker.routes.map(route => route.label),
      };
      expanded = expanded.map(route => ({ ...route, blockers: [...route.blockers, departure] }));
    } else {
      expanded = expanded.flatMap(route => blocker.routes.map(option => ({
        ...route,
        ...(blocker.travel !== undefined ? { travel: blocker.travel } : {}),
        label: blocker.routes.length === 1 ? route.label : `${route.label}, via ${option.label}`,
        blockers: [...route.blockers, ...option.blockers],
      })));
    }
  }
  return expanded;
};

const blockerKindsOf = (routes: readonly AlternativeEligibilityRoute[]): DirectEligibilityBlocker['kind'][] => [
  ...new Set(routes.flatMap(route => route.blockers.map(blocker => blocker.kind))),
];

type AreaAccess =
  | { state: 'open' }
  | { state: 'confirm'; manualChecks: string[] }
  | { state: 'blocked'; blocker: AlternativeBlocker };

const OPEN_ACCESS: AreaAccess = { state: 'open' };
const NO_AREAS: ReadonlySet<string> = new Set();

/**
 * Island access worked out once per account state. Tier counts and the
 * unlock-impact engine check every diary task against the same account, and
 * resolving an island's routes for each task made them a third slower. Each
 * tier works on its own copy of the unlocks object, so entries hang off the
 * regions list, which the copies share. An entry keeps everything else a
 * route reads, with each list's length in case one grew in place; when any of
 * it changes, or the start's free areas do, the entry starts afresh.
 */
const areaAccessCache = new WeakMap<readonly string[], {
  inputs: readonly unknown[];
  byArea: Map<string, AreaAccess>;
}>();

const areaAccessInputs = (unlocks: UnlockState, gameModeId: string | undefined): readonly unknown[] => {
  const lists = [
    unlocks.regions, unlocks.chunks, unlocks.banks, unlocks.mobility, unlocks.arcana, unlocks.merchants,
    unlocks.minigames, unlocks.quests, unlocks.diaries,
  ];
  return [
    gameModeId, getFreeAreas().join('\n'), (unlocks.cas ?? []).join('\n'),
    unlocks.skills, unlocks.levels, unlocks.equipment,
    ...lists, ...lists.map(list => list?.length),
  ];
};

/**
 * Can the player get onto an area they own? Islands and enclaves listed in
 * data/areaAccess.ts need one of their routes; any other owned area is
 * reachable, as is everything in Chunked mode, whose chunk reach models
 * travel itself. A route that manual checks alone keep closed, such as a
 * clue teleport scroll, leaves the area to confirm. `visited` holds the areas
 * already being resolved, so a route that loops back never counts.
 */
const areaAccess = (
  area: string,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  visited: ReadonlySet<string>,
): AreaAccess => {
  if (gameModeId === 'chunked') return OPEN_ACCESS;
  const canonical = canonicalAreaName(area);
  if (!AREA_ENTRY_ROUTES[canonical]?.length) return OPEN_ACCESS;
  // Only a top-level answer is the same for every task that asks.
  if (visited.size > 0 || !unlocks.regions) return resolveAreaAccess(canonical, unlocks, gameModeId, visited);
  const inputs = areaAccessInputs(unlocks, gameModeId);
  let entry = areaAccessCache.get(unlocks.regions);
  if (!entry || entry.inputs.some((input, index) => input !== inputs[index])) {
    entry = { inputs, byArea: new Map() };
    areaAccessCache.set(unlocks.regions, entry);
  }
  let access = entry.byArea.get(canonical);
  if (!access) {
    access = resolveAreaAccess(canonical, unlocks, gameModeId, visited);
    entry.byArea.set(canonical, access);
  }
  return access;
};

const resolveAreaAccess = (
  area: string,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  visited: ReadonlySet<string>,
): AreaAccess => {
  if (gameModeId === 'chunked') return OPEN_ACCESS;
  const canonical = canonicalAreaName(area);
  const routes = AREA_ENTRY_ROUTES[canonical];
  if (!routes?.length) return OPEN_ACCESS;
  const label = `Travel to ${canonical}`;
  if (visited.has(canonical)) {
    return { state: 'blocked', blocker: { kind: 'alternative', label, travel: canonical, blockerKinds: [], routes: [] } };
  }
  const inner = new Set(visited).add(canonical);
  const results = routes.map(route => evaluateDiaryRequirement(route, unlocks, gameModeId, inner));
  if (results.some(result => result.eligible)) return OPEN_ACCESS;
  const confirmable = results.find(result => result.confirmable);
  if (confirmable) return { state: 'confirm', manualChecks: confirmable.manualChecks };
  const travelRoutes = routes.flatMap((route, index) => (
    expandRoute(route.label, results[index].blockers).map(expanded => ({ ...expanded, travel: canonical }))
  ));
  return {
    state: 'blocked',
    blocker: { kind: 'alternative', label, travel: canonical, blockerKinds: blockerKindsOf(travelRoutes), routes: travelRoutes },
  };
};

/** An owned area or place that no route reaches yet: a trip problem, like an island. */
const noRouteBlocker = (place: string): AlternativeBlocker => ({
  kind: 'alternative', label: `No route to ${place}`, travel: place, blockerKinds: [], routes: [],
});

function evaluateDiaryRequirement(
  requirement: Omit<DoableTask, 'id' | 'oneOf'>,
  unlocks: UnlockState,
  gameModeId?: string,
  visited: ReadonlySet<string> = NO_AREAS,
  areaRoutes?: AreaRoutes | null,
): DiaryTaskEligibility {
  const blockers: EligibilityBlocker[] = [];
  // Items are never assumed to be in the player's bank: like Sheep Shearer's
  // wool, each one is a one-tap confirmation before completion.
  const evidence: string[] = [];
  const equipmentChecks: string[] = [];
  const travelChecks: string[] = [];

  for (const merchant of requirement.merchants ?? []) {
    if (unlocks.merchants?.includes(merchant)) evidence.push(merchant);
    else blockers.push({ kind: 'merchant', label: merchant });
  }

  for (const arcana of requirement.arcana ?? []) {
    if (unlocks.arcana?.includes(arcana)) evidence.push(arcana);
    else blockers.push({ kind: 'arcana', label: arcana });
  }
  for (const mobility of requirement.mobility ?? []) {
    if (unlocks.mobility?.includes(mobility)) evidence.push(mobility);
    else blockers.push({ kind: 'mobility', label: mobility });
  }
  // A task played inside a minigame needs that minigame unlocked.
  for (const minigame of requirement.minigames ?? []) {
    if (unlocks.minigames?.includes(minigame)) evidence.push(minigame);
    else blockers.push({ kind: 'minigame', label: minigame });
  }
  // A task that means fighting a boss needs that boss unlocked.
  for (const boss of requirement.bosses ?? []) {
    if (unlocks.bosses?.includes(boss)) evidence.push(boss);
    else blockers.push({ kind: 'boss', label: boss });
  }
  for (const item of requirement.equipmentRequirements ?? []) {
    if (item.unlessDiary && unlocks.diaries.includes(item.unlessDiary)) {
      evidence.push(`${item.reason}: ${item.unlessDiary} reward`);
      continue;
    }
    if (item.manualCheck) equipmentChecks.push(item.manualCheck);
    const label = `${item.slot} T${item.tier}: ${item.reason}`;
    const tier = unlocks.equipment?.[item.slot] ?? 0;
    if (Number.isFinite(tier) && tier >= item.tier) evidence.push(label);
    else blockers.push({ kind: 'equipment', slot: item.slot, tier: item.tier, label });
  }

  for (const [skill, required] of Object.entries(requirement.skills ?? {})) {
    const label = skill + ' ' + required;
    if (meetsSkillRequirement(unlocks, skill, required)) evidence.push(label);
    else blockers.push({
      kind: 'skill', label,
      requirement: { type: 'single', skill, level: required },
    });
  }
  for (const quest of withSkillGateQuests(requirement.quests, requirement.skills)) {
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
    if (!isAreaReachable(region, unlocks, gameModeId)) {
      blockers.push({ kind: 'region', label: region });
      continue;
    }
    // Owning an island or enclave is not the same as being able to get there.
    const access = areaAccess(region, unlocks, gameModeId, visited);
    if (access.state === 'blocked') {
      blockers.push(access.blocker);
      continue;
    }
    // Owned, but the map finds no way there from the rest of the run.
    if (areaRoutes?.strandedAreas.has(canonicalAreaName(region))) {
      blockers.push(noRouteBlocker(canonicalAreaName(region)));
      continue;
    }
    evidence.push(region);
    if (access.state === 'confirm') travelChecks.push(...access.manualChecks);
  }
  for (const location of requirement.locations ?? []) {
    const owned = location.chunkOptions.filter(({ cx, cy }) => chunkUnlocked(cx, cy, unlocks, gameModeId));
    if (owned.some(({ cx, cy }) => !areaRoutes?.strandedChunks.has(`${cx},${cy}`))) evidence.push(location.label);
    else if (owned.length) blockers.push(noRouteBlocker(location.label));
    else blockers.push({
      kind: 'alternative', label: location.label, blockerKinds: ['region'],
      routes: location.chunkOptions.map(({ cx, cy }) => {
        const place = placeOf(cx, cy);
        const remaining = chunkUnlockRequirement(cx, cy, unlocks, gameModeId).remaining;
        const areas = remaining.length ? remaining : [place.subArea ?? place.region ?? location.label];
        return {
          label: `${place.label} (${cx}, ${cy})`,
          blockers: gameModeId === 'chunked'
            ? [{ kind: 'region' as const, label: `Chunk ${cx}, ${cy}`, chunk: { cx, cy } }]
            : areas.map(label => ({ kind: 'region' as const, label })),
        };
      }),
    });
  }
  if (requirement.anyOfRegions?.length) {
    // Any one area that is both owned and reachable will do.
    const owned = requirement.anyOfRegions
      .filter(region => isAreaReachable(region, unlocks, gameModeId))
      .map(region => ({
        region,
        access: areaRoutes?.strandedAreas.has(canonicalAreaName(region))
          ? { state: 'blocked' as const, blocker: noRouteBlocker(canonicalAreaName(region)) }
          : areaAccess(region, unlocks, gameModeId, visited),
      }));
    const reachable = owned.find(({ access }) => access.state === 'open')
      ?? owned.find(({ access }) => access.state === 'confirm');
    if (reachable) {
      evidence.push(reachable.region);
      if (reachable.access.state === 'confirm') travelChecks.push(...reachable.access.manualChecks);
    } else {
      const access = new Map(owned.map(({ region, access: result }) => [region, result]));
      const routes = requirement.anyOfRegions.flatMap((region): AlternativeEligibilityRoute[] => {
        const result = access.get(region);
        if (result?.state !== 'blocked') return [{ label: region, blockers: [{ kind: 'region', label: region }] }];
        // Owned but out of reach: each way there is a way to meet the task.
        return result.blocker.routes.map(route => ({ ...route, label: `${region}: ${route.label}` }));
      });
      blockers.push({
        kind: 'alternative',
        label: requirement.anyOfRegions.join(' or '),
        blockerKinds: blockerKindsOf(routes),
        routes,
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

  const manual = readinessFields(blockers, [
    ...(requirement.manualRequirements ?? []),
    ...(requirement.items ?? []),
    ...equipmentChecks,
    ...pendingQuestProgress(requirement.questProgress, unlocks.quests),
    ...travelChecks,
  ]);
  return { ...manual, blockers, evidence };
}

/**
 * Whether a diary task can be done now. Pass `areaRoutes` (from useAreaRoutes)
 * to treat owned areas that no route reaches as out of reach; without it,
 * owning an area is enough, as before.
 */
export function evaluateDiaryTaskEligibility(
  task: DoableTask,
  unlocks: UnlockState,
  gameModeId?: string,
  areaRoutes?: AreaRoutes | null,
): DiaryTaskEligibility {
  const shared = evaluateDiaryRequirement(task, unlocks, gameModeId, NO_AREAS, areaRoutes);
  if (!task.oneOf?.length) return shared;

  const routeResults = task.oneOf.map(option => (
    evaluateDiaryRequirement(option, unlocks, gameModeId, NO_AREAS, areaRoutes)
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

  const routes: AlternativeEligibilityRoute[] = task.oneOf.flatMap((option, index) => {
    const label = diaryRequirementOptionLabel(option);
    const optionBlockers = routeResults[index].blockers;
    // An option on an out-of-reach island lists each way there instead.
    return optionBlockers.some(isTravelBlocker)
      ? expandRoute(label, optionBlockers)
      : [{ label, blockers: optionBlockers as DirectEligibilityBlocker[] }];
  });
  const alternativeLabel = task.oneOf.map(diaryRequirementOptionLabel).join(' or ');
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

export interface DiaryTierEligibility extends ManualEligibility {
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
  areaRoutes?: AreaRoutes | null,
): DiaryTierEligibility {
  if (unlocks.diaries.includes(diary.id)) {
    return { ...readinessFields([], []), status: 'COMPLETED', blockers: [], evidence: ['Completed'] };
  }

  const normalizedUnlocks: UnlockState = {
    ...unlocks,
    cas: unlocks.cas ?? [],
    completedTasks: unlocks.completedTasks ?? [],
  };
  const taskResults = ALL_DIARY_TASKS
    .filter(task => task.tierId === diary.id && !normalizedUnlocks.completedTasks.includes(task.id))
    .map(task => evaluateDiaryTaskEligibility(task, normalizedUnlocks, gameModeId, areaRoutes));
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
  // Getting onto an owned island is an area problem, never a quest lock.
  const alternativesRequireRegion = alternatives.some(alternative => (
    alternative.travel !== undefined
    || alternative.routes.every(route => (
      route.travel !== undefined || route.blockers.some(blocker => blocker.kind === 'region')
    ))
  ));
  const status: DiaryStatus = blockers.some(blocker => blocker.kind === 'region')
    || alternativesRequireRegion
    ? 'LOCKED_REGION'
    : blockers.some(blocker => blocker.kind === 'skill' || blocker.kind === 'combat')
      || alternativeHasSkillRoute
      ? 'LOCKED_SKILL'
      : blockers.some(blocker => blocker.kind === 'equipment')
        ? 'LOCKED_EQUIPMENT'
      : blockers.some(blocker => blocker.kind === 'mobility')
        ? 'LOCKED_MOBILITY'
      : blockers.some(blocker => blocker.kind === 'arcana')
        ? 'LOCKED_ARCANA'
      : blockers.some(blocker => blocker.kind === 'merchant')
        ? 'LOCKED_MERCHANT'
      : blockers.some(blocker => blocker.kind === 'minigame')
        ? 'LOCKED_MINIGAME'
      : blockers.some(blocker => blocker.kind === 'boss')
        ? 'LOCKED_BOSS'
      : blockers.some(blocker => blocker.kind === 'quest' || blocker.kind === 'alternative')
        ? 'LOCKED_QUEST'
        : 'AVAILABLE';

  return { ...readinessFields(blockers, taskResults.flatMap(result => result.manualChecks)), status, blockers, evidence };
}

export function getDiaryStatus(
  diary: DiaryTier,
  unlocks: DiaryStatusUnlocks,
  gameModeId?: string,
  areaRoutes?: AreaRoutes | null,
): DiaryStatus {
  return evaluateDiaryTierEligibility(diary, unlocks, gameModeId, areaRoutes).status;
}

export function countDoableTasks(
  tasks: DoableTask[],
  unlocks: UnlockState,
  gameModeId?: string,
  areaRoutes?: AreaRoutes | null,
): number {
  return tasks.filter(task => {
    if (unlocks.completedTasks.includes(task.id)) return false;
    return evaluateDiaryTaskEligibility(task, unlocks, gameModeId, areaRoutes).eligible;
  }).length;
}

export function countDoableDiaryTasks(
  tasks: DoableDiaryTask[],
  unlocks: UnlockState,
  gameModeId?: string,
  areaRoutes?: AreaRoutes | null,
): number {
  const incompleteTiers = tasks.filter(task => !unlocks.diaries.includes(task.tierId));
  return countDoableTasks(incompleteTiers, unlocks, gameModeId, areaRoutes);
}
