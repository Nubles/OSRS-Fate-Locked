/**
 * Chunk reachability over the transport graph.
 *
 * Owning a chunk isn't the same as being able to get to it — you might unlock an
 * island but not the boat. This walks the `connect` graph (boats/teleports/
 * stairs) plus grid adjacency, from your home chunk (Lumbridge), to work out
 * which owned chunks are actually connected to your network and which are
 * "stranded".
 *
 * Approximate by nature: `connect` has no per-edge unlock requirements (e.g. a
 * fairy ring still needs the network unlocked), so this is a connectivity hint,
 * not a tick-perfect router — it errs toward "reachable".
 */

import { UnlockState } from '../types';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { chunkUnlocked } from './chunkLocations';

const idOf = (cx: number, cy: number) => String(cx * 256 + cy);
const decode = (s: string): [number, number] => { const n = +s; return [Math.floor(n / 256), n % 256]; };

// Every chunk coord that belongs to an ownable region or sub-area (built once).
let UNIVERSE: { id: string; cx: number; cy: number }[] | null = null;
let UNIVERSE_SET: Set<string> | null = null;
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
): ReachResult {
  buildUniverse();
  const owned = new Set<string>();
  for (const c of UNIVERSE!) if (chunkUnlocked(c.cx, c.cy, unlocks)) owned.add(c.id);

  const reachable = new Set<string>();
  const homeId = home ? idOf(home.cx, home.cy) : null;
  if (!homeId || !owned.has(homeId)) {
    return { reachable, stranded: new Set(owned), ownedCount: owned.size };
  }

  const visited = new Set<string>([homeId]);
  const queue: string[] = [homeId];
  while (queue.length) {
    const cur = queue.shift()!;
    const isOwned = owned.has(cur);
    if (isOwned) reachable.add(cur);
    const next: string[] = [];

    // Walk: 4-neighbour adjacency, only between owned land.
    if (isOwned) {
      const [cx, cy] = decode(cur);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nb = idOf(cx + dx, cy + dy);
        if (owned.has(nb)) next.push(nb);
      }
    }
    // Transport: follow Connect from an owned chunk, or pass through a
    // non-ownable connector node (ocean/dungeon) to reach the far side.
    const isConnector = !UNIVERSE_SET!.has(cur);
    if (isOwned || isConnector) for (const t of connect[cur] ?? []) next.push(t);

    for (const n of next) if (!visited.has(n)) { visited.add(n); queue.push(n); }
  }

  const stranded = new Set<string>();
  for (const o of owned) if (!reachable.has(o)) stranded.add(o);
  return { reachable, stranded, ownedCount: owned.size };
}
