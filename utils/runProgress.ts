/**
 * How far a run has come, counted the way its run card shows it, so the
 * card and the RuneLite export give the same numbers (R9).
 */
import { MISTHALIN_AREAS, REGIONS_LIST } from '../constants';
import type { UnlockState } from '../types';
import { ALL_CHUNKS, ALL_CHUNK_KEYS, chunkRegion, isChunkUnlocked } from './chunkAdjacency';
import { chunkUnlocked } from './chunkLocations';
import { isAreaReachable } from './reachability';

/** Every named area a run counts: Misthalin's and those outside it. */
const NAMED_AREAS = [...MISTHALIN_AREAS, ...REGIONS_LIST];

export interface RunProgress {
  /** What the run unlocks one at a time. */
  unit: 'areas' | 'chunks';
  unlocked: number;
  total: number;
  /** The land chunks the run owns, out of every land chunk, whatever the unit. */
  chunks: { unlocked: number; total: number };
}

/**
 * Named areas count when the run can reach them, free ones included
 * (legacy Xtreme frees only Lumbridge). Chunked runs count their chunks
 * plus the free start chunk, out of every land chunk.
 */
export function runProgress(unlocks: UnlockState, gameModeId: string | undefined): RunProgress {
  const chunks = {
    unlocked: ALL_CHUNKS.filter(({ cx, cy }) => chunkUnlocked(cx, cy, unlocks, gameModeId)).length,
    total: ALL_CHUNKS.length,
  };
  if (gameModeId === 'chunked') return { unit: 'chunks', ...chunkTotals(unlocks), chunks };
  return {
    unit: 'areas',
    unlocked: NAMED_AREAS.filter((area) => isAreaReachable(area, unlocks, gameModeId)).length,
    total: NAMED_AREAS.length,
    chunks,
  };
}

/**
 * A Chunked run's chunk count, the one every screen shows (Spend Keys, the
 * share cards, the import preview, save recovery): the land chunks it owns,
 * the free start chunk included, out of every land chunk.
 */
export function chunkTotals(unlocks: Pick<UnlockState, 'chunks'> | undefined): { unlocked: number; total: number } {
  const owned = unlocks?.chunks ?? [];
  return {
    unlocked: ALL_CHUNK_KEYS.filter((key) => isChunkUnlocked(key, owned)).length,
    total: ALL_CHUNK_KEYS.length,
  };
}

export interface RegionMastery { group: string; count: number; total: number; percent: number }

/**
 * Chunked World Mastery: for each map region (Misthalin included), the land
 * chunks the run owns out of that region's land chunks. Only regions with a
 * chunk owned are listed, highest share first.
 */
export function chunkRegionMastery(unlocks: Pick<UnlockState, 'chunks'>): RegionMastery[] {
  const owned = unlocks.chunks ?? [];
  const byRegion = new Map<string, { count: number; total: number }>();
  for (const key of ALL_CHUNK_KEYS) {
    const group = chunkRegion(key);
    if (!group) continue;
    const row = byRegion.get(group) ?? { count: 0, total: 0 };
    row.total += 1;
    if (isChunkUnlocked(key, owned)) row.count += 1;
    byRegion.set(group, row);
  }
  return [...byRegion.entries()]
    .map(([group, { count, total }]) => ({ group, count, total, percent: count / total }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.percent - a.percent || b.count - a.count || a.group.localeCompare(b.group));
}
