/**
 * How far a run has come, counted the way its run card shows it, so the
 * card and the RuneLite export give the same numbers (R9).
 */
import { MISTHALIN_AREAS, REGIONS_LIST } from '../constants';
import type { UnlockState } from '../types';
import { ALL_CHUNK_KEYS } from './chunkAdjacency';
import { isAreaReachable } from './reachability';

/** Every named area a run counts: Misthalin's and those outside it. */
const NAMED_AREAS = [...MISTHALIN_AREAS, ...REGIONS_LIST];

export interface RunProgress {
  /** What the run unlocks one at a time. */
  unit: 'areas' | 'chunks';
  unlocked: number;
  total: number;
}

/**
 * Named areas count when the run can reach them, free ones included
 * (legacy Xtreme frees only Lumbridge). Chunked runs count their chunks
 * plus the free start chunk, out of every land chunk.
 */
export function runProgress(unlocks: UnlockState, gameModeId: string | undefined): RunProgress {
  if (gameModeId === 'chunked') {
    return { unit: 'chunks', unlocked: (unlocks.chunks ?? []).length + 1, total: ALL_CHUNK_KEYS.length };
  }
  return {
    unit: 'areas',
    unlocked: NAMED_AREAS.filter((area) => isAreaReachable(area, unlocks, gameModeId)).length,
    total: NAMED_AREAS.length,
  };
}
