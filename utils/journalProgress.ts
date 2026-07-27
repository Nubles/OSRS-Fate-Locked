/**
 * Journal progress analysis — the unmet requirements of a quest or diary tier,
 * used for "almost there" highlights, the unified next-best-actions feed, and
 * unlock-path checklists. One definition of "what's blocking this" shared by
 * every journal surface.
 *
 * Quest checks delegate to the canonical mode-aware eligibility evaluator so
 * every Journal surface reports the same blockers.
 */
import { QuestData } from '../data/questData';
import { DiaryTier } from '../data/diaryData';
import { UnlockState } from '../types';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import {
  EligibilityBlocker, evaluateDiaryTaskEligibility, evaluateDiaryTierEligibility,
  evaluateQuestEligibility,
} from './journalStatus';

export interface Unmet {
  kind: 'region' | 'skill' | 'quest' | 'qp' | 'alternative' | 'manual';
  label: string;
}

const eligibilityBlockerToUnmet = (blocker: EligibilityBlocker): Unmet => {
  if (blocker.kind === 'combat') {
    return { kind: 'skill', label: blocker.label };
  }
  if (blocker.label.startsWith('Quest Points ')) {
    return { kind: 'qp', label: blocker.label.slice('Quest Points '.length) + ' QP' };
  }
  return { kind: blocker.kind, label: blocker.label };
};

const manualChecksToUnmet = (checks: readonly string[]): Unmet[] =>
  [...new Set(checks)].map(label => ({
    kind: 'manual',
    label: `Confirm: ${label}`,
  }));

/** Everything blocking a quest right now (empty ⇒ automatically doable). */
export const questUnmet = (q: QuestData, unlocks: UnlockState, gameModeId?: string): Unmet[] => {
  const eligibility = evaluateQuestEligibility(q, unlocks, gameModeId);
  return [
    ...eligibility.blockers.map(eligibilityBlockerToUnmet),
    ...manualChecksToUnmet(eligibility.manualChecks),
  ];
};

/** Everything blocking a diary tier right now (empty ⇒ automatically doable). */
export const diaryUnmet = (d: DiaryTier, unlocks: UnlockState, gameModeId?: string): Unmet[] => {
  const eligibility = evaluateDiaryTierEligibility(d, unlocks, gameModeId);
  const manualChecks = ALL_DIARY_TASKS
    .filter(task => task.tierId === d.id && !unlocks.completedTasks.includes(task.id))
    .flatMap(task => evaluateDiaryTaskEligibility(task, unlocks, gameModeId).manualChecks);
  return [
    ...eligibility.blockers.map(eligibilityBlockerToUnmet),
    ...manualChecksToUnmet(manualChecks),
  ];
};

/** Blocked by exactly one requirement — the quick wins worth surfacing. */
export const isAlmostThere = (unmet: Unmet[]): boolean => unmet.length === 1;
