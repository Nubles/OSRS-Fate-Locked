/**
 * Quest Impact Advisor
 *
 * For every AVAILABLE quest, computes how many currently-locked quests + diary
 * tiers completing it would open up — both DIRECTLY (one step) and across the
 * full downstream CASCADE (the whole prereq chain it unblocks). Quests are
 * ranked by cascade score so the highest long-term-value targets rise to the
 * top, even when their immediate payoff looks small.
 *
 * Pure function — no side-effects, no React, safe to call inside useMemo.
 */

import { QUEST_DATA } from '../data/questData';
import { getQuestStatus } from './journalStatus';
import { computeUnlockImpact } from './unlockImpact';

export interface RankedQuest {
  id: string;
  name: string;
  points: number;
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
 * Returns all AVAILABLE quests ranked by cascade impact (highest first).
 * Ties broken by direct score, then alphabetically.
 *
 * @param unlocks  Current unlocks snapshot (same shape as GameContext unlocks)
 */
export function rankAvailableQuests(unlocks: any): RankedQuest[] {
  const allQuests = Object.values(QUEST_DATA);
  const available = allQuests.filter((q) => getQuestStatus(q, unlocks) === 'AVAILABLE');

  return available
    .map((candidate): RankedQuest => {
      const simulated = { ...unlocks, quests: [...unlocks.quests, candidate.id] };
      const impact = computeUnlockImpact(unlocks, simulated);

      return {
        id: candidate.id,
        name: candidate.name,
        points: candidate.points,
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
        a.name.localeCompare(b.name),
    );
}
