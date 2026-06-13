import { GameState, TableType, UnlockState } from '../types';
import { STRATEGY_DATABASE, ContentRequirement } from '../data/requirements';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { RESOURCE_MAP } from '../data/resourceData';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';
import { calculateSupplyChain } from './supplyChain';
import { getPoolAndStateKey, isValidUnlock } from './gameEngine';
import { tierForLevel } from './skillTiers';

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

export interface GoalRoute {
  goalId: string;
  kind: 'strategy' | 'quest' | 'diary' | 'engine-item';
  description?: string;
  quests: RouteItem[];
  regions: RouteItem[];
  skills: RouteSkill[];
  diaries: RouteItem[];
  questPoints?: { need: number; have: number; met: boolean };
  sources: RouteSource[];
  tables: TableSuggestion[];
  totalSteps: number;
  completedSteps: number;
  percentage: number;
}

// Tier ↔ level model now lives in one place (utils/skillTiers); re-exported
// here so existing callers and tests keep working unchanged.
export { tierForLevel };

const isRegionMet = (r: string, unlocks: UnlockState): boolean => {
  if (r === 'Misthalin' || MISTHALIN_AREAS.includes(r) || unlocks.regions.includes(r)) return true;
  const children = REGION_GROUPS[r];
  return !!children && children.some(a => unlocks.regions.includes(a));
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
  const diary = DIARY_DATA[goalId];
  if (diary) {
    return {
      kind: 'diary',
      req: {
        id: diary.id, category: TableType.DIARIES, regions: diary.requiredRegions,
        skills: diary.skills, quests: diary.quests,
        description: `${diary.region} · ${diary.tier}`,
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
    const neededNames = new Set<string>();
    for (const s of sources) {
      if (s.available) continue;
      for (const m of s.missing) collectNeededFromMissing(m, unlocks, neededNames);
    }
    const tables = suggestTables(neededNames, unlocks);
    const total = Math.max(1, sources.length);
    const done = sources.filter(s => s.available).length;
    return {
      goalId, kind: 'engine-item', description: 'Resource Engine item',
      quests: [], regions: [], skills: [], diaries: [], sources, tables,
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
  const regionSet = new Set<string>(req.regions);
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
    for (const r of q.regions) regionSet.add(r);
  }

  const regions: RouteItem[] = [...regionSet].sort().map(r => ({
    name: r,
    met: isRegionMet(r, unlocks),
    detail: REGION_GROUPS[r] ? 'any sub-area counts' : undefined,
  }));

  const skills: RouteSkill[] = [...skillNeed.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([skill, need]) => {
      const have = unlocks.levels[skill] ?? 1;
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

  const haveQp = unlocks.quests.reduce((acc, id) => acc + (QUEST_DATA[id]?.points ?? 0), 0);
  const questPoints = qpNeed > 0 ? { need: qpNeed, have: haveQp, met: haveQp >= qpNeed } : undefined;

  // ── Which key tables help ────────────────────────────────────────────────
  const neededNames = new Set<string>();
  for (const r of regions) {
    if (r.met) continue;
    if (REGION_GROUPS[r.name]) {
      for (const child of REGION_GROUPS[r.name]) {
        if (!unlocks.regions.includes(child)) neededNames.add(child);
      }
    } else {
      neededNames.add(r.name);
    }
  }
  for (const s of skills) if (!s.met) neededNames.add(s.skill);
  const tables = suggestTables(neededNames, unlocks);

  // ── Totals ────────────────────────────────────────────────────────────────
  const items: { met: boolean }[] = [...quests, ...regions, ...skills, ...diaries];
  if (questPoints) items.push({ met: questPoints.met });
  const total = Math.max(1, items.length);
  const done = items.filter(i => i.met).length;

  return {
    goalId, kind, description: req.description,
    quests, regions, skills, diaries, questPoints,
    sources: [], tables,
    totalSteps: total, completedSteps: done,
    percentage: Math.round((done / total) * 100),
  };
}

/** Parse a supply-chain "missing" reason into unlockable names. */
function collectNeededFromMissing(missing: string, unlocks: UnlockState, out: Set<string>) {
  const region = missing.match(/^Region: (.+)$/);
  if (region) {
    for (const r of region[1].split(' or ')) {
      const name = r.trim();
      if (REGION_GROUPS[name]) {
        for (const child of REGION_GROUPS[name]) {
          if (!unlocks.regions.includes(child)) out.add(child);
        }
      } else {
        out.add(name);
      }
    }
    return;
  }
  const tagged = missing.match(/^(Unlock|Merchant|Mobility): (.+)$/);
  if (tagged) { out.add(tagged[2].trim()); return; }
  const lockedSkill = missing.match(/^Skill Locked: (.+)$/);
  if (lockedSkill) { out.add(lockedSkill[1].trim()); return; }
}

/** Rank spend tables by the chance a draw advances the goal. */
export function suggestTables(neededNames: Set<string>, unlocks: UnlockState): TableSuggestion[] {
  if (neededNames.size === 0) return [];
  const out: TableSuggestion[] = [];
  for (const table of Object.values(TableType)) {
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
