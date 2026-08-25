import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameState } from '../types';
import { createFreshState } from '../context/GameContext';
import {
  getPendingSave,
  type PendingSaveEntry,
} from '../utils/pendingSaves';
import {
  archiveCorruptSave,
  buildCorruptSaveArchive,
  type CorruptSaveEvidence,
} from '../utils/profileStorage';
import { profileMirrorMetadataKey } from '../utils/storageRecovery';
import {
  openRecoveryDatabase,
} from '../utils/recoveryDatabase';
import type {
  RecoveryRepository,
} from '../utils/recoveryTypes';
import { checksumSave } from '../utils/saveIntegrity';
import {
  resolveSaveRecovery,
  type SaveRecoveryDecision,
  type SaveRecoveryInput,
  type ValidatedRecoveryCandidate,
} from '../utils/saveRecovery';
import {
  SaveRecoveryScreen,
  type RecoveryActionResult,
} from './SaveRecoveryScreen';

export interface SaveBootstrapResult {
  initialState: GameState;
  initialData: string | null;
  persistenceRevision: number;
  source: 'empty' | 'pending' | 'mirror' | 'journal' | 'recovery';
  needsJournalImport: boolean;
}

export interface SaveBootstrapReplacement {
  profileId: string;
  storageKey: string;
  data: string;
  state: GameState;
  persistenceRevision: number;
  capturedAt: number | null;
  checksum: string | null;
}

export interface SaveBootstrapDependencies {
  createFreshState: () => GameState;
  readPending: (storageKey: string) => string | null;
  readPrimary: (storageKey: string) => string | null;
  readMirrorMetadata: (storageKey: string) => string | null;
  openRepository: (profileId: string) => RecoveryRepository | PromiseLike<RecoveryRepository>;
  resolveSaveRecovery: (
    input: SaveRecoveryInput,
  ) => SaveRecoveryDecision | PromiseLike<SaveRecoveryDecision>;
  archiveCorruptEvidence?: (
    storageKey: string,
    evidence: CorruptSaveEvidence,
  ) => RecoveryActionResult | Promise<RecoveryActionResult>;
  replaceSave?: (
    replacement: SaveBootstrapReplacement,
  ) => RecoveryActionResult | Promise<RecoveryActionResult>;
  exportRecovery?: (
    storageKey: string,
    decision: Exclude<SaveRecoveryDecision, ReadyDecision | { kind: 'empty' }>,
  ) => RecoveryActionResult | Promise<RecoveryActionResult>;
}

type ReadyDecision = Extract<SaveRecoveryDecision, { kind: 'ready' }>;

const unavailableRecoveryRepository: RecoveryRepository = {
  getHead: async () => null,
  putHead: async () => ({ stored: false, reason: 'storage_unavailable' }),
  listCheckpoints: async () => [],
  putCheckpoint: async () => ({ stored: false, reason: 'storage_unavailable' }),
  deleteCheckpoints: async () => ({ stored: false, reason: 'storage_unavailable' }),
  getMetadata: async () => null,
  putMetadata: async () => ({ stored: false, reason: 'storage_unavailable' }),
  close: () => undefined,
};

const readStorage = (key: string): string | null => {
  return window.localStorage.getItem(key);
};

const writeStorageVerified = (key: string, data: string): boolean => {
  try {
    window.localStorage.setItem(key, data);
    return window.localStorage.getItem(key) === data;
  } catch {
    return false;
  }
};

const productionArchiveCorruptEvidence = async (
  storageKey: string,
  evidence: CorruptSaveEvidence,
): Promise<RecoveryActionResult> => archiveCorruptSave(window.localStorage, storageKey, evidence);

const productionReplaceSave = async (
  replacement: SaveBootstrapReplacement,
): Promise<RecoveryActionResult> => {
  if (!writeStorageVerified(replacement.storageKey, replacement.data)) {
    return { ok: false, message: 'The replacement save could not be written.' };
  }

  try {
    const checksum = replacement.checksum ?? await checksumSave(replacement.data);
    const metadata = JSON.stringify({
      version: 1,
      persistenceRevision: replacement.persistenceRevision,
      capturedAt: replacement.capturedAt ?? Date.now(),
      checksum,
    });
    const metadataKey = profileMirrorMetadataKey(replacement.storageKey);
    window.localStorage.setItem(metadataKey, metadata);
    if (window.localStorage.getItem(metadataKey) !== metadata) {
      return { ok: false, message: 'The replacement save metadata could not be verified.' };
    }
  } catch {
    return { ok: false, message: 'The replacement save metadata could not be verified.' };
  }
  return { ok: true };
};

