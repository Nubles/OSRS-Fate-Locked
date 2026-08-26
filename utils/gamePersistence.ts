import type { GameState } from '../types';
import {
  validateAndMigrateSave,
  type SaveErrorCode,
  type SaveValidationResult,
  type SaveWarning,
} from './saveSchema';
import type { SaveWriteAuthorizationReason } from './profileWriterLease';
import type { RecoveryCheckpointReason, SaveDurabilitySnapshot } from './recoveryTypes';

export type ImportErrorCode = SaveErrorCode
  | 'storage_unavailable'
  | 'ownership_conflict'
  | 'stale_replacement';

export type ImportResult =
  | { ok: true; warnings: SaveWarning[] }
  | { ok: false; code: ImportErrorCode; message: string; path?: string };

export const ACCEPTED_WARNING_CLOSE_DELAY_MS = 1_500;

export type ImportUiDecision = {
  close: boolean;
  closeDelayMs: number | null;
  success: string | null;
  error: string | null;
  warning: string | null;
};

export const importUiDecision = (result: ImportResult): ImportUiDecision => {
  if (result.ok === false) {
    return {
      close: false,
      closeDelayMs: null,
      success: null,
      error: result.message,
      warning: null,
    };
  }

  const warning = result.warnings.length > 0
    ? result.warnings.map(item => item.message).join(' ')
    : null;

  return {
    close: true,
    closeDelayMs: warning ? ACCEPTED_WARNING_CLOSE_DELAY_MS : 0,
    success: 'Fate restored successfully',
    error: null,
    warning,
  };
};

export type ImportRequestToken = {
  id: number;
  source: string;
};

export type SourceBoundCandidate<T> = {
  source: string;
  value: T;
};

export const isCurrentImportRequest = (
  latestId: number,
  currentSource: string,
  request: ImportRequestToken,
): boolean => latestId === request.id && currentSource === request.source;

export const candidateMatchesSource = <T>(
  candidate: SourceBoundCandidate<T> | null,
  currentSource: string,
): candidate is SourceBoundCandidate<T> => candidate?.source === currentSource;

export type BackupWriteResult =
  | { stored: true }
  | { stored: false; reason: 'empty' | 'duplicate' | 'storage_unavailable' | 'ownership_conflict' };

export class SaveAuthorizationError extends Error {
  constructor(public readonly code: SaveWriteAuthorizationReason) {
    super(code === 'storage_unavailable'
      ? 'Profile save ownership could not be verified because storage is unavailable.'
      : 'Profile save ownership is held by another tab.');
    this.name = 'SaveAuthorizationError';
  }
}

export class SaveOwnershipConflictError extends SaveAuthorizationError {
  constructor() {
    super('ownership_conflict');
    this.name = 'SaveOwnershipConflictError';
  }
}

export const serializeCurrent = (
  state: GameState & { lastEvent?: unknown },
): string => {
  const { lastEvent: _lastEvent, ...persisted } = state;
  return JSON.stringify(persisted);
};

export const prepareReplacement = (
  input: unknown,
  _current: GameState,
  defaults: GameState,
): SaveValidationResult => validateAndMigrateSave(input, defaults);

type ReplacementCallbacks = {
  current: GameState & { lastEvent?: unknown };
  writeBackup: (data: string) => BackupWriteResult;
  writeReplacement: (data: string) => void;
  replace: (state: GameState) => void;
};

type ReplacementOptions = ReplacementCallbacks & {
  defaults: GameState;
};

type AsyncReplacementCallbacks = {
  current: GameState & { lastEvent?: unknown };
  createCheckpoint: (
    data: string,
    reason: RecoveryCheckpointReason,
  ) => Promise<BackupWriteResult>;
  writeReplacement: (
    data: string,
    reason: string,
  ) => Promise<SaveDurabilitySnapshot>;
  replace: (state: GameState) => void;
  /** Return false when a newer edit, replacement, profile, or unmount won. */
  isCurrent?: () => boolean;
};

