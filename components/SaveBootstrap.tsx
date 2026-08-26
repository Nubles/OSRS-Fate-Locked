import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameState } from '../types';
import { createFreshState } from '../context/GameContext';
import {
  useProfileWriterLease,
  type ProfileWriterLeaseOptions,
} from '../hooks/useProfileWriterLease';
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
  RecoveryCheckpoint,
  RecoveryHead,
  RecoveryRepository,
} from '../utils/recoveryTypes';
import type { SaveWriteAuthorization } from '../utils/profileWriterLease';
import { checksumSave } from '../utils/saveIntegrity';
import {
  resolveSaveRecovery,
  type SaveRecoveryDecision,
  type SaveRecoveryInput,
  type ValidatedRecoveryCandidate,
} from '../utils/saveRecovery';
import { MAX_SAVE_BYTES } from '../utils/saveSchema';
import {
  SaveRecoveryScreen,
  type RecoveryActionResult,
} from './SaveRecoveryScreen';

export interface SaveBootstrapResult {
  initialState: GameState;
  initialData: string | null;
  persistenceRevision: number;
  /** Highest verified durable journal/mirror/checkpoint revision at startup. */
  maxDurablePersistenceRevision: number;
  source: 'empty' | 'pending' | 'mirror' | 'journal' | 'recovery';
  needsJournalImport: boolean;
}

export interface SaveBootstrapReplacement {
  profileId: string;
  storageKey: string;
  data: string;
  state: GameState;
  persistenceRevision: number;
  /** Highest verified durable revision observed during startup arbitration. */
  maxDurablePersistenceRevision?: number;
  capturedAt: number | null;
  checksum: string | null;
}

