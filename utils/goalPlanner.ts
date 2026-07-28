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

import { QUEST_CAPE_QUEST_IDS, QUEST_DATA, QuestData } from '../data/questData';
import { DIARY_DATA, DiaryTier } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { REGION_GROUPS } from '../data/items';
import {
  evaluateQuestEligibility, getDiaryStatus,
  evaluateDiaryTaskEligibility, questRequirementOptionLabel, DirectEligibilityBlocker,
} from './journalStatus';
import { isAreaReachable } from './reachability';
import { effectiveCombatLevel, effectiveSkillLevel } from './slayerReach';

export type GoalKind = 'quest' | 'diary' | 'region';

export interface PlanStep {
  /** What kind of thing this step is. */
  kind: 'quest' | 'region' | 'skill' | 'qp' | 'manual';
  /** Stable id: quest id, region name, skill name, or 'Quest Points'. */
  id: string;
  /** Display label. */
  label: string;
  /** Secondary text (e.g. "Lv 50 (have 32)", "12 QP needed"). */
  detail?: string;
  /** Unlock table ids that can satisfy a composite step. */
  relatedIds?: string[];
  /** Already satisfied in the current unlocks snapshot. */
  done: boolean;
}

export interface AlternativePlanRoute {
  label: string;
  blockers: PlanStep[];
}

export interface AlternativePlanStep {
  kind: 'alternative';
  id: string;
  label: string;
  done: boolean;
  routes: AlternativePlanRoute[];
}

