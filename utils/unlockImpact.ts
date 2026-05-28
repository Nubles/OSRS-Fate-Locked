/**
 * Shared unlock-impact engine for the Quest & Region advisors.
 *
 * Given a "before" snapshot and an "after" snapshot (base + one simulated
 * change — a completed quest OR an unlocked region), it computes two things:
 *
 *   • DIRECT  — what goes LOCKED → AVAILABLE in a single step.
 *   • CASCADE — the full downstream chain: if you complete the candidate and
 *               then greedily complete every quest it newly unblocks (and what
 *               those unblock, recursively), how much opens up in total?
 *
 * The cascade walk follows ONLY the prereq chain rooted at the simulated
 * change — quests that were already AVAILABLE in the base state (independent
 * of the candidate) are NOT auto-completed, so the numbers are attributed to
 * the candidate rather than the player's existing backlog.
 *
 * Pure & side-effect-free — safe inside useMemo.
 */

import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { getQuestStatus, getDiaryStatus } from './journalStatus';

export interface UnlockImpact {
  /** Quests LOCKED → AVAILABLE in one step. */
  directQuestNames: string[];
  /** Diary tiers LOCKED → AVAILABLE in one step. */
  directDiaryIds: string[];
  /** Quests LOCKED → reachable through the full prereq chain (includes direct). */
  cascadeQuestNames: string[];
  /** Diary tiers reachable once the full chain is complete (includes direct). */
  cascadeDiaryIds: string[];
  /** directQuests×2 + directDiaries — the immediate payoff. */
  directScore: number;
  /** cascadeQuests×2 + cascadeDiaries — the full downstream potential. */
  cascadeScore: number;
  /**
   * Every quest id completed in the final cascade snapshot (base completions +
   * the whole chain the candidate unblocks). Lets callers run their own
   * skill-aware diary checks, which `getDiaryStatus` deliberately skips.
   */
  finalQuestIds: string[];
}

const isOpen = (status: string | undefined) =>
  status === 'AVAILABLE' || status === 'COMPLETED';

/**
 * @param baseUnlocks       Current unlocks snapshot (the "before").
 * @param simulatedUnlocks  base + exactly one change already applied
 *                          (a quest added to `quests`, or a region added to
 *                          `regions`).  Everything else must be identical.
 */
export function computeUnlockImpact(
  baseUnlocks: any,
  simulatedUnlocks: any,
): UnlockImpact {
  const allQuests = Object.values(QUEST_DATA);
  const allDiaries = Object.values(DIARY_DATA);

  // Baseline statuses — computed once.
  const baseQuestStatus = new Map<string, string>(
    allQuests.map((q) => [q.id, getQuestStatus(q, baseUnlocks)]),
  );
  const baseDiaryStatus = new Map<string, string>(
    allDiaries.map((d) => [d.id, getDiaryStatus(d, baseUnlocks)]),
  );

  // Quests that were already actionable independent of the candidate — these
  // are excluded from the cascade walk so impact is attributed correctly.
  const baseAvailableIds = new Set(
    allQuests.filter((q) => baseQuestStatus.get(q.id) === 'AVAILABLE').map((q) => q.id),
  );

  // ── DIRECT (1-step) ──────────────────────────────────────────────────────
  const directQuestNames = allQuests
    .filter(
      (q) =>
        !isOpen(baseQuestStatus.get(q.id)) &&
        getQuestStatus(q, simulatedUnlocks) === 'AVAILABLE',
    )
    .map((q) => q.name);

  const directDiaryIds = allDiaries
    .filter(
      (d) =>
        !isOpen(baseDiaryStatus.get(d.id)) &&
        getDiaryStatus(d, simulatedUnlocks) === 'AVAILABLE',
    )
    .map((d) => d.id);

  // ── CASCADE (fixpoint) ───────────────────────────────────────────────────
  // Seed the completed set with whatever the simulation already "did".
  // Greedily complete only previously-LOCKED quests that the chain unblocks.
  const completed = new Set<string>(simulatedUnlocks.quests);
  let changed = true;
  while (changed) {
    changed = false;
    const snap = { ...simulatedUnlocks, quests: Array.from(completed) };
    for (const q of allQuests) {
      if (completed.has(q.id)) continue;
      if (baseAvailableIds.has(q.id)) continue; // don't claim the existing backlog
      if (getQuestStatus(q, snap) === 'AVAILABLE') {
        completed.add(q.id);
        changed = true;
      }
    }
  }
  const finalSnap = { ...simulatedUnlocks, quests: Array.from(completed) };

  const cascadeQuestNames = allQuests
    .filter((q) => !isOpen(baseQuestStatus.get(q.id)) && completed.has(q.id))
    .map((q) => q.name);

  const cascadeDiaryIds = allDiaries
    .filter(
      (d) =>
        !isOpen(baseDiaryStatus.get(d.id)) &&
        getDiaryStatus(d, finalSnap) === 'AVAILABLE',
    )
    .map((d) => d.id);

  const directScore = directQuestNames.length * 2 + directDiaryIds.length;
  const cascadeScore = cascadeQuestNames.length * 2 + cascadeDiaryIds.length;

  return {
    directQuestNames,
    directDiaryIds,
    cascadeQuestNames,
    cascadeDiaryIds,
    directScore,
    cascadeScore,
    finalQuestIds: Array.from(completed),
  };
}
