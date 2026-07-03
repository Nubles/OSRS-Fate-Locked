import type { ChunkCoord } from './mapCoords';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';

/**
 * Chunked mode's frontier logic: unlocking is one map-region chunk at a time,
 * and only a chunk orthogonally adjacent to an already-unlocked chunk (or the
 * start chunk itself, before anything is unlocked) is eligible. This mirrors
 * the community "Chunked Ironman" challenge, using the same chunk grid the
 * rest of the app already renders (see data/regionChunks.ts / subAreaChunks.ts).
 */

export const chunkKey = ({ cx, cy }: ChunkCoord): string => `${cx},${cy}`;

export const parseChunkKey = (key: string): ChunkCoord => {
  const [cx, cy] = key.split(',').map(Number);
  return { cx, cy };
};

// Every chunk on the mainland grid, deduped, flattened from the per-region
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
 * orthogonally adjacent to an unlocked chunk (the free start chunk counts).
 * `key` is assumed to come from ALL_CHUNK_KEYS (the gacha pool for
 * TableType.CHUNKS), so it isn't re-validated against the map here.
 */
export const isFrontierChunk = (key: string, unlockedKeys: readonly string[]): boolean => {
  if (isChunkUnlocked(key, unlockedKeys)) return false;
  const unlocked = new Set([CHUNKED_START_KEY, ...unlockedKeys]);
  const { cx, cy } = parseChunkKey(key);
  return NEIGHBOR_OFFSETS.some(({ dx, dy }) => unlocked.has(chunkKey({ cx: cx + dx, cy: cy + dy })));
};

/** Full frontier list — used for map rendering (highlight rollable chunks), not the hot unlock path. */
export const getChunkFrontier = (unlockedKeys: readonly string[]): ChunkCoord[] =>
  ALL_CHUNKS.filter(c => isFrontierChunk(chunkKey(c), unlockedKeys));

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
