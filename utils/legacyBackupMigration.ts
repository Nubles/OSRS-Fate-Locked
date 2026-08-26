import type { GameState } from '../types';
import type { SaveWriteAuthorization } from './profileWriterLease';
import type {
  RecoveryCheckpoint,
  RecoveryRepository,
  RecoveryWriteResult,
} from './recoveryTypes';
import {
  parseAndMigrateSave,
  type SaveValidationResult,
} from './saveSchema';
import { checksumSave } from './saveIntegrity';
import { serializeCurrent } from './gamePersistence';
import { simpleHash } from './integrity';

export const LEGACY_BACKUP_MIGRATION_VERSION = 1;
export const MAX_LEGACY_IMPORTS = 8;

export const legacyBackupMigrationKey = (profileId: string): string =>
  `legacy-backups:${profileId}`;

export interface LegacyBackupEntry {
  ts: number;
  reason: string;
  summary: string;
  data: string;
}

export interface LegacyBackupMigrationMetadata {
  version: 1;
  completedAt: number;
  imported: number;
  skipped: number;
}

export interface LegacyBackupMigrationInput {
  profileId: string;
  rawRing: string | null;
  repository: RecoveryRepository;
  authorizeWrite: () => SaveWriteAuthorization;
  /** Pass the provider's defaults to avoid loading the React context here. */
  defaults?: GameState;
  /** Optional validator for callers that already own the save pipeline. */
  validate?: (data: string) => SaveValidationResult;
  checksum?: (data: string) => Promise<string>;
  now?: () => number;
}

export interface LegacyBackupMigrationResult {
  imported: number;
  skipped: number;
  alreadyMigrated: boolean;
}

type ParsedLegacyEntry = {
  entry: LegacyBackupEntry;
  state: GameState;
  data: string;
  checksum: string;
  ringIndex: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isSafeTimestamp = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 0
);

const parseLegacyEntry = (value: unknown): LegacyBackupEntry | null => {
  if (!isRecord(value)
    || !isSafeTimestamp(value.ts)
    || typeof value.reason !== 'string'
    || typeof value.summary !== 'string'
    || typeof value.data !== 'string'
    || value.data.length === 0) {
    return null;
  }
  return {
    ts: value.ts,
    reason: value.reason,
    summary: value.summary,
    data: value.data,
  };
};

const stableLegacyRunId = (data: string): string => {
  // Very old saves may not contain a runId. The normal parser fills that gap
  // from its defaults, which are intentionally a fresh random run on every
  // process. Derive a deterministic UUID-shaped identity from the raw bytes
  // instead, so a restart produces the same checkpoint metadata and checksum.
  const seed = [0, 1, 2, 3]
    .map(index => simpleHash(`${data}|legacy-run-id|${index}`))
    .join('');
  const variant = '89ab'[Number.parseInt(seed[16], 16) % 4];
  return `${seed.slice(0, 8)}-${seed.slice(8, 12)}-4${seed.slice(13, 16)}-${variant}${seed.slice(17, 20)}-${seed.slice(20, 32)}`;
};

const normalizeLegacyInput = (data: string): { data: string; runId: string | null } => {
  try {
    const parsed: unknown = JSON.parse(data);
    if (!isRecord(parsed) || Object.prototype.hasOwnProperty.call(parsed, 'runId')) {
      return { data, runId: null };
    }
    const runId = stableLegacyRunId(data);
    return { data: JSON.stringify({ ...parsed, runId }), runId };
  } catch {
    return { data, runId: null };
  }
};

const parseLegacyRing = (rawRing: string | null): {
  entries: LegacyBackupEntry[];
  skipped: number;
} => {
  if (rawRing === null || rawRing.trim() === '') return { entries: [], skipped: 0 };
  try {
    const parsed: unknown = JSON.parse(rawRing);
    if (!Array.isArray(parsed)) return { entries: [], skipped: 1 };
    const entries: LegacyBackupEntry[] = [];
    let skipped = 0;
    for (const candidate of parsed) {
      const entry = parseLegacyEntry(candidate);
      if (entry === null) skipped += 1;
      else entries.push(entry);
    }
    const overflow = Math.max(0, entries.length - MAX_LEGACY_IMPORTS);
    return {
      entries: entries.slice(0, MAX_LEGACY_IMPORTS),
      skipped: skipped + overflow,
    };
  } catch {
    return { entries: [], skipped: 1 };
  }
};

