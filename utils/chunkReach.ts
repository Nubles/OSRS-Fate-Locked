/**
 * Chunk reachability over the transport graph.
 *
 * Owning a chunk isn't the same as being able to get to it — you might unlock an
 * island but not the boat. This walks the `connect` graph (boats/teleports/
 * stairs) plus the land you can walk between (utils/walkSections.ts), from
 * your home chunk (Lumbridge), to work out which owned chunks are actually
 * connected to your network and which are "stranded". A chunk counts as
 * reached once any part of it is.
 *
 * Approximate by nature: `connect` has no per-edge unlock requirements (e.g. a
 * fairy ring still needs the network unlocked), and arriving by transport
 * counts as reaching every part of the chunk, so this is a connectivity hint,
 * not a tick-perfect router — it errs toward "reachable".
 *
 * The walk itself, and Chunked mode's own rules for islands, the sea and
 * places with no chunk to own, are in utils/chunkWalkReach.ts.
 */

import { UnlockState } from '../types';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { chunkUnlocked } from './chunkLocations';
import { canNavigateOcean, OCEAN_CHUNK_KEYS } from './oceanAccess';
import { gridWalk, sectionWalker } from './walkSections';

const idOf = (cx: number, cy: number) => String(cx * 256 + cy);

// Every chunk coord that belongs to an ownable region or sub-area (built once).
let UNIVERSE: { id: string; cx: number; cy: number }[] | null = null;
let UNIVERSE_SET: ReadonlySet<string> = new Set();
const buildUniverse = () => {
  if (UNIVERSE) return;
  const seen = new Set<string>();
  const out: { id: string; cx: number; cy: number }[] = [];
  const eat = (groups: Record<string, { cx: number; cy: number }[]>) => {
    for (const list of Object.values(groups)) for (const c of list) {
      const k = idOf(c.cx, c.cy);
      if (!seen.has(k)) { seen.add(k); out.push({ id: k, cx: c.cx, cy: c.cy }); }
    }
  };
  eat(REGION_CHUNKS as Record<string, { cx: number; cy: number }[]>);
  eat(SUB_AREA_CHUNKS as Record<string, { cx: number; cy: number }[]>);
  for (const key of OCEAN_CHUNK_KEYS) {
    const [cx, cy] = key.split(',').map(Number); const id = idOf(cx, cy);
    if (!seen.has(id)) { seen.add(id); out.push({ cx, cy, id }); }
  }
  UNIVERSE = out;
  UNIVERSE_SET = seen;
};

export interface ReachResult {
  reachable: Set<string>;
  stranded: Set<string>;
  ownedCount: number;
}

export function chunkReachability(
  connect: Record<string, string[]>,
  unlocks: UnlockState,
  home: { cx: number; cy: number } | null,
  /** Optional gate: return true if a chunk can't be entered yet (e.g. a quest
   *  requirement isn't met). Blocked chunks aren't reachable and can't be
   *  routed through. */
  blocked?: (chunkId: string) => boolean,
  gameModeId?: string,
): ReachResult {
  buildUniverse();
  const owned = new Set<string>();
  for (const c of UNIVERSE!) if (chunkUnlocked(c.cx, c.cy, unlocks, gameModeId)) owned.add(c.id);

  const homeId = home ? idOf(home.cx, home.cy) : null;
  if (!homeId || !owned.has(homeId)) {
    return { reachable: new Set(), stranded: new Set(owned), ownedCount: owned.size };
  }
  const chunked = gameModeId === 'chunked';
  const walk = sectionWalker();
  const { reachable } = walk
    ? walk(connect, owned, homeId, { chunked, sailing: chunked && canNavigateOcean(unlocks) }, blocked)
    : gridWalk(connect, owned, homeId, new Set(), UNIVERSE_SET, blocked);

  const stranded = new Set<string>();
  for (const o of owned) if (!reachable.has(o)) stranded.add(o);
  return { reachable, stranded, ownedCount: owned.size };
}
