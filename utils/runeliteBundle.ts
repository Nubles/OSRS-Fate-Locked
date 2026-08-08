/**
 * Build the RuneLite plugin bundle (the v4 shape the map's RL-export button
 * produces) from the current run. Uses the shipped chunk baselines (a player
 * isn't authoring, so map drafts don't apply).
 */
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { MOBILITY_LIST } from '../data/items';
import { canonicalizeAreaUnlocks } from '../data/areaMapPolicy';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';
import type { RuneliteRulesManifest } from './runeliteRulesManifest';
import { getFreeAreas } from './freeAreas';

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
  /** Bank-locked modes — physical chunk ids plus stable virtual bank ids. */
  unlockedBanks?: string[],
  /** Whether the run locks banks individually (rules.bankLocks). */
  bankLocks?: boolean,
  /** Stable run and detector contract identity for durable event delivery. */
  identity?: RuneliteBundleIdentity,
  /** Canonical rules snapshot consumed by v4-aware plugins. */
  rules?: RuneliteRulesManifest,
  /** Mobility subset for a typed fallback; undefined means no authority. */
  fallbackMobility?: readonly string[],
) {
  const canonicalRegions = canonicalizeAreaUnlocks(unlockedRegions).regions;
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
    knownMobility: fallbackMobility === undefined
      ? []
      : [...MOBILITY_LIST].sort(),
    unlocks: {
      regions: [...canonicalRegions].sort(),
      chunks: [...(unlockedChunks ?? [])].sort(),
      skills: {},
      levels: {},
      equipment: { ...(state.equipment ?? {}) },
      banks: [...(unlockedBanks ?? [])].sort(),
      merchants: [],
      bosses: [],
      minigames: [],
      mobility: [...(fallbackMobility ?? [])].sort(),
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
  const canonicalRules: RuneliteRulesManifest = rules
    ? {
      ...rules,
      unlocks: {
        ...rules.unlocks,
        regions: [...canonicalizeAreaUnlocks(rules.unlocks.regions).regions].sort(),
      },
    }
    : fallbackRules;
  return {
    version: 4,
    rules: canonicalRules,
    ...(identity ?? {}),
    exportedAt,
    chunkOffset: { cx: 0, cy: 0 },
    chunks: REGION_CHUNKS,
    subAreaChunks: SUB_AREA_CHUNKS,
    regionGroups: { Misthalin: MISTHALIN_AREAS, ...REGION_GROUPS },
    unlockedRegions: canonicalRegions,
    // Preserve the current mode's explicit free-area baseline for legacy plugin paths.
    freeAreas: getFreeAreas(),
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
    // Bank-lock state and rolled bank ids. Physical entries use canonical
    // "cx*256+cy" ids; virtual service ids are preserved for compatible consumers.
    // Both fields are omitted when the run does not lock banks.
    ...(bankLocks ? { bankLocks: true, unlockedBanks: unlockedBanks ?? [] } : {}),
    state,
  };
}
