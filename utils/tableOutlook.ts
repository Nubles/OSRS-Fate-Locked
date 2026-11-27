import { TableType, type UnlockState } from '../types';
import type { GameModeRules } from '../config/gameModes';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { BANK_BY_ID } from '../data/banks';
import { randomUnlockPool } from './gameEngine';
import { evaluateActivityReadiness } from './activityReadiness';
import { getUtilityActivityReq } from './utilityReadiness';
import { evaluateDiaryTaskEligibility, evaluateQuestEligibility, type EligibilityBlocker } from './journalStatus';
import { chunkUnlocked } from './chunkLocations';
import type { TableOutlook } from './tableOutlookText';
import type { AreaRoutes } from './areaRoutes';

/**
 * Spend Keys' table outlook: of the entries a Key on a table can draw right
 * now, how many the player could use straight away. A Key still draws from
 * the whole table, reachable or not (fate picks); this only shows the odds.
 *
 * - Bosses, minigames and guilds: ready if drawn (the Activities tab's Ready).
 * - Banks: the bank stands in land the run already owns.
 * - Areas (Vanilla): owning it makes a quest or a diary task doable at once.
 * Other tables have no outlook.
 *
 * Each answer asks the same area routes as the Quest Log and the Activities
 * tab (hooks/useAreaRoutes.ts), so an owned area no route reaches counts for
 * nothing. Left out (routes not loaded), owning an area is enough.
 */
export type { OutlookKind, TableOutlook } from './tableOutlookText';

/** The run's area routes, and those of a snapshot with one more area: useAreaRoutesState's routes and routesFor. */
export interface OutlookRoutes {
  routes?: AreaRoutes | null;
  routesFor?: ((snapshot: UnlockState) => AreaRoutes | null) | null;
}

export const OUTLOOK_TABLES: readonly TableType[] = [
  TableType.BOSSES, TableType.MINIGAMES, TableType.GUILDS, TableType.BANKS, TableType.REGIONS,
];

const EXAMPLES = 3;

const poolItems = (table: TableType, unlocks: UnlockState, gameModeId?: string, customMode?: GameModeRules): string[] =>
  randomUnlockPool(unlocks, gameModeId, 'key', table, customMode).map(candidate => candidate.item);

/** Bosses, minigames and guilds: entries that would be Ready the moment they were drawn. */
export const activityOutlook = (
  table: TableType.BOSSES | TableType.MINIGAMES | TableType.GUILDS,
  unlocks: UnlockState,
  gameModeId?: string,
  customMode?: GameModeRules,
  routing?: OutlookRoutes,
): TableOutlook => {
  const items = poolItems(table, unlocks, gameModeId, customMode);
  const ready = items.filter(item => evaluateActivityReadiness(
    true, getUtilityActivityReq(item, table, gameModeId), unlocks, gameModeId, routing?.routes,
  ).status === 'READY');
  return { table, kind: 'ready', left: items.length, useful: ready.length, examples: ready.slice(0, EXAMPLES) };
};

/** Banks: physical banks (chunk id cx*256+cy) standing in land the run owns. */
export const bankOutlook = (unlocks: UnlockState, gameModeId?: string, customMode?: GameModeRules): TableOutlook => {
  const items = poolItems(TableType.BANKS, unlocks, gameModeId, customMode);
  const inLand = items.filter(id => {
    const n = Number(id);
    return Number.isInteger(n) && chunkUnlocked(Math.floor(n / 256), n % 256, unlocks, gameModeId);
  });
  return {
    table: TableType.BANKS, kind: 'owned-land', left: items.length, useful: inLand.length,
    examples: inLand.slice(0, EXAMPLES).map(id => BANK_BY_ID[id]?.name ?? id),
  };
};

/** Every area a blocker names: its own label, a choice of departures, a location's areas, a route's. */
const blockerAreas = (blocker: EligibilityBlocker, into: Set<string>): void => {
  if (blocker.kind === 'region') {
    into.add(blocker.label);
    blocker.anyOf?.forEach(area => into.add(area));
    blocker.location?.areas.forEach(area => into.add(area));
    return;
  }
  if (blocker.kind === 'alternative') {
    if (blocker.travel) into.add(blocker.travel);
    for (const route of blocker.routes) {
      if (route.travel) into.add(route.travel);
      route.blockers.forEach(inner => blockerAreas(inner, into));
    }
  }
};

/** True when land is all that stands in the way: only area blockers, or routes that are only about land. */
const onlyLand = (blockers: readonly EligibilityBlocker[]): boolean =>
  blockers.length > 0 && blockers.every(blocker => blocker.kind === 'region' || (
    blocker.kind === 'alternative'
    && blocker.routes.some(route => route.travel !== undefined || route.blockers.every(inner => inner.kind === 'region'))
  ));

export interface AreaOpens { area: string; quests: string[]; tasks: number }

/**
 * Areas (Vanilla and the other area modes): which drawable areas would make a
 * quest or a diary task doable the moment they were owned. Only quests and
 * tasks held back by land alone are tried, and only against the areas their
 * blockers name, so this stays cheap enough to run after every change.
 *
 * With routes, a quest or task counts only if a route reaches it once the
 * area is owned, as the Quest Log would say after the draw. An area that only
 * gives a route to land the run owns already is not counted: the outlook
 * would rather say too little than promise what the Quest Log then denies.
 */
