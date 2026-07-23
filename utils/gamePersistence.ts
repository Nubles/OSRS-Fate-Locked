import type { GameState } from '../types';
import {
  validateAndMigrateSave,
  type SaveErrorCode,
  type SaveValidationResult,
  type SaveWarning,
} from './saveSchema';

export type ImportResult =
  | { ok: true; warnings: SaveWarning[] }
  | { ok: false; code: SaveErrorCode; message: string; path?: string };

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
  | { stored: false; reason: 'empty' | 'duplicate' | 'storage_unavailable' };

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
  replace: (state: GameState) => void;
};

type ReplacementOptions = ReplacementCallbacks & {
  defaults: GameState;
};

const STORAGE_WARNING: SaveWarning = {
  code: 'storage_warning',
  message: 'The current run could not be saved as a protective backup.',
};

export const applyValidatedReplacement = (
  prepared: SaveValidationResult,
  options: ReplacementCallbacks,
): ImportResult => {
  if (prepared.ok === false) return prepared;

  const backup = options.writeBackup(serializeCurrent(options.current));
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
