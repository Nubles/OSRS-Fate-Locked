/**
 * Goal Planner — the reverse of the advisors.
 *
 * Pick any locked target (a quest, a diary tier, or a region) and this resolves
 * the FULL ordered roadmap to unlock it: every prerequisite quest (recursively,
 * in dependency order), every region to unlock, and every skill level to train.
 *
 * Where the advisors ask "what's the highest-impact thing I can do RIGHT NOW",
 * the planner asks "I want THIS — what stands between me and it, in order".
 *
 * Pure & side-effect-free — reuses the same status primitives as the advisors,
 * so it's always consistent with what the rest of the Journal shows.
 */

import { QUEST_DATA, QuestData } from '../data/questData';
import { DIARY_DATA, DiaryTier } from '../data/diaryData';
import { REGION_GROUPS } from '../data/items';
import {
  evaluateQuestEligibility, getQuestStatus, getDiaryStatus,
  questRequirementOptionLabel, taskEligibilityBlockers,
} from './journalStatus';
import { isAreaReachable } from './reachability';

export type GoalKind = 'quest' | 'diary' | 'region';

export interface PlanStep {
  /** What kind of thing this step is. */
  kind: 'quest' | 'region' | 'skill' | 'qp';
  /** Stable id: quest id, region name, skill name, or 'Quest Points'. */
  id: string;
  /** Display label. */
  label: string;
  /** Secondary text (e.g. "Lv 50 (have 32)", "12 QP needed"). */
  detail?: string;
  /** Already satisfied in the current unlocks snapshot. */
  done: boolean;
}

export interface GoalPlan {
  targetKind: GoalKind;
  targetId: string;
  targetLabel: string;
  /** Target is already AVAILABLE or COMPLETED right now. */
  alreadyReachable: boolean;
  /** Target is already fully COMPLETED/unlocked. */
  alreadyDone: boolean;
  /** Quests to complete, in dependency order (prereqs first). */
  questSteps: PlanStep[];
  /** Regions to unlock. */
  regionSteps: PlanStep[];
  /** Skill levels to train (highest required across the whole chain). */
  skillSteps: PlanStep[];
  /** Optional quest-point shortfall note. */
  qpStep?: PlanStep;
  /** Flat, sensibly-ordered roadmap: regions → skills → QP → quests. */
  steps: PlanStep[];
  /** Number of steps not yet satisfied. */
  remaining: number;
}

interface Selectable {
  kind: GoalKind;
  id: string;
  label: string;
  /** Grouping hint for the picker (region/series name). */
  group: string;
}

const UNLOCKABLE_REGIONS = Object.keys(REGION_GROUPS);

/** Total quest points the player currently has. */
function currentQuestPoints(unlocks: any): number {
  return (unlocks.quests as string[]).reduce(
    (acc, qid) => acc + (QUEST_DATA[qid]?.points ?? 0),
    0,
  );
}

/**
 * Walk the prereq DAG of `rootQuestId` (post-order, so prerequisites come
 * before the quests that depend on them) and accumulate every requirement
 * needed to make the root quest AVAILABLE + complete it.
 *
 * Completed quests are pruned — their sub-tree is already satisfied.
 */
function collectQuestChain(rootQuestId: string, unlocks: any, gameModeId?: string) {
  const order: string[] = []; // incomplete quests, dependency order
  const visited = new Set<string>();
  const regions = new Set<string>();
  const alternatives = new Set<string>();
  const skills: Record<string, number> = {};
  let qpRequired = 0;

  const visit = (qid: string) => {
    if (visited.has(qid)) return;
    visited.add(qid);
    const q: QuestData | undefined = QUEST_DATA[qid];
    if (!q) return;

    const eligibility = evaluateQuestEligibility(q, unlocks, gameModeId);
    if (eligibility.status === 'COMPLETED') return;

    // Canonical quest blockers decide every requirement. Walking quest blockers
    // first preserves dependency order without rebuilding prerequisite logic.
    for (const blocker of eligibility.blockers) {
      if (blocker.kind === 'quest') visit(blocker.label);
    }

    const alternativeLabel = q.oneOf
      ?.map(questRequirementOptionLabel)
      .join(' or ');

    for (const blocker of eligibility.blockers) {
      if (blocker.kind === 'region') {
        if (alternativeLabel && blocker.label === alternativeLabel) {
          alternatives.add('One of: ' + blocker.label);
        } else {
          regions.add(blocker.label);
        }
        continue;
      }
      if (blocker.kind === 'combat') {
        if (q.combatLevel !== undefined) {
          skills['Combat level'] = Math.max(skills['Combat level'] ?? 0, q.combatLevel);
        }
        continue;
      }
      if (blocker.kind === 'skill') {
        for (const [skill, level] of Object.entries(q.skills)) {
          if (blocker.label !== skill + ' ' + level) continue;
          if (skill === 'Quest Points') qpRequired = Math.max(qpRequired, level);
          else skills[skill] = Math.max(skills[skill] ?? 0, level);
        }
      }
    }

    order.push(qid);
  };

  visit(rootQuestId);
  return { order, regions, alternatives, skills, qpRequired };
}

