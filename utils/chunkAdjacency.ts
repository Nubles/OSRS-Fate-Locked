import { CHUNK_BOAT_LANDINGS } from '../data/chunkTransportLinks';
import { OCEAN_CHUNK_KEYS, canNavigateOcean, type SailingAccount } from './oceanAccess';
import type { ChunkCoord } from './mapCoords';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';

/**
 * Chunked mode's frontier logic: unlocking is one map-region chunk at a time,
 * with orthogonal land adjacency before Sailing. After unlocking Sailing and
 * completing Pandemonium, connected ocean and reviewed boat landings extend
 * the land frontier. Water never enters the paid chunk pool.
 */

export const chunkKey = ({ cx, cy }: ChunkCoord): string => `${cx},${cy}`;

export const parseChunkKey = (key: string): ChunkCoord => {
  const [cx, cy] = key.split(',').map(Number);
  return { cx, cy };
};

// Every authored land chunk, deduped, flattened from the per-region
// authoring data. This is the universe Chunked mode draws its frontier from.
export const ALL_CHUNKS: ChunkCoord[] = (() => {
  const seen = new Map<string, ChunkCoord>();
  for (const chunks of Object.values(REGION_CHUNKS)) {
    for (const c of chunks) seen.set(chunkKey(c), c);
  }
  return [...seen.values()];
})();

export const ALL_CHUNK_KEYS: string[] = ALL_CHUNKS.map(chunkKey);

const NEIGHBOR_OFFSETS = [
  { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
] as const;

/**
 * The Lumbridge castle courtyard chunk — Chunked mode's fixed starting point.
 * Free from the start, the same way Lumbridge is free in Xtreme (see
 * utils/freeAreas.ts) — it's never pushed into unlocks.chunks, just treated
 * as unlocked everywhere via isChunkUnlocked() below.
 */
export const CHUNKED_START: ChunkCoord = { cx: 50, cy: 50 };
export const CHUNKED_START_KEY = chunkKey(CHUNKED_START);

/** Is this chunk unlocked — either the free start chunk, or rolled. */
export const isChunkUnlocked = (key: string, unlockedKeys: readonly string[]): boolean =>
  key === CHUNKED_START_KEY || unlockedKeys.includes(key);

/**
 * Is this chunk eligible to be rolled next: not already unlocked, and
 * on the adjacent-land or Sailing frontier (the free start chunk counts).
 * `key` is assumed to come from ALL_CHUNK_KEYS (the gacha pool for
 * TableType.CHUNKS), so it isn't re-validated against the map here.
 */
const landKeys = new Set(ALL_CHUNK_KEYS);
const neighbors = (key: string): string[] => {
  const { cx, cy } = parseChunkKey(key);
  return NEIGHBOR_OFFSETS.map(({ dx, dy }) => chunkKey({ cx: cx + dx, cy: cy + dy }));
};
let cachedSignature = '';
let cachedFrontier = new Set<string>();
let cachedOcean = new Set<string>();
function frontier(unlockedKeys: readonly string[], account?: SailingAccount) {
  const sailing = canNavigateOcean(account);
  const signature = `${sailing}:${unlockedKeys.join(';')}`;
  if (signature === cachedSignature) return;
  const owned = new Set([CHUNKED_START_KEY, ...unlockedKeys.filter(key => landKeys.has(key))]);
  const queue = [...owned]; const ocean = new Set<string>(); const result = new Set<string>();
  for (const key of queue) for (const next of neighbors(key)) {
    if (owned.has(next)) continue;
    if (landKeys.has(next)) result.add(next);
    else if (sailing && OCEAN_CHUNK_KEYS.has(next) && !ocean.has(next)) {
      ocean.add(next); queue.push(next);
    }
  }
  if (sailing) for (const { from, to } of CHUNK_BOAT_LANDINGS) {
    if (owned.has(from) && !owned.has(to)) result.add(to);
    if (owned.has(to) && !owned.has(from)) result.add(from);
  }
  cachedSignature = signature; cachedFrontier = result; cachedOcean = ocean;
}

/** Adjacent land, plus offshore land reachable through ocean after Pandemonium. */
export const isFrontierChunk = (key: string, unlockedKeys: readonly string[], account?: SailingAccount): boolean => {
  frontier(unlockedKeys, account); return cachedFrontier.has(key);
};
export const isOceanChunkReachable = (key: string, unlockedKeys: readonly string[], account?: SailingAccount): boolean => {
  frontier(unlockedKeys, account); return cachedOcean.has(key);
};
export const getChunkFrontier = (unlockedKeys: readonly string[], account?: SailingAccount): ChunkCoord[] => {
  frontier(unlockedKeys, account); return ALL_CHUNKS.filter(c => cachedFrontier.has(chunkKey(c)));
};

const CHUNK_TO_SUBAREA: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [name, chunks] of Object.entries(SUB_AREA_CHUNKS)) {
    for (const c of chunks) m[chunkKey(c)] = name;
  }
  return m;
})();

const CHUNK_TO_REGION: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [name, chunks] of Object.entries(REGION_CHUNKS)) {
    for (const c of chunks) m[chunkKey(c)] = name;
  }
  return m;
})();

/**
 * Human-readable label for a chunk key, for the gacha reveal/panel display —
 * its named sub-area if authored (e.g. "Falador"), else its parent continent
 * plus coords (e.g. "Asgarnia (46, 51)"), since a raw "cx,cy" key means
 * nothing to a player.
 */
/** Named sub-area this chunk belongs to (e.g. "Falador"), if authored. */
export const chunkSubArea = (key: string): string | undefined => CHUNK_TO_SUBAREA[key];
/** Parent continent this chunk belongs to (e.g. "Asgarnia"), if authored. */
export const chunkRegion = (key: string): string | undefined => CHUNK_TO_REGION[key];

export const chunkLabel = (key: string): string => {
  const named = CHUNK_TO_SUBAREA[key];
  if (named) return named;
  const region = CHUNK_TO_REGION[key];
  const { cx, cy } = parseChunkKey(key);
  return region ? `${region} (${cx}, ${cy})` : `Uncharted Chunk (${cx}, ${cy})`;
};