const writeSucceeded = (result: RecoveryWriteResult): boolean => result.stored === true;

const authorized = (
  authorizeWrite: () => SaveWriteAuthorization,
): boolean => authorizeWrite().ok;

const defaultValidation = async (
  data: string,
  defaults: GameState | undefined,
): Promise<SaveValidationResult> => {
  if (defaults !== undefined) return parseAndMigrateSave(data, defaults);
  // The migration utility is also used by standalone startup tooling. Keep
  // the provider out of the module's eager dependency graph, but use exactly
  // the same defaults and parser when no caller supplied them.
  const context = await import('../context/GameContext');
  return parseAndMigrateSave(data, context.createFreshState());
};

const readExistingRecords = async (
  input: LegacyBackupMigrationInput,
): Promise<{
  headRevision: number;
  headChecksum: string | null;
  hasHead: boolean;
  checkpoints: RecoveryCheckpoint[];
}> => {
  let headRevision = 0;
  let headChecksum: string | null = null;
  let hasHead = false;
  let checkpoints: RecoveryCheckpoint[] = [];
  try {
    const head = await input.repository.getHead(input.profileId);
    if (head !== null && Number.isSafeInteger(head.persistenceRevision)) {
      hasHead = true;
      headRevision = Math.max(0, head.persistenceRevision);
    }
    if (head !== null && typeof head.checksum === 'string') {
      headChecksum = head.checksum;
    }
  } catch {
    // A later write will report the unavailable repository; no bytes are
    // discarded merely because the read side is unavailable.
  }
  try {
    checkpoints = await input.repository.listCheckpoints(input.profileId);
  } catch {
    checkpoints = [];
  }
  if (!hasHead) {
    for (const checkpoint of checkpoints) {
      if (Number.isSafeInteger(checkpoint.persistenceRevision)) {
        headRevision = Math.max(headRevision, checkpoint.persistenceRevision);
      }
    }
  }
  return { headRevision, headChecksum, hasHead, checkpoints };
};

const legacyRevisions = (
  headRevision: number,
  hasHead: boolean,
  checkpoints: readonly RecoveryCheckpoint[],
  count: number,
): number[] => {
  const used = new Set(checkpoints.map(checkpoint => checkpoint.persistenceRevision));
  const revisions: number[] = [];
  if (!hasHead) {
    const existingRevisions = checkpoints
      .map(checkpoint => checkpoint.persistenceRevision)
      .filter(revision => Number.isSafeInteger(revision) && revision >= 0);
    if (existingRevisions.length > 0) {
      // A checkpoint can be the only durable evidence when its replaceable
      // head was lost. Keep imported legacy history strictly older than that
      // evidence rather than assigning it a larger sequence by default.
      const oldestExisting = Math.min(...existingRevisions);
      for (let next = oldestExisting - 1; next >= 0 && revisions.length < count; next -= 1) {
        if (!used.has(next)) revisions.unshift(next);
      }
      return revisions;
    }
    let next = Math.max(1, headRevision + 1);
    while (revisions.length < count) {
      if (!used.has(next)) revisions.push(next);
      if (next >= Number.MAX_SAFE_INTEGER) {
        // There is no higher safe sequence number. Use the nearest available
        // lower slots rather than spinning forever on a saturated revision.
        for (let fallback = Math.min(Number.MAX_SAFE_INTEGER - 1, next - 1);
          fallback >= 0 && revisions.length < count;
          fallback -= 1) {
          if (!used.has(fallback) && !revisions.includes(fallback)) revisions.unshift(fallback);
        }
        break;
      }
      next += 1;
    }
    return revisions;
  }

  // Legacy entries describe history that predates the current journal head.
  // Use the available sequence immediately before the head first, so importing
  // old bytes cannot make them look newer than the current durable run.
  for (let next = headRevision; next >= 0 && revisions.length < count; next -= 1) {
    if (!used.has(next)) revisions.unshift(next);
  }
  return revisions;
};

/**
 * Import the old localStorage backup ring into immutable journal checkpoints.
 * The legacy ring is deliberately read-only here so an older app can still
 * roll the profile back. A completed metadata record makes retries cheap;
 * retries after a checkpoint write but before metadata use checksum
 * deduplication instead of producing a second copy.
 */
