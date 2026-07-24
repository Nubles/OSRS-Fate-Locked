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
import {
  EligibilityBlocker, evaluateDiaryTierEligibility, evaluateQuestEligibility,
} from './journalStatus';

export interface Unmet {
  kind: 'region' | 'skill' | 'quest' | 'qp' | 'alternative';
  label: string;
}

const eligibilityBlockerToUnmet = (blocker: EligibilityBlocker): Unmet => {
  if (blocker.kind === 'combat') {
    return { kind: 'skill', label: blocker.label };
  }
  if (blocker.kind === 'skill' && blocker.label.startsWith('Quest Points ')) {
    return { kind: 'qp', label: blocker.label.slice('Quest Points '.length) + ' QP' };
  }
  return { kind: blocker.kind, label: blocker.label };
};

/** Everything blocking a quest right now (empty ⇒ doable). */
export const questUnmet = (q: QuestData, unlocks: UnlockState, gameModeId?: string): Unmet[] =>
  evaluateQuestEligibility(q, unlocks, gameModeId).blockers.map(eligibilityBlockerToUnmet);

/** Everything blocking a diary tier right now (empty ⇒ doable). */
export const diaryUnmet = (d: DiaryTier, unlocks: UnlockState, gameModeId?: string): Unmet[] =>
  evaluateDiaryTierEligibility(d, unlocks, gameModeId).blockers.map(eligibilityBlockerToUnmet);

/** Blocked by exactly one requirement — the quick wins worth surfacing. */
export const isAlmostThere = (unmet: Unmet[]): boolean => unmet.length === 1;
