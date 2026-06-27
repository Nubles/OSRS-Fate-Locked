/**
 * Build the RuneLite plugin bundle (the same v3 shape the map's RL-export button
 * produces) from the current run, as a pure function — so both the export button
 * and the live-sync push can share it. Uses the shipped chunk baselines (a player
 * pushing live isn't authoring, so drafts don't apply).
 */
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { CHUNK_CONTENT_LITE } from '../data/chunkContentLite';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';

export interface RuneliteRunState {
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  activeBuff: string;
  pinnedGoals: string[];
  linkedAccount?: string;
}

export function buildRuneliteBundle(unlockedRegions: string[], state: RuneliteRunState) {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    chunkOffset: { cx: 0, cy: 0 },
    chunks: REGION_CHUNKS,
    subAreaChunks: SUB_AREA_CHUNKS,
    regionGroups: { Misthalin: MISTHALIN_AREAS, ...REGION_GROUPS },
    unlockedRegions,
    // Slim per-chunk "what's here" (monster names), keyed "cx,cy". Optional —
    // older plugins ignore it; ~26 KB, regenerated with the dataset.
    chunkContent: CHUNK_CONTENT_LITE,
    state,
  };
}
