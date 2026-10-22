import { OCEAN_CHUNK_KEYS, canNavigateOcean, type SailingAccount } from './oceanAccess';
import { gridWalk, sectionWalker, walkSectionsLoaded } from './walkSections';
import type { ChunkCoord } from './mapCoords';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';

/**
 * Chunked mode's frontier logic: unlocking is one map-region chunk at a time.
 * The frontier is the land next door that a chunk the run reaches walks
 * into. After unlocking Sailing and completing Pandemonium, every port and
 * coast across the sea from a coast the run reaches, and the reviewed boat
 * landings, join it too. Water never enters the paid chunk pool.
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

const landKeys = new Set(ALL_CHUNK_KEYS);
const chunkIdOf = (cx: number, cy: number): string => String(cx * 256 + cy);
const idOfKey = (key: string): string => { const { cx, cy } = parseChunkKey(key); return chunkIdOf(cx, cy); };
const LAND_IDS: ReadonlySet<string> = new Set(ALL_CHUNK_KEYS.map(idOfKey));
const keyOfId = (id: string): string => { const n = Number(id); return `${Math.floor(n / 256)},${n % 256}`; };
const CHUNKED_START_ID = chunkIdOf(CHUNKED_START.cx, CHUNKED_START.cy);
const OCEAN_IDS = [...OCEAN_CHUNK_KEYS].map(idOfKey);
const OWNABLE_IDS: ReadonlySet<string> = new Set([...LAND_IDS, ...OCEAN_IDS]);

export interface ChunkWalk {
  /** Owned chunks, as "cx,cy", that a walk (or, with Sailing, a sail) from the start chunk reaches. */
  reached: ReadonlySet<string>;
  /** Unowned land, as "cx,cy", that a reached chunk walks or sails into. */
  frontier: ReadonlySet<string>;
  /** The run sails the sea from a coast it reaches. */
  sea: boolean;
}

/**
 * Chunked mode's walk from the start chunk through the land the run owns:
 * the walking data (utils/walkSections.ts, loaded with the chunk content),
 * and with Sailing and Pandemonium the one sea and the reviewed boat
 * landings. Transport opens no land of its own here: teleports, dungeons and
 * boats outside Sailing never put a chunk on the frontier. Until the walking
 * data loads (GameContext loads it with a Chunked run), the walk goes chunk
 * to chunk next door with none of those rules (utils/walkSections.ts's
 * gridWalk). utils/chunkWalkReach.ts has the rules.
 */
const walkFrom = (unlockedKeys: readonly string[], account: SailingAccount | undefined, blocked?: (id: string) => boolean): ChunkWalk => {
  const sailing = canNavigateOcean(account);
  const owned = new Set([CHUNKED_START_ID, ...unlockedKeys.filter(key => landKeys.has(key)).map(idOfKey)]);
  if (sailing) for (const id of OCEAN_IDS) owned.add(id);
  const walker = sectionWalker();
  const walk = walker
    ? walker({}, owned, CHUNKED_START_ID, { chunked: true, sailing }, blocked)
    : gridWalk({}, owned, CHUNKED_START_ID, LAND_IDS, OWNABLE_IDS, blocked);
  return {
    reached: new Set([...walk.reachable].map(keyOfId)),
    frontier: new Set([...walk.frontier].map(keyOfId)),
    sea: walk.sea,
  };
};

let cachedSignature = '';
let cached: ChunkWalk = { reached: new Set(), frontier: new Set(), sea: false };
const chunkWalk = (unlockedKeys: readonly string[], account: SailingAccount | undefined): ChunkWalk => {
  const sailing = canNavigateOcean(account);
  const signature = `${walkSectionsLoaded()}:${sailing}:${unlockedKeys.join(';')}`;
  if (signature !== cachedSignature) {
    cached = walkFrom(unlockedKeys, account);
    cachedSignature = signature;
  }
  return cached;
};

/**
 * The walk for these unlocks, worked out once per unlock list and Sailing
 * state. With `blocked`, a gate of the caller's own, it is worked out afresh.
 * reachability.ts's reachedOwnedChunks is the way in for everything else.
 */
export const chunkedWalk = (
  unlockedKeys: readonly string[],
  account?: SailingAccount,
  blocked?: (id: string) => boolean,
): ChunkWalk => (blocked ? walkFrom(unlockedKeys, account, blocked) : chunkWalk(unlockedKeys, account));

/**
 * Is this chunk eligible to be rolled next: not already unlocked, and on the
 * frontier (see walkFrom). `key` is assumed to come from ALL_CHUNK_KEYS (the
 * gacha pool for TableType.CHUNKS), so it isn't re-validated against the map
 * here.
 */
export const isFrontierChunk = (key: string, unlockedKeys: readonly string[], account?: SailingAccount): boolean =>
  chunkWalk(unlockedKeys, account).frontier.has(key);
export const getChunkFrontier = (unlockedKeys: readonly string[], account?: SailingAccount): ChunkCoord[] => {
  const { frontier } = chunkWalk(unlockedKeys, account);
  return ALL_CHUNKS.filter(c => frontier.has(chunkKey(c)));
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
