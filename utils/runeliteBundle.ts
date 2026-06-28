/**
 * Build the RuneLite plugin bundle (the v3 shape the map's RL-export button
 * produces) from the current run. Uses the shipped chunk baselines (a player
 * isn't authoring, so map drafts don't apply).
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
  /** Per-slot unlocked equipment tier (e.g. { Head: 2, Weapon: 3 }). */
  equipment?: Record<string, number>;
}

export function buildRuneliteBundle(
  unlockedRegions: string[],
  state: RuneliteRunState,
  itemTiers?: Record<string, number>,
  slayerChunks?: Record<string, { cx: number; cy: number }[]>,
) {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    chunkOffset: { cx: 0, cy: 0 },
    chunks: REGION_CHUNKS,
    subAreaChunks: SUB_AREA_CHUNKS,
    regionGroups: { Misthalin: MISTHALIN_AREAS, ...REGION_GROUPS },
    unlockedRegions,
    // Slim per-chunk "what's here" (categorised), keyed "cx,cy". Optional —
    // older plugins ignore it; regenerated with the dataset.
    chunkContent: CHUNK_CONTENT_LITE,
    // Item-id → tier map so the plugin can warn on over-tier worn gear.
    // Optional; omitted if the gear dataset wasn't loaded at export time.
    ...(itemTiers ? { itemTiers } : {}),
    // Slayer task → chunks (complete monster coverage) for the locked-slayer
    // warning. Optional; omitted if the chunk dataset wasn't loaded.
    ...(slayerChunks ? { slayerChunks } : {}),
    state,
  };
}
