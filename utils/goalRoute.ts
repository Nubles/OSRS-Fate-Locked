import { GameState, TableType, UnlockState } from '../types';
import { STRATEGY_DATABASE, ContentRequirement } from '../data/requirements';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { RESOURCE_MAP } from '../data/resourceData';
import { REGION_GROUPS } from '../constants';
import { canonicalAreaName, displayAreaName } from '../data/areaMapPolicy';
import { isAreaReachable } from './reachability';
import { calculateSupplyChain } from './supplyChain';
import { getPoolAndStateKey, isValidUnlock } from './gameEngine';
import { tierForLevel } from './skillTiers';
import { planForTarget, type PlanStep } from './goalPlanner';
import { evaluateDiaryTierEligibility } from './journalStatus';
import { effectiveCombatLevel, effectiveSkillLevel } from './slayerReach';

/**
 * Route to goal — the planning brain behind a pinned goal.
 *
 * Where GoalTracker shows a flat % and the first missing requirement, this
 * builds the full route: the transitive quest chain in completion order, every
 * region and skill tier the chain needs, the item sources for Resource Engine
 * goals — each marked met/unmet against the live run — and which key tables
 * are statistically most likely to advance the goal on the next spend.
 */

export interface RouteItem {
  name: string;
  met: boolean;
  /** Optional context, e.g. "needs Asgarnia · any sub-area" or "prereq of X". */
  detail?: string;
}

export interface RouteSkill {
  skill: string;
  needLevel: number;
  haveLevel: number;
  unlocked: boolean;
  /** Skill tier that caps training at/above needLevel (cap = tier × 10). */
  tierNeeded: number;
  tierHave: number;
  met: boolean;
}

export interface RouteSource {
  type: string;
  name: string;
  available: boolean;
  missing: string[];
}

export interface TableSuggestion {
  table: TableType;
  /** Locked pool entries that would advance this goal. */
  needed: string[];
  poolRemaining: number;
  /** needed / poolRemaining — chance a draw from this table helps. */
  odds: number;
}

/** A needed unlock with its authoritative gacha-table provenance. */
export interface TableDependency {
  table: TableType;
  id: string;
}

export interface RouteAlternative {
  name: string;
  met: boolean;
  routes: RouteItem[];
}

export interface GoalRoute {
  goalId: string;
  kind: 'strategy' | 'quest' | 'diary' | 'engine-item';
  description?: string;
  quests: RouteItem[];
  regions: RouteItem[];
  skills: RouteSkill[];
  alternatives: RouteAlternative[];
  diaries: RouteItem[];
  questPoints?: { need: number; have: number; met: boolean };
  sources: RouteSource[];
  tables: TableSuggestion[];
  totalSteps: number;
  completedSteps: number;
  percentage: number;
}

function tableDependenciesForSteps(steps: readonly PlanStep[]): TableDependency[] {
  const dependencies: TableDependency[] = [];
  for (const step of steps) {
    if (!step.unlockTable) continue;
    for (const id of step.relatedIds ?? [step.id]) {
      dependencies.push({ table: step.unlockTable, id });
    }
  }
  return dependencies;
}


// Tier ↔ level model now lives in one place (utils/skillTiers); re-exported
// here so existing callers and tests keep working unchanged.
export { tierForLevel };

const isRegionMet = (r: string, unlocks: UnlockState, gameModeId?: string): boolean => {
  const canonical = canonicalAreaName(r);
  if (isAreaReachable(canonical, unlocks, gameModeId)) return true;
  const children = REGION_GROUPS[canonical];
  return !!children && children.some(a => isAreaReachable(a, unlocks, gameModeId));
};

/** Resolve a pinned goal id the same way GoalTracker does. */
function resolveRequirement(goalId: string): { req: ContentRequirement | null; kind: GoalRoute['kind'] } {
  const strat = STRATEGY_DATABASE[goalId];
  if (strat) return { req: strat, kind: 'strategy' };
  const quest = QUEST_DATA[goalId];
  if (quest) {
    return {
      kind: 'quest',
      req: {
        id: quest.name, category: TableType.QUESTS, regions: quest.regions,
        skills: quest.skills, quests: quest.prereqs,
        description: quest.series ? `Series: ${quest.series}` : undefined,
      },
    };
  }
  return { req: null, kind: 'engine-item' };
}

/**
 * Transitive quest closure in completion order (prerequisites first).
 * Seeds are the goal's direct quest requirements (plus the goal itself when
 * the goal IS a quest).
 */
export function expandQuestChain(seeds: string[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const q = QUEST_DATA[id];
    if (q) for (const p of q.prereqs) visit(p);
    if (q) order.push(id); // only include quests the data actually knows
  };
  for (const s of seeds) visit(s);
  return order;
}

