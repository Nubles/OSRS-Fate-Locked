import type { GameModeRules } from '../config/gameModes';
import { MOBILITY_LIST } from '../data/items';
import { DETECTOR_POLICIES, type DetectorPolicy } from '../config/detectorPolicies';
import { gearService } from '../services/GearService';
import {
  chunkContentService,
  type ChunkContent,
  type ConnectGraph,
  type Shortcut,
  type SlayerMasters,
} from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { runReach } from './chunkEntry';
import { chunkKey, getChunkFrontier } from './chunkAdjacency';
import { chunkEntries, rulesPlaces, type RulesPlace } from './chunkEntries';
import type { InteriorRecord } from './interiorEntry';
import { bankDecisions, type BankDecision } from './bankDecisions';
import { freeAreasFor } from './freeAreas';
import { runProgress, type RunProgress } from './runProgress';
import { slayerDecisions, slayerLocate, type SlayerDecision, type SlayerLocationSource } from './slayerDecisions';
import { slayerReachability } from './slayerReach';
import { travelDecisions, type TravelMethodDecision } from './travelDecisions';
import {
  buildChunkPermissionSnapshot,
  type ChunkPermissionSnapshot,
  type PermissionStatus,
} from './chunkPermissionSnapshot';
import { bankLocksActive } from './reachability';
import { canonicalizeAreaUnlocks } from '../data/areaMapPolicy';
import type { EntityAccessSource } from './entityAccess';
import type { EquipmentPermissionCoverage } from '../data/equipmentCatalogue';
const RULES_VERSION = '1';
const CONTENT_VERSION = 1;
const DETECTOR_CONTRACT_VERSION = 1;

/**
 * The Stage 2 sections, each named by the capability that says a bundle
 * has it: its field, or chunkDetails for the snapshots' kind, area and
 * entryReason. A section's meaning never changes: a new meaning gets a
 * new field and a new capability, and a reader uses only the sections
 * whose capability it knows.
 */
export const RULES_CAPABILITIES = [
  'banks', 'chunkDetails', 'chunkEntries', 'freeAreas', 'frontier', 'places', 'progress', 'slayerTasks', 'travel',
] as const;
export type RulesCapability = typeof RULES_CAPABILITIES[number];

export interface RuneliteRulesManifest {
  rulesVersion: string;
  contentVersion: number;
  detectorContractVersion: number;
  runId: string;
  runRevision: number;
  account: string | null;
  gameModeId: string;
  exportedAt: string;
  bankLocks: boolean;
  knownMobility: string[];
  unlocks: {
    regions: string[];
    chunks: string[];
    skills: Record<string, number>;
    levels: Record<string, number>;
    equipment: Record<string, number>;
    banks: string[];
    merchants: string[];
    bosses: string[];
    minigames: string[];
    mobility: string[];
    arcana: string[];
    guilds: string[];
    farming: string[];
    slayer: string[];
    quests: string[];
    // Additive fields: the current plugin's Unlocks class has neither, so
    // Gson drops them and it does not warn on these families yet.
    housing?: string[];
    storage?: string[];
  };
  itemRules: Record<string, { tier: number; slot: string }>;
  equipmentCatalogue?: EquipmentPermissionCoverage;
  detectorPolicies: DetectorPolicy[];
  chunks: Record<string, ChunkPermissionSnapshot>;
  /** Stage 2: every land, ocean and interior chunk's entry. Absent when the chunk data didn't load. */
  chunkEntries?: Record<string, PermissionStatus>;
  /** Stage 2: what the chunks that aren't land are. Sent with chunkEntries. */
  places?: Record<string, RulesPlace>;
  /** Stage 2, Chunked runs: the chunks the run may roll next. */
  frontier?: string[];
  /** Stage 2: every bank with a chunk, by id. Sent with chunkEntries. */
  banks?: Record<string, BankDecision>;
  /** Stage 2: the areas the run's mode frees at the start, from the mode itself. */
  freeAreas?: string[];
  /** Stage 2: how far the run has come, as its run card counts it. */
  progress?: RunProgress;
  /** Stage 2: each Slayer task, per master and whatever the master, keyed like slayerChunks. */
  slayerTasks?: Record<string, SlayerDecision>;
  /** Stage 2: each travel method by id, with each option's decision for the run. Sent with chunkEntries. */
  travel?: Record<string, TravelMethodDecision>;
  /** The Stage 2 sections this bundle has, by capability. */
  capabilities?: RulesCapability[];
}

