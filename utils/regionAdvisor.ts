/**
 * Region Unlock Advisor
 *
 * For every area the Areas table can still roll, computes how many quests +
 * diary tiers unlocking it would open up — both DIRECTLY and across the full
 * downstream CASCADE (the quest chains the area's quests unblock). Areas are
 * ranked by cascade score. Continents are never candidates: nothing unlocks
 * a whole continent at once.
 *
 * Pure function — no side-effects, no React, safe to call inside useMemo.
 */

import { computeUnlockImpact, prepareUnlockImpactContext } from './unlockImpact';
import { REGION_GROUPS } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { canonicalAreaName } from '../data/areaMapPolicy';
import { areaEntryDependencies } from '../data/areaAccess';
import { TableType } from '../types';
import { isAreaReachable } from './reachability';
import { chunkUnlocked } from './chunkLocations';
import { randomUnlockPool } from './gameEngine';
import { evaluateDiaryTierEligibility, evaluateQuestEligibility, type EligibilityBlocker } from './journalStatus';

export interface RankedRegion {
  /** The area to unlock, as the Areas table grants it. */
  id: string;
  /** The continent it belongs to. */
  region: string;
  /** Quests that go LOCKED → AVAILABLE immediately. */
  newQuestNames: string[];
  /** Diary tier IDs that go LOCKED → AVAILABLE immediately. */
  newDiaryIds: string[];
  /** Quests reachable through the full prereq chain (includes direct). */
  cascadeQuestNames: string[];
  /** Diary tiers reachable once the chain is complete (includes direct). */
  cascadeDiaryIds: string[];
  /** Immediate payoff: directQuests×2 + directDiaries. */
  score: number;
  /** Full downstream potential: cascadeQuests×2 + cascadeDiaries. */
  cascadeScore: number;
}

const CONTINENT_OF: Record<string, string> = Object.fromEntries(
  Object.entries(REGION_GROUPS).flatMap(([continent, areas]) => areas.map(area => [canonicalAreaName(area), continent])),
);

/**
 * The area checks each quest's and diary tier's eligibility makes: named
 * areas ("area:Falador") and diary location chunks ("chunk:46,59"). An area
 * unlock can change an entry's status only by opening one of its probes.
 */
type Probe = string;
const questProbes = new Map<string, Probe[]>(Object.values(QUEST_DATA).map(quest => [quest.id, [
  ...new Set([quest, ...(quest.oneOf ?? [])].flatMap(option => [
    ...(option.regions ?? []),
    ...(option.locations ?? []).flatMap(location => location.standardAreas),
  ]).map(area => `area:${area}`)),
]]));
const diaryProbes = new Map<string, Probe[]>();
// An island's departure areas count too: unlocking Port Sarim can open a task
// on the Void Knights' Outpost (data/areaAccess.ts).
const areaProbes = (area: string): Probe[] => {
  const travel = areaEntryDependencies(area);
  return [
    `area:${area}`,
    ...travel.areas.map(departure => `area:${departure}`),
    ...travel.chunks.map(({ cx, cy }) => `chunk:${cx},${cy}`),
  ];
};
for (const task of ALL_DIARY_TASKS) {
  const probes = [
    ...(task.anyOfRegions ?? []).flatMap(areaProbes),
    ...[task, ...(task.oneOf ?? [])].flatMap(option => [
      ...(option.regions ?? []).flatMap(areaProbes),
      ...(option.locations ?? []).flatMap(location => location.chunkOptions.map(({ cx, cy }) => `chunk:${cx},${cy}`)),
    ]),
  ];
  diaryProbes.set(task.tierId, [...new Set([...(diaryProbes.get(task.tierId) ?? []), ...probes])]);
}
const ALL_PROBES = [...new Set([...questProbes.values(), ...diaryProbes.values()].flat())];

const probeOpen = (probe: Probe, unlocks: any, gameModeId?: string): boolean => {
  if (probe.startsWith('area:')) return isAreaReachable(probe.slice(5), unlocks, gameModeId);
  const [cx, cy] = probe.slice(6).split(',').map(Number);
  return chunkUnlocked(cx, cy, unlocks, gameModeId);
};