export function buildGoalRoute(goalId: string, gameState: GameState): GoalRoute | null {
  const unlocks = gameState.unlocks;
  const gameModeId = gameState.gameModeId;
  const diary = DIARY_DATA[goalId];
  if (diary) {
    const plan = planForTarget('diary', goalId, unlocks, gameModeId);
    if (!plan) return null;
    const eligibility = evaluateDiaryTierEligibility(diary, unlocks, gameModeId);
    const quests: RouteItem[] = plan.questSteps.map(step => ({
      name: step.label,
      met: step.done,
      detail: step.detail,
    }));
    const regions: RouteItem[] = plan.regionSteps.map(step => ({
      name: step.label,
      met: step.done,
      detail: step.detail,
    }));
    const alternatives: RouteAlternative[] = plan.alternativeSteps.map(step => ({
      name: step.label,
      met: step.done,
      routes: step.routes.map(route => ({
        name: route.label,
        met: route.blockers.length === 0,
        detail: route.label + (route.blockers.length > 0
          ? ': ' + route.blockers.map(blocker => (
            blocker.label + (blocker.detail ? ' ' + blocker.detail : '')
          )).join(' + ')
          : ''),
      })),
    }));
    const skills: RouteSkill[] = plan.skillSteps.map(step => {
      const needLevel = Number(step.detail?.match(/\d+/)?.[0] ?? 1);
      const isCombat = step.id === 'Combat level';
      const haveLevel = isCombat
        ? effectiveCombatLevel(unlocks)
        : effectiveSkillLevel(unlocks, step.id);
      const tierHave = isCombat ? 0 : (unlocks.skills[step.id] ?? 0);
      return {
        skill: step.id,
        needLevel,
        haveLevel,
        unlocked: isCombat || tierHave > 0,
        tierNeeded: isCombat ? 0 : tierForLevel(needLevel),
        tierHave,
        met: step.done,
      };
    });
    const dependencies = tableDependenciesForSteps([
      ...plan.questSteps,
      ...plan.regionSteps,
      ...plan.skillSteps,
      ...plan.alternativeSteps.flatMap(step => step.routes.flatMap(route => route.blockers)),
    ]);
    const totalSteps = eligibility.evidence.length + eligibility.blockers.length;
    const completedSteps = eligibility.evidence.length;
    return {
      goalId,
      kind: 'diary',
      description: `${diary.region} - ${diary.tier}`,
      quests,
      regions,
      skills,
      alternatives,
      diaries: [],
      sources: [],
      tables: suggestTables(dependencies, unlocks),
      totalSteps,
      completedSteps,
      percentage: eligibility.eligible || eligibility.status === 'COMPLETED'
        ? 100
        : totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100),
    };
  }

  // Pure quest goals use the canonical planner so direct and transitive one-of
  // access routes stay structured instead of being flattened into fake regions.
  if (QUEST_DATA[goalId] && !STRATEGY_DATABASE[goalId]) {
    const quest = QUEST_DATA[goalId];
    const plan = planForTarget('quest', goalId, unlocks, gameModeId);
    if (!plan) return null;
    const quests: RouteItem[] = plan.questSteps.map(step => ({
      name: step.label, met: step.done, detail: step.detail,
    }));
    const regions: RouteItem[] = plan.regionSteps.map(step => ({
      name: step.label, met: step.done, detail: step.detail,
    }));
    const alternatives: RouteAlternative[] = plan.alternativeSteps.map(step => ({
      name: step.label,
      met: step.done,
      routes: step.routes.map(route => ({
        name: route.label,
        met: route.blockers.length === 0,
        detail: route.label + (route.blockers.length > 0
          ? ': ' + route.blockers.map(blocker => (
            blocker.label + (blocker.detail ? ' ' + blocker.detail : '')
          )).join(' + ')
          : ''),
      })),
    }));
    const skills: RouteSkill[] = plan.skillSteps.map(step => {
      const needLevel = Number(step.detail?.match(/\d+/)?.[0] ?? 1);
      const isCombat = step.id === 'Combat level';
      const haveLevel = isCombat
        ? effectiveCombatLevel(unlocks)
        : effectiveSkillLevel(unlocks, step.id);
      const tierHave = isCombat ? 0 : (unlocks.skills[step.id] ?? 0);
      return {
        skill: step.id,
        needLevel,
        haveLevel,
        unlocked: isCombat || tierHave > 0,
        tierNeeded: isCombat ? 0 : tierForLevel(needLevel),
        tierHave,
        met: step.done,
      };
    });
    const dependencies = tableDependenciesForSteps([
      ...plan.questSteps,
      ...plan.regionSteps,
      ...plan.skillSteps,
      ...plan.alternativeSteps.flatMap(step => step.routes.flatMap(route => route.blockers)),
    ]);
    const qpNeed = Number(plan.qpStep?.detail?.match(/\d+/)?.[0] ?? 0);
    const qpHave = unlocks.quests.reduce(
      (total, id) => total + (QUEST_DATA[id]?.points ?? 0), 0,
    );
    const totalSteps = Math.max(1, plan.steps.length);
    const completedSteps = plan.alreadyDone
      ? totalSteps
      : plan.steps.filter(step => step.done).length;
    return {
      goalId,
      kind: 'quest',
      description: quest.series ? 'Series: ' + quest.series : undefined,
      quests,
      regions,
      skills,
      alternatives,
      diaries: [],
      questPoints: qpNeed > 0 ? { need: qpNeed, have: qpHave, met: qpHave >= qpNeed } : undefined,
      sources: [],
      tables: suggestTables(dependencies, unlocks),
      totalSteps,
      completedSteps,
      percentage: Math.round((completedSteps / totalSteps) * 100),
    };
  }

  const { req, kind } = resolveRequirement(goalId);

  // ── Resource Engine item goals: route = its sources + tables ─────────────
  if (!req) {
    if (!RESOURCE_MAP[goalId]) return null;
    const chain = calculateSupplyChain(goalId, gameState);
    const sources: RouteSource[] = (chain?.sources ?? []).map(s => ({
      type: s.source.type,
      name: s.source.name,
      available: s.status.isAvailable,
      missing: s.status.missing,
    }));
    const dependencies: TableDependency[] = [];
    for (const s of sources) {
      if (s.available) continue;
      for (const m of s.missing) collectNeededFromMissing(m, unlocks, dependencies, gameModeId);
    }
    const tables = suggestTables(dependencies, unlocks);
    const total = Math.max(1, sources.length);
    const done = sources.filter(s => s.available).length;
    return {
      goalId, kind: 'engine-item', description: 'Resource Engine item',
      quests: [], regions: [], skills: [], alternatives: [], diaries: [], sources, tables,
      totalSteps: total, completedSteps: done,
      percentage: sources.some(s => s.available) ? 100 : Math.round((done / total) * 100),
    };
  }

  // ── Quest chain (transitive, ordered) ────────────────────────────────────
  // When the goal itself is a quest (true for quest goals AND for strategy
  // entries that mirror one, e.g. Dragon Slayer II), it belongs at the end of
  // its own chain.
  const seeds = [...(req.quests ?? [])];
  if (QUEST_DATA[goalId]) seeds.push(goalId);
  const chainIds = expandQuestChain(seeds);
  const quests: RouteItem[] = chainIds.map(id => ({
    name: id,
    met: unlocks.quests.includes(id),
  }));
  // Strategy quests not in QUEST_DATA (defensive) still surface:
  for (const q of req.quests ?? []) {
    if (!QUEST_DATA[q] && !quests.some(x => x.name === q)) {
      quests.push({ name: q, met: unlocks.quests.includes(q) });
    }
  }

  // ── Aggregate skills + regions + quest points across the whole chain ─────
  const skillNeed = new Map<string, number>();
  let qpNeed = 0;
  const regionSet = new Set<string>((req.regions ?? []).map(canonicalAreaName));
  const addSkills = (skills: Record<string, number>) => {
    for (const [skill, lvl] of Object.entries(skills)) {
      if (skill === 'Quest Points') { qpNeed = Math.max(qpNeed, lvl); continue; }
      skillNeed.set(skill, Math.max(skillNeed.get(skill) ?? 0, lvl));
    }
  };
  addSkills(req.skills);
  for (const id of chainIds) {
    const q = QUEST_DATA[id];
    if (!q) continue;
    addSkills(q.skills);
    for (const r of q.regions) regionSet.add(canonicalAreaName(r));
  }

  const regions: RouteItem[] = [...regionSet].sort().map(r => ({
    name: displayAreaName(r),
    met: isRegionMet(r, unlocks, gameModeId),
    detail: REGION_GROUPS[r] ? 'any sub-area counts' : undefined,
  }));

  const skills: RouteSkill[] = [...skillNeed.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([skill, need]) => {
      const have = effectiveSkillLevel(unlocks, skill);
      const tierHave = unlocks.skills[skill] ?? 0;
      const unlocked = tierHave > 0;
      return {
        skill, needLevel: need, haveLevel: have, unlocked,
        tierNeeded: tierForLevel(need), tierHave,
        met: unlocked && have >= need,
      };
    });

  const diaries: RouteItem[] = (req.diaries ?? []).map(d => ({
    name: d,
    met: unlocks.diaries.includes(d),
  }));

  // Strategy-backed quest goals retain their curated strategy requirements,
  // while canonical planning contributes structured access choices from every
  // direct or transitive quest in the chain.
  const canonicalQuestPlan = QUEST_DATA[goalId]
    ? planForTarget('quest', goalId, unlocks, gameModeId)
    : null;
  const alternatives: RouteAlternative[] = (canonicalQuestPlan?.alternativeSteps ?? [])
    .map(step => ({
      name: step.label,
      met: step.done,
      routes: step.routes.map(route => ({
        name: route.label,
        met: route.blockers.length === 0,
        detail: route.label + (route.blockers.length > 0
          ? ': ' + route.blockers.map(blocker => (
            blocker.label + (blocker.detail ? ' ' + blocker.detail : '')
          )).join(' + ')
          : ''),
      })),
    }));

  const haveQp = unlocks.quests.reduce((acc, id) => acc + (QUEST_DATA[id]?.points ?? 0), 0);
  const questPoints = qpNeed > 0 ? { need: qpNeed, have: haveQp, met: haveQp >= qpNeed } : undefined;

  // ── Which key tables help ────────────────────────────────────────────────
  const dependencies: TableDependency[] = [];
  for (const region of regionSet) {
    if (isRegionMet(region, unlocks, gameModeId)) continue;
    if (REGION_GROUPS[region]) {
      for (const child of REGION_GROUPS[region]) {
        if (!isAreaReachable(child, unlocks, gameModeId)) {
          dependencies.push({ table: TableType.REGIONS, id: child });
        }
      }
    } else {
      dependencies.push({ table: TableType.REGIONS, id: region });
    }
  }
  for (const s of skills) {
    if (!s.met) dependencies.push({ table: TableType.SKILLS, id: s.skill });
  }
  dependencies.push(...tableDependenciesForSteps(
    canonicalQuestPlan?.alternativeSteps.flatMap(step => step.routes.flatMap(route => route.blockers)) ?? [],
  ));
  const tables = suggestTables(dependencies, unlocks);

  // ── Totals ────────────────────────────────────────────────────────────────
  const items: { met: boolean }[] = [
    ...quests, ...regions, ...skills, ...alternatives, ...diaries,
  ];
  if (questPoints) items.push({ met: questPoints.met });
  const total = Math.max(1, items.length);
  const done = items.filter(i => i.met).length;

  return {
    goalId, kind, description: req.description,
    quests, regions, skills, alternatives, diaries, questPoints,
    sources: [], tables,
    totalSteps: total, completedSteps: done,
    percentage: Math.round((done / total) * 100),
  };
}

