
import { RESOURCE_MAP, ResourceSource } from '../data/resourceData';
import { GameState, TableType } from '../types';
import { REGION_GROUPS, MERCHANTS_LIST } from '../constants';
import { isFreeArea } from './freeAreas';
import { isNamedAreaReachableViaChunks } from './reachability';
import { REGION_CHUNKS } from '../data/regionChunks';
import { canonicalAreaName } from '../data/areaMapPolicy';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';

export interface RouteStatus {
  isAvailable: boolean;
  missing: string[]; // Reasons for lock (e.g. "Region: Kandarin", "Slayer 60")
}

export interface SupplyChainResult {
  itemName: string;
  sources: {
    source: ResourceSource;
    status: RouteStatus;
  }[];
}

// Helpers for matching fuzzy merchant names
const normalize = (str: string) => str.toLowerCase().replace(/s$/, '').replace(/stores?/, 'shop').trim();

// Mapping for source names that don't auto-normalize to their Merchant Category
const PLURAL_MAPPINGS: Record<string, string> = {
    'ore seller': 'Ore Merchants',
    'sawmill operator': 'Sawmill Operators',
    'bar': 'Bars & Inns',
    'inn': 'Bars & Inns',
    'pub': 'Bars & Inns',
    'charter ship': 'Charter Ships',
    'charter ships': 'Charter Ships'
};

// Lookup tables built once from constants (independent of game state) so the
// hot path doesn't repeatedly scan the MERCHANTS_LIST array.
const MERCHANT_BY_NORM_NAME: Map<string, string> = new Map(
  MERCHANTS_LIST.map((m) => [normalize(m), m]),
);

/**
 * Precomputed view of the game state for fast availability checks.
 * Arrays from GameState are turned into Sets so the inner-loop `.includes`
 * calls (~10 per source check × 754 items) become O(1) lookups instead of
 * O(n) array scans.
 */
export interface AvailabilityContext {
  regions: Set<string>;
  quests: Set<string>;
  bosses: Set<string>;
  minigames: Set<string>;
  farming: Set<string>;
  merchants: Set<string>;
  guilds: Set<string>;
  mobility: Set<string>;
  arcana: Set<string>;
  storage: Set<string>;
  housing: Set<string>;
  levels: Record<string, number>;
  skillsUnlocked: Set<string>;
}

// Every named region/sub-area name that could appear in a source's `regions`
// list — used to build the Chunked-mode reachable set below.
const ALL_NAMED_AREAS: string[] = [...new Set([...Object.keys(REGION_CHUNKS), ...Object.keys(SUB_AREA_CHUNKS)])];

export const buildAvailabilityContext = (gs: GameState): AvailabilityContext => {
  const u = gs.unlocks;
  const skillsUnlocked = new Set<string>();
  for (const [k, v] of Object.entries(u.skills || {})) if ((v as number) > 0) skillsUnlocked.add(k);
  // Chunked mode has no unlocks.regions — instead, populate the regions Set
  // with every named area reachable via an unlocked chunk, so analyzeSource's
  // `ctx.regions.has(r)` check (and the isFreeArea(r) fallback) both work
  // unmodified for Chunked runs.
  const regions = gs.gameModeId === 'chunked'
    ? new Set(ALL_NAMED_AREAS
      .filter((name) => isNamedAreaReachableViaChunks(name, u.chunks ?? []))
      .map(canonicalAreaName))
    : new Set(u.regions.map(canonicalAreaName));
  return {
    regions,
    quests: new Set(u.quests),
    bosses: new Set(u.bosses),
    minigames: new Set(u.minigames),
    farming: new Set(u.farming),
    merchants: new Set(u.merchants),
    guilds: new Set(u.guilds),
    mobility: new Set(u.mobility),
    arcana: new Set(u.arcana),
    storage: new Set(u.storage),
    housing: new Set(u.housing),
    levels: u.levels || {},
    skillsUnlocked,
  };
};

/**
 * Analyze a single source against the context. Returns {isAvailable, missing}
 * for the detail UI; the missing array is only populated when needed (short-
 * circuited by `isSourceAvailable` for the boolean-only hot path).
 */
