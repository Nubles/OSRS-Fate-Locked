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
import { evaluateQuestEligibility, getDiaryStatus } from './journalStatus';

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
   * the whole chain the candidate unblocks). Lets callers inspect or extend
   * the canonical post-cascade eligibility snapshot.
   */
  finalQuestIds: string[];
}

const isOpen = (status: string | undefined) =>
  status === 'AVAILABLE' || status === 'COMPLETED';

export interface UnlockImpactContext {
  allQuests: Array<(typeof QUEST_DATA)[string]>;
  allDiaries: Array<(typeof DIARY_DATA)[string]>;
  /** Canonical machine status by quest id. */
  questStatusById: Map<string, string>;
  /** Compatibility name retained for existing callers. */
  baseQuestStatus: Map<string, string>;
  baseDiaryStatus: Map<string, string>;
  baseAvailableIds: Set<string>;
  baseCompletedQuestIds: Set<string>;
}

export function prepareUnlockImpactContext(
  baseUnlocks: any,
  gameModeId?: string,
): UnlockImpactContext {
  const allQuests = Object.values(QUEST_DATA);
  const allDiaries = Object.values(DIARY_DATA);
  const baseQuestEligibility = new Map(
    allQuests.map(q => [q.id, evaluateQuestEligibility(q, baseUnlocks, gameModeId)]),
  );
  const baseQuestStatus = new Map<string, string>(
    allQuests.map(q => [q.id, baseQuestEligibility.get(q.id)!.status]),
  );
  const baseDiaryStatus = new Map<string, string>(
    allDiaries.map(d => [d.id, getDiaryStatus(d, baseUnlocks, gameModeId)]),
  );
  return {
    allQuests,
    allDiaries,
    questStatusById: baseQuestStatus,
    baseQuestStatus,
    baseDiaryStatus,
    baseCompletedQuestIds: new Set(
      allQuests.filter(q => baseQuestStatus.get(q.id) === 'COMPLETED').map(q => q.id),
    ),
    baseAvailableIds: new Set(
      allQuests.filter(q => {
        const eligibility = baseQuestEligibility.get(q.id)!;
        return eligibility.status === 'AVAILABLE' && eligibility.eligible;
      }).map(q => q.id),
    ),
  };
}

export interface UnlockImpactOptions {
  context?: UnlockImpactContext;
  /** Restrict diary evaluation; an empty list skips diary work entirely. */
  diaryIds?: readonly string[];
}

/**
 * @param baseUnlocks       Current unlocks snapshot (the "before").
 * @param simulatedUnlocks  base + exactly one change already applied
 *                          (a quest added to `quests`, or a region added to
 *                          `regions`).  Everything else must be identical.
 */
export function computeUnlockImpact(
  baseUnlocks: any,
  simulatedUnlocks: any,
  gameModeId?: string,
  options: UnlockImpactOptions = {},
): UnlockImpact {
  const context = options.context ?? prepareUnlockImpactContext(baseUnlocks, gameModeId);
  const {
    allQuests, baseCompletedQuestIds, baseDiaryStatus, baseAvailableIds,
  } = context;
  const selectedDiaryIds = options.diaryIds === undefined
    ? null
    : new Set(options.diaryIds);
  const allDiaries = selectedDiaryIds === null
    ? context.allDiaries
    : context.allDiaries.filter(diary => selectedDiaryIds.has(diary.id));

  const directQuestNames = allQuests
    .filter(q => {
      if (baseCompletedQuestIds.has(q.id) || baseAvailableIds.has(q.id)) return false;
      const eligibility = evaluateQuestEligibility(q, simulatedUnlocks, gameModeId);
      return eligibility.status === 'AVAILABLE' && eligibility.eligible;
    })
    .map((q) => q.name);

  const directDiaryIds = allDiaries
    .filter(
      (d) =>
        !isOpen(baseDiaryStatus.get(d.id)) &&
        getDiaryStatus(d, simulatedUnlocks, gameModeId) === 'AVAILABLE',
    )
    .map((d) => d.id);

  // ── CASCADE (fixpoint) ───────────────────────────────────────────────────
  // Seed the completed set with whatever the simulation already "did".
  // Greedily complete only quests the canonical eligibility evaluator says are automatic.
  const initialCompletedQuestIds = new Set<string>(simulatedUnlocks.quests);
  const completed = new Set(initialCompletedQuestIds);
  let changed = true;
  while (changed) {
    changed = false;
    const snap = { ...simulatedUnlocks, quests: Array.from(completed) };
    for (const q of allQuests) {
      if (completed.has(q.id)) continue;
      if (baseCompletedQuestIds.has(q.id)) continue;
      if (baseAvailableIds.has(q.id)) continue; // don't claim the existing automatic backlog
      const eligibility = evaluateQuestEligibility(q, snap, gameModeId);
      if (eligibility.status === 'AVAILABLE' && eligibility.eligible) {
        completed.add(q.id);
        changed = true;
      }
    }
  }
  const finalSnap = { ...simulatedUnlocks, quests: Array.from(completed) };

  const cascadeQuestNames = allQuests
    .filter((q) => (
      !baseCompletedQuestIds.has(q.id) &&
      !baseAvailableIds.has(q.id) &&
      !initialCompletedQuestIds.has(q.id) &&
      completed.has(q.id)
    ))
    .map((q) => q.name);

  const cascadeDiaryIds = allDiaries
    .filter(
      (d) =>
        !isOpen(baseDiaryStatus.get(d.id)) &&
        getDiaryStatus(d, finalSnap, gameModeId) === 'AVAILABLE',
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