/** Parse a supply-chain "missing" reason into table-qualified unlocks. */
function collectNeededFromMissing(
  missing: string,
  unlocks: UnlockState,
  out: TableDependency[],
  gameModeId?: string,
) {
  const region = missing.match(/^Region: (.+)$/);
  if (region) {
    for (const r of region[1].split(' or ')) {
      const name = canonicalAreaName(r.trim());
      if (REGION_GROUPS[name]) {
        for (const child of REGION_GROUPS[name]) {
          if (!isAreaReachable(child, unlocks, gameModeId)) {
            out.push({ table: TableType.REGIONS, id: child });
          }
        }
      } else {
        out.push({ table: TableType.REGIONS, id: name });
      }
    }
    return;
  }
  const tagged = missing.match(/^(Merchant|Mobility): (.+)$/);
  if (tagged) {
    out.push({
      table: tagged[1] === 'Merchant' ? TableType.MERCHANTS : TableType.MOBILITY,
      id: tagged[2].trim(),
    });
    return;
  }
  const lockedSkill = missing.match(/^Skill Locked: (.+)$/);
  if (lockedSkill) {
    out.push({ table: TableType.SKILLS, id: lockedSkill[1].trim() });
  }
}

/** Rank spend tables by the chance a draw advances the goal. */
export function suggestTables(
  dependencies: Iterable<TableDependency>,
  unlocks: UnlockState,
): TableSuggestion[] {
  const neededByTable = new Map<TableType, Set<string>>();
  for (const { table, id } of dependencies) {
    if (!id) continue;
    const names = neededByTable.get(table) ?? new Set<string>();
    names.add(id);
    neededByTable.set(table, names);
  }
  if (neededByTable.size === 0) return [];
  const out: TableSuggestion[] = [];
  for (const [table, neededNames] of neededByTable) {
    let pool: string[];
    try {
      pool = getPoolAndStateKey(table).pool;
    } catch {
      continue; // tables without a gacha pool (Quests, Diaries, CAs)
    }
    if (!pool || pool.length === 0) continue;
    const remaining = pool.filter(item => isValidUnlock(table, item, unlocks));
    if (remaining.length === 0) continue;
    const needed = remaining.filter(item => neededNames.has(item));
    if (needed.length === 0) continue;
    out.push({
      table,
      needed: needed.sort(),
      poolRemaining: remaining.length,
      odds: needed.length / remaining.length,
    });
  }
  return out.sort((a, b) => b.odds - a.odds).slice(0, 4);
}
