import type { GameModeRules } from '../config/gameModes';
import { MOBILITY_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { DETECTOR_POLICIES, type DetectorPolicy } from '../config/detectorPolicies';
import { gearService } from '../services/GearService';
import {
  chunkContentService,
  type ChunkContent,
  type ConnectGraph,
  type Shortcut,
} from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import type { RuneProofStatus } from './runeproof/model';
import { canonicalJson } from './runeproof/canonicalJson';
import { chunkForPlace } from './chunkLocations';
import { chunkReachability } from './chunkReach';
import {
  buildChunkPermissionSnapshot,
  type ChunkPermissionSnapshot,
} from './chunkPermissionSnapshot';
import { entryBlockedGate } from './questDoability';
import { bankLocksActive } from './reachability';
const RULES_VERSION = '1';
const CONTENT_VERSION = 2;
const DETECTOR_CONTRACT_VERSION = 1;
export const RUNEPROOF_BUNDLE_SCHEMA_VERSION = 1;
export const MAX_RUNEPROOF_BUNDLE_SUMMARIES = 20;
const MAX_RUNEPROOF_BUNDLE_BYTES = 32 * 1024;
const MAX_ID_LENGTH = 256;
const MAX_SOURCE_VERSION_LENGTH = 160;
const MAX_DISPLAY_TEXT_LENGTH = 512;
const MAX_LABEL_LENGTH = 160;
const MAX_LABELS = 32;

export interface RuneProofBundleSummary {
  goalId: string;
  goalLabel: string;
  status: RuneProofStatus;
  explanation: string;
  routeLabels: string[];
  blockerLabels: string[];
  unavoidableBlockerLabels: string[];
  proofHash: string | null;
  sourceVersion: string;
  runRevision: number;
}

export interface RuneliteRulesManifest {
  rulesVersion: string;
  contentVersion: number;
  detectorContractVersion: number;
  runId: string;
  runRevision: number;
  runeProofSchemaVersion: number;
  runeProof: RuneProofBundleSummary[];
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
  };
  itemRules: Record<string, { tier: number; slot: string }>;
  detectorPolicies: DetectorPolicy[];
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

export interface ItemRuleSource {
  init(): Promise<void>;
  ready: boolean;
  itemRuleExport(): Record<string, { tier: number; slot: string }>;
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
  runeProof?: readonly RuneProofBundleSummary[];
  runeProofSourceVersion?: string;
}

const sorted = (values: readonly string[] | undefined): string[] =>
  [...(values ?? [])].sort((left, right) => left.localeCompare(right));

const sortedNumberRecord = (
  values: Record<string, number>,
): Record<string, number> => Object.fromEntries(
  Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
);

const summaryKeys = [
  'blockerLabels', 'explanation', 'goalId', 'goalLabel', 'proofHash',
  'routeLabels', 'runRevision', 'sourceVersion', 'status',
  'unavoidableBlockerLabels',
].sort(compareText);
const summaryStatuses = new Set<RuneProofStatus>([
  'OBTAINABLE', 'OBTAINABLE_RNG', 'BLOCKED', 'IMPOSSIBLE', 'UNKNOWN',
]);
const goalIdPattern = /^[a-z][a-z0-9-]*:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const proofHashPattern = /^sha256-[a-f0-9]{64}$/;

export function normalizeRuneProofBundleSummaries(
  value: unknown,
  binding: { runRevision: number; sourceVersion?: string },
): RuneProofBundleSummary[] {
  try {
    canonicalJson(value ?? []);
  } catch (error) {
    throw bundleError(error);
  }
  if (!Array.isArray(value ?? [])) throw bundleError('summaries must be an array');
  const candidates = value as unknown[];
  if (candidates.length > MAX_RUNEPROOF_BUNDLE_SUMMARIES) {
    throw bundleError(`at most ${MAX_RUNEPROOF_BUNDLE_SUMMARIES} summaries are allowed`);
  }
  if (!safeRevision(binding.runRevision)) throw bundleError('invalid current run revision');
  const expectedSource = binding.sourceVersion === undefined
    ? undefined
    : exactText(binding.sourceVersion, MAX_SOURCE_VERSION_LENGTH, 'current source version');
  const seen = new Set<string>();
  const result = candidates.map((candidate, index) => {
    if (!isPlainRecord(candidate)) throw bundleError(`summary ${index} must be a plain object`);
    const keys = Object.keys(candidate).sort(compareText);
    if (keys.length !== summaryKeys.length
      || keys.some((key, keyIndex) => key !== summaryKeys[keyIndex])) {
      throw bundleError(`summary ${index} has unsupported or missing fields`);
    }
    const goalId = exactText(candidate.goalId, MAX_ID_LENGTH, `summary ${index} goalId`);
    if (!goalIdPattern.test(goalId) || seen.has(goalId)) {
      throw bundleError(`summary ${index} has an invalid or duplicate goalId`);
    }
    seen.add(goalId);
    const goalLabel = exactText(candidate.goalLabel, MAX_LABEL_LENGTH, `summary ${index} goalLabel`);
    const status = candidate.status;
    if (!summaryStatuses.has(status as RuneProofStatus)) throw bundleError(`summary ${index} has an invalid status`);
    const explanation = exactText(candidate.explanation, MAX_DISPLAY_TEXT_LENGTH, `summary ${index} explanation`);
    const routeLabels = displayLabels(candidate.routeLabels, `summary ${index} routeLabels`);
    const blockerLabels = displayLabels(candidate.blockerLabels, `summary ${index} blockerLabels`);
    const unavoidableBlockerLabels = displayLabels(candidate.unavoidableBlockerLabels, `summary ${index} unavoidableBlockerLabels`);
    if (unavoidableBlockerLabels.some(label => !blockerLabels.includes(label))) {
      throw bundleError(`summary ${index} has an unavoidable label outside its blockers`);
    }
    const sourceVersion = exactText(candidate.sourceVersion, MAX_SOURCE_VERSION_LENGTH, `summary ${index} sourceVersion`);
    if (!safeRevision(candidate.runRevision)) throw bundleError(`summary ${index} has an invalid runRevision`);
    let proofHash: string | null;
    if (candidate.proofHash === null) proofHash = null;
    else if (typeof candidate.proofHash === 'string'
      && proofHashPattern.test(candidate.proofHash)) proofHash = candidate.proofHash;
    else throw bundleError(`summary ${index} has an invalid proofHash`);
    const positive = status === 'OBTAINABLE' || status === 'OBTAINABLE_RNG';
    if (positive && (proofHash === null || routeLabels.length === 0)) {
      throw bundleError(`summary ${index} has an incomplete positive proof`);
    }
    if (!positive && (proofHash !== null || routeLabels.length > 0)) {
      throw bundleError(`summary ${index} has a proof claim for a negative status`);
    }
    if (status === 'BLOCKED' && blockerLabels.length === 0) {
      throw bundleError(`summary ${index} has no blocker labels`);
    }
    if ((status === 'UNKNOWN' || status === 'IMPOSSIBLE')
      && (blockerLabels.length > 0 || unavoidableBlockerLabels.length > 0)) {
      throw bundleError(`summary ${index} has unsupported blocker claims`);
    }
    const stale = candidate.runRevision !== binding.runRevision
      || (expectedSource !== undefined && sourceVersion !== expectedSource);
    if (stale) {
      return unknownSummary(goalId, goalLabel, binding.runRevision, expectedSource ?? sourceVersion);
    }
    return {
      goalId, goalLabel, status: status as RuneProofStatus, explanation,
      routeLabels, blockerLabels, unavoidableBlockerLabels,
      proofHash, sourceVersion, runRevision: candidate.runRevision,
    };
  }).sort((left, right) => compareText(left.goalId, right.goalId));
  if (new TextEncoder().encode(canonicalJson(result)).byteLength > MAX_RUNEPROOF_BUNDLE_BYTES) {
    throw bundleError('summaries exceed the byte limit');
  }
  return result;
}

function unknownSummary(
  goalId: string,
  goalLabel: string,
  runRevision: number,
  sourceVersion: string,
): RuneProofBundleSummary {
  return {
    goalId, goalLabel, status: 'UNKNOWN',
    explanation: 'The selected proof is stale or could not be verified.',
    routeLabels: [], blockerLabels: [], unavoidableBlockerLabels: [],
    proofHash: null, sourceVersion, runRevision,
  };
}

function displayLabels(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_LABELS) throw bundleError(`${context} is invalid`);
  return [...new Set(value.map((label, index) =>
    exactText(label, MAX_LABEL_LENGTH, `${context}[${index}]`)))].sort(compareText);
}

function exactText(value: unknown, limit: number, context: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > limit
    || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw bundleError(`${context} is invalid`);
  }
  return value;
}
function safeRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function bundleError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Invalid RuneProof bundle: ${detail}`);
}

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
    runeProofSchemaVersion: RUNEPROOF_BUNDLE_SCHEMA_VERSION,
    runeProof: normalizeRuneProofBundleSummaries(input.runeProof ?? [], {
      runRevision: input.run.runRevision,
      sourceVersion: input.runeProofSourceVersion,
    }),
    account: input.run.linkedAccount?.trim() || null,
    gameModeId: input.run.gameModeId,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    bankLocks: bankLocksActive(input.run.gameModeId, input.run.customMode),
    knownMobility: sorted(MOBILITY_LIST),
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
    itemRules,
    detectorPolicies: DETECTOR_POLICIES.map((policy) => ({
      ...policy, eventTypes: [...policy.eventTypes],
    })),
    chunks,
  };
}