export interface RulesContentSource extends Partial<EntityAccessSource> {
  init(): Promise<boolean>;
  allChunkCoords(): { cx: number; cy: number }[];
  contentFor(cx: number, cy: number): ChunkContent | null;
  connectGraph(): ConnectGraph;
  shortcuts(): Shortcut[];
  questSections(): Record<string, string[]>;
  interiorRecords?(): InteriorRecord[];
  surfaceContentFor?(cx: number, cy: number): ChunkContent | null;
  interiorsEnteredFrom?(cx: number, cy: number): { sourceId: string; content: ChunkContent }[];
  slayerMasters?(): SlayerMasters;
  slayerLocations?: SlayerLocationSource['slayerLocations'];
}

export interface ItemRuleSource {
  init(): Promise<void>;
  ready: boolean;
  itemRuleExport(): Record<string, { tier: number; slot: string }>;
  permissionCoverage?(): EquipmentPermissionCoverage;
}
export interface RulesManifestRunInput {
  runId: string;
  runRevision: number;
  linkedAccount?: string;
  gameModeId: string;
  customMode?: GameModeRules;
  rulesVersion?: string;
  contentVersion?: number;
  detectorContractVersion?: number;
}

export interface RulesManifestInput {
  unlocks: UnlockState;
  run: RulesManifestRunInput;
  exportedAt?: string;
  contentService?: RulesContentSource;
  itemRuleSource?: ItemRuleSource;
}

const sorted = (values: readonly string[] | undefined): string[] =>
  [...(values ?? [])].sort((left, right) => left.localeCompare(right));

const sortedNumberRecord = (
  values: Record<string, number>,
): Record<string, number> => Object.fromEntries(
  Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
);