export interface GoalPlan {
  targetKind: GoalKind;
  targetId: string;
  targetLabel: string;
  /** Target is already AVAILABLE or COMPLETED right now. */
  alreadyReachable: boolean;
  /** Target is already fully COMPLETED/unlocked. */
  alreadyDone: boolean;
  /** Machine gates pass, but player must verify outstanding manual checks. */
  needsConfirmation: boolean;
  /** Manual confirmations required before the target can be completed. */
  manualSteps: PlanStep[];
  /** Quests to complete, in dependency order (prereqs first). */
  questSteps: PlanStep[];
  /** Regions to unlock. */
  regionSteps: PlanStep[];
  /** Skill levels to train (highest required across the whole chain). */
  skillSteps: PlanStep[];
  /** Requirements where any one complete route is sufficient. */
  alternativeSteps: AlternativePlanStep[];
  /** Optional quest-point shortfall note. */
  qpStep?: PlanStep;
  /** Flat, sensibly-ordered roadmap: regions → skills → QP → quests. */
  steps: Array<PlanStep | AlternativePlanStep>;
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

function addManualStep(
  manualSteps: Map<string, PlanStep>,
  check: string,
  sourceId: string,
  detail: string,
) {
  if (manualSteps.has(check)) return;
  manualSteps.set(check, {
    kind: 'manual',
    id: `manual:${sourceId}:${check}`,
    label: `Confirm: ${check}`,
    detail,
    done: false,
  });
}


/** Quest Points awarded by a journal entry; miniquests never award points. */
function questPointsFor(questId: string): number {
  const quest = QUEST_DATA[questId];
  return quest?.kind === 'quest' ? quest.points : 0;
}

/** Total quest points the player currently has. */
function currentQuestPoints(unlocks: any): number {
  return (unlocks.quests as string[]).reduce(
    (acc, qid) => acc + questPointsFor(qid),
    0,
  );
}

function requirementOptionPlanSteps(option: any): PlanStep[] {
  return [
    ...(option.regions ?? []).map((label: string): PlanStep => ({
      kind: 'region', id: label, label, done: false,
    })),
    ...(option.guilds ?? []).map((label: string): PlanStep => ({
      kind: 'region', id: label, label, done: false,
    })),
    ...(option.locations ?? []).map((location: any): PlanStep => ({
      kind: 'region', id: location.label, label: location.label, done: false,
    })),
  ];
}

function planStepForBlocker(blocker: DirectEligibilityBlocker, unlocks: any): PlanStep {
  if (blocker.kind === 'region' || blocker.kind === 'quest') {
    return { kind: blocker.kind, id: blocker.label, label: blocker.label, done: false };
  }
  if (blocker.kind === 'combat') {
    const required = Number(blocker.label.match(/\d+/)?.[0] ?? 1);
    return {
      kind: 'skill', id: 'Combat level', label: 'Combat level',
      detail: 'Level ' + required + ' (have ' + effectiveCombatLevel(unlocks) + ')', done: false,
    };
  }

  const requirement = blocker.requirement;
  if (requirement?.type === 'combined') {
    const levels = requirement.skills.map(skill => [
      skill, effectiveSkillLevel(unlocks, skill),
    ] as const);
    const have = levels.reduce((sum, [, level]) => sum + level, 0);
    return {
      kind: 'skill', id: 'combined:' + requirement.skills.join('+'),
      label: requirement.skills.join(' + ') + ' combined',
      relatedIds: requirement.skills,
      detail: 'Level ' + requirement.level + ' combined (have ' + have + ': '
        + levels.map(([skill, level]) => skill + ' ' + level).join(' + ') + ')',
      done: false,
    };
  }
  if (requirement?.type === 'anyOf') {
    return {
      kind: 'skill', id: 'any-of:' + requirement.skills.join('|'),
      label: requirement.skills.join(' or '),
      relatedIds: requirement.skills,
      detail: 'Lv ' + requirement.level + ' in either (have '
        + requirement.skills.map(skill => (
          skill + ' ' + effectiveSkillLevel(unlocks, skill)
        )).join(', ') + ')',
      done: false,
    };
  }
  if (requirement?.type === 'any') {
    return {
      kind: 'skill', id: 'Any skill', label: 'Any skill',
      detail: 'Lv ' + requirement.level, done: false,
    };
  }

  const match = blocker.label.match(/^(.*) (\d+)$/);
  const skill = requirement?.type === 'single'
    ? requirement.skill
    : (match?.[1] ?? blocker.label);
  const required = requirement?.type === 'single'
    ? requirement.level
    : Number(match?.[2] ?? 1);
  return {
    kind: 'skill', id: skill, label: skill, relatedIds: [skill],
    detail: 'Lv ' + required + ' (have ' + effectiveSkillLevel(unlocks, skill) + ')', done: false,
  };
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
  const alternatives = new Map<string, AlternativePlanStep>();
  const skills: Record<string, number> = {};
  const manualSteps = new Map<string, PlanStep>();
  let qpRequired = 0;

  const visit = (qid: string) => {
    if (visited.has(qid)) return;
    visited.add(qid);
    const q: QuestData | undefined = QUEST_DATA[qid];
    if (!q) return;

    const eligibility = evaluateQuestEligibility(q, unlocks, gameModeId);
    if (eligibility.status === 'COMPLETED') return;

    const questPointRequirement = q.skills['Quest Points'];
    if (questPointRequirement !== undefined) {
      qpRequired = Math.max(qpRequired, questPointRequirement);
    }


    for (const check of eligibility.manualChecks) {
      addManualStep(manualSteps, check, qid, `Required for ${q.name}`);
    }
    // Canonical quest blockers decide every requirement. Walking quest blockers
    // first preserves dependency order without rebuilding prerequisite logic.
    for (const blocker of eligibility.blockers) {
      if (blocker.kind === 'quest' && QUEST_DATA[blocker.label]) visit(blocker.label);
    }

    const alternativeLabel = q.oneOf
      ?.map(questRequirementOptionLabel)
      .join(' or ');

    for (const blocker of eligibility.blockers) {
      if (blocker.kind === 'region') {
        if (alternativeLabel && blocker.label === alternativeLabel) {
          const label = 'One of: ' + blocker.label;
          alternatives.set(label, {
            kind: 'alternative', id: 'alternative:' + qid + ':' + label, label, done: false,
            routes: (q.oneOf ?? []).map(option => ({
              label: questRequirementOptionLabel(option),
              blockers: requirementOptionPlanSteps(option),
            })),
          });
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
  return { order, regions, alternatives, manualSteps, skills, qpRequired };
}

function buildPlanFromRequirements(
  targetKind: GoalKind,
  targetId: string,
  targetLabel: string,
  reqs: {
    order: string[]; regions: Set<string>; alternatives: Map<string, AlternativePlanStep>;
    manualSteps: Map<string, PlanStep>; skills: Record<string, number>; qpRequired: number;
  },
  unlocks: any,
  alreadyReachable: boolean,
  alreadyDone: boolean,
  needsConfirmation: boolean,
): GoalPlan {
  // Region steps.
  const regionSteps: PlanStep[] = Array.from(reqs.regions).map((region): PlanStep => ({
    kind: 'region', id: region, label: region, done: false,
  })).sort((a, b) => a.label.localeCompare(b.label));
  const alternativeSteps = [...reqs.alternatives.values()]
    .sort((a, b) => a.label.localeCompare(b.label));
  const manualSteps = [...reqs.manualSteps.values()];

  // Skill steps.
  const skillSteps: PlanStep[] = Object.entries(reqs.skills)
    .map(([skill, lvl]): PlanStep => {
      const done = false;
      const rawLevel = skill === 'Combat level'
        ? effectiveCombatLevel(unlocks)
        : (unlocks.levels[skill] ?? 1);
      const have = skill === 'Combat level'
        ? rawLevel
        : effectiveSkillLevel(unlocks, skill);
      const tier = unlocks.skills[skill] ?? 0;
      const unlocked = tier > 0;
      const methodCap = Math.min(99, tier * 10);
      const detail = skill === 'Combat level'
        ? `Level ${lvl} (have ${have})`
        : !unlocked
          ? `Lv ${lvl} (locked)`
          : rawLevel >= lvl && methodCap < lvl
            ? `Lv ${lvl} (have ${rawLevel}; method cap ${methodCap})`
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
        detail: q?.kind === 'quest' ? `${q.points} QP` : undefined,
        done: false,
      };
    });

  // Quest-point shortfall: does completing the plan's quests yield enough QP?
  let qpStep: PlanStep | undefined;
  if (reqs.qpRequired > 0) {
    const haveQP = currentQuestPoints(unlocks);
    const chainQP = questSteps.reduce(
      (acc, s) => acc + questPointsFor(s.id),
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

  const steps: Array<PlanStep | AlternativePlanStep> = [
    ...regionSteps,
    ...skillSteps,
    ...alternativeSteps,
    ...(qpStep ? [qpStep] : []),
    ...manualSteps,
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
    needsConfirmation,
    manualSteps,
    regionSteps,
    skillSteps,
    alternativeSteps,
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
    const eligibility = evaluateQuestEligibility(q, unlocks, gameModeId);
    const reqs = collectQuestChain(id, unlocks, gameModeId);
    return buildPlanFromRequirements(
      'quest',
      id,
      q.name,
      reqs,
      unlocks,
      eligibility.status === 'COMPLETED' || eligibility.eligible,
      eligibility.status === 'COMPLETED',
      eligibility.confirmable && !eligibility.eligible && eligibility.manualChecks.length > 0,
    );
  }

  if (kind === 'diary') {
    const d: DiaryTier | undefined = DIARY_DATA[id];
    if (!d) return null;
    const status = getDiaryStatus(d, unlocks, gameModeId);

    // Canonical tasks own diary eligibility; DIARY_DATA aggregates are display-only metadata.
    const tasks = ALL_DIARY_TASKS.filter(task => (
      task.tierId === id && !unlocks.completedTasks.includes(task.id)
    ));
    const taskResults = tasks.map(task => [task, evaluateDiaryTaskEligibility(task, unlocks, gameModeId)] as const);

    const merged = {
      order: [] as string[],
      regions: new Set<string>(),
      alternatives: new Map<string, AlternativePlanStep>(),
      manualSteps: new Map<string, PlanStep>(),
      skills: {} as Record<string, number>,
      qpRequired: 0,
    };
    if (status !== 'COMPLETED') {
      const seen = new Set<string>();
      const mergeQuest = (qid: string) => {
        const sub = collectQuestChain(qid, unlocks, gameModeId);
        for (const region of sub.regions) merged.regions.add(region);
        for (const [key, alternative] of sub.alternatives) merged.alternatives.set(key, alternative);
        for (const [key, step] of sub.manualSteps) merged.manualSteps.set(key, step);
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
      };

      for (const [task, eligibility] of taskResults) {
        for (const qid of task.quests ?? []) mergeQuest(qid);
        if (task.questPoints !== undefined) {
          merged.qpRequired = Math.max(merged.qpRequired, task.questPoints);
        }
        if (task.allQuests) {
          for (const qid of QUEST_CAPE_QUEST_IDS) mergeQuest(qid);
        }

        for (const check of eligibility.manualChecks) {
          addManualStep(merged.manualSteps, check, task.id, `Required for ${task.description}`);
        }
        const blockers = eligibility.blockers;
        for (const blocker of blockers) {
          if (blocker.kind === 'region') merged.regions.add(blocker.label);
          if (blocker.kind === 'alternative') {
            const label = 'One of: ' + blocker.label;
            merged.alternatives.set(label, {
              kind: 'alternative', id: 'alternative:' + task.id, label, done: false,
              routes: blocker.routes.map(route => ({
                label: route.label,
                blockers: route.blockers.map(routeBlocker => (
                  planStepForBlocker(routeBlocker, unlocks)
                )),
              })),
            });
          }
          if (blocker.kind === 'combat' && task.combatLevel !== undefined) {
            merged.skills['Combat level'] = Math.max(
              merged.skills['Combat level'] ?? 0,
              task.combatLevel,
            );
          }
          if (blocker.kind === 'skill') {
            for (const [skill, level] of Object.entries(task.skills ?? {})) {
              if (blocker.label === skill + ' ' + level) {
                merged.skills[skill] = Math.max(merged.skills[skill] ?? 0, level);
              }
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
      status === 'COMPLETED' || taskResults.every(([, eligibility]) => eligibility.eligible),
      status === 'COMPLETED',
      status !== 'COMPLETED' && taskResults.every(([, eligibility]) => eligibility.machineEligible) && taskResults.some(([, eligibility]) => eligibility.manualChecks.length > 0),
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
    needsConfirmation: false,
    manualSteps: [],
    questSteps: [],
    regionSteps: [regionStep],
    skillSteps: [],
    alternativeSteps: [],
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