export const areaOpens = (
  unlocks: UnlockState,
  gameModeId?: string,
  customMode?: GameModeRules,
  routing?: OutlookRoutes,
): { left: number; opens: AreaOpens[] } => {
  // Routing each candidate area makes this the slow sum, so one answer is
  // kept per snapshot: a hope edit or reopening Spend Keys reuses it.
  const key = `${gameModeId ?? ''}|${routing?.routes ? 1 : 0}${routing?.routesFor ? 1 : 0}`;
  const cached = opensCache.get(unlocks);
  if (cached && cached.key === key && cached.customMode === customMode) return cached.result;
  const result = computeAreaOpens(unlocks, gameModeId, customMode, routing);
  opensCache.set(unlocks, { key, customMode, result });
  return result;
};

type Opens = { left: number; opens: AreaOpens[] };
const opensCache = new WeakMap<UnlockState, { key: string; customMode?: GameModeRules; result: Opens }>();

const computeAreaOpens = (
  unlocks: UnlockState,
  gameModeId?: string,
  customMode?: GameModeRules,
  routing?: OutlookRoutes,
): Opens => {
  const pool = poolItems(TableType.REGIONS, unlocks, gameModeId, customMode);
  const drawable = new Set(pool);
  const questsByArea = new Map<string, string[]>();
  const tasksByArea = new Map<string, number>();
  const nowRoutes = routing?.routes ?? null;
  const routesFor = routing?.routesFor ?? null;
  // Routing the map is the slow part: once per area, and only for an area
  // that opens something before its routes are asked.
  const after = new Map<string, { unlocks: UnlockState; routes?: AreaRoutes | null }>();
  const snapshot = (area: string) => {
    let entry = after.get(area);
    if (!entry) after.set(area, entry = { unlocks: { ...unlocks, regions: [...unlocks.regions, area] } });
    return entry;
  };
  const routesAfter = (area: string): AreaRoutes | null => {
    const entry = snapshot(area);
    if (entry.routes === undefined) entry.routes = routesFor ? routesFor(entry.unlocks) : null;
    return entry.routes;
  };

  const quests = Object.values(QUEST_DATA).filter(quest => !unlocks.quests.includes(quest.id));
  for (const quest of quests) {
    const now = evaluateQuestEligibility(quest, unlocks, gameModeId, nowRoutes);
    if (now.status === 'AVAILABLE' || !onlyLand(now.blockers)) continue;
    const named = new Set<string>();
    now.blockers.forEach(blocker => blockerAreas(blocker, named));
    for (const area of named) {
      if (!drawable.has(area)) continue;
      const opens = (routes?: AreaRoutes | null) =>
        evaluateQuestEligibility(quest, snapshot(area).unlocks, gameModeId, routes).status === 'AVAILABLE';
      if (opens() && (!routesFor || opens(routesAfter(area)))) questsByArea.set(area, [...(questsByArea.get(area) ?? []), quest.name]);
    }
  }

  const done = new Set(unlocks.completedTasks ?? []);
  for (const task of ALL_DIARY_TASKS) {
    if (done.has(task.id)) continue;
    const now = evaluateDiaryTaskEligibility(task, unlocks, gameModeId, nowRoutes);
    if (now.machineEligible || !onlyLand(now.blockers)) continue;
    const named = new Set<string>();
    now.blockers.forEach(blocker => blockerAreas(blocker, named));
    for (const area of named) {
      if (!drawable.has(area)) continue;
      const opens = (routes?: AreaRoutes | null) =>
        evaluateDiaryTaskEligibility(task, snapshot(area).unlocks, gameModeId, routes).machineEligible;
      if (opens() && (!routesFor || opens(routesAfter(area)))) tasksByArea.set(area, (tasksByArea.get(area) ?? 0) + 1);
    }
  }

  const areas = new Set([...questsByArea.keys(), ...tasksByArea.keys()]);
  const opens = [...areas].map(area => ({ area, quests: questsByArea.get(area) ?? [], tasks: tasksByArea.get(area) ?? 0 }))
    .sort((a, b) => (b.quests.length * 2 + b.tasks) - (a.quests.length * 2 + a.tasks) || a.area.localeCompare(b.area));
  return { left: pool.length, opens };
};

export const areaOutlook = (
  unlocks: UnlockState,
  gameModeId?: string,
  customMode?: GameModeRules,
  routing?: OutlookRoutes,
): TableOutlook => {
  const { left, opens } = areaOpens(unlocks, gameModeId, customMode, routing);
  return { table: TableType.REGIONS, kind: 'opens', left, useful: opens.length, examples: opens.slice(0, EXAMPLES).map(o => o.area) };
};

/** The outlook for one table, or null when it has none (or in Chunked, for Areas). */
export const tableOutlook = (
  table: TableType,
  unlocks: UnlockState,
  gameModeId?: string,
  customMode?: GameModeRules,
  routing?: OutlookRoutes,
): TableOutlook | null => {
  switch (table) {
    case TableType.BOSSES:
    case TableType.MINIGAMES:
    case TableType.GUILDS:
      return activityOutlook(table, unlocks, gameModeId, customMode, routing);
    case TableType.BANKS:
      return bankOutlook(unlocks, gameModeId, customMode);
    case TableType.REGIONS:
      return gameModeId === 'chunked' ? null : areaOutlook(unlocks, gameModeId, customMode, routing);
    default:
      return null;
  }
};
