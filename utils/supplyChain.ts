
import { RESOURCE_MAP, ResourceSource } from '../data/resourceData';
import { GameState, TableType } from '../types';
import { REGION_GROUPS, MISTHALIN_AREAS, MERCHANTS_LIST } from '../constants';

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
// hot path doesn't repeatedly scan MISTHALIN_AREAS / MERCHANTS_LIST arrays.
const MISTHALIN_AREA_SET: Set<string> = new Set(MISTHALIN_AREAS);
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

export const buildAvailabilityContext = (gs: GameState): AvailabilityContext => {
  const u = gs.unlocks;
  const skillsUnlocked = new Set<string>();
  for (const [k, v] of Object.entries(u.skills || {})) if ((v as number) > 0) skillsUnlocked.add(k);
  return {
    regions: new Set(u.regions),
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
  for (const r of source.regions) {
    if (r === 'Any' || r === 'Misthalin' || MISTHALIN_AREA_SET.has(r) || ctx.regions.has(r)) {
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
