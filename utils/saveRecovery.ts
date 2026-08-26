import type { GameState } from '../types';
import {
  parseAndMigrateSave,
  type SaveValidationResult,
} from './saveSchema';
import {
  verifySaveChecksum,
} from './saveIntegrity';
import type {
  MirrorMetadata,
  RecoveryCheckpoint,
  RecoveryHead,
} from './recoveryTypes';

type CandidateSource = 'pending' | 'mirror' | 'journal' | 'checkpoint';

/**
 * A save that has passed the same schema boundary used by normal startup.
 *
 * `persistenceRevision` is zero for an unsequenced pending or legacy mirror.
 * Such a candidate is never compared with a sequenced candidate by time.
 */
export interface ValidatedRecoveryCandidate {
  source: CandidateSource;
  data: string;
  state: GameState;
  persistenceRevision: number;
  runId: string;
  runRevision: number;
  capturedAt: number | null;
  checksum: string | null;
}

export interface SaveRecoveryInput {
  profileId: string;
  pendingRaw: string | null;
  primaryRaw: string | null;
  mirrorMetadataRaw: string | null;
  head: RecoveryHead | null;
  checkpoints: readonly RecoveryCheckpoint[];
  defaults: GameState;
}

export type SaveRecoveryDecision =
  | {
      kind: 'ready';
      source: 'pending' | 'mirror' | 'journal';
      reason: 'normal' | 'interrupted_mirror' | 'lifecycle_mirror' | 'legacy';
      data: string;
      state: GameState;
      persistenceRevision: number;
      /** Highest verified durable journal/mirror/checkpoint revision at startup. */
      maxDurablePersistenceRevision?: number;
      needsJournalImport: boolean;
    }
  | {
      kind: 'recovery_required';
      primaryRaw: string | null;
      candidates: readonly ValidatedRecoveryCandidate[];
      cause: 'corrupt_primary' | 'conflicting_runs' | 'unsequenced_primary';
    }
  | {
      kind: 'unsupported';
      rawCandidates: readonly string[];
    }
  | { kind: 'empty' };

type ValidatedResult = {
  candidate: ValidatedRecoveryCandidate;
} | {
  unsupported: string;
} | null;

type CandidateValidationMetadata = {
  persistenceRevision: number;
  capturedAt: number | null;
  checksum: string | null;
  runId?: string;
  runRevision?: number;
};

type ParsedMirrorMetadata = MirrorMetadata;

const MAX_SAFE_REVISION = Number.MAX_SAFE_INTEGER;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/i;
const CHECKPOINT_REASONS = new Set<RecoveryCheckpoint['reason']>([
  'interval',
  'session-start',
  'pre-replacement',
  'legacy-import',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isSafeNonNegativeInteger = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 0
);

const isValidChecksum = (value: unknown): value is string => (
  typeof value === 'string' && CHECKSUM_PATTERN.test(value)
);

const isValidRecoveryHead = (
  record: RecoveryHead | null,
  profileId: string,
): record is RecoveryHead => {
  if (!isRecord(record) || record.profileId !== profileId) return false;
  return typeof record.data === 'string'
    && isSafeNonNegativeInteger(record.persistenceRevision)
    && typeof record.runId === 'string'
    && isSafeNonNegativeInteger(record.runRevision)
    && isSafeNonNegativeInteger(record.capturedAt)
    && isValidChecksum(record.checksum);
};

const isValidRecoveryCheckpoint = (
  record: RecoveryCheckpoint,
  profileId: string,
): record is RecoveryCheckpoint => (
  isValidRecoveryHead(record, profileId)
  && CHECKPOINT_REASONS.has(record.reason)
);

const parseMirrorMetadata = (raw: string | null): ParsedMirrorMetadata | null => {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)
      || parsed.version !== 1
      || !isSafeNonNegativeInteger(parsed.persistenceRevision)
      || !isSafeNonNegativeInteger(parsed.capturedAt)
      || !isValidChecksum(parsed.checksum)) {
      return null;
    }
    return {
      version: 1,
      persistenceRevision: parsed.persistenceRevision,
      capturedAt: parsed.capturedAt,
      checksum: parsed.checksum,
    };
  } catch {
    return null;
  }
};

