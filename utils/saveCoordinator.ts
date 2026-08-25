import type { GameState } from '../types';
import type { BackupWriteResult } from './gamePersistence';
import type { SaveStorage } from './pendingSaves';
import type {
  MirrorMetadata,
  RecoveryCheckpoint,
  RecoveryCheckpointReason,
  RecoveryHead,
  RecoveryRepository,
  RecoveryWriteResult,
  SaveDurabilitySnapshot,
} from './recoveryTypes';
import type { SaveValidationResult } from './saveSchema';
import type { SaveWriteAuthorization } from './profileWriterLease';
import {
  isQuotaExceededError,
  profileMirrorMetadataKey,
  removeDisposableCaches,
} from './storageRecovery';

const MAX_SAFE_REVISION = Number.MAX_SAFE_INTEGER;

const nextRevision = (revision: number): number => (
  revision >= MAX_SAFE_REVISION ? revision : revision + 1
);

const isWriteFailure = (
  authorization: SaveWriteAuthorization,
): authorization is { ok: false; reason: 'ownership_conflict' | 'storage_unavailable' } => (
  authorization.ok === false
);

const unavailableWrite = (): RecoveryWriteResult => ({
  stored: false,
  reason: 'storage_unavailable',
});

const writeResult = (value: unknown): RecoveryWriteResult => {
  if (typeof value === 'object' && value !== null && 'stored' in value) {
    const result = value as RecoveryWriteResult;
    if (result.stored === true) return { stored: true };
    if (
      result.stored === false
      && 'reason' in result
      && (
        result.reason === 'ownership_conflict'
        || result.reason === 'storage_unavailable'
        || result.reason === 'quota'
        || result.reason === 'stale_revision'
      )
    ) return result;
  }
  return unavailableWrite();
};

const saveAuthorizationResult = (
  authorization: SaveWriteAuthorization,
): RecoveryWriteResult => isWriteFailure(authorization)
  ? { stored: false, reason: authorization.reason }
  : { stored: true };

const checkpointFailure = (result: RecoveryWriteResult): BackupWriteResult => ({
  stored: false,
  reason: result.stored === false && result.reason === 'ownership_conflict'
    ? 'ownership_conflict'
    : 'storage_unavailable',
});

const isValidationSuccess = (
  result: SaveValidationResult,
): result is Extract<SaveValidationResult, { ok: true }> => result.ok;

const stateRunId = (state: GameState): string => {
  const value = (state as unknown as { runId?: unknown }).runId;
  return typeof value === 'string' ? value : '';
};

