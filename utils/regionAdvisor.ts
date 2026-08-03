/**
 * Region Unlock Advisor
 *
 * For every region the player has NOT yet unlocked, computes how many quests +
 * diary tiers unlocking it would open up — both DIRECTLY and across the full
 * downstream CASCADE (the quest chains the region's quests unblock). Regions
 * are ranked by cascade score.
 *
 * Pure function — no side-effects, no React, safe to call inside useMemo.
 */

import { computeUnlockImpact } from './unlockImpact';
import { REGION_GROUPS } from '../data/items';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';

/** All unlock-able region names (the continent keys, not sub-area strings). */
export const UNLOCKABLE_REGIONS = Object.keys(REGION_GROUPS);

export interface RankedRegion {
  id: string;
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

/**
 * Returns all locked regions ranked by cascade impact (highest first).
 * Ties broken by direct score, then alphabetically.
 *
 * @param unlocks  Current unlocks snapshot (same shape as GameContext unlocks)
 */
export function rankLockedRegions(unlocks: any, gameModeId?: string): RankedRegion[] {
  // Chunked mode unlocks one map chunk at a time, not a whole named region in
  // a single roll — "what if I unlocked region X" doesn't translate to a
  // single spend the way it does for every other mode, so there's nothing
  // meaningful to rank here. Short-circuit rather than force a wrong model.
  if (gameModeId === 'chunked') return [];

  const visibleRegions = visibleAreaUnlocks(unlocks.regions);

  const locked = UNLOCKABLE_REGIONS.filter((r) => !visibleRegions.includes(r));

  return locked
    .map((region): RankedRegion => {
      const simulated = { ...unlocks, regions: [...visibleRegions, region] };
      const impact = computeUnlockImpact(unlocks, simulated);

      return {
        id: region,
        newQuestNames: impact.directQuestNames,
        newDiaryIds: impact.directDiaryIds,
        cascadeQuestNames: impact.cascadeQuestNames,
        cascadeDiaryIds: impact.cascadeDiaryIds,
        score: impact.directScore,
        cascadeScore: impact.cascadeScore,
      };
    })
    .sort(
      (a, b) =>
        b.cascadeScore - a.cascadeScore ||
        b.score - a.score ||
        a.id.localeCompare(b.id),
    );
}