const candidateFromState = (
  source: CandidateSource,
  data: string,
  state: GameState,
  metadata: CandidateValidationMetadata,
): ValidatedRecoveryCandidate => ({
  source,
  data,
  state,
  persistenceRevision: metadata.persistenceRevision,
  runId: state.runId,
  runRevision: state.runRevision,
  capturedAt: metadata.capturedAt,
  checksum: metadata.checksum,
});

const parseCandidate = async (
  source: CandidateSource,
  data: string,
  defaults: GameState,
  metadata: CandidateValidationMetadata,
): Promise<ValidatedResult> => {
  if (typeof data !== 'string') return null;
  const parsed: SaveValidationResult = parseAndMigrateSave(data, defaults);
  if (parsed.ok === false) {
    return parsed.code === 'unsupported_version'
      ? { unsupported: data }
      : null;
  }
  if (metadata.runId !== undefined && parsed.state.runId !== metadata.runId) return null;
  if (metadata.runRevision !== undefined && parsed.state.runRevision !== metadata.runRevision) {
    return null;
  }
  return {
    candidate: candidateFromState(source, data, parsed.state, metadata),
  };
};

const validateUnsequencedRaw = async (
  source: 'pending' | 'mirror',
  data: string,
  defaults: GameState,
): Promise<ValidatedResult> => parseCandidate(source, data, defaults, {
  persistenceRevision: 0,
  capturedAt: null,
  checksum: null,
});

const validateJournalRecord = async (
  source: 'journal' | 'checkpoint',
  record: RecoveryHead | RecoveryCheckpoint,
  profileId: string,
  defaults: GameState,
): Promise<ValidatedResult> => {
  if (source === 'journal'
    ? !isValidRecoveryHead(record, profileId)
    : !isValidRecoveryCheckpoint(record as RecoveryCheckpoint, profileId)) {
    return null;
  }
  if (!await verifySaveChecksum(record.data, record.checksum)) return null;
  return parseCandidate(source, record.data, defaults, {
    persistenceRevision: record.persistenceRevision,
    capturedAt: record.capturedAt,
    checksum: record.checksum,
    runId: record.runId,
    runRevision: record.runRevision,
  });
};

const addUnsupported = (target: string[], value: string): void => {
  if (!target.includes(value)) target.push(value);
};

const sourceOrder: Record<CandidateSource, number> = {
  pending: 0,
  journal: 1,
  mirror: 2,
  checkpoint: 3,
};

const compareCandidates = (
  a: ValidatedRecoveryCandidate,
  b: ValidatedRecoveryCandidate,
): number => {
  if (a.source === 'pending' && b.source !== 'pending') return -1;
  if (b.source === 'pending' && a.source !== 'pending') return 1;
  if (a.persistenceRevision !== b.persistenceRevision) {
    return b.persistenceRevision - a.persistenceRevision;
  }
  const aCaptured = a.capturedAt ?? -1;
  const bCaptured = b.capturedAt ?? -1;
  if (aCaptured !== bCaptured) return bCaptured - aCaptured;
  const sourceDifference = sourceOrder[a.source] - sourceOrder[b.source];
  if (sourceDifference !== 0) return sourceDifference;
  if (a.runId !== b.runId) return a.runId < b.runId ? -1 : 1;
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  return 0;
};

const sortedCandidates = (
  candidates: readonly ValidatedRecoveryCandidate[],
): ValidatedRecoveryCandidate[] => [...candidates].sort(compareCandidates);

const readyDecision = (
  candidate: ValidatedRecoveryCandidate,
  reason: 'normal' | 'interrupted_mirror' | 'lifecycle_mirror' | 'legacy',
  needsJournalImport: boolean,
  maxDurablePersistenceRevision?: number,
): SaveRecoveryDecision => ({
  kind: 'ready',
  source: candidate.source === 'checkpoint' ? 'journal' : candidate.source,
  reason,
  data: candidate.data,
  state: candidate.state,
  persistenceRevision: candidate.persistenceRevision,
  ...(maxDurablePersistenceRevision === undefined
    ? {}
    : { maxDurablePersistenceRevision }),
  needsJournalImport,
});

const recoveryRequired = (
  input: SaveRecoveryInput,
  candidates: readonly ValidatedRecoveryCandidate[],
  cause: 'corrupt_primary' | 'conflicting_runs' | 'unsequenced_primary',
): SaveRecoveryDecision => ({
  kind: 'recovery_required',
  primaryRaw: input.primaryRaw,
  candidates: sortedCandidates(candidates),
  cause,
});