const stateRunRevision = (state: GameState): number => {
  const value = (state as unknown as { runRevision?: unknown }).runRevision;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

type StorageWriteResult = {
  verified: boolean;
  quotaRetried: boolean;
};

/**
 * Write one exact string to storage and only report success after a byte-for-
 * byte readback. Quota recovery deliberately removes only the disposable
 * caches enumerated by storageRecovery.ts and retries this one write once.
 */
const writeAndVerify = (
  storage: SaveStorage,
  key: string,
  data: string,
): StorageWriteResult => {
  const attempt = (): boolean => {
    storage.setItem(key, data);
    return storage.getItem(key) === data;
  };

  try {
    return { verified: attempt(), quotaRetried: false };
  } catch (error) {
    if (!isQuotaExceededError(error) || storage.removeItem === undefined) {
      return { verified: false, quotaRetried: false };
    }
    removeDisposableCaches(storage as Pick<Storage, 'removeItem'>);
    try {
      return { verified: attempt(), quotaRetried: true };
    } catch {
      return { verified: false, quotaRetried: true };
    }
  }
};

type StagedSnapshot = {
  data: string;
  token: number;
};

type FlushOutcome = {
  journal: RecoveryWriteResult;
  primaryVerified: boolean;
  mirrorMetadataVerified: boolean;
  stale?: boolean;
};

type PreparedFlush =
  | { ok: true; validation: Extract<SaveValidationResult, { ok: true }>; checksum: string }
  | { ok: false; result: RecoveryWriteResult };

type ValidationHashTask = {
  promise: Promise<PreparedFlush>;
  settledBeforeYield: () => boolean;
};

export interface SaveCoordinator {
  stage(data: string): void;
  flush(): Promise<SaveDurabilitySnapshot>;
  retry(): Promise<SaveDurabilitySnapshot>;
  mirrorLifecycle(data: string): boolean;
  writeReplacement(data: string, reason: string): Promise<SaveDurabilitySnapshot>;
  createCheckpoint(data: string, reason: RecoveryCheckpointReason): Promise<BackupWriteResult>;
  getSnapshot(): SaveDurabilitySnapshot;
  subscribe(listener: () => void): () => void;
  whenIdle(): Promise<void>;
  dispose(): void;
}

export interface SaveCoordinatorOptions {
  profileId: string;
  storageKey: string;
  storage: SaveStorage;
  repository: RecoveryRepository;
  authorizeWrite: () => SaveWriteAuthorization;
  validate: (data: string) => SaveValidationResult;
  checksum: (data: string) => Promise<string>;
  now: () => number;
  initialPersistenceRevision: number;
}

const initialRevision = (value: number): number => (
  Number.isSafeInteger(value) && value >= 0 ? value : 0
);

export const createSaveCoordinator = (
  options: SaveCoordinatorOptions,
): SaveCoordinator => {
  let revision = initialRevision(options.initialPersistenceRevision);
  let pending: StagedSnapshot | null = null;
  let lastAttemptData: string | null = null;
  let changeToken = 0;
  let inFlight: Promise<SaveDurabilitySnapshot> | null = null;
  let disposed = false;
  let snapshot: SaveDurabilitySnapshot = {
    primary: 'saved',
    recovery: 'checking',
    savedAt: null,
  };
  const listeners = new Set<() => void>();
  const idleWaiters = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // A subscriber cannot be allowed to break a durability operation.
      }
    }
  };

  const setSnapshot = (next: SaveDurabilitySnapshot): void => {
    if (
      snapshot.primary === next.primary
      && snapshot.recovery === next.recovery
      && snapshot.savedAt === next.savedAt
    ) return;
    snapshot = next;
    notify();
  };

  const isCurrent = (candidate: StagedSnapshot): boolean => (
    changeToken === candidate.token
    && pending?.token === candidate.token
  );

  const mirror = (
    data: string,
    persistenceRevision: number,
    capturedAt: number,
    checksum: string,
    candidate: StagedSnapshot | null,
  ): { primaryVerified: boolean; mirrorMetadataVerified: boolean } => {
    if (candidate !== null && !isCurrent(candidate)) {
      return { primaryVerified: false, mirrorMetadataVerified: false };
    }

    const authorization = options.authorizeWrite();
    if (isWriteFailure(authorization)) {
      return { primaryVerified: false, mirrorMetadataVerified: false };
    }

    const primary = writeAndVerify(options.storage, options.storageKey, data);
    if (!primary.verified) {
      return { primaryVerified: false, mirrorMetadataVerified: false };
    }

    if (candidate !== null && !isCurrent(candidate)) {
      return { primaryVerified: true, mirrorMetadataVerified: false };
    }

    const metadataAuthorization = options.authorizeWrite();
    if (isWriteFailure(metadataAuthorization)) {
      return { primaryVerified: true, mirrorMetadataVerified: false };
    }

    const metadata: MirrorMetadata = {
      version: 1,
      persistenceRevision,
      capturedAt,
      checksum,
    };
    const metadataWrite = writeAndVerify(
      options.storage,
      profileMirrorMetadataKey(options.storageKey),
      JSON.stringify(metadata),
    );
    return {
      primaryVerified: true,
      mirrorMetadataVerified: metadataWrite.verified,
    };
  };

  const beginValidateAndHash = (data: string): ValidationHashTask => {
    let validation: SaveValidationResult;
    try {
      validation = options.validate(data);
    } catch {
      return {
        promise: Promise.resolve({ ok: false, result: unavailableWrite() }),
        settledBeforeYield: () => true,
      };
    }
    if (!isValidationSuccess(validation)) {
      return {
        promise: Promise.resolve({ ok: false, result: unavailableWrite() }),
        settledBeforeYield: () => true,
      };
    }

    let checksumPromise: Promise<string>;
    try {
      checksumPromise = options.checksum(data);
    } catch {
      return {
        promise: Promise.resolve({ ok: false, result: unavailableWrite() }),
        settledBeforeYield: () => true,
      };
    }

    let settled = false;
    const promise = checksumPromise
      .then(
        checksum => {
          settled = true;
          return { ok: true, validation, checksum } as const;
        },
        () => {
          settled = true;
          return { ok: false, result: unavailableWrite() } as const;
        },
      );
    return {
      promise,
      settledBeforeYield: () => settled,
    };
  };

  const runFlush = async (candidate: StagedSnapshot): Promise<FlushOutcome> => {
    const validationHash = beginValidateAndHash(candidate.data);
    // An immediately settled checksum permits a synchronous stage that lands
    // before this continuation to remain part of the current journal flight;
    // a genuinely deferred checksum must reject a superseded candidate after
    // it resolves.
    await Promise.resolve();
    const checksumWasImmediate = validationHash.settledBeforeYield();
    const prepared = await validationHash.promise;
    if (prepared.ok === false) {
      return {
        journal: prepared.result,
        primaryVerified: false,
        mirrorMetadataVerified: false,
      };
    }

    const checksumToken = changeToken;
    const unchangedSinceChecksum = (): boolean => (
      changeToken === checksumToken
      && (checksumWasImmediate || pending?.token === candidate.token)
    );

    // The checksum is an asynchronous boundary. If a newer snapshot arrived
    // while a genuinely deferred checksum was in flight, do not allocate a
    // revision or publish the old bytes to the journal. An immediately settled
    // checksum may be followed by a synchronous stage before the journal
    // transaction begins; that stage is coalesced behind this flight.
    if (
      !checksumWasImmediate
      && (checksumToken !== candidate.token || pending?.token !== candidate.token)
    ) {
      return {
        journal: unavailableWrite(),
        primaryVerified: false,
        mirrorMetadataVerified: false,
        stale: true,
      };
    }

    const authorization = options.authorizeWrite();
    if (isWriteFailure(authorization)) {
      return {
        journal: saveAuthorizationResult(authorization),
        primaryVerified: false,
        mirrorMetadataVerified: false,
      };
    }

    if (!unchangedSinceChecksum()) {
      return {
        journal: unavailableWrite(),
        primaryVerified: false,
        mirrorMetadataVerified: false,
        stale: true,
      };
    }

    const capturedAt = options.now();
    if (!unchangedSinceChecksum()) {
      return {
        journal: unavailableWrite(),
        primaryVerified: false,
        mirrorMetadataVerified: false,
        stale: true,
      };
    }

    const persistenceRevision = nextRevision(revision);
    revision = persistenceRevision;
    const record: RecoveryHead = {
      profileId: options.profileId,
      persistenceRevision,
      runId: stateRunId(prepared.validation.state),
      runRevision: stateRunRevision(prepared.validation.state),
      capturedAt,
      checksum: prepared.checksum,
      data: candidate.data,
    };

    if (!unchangedSinceChecksum()) {
      return {
        journal: unavailableWrite(),
        primaryVerified: false,
        mirrorMetadataVerified: false,
        stale: true,
      };
    }

    let journal: RecoveryWriteResult;
    try {
      journal = writeResult(await options.repository.putHead(record, options.authorizeWrite));
    } catch {
      journal = unavailableWrite();
    }

    const mirrored = mirror(
      candidate.data,
      persistenceRevision,
      capturedAt,
      prepared.checksum,
      candidate,
    );
    return {
      journal,
      primaryVerified: mirrored.primaryVerified,
      mirrorMetadataVerified: mirrored.mirrorMetadataVerified,
    };
  };

  const applyOutcome = (
    candidate: StagedSnapshot,
    outcome: FlushOutcome,
  ): void => {
    const primarySaved = outcome.journal.stored || outcome.primaryVerified;
    const recoveryProtected = (
      outcome.journal.stored
      && outcome.primaryVerified
      && outcome.mirrorMetadataVerified
    );
    const newerStateIsPending = pending !== null
      && (pending.token !== candidate.token || changeToken !== candidate.token);

    if (outcome.stale) {
      if (newerStateIsPending) {
        setSnapshot({
          primary: 'saving',
          recovery: 'checking',
          savedAt: snapshot.savedAt,
        });
      }
      return;
    }

    if (primarySaved) {
      if (newerStateIsPending) {
        setSnapshot({
          primary: 'saving',
          recovery: 'checking',
          savedAt: snapshot.savedAt,
        });
        return;
      }
      const savedAt = options.now();
      if (pending?.token === candidate.token) {
        pending = null;
      }
      setSnapshot({
        primary: 'saved',
        recovery: recoveryProtected ? 'protected' : 'degraded',
        savedAt,
      });
      return;
    }

    setSnapshot({
      primary: newerStateIsPending ? 'saving' : 'failed',
      recovery: 'degraded',
      savedAt: snapshot.savedAt,
    });
  };

  const settleIdle = (): void => {
    if (inFlight !== null) return;
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  };

  const startFlush = (): Promise<SaveDurabilitySnapshot> | null => {
    if (disposed || inFlight !== null || pending === null) {
      settleIdle();
      return inFlight;
    }

    const candidate = pending;
    let operation!: Promise<SaveDurabilitySnapshot>;
    operation = runFlush(candidate)
      .then(outcome => {
        applyOutcome(candidate, outcome);
        return { ...snapshot };
      })
      .catch(() => {
        applyOutcome(candidate, {
          journal: unavailableWrite(),
          primaryVerified: false,
          mirrorMetadataVerified: false,
        });
        return { ...snapshot };
      })
      .finally(() => {
        if (inFlight === operation) inFlight = null;
        const newerStateIsPending = pending !== null
          && (pending.token !== candidate.token || changeToken !== candidate.token);
        if (!disposed && newerStateIsPending) {
          startFlush();
        } else {
          settleIdle();
        }
      });
    inFlight = operation;
    return operation;
  };

  const stage = (data: string): void => {
    if (disposed) return;
    lastAttemptData = data;
    const token = ++changeToken;
    pending = { data, token };
    setSnapshot({
      primary: 'saving',
      recovery: 'checking',
      savedAt: snapshot.savedAt,
    });
  };

  const flush = (): Promise<SaveDurabilitySnapshot> => {
    if (disposed) return Promise.resolve({ ...snapshot });
    if (inFlight !== null) return inFlight;
    if (pending === null) return Promise.resolve({ ...snapshot });
    return startFlush() ?? Promise.resolve({ ...snapshot });
  };

  const retry = async (): Promise<SaveDurabilitySnapshot> => {
    if (disposed) return { ...snapshot };
    if (inFlight !== null) {
      await inFlight;
      await whenIdle();
      return { ...snapshot };
    }
    if (pending === null) {
      if (snapshot.recovery !== 'degraded' || lastAttemptData === null) {
        return { ...snapshot };
      }
      stage(lastAttemptData);
    }
    setSnapshot({
      primary: 'saving',
      recovery: 'checking',
      savedAt: snapshot.savedAt,
    });
    await flush();
    await whenIdle();
    return { ...snapshot };
  };

  const mirrorLifecycle = (data: string): boolean => {
    if (disposed) return false;
    lastAttemptData = data;
    const token = ++changeToken;
    // A lifecycle mirror is the newest synchronous snapshot. Keep it in the
    // same coalescing slot so an older journal completion can schedule exactly
    // one follow-up for these bytes rather than retrying the old candidate.
    pending = { data, token };
    const authorization = options.authorizeWrite();
    if (isWriteFailure(authorization)) {
      setSnapshot({ primary: 'failed', recovery: 'degraded', savedAt: snapshot.savedAt });
      return false;
    }
    const result = writeAndVerify(options.storage, options.storageKey, data);
    if (!result.verified) {
      setSnapshot({ primary: 'failed', recovery: 'degraded', savedAt: snapshot.savedAt });
      return false;
    }

    const savedAt = options.now();
    if (inFlight === null && pending?.data === data) pending = null;
    setSnapshot({
      primary: inFlight === null ? 'saved' : 'saving',
      recovery: inFlight === null ? 'degraded' : 'checking',
      savedAt,
    });
    return true;
  };

  const writeReplacement = async (
    data: string,
    _reason: string,
  ): Promise<SaveDurabilitySnapshot> => {
    stage(data);
    await flush();
    await whenIdle();
    return { ...snapshot };
  };

  const createCheckpoint = async (
    data: string,
    reason: RecoveryCheckpointReason,
  ): Promise<BackupWriteResult> => {
    if (disposed || data.length === 0) return { stored: false, reason: 'empty' };
    await whenIdle();

    const prepared = await beginValidateAndHash(data).promise;
    if (!prepared.ok) return { stored: false, reason: 'storage_unavailable' };
    const authorization = options.authorizeWrite();
    if (isWriteFailure(authorization)) return checkpointFailure(saveAuthorizationResult(authorization));

    const persistenceRevision = nextRevision(revision);
    revision = persistenceRevision;
    const record: RecoveryCheckpoint = {
      profileId: options.profileId,
      persistenceRevision,
      runId: stateRunId(prepared.validation.state),
      runRevision: stateRunRevision(prepared.validation.state),
      capturedAt: options.now(),
      checksum: prepared.checksum,
      data,
      reason,
    };
    let result: RecoveryWriteResult;
    try {
      result = writeResult(await options.repository.putCheckpoint(record, options.authorizeWrite));
    } catch {
      result = unavailableWrite();
    }
    return result.stored ? { stored: true } : checkpointFailure(result);
  };

  const getSnapshot = (): SaveDurabilitySnapshot => ({ ...snapshot });

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };

  const whenIdle = (): Promise<void> => {
    if (inFlight === null) return Promise.resolve();
    return new Promise(resolve => { idleWaiters.add(resolve); });
  };

  const dispose = (): void => {
    disposed = true;
    listeners.clear();
    if (inFlight === null) settleIdle();
  };

  return {
    stage,
    flush,
    retry,
    mirrorLifecycle,
    writeReplacement,
    createCheckpoint,
    getSnapshot,
    subscribe,
    whenIdle,
    dispose,
  };
};