/** Only a blocker an area unlock could clear: an area, or a choice with an areas-only route. */
const areaBlocker = (blocker: EligibilityBlocker): boolean => blocker.kind === 'region'
  || (blocker.kind === 'alternative' && blocker.routes.some(route => route.blockers.every(inner => inner.kind === 'region')));

/**
 * Returns every area the Areas table can still roll, ranked by cascade impact
 * (highest first). Ties broken by direct score, then alphabetically.
 *
 * @param unlocks  Current unlocks snapshot (same shape as GameContext unlocks)
 */
export function rankLockedRegions(unlocks: any, gameModeId?: string): RankedRegion[] {
  // Chunked mode unlocks one map chunk at a time and has no Areas table, so
  // there is nothing to rank here (the Frontier Advisor covers it).
  if (gameModeId === 'chunked') return [];

  const areas = [...new Set(
    randomUnlockPool(unlocks, gameModeId, 'key', TableType.REGIONS).map(({ item }) => canonicalAreaName(item)),
  )].filter(area => !isAreaReachable(area, unlocks, gameModeId));

  // Simulating every area is slow, and most open nothing. A quest or diary
  // tier can open only if areas alone block it and the area opens one of its
  // probes; when none can, the impact (direct and cascade) is exactly zero.
  const watched = [
    ...Object.values(QUEST_DATA).flatMap(quest => {
      const base = evaluateQuestEligibility(quest, unlocks, gameModeId);
      const open = base.status === 'COMPLETED' || (base.status === 'AVAILABLE' && base.eligible);
      return !open && base.blockers.every(areaBlocker) ? [{
        probes: questProbes.get(quest.id) ?? [],
        opensIn: (simulated: any) => {
          const result = evaluateQuestEligibility(quest, simulated, gameModeId);
          return result.status === 'AVAILABLE' && result.eligible;
        },
      }] : [];
    }),
    ...Object.values(DIARY_DATA).flatMap(diary => {
      const base = evaluateDiaryTierEligibility(diary, unlocks, gameModeId);
      const open = base.status === 'COMPLETED' || (base.status === 'AVAILABLE' && base.eligible);
      return !open && base.blockers.every(areaBlocker) ? [{
        probes: diaryProbes.get(diary.id) ?? [],
        opensIn: (simulated: any) => evaluateDiaryTierEligibility(diary, simulated, gameModeId).eligible,
      }] : [];
    }),
  ];
  const closedProbes = ALL_PROBES.filter(probe => !probeOpen(probe, unlocks, gameModeId));
  // Every simulation starts from the same snapshot, so its statuses are shared.
  let context: ReturnType<typeof prepareUnlockImpactContext> | undefined;

  return areas
    .map((area): RankedRegion => {
      const simulated = { ...unlocks, regions: [...unlocks.regions, area] };
      const opened = new Set(closedProbes.filter(probe => probeOpen(probe, simulated, gameModeId)));
      const opensAny = opened.size > 0 && watched.some(entry => (
        entry.probes.some(probe => opened.has(probe)) && entry.opensIn(simulated)
      ));
      const impact = opensAny
        ? computeUnlockImpact(unlocks, simulated, gameModeId, {
            context: context ??= prepareUnlockImpactContext(unlocks, gameModeId),
          })
        : null;

      return {
        id: area,
        region: CONTINENT_OF[area] ?? area,
        newQuestNames: impact?.directQuestNames ?? [],
        newDiaryIds: impact?.directDiaryIds ?? [],
        cascadeQuestNames: impact?.cascadeQuestNames ?? [],
        cascadeDiaryIds: impact?.cascadeDiaryIds ?? [],
        score: impact?.directScore ?? 0,
        cascadeScore: impact?.cascadeScore ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.cascadeScore - a.cascadeScore ||
        b.score - a.score ||
        a.id.localeCompare(b.id),
    );
}