const analyzeSource = (source: ResourceSource, ctx: AvailabilityContext, collectMissing: boolean): RouteStatus => {
  const missing: string[] = [];
  const fail = (reason: string) => {
    if (collectMissing) missing.push(reason);
    return collectMissing; // keep going to collect all reasons when asked
  };

  // 1. Region
  let hasRegion = false;
  for (const authoredRegion of source.regions) {
    // Resource source geography is ownership metadata rather than a map-pin
    // instruction, so aliases intentionally resolve to their canonical owner.
    const r = canonicalAreaName(authoredRegion);
    if (r === 'Any' || isFreeArea(r) || ctx.regions.has(r)) {
      hasRegion = true; break;
    }
    const children = REGION_GROUPS[r];
    if (children) {
      for (const c of children) if (ctx.regions.has(c)) { hasRegion = true; break; }
      if (hasRegion) break;
    }
  }
  if (!hasRegion && !fail(`Region: ${source.regions.join(' or ')}`)) return { isAvailable: false, missing };

  // 2. Skills
  if (source.skills) {
    for (const [skill, req] of Object.entries(source.skills)) {
      if (!ctx.skillsUnlocked.has(skill)) {
        if (!fail(`Skill Locked: ${skill}`)) return { isAvailable: false, missing };
      } else {
        const lvl = ctx.levels[skill] || 1;
        if (lvl < (req as number) && !fail(`${skill} ${lvl}/${req}`)) return { isAvailable: false, missing };
      }
    }
  }

  // 3. Quests
  if (source.quests) {
    for (const q of source.quests) {
      if (!ctx.quests.has(q) && !fail(`Quest: ${q}`)) return { isAvailable: false, missing };
    }
  }

  // 4. Specific unlock
  if (source.unlockId) {
    const u = source.unlockId;
    const ok = ctx.bosses.has(u) || ctx.minigames.has(u) || ctx.farming.has(u) || ctx.merchants.has(u)
      || ctx.guilds.has(u) || ctx.mobility.has(u) || ctx.arcana.has(u) || ctx.storage.has(u) || ctx.housing.has(u);
    if (!ok && !fail(`Unlock: ${u}`)) return { isAvailable: false, missing };
  }

  // 5. Implicit merchant
  if ((source.type === 'SHOP' || source.type === 'MERCHANT') && !source.unlockId) {
    const lower = source.name.toLowerCase();
    let cat: string | undefined = PLURAL_MAPPINGS[lower] || MERCHANT_BY_NORM_NAME.get(normalize(source.name));
    if (cat === 'Charter Ships') {
      if (!ctx.mobility.has('Charter Ships') && !fail('Mobility: Charter Ships')) return { isAvailable: false, missing };
    } else if (cat) {
      if (!ctx.merchants.has(cat) && !fail(`Merchant: ${cat}`)) return { isAvailable: false, missing };
    }
  }

  return { isAvailable: missing.length === 0, missing };
};

/** Short-circuiting boolean check; allocates no missing-reasons array. */
const isSourceAvailable = (source: ResourceSource, ctx: AvailabilityContext): boolean =>
  analyzeSource(source, ctx, false).isAvailable;

export const calculateSupplyChain = (itemName: string, gameState: GameState): SupplyChainResult | null => {
  const sources = RESOURCE_MAP[itemName];
  if (!sources) return null;
  const ctx = buildAvailabilityContext(gameState);

  const analyzedSources = sources.map((source) => ({
    source,
    status: analyzeSource(source, ctx, true),
  }));

  return {
    itemName,
    sources: analyzedSources.sort((a, b) => (a.status.isAvailable === b.status.isAvailable) ? 0 : a.status.isAvailable ? -1 : 1),
  };
};

/**
 * Quick check: is an item obtainable through at least one source right now?
 * Short-circuits on the first available source and skips missing-reason
 * allocation entirely.
 */
export const isItemAvailable = (itemName: string, gameState: GameState): boolean => {
  const sources = RESOURCE_MAP[itemName];
  if (!sources) return false;
  const ctx = buildAvailabilityContext(gameState);
  return sources.some((s) => isSourceAvailable(s, ctx));
};

/**
 * Batch-friendly variant: caller builds the context once and reuses it across
 * many item checks (e.g. the Resource Engine's availability map over all 750+
 * items). Avoids rebuilding the Sets per item.
 */
export const isItemAvailableWithCtx = (itemName: string, ctx: AvailabilityContext): boolean => {
  const sources = RESOURCE_MAP[itemName];
  if (!sources) return false;
  return sources.some((s) => isSourceAvailable(s, ctx));
};

// --- Shortest-path-to-unlock -------------------------------------------------

export interface EasiestPath {
  source: ResourceSource;
  missing: string[];
  /** A coarse "effort score" used to compare paths — lower is closer. */
  cost: number;
}

/**
 * For a locked item, picks the source closest to being unlockable and surfaces
 * the requirements still in the way. Returns null when the item is already
 * available (or unknown).
 *
 * Cost heuristic: one point per missing requirement, with a smaller penalty
 * for skill level gaps (a few levels is much cheaper than a quest or an
 * entirely-locked unlock) and a discount when the missing requirement is
 * itself an item the player can already obtain via another source.
 */