export interface SaveBootstrapDependencies {
  leaseOptions?: ProfileWriterLeaseOptions;
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
    authorizeWrite?: () => SaveWriteAuthorization,
  ) => RecoveryActionResult | Promise<RecoveryActionResult>;
  replaceSave?: (
    replacement: SaveBootstrapReplacement,
    authorizeWrite?: () => SaveWriteAuthorization,
  ) => RecoveryActionResult | Promise<RecoveryActionResult>;
  resetRecovery?: (
    replacement: SaveBootstrapReplacement,
    authorizeWrite?: () => SaveWriteAuthorization,
  ) => RecoveryActionResult | Promise<RecoveryActionResult>;
  exportRecovery?: (
    storageKey: string,
    decision: Exclude<SaveRecoveryDecision, ReadyDecision | { kind: 'empty' }>,
    options?: RecoveryExportOptions,
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

const writeAuthorizationFailure = (
  authorization: SaveWriteAuthorization,
): RecoveryActionResult => ({
  ok: false,
  message: ('reason' in authorization && authorization.reason === 'ownership_conflict')
    ? 'The recovery action stopped because writer ownership changed.'
    : 'The recovery action stopped because save storage is unavailable.',
});

const checkWriteAuthorization = (
  authorizeWrite?: () => SaveWriteAuthorization,
): RecoveryActionResult | null => {
  if (authorizeWrite === undefined) return null;
  const authorization = authorizeWrite();
  if (authorization.ok) return null;
  return writeAuthorizationFailure(authorization);
};

const writeStorageVerified = (
  key: string,
  data: string,
  authorizeWrite?: () => SaveWriteAuthorization,
): RecoveryActionResult => {
  const beforeWrite = checkWriteAuthorization(authorizeWrite);
  if (beforeWrite !== null) return beforeWrite;
  try {
    window.localStorage.setItem(key, data);
    const afterWrite = checkWriteAuthorization(authorizeWrite);
    if (afterWrite !== null) return afterWrite;
    return window.localStorage.getItem(key) === data
      ? { ok: true }
      : { ok: false, message: 'The replacement save could not be written.' };
  } catch {
    return { ok: false, message: 'The replacement save could not be written.' };
  }
};

const productionArchiveCorruptEvidence = async (
  storageKey: string,
  evidence: CorruptSaveEvidence,
  authorizeWrite?: () => SaveWriteAuthorization,
): Promise<RecoveryActionResult> => {
  if (authorizeWrite === undefined) {
    return { ok: false, message: 'Recovery writer ownership could not be verified.' };
  }
  return archiveCorruptSave(
    window.localStorage,
    storageKey,
    evidence,
    { authorizeWrite },
  );
};

const productionReplaceSave = async (
  replacement: SaveBootstrapReplacement,
  authorizeWrite?: () => SaveWriteAuthorization,
): Promise<RecoveryActionResult> => {
  if (authorizeWrite === undefined) {
    return { ok: false, message: 'Recovery writer ownership could not be verified.' };
  }
  try {
    const checksum = replacement.checksum ?? await checksumSave(replacement.data);
    const afterChecksum = checkWriteAuthorization(authorizeWrite);
    if (afterChecksum !== null) return afterChecksum;
    const written = writeStorageVerified(replacement.storageKey, replacement.data, authorizeWrite);
    if (written && 'ok' in written && written.ok === false) return written;
    const metadata = JSON.stringify({
      version: 1,
      persistenceRevision: replacement.persistenceRevision,
      capturedAt: replacement.capturedAt ?? Date.now(),
      checksum,
    });
    const metadataKey = profileMirrorMetadataKey(replacement.storageKey);
    const beforeMetadata = checkWriteAuthorization(authorizeWrite);
    if (beforeMetadata !== null) return beforeMetadata;
    window.localStorage.setItem(metadataKey, metadata);
    const afterMetadata = checkWriteAuthorization(authorizeWrite);
    if (afterMetadata !== null) return afterMetadata;
    if (window.localStorage.getItem(metadataKey) !== metadata) {
      return { ok: false, message: 'The replacement save metadata could not be verified.' };
    }
  } catch {
    return { ok: false, message: 'The replacement save metadata could not be verified.' };
  }
  return { ok: true };
};

const recoveryJournalFailure = (result: { stored: false; reason: string }): RecoveryActionResult => ({
  ok: false,
  message: result.reason === 'ownership_conflict'
    ? 'The recovery journal could not be reset because writer ownership changed.'
    : 'The recovery journal could not be reset.',
});

const nextJournalRevision = (
  head: RecoveryHead | null,
  checkpoints: readonly RecoveryCheckpoint[],
  maxDurablePersistenceRevision?: number,
): number => {
  let highest = head?.persistenceRevision ?? -1;
  for (const checkpoint of checkpoints) {
    if (checkpoint.persistenceRevision > highest) highest = checkpoint.persistenceRevision;
  }
  if (Number.isSafeInteger(maxDurablePersistenceRevision)
    && maxDurablePersistenceRevision >= 0
    && maxDurablePersistenceRevision > highest) {
    highest = maxDurablePersistenceRevision;
  }
  return highest + 1;
};

export interface RecoveryResetOptions {
  openRepository?: () => RecoveryRepository | PromiseLike<RecoveryRepository>;
  now?: () => number;
}

export interface RecoveryCommitOptions extends RecoveryResetOptions {
  replaceSave?: (
    replacement: SaveBootstrapReplacement,
    authorizeWrite?: () => SaveWriteAuthorization,
  ) => RecoveryActionResult | Promise<RecoveryActionResult>;
  isCurrentRequest?: () => boolean;
}

export const productionRecoverSave = async (
  replacement: SaveBootstrapReplacement,
  authorizeWrite?: () => SaveWriteAuthorization,
  options: RecoveryCommitOptions = {},
): Promise<RecoveryActionResult> => {
  if (authorizeWrite === undefined) {
    return { ok: false, message: 'Recovery writer ownership could not be verified.' };
  }
  const isCurrentRequest = options.isCurrentRequest ?? (() => true);
  const staleRequest = (): RecoveryActionResult => ({
    ok: false,
    message: 'This profile is no longer active.',
  });
  let repository: RecoveryRepository | null = null;
  try {
    if (!isCurrentRequest()) return staleRequest();
    const beforeOpen = checkWriteAuthorization(authorizeWrite);
    if (beforeOpen !== null) return beforeOpen;
    repository = await (options.openRepository?.() ?? openProductionRepository());
    if (!isCurrentRequest()) return staleRequest();
    const afterOpen = checkWriteAuthorization(authorizeWrite);
    if (afterOpen !== null) return afterOpen;
    const [head, checkpoints] = await Promise.all([
      repository.getHead(replacement.profileId),
      repository.listCheckpoints(replacement.profileId),
    ]);
    if (!isCurrentRequest()) return staleRequest();
    const afterRead = checkWriteAuthorization(authorizeWrite);
    if (afterRead !== null) return afterRead;
    const checksum = replacement.checksum ?? await checksumSave(replacement.data);
    if (!isCurrentRequest()) return staleRequest();
    const afterChecksum = checkWriteAuthorization(authorizeWrite);
    if (afterChecksum !== null) return afterChecksum;
    const capturedAt = replacement.capturedAt ?? options.now?.() ?? Date.now();
    const persistenceRevision = nextJournalRevision(
      head,
      checkpoints,
      replacement.maxDurablePersistenceRevision,
    );
    const recoveredHead: RecoveryHead = {
      profileId: replacement.profileId,
      persistenceRevision,
      runId: replacement.state.runId,
      runRevision: replacement.state.runRevision,
      capturedAt,
      checksum,
      data: replacement.data,
    };
    const headResult = await repository.putHead(recoveredHead, authorizeWrite);
    if (headResult.stored === false) return recoveryJournalFailure(headResult);
    if (!isCurrentRequest()) return staleRequest();
    const afterHead = checkWriteAuthorization(authorizeWrite);
    if (afterHead !== null) return afterHead;
    const mirrorResult = await (options.replaceSave ?? productionReplaceSave)(
      {
        ...replacement,
        persistenceRevision,
        capturedAt,
        checksum,
      },
      authorizeWrite,
    );
    if (mirrorResult && 'ok' in mirrorResult && mirrorResult.ok === false) return mirrorResult;
    if (!isCurrentRequest()) return staleRequest();
    const afterMirror = checkWriteAuthorization(authorizeWrite);
    if (afterMirror !== null) return afterMirror;
    return { ok: true, persistenceRevision };
  } catch {
    return { ok: false, message: 'The recovered save could not be committed.' };
  } finally {
    try {
      repository?.close();
    } catch {
      // Closing an already-aborted recovery connection is harmless at startup.
    }
  }
};

export const productionResetRecovery = async (
  replacement: SaveBootstrapReplacement,
  authorizeWrite?: () => SaveWriteAuthorization,
  options: RecoveryResetOptions = {},
): Promise<RecoveryActionResult> => {
  if (authorizeWrite === undefined) {
    return { ok: false, message: 'Recovery writer ownership could not be verified.' };
  }
  let repository: RecoveryRepository | null = null;
  try {
    const beforeOpen = checkWriteAuthorization(authorizeWrite);
    if (beforeOpen !== null) return beforeOpen;
    repository = await (options.openRepository?.() ?? openProductionRepository());
    if (repository === unavailableRecoveryRepository) return { ok: true };
    const afterOpen = checkWriteAuthorization(authorizeWrite);
    if (afterOpen !== null) return afterOpen;
    const [head, checkpoints] = await Promise.all([
      repository.getHead(replacement.profileId),
      repository.listCheckpoints(replacement.profileId),
    ]);
    const afterRead = checkWriteAuthorization(authorizeWrite);
    if (afterRead !== null) return afterRead;
    const checksum = replacement.checksum ?? await checksumSave(replacement.data);
    const afterChecksum = checkWriteAuthorization(authorizeWrite);
    if (afterChecksum !== null) return afterChecksum;
    const freshHead: RecoveryHead = {
      profileId: replacement.profileId,
      persistenceRevision: nextJournalRevision(
        head,
        checkpoints,
        replacement.maxDurablePersistenceRevision,
      ),
      runId: replacement.state.runId,
      runRevision: replacement.state.runRevision,
      capturedAt: replacement.capturedAt ?? options.now?.() ?? Date.now(),
      checksum,
      data: replacement.data,
    };
    const headResult = await repository.putHead(freshHead, authorizeWrite);
    if (headResult.stored === false) return recoveryJournalFailure(headResult);
    const afterHead = checkWriteAuthorization(authorizeWrite);
    if (afterHead !== null) return afterHead;
    const revisions = checkpoints.map(checkpoint => checkpoint.persistenceRevision);
    if (revisions.length > 0) {
      const deleteResult = await repository.deleteCheckpoints(
        replacement.profileId,
        revisions,
        authorizeWrite,
      );
      if (deleteResult.stored === false) return recoveryJournalFailure(deleteResult);
      const afterDelete = checkWriteAuthorization(authorizeWrite);
      if (afterDelete !== null) return afterDelete;
    }
    return {
      ok: true,
      persistenceRevision: freshHead.persistenceRevision,
    };
  } catch {
    return { ok: false, message: 'The recovery journal could not be reset.' };
  } finally {
    try {
      repository?.close();
    } catch {
      // Closing an already-aborted recovery connection is harmless at startup.
    }
  }
};

export interface RecoveryExportOptions {
  isCurrentRequest?: () => boolean;
  buildArchive?: typeof buildCorruptSaveArchive;
  now?: () => number;
  document?: Document;
  url?: typeof URL;
  blob?: typeof Blob;
}

type RecoveryExportPayload = {
  version: 1;
  capturedAt: number;
  evidence: Awaited<ReturnType<typeof buildCorruptSaveArchive>>;
  candidates: unknown[];
  rawCandidates: unknown[];
  truncated?: true;
};

const exportValueMaxBytes = Math.max(0, Math.floor((MAX_SAVE_BYTES - 4096) / 2));

const exportByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const boundedExportCandidate = async (
  data: string,
  buildArchive: typeof buildCorruptSaveArchive,
): Promise<{ data: string | null; hash?: string; bytes?: number }> => {
  const archive = await buildArchive(
    { primary: data, mirrorMetadata: null },
    { maxBytes: exportValueMaxBytes },
  );
  return {
    data: archive.primary,
    ...(archive.primaryHash ? { hash: archive.primaryHash, bytes: archive.primaryBytes } : {}),
  };
};

const addExportItem = (
  payload: RecoveryExportPayload,
  field: 'candidates' | 'rawCandidates',
  item: unknown,
): RecoveryExportPayload => {
  const next = {
    ...payload,
    [field]: [...payload[field], item],
  } as RecoveryExportPayload;
  if (exportByteLength(JSON.stringify(next)) <= MAX_SAVE_BYTES) return next;
  return { ...payload, truncated: true };
};

export const productionExportRecovery = async (
  storageKey: string,
  decision: Exclude<SaveRecoveryDecision, ReadyDecision | { kind: 'empty' }>,
  options: RecoveryExportOptions = {},
): Promise<RecoveryActionResult> => {
  const documentRef = options.document ?? (typeof document === 'undefined' ? undefined : document);
  const urlRef = options.url ?? (typeof URL === 'undefined' ? undefined : URL);
  const blobRef = options.blob ?? (typeof Blob === 'undefined' ? undefined : Blob);
  const isCurrentRequest = options.isCurrentRequest ?? (() => true);
  if (documentRef === undefined || urlRef === undefined || blobRef === undefined) {
    return { ok: false, message: 'Recovery export is unavailable in this browser.' };
  }
  try {
    if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
    const buildArchive = options.buildArchive ?? buildCorruptSaveArchive;
    const primary = decision.kind === 'recovery_required' ? decision.primaryRaw : null;
    let mirrorMetadata: string | null = null;
    try {
      mirrorMetadata = readStorage(profileMirrorMetadataKey(storageKey));
    } catch {
      // Export still retains the decision evidence when mirror storage is unavailable.
    }
    const bounded = await buildArchive(
      { primary, mirrorMetadata },
      { maxBytes: exportValueMaxBytes },
    );
    const candidates = decision.kind === 'recovery_required'
      ? await Promise.all(decision.candidates.map(async candidate => {
        const boundedCandidate = await boundedExportCandidate(candidate.data, buildArchive);
        return {
          source: candidate.source,
          persistenceRevision: candidate.persistenceRevision,
          capturedAt: candidate.capturedAt,
          runId: candidate.runId,
          runRevision: candidate.runRevision,
          data: boundedCandidate.data,
          ...(boundedCandidate.hash
            ? { dataHash: boundedCandidate.hash, dataBytes: boundedCandidate.bytes }
            : {}),
        };
      }))
      : [];
    const rawCandidates = decision.kind === 'unsupported'
      ? await Promise.all(decision.rawCandidates.map(async rawCandidate => {
        const boundedCandidate = await boundedExportCandidate(rawCandidate, buildArchive);
        return boundedCandidate.data ?? {
          hash: boundedCandidate.hash,
          bytes: boundedCandidate.bytes,
        };
      }))
      : [];
    if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
    let payload: RecoveryExportPayload = {
      version: 1,
      capturedAt: options.now?.() ?? Date.now(),
      evidence: bounded,
      candidates: [],
      rawCandidates: [],
    };
    for (const candidate of candidates) payload = addExportItem(payload, 'candidates', candidate);
    for (const rawCandidate of rawCandidates) payload = addExportItem(payload, 'rawCandidates', rawCandidate);
    let serialized = JSON.stringify(payload);
    if (exportByteLength(serialized) > MAX_SAVE_BYTES) {
      payload = {
        version: 1,
        capturedAt: payload.capturedAt,
        evidence: {
          version: 1,
          capturedAt: payload.evidence.capturedAt,
          primary: null,
          mirrorMetadata: null,
        },
        candidates: [],
        rawCandidates: [],
        truncated: true,
      };
      serialized = JSON.stringify(payload);
    }
    if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
    const url = urlRef.createObjectURL(new blobRef([serialized], { type: 'application/json' }));
    const anchor = documentRef.createElement('a');
    anchor.href = url;
    anchor.download = `fate_locked_recovery_${payload.capturedAt}.json`;
    if (!isCurrentRequest()) {
      urlRef.revokeObjectURL(url);
      return { ok: false, message: 'This profile is no longer active.' };
    }
    anchor.click();
    urlRef.revokeObjectURL(url);
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
  resetRecovery: productionResetRecovery,
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
      maxDurablePersistenceRevision: decision.maxDurablePersistenceRevision,
      source: 'empty',
      needsJournalImport: false,
    };
  }
  if (decision.kind !== 'ready') return null;
  return {
    initialState: decision.state,
    initialData: decision.data,
    persistenceRevision: decision.persistenceRevision,
    maxDurablePersistenceRevision: decision.maxDurablePersistenceRevision,
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

const SaveRecoveryLeaseGate: React.FC<{
  storageKey: string;
  leaseOptions?: ProfileWriterLeaseOptions;
  children: (
    authorizeWrite: () => SaveWriteAuthorization,
    recoveryActionsEnabled: boolean,
    recoveryStatusMessage: string | null,
  ) => ReactNode;
}> = ({ storageKey, leaseOptions, children }) => {
  const lease = useProfileWriterLease(storageKey, leaseOptions);
  useEffect(() => () => {
    lease.release();
  }, [lease.release]);
  const recoveryActionsEnabled = lease.status === 'owner';
  const recoveryStatusMessage = recoveryActionsEnabled
    ? null
    : lease.status === 'blocked'
      ? 'Another browser tab owns this save. Recovery changes are disabled; export remains available.'
      : 'Checking save write ownership. Recovery changes are disabled until ownership is confirmed; export remains available.';
  return <>{children(lease.authorizeWrite, recoveryActionsEnabled, recoveryStatusMessage)}</>;
};

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
    const resetRecovery = dependencies.resetRecovery;
    const exportRecovery = dependencies.exportRecovery ?? productionExportRecovery;
    const maxDurablePersistenceRevision = activeView.decision.kind === 'recovery_required'
      ? activeView.decision.maxDurablePersistenceRevision
      : 0;
    return (
      <SaveRecoveryLeaseGate storageKey={storageKey} leaseOptions={dependencies.leaseOptions}>
        {(authorizeWrite, recoveryActionsEnabled, recoveryStatusMessage) => (
          <SaveRecoveryScreen
            decision={activeView.decision}
            authorizeWrite={authorizeWrite}
            recoveryActionsEnabled={recoveryActionsEnabled}
            recoveryStatusMessage={recoveryStatusMessage}
            archiveCorruptEvidence={async () => {
              if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
              const beforeArchive = checkWriteAuthorization(authorizeWrite);
              if (beforeArchive !== null) return beforeArchive;
              const result = await archiveCorruptEvidence(
                storageKey,
                {
                  primary: activeView.decision.kind === 'recovery_required'
                    ? activeView.decision.primaryRaw
                    : null,
                  mirrorMetadata: activeView.mirrorMetadataRaw,
                },
                authorizeWrite,
              );
              if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
              const afterArchive = checkWriteAuthorization(authorizeWrite);
              return afterArchive ?? result;
            }}
            onExportRecovery={async () => {
              if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
              const result = await exportRecovery(storageKey, activeView.decision, { isCurrentRequest });
              return isCurrentRequest()
                ? result
                : { ok: false, message: 'This profile is no longer active.' };
            }}
            onRecover={async (candidate: ValidatedRecoveryCandidate) => {
              if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
              const replacement: SaveBootstrapReplacement = {
                profileId,
                storageKey,
                data: candidate.data,
                state: candidate.state,
                persistenceRevision: candidate.persistenceRevision,
                maxDurablePersistenceRevision,
                capturedAt: candidate.capturedAt,
                checksum: candidate.checksum,
              };
              const beforeReplace = checkWriteAuthorization(authorizeWrite);
              if (beforeReplace !== null) return beforeReplace;
              const result = await productionRecoverSave(replacement, authorizeWrite, {
                openRepository: () => dependencies.openRepository(profileId),
                replaceSave,
                isCurrentRequest,
              });
              if (result && 'ok' in result && result.ok === false) return result;
              if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
              const afterReplace = checkWriteAuthorization(authorizeWrite);
              if (afterReplace !== null) return afterReplace;
              const persistenceRevision = result && 'ok' in result && result.ok === true
                ? result.persistenceRevision ?? candidate.persistenceRevision
                : candidate.persistenceRevision;
              setView({
                identity,
                phase: 'ready',
                result: {
                  initialState: candidate.state,
                  initialData: candidate.data,
                  persistenceRevision,
                  maxDurablePersistenceRevision: Math.max(
                    maxDurablePersistenceRevision,
                    persistenceRevision,
                  ),
                  source: 'recovery',
                  needsJournalImport: false,
                },
              });
              return { ok: true };
            }}
            onStartFresh={async () => {
              if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
              const state = dependencies.createFreshState();
              const data = JSON.stringify(state);
              const replacement: SaveBootstrapReplacement = {
                profileId,
                storageKey,
                data,
                state,
                persistenceRevision: 0,
                maxDurablePersistenceRevision,
                capturedAt: null,
                checksum: null,
              };
              let replacementToWrite = replacement;
              let postResetPersistenceRevision: number | undefined;
              const beforeReset = checkWriteAuthorization(authorizeWrite);
              if (beforeReset !== null) return beforeReset;
              if (resetRecovery !== undefined) {
                const reset = await resetRecovery(replacement, authorizeWrite);
                if (reset && 'ok' in reset && reset.ok === false) return reset;
                if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
                const afterReset = checkWriteAuthorization(authorizeWrite);
                if (afterReset !== null) return afterReset;
                if (reset && 'ok' in reset && reset.ok === true
                  && reset.persistenceRevision !== undefined) {
                  postResetPersistenceRevision = reset.persistenceRevision;
                  replacementToWrite = {
                    ...replacement,
                    persistenceRevision: postResetPersistenceRevision,
                  };
                }
              }
              const result = await replaceSave(replacementToWrite, authorizeWrite);
              if (result && 'ok' in result && result.ok === false) return result;
              if (!isCurrentRequest()) return { ok: false, message: 'This profile is no longer active.' };
              const afterReplace = checkWriteAuthorization(authorizeWrite);
              if (afterReplace !== null) return afterReplace;
              setView({
                identity,
                phase: 'ready',
                result: {
                  initialState: state,
                  initialData: data,
                  persistenceRevision: 0,
                  maxDurablePersistenceRevision: postResetPersistenceRevision
                    ?? maxDurablePersistenceRevision,
                  source: 'empty',
                  needsJournalImport: false,
                },
              });
              return { ok: true };
            }}
          />
        )}
      </SaveRecoveryLeaseGate>
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
