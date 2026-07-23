/**
 * Journal progress analysis — the unmet requirements of a quest or diary tier,
 * used for "almost there" highlights, the unified next-best-actions feed, and
 * unlock-path checklists. One definition of "what's blocking this" shared by
 * every journal surface.
 *
 * Quest checks delegate to the canonical mode-aware eligibility evaluator so
 * every Journal surface reports the same blockers.
 */
import { QuestData, QUEST_DATA } from '../data/questData';
import { DiaryTier } from '../data/diaryData';
import { UnlockState } from '../types';
import {
  EligibilityBlocker, evaluateQuestEligibility, meetsSkillRequirement,
} from './journalStatus';
import { isAreaReachable } from './reachability';

export interface Unmet {
  kind: 'region' | 'skill' | 'quest' | 'qp';
  label: string;
}

const skillUnmet = (skills: Record<string, number>, unlocks: UnlockState, qp: number): Unmet[] => {
  const out: Unmet[] = [];
  for (const [skill, lvl] of Object.entries(skills)) {
    if (skill === 'Quest Points') { if (qp < lvl) out.push({ kind: 'qp', label: `${lvl} QP` }); continue; }
    if (!meetsSkillRequirement(unlocks, skill, lvl)) {
      out.push({ kind: 'skill', label: `${skill} ${lvl}` });
    }
  }
  return out;
};

const currentQP = (unlocks: UnlockState) =>
  unlocks.quests.reduce((a, id) => a + (QUEST_DATA[id]?.points ?? 0), 0);

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
export const diaryUnmet = (d: DiaryTier, unlocks: UnlockState, gameModeId?: string): Unmet[] => {
  const out: Unmet[] = [];
  const regions = [...new Set([d.region, ...d.requiredRegions])];
  for (const r of regions) if (!isAreaReachable(r, unlocks, gameModeId)) out.push({ kind: 'region', label: r });
  out.push(...skillUnmet(d.skills, unlocks, currentQP(unlocks)));
  for (const q of d.quests) if (!unlocks.quests.includes(q)) out.push({ kind: 'quest', label: q });
  return out;
};

/** Blocked by exactly one requirement — the quick wins worth surfacing. */
export const isAlmostThere = (unmet: Unmet[]): boolean => unmet.length === 1;
