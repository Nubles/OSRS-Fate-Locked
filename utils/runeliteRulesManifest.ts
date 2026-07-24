import type { GameModeRules } from '../config/gameModes';
import { QUEST_DATA } from '../data/questData';
import {
  chunkContentService,
  type ChunkContent,
  type ConnectGraph,
  type Shortcut,
} from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { chunkForPlace } from './chunkLocations';
import { chunkReachability } from './chunkReach';
import {
  buildChunkPermissionSnapshot,
  type ChunkPermissionSnapshot,
} from './chunkPermissionSnapshot';
import { entryBlockedGate } from './questDoability';
import { bankLocksActive } from './reachability';
import {
  CONTENT_VERSION,
  DETECTOR_CONTRACT_VERSION,
  RULES_VERSION,
} from './runeliteBundle';

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
  };
  chunks: Record<string, ChunkPermissionSnapshot>;
}

export interface RulesContentSource {
  init(): Promise<boolean>;
  allChunkCoords(): { cx: number; cy: number }[];
  contentFor(cx: number, cy: number): ChunkContent | null;
  connectGraph(): ConnectGraph;
  shortcuts(): Shortcut[];
  questSections(): Record<string, string[]>;
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
  const loaded = await service.init();
  const completed = new Set(input.unlocks.quests);
  const known = new Set([
    ...Object.keys(QUEST_DATA),
    ...Object.values(QUEST_DATA).map((quest) => quest.name),
  ]);
  const blocked = entryBlockedGate(service.questSections(), completed, known);
  const reach = loaded
    ? chunkReachability(
      service.connectGraph(),
      input.unlocks,
      chunkForPlace('Lumbridge'),
      blocked,
      input.run.gameModeId,
    )
    : { reachable: new Set<string>() };
  const chunks: Record<string, ChunkPermissionSnapshot> = {};

  if (loaded) {
    for (const coord of service.allChunkCoords()) {
      const content = service.contentFor(coord.cx, coord.cy);
      if (!content) continue;
      const snapshot = buildChunkPermissionSnapshot(content, coord, {
        unlocks: input.unlocks,
        gameModeId: input.run.gameModeId,
        customMode: input.run.customMode,
        reachableChunks: reach.reachable,
        shortcuts: service.shortcuts(),
      });
      chunks[snapshot.chunkKey] = snapshot;
    }
  }

  const unlocks = input.unlocks;
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
    unlocks: {
      regions: sorted(unlocks.regions),
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
    },
    chunks,
  };
}
