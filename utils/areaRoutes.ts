/**
 * Owned areas you can't get to yet.
 *
 * Owning an area isn't the same as being able to reach it: roll the Ruins of
 * Uzer without the desert around it and every way there crosses locked land.
 * This walks the map's own reachability graph (chunkReachability: owned land
 * and transport links, from the run's start) to find the owned areas no route
 * reaches, so the Diary Journal can't call their tasks doable while the map
 * calls them stranded.
 *
 * The map's quest gates are left out: a quest that opens an area, such as
 * Priest in Peril for Morytania, is a requirement of the task itself.
 *
 * Islands and enclaves with reviewed entry routes (data/areaAccess.ts) are
 * left to those routes, which know which transport each way needs; the graph
 * here has no per-link requirements and errs toward "reachable".
 */

import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { AREA_ENTRY_ROUTES } from '../data/areaAccess';
import { canonicalAreaName } from '../data/areaMapPolicy';
import type { UnlockState } from '../types';
import { CHUNKED_START } from './chunkAdjacency';
import { chunkForPlace, chunkUnlocked } from './chunkLocations';
import { chunkReachability } from './chunkReach';
import { getFreeAreas } from './freeAreas';
import { isAreaReachable } from './reachability';

export interface AreaRoutes {
  /** Canonical names of owned areas none of whose chunks a route reaches. */
  strandedAreas: ReadonlySet<string>;
  /** Owned chunks, as "cx,cy", that no route reaches. */
  strandedChunks: ReadonlySet<string>;
}

type Chunk = { cx: number; cy: number };

const idOf = ({ cx, cy }: Chunk) => String(cx * 256 + cy);
const keyOf = (id: string) => { const n = Number(id); return `${Math.floor(n / 256)},${n % 256}`; };

const areaChunks = (name: string): readonly Chunk[] => (
  (SUB_AREA_CHUNKS as Record<string, Chunk[]>)[name]
  ?? (REGION_CHUNKS as Record<string, Chunk[]>)[name]
  ?? []
);

/** Where routes start: the map's home chunk, or the run's first free area when that isn't owned. */
const homeChunk = (unlocks: UnlockState, gameModeId: string | undefined): Chunk | null => {
  if (gameModeId === 'chunked') return CHUNKED_START;
  const owned = (chunk: Chunk | null | undefined): chunk is Chunk => (
    !!chunk && chunkUnlocked(chunk.cx, chunk.cy, unlocks, gameModeId)
  );
  const lumbridge = chunkForPlace('Lumbridge');
  if (owned(lumbridge)) return lumbridge;
  for (const area of getFreeAreas()) {
    const start = areaChunks(area).find(owned);
    if (start) return start;
  }
  return null;
};

/**
 * The owned areas and chunks with no route, or null when the run has no
 * owned start to route from (nothing is then called stranded).
 */
export function computeAreaRoutes(
  connect: Record<string, string[]>,
  unlocks: UnlockState,
  gameModeId?: string,
): AreaRoutes | null {
  const home = homeChunk(unlocks, gameModeId);
  if (!home) return null;
  const reach = chunkReachability(connect, unlocks, home, undefined, gameModeId);

  const strandedAreas = new Set<string>();
  for (const name of new Set([...Object.keys(SUB_AREA_CHUNKS), ...Object.keys(REGION_CHUNKS)])) {
    if (name === 'Tutorial Island') continue;
    const canonical = canonicalAreaName(name);
    if (AREA_ENTRY_ROUTES[canonical]?.length) continue;
    const chunks = areaChunks(name);
    if (!chunks.length || !isAreaReachable(name, unlocks, gameModeId)) continue;
    if (!chunks.some(chunk => reach.reachable.has(idOf(chunk)))) strandedAreas.add(canonical);
  }
  return {
    strandedAreas,
    strandedChunks: new Set([...reach.stranded].map(keyOf)),
  };
}