const productionExportRecovery = async (
  storageKey: string,
  decision: Exclude<SaveRecoveryDecision, ReadyDecision | { kind: 'empty' }>,
): Promise<RecoveryActionResult> => {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    return { ok: false, message: 'Recovery export is unavailable in this browser.' };
  }
  try {
    const primary = decision.kind === 'recovery_required' ? decision.primaryRaw : null;
    const mirrorMetadata = readStorage(profileMirrorMetadataKey(storageKey));
    const bounded = await buildCorruptSaveArchive({ primary, mirrorMetadata });
    const candidates = decision.kind === 'recovery_required'
      ? decision.candidates.map(candidate => ({
        source: candidate.source,
        persistenceRevision: candidate.persistenceRevision,
        capturedAt: candidate.capturedAt,
        runId: candidate.runId,
        runRevision: candidate.runRevision,
        data: candidate.data,
      }))
      : [];
    const payload = JSON.stringify({
      version: 1,
      capturedAt: Date.now(),
      evidence: bounded,
      candidates,
    });
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fate_locked_recovery_${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Recovery export failed.' };
  }
};

const pendingData = (entry: PendingSaveEntry | null): string | null => entry?.data ?? null;

const openProductionRepository = async (): Promise<RecoveryRepository> => {
  if (typeof indexedDB === 'undefined') return unavailableRecoveryRepository;
  try {
    return await openRecoveryDatabase();
  } catch {
    throw new Error('Recovery storage could not be opened.');
  }
};

export const productionSaveBootstrapDependencies: SaveBootstrapDependencies = {
  createFreshState,
  readPending: storageKey => pendingData(getPendingSave(storageKey)),
  readPrimary: storageKey => readStorage(storageKey),
  readMirrorMetadata: storageKey => readStorage(profileMirrorMetadataKey(storageKey)),
  openRepository: _profileId => openProductionRepository(),
  resolveSaveRecovery,
  archiveCorruptEvidence: productionArchiveCorruptEvidence,
  replaceSave: productionReplaceSave,
  exportRecovery: productionExportRecovery,
};

/** Alias kept deliberately descriptive for callers that construct a boundary explicitly. */
export const defaultSaveBootstrapDependencies = productionSaveBootstrapDependencies;

export const createSaveBootstrapDependencies = (
  overrides: Partial<SaveBootstrapDependencies> = {},
): SaveBootstrapDependencies => ({
  ...productionSaveBootstrapDependencies,
  ...overrides,
});

const decisionResult = (
  decision: SaveRecoveryDecision,
  makeFreshState: () => GameState,
): SaveBootstrapResult | null => {
  if (decision.kind === 'empty') {
    return {
      initialState: makeFreshState(),
      initialData: null,
      persistenceRevision: 0,
      source: 'empty',
      needsJournalImport: false,
    };
  }
  if (decision.kind !== 'ready') return null;
  return {
    initialState: decision.state,
    initialData: decision.data,
    persistenceRevision: decision.persistenceRevision,
    source: decision.source,
    needsJournalImport: decision.needsJournalImport,
  };
};

export const saveBootstrapResultFromDecision = (
  decision: SaveRecoveryDecision,
  makeFreshState: () => GameState = createFreshState,
): SaveBootstrapResult | null => decisionResult(decision, makeFreshState);

type BootstrapView =
  | { identity: string; phase: 'loading' }
  | { identity: string; phase: 'ready'; result: SaveBootstrapResult }
  | {
    identity: string;
    phase: 'blocked';
    request: number;
    decision: Exclude<SaveRecoveryDecision, ReadyDecision | { kind: 'empty' }>;
    mirrorMetadataRaw: string | null;
  }
  | { identity: string; phase: 'error' };

export interface SaveBootstrapProps {
  profileId: string;
  storageKey: string;
  dependencies?: SaveBootstrapDependencies;
  children: (result: SaveBootstrapResult) => ReactNode;
}

/**
 * Resolves all durable save candidates before rendering the GameProvider.
 * The request token and repository close guard make profile changes and
 * unmounts safe even when IndexedDB or arbitration completes later.
 */