export const migrateLegacyBackupRing = async (
  input: LegacyBackupMigrationInput,
): Promise<LegacyBackupMigrationResult> => {
  let migration: unknown = null;
  try {
    migration = await input.repository.getMetadata<LegacyBackupMigrationMetadata>(
      legacyBackupMigrationKey(input.profileId),
    );
  } catch {
    // Continue so an unavailable metadata read cannot make us mutate the
    // legacy ring or silently mark migration complete.
  }
  if (isRecord(migration)
    && migration.version === LEGACY_BACKUP_MIGRATION_VERSION
    && typeof migration.completedAt === 'number'
    && typeof migration.imported === 'number'
    && typeof migration.skipped === 'number') {
    return { imported: 0, skipped: 0, alreadyMigrated: true };
  }

  const parsedRing = parseLegacyRing(input.rawRing);
  const { headRevision, headChecksum, hasHead, checkpoints } = await readExistingRecords(input);
  const existingChecksums = new Set(
    checkpoints
      .map(checkpoint => checkpoint.checksum)
      .filter(checksum => typeof checksum === 'string'),
  );
  if (headChecksum !== null) existingChecksums.add(headChecksum);
  const checksum = input.checksum ?? checksumSave;
  const parsed: ParsedLegacyEntry[] = [];
  const seenChecksums = new Set(existingChecksums);
  let skipped = parsedRing.skipped;

  for (const [ringIndex, entry] of parsedRing.entries.entries()) {
    const normalizedInput = normalizeLegacyInput(entry.data);
    let validation: SaveValidationResult;
    try {
      validation = input.validate
        ? input.validate(normalizedInput.data)
        : await defaultValidation(normalizedInput.data, input.defaults);
    } catch {
      skipped += 1;
      continue;
    }
    if (validation.ok === false) {
      skipped += 1;
      continue;
    }
    let entryChecksum: string;
    const state = normalizedInput.runId === null
      ? validation.state
      : { ...validation.state, runId: normalizedInput.runId };
    const normalizedData = serializeCurrent(state);
    try {
      entryChecksum = await checksum(normalizedData);
    } catch {
      skipped += 1;
      continue;
    }
    if (seenChecksums.has(entryChecksum)) {
      skipped += 1;
      continue;
    }
    seenChecksums.add(entryChecksum);
    parsed.push({
      entry,
      state,
      data: normalizedData,
      checksum: entryChecksum,
      ringIndex,
    });
  }

  parsed.sort((a, b) => a.entry.ts - b.entry.ts || a.ringIndex - b.ringIndex);
  const revisions = legacyRevisions(headRevision, hasHead, checkpoints, parsed.length);
  const importable = parsed.slice(0, revisions.length);
  skipped += parsed.length - importable.length;
  let imported = 0;
  for (const [index, item] of importable.entries()) {
    // Reauthorize immediately before each durable mutation. The repository
    // repeats this check inside its transaction, closing the race after this
    // synchronous guard.
    if (!authorized(input.authorizeWrite)) break;
    const persistenceRevision = revisions[index];
    const record: RecoveryCheckpoint = {
      profileId: input.profileId,
      persistenceRevision,
      runId: item.state.runId,
      runRevision: item.state.runRevision,
      capturedAt: item.entry.ts,
      checksum: item.checksum,
      data: item.data,
      reason: 'legacy-import',
    };
    let result: RecoveryWriteResult;
    try {
      result = await input.repository.putCheckpoint(record, input.authorizeWrite);
    } catch {
      result = { stored: false, reason: 'storage_unavailable' };
    }
    if (!writeSucceeded(result)) {
      if (result.stored === false && result.reason === 'ownership_conflict') break;
      continue;
    }
    imported += 1;
  }

  const metadata: LegacyBackupMigrationMetadata = {
    version: 1,
    completedAt: input.now?.() ?? Date.now(),
    imported,
    skipped,
  };
  // Do not claim completion after a lost lease or a failed checkpoint write.
  // A retry can then inspect the existing checkpoint checksums safely.
  if (imported === importable.length && authorized(input.authorizeWrite)) {
    try {
      const result = await input.repository.putMetadata(
        legacyBackupMigrationKey(input.profileId),
        metadata,
        input.authorizeWrite,
      );
      if (writeSucceeded(result)) {
        return { imported, skipped, alreadyMigrated: false };
      }
    } catch {
      // Report the completed checkpoint count but leave the marker absent so
      // the next startup can retry idempotently.
    }
  }
  return { imported, skipped, alreadyMigrated: false };
};
