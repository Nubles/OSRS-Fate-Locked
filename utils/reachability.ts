import { UnlockState } from '../types';
import { isFreeArea } from './freeAreas';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';

/**
 * Is a named region/sub-area reachable in Chunked mode: true if ANY chunk
 * belonging to it (sub-area first, falling back to the parent continent) is
 * currently unlocked (including the always-free start chunk). Quest/diary/
 * resource data is authored in named areas, not raw chunk coords, so this is
 * the Chunked-mode equivalent of "the whole named area is free/unlocked" —
 * a foothold anywhere in the area counts, since that's the granularity the
 * source data actually has.
 */
export const isNamedAreaReachableViaChunks = (name: string, unlockedChunkKeys: readonly string[]): boolean => {
  const chunks = SUB_AREA_CHUNKS[name] || REGION_CHUNKS[name];
  if (!chunks || chunks.length === 0) return false;
  return chunks.some(c => isChunkUnlocked(chunkKey(c), unlockedChunkKeys));
};

/**
 * The single canonical "is this named area reachable" check — branches on
 * game mode so callers don't each need their own Chunked special-case.
 * Replaces the isFreeArea(name) || unlocks.regions.includes(name) pattern
 * used all over the app before Chunked mode existed.
 */
export const isAreaReachable = (name: string, unlocks: UnlockState, gameModeId?: string): boolean => {
  if (gameModeId === 'chunked') return isNamedAreaReachableViaChunks(name, unlocks.chunks ?? []);
  return isFreeArea(name) || unlocks.regions.includes(name);
};
