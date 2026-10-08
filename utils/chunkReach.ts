import { OCEAN_CHUNK_KEYS } from './oceanAccess';
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
 */

import { UnlockState } from '../types';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { chunkUnlocked } from './chunkLocations';
import { chunkSections, gridStepAllowed, sectionChunk, sectionLinks } from './walkSections';

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

  const reachable = new Set<string>();
  const homeId = home ? idOf(home.cx, home.cy) : null;
  if (!homeId || !owned.has(homeId)) {
    return { reachable, stranded: new Set(owned), ownedCount: owned.size };
  }

  // Chunks (and the transport graph's named places) by id, and the parts of
  // chunks you can walk between by section id, each visited once.
  const visited = new Set<string>([homeId]);
  const queue: string[] = [homeId];
  const seenSection = new Set<string>();
  const sectionQueue: string[] = [];
  const visit = (id: string) => { if (!visited.has(id)) { visited.add(id); queue.push(id); } };
  const visitSection = (section: string) => {
    if (!seenSection.has(section)) { seenSection.add(section); sectionQueue.push(section); }
  };
  // A chunk the source has no land for (the sea) is walked by the grid, as before.
  const gridNeighbours = (id: string): string[] => {
    const [cx, cy] = decode(id);
    return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dx, dy]) => idOf(cx + dx, cy + dy))
      .filter(nb => owned.has(nb));
  };
  // Transport leaves from a reached chunk once.
  const departed = new Set<string>();
  const depart = (id: string) => {
    if (departed.has(id)) return;
    departed.add(id);
    for (const t of connect[id] ?? []) visit(t);
  };

  while (queue.length || sectionQueue.length) {
    if (queue.length) {
      const cur = queue.shift()!;
      // A quest-gated chunk you can't enter yet: not reachable, no routing through.
      if (cur !== homeId && blocked?.(cur)) continue;
      const isOwned = owned.has(cur);
      if (isOwned) {
        // Arriving in a chunk reaches every part of it.
        const sections = chunkSections(cur);
        if (sections.length) {
          for (const section of sections) visitSection(section);
          continue;
        }
        reachable.add(cur);
        for (const nb of gridNeighbours(cur)) {
          if (chunkSections(nb).length) for (const section of chunkSections(nb)) visitSection(section);
          else visit(nb);
        }
      }
      // Transport: follow Connect from an owned chunk, or pass through a
      // non-ownable connector node (ocean/dungeon) to reach the far side.
      const isConnector = !UNIVERSE_SET!.has(cur);
      if (isOwned || isConnector) depart(cur);
      continue;
    }

    const section = sectionQueue.shift()!;
    const chunk = sectionChunk(section);
    if (chunk !== homeId && blocked?.(chunk)) continue;
    reachable.add(chunk);
    // Walk: to the parts of owned chunks this part joins.
    for (const next of sectionLinks(section)) {
      if (owned.has(sectionChunk(next))) visitSection(next);
    }
    // Next door with no link: only onto land the source can't walk to at all
    // (an island or an enclave), or the sea.
    for (const nb of gridNeighbours(chunk)) {
      const sections = chunkSections(nb);
      if (!sections.length) visit(nb);
      else for (const next of sections) if (gridStepAllowed(section, next)) visitSection(next);
    }
    depart(chunk);
  }

  const stranded = new Set<string>();
  for (const o of owned) if (!reachable.has(o)) stranded.add(o);
  return { reachable, stranded, ownedCount: owned.size };
}
