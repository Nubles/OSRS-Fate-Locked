/**
 * How the World map draws a Chunked run's chunks, and the words it uses for
 * them, kept out of components/RegionMap.tsx so tests can pin them.
 */
import { CHUNKED_START_KEY, isChunkUnlocked, isFrontierChunk } from './chunkAdjacency';
import type { SailingAccount } from './oceanAccess';

/**
 * owned: unlocked, and a route from the start chunk reaches it.
 * cut-off: unlocked, but no route reaches it (a wall, a river, a missing boat).
 * frontier: a Key can roll it next.
 * locked: anything else.
 */
export type ChunkMapState = 'owned' | 'cut-off' | 'frontier' | 'locked';

/**
 * A land chunk's state. `cutOff` holds the owned chunks, as "cx,cy", that no
 * route reaches; without it (the map data hasn't loaded), owned is owned.
 */
export function chunkMapState(
  key: string,
  chunkUnlocks: readonly string[],
  account: SailingAccount | undefined,
  cutOff?: ReadonlySet<string>,
): ChunkMapState {
  if (isChunkUnlocked(key, chunkUnlocks)) return cutOff?.has(key) ? 'cut-off' : 'owned';
  return isFrontierChunk(key, chunkUnlocks, account) ? 'frontier' : 'locked';
}

/** The tooltip line for a chunk's state, when it needs one. */
export const chunkMapStateLine = (state: ChunkMapState): string | undefined => ({
  owned: undefined,
  'cut-off': 'Cut off: no route from your start chunk',
  frontier: 'On your frontier: a Key can roll it',
  locked: undefined,
}[state]);

/** How many chunks a Chunked run holds, its free start chunk included. */
export const chunkedUnlockedCount = (chunkUnlocks: readonly string[]): number =>
  new Set([CHUNKED_START_KEY, ...chunkUnlocks]).size;

/** The Reachability lens's summary line. */
export const reachLensDetail = (stranded: number, chunked: boolean): string => (stranded > 0
  ? `${stranded} stranded (owned but no route from ${chunked ? 'your start chunk' : 'Lumbridge'})`
  : 'Every owned chunk is reachable.');
