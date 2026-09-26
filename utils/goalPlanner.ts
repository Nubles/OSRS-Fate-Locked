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
import { canonicalAreaName, displayAreaName } from '../data/areaMapPolicy';
import { TableType } from '../types';
import {
  evaluateQuestEligibility, getDiaryStatus,
  evaluateDiaryTaskEligibility, questRequirementOptionLabel, DirectEligibilityBlocker,
  locationUnlockTargets, type LocationUnlockTargets,
} from './journalStatus';
import { isAreaReachable, namedAreaChunks } from './reachability';
import { placeOf } from './chunkLocations';
import { chunkKey } from './chunkAdjacency';
import { actualCombatLevel, effectiveSkillLevel } from './slayerReach';

export type GoalKind = 'quest' | 'diary' | 'region';

export interface PlanStep {
  /** What kind of thing this step is. */
  kind: 'quest' | 'region' | 'skill' | 'equipment' | 'merchant' | 'mobility' | 'arcana' | 'minigame' | 'qp' | 'manual';
  /** Stable id: quest id, region name, skill name, or 'Quest Points'. */
  id: string;
  /** Display label. */
  label: string;
  /** Exact gacha table that can satisfy this step. */
  unlockTable?: TableType;
  /** Secondary text (e.g. "Lv 50 (have 32)", "12 QP needed"). */
  detail?: string;
  /** Unlock table ids that can satisfy a composite step. */
  relatedIds?: string[];
  /** Minimum Fate equipment tier, when this is an equipment-slot step. */
  requiredTier?: number;
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
  /** Fate equipment-slot tiers required across the incomplete quest chain. */
  equipmentSteps: PlanStep[];
  /** Merchant categories required by incomplete diary tasks. */
  merchantSteps?: PlanStep[];
  mobilitySteps?: PlanStep[];
  arcanaSteps?: PlanStep[];
  minigameSteps?: PlanStep[];
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
export const questPointsForEntry = (
  quest: Pick<QuestData, 'kind' | 'points'> | undefined,
): number => quest?.kind === 'quest' ? quest.points : 0;

function questPointsFor(questId: string): number {
  return questPointsForEntry(QUEST_DATA[questId]);
}

/** Total quest points the player currently has. */
function currentQuestPoints(unlocks: any): number {
  return (unlocks.quests as string[]).reduce(
    (acc, qid) => acc + questPointsFor(qid),
    0,
  );
}

/**
 * A skill's usable level ceiling at its current tier (0 while locked). A
 * Skills key only helps a requirement this ceiling holds below the level
 * needed; otherwise only XP is missing.
 */
function skillCap(unlocks: any, skill: string): number {
  return Math.min(99, (unlocks.skills?.[skill] ?? 0) * 10);
}

function areaPlanStep(name: string, gameModeId?: string): PlanStep {
  const canonical = canonicalAreaName(name);
  // Chunked has no Areas table: any one of the area's chunks reaches it.
  if (gameModeId === 'chunked') {
    return {
      kind: 'region', id: canonical, label: displayAreaName(name), unlockTable: TableType.CHUNKS,
      relatedIds: namedAreaChunks(name).map(chunkKey), detail: 'Unlock any chunk in this area', done: false,
    };
  }
  return { kind: 'region', id: canonical, label: displayAreaName(name), unlockTable: TableType.REGIONS, done: false };
}

/** An exact chunk to roll on the Chunks table, as diary chunk routes plan it. */
function chunkPlanStep({ cx, cy }: { cx: number; cy: number }): PlanStep {
  return { kind: 'region', id: `${cx},${cy}`, label: `Chunk ${cx}, ${cy}`, unlockTable: TableType.CHUNKS, done: false };
}

/**
 * Steps that unlock a quest location: its areas, or (Chunked) one of its
 * chunks. Its label is a place name, not an area any table can grant.
 */
function locationPlanSteps(targets: LocationUnlockTargets, gameModeId?: string): PlanStep[] {
  if (targets.chunks.length === 0) return targets.areas.map(area => areaPlanStep(area, gameModeId));
  const keys = targets.chunks.map(({ cx, cy }) => `${cx},${cy}`);
  return [{
    ...chunkPlanStep(targets.chunks[0]),
    label: `Chunk ${keys.map(key => key.replace(',', ', ')).join(' or ')}`,
    relatedIds: keys,
  }];
}

/** A single skill level to reach, with the Skills key it needs if its tier caps it below. */
function skillLevelPlanStep(skill: string, required: number, unlocks: any): PlanStep {
  return {
    kind: 'skill', id: skill, label: skill, relatedIds: [skill],
    unlockTable: skillCap(unlocks, skill) < required ? TableType.SKILLS : undefined,
    detail: 'Lv ' + required + ' (have ' + effectiveSkillLevel(unlocks, skill) + ')', done: false,
  };
}

function requirementOptionPlanSteps(option: any, unlocks: any, gameModeId?: string): PlanStep[] {
  return [
    ...(option.regions ?? []).map((region: string) => areaPlanStep(region, gameModeId)),
    ...(option.guilds ?? []).map((label: string): PlanStep => ({
      kind: 'region', id: label, label, unlockTable: TableType.GUILDS, done: false,
    })),
    ...(option.locations ?? []).flatMap((location: any) => (
      locationPlanSteps(locationUnlockTargets(location, unlocks, gameModeId), gameModeId)
    )),
    // A route's own skill level, such as a guild's entry requirement.
    ...Object.entries(option.skills ?? {}).map(([skill, level]) => (
      skillLevelPlanStep(skill, level as number, unlocks)
    )),
  ];
}

function planStepForBlocker(blocker: DirectEligibilityBlocker, unlocks: any, gameModeId?: string): PlanStep {
  if (blocker.kind === 'arcana') {
    return { kind: 'arcana', id: blocker.label, label: blocker.label, unlockTable: TableType.ARCANA, detail: 'Unlock via Arcana', done: false };
  }
  if (blocker.kind === 'mobility') {
    return { kind: 'mobility', id: blocker.label, label: blocker.label, unlockTable: TableType.MOBILITY, detail: 'Unlock via Mobility', done: false };
  }
  if (blocker.kind === 'minigame') {
    return { kind: 'minigame', id: blocker.label, label: blocker.label, unlockTable: TableType.MINIGAMES, detail: 'Unlock via Minigames', done: false };
  }
  if (blocker.kind === 'merchant') {
    return { kind: 'merchant', id: blocker.label, label: blocker.label, unlockTable: TableType.MERCHANTS, detail: 'Unlock via Merchants', done: false };
  }
  if (blocker.kind === 'region' && blocker.anyOf?.length) {
    // A travel route's departure: unlocking any one of these areas is enough.
    const areas = blocker.anyOf.map(canonicalAreaName);
    return {
      kind: 'region', id: 'any-of:' + areas.join('|'),
      label: 'Any of: ' + areas.join(', '),
      unlockTable: TableType.REGIONS, relatedIds: areas, detail: 'Unlock any one', done: false,
    };
  }
  if (blocker.kind === 'region') return blocker.chunk
    ? { kind: 'region', id: `${blocker.chunk.cx},${blocker.chunk.cy}`, label: blocker.label, unlockTable: TableType.CHUNKS, done: false }
    : areaPlanStep(blocker.label, gameModeId);
  if (blocker.kind === 'quest') {
    return { kind: 'quest', id: blocker.label, label: blocker.label, unlockTable: TableType.QUESTS, done: false };
  }
  if (blocker.kind === 'equipment') {
    return {
      kind: 'equipment', id: blocker.slot, label: `${blocker.slot} T${blocker.tier}`,
      detail: `Unlock via Equipment (have T${unlocks.equipment?.[blocker.slot] ?? 0}): ${blocker.label}`,
      unlockTable: TableType.EQUIPMENT, requiredTier: blocker.tier, done: false,
    };
  }
  if (blocker.kind === 'combat') {
    const required = Number(blocker.label.match(/\d+/)?.[0] ?? 1);
    return {
      kind: 'skill', id: 'Combat level', label: 'Combat level',
      detail: 'Level ' + required + ' (have ' + actualCombatLevel(unlocks) + ')', done: false,
    };
  }

  const requirement = blocker.requirement;
  if (requirement?.type === 'combined') {
    const levels = requirement.skills.map(skill => [
      skill, effectiveSkillLevel(unlocks, skill),
    ] as const);
    const have = levels.reduce((sum, [, level]) => sum + level, 0);
    const capTotal = requirement.skills.reduce((sum, skill) => sum + skillCap(unlocks, skill), 0);
    return {
      kind: 'skill', id: 'combined:' + requirement.skills.join('+'),
      label: requirement.skills.join(' + ') + ' combined',
      relatedIds: requirement.skills,
      unlockTable: capTotal < requirement.level ? TableType.SKILLS : undefined,
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
      unlockTable: requirement.skills.every(skill => skillCap(unlocks, skill) < requirement.level) ? TableType.SKILLS : undefined,
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
  return skillLevelPlanStep(skill, required, unlocks);
}

/** A Quest Point requirement and the quest it gates (null: a diary task's own gate). */
interface QpGate {
  required: number;
  questId: string | null;
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
  const prereqs = new Map<string, string[]>(); // incomplete quest → its unmet quest prereqs
  const qpGates: QpGate[] = [];
  const visited = new Set<string>();
  const regions = new Set<string>();
  const alternatives = new Map<string, AlternativePlanStep>();
  const skills: Record<string, number> = {};
  const equipment = new Map<string, { tier: number; labels: Set<string> }>();
  const manualSteps = new Map<string, PlanStep>();

  const visit = (qid: string) => {
    if (visited.has(qid)) return;
    visited.add(qid);
    const q: QuestData | undefined = QUEST_DATA[qid];
    if (!q) return;

    const eligibility = evaluateQuestEligibility(q, unlocks, gameModeId);
    if (eligibility.status === 'COMPLETED') return;

    const questPointRequirement = q.skills['Quest Points'];
    if (questPointRequirement !== undefined) {
      qpGates.push({ required: questPointRequirement, questId: qid });
    }


    for (const check of eligibility.manualChecks) {
      addManualStep(manualSteps, check, qid, `Required for ${q.name}`);
    }
    // Canonical quest blockers decide every requirement. Walking quest blockers
    // first preserves dependency order without rebuilding prerequisite logic.
    for (const blocker of eligibility.blockers) {
      if (blocker.kind === 'quest' && QUEST_DATA[blocker.label]) visit(blocker.label);
    }
    prereqs.set(qid, eligibility.blockers.flatMap(blocker => (
      blocker.kind === 'quest' && QUEST_DATA[blocker.label] ? [blocker.label] : []
    )));

    const alternativeLabel = q.oneOf
      ?.map(questRequirementOptionLabel)
      .join(' or ');

    for (const blocker of eligibility.blockers) {
      if (blocker.kind === 'equipment') {
        const previous = equipment.get(blocker.slot);
        equipment.set(blocker.slot, {
          tier: Math.max(previous?.tier ?? 0, blocker.tier),
          labels: new Set([...(previous?.labels ?? []), blocker.label]),
        });
        continue;
      }
      if (blocker.kind === 'region') {
        if (alternativeLabel && blocker.label === alternativeLabel) {
          const label = 'One of: ' + blocker.label;
          alternatives.set(label, {
            kind: 'alternative', id: 'alternative:' + qid + ':' + label, label, done: false,
            routes: (q.oneOf ?? []).map(option => ({
              label: questRequirementOptionLabel(option),
              blockers: requirementOptionPlanSteps(option, unlocks, gameModeId),
            })),
          });
        } else if (blocker.location?.chunks.length) {
          // Chunked: the location is any one of its exact chunks, as diary
          // locations are planned.
          const label = 'One of: ' + blocker.label;
          alternatives.set(label, {
            kind: 'alternative', id: 'alternative:' + qid + ':' + label, label, done: false,
            routes: blocker.location.chunks.map(chunk => ({
              label: `${placeOf(chunk.cx, chunk.cy).label} (${chunk.cx}, ${chunk.cy})`,
              blockers: [chunkPlanStep(chunk)],
            })),
          });
        } else {
          // A location's label is a place name; plan the areas that unlock it.
          for (const area of blocker.location?.areas ?? [blocker.label]) regions.add(canonicalAreaName(area));
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
          if (blocker.label !== skill + ' ' + level
            && !(blocker.requirement?.type === 'single' && blocker.requirement.skill === skill && blocker.requirement.level === level)) continue;
          // Quest Points are recorded as a gate above.
          if (skill !== 'Quest Points') skills[skill] = Math.max(skills[skill] ?? 0, level);
        }
      }
    }

    order.push(qid);
  };

  visit(rootQuestId);
  return { order, prereqs, regions, alternatives, manualSteps, skills, equipment, qpGates };
}

function buildPlanFromRequirements(
  targetKind: GoalKind,
  targetId: string,
  targetLabel: string,
  reqs: {
    order: string[]; regions: Set<string>; alternatives: Map<string, AlternativePlanStep>;
    manualSteps: Map<string, PlanStep>; skills: Record<string, number>;
    prereqs: Map<string, string[]>; qpGates: QpGate[];
    equipment: Map<string, { tier: number; labels: Set<string> }>;
    merchants?: Set<string>;
    mobility?: Set<string>;
    arcana?: Set<string>;
    minigames?: Set<string>;
  },
  unlocks: any,
  alreadyReachable: boolean,
  alreadyDone: boolean,
  needsConfirmation: boolean,
  gameModeId?: string,
): GoalPlan {
  // Region steps.
  const regionSteps = Array.from(reqs.regions)
    .map(region => areaPlanStep(region, gameModeId)).sort((a, b) => a.label.localeCompare(b.label));
  const alternativeSteps = [...reqs.alternatives.values()]
    .sort((a, b) => a.label.localeCompare(b.label));
  const manualSteps = [...reqs.manualSteps.values()];
  const merchantSteps: PlanStep[] = [...(reqs.merchants ?? [])].sort().map(label => (
    planStepForBlocker({ kind: 'merchant', label }, unlocks)
  ));
  const arcanaSteps: PlanStep[] = [...(reqs.arcana ?? [])].sort().map(label => (
    planStepForBlocker({ kind: 'arcana', label }, unlocks)
  ));
  const mobilitySteps: PlanStep[] = [...(reqs.mobility ?? [])].sort().map(label => (
    planStepForBlocker({ kind: 'mobility', label }, unlocks)
  ));
  const minigameSteps: PlanStep[] = [...(reqs.minigames ?? [])].sort().map(label => (
    planStepForBlocker({ kind: 'minigame', label }, unlocks)
  ));
  const equipmentSteps: PlanStep[] = [...reqs.equipment.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([slot, requirement]) => ({
      kind: 'equipment', id: slot, label: `${slot} T${requirement.tier}`,
      detail: `Unlock via Equipment (have T${unlocks.equipment?.[slot] ?? 0}): ${[...requirement.labels].join('; ')}`,
      unlockTable: TableType.EQUIPMENT, requiredTier: requirement.tier, done: false,
    }));

  // Skill steps.
  const skillSteps: PlanStep[] = Object.entries(reqs.skills)
    .map(([skill, lvl]): PlanStep => {
      const done = false;
      const rawLevel = skill === 'Combat level'
        ? actualCombatLevel(unlocks)
        : (unlocks.levels[skill] ?? 1);
      const have = skill === 'Combat level'
        ? rawLevel
        : effectiveSkillLevel(unlocks, skill);
      const tier = unlocks.skills[skill] ?? 0;
      const unlocked = tier > 0;
      const methodCap = skillCap(unlocks, skill);
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
        unlockTable: skill !== 'Combat level' && methodCap < lvl ? TableType.SKILLS : undefined,
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || a.id.localeCompare(b.id));

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
        unlockTable: TableType.QUESTS,
      };
    });

  // Quest-point shortfall: can the plan's quests earn each unmet gate's
  // points in time? A gated quest's own points, and those of quests that need
  // it first, only arrive after the gate — they can't count toward it. The
  // step reports the gate with the least headroom.
  let qpStep: PlanStep | undefined;
  const haveQP = currentQuestPoints(unlocks);
  const unmetGates = reqs.qpGates.filter(gate => gate.required > haveQP);
  if (unmetGates.length > 0) {
    const projectedFor = (gate: QpGate): number => {
      const tooLate = new Set<string>();
      if (gate.questId !== null) {
        tooLate.add(gate.questId);
        // Dependency order puts every prerequisite before the quests needing it.
        for (const qid of reqs.order) {
          if ((reqs.prereqs.get(qid) ?? []).some(prereq => tooLate.has(prereq))) tooLate.add(qid);
        }
      }
      return questSteps.reduce(
        (acc, s) => acc + (tooLate.has(s.id) ? 0 : questPointsFor(s.id)),
        haveQP,
      );
    };
    const tightest = unmetGates
      .map(gate => ({ required: gate.required, projected: projectedFor(gate) }))
      .reduce((worst, next) => (
        next.projected - next.required < worst.projected - worst.required ? next : worst
      ));
    qpStep = {
      kind: 'qp',
      id: 'Quest Points',
      label: 'Quest Points',
      detail:
        tightest.projected >= tightest.required
          ? `${tightest.required} QP — covered by this plan (${tightest.projected})`
          : `${tightest.required} QP — plan yields ${tightest.projected}, need more quests`,
      done: false,
    };
  }

  const steps: Array<PlanStep | AlternativePlanStep> = [
    ...regionSteps,
    ...equipmentSteps,
    ...merchantSteps,
    ...mobilitySteps,
    ...arcanaSteps,
    ...minigameSteps,
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
    equipmentSteps,
    merchantSteps,
    mobilitySteps,
    arcanaSteps,
    minigameSteps,
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
      gameModeId,
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
      prereqs: new Map<string, string[]>(),
      qpGates: [] as QpGate[],
      regions: new Set<string>(),
      alternatives: new Map<string, AlternativePlanStep>(),
      manualSteps: new Map<string, PlanStep>(),
      skills: {} as Record<string, number>,
      equipment: new Map<string, { tier: number; labels: Set<string> }>(),
      merchants: new Set<string>(),
      mobility: new Set<string>(),
      arcana: new Set<string>(),
      minigames: new Set<string>(),
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
        for (const [slot, requirement] of sub.equipment) {
          const previous = merged.equipment.get(slot);
          merged.equipment.set(slot, {
            tier: Math.max(previous?.tier ?? 0, requirement.tier),
            labels: new Set([...(previous?.labels ?? []), ...requirement.labels]),
          });
        }
        merged.qpGates.push(...sub.qpGates);
        for (const [questId, questPrereqs] of sub.prereqs) merged.prereqs.set(questId, questPrereqs);
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
          // The task itself is gated, so every quest in the plan can count.
          merged.qpGates.push({ required: task.questPoints, questId: null });
        }
        if (task.allQuests) {
          for (const qid of QUEST_CAPE_QUEST_IDS) mergeQuest(qid);
        }

        for (const check of eligibility.manualChecks) {
          addManualStep(merged.manualSteps, check, task.id, `Required for ${task.description}`);
        }
        const blockers = eligibility.blockers;
        for (const blocker of blockers) {
          if (blocker.kind === 'merchant') merged.merchants.add(blocker.label);
          if (blocker.kind === 'arcana') merged.arcana.add(blocker.label);
          if (blocker.kind === 'mobility') merged.mobility.add(blocker.label);
          if (blocker.kind === 'minigame') merged.minigames.add(blocker.label);
          if (blocker.kind === 'equipment') {
            const previous = merged.equipment.get(blocker.slot);
            merged.equipment.set(blocker.slot, {
              tier: Math.max(previous?.tier ?? 0, blocker.tier),
              labels: new Set([...(previous?.labels ?? []), blocker.label]),
            });
          }
          if (blocker.kind === 'region') merged.regions.add(canonicalAreaName(blocker.label));
          if (blocker.kind === 'alternative') {
            const label = 'One of: ' + blocker.label;
            merged.alternatives.set(label, {
              kind: 'alternative', id: 'alternative:' + task.id, label, done: false,
              routes: blocker.routes.map(route => ({
                label: route.label,
                blockers: route.blockers.map(routeBlocker => (
                  planStepForBlocker(routeBlocker, unlocks, gameModeId)
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
      gameModeId,
    );
  }

  // region
  const canonical = canonicalAreaName(id);
  const isUnlocked = isAreaReachable(canonical, unlocks, gameModeId);
  const regionStep: PlanStep = { ...areaPlanStep(canonical, gameModeId), done: isUnlocked };
  return {
    targetKind: 'region',
    targetId: canonical,
    targetLabel: displayAreaName(canonical),
    alreadyReachable: isUnlocked,
    alreadyDone: isUnlocked,
    needsConfirmation: false,
    manualSteps: [],
    questSteps: [],
    regionSteps: [regionStep],
    skillSteps: [],
    equipmentSteps: [],
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