function buildPlanFromRequirements(
  targetKind: GoalKind,
  targetId: string,
  targetLabel: string,
  reqs: {
    order: string[]; regions: Set<string>; alternatives: Set<string>;
    skills: Record<string, number>; qpRequired: number;
  },
  unlocks: any,
  alreadyReachable: boolean,
  alreadyDone: boolean,
): GoalPlan {
  // Region steps.
  const regionSteps: PlanStep[] = [
    ...Array.from(reqs.regions).map((region): PlanStep => ({
      kind: 'region',
      id: region,
      label: region,
      done: false,
    })),
    ...Array.from(reqs.alternatives).map((label): PlanStep => ({
      kind: 'region',
      id: `alternative:${label}`,
      label,
      detail: 'Unlock any listed route',
      done: false,
    })),
  ].sort((a, b) => Number(a.done) - Number(b.done) || a.label.localeCompare(b.label));

  // Skill steps.
  const skillSteps: PlanStep[] = Object.entries(reqs.skills)
    .map(([skill, lvl]): PlanStep => {
      const done = false;
      const have = unlocks.levels[skill] ?? 1;
      const tier = unlocks.skills[skill] ?? 0;
      const unlocked = tier > 0;
      const methodCap = Math.min(99, tier * 10);
      const detail = skill === 'Combat level'
        ? `Level ${lvl}`
        : !unlocked
          ? `Lv ${lvl} (locked)`
          : have >= lvl && methodCap < lvl
            ? `Lv ${lvl} (have ${have}; method cap ${methodCap})`
            : `Lv ${lvl} (have ${have})`;
      return {
        kind: 'skill',
        id: skill,
        label: skill,
        detail,
        done,
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || b.id.localeCompare(a.id));

  // Quest steps (already in dependency order from the walk).
  const questSteps: PlanStep[] = reqs.order
    // The target quest itself is the final step; keep it. Drop quests already
    // complete (the walk already prunes them, but be defensive).
    .filter((qid) => !unlocks.quests.includes(qid))
    .map((qid): PlanStep => {
      const q = QUEST_DATA[qid];
      return {
        kind: 'quest',
        id: qid,
        label: q?.name ?? qid,
        detail: q && q.points > 0 ? `${q.points} QP` : undefined,
        done: false,
      };
    });

  // Quest-point shortfall: does completing the plan's quests yield enough QP?
  let qpStep: PlanStep | undefined;
  if (reqs.qpRequired > 0) {
    const haveQP = currentQuestPoints(unlocks);
    const chainQP = questSteps.reduce(
      (acc, s) => acc + (QUEST_DATA[s.id]?.points ?? 0),
      0,
    );
    const projected = haveQP + chainQP;
    const done = haveQP >= reqs.qpRequired;
    if (!done) {
      qpStep = {
        kind: 'qp',
        id: 'Quest Points',
        label: 'Quest Points',
        detail:
          projected >= reqs.qpRequired
            ? `${reqs.qpRequired} QP — covered by this plan (${projected})`
            : `${reqs.qpRequired} QP — plan yields ${projected}, need more quests`,
        done: false,
      };
    }
  }

  const steps: PlanStep[] = [
    ...regionSteps,
    ...skillSteps,
    ...(qpStep ? [qpStep] : []),
    ...questSteps,
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return {
    targetKind,
    targetId,
    targetLabel,
    alreadyReachable,
    alreadyDone,
    questSteps,
    regionSteps,
    skillSteps,
    qpStep,
    steps,
    remaining,
  };
}

/**
 * Build the full roadmap for any target. Pure — safe inside useMemo.
 *
 * @param kind     'quest' | 'diary' | 'region'
 * @param id       quest id, diary tier id, or region name
 * @param unlocks  current unlocks snapshot
 */
export function planForTarget(kind: GoalKind, id: string, unlocks: any, gameModeId?: string): GoalPlan | null {
  if (kind === 'quest') {
    const q: QuestData | undefined = QUEST_DATA[id];
    if (!q) return null;
    const status = getQuestStatus(q, unlocks, gameModeId);
    const reqs = collectQuestChain(id, unlocks, gameModeId);
    return buildPlanFromRequirements(
      'quest',
      id,
      q.name,
      reqs,
      unlocks,
      status === 'AVAILABLE' || status === 'COMPLETED',
      status === 'COMPLETED',
    );
  }

  if (kind === 'diary') {
    const d: DiaryTier | undefined = DIARY_DATA[id];
    if (!d) return null;
    const status = getDiaryStatus(d, unlocks, gameModeId);

    // Merge requirements across all gating quests + the diary's own gates.
    const merged = {
      order: [] as string[],
      regions: new Set<string>(),
      alternatives: new Set<string>(),
      skills: {} as Record<string, number>,
      qpRequired: 0,
    };
    if (status !== 'COMPLETED') {
      const seen = new Set<string>();
      for (const qid of d.quests) {
        const sub = collectQuestChain(qid, unlocks, gameModeId);
        for (const region of sub.regions) merged.regions.add(region);
        for (const alternative of sub.alternatives) merged.alternatives.add(alternative);
        for (const [skill, level] of Object.entries(sub.skills)) {
          merged.skills[skill] = Math.max(merged.skills[skill] ?? 0, level);
        }
        merged.qpRequired = Math.max(merged.qpRequired, sub.qpRequired);
        for (const questId of sub.order) {
          if (!seen.has(questId)) {
            seen.add(questId);
            merged.order.push(questId);
          }
        }
      }

      const blockers = taskEligibilityBlockers({
        id: d.id,
        skills: d.skills,
        quests: d.quests,
        regions: d.requiredRegions,
      }, unlocks, gameModeId);
      for (const blocker of blockers) {
        if (blocker.kind === 'region') merged.regions.add(blocker.label);
        if (blocker.kind === 'skill') {
          for (const [skill, level] of Object.entries(d.skills)) {
            if (blocker.label === skill + ' ' + level) {
              merged.skills[skill] = Math.max(merged.skills[skill] ?? 0, level);
            }
          }
        }
      }
    }

    return buildPlanFromRequirements(
      'diary',
      id,
      id,
      merged,
      unlocks,
      status === 'AVAILABLE' || status === 'COMPLETED',
      status === 'COMPLETED',
    );
  }

  // region
  const isUnlocked = isAreaReachable(id, unlocks, gameModeId);
  const regionStep: PlanStep = { kind: 'region', id, label: id, done: isUnlocked };
  return {
    targetKind: 'region',
    targetId: id,
    targetLabel: id,
    alreadyReachable: isUnlocked,
    alreadyDone: isUnlocked,
    questSteps: [],
    regionSteps: [regionStep],
    skillSteps: [],
    steps: [regionStep],
    remaining: isUnlocked ? 0 : 1,
  };
}

/**
 * Every selectable goal target for the picker — locked-or-not, so the player
 * can plan ahead. Sorted with the most "interesting" (incomplete) first.
 */
export function listGoalTargets(): Selectable[] {
  const quests: Selectable[] = Object.values(QUEST_DATA).map((q) => ({
    kind: 'quest' as const,
    id: q.id,
    label: q.name,
    group: q.series ?? 'Quests',
  }));
  const diaries: Selectable[] = Object.values(DIARY_DATA).map((d) => ({
    kind: 'diary' as const,
    id: d.id,
    label: d.id,
    group: d.region,
  }));
  const regions: Selectable[] = UNLOCKABLE_REGIONS.map((r) => ({
    kind: 'region' as const,
    id: r,
    label: r,
    group: 'Regions',
  }));
  return [...quests, ...diaries, ...regions];
}

export type { Selectable as GoalTarget };