const STORAGE_WARNING: SaveWarning = {
  code: 'storage_warning',
  message: 'The current run could not be saved as a protective backup.',
};

const replacementStorageFailure = (): ImportResult => ({
  ok: false,
  code: 'storage_unavailable',
  message: 'The replacement run could not be saved. Your current run is unchanged.',
});

export const replacementStaleResult = (): ImportResult => ({
  ok: false,
  code: 'stale_replacement',
  message: 'The replacement was superseded by a newer change. Your current run is unchanged.',
});

export const saveAuthorizationFailureResult = (
  reason: SaveWriteAuthorizationReason,
): ImportResult => reason === 'storage_unavailable'
  ? replacementStorageFailure()
  : {
      ok: false,
      code: 'ownership_conflict',
      message: 'This profile is being saved by another tab. Take over before replacing it.',
    };

export const ownershipConflictResult = (): ImportResult =>
  saveAuthorizationFailureResult('ownership_conflict');

export const applyValidatedReplacement = (
  prepared: SaveValidationResult,
  options: ReplacementCallbacks,
): ImportResult => {
  if (prepared.ok === false) return prepared;

  const backup = options.writeBackup(serializeCurrent(options.current));
  try {
    options.writeReplacement(serializeCurrent(prepared.state));
  } catch (error) {
    if (error instanceof SaveAuthorizationError) {
      return saveAuthorizationFailureResult(error.code);
    }
    return replacementStorageFailure();
  }
  options.replace(prepared.state);

  const warnings = [...prepared.warnings];
  if (
    backup.stored === false
    && backup.reason === 'storage_unavailable'
    && !warnings.some(warning => warning.code === 'storage_warning')
  ) {
    warnings.push(STORAGE_WARNING);
  }
  return { ok: true, warnings };
};

/**
 * Apply a validated replacement through the crash-safe coordinator. The
 * current state is checkpointed first, and in-memory state changes only after
 * the coordinator reports at least one verified durable store.
 */
export const applyValidatedReplacementAsync = async (
  prepared: SaveValidationResult,
  options: AsyncReplacementCallbacks,
): Promise<ImportResult> => {
  if (prepared.ok === false) return prepared;

  const isCurrent = (): boolean => {
    try {
      return options.isCurrent?.() ?? true;
    } catch {
      return false;
    }
  };
  if (!isCurrent()) return replacementStaleResult();

  // Capture exact bytes before crossing an async boundary. The guard supplied
  // by the provider also checks that these bytes still describe the active
  // profile and mounted component when the durable replacement settles.
  const currentData = serializeCurrent(options.current);
  const replacementData = serializeCurrent(prepared.state);
  if (!isCurrent()) return replacementStaleResult();

  let backup: BackupWriteResult;
  try {
    backup = await options.createCheckpoint(
      currentData,
      'pre-replacement',
    );
  } catch {
    backup = { stored: false, reason: 'storage_unavailable' };
  }
  if (!isCurrent()) return replacementStaleResult();
  let durability: SaveDurabilitySnapshot;
  try {
    durability = await options.writeReplacement(
      replacementData,
      'replacement',
    );
  } catch (error) {
    if (error instanceof SaveAuthorizationError) {
      return saveAuthorizationFailureResult(error.code);
    }
    return replacementStorageFailure();
  }

  if (!isCurrent()) return replacementStaleResult();
  if (durability.primary !== 'saved') return replacementStorageFailure();
  options.replace(prepared.state);

  const warnings = [...prepared.warnings];
  if (
    backup.stored === false
    && backup.reason === 'storage_unavailable'
    && !warnings.some(warning => warning.code === 'storage_warning')
  ) {
    warnings.push(STORAGE_WARNING);
  }
  return { ok: true, warnings };
};

export const applyPreparedReplacement = (
  input: unknown,
  options: ReplacementOptions,
): ImportResult => applyValidatedReplacement(
  prepareReplacement(input, options.current, options.defaults),
  options,
);
