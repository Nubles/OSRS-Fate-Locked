/**
 * Quest Impact Advisor
 *
 * For every quest with known gates met, computes how many currently-locked quests + diary
 * tiers completing it would open up — both DIRECTLY (one step) and across the
 * full downstream CASCADE (the whole prereq chain it unblocks). Quests are
 * ranked by cascade score so the highest long-term-value targets rise to the
 * top, even when their immediate payoff looks small.
 *
 * Pure function — no side-effects, no React, safe to call inside useMemo.
 */

import { canonicalQuestUnlocks } from '../data/questCatalog';
import { QUEST_DATA } from '../data/questData';
import { evaluateQuestEligibility } from './journalStatus';
import { computeUnlockImpact, prepareUnlockImpactContext } from './unlockImpact';

export interface RankedQuest {
  id: string;
  name: string;
  points: number;
  /** Explicit conditions still pending on this candidate. */
  pendingChecks?: string[];
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
 * Returns all known-gate-eligible quest candidates ranked by cascade impact (highest first).
 * Ties broken by direct score, then alphabetically.
 *
 * @param unlocks  Current unlocks snapshot (same shape as GameContext unlocks)
 * @param gameModeId  Active mode used by canonical quest access checks
 */
export function rankAvailableQuests(unlocks: any, gameModeId?: string): RankedQuest[] {
  unlocks = canonicalQuestUnlocks(unlocks);
  const allQuests = Object.values(QUEST_DATA);
  const available = allQuests.filter(
    quest => !unlocks.quests.includes(quest.id)
      && evaluateQuestEligibility(quest, unlocks, gameModeId).machineEligible,
  );

  // Every candidate shares the same baseline; evaluate it once per ranking.
  const context = prepareUnlockImpactContext(unlocks, gameModeId);
  return available
    .map((candidate): RankedQuest => {
      const simulated = { ...unlocks, quests: [...unlocks.quests, candidate.id] };
      const impact = computeUnlockImpact(unlocks, simulated, gameModeId, { includeConditional: true, context });

      return {
        id: candidate.id,
        name: candidate.name,
        points: candidate.points,
        pendingChecks: evaluateQuestEligibility(candidate, unlocks, gameModeId).manualChecks,
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