export const SaveBootstrap: React.FC<SaveBootstrapProps> = ({
  profileId,
  storageKey,
  dependencies = defaultSaveBootstrapDependencies,
  children,
}) => {
  const identity = `${profileId}\u0000${storageKey}`;
  const requestRef = useRef(0);
  const [view, setView] = useState<BootstrapView>({ identity, phase: 'loading' });
  const activeView = view.identity === identity ? view : { identity, phase: 'loading' as const };

  useEffect(() => {
    const request = ++requestRef.current;
    let cancelled = false;
    let repository: RecoveryRepository | null = null;
    let closed = false;
    const closeRepository = () => {
      if (closed || repository === null) return;
      closed = true;
      try {
        repository.close();
      } catch {
        // Closing an already-aborted IDB connection is harmless for startup.
      }
    };
    const isCurrent = () => !cancelled && requestRef.current === request;

    setView({ identity, phase: 'loading' });

    const load = async () => {
      try {
        const defaults = dependencies.createFreshState();
        const input: Omit<SaveRecoveryInput, 'head' | 'checkpoints'> = {
          profileId,
          pendingRaw: dependencies.readPending(storageKey),
          primaryRaw: dependencies.readPrimary(storageKey),
          mirrorMetadataRaw: dependencies.readMirrorMetadata(storageKey),
          defaults,
        };

        repository = await dependencies.openRepository(profileId);
        if (!isCurrent()) {
          closeRepository();
          return;
        }
        const [head, checkpoints] = await Promise.all([
          repository.getHead(profileId),
          repository.listCheckpoints(profileId),
        ]);
        const decision = await dependencies.resolveSaveRecovery({
          ...input,
          head,
          checkpoints,
        });
        const result = decisionResult(decision, dependencies.createFreshState);
        closeRepository();
        if (!isCurrent()) return;
        if (result !== null) {
          setView({ identity, phase: 'ready', result });
        } else if (decision.kind === 'recovery_required' || decision.kind === 'unsupported') {
          setView({
            identity,
            phase: 'blocked',
            request,
            decision,
            mirrorMetadataRaw: input.mirrorMetadataRaw,
          });
        }
      } catch {
        closeRepository();
        if (!isCurrent()) return;
        setView({ identity, phase: 'error' });
      } finally {
        closeRepository();
      }
    };

    void load();
    return () => {
      cancelled = true;
      requestRef.current += 1;
      closeRepository();
    };
  }, [dependencies, identity, profileId, storageKey]);

  if (activeView.phase === 'loading') {
    return <div role="status">Checking saved progress…</div>;
  }
  if (activeView.phase === 'blocked') {
    const isCurrentRequest = () => requestRef.current === activeView.request;
    const archiveCorruptEvidence = dependencies.archiveCorruptEvidence ?? productionArchiveCorruptEvidence;
    const replaceSave = dependencies.replaceSave ?? productionReplaceSave;
    const exportRecovery = dependencies.exportRecovery ?? productionExportRecovery;
    return (
      <SaveRecoveryScreen
        decision={activeView.decision}
        archiveCorruptEvidence={async () => {
          if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
          const result = await archiveCorruptEvidence(
            storageKey,
            {
              primary: activeView.decision.kind === 'recovery_required'
                ? activeView.decision.primaryRaw
                : null,
              mirrorMetadata: activeView.mirrorMetadataRaw,
            },
          );
          return isCurrentRequest()
            ? result
            : { ok: false, message: 'This profile is no longer active.' };
        }}
        onExportRecovery={() => exportRecovery(storageKey, activeView.decision)}
        onRecover={async (candidate: ValidatedRecoveryCandidate) => {
          if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
          const replacement: SaveBootstrapReplacement = {
            profileId,
            storageKey,
            data: candidate.data,
            state: candidate.state,
            persistenceRevision: candidate.persistenceRevision,
            capturedAt: candidate.capturedAt,
            checksum: candidate.checksum,
          };
          const result = await replaceSave(replacement);
          if (result && 'ok' in result && result.ok === false) return result;
          if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
          setView({
            identity,
            phase: 'ready',
            result: {
              initialState: candidate.state,
              initialData: candidate.data,
              persistenceRevision: candidate.persistenceRevision,
              source: 'recovery',
              needsJournalImport: true,
            },
          });
          return { ok: true };
        }}
        onStartFresh={async () => {
          if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
          const state = dependencies.createFreshState();
          const data = JSON.stringify(state);
          const result = await replaceSave({
            profileId,
            storageKey,
            data,
            state,
            persistenceRevision: 0,
            capturedAt: null,
            checksum: null,
          });
          if (result && 'ok' in result && result.ok === false) return result;
          if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
          setView({
            identity,
            phase: 'ready',
            result: {
              initialState: state,
              initialData: data,
              persistenceRevision: 0,
              source: 'empty',
              needsJournalImport: false,
            },
          });
          return { ok: true };
        }}
      />
    );
  }
  if (activeView.phase === 'error') {
    return (
      <div role="status" aria-live="polite">
        <p>Unable to check saved progress.</p>
        <p>The game remains closed until saved progress can be checked.</p>
      </div>
    );
  }
  return <>{children(activeView.result)}</>;
};
