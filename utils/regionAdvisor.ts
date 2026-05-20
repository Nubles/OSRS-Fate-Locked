/**
 * Region Unlock Advisor
 *
 * For every region the player has NOT yet unlocked, simulates unlocking it
 * and counts how many currently-locked quests + diary tiers would become
 * AVAILABLE as a direct result.  Score = questsUnlocked×2 + diaryTiersUnlocked.
 *
 * Pure function — no side-effects, no React, safe to call inside useMemo.
 */

import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { getQuestStatus, getDiaryStatus } from './journalStatus';
import { REGION_GROUPS } from '../data/items';

/** All unlock-able region names (the continent keys, not sub-area strings). */
export const UNLOCKABLE_REGIONS = Object.keys(REGION_GROUPS);

export interface RankedRegion {
  id: string;
  /** Quests that go LOCKED → AVAILABLE after this region is unlocked. */
  newQuestNames: string[];
  /** Diary tier IDs that go LOCKED → AVAILABLE after this region is unlocked. */
  newDiaryIds: string[];
  /** Composite score: questsUnlocked×2 + diaryTiersUnlocked */
  score: number;
}

/**
 * Returns all locked regions ranked by unlock impact (highest score first).
 * Ties are broken alphabetically.
 *
 * @param unlocks  Current unlocks snapshot (same shape as GameContext unlocks)
 */
export function rankLockedRegions(unlocks: any): RankedRegion[] {
  const allQuests = Object.values(QUEST_DATA);
  const allDiaries = Object.values(DIARY_DATA);

  // Pre-compute current status once — O(n) baseline.
  const currentQuestStatus = new Map<string, string>(
    allQuests.map((q) => [q.id, getQuestStatus(q, unlocks)]),
  );
  const currentDiaryStatus = new Map<string, string>(
    allDiaries.map((d) => [d.id, getDiaryStatus(d, unlocks)]),
  );

  // Only consider regions not yet unlocked (and not Misthalin which is free).
  const locked = UNLOCKABLE_REGIONS.filter(
    (r) => !unlocks.regions.includes(r),
  );

  return locked
    .map((region): RankedRegion => {
      const simulatedUnlocks = {
        ...unlocks,
        regions: [...unlocks.regions, region],
      };

      const newQuestNames = allQuests
        .filter((q) => {
          if (currentQuestStatus.get(q.id) === 'AVAILABLE') return false;
          if (currentQuestStatus.get(q.id) === 'COMPLETED') return false;
          return getQuestStatus(q, simulatedUnlocks) === 'AVAILABLE';
        })
        .map((q) => q.name);

      const newDiaryIds = allDiaries
        .filter((d) => {
          if (currentDiaryStatus.get(d.id) === 'AVAILABLE') return false;
          if (currentDiaryStatus.get(d.id) === 'COMPLETED') return false;
          return getDiaryStatus(d, simulatedUnlocks) === 'AVAILABLE';
        })
        .map((d) => d.id);

      const score = newQuestNames.length * 2 + newDiaryIds.length;

      return { id: region, newQuestNames, newDiaryIds, score };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