const hasSameBytes = (
  a: ValidatedRecoveryCandidate | null,
  b: ValidatedRecoveryCandidate | null,
): boolean => a !== null && b !== null && a.data === b.data;

const cloneWithSequence = (
  candidate: ValidatedRecoveryCandidate,
  sequence: ValidatedRecoveryCandidate,
): ValidatedRecoveryCandidate => ({
  ...candidate,
  persistenceRevision: sequence.persistenceRevision,
  capturedAt: sequence.capturedAt,
  checksum: sequence.checksum,
});

const nextRevision = (revision: number): number => (
  revision >= MAX_SAFE_REVISION ? revision : revision + 1
);

export const resolveSaveRecovery = async (
  input: SaveRecoveryInput,
): Promise<SaveRecoveryDecision> => {
  const unsupported: string[] = [];
  const validCandidates: ValidatedRecoveryCandidate[] = [];

  let pending: ValidatedRecoveryCandidate | null = null;
  if (input.pendingRaw !== null) {
    const result = await validateUnsequencedRaw('pending', input.pendingRaw, input.defaults);
    if (result !== null && 'unsupported' in result) addUnsupported(unsupported, result.unsupported);
    if (result !== null && 'candidate' in result) {
      pending = result.candidate;
      validCandidates.push(pending);
    }
  }

  let head: ValidatedRecoveryCandidate | null = null;
  if (input.head !== null) {
    const result = await validateJournalRecord('journal', input.head, input.profileId, input.defaults);
    if (result !== null && 'unsupported' in result) addUnsupported(unsupported, result.unsupported);
    if (result !== null && 'candidate' in result) {
      head = result.candidate;
      validCandidates.push(head);
    }
  }

  const checkpoints: ValidatedRecoveryCandidate[] = [];
  for (const checkpoint of input.checkpoints) {
    const result = await validateJournalRecord(
      'checkpoint',
      checkpoint,
      input.profileId,
      input.defaults,
    );
    if (result !== null && 'unsupported' in result) addUnsupported(unsupported, result.unsupported);
    if (result !== null && 'candidate' in result) {
      checkpoints.push(result.candidate);
      validCandidates.push(result.candidate);
    }
  }

  let primary: ValidatedRecoveryCandidate | null = null;
  let mirrorMetadata: ParsedMirrorMetadata | null = null;
  let sidecarMatchesPrimary = false;
  if (input.primaryRaw !== null) {
    const parsedPrimary = await validateUnsequencedRaw('mirror', input.primaryRaw, input.defaults);
    if (parsedPrimary !== null && 'unsupported' in parsedPrimary) {
      addUnsupported(unsupported, parsedPrimary.unsupported);
    }
    if (parsedPrimary !== null && 'candidate' in parsedPrimary) {
      primary = parsedPrimary.candidate;
      mirrorMetadata = parseMirrorMetadata(input.mirrorMetadataRaw);
      sidecarMatchesPrimary = mirrorMetadata !== null
        && await verifySaveChecksum(primary.data, mirrorMetadata.checksum);
      if (sidecarMatchesPrimary && mirrorMetadata !== null) {
        primary = {
          ...primary,
          persistenceRevision: mirrorMetadata.persistenceRevision,
          capturedAt: mirrorMetadata.capturedAt,
          checksum: mirrorMetadata.checksum,
        };
      }
      validCandidates.push(primary);
    }
  }

  // Future data is intentionally a hard read-only boundary. A corrupt head
  // is ignored, but a checksum-verified future head must remain visible.
  if (unsupported.length > 0) return { kind: 'unsupported', rawCandidates: unsupported };

  const candidates = sortedCandidates(validCandidates);
  const runIds = new Set(candidates.map(candidate => candidate.runId));
  if (runIds.size > 1) return recoveryRequired(input, candidates, 'conflicting_runs');

  const maxDurablePersistenceRevision = Math.max(
    head?.persistenceRevision ?? 0,
    primary?.persistenceRevision ?? 0,
    ...checkpoints.map(candidate => candidate.persistenceRevision),
  );

  // A current-lifetime staged write is the only candidate allowed to outrank
  // a durable revision without a persistence sequence.
  if (pending !== null) {
    return readyDecision(
      pending,
      'normal',
      true,
      maxDurablePersistenceRevision,
    );
  }

  const durableCandidates = candidates.filter(candidate => candidate.source !== 'pending');
  if (primary === null) {
    if (input.primaryRaw !== null) {
      return recoveryRequired(input, durableCandidates, 'corrupt_primary');
    }
    if (head !== null) return readyDecision(head, 'normal', false);
    if (checkpoints.length > 0) return recoveryRequired(input, checkpoints, 'corrupt_primary');
    return { kind: 'empty' };
  }

  const sortedCheckpoints = sortedCandidates(checkpoints);
  const latestCheckpoint = sortedCheckpoints[0] ?? null;

  if (head !== null) {
    // Identical bytes are already durable in the journal, irrespective of a
    // missing or stale sidecar.
    if (hasSameBytes(primary, head)) {
      if (sidecarMatchesPrimary) {
        if (primary.persistenceRevision > head.persistenceRevision) {
          return readyDecision(primary, 'lifecycle_mirror', true);
        }
        if (primary.persistenceRevision < head.persistenceRevision) {
          return readyDecision(head, 'interrupted_mirror', false);
        }
        return readyDecision(primary, 'normal', false);
      }
      return readyDecision(head, 'normal', false);
    }

    const sidecarMatchesHead = mirrorMetadata !== null
      && mirrorMetadata.persistenceRevision === head.persistenceRevision
      && mirrorMetadata.capturedAt === head.capturedAt
      && mirrorMetadata.checksum === head.checksum;

    // A pagehide mirror can finish after the journal commit but before its
    // sidecar write. The sidecar still authenticates the head, so this is a
    // lifecycle write rather than an unsequenced choice. Its next sequence is
    // deterministic and does not consult wall-clock time.
    if (!sidecarMatchesPrimary && sidecarMatchesHead) {
      const lifecycle = {
        ...primary,
        persistenceRevision: nextRevision(head.persistenceRevision),
        capturedAt: head.capturedAt,
        checksum: null,
      };
      return readyDecision(lifecycle, 'lifecycle_mirror', true);
    }

    if (sidecarMatchesPrimary) {
      if (primary.persistenceRevision > head.persistenceRevision) {
        return readyDecision(primary, 'lifecycle_mirror', true);
      }
      if (primary.persistenceRevision < head.persistenceRevision) {
        return readyDecision(head, 'interrupted_mirror', false);
      }
      // Two different byte strings at one verified persistence revision are
      // contradictory evidence. CapturedAt is not a safe tie-breaker here.
      return recoveryRequired(input, [primary, head, ...sortedCheckpoints], 'unsequenced_primary');
    }

    // No verified sidecar means that a differing primary cannot be ordered
    // against the head. In particular, do not use capturedAt as a guess.
    return recoveryRequired(input, [primary, head, ...sortedCheckpoints], 'unsequenced_primary');
  }

  if (latestCheckpoint !== null) {
    const matchingCheckpoint = sortedCheckpoints.find(
      checkpointCandidate => checkpointCandidate.data === primary.data,
    ) ?? null;
    if (matchingCheckpoint !== null) {
      if (sidecarMatchesPrimary) {
        if (primary.persistenceRevision > matchingCheckpoint.persistenceRevision) {
          return readyDecision(primary, 'lifecycle_mirror', true);
        }
        if (primary.persistenceRevision === matchingCheckpoint.persistenceRevision) {
          return readyDecision(primary, 'normal', false);
        }
      }
      const sequencedPrimary = cloneWithSequence(primary, matchingCheckpoint);
      return readyDecision(sequencedPrimary, 'normal', true);
    }

    if (sidecarMatchesPrimary) {
      if (primary.persistenceRevision > latestCheckpoint.persistenceRevision) {
        return readyDecision(primary, 'lifecycle_mirror', true);
      }
      return recoveryRequired(
        input,
        [primary, ...sortedCheckpoints],
        'unsequenced_primary',
      );
    }

    return recoveryRequired(input, [primary, ...sortedCheckpoints], 'unsequenced_primary');
  }

  return readyDecision(
    primary,
    sidecarMatchesPrimary ? 'normal' : 'legacy',
    true,
  );
};