/**
 * Classifies a missing-requirement string by gate type so the sort can rank
 * by real-world friction rather than a flat sum:
 *
 *   gacha  - region/unlock/merchant/mobility/etc. unlocks AND a skill the
 *            player hasn't rolled yet. All require landing the right Key on
 *            the right gacha table — the dominant gate in Fate Locked.
 *   quest  - just play the quest; no luck involved.
 *   level  - just train the skill; gap-weighted but treated as the cheapest
 *            category overall.
 */
type GateKind = 'gacha' | 'quest' | 'level';
const classifyReason = (reason: string): { kind: GateKind; gap: number } => {
  const lvl = reason.match(/(\d+)\/(\d+)$/);
  if (lvl) return { kind: 'level', gap: Number(lvl[2]) - Number(lvl[1]) };
  if (reason.startsWith('Quest:')) return { kind: 'quest', gap: 0 };
  // Region:, Unlock:, Merchant:, Mobility:, Skill Locked: — all gacha.
  return { kind: 'gacha', gap: 0 };
};

interface GateCost { gacha: number; quest: number; levelGap: number }
const tallyGates = (missing: string[]): GateCost => {
  let gacha = 0, quest = 0, levelGap = 0;
  for (const r of missing) {
    const c = classifyReason(r);
    if (c.kind === 'gacha') gacha++;
    else if (c.kind === 'quest') quest++;
    else levelGap += c.gap;
  }
  return { gacha, quest, levelGap };
};

/** Single scalar for backwards compat (Resource Engine detail panel uses it). */
const scalarCost = (missing: string[]): number => {
  const g = tallyGates(missing);
  // Heavy weight on gacha (the actual hard part), light on level gaps.
  return g.gacha * 10 + g.quest * 3 + g.levelGap * 0.1;
};

const compareGateCost = (a: GateCost, b: GateCost): number =>
  a.gacha - b.gacha || a.quest - b.quest || a.levelGap - b.levelGap;

/**
 * Batch-friendly: caller builds the context once and reuses it across all
 * items (the "next achievable items" recommendation walks every RESOURCE_MAP
 * entry and would otherwise rebuild the Sets ~750 times).
 */
export const findEasiestPathWithCtx = (itemName: string, ctx: AvailabilityContext): EasiestPath | null => {
  const sources = RESOURCE_MAP[itemName];
  if (!sources) return null;
  if (sources.some((s) => isSourceAvailable(s, ctx))) return null;

  let best: { source: ResourceSource; missing: string[]; gates: GateCost } | null = null;
  for (const source of sources) {
    const status = analyzeSource(source, ctx, true);
    if (status.isAvailable) continue;
    const gates = tallyGates(status.missing);
    if (!best || compareGateCost(gates, best.gates) < 0) {
      best = { source, missing: status.missing, gates };
    }
  }
  if (!best) return null;
  // Sort the missing array so the chip surfaces the hardest gate first (gacha
  // > quest > level), then by ascending level gap. Makes the "closest to
  // unlocking" panel's preview line genuinely informative.
  best.missing = [...best.missing].sort((a, b) => {
    const ca = classifyReason(a); const cb = classifyReason(b);
    const order = { gacha: 0, quest: 1, level: 2 } as const;
    return order[ca.kind] - order[cb.kind] || ca.gap - cb.gap;
  });
  return { source: best.source, missing: best.missing, cost: scalarCost(best.missing) };
};

export const findEasiestPath = (itemName: string, gameState: GameState): EasiestPath | null =>
  findEasiestPathWithCtx(itemName, buildAvailabilityContext(gameState));

/**
 * Goal-tracker-compatible progress for a Resource Engine item. Same shape as
 * GoalProgress in goalLogic, so the GoalTracker UI can render engine-item
 * goals next to strategy-database goals without special-casing.
 *
 * "Total steps" is the count of requirements on the easiest source: regions
 * + skills + quests + (1 for an unlockId, if set). "Completed" is total -
 * missing. We clamp the displayed percentage to 99 when anything is missing,
 * matching calculateGoalProgress's behaviour.
 */
export interface EngineItemProgress {
  percentage: number;
  missing: string[];
  totalSteps: number;
  completedSteps: number;
}
export const calculateEngineItemProgress = (itemName: string, gameState: GameState): EngineItemProgress | null => {
  const sources = RESOURCE_MAP[itemName];
  if (!sources) return null;
  const ctx = buildAvailabilityContext(gameState);

  // Already obtainable — show 100% and an empty missing list.
  if (sources.some((s) => isSourceAvailable(s, ctx))) {
    return { percentage: 100, missing: [], totalSteps: 1, completedSteps: 1 };
  }

  const path = findEasiestPathWithCtx(itemName, ctx)!;
  const s = path.source;
  const total =
    s.regions.length +
    Object.keys(s.skills || {}).length +
    (s.quests?.length || 0) +
    (s.unlockId ? 1 : 0);
  const completed = Math.max(0, total - path.missing.length);
  let percentage = total === 0 ? 100 : Math.round((completed / total) * 100);
  if (percentage === 100 && path.missing.length > 0) percentage = 99;
  return { percentage, missing: path.missing, totalSteps: total, completedSteps: completed };
};

