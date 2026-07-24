/**
 * Build the RuneLite plugin bundle (the v4 shape the map's RL-export button
 * produces) from the current run. Uses the shipped chunk baselines (a player
 * isn't authoring, so map drafts don't apply).
 */
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';
import type { RuneliteRulesManifest } from './runeliteRulesManifest';

export const RULES_VERSION = '1';
export const CONTENT_VERSION = 1;
export const DETECTOR_CONTRACT_VERSION = 1;

export interface RuneliteBundleIdentity {
  runId: string;
  runRevision: number;
  gameModeId: string;
  rulesVersion: string;
  contentVersion: number;
  detectorContractVersion: number;
}

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

export async function buildRuneliteBundle(
  unlockedRegions: string[],
  state: RuneliteRunState,
  itemTiers?: Record<string, number>,
  slayerChunks?: Record<string, { cx: number; cy: number }[]>,
  /** Chunked mode only — unlocks.chunks, keyed "cx,cy" (see utils/chunkAdjacency.ts). */
  unlockedChunks?: string[],
  /** Bank-locked modes — the run's unlocked bank chunk ids (unlocks.banks). */
  unlockedBanks?: string[],
  /** Whether the run locks banks individually (rules.bankLocks). */
  bankLocks?: boolean,
  /** Stable run and detector contract identity for durable event delivery. */
  identity?: RuneliteBundleIdentity,
  /** Canonical rules snapshot consumed by v4-aware plugins. */
  rules?: RuneliteRulesManifest,
) {
  // Dynamic import keeps the ~53 kB chunk-content dataset out of the eager
  // startup bundle — it's only ever needed here, at export time, and every
  // caller is already async.
  const { CHUNK_CONTENT_LITE } = await import('../data/chunkContentLite');
  const exportedAt = rules?.exportedAt ?? new Date().toISOString();
  const fallbackRules: RuneliteRulesManifest = {
    rulesVersion: identity?.rulesVersion ?? RULES_VERSION,
    contentVersion: identity?.contentVersion ?? CONTENT_VERSION,
    detectorContractVersion: identity?.detectorContractVersion ?? DETECTOR_CONTRACT_VERSION,
    runId: identity?.runId ?? 'legacy-export',
    runRevision: identity?.runRevision ?? 0,
    account: state.linkedAccount?.trim() || null,
    gameModeId: identity?.gameModeId ?? (unlockedChunks !== undefined ? 'chunked' : 'vanilla'),
    exportedAt,
    bankLocks: !!bankLocks,
    unlocks: {
      regions: [...unlockedRegions].sort(),
      chunks: [...(unlockedChunks ?? [])].sort(),
      skills: {},
      levels: {},
      equipment: { ...(state.equipment ?? {}) },
      banks: [...(unlockedBanks ?? [])].sort(),
      merchants: [],
      bosses: [],
      minigames: [],
      mobility: [],
      arcana: [],
      guilds: [],
      farming: [],
      slayer: [],
      quests: [],
    },
    itemRules: {},
    detectorPolicies: [],
    chunks: {},
  };
  return {
    version: 4,
    rules: rules ?? fallbackRules,
    ...(identity ?? {}),
    exportedAt,
    chunkOffset: { cx: 0, cy: 0 },
    chunks: REGION_CHUNKS,
    subAreaChunks: SUB_AREA_CHUNKS,
    regionGroups: { Misthalin: MISTHALIN_AREAS, ...REGION_GROUPS },
    unlockedRegions,
    // Chunked mode's unlock state — individual map-region chunks the player
    // has rolled, keyed "cx,cy" (matches unlocks.chunks). Included (even as
    // an empty array, at the very start of a Chunked run) whenever the
    // caller passes it at all; omitted for every other mode, which uses
    // unlockedRegions instead. The distinction matters: an empty array is a
    // real, meaningful state for Chunked mode (nothing rolled yet, but the
    // free start chunk still applies) and must not collapse to "not chunked".
    ...(unlockedChunks !== undefined ? { unlockedChunks } : {}),
    // Slim per-chunk "what's here" (categorised), keyed "cx,cy". Optional —
    // older plugins ignore it; regenerated with the dataset.
    chunkContent: CHUNK_CONTENT_LITE,
    // Item-id → tier map so the plugin can warn on over-tier worn gear.
    // Optional; omitted if the gear dataset wasn't loaded at export time.
    ...(itemTiers ? { itemTiers } : {}),
    // Slayer task → chunks (complete monster coverage) for the locked-slayer
    // warning. Optional; omitted if the chunk dataset wasn't loaded.
    ...(slayerChunks ? { slayerChunks } : {}),
    // Bank-lock state: whether banking is gated, and the bank chunk ids the
    // player has rolled (canonical "cx*256+cy", matching the dataset's bank
    // set / plugin hasBank). Both omitted when the run doesn't lock banks.
    ...(bankLocks ? { bankLocks: true, unlockedBanks: unlockedBanks ?? [] } : {}),
    state,
  };
}