export async function buildRuneliteRulesManifest(
  input: RulesManifestInput,
): Promise<RuneliteRulesManifest> {
  const service = input.contentService ?? chunkContentService;
  const items = input.itemRuleSource ?? gearService;
  let itemRules: Record<string, { tier: number; slot: string }> = {};
  try {
    await items.init();
    if (items.ready) {
      itemRules = Object.fromEntries(Object.entries(items.itemRuleExport())
        .sort(([left], [right]) => left.localeCompare(right)));
    }
  } catch { /* unavailable item rules remain Unknown */ }
  const loaded = await service.init();
  const reachable = loaded ? runReach(service, input.unlocks, input.run.gameModeId) : new Set<string>();
  const chunks: Record<string, ChunkPermissionSnapshot> = {};

  const permissions = {
    contentService: service.taskRequirements && service.chunkEntryRequirements ? service as RulesContentSource & EntityAccessSource : undefined,
    unlocks: input.unlocks,
    gameModeId: input.run.gameModeId,
    customMode: input.run.customMode,
    reachableChunks: reachable,
  };

  if (loaded) {
    for (const coord of service.allChunkCoords()) {
      const content = service.contentFor(coord.cx, coord.cy);
      if (!content) continue;
      const snapshot = buildChunkPermissionSnapshot(content, coord, { ...permissions, shortcuts: service.shortcuts() });
      chunks[snapshot.chunkKey] = snapshot;
    }
  }
  const interiors = { interiorRecords: () => service.interiorRecords?.() ?? [] };
  // Dynamic import keeps the travel table out of the eager startup bundle:
  // it is only needed here, at export time.
  const travelMethods = loaded ? (await import('../data/travelMethods')).TRAVEL_METHODS : [];
  const entries = loaded
    ? chunkEntries({
      ...interiors,
      chunkEntryRequirements: (cx: number, cy: number) => service.chunkEntryRequirements?.(cx, cy) ?? [],
    }, input.unlocks, input.run.gameModeId, reachable)
    : {};
  const stage2 = loaded
    ? {
      chunkEntries: entries,
      places: rulesPlaces(interiors),
      banks: bankDecisions({
        contentFor: (cx: number, cy: number) => service.contentFor(cx, cy),
        surfaceContentFor: (cx: number, cy: number) => service.surfaceContentFor?.(cx, cy) ?? service.contentFor(cx, cy),
        interiorsEnteredFrom: (cx: number, cy: number) => service.interiorsEnteredFrom?.(cx, cy) ?? [],
      }, permissions),
      ...(service.slayerMasters && service.slayerLocations
        ? {
          slayerTasks: slayerDecisions(slayerReachability(service.slayerMasters(), input.unlocks,
            slayerLocate(service as SlayerLocationSource, input.unlocks, input.run.gameModeId), input.run.gameModeId)),
        }
        : {}),
      // Each option decided from the entries above, with the snapshots' reasons.
      travel: travelDecisions(travelMethods, {
        unlocks: input.unlocks,
        entries,
        reasons: Object.fromEntries(Object.entries(chunks).flatMap(([key, snapshot]) =>
          (snapshot.entryReason ? [[key, snapshot.entryReason]] : []))),
      }),
    }
    : {};
  // Needs no chunk data: the land next to the run's chunks, and with Sailing
  // the land across the sea from its coast, as the map shows it.
  const chunked = input.run.gameModeId === 'chunked'
    ? {
      frontier: getChunkFrontier(input.unlocks.chunks, input.unlocks)
        .sort((left, right) => left.cx - right.cx || left.cy - right.cy).map(chunkKey),
    }
    : {};

  const unlocks = input.unlocks;
  const sections = {
    ...stage2,
    ...chunked,
    freeAreas: freeAreasFor(input.run.gameModeId, input.run.customMode),
    progress: runProgress(input.unlocks, input.run.gameModeId),
  };
  const capabilities = RULES_CAPABILITIES.filter((capability) => (capability === 'chunkDetails'
    ? Object.keys(chunks).length > 0
    : (sections as Partial<Record<RulesCapability, unknown>>)[capability] !== undefined));
  return {
    rulesVersion: input.run.rulesVersion ?? RULES_VERSION,
    contentVersion: input.run.contentVersion ?? CONTENT_VERSION,
    detectorContractVersion:
      input.run.detectorContractVersion ?? DETECTOR_CONTRACT_VERSION,
    runId: input.run.runId,
    runRevision: input.run.runRevision,
    account: input.run.linkedAccount?.trim() || null,
    gameModeId: input.run.gameModeId,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    bankLocks: bankLocksActive(input.run.gameModeId, input.run.customMode),
    knownMobility: sorted(MOBILITY_LIST),
    unlocks: {
      // Keep explicit legacy parents in the wire format, matching the bundle root.
      regions: sorted(canonicalizeAreaUnlocks(unlocks.regions).regions),
      chunks: sorted(unlocks.chunks),
      skills: sortedNumberRecord(unlocks.skills),
      levels: sortedNumberRecord(unlocks.levels),
      equipment: sortedNumberRecord(unlocks.equipment),
      banks: sorted(unlocks.banks),
      merchants: sorted(unlocks.merchants),
      bosses: sorted(unlocks.bosses),
      minigames: sorted(unlocks.minigames),
      mobility: sorted(unlocks.mobility),
      arcana: sorted(unlocks.arcana),
      guilds: sorted(unlocks.guilds),
      farming: sorted(unlocks.farming),
      slayer: sorted(unlocks.slayerUnlocks),
      quests: sorted(unlocks.quests),
      housing: sorted(unlocks.housing),
      storage: sorted(unlocks.storage),
    },
    itemRules,
    ...(items.permissionCoverage ? { equipmentCatalogue: items.permissionCoverage() } : {}),
    detectorPolicies: DETECTOR_POLICIES.map((policy) => ({
      ...policy, eventTypes: [...policy.eventTypes],
    })),
    chunks,
    ...sections,
    capabilities,
  };
}