/**
 * Scans every locked item in RESOURCE_MAP and ranks them by the effort of
 * their easiest unlock route. Used for the "Closest to unlocking" panel —
 * a top-down view that complements the search-driven drill-down.
 */
export interface AchievableItem {
  item: string;
  cost: number;
  missing: string[];
  source: ResourceSource;
}
export const getNextAchievableItems = (gameState: GameState, limit: number = 8): AchievableItem[] => {
  const ctx = buildAvailabilityContext(gameState);
  const candidates: Array<AchievableItem & { gates: GateCost }> = [];
  for (const item of Object.keys(RESOURCE_MAP)) {
    const path = findEasiestPathWithCtx(item, ctx);
    if (path) candidates.push({
      item, cost: path.cost, missing: path.missing, source: path.source,
      gates: tallyGates(path.missing),
    });
  }
  // Lexicographic: fewer gacha gates first, then fewer quests, then smaller
  // level gaps. Mirrors the actual friction order in Fate Locked — a single
  // gacha unlock is much harder than several skill levels to grind.
  candidates.sort((a, b) => compareGateCost(a.gates, b.gates) || a.item.localeCompare(b.item));
  return candidates.slice(0, limit).map(({ gates, ...rest }) => rest);
};

// --- Recursive Material Breakdown -------------------------------------------

export interface MaterialNode {
  item: string;
  qty: number;            // total quantity of this item needed
  isRaw: boolean;         // true = no further recipe (gathered / bought / dropped)
  children: MaterialNode[];
}

const MAX_BREAKDOWN_DEPTH = 10;

/**
 * Recursively expand an item into the raw materials needed to craft `qty` of it.
 *
 * Walks the first recipe-style source (one with `inputs`) for each item,
 * scaling input quantities by the number of crafting operations required.
 * `path` guards against circular recipes (e.g. A needs B needs A).
 */
export const computeFullBreakdown = (
  itemName: string,
  qty: number,
  path: string[] = [],
): MaterialNode => {
  const sources = RESOURCE_MAP[itemName];
  const recipe = sources?.find(s => s.inputs && Object.keys(s.inputs).length > 0);

  // Leaf node: no recipe, cycle detected, or depth exceeded.
  if (!recipe || !recipe.inputs || path.includes(itemName) || path.length >= MAX_BREAKDOWN_DEPTH) {
    return { item: itemName, qty, isRaw: true, children: [] };
  }

  const yieldPerAction = recipe.outputYield || 1;
  const opsRequired = Math.ceil(qty / yieldPerAction);
  const nextPath = [...path, itemName];

  const children = Object.entries(recipe.inputs)
    // Skip tool-style inputs (qty 0, e.g. "Knife": 0) and free-form coins.
    .filter(([name, n]) => (n as number) > 0 && name !== 'Coins')
    .map(([name, n]) => computeFullBreakdown(name, (n as number) * opsRequired, nextPath));

  return { item: itemName, qty, isRaw: false, children };
};

/** Flatten a breakdown tree into a summed list of raw materials. */
export const flattenRawMaterials = (node: MaterialNode): { item: string; qty: number }[] => {
  const totals: Record<string, number> = {};
  const walk = (n: MaterialNode) => {
    if (n.isRaw) {
      totals[n.item] = (totals[n.item] || 0) + n.qty;
    } else {
      n.children.forEach(walk);
    }
  };
  node.children.forEach(walk);
  return Object.entries(totals)
    .map(([item, qty]) => ({ item, qty }))
    .sort((a, b) => a.item.localeCompare(b.item));
};

/**
 * Combine the raw-material breakdowns of multiple targets into a single
 * deduplicated list. Used by the Bulk Planner: a player picks a basket of
 * items to craft (e.g. 100 Prayer Potions + 50 Super Combats) and gets the
 * consolidated shopping list across all of them.
 */
export const flattenMultiBreakdown = (targets: Record<string, number>): { item: string; qty: number }[] => {
  const totals: Record<string, number> = {};
  for (const [item, qty] of Object.entries(targets)) {
    if (!qty || qty <= 0 || !RESOURCE_MAP[item]) continue;
    const leaves = flattenRawMaterials(computeFullBreakdown(item, qty));
    for (const { item: leaf, qty: q } of leaves) {
      totals[leaf] = (totals[leaf] || 0) + q;
    }
  }
  return Object.entries(totals)
    .map(([item, qty]) => ({ item, qty }))
    .sort((a, b) => a.item.localeCompare(b.item));
};
