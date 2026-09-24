import type { GameState } from '../types';
import type { BackupWriteResult } from './gamePersistence';
import type { SaveStorage } from './pendingSaves';
import type {
  MirrorMetadata,
  RecoveryCheckpoint,
  RecoveryCheckpointReason,
  RecoveryHead,
  RecoveryMaintenanceFailureReason,
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

const isMaintenanceFailureReason = (
  value: unknown,
): value is RecoveryMaintenanceFailureReason => (
  value === 'ownership_conflict'
  || value === 'storage_unavailable'
  || value === 'quota'
  || value === 'stale_revision'
);

const writeResult = (value: unknown): RecoveryWriteResult => {
  if (typeof value === 'object' && value !== null && 'stored' in value) {
    const result = value as RecoveryWriteResult;
    if (result.stored === true) {
      return isMaintenanceFailureReason(result.pruneFailure)
        ? { stored: true, pruneFailure: result.pruneFailure }
        : { stored: true };
    }
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

type SaveFailureReason = NonNullable<SaveDurabilitySnapshot['failureReason']>;

const failureReasonFromWrite = (
  result: RecoveryWriteResult,
): SaveFailureReason | undefined => {
  if (result.stored === true) return undefined;
  return result.reason === 'ownership_conflict'
    ? 'ownership_conflict'
    : 'storage_unavailable';
};

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
  failureReason?: SaveFailureReason;
  stale?: boolean;
};

type MirrorOutcome = {
  primaryVerified: boolean;
  mirrorMetadataVerified: boolean;
  failureReason?: SaveFailureReason;
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
  /**
   * Raise the revision counter to the newest durable revision. Call it when
   * this tab gains ownership: another tab may have written while this one
   * was blocked, and the journal rejects revisions behind its head.
   */
  resyncRevision?(): Promise<void>;
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
  let revisionSync: Promise<void> | null = null;
  let pending: StagedSnapshot | null = null;
  let lastAttemptData: string | null = null;
  let changeToken = 0;
  let replacementToken = 0;
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
      && snapshot.failureReason === next.failureReason
    ) return;
    snapshot = next;
    notify();
  };

  const failedSnapshot = (): SaveDurabilitySnapshot => ({
    primary: 'failed',
    recovery: 'degraded',
    savedAt: snapshot.savedAt,
  });

  const mirrorMetadataRevision = (): number => {
    try {
      const raw = options.storage.getItem(profileMirrorMetadataKey(options.storageKey));
      if (raw === null) return 0;
      const value = (JSON.parse(raw) as { persistenceRevision?: unknown }).persistenceRevision;
      return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  };

  const durableRevision = async (): Promise<number> => {
    const stored = options.repository.maxPersistenceRevision
      ? await options.repository.maxPersistenceRevision(options.profileId)
      : Math.max(
        (await options.repository.getHead(options.profileId))?.persistenceRevision ?? 0,
        ...(await options.repository.listCheckpoints(options.profileId))
          .map(checkpoint => checkpoint.persistenceRevision),
      );
    return Math.max(Number.isSafeInteger(stored) ? stored : 0, mirrorMetadataRevision());
  };

  const resyncRevision = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    const sync: Promise<void> = (revisionSync ?? Promise.resolve())
      .then(durableRevision)
      .then(
        stored => {
          if (stored > revision) revision = stored;
        },
        () => {
          // An unreadable journal keeps the local counter; a stale write is
          // then retried once after its own resync.
        },
      )
      .finally(() => {
        if (revisionSync === sync) revisionSync = null;
      });
    revisionSync = sync;
    return sync;
  };

  const isStaleRevision = (result: RecoveryWriteResult): boolean => (
    result.stored === false && result.reason === 'stale_revision'
  );

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
  ): MirrorOutcome => {
    if (candidate !== null && !isCurrent(candidate)) {
      return { primaryVerified: false, mirrorMetadataVerified: false };
    }

    const authorization = options.authorizeWrite();
    if (isWriteFailure(authorization)) {
      return {
        primaryVerified: false,
        mirrorMetadataVerified: false,
        failureReason: authorization.reason,
      };
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
      return {
        primaryVerified: true,
        mirrorMetadataVerified: false,
        failureReason: metadataAuthorization.reason,
      };
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
    if (revisionSync !== null) await revisionSync;
    const validationHash = beginValidateAndHash(candidate.data);
    // An immediately settled checksum permits a synchronous stage that lands
    // before this continuation to remain part of the current journal flight;
    // a genuinely deferred checksum must reject a superseded candidate after
    // it resolves.
    await Promise.resolve();
    const checksumWasImmediate = validationHash.settledBeforeYield();
    const prepared = await validationHash.promise;
    if (disposed) {
      return {
        journal: unavailableWrite(),
        primaryVerified: false,
        mirrorMetadataVerified: false,
        stale: true,
      };
    }
    if (prepared.ok === false) {
      const failureReason = failureReasonFromWrite(prepared.result);
      return {
        journal: prepared.result,
        primaryVerified: false,
        mirrorMetadataVerified: false,
        ...(failureReason === undefined ? {} : { failureReason }),
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
        failureReason: authorization.reason,
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

    let persistenceRevision = nextRevision(revision);
    revision = persistenceRevision;
    let record: RecoveryHead = {
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

    const putHead = async (): Promise<RecoveryWriteResult> => {
      try {
        return writeResult(await options.repository.putHead(record, options.authorizeWrite));
      } catch {
        return unavailableWrite();
      }
    };
    let journal = await putHead();

    if (isStaleRevision(journal) && !disposed && unchangedSinceChecksum()) {
      // The journal is ahead of this tab's counter because another tab
      // wrote while this one could not. Catch up once and retry; the
      // repository still re-checks ownership inside its transaction.
      await resyncRevision();
      if (!disposed && unchangedSinceChecksum()) {
        persistenceRevision = nextRevision(revision);
        revision = persistenceRevision;
        record = { ...record, persistenceRevision };
        journal = await putHead();
      }
    }

    if (disposed) {
      return {
        journal,
        primaryVerified: false,
        mirrorMetadataVerified: false,
        stale: true,
      };
    }

    if (isStaleRevision(journal)) {
      // Never mirror bytes the journal refused. Its newer head would win on
      // the next load and silently undo them, so report the save as failed.
      return unchangedSinceChecksum()
        ? { journal, primaryVerified: false, mirrorMetadataVerified: false }
        : { journal, primaryVerified: false, mirrorMetadataVerified: false, stale: true };
    }

    const mirrored = mirror(
      candidate.data,
      persistenceRevision,
      capturedAt,
      prepared.checksum,
      candidate,
    );
    const failureReason = failureReasonFromWrite(journal) ?? mirrored.failureReason;
    return {
      journal,
      primaryVerified: mirrored.primaryVerified,
      mirrorMetadataVerified: mirrored.mirrorMetadataVerified,
      ...(failureReason === undefined ? {} : { failureReason }),
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
        ...(outcome.failureReason === undefined ? {} : { failureReason: outcome.failureReason }),
      });
      return;
    }

    setSnapshot({
      primary: newerStateIsPending ? 'saving' : 'failed',
      recovery: 'degraded',
      savedAt: snapshot.savedAt,
      ...(outcome.failureReason === undefined ? {} : { failureReason: outcome.failureReason }),
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
        if (disposed) return failedSnapshot();
        applyOutcome(candidate, outcome);
        return { ...snapshot };
      })
      .catch(() => {
        if (disposed) return failedSnapshot();
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
    if (disposed) return Promise.resolve(failedSnapshot());
    if (inFlight !== null) return inFlight;
    if (pending === null) return Promise.resolve({ ...snapshot });
    return startFlush() ?? Promise.resolve({ ...snapshot });
  };

  const retry = async (): Promise<SaveDurabilitySnapshot> => {
    if (disposed) return failedSnapshot();
    if (inFlight !== null) {
      await inFlight;
      await whenIdle();
      if (disposed) return failedSnapshot();
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
    if (disposed) return failedSnapshot();
    const token = ++replacementToken;
    stage(data);
    const stagedChangeToken = changeToken;
    await flush();
    await whenIdle();
    if (
      disposed
      || replacementToken !== token
      || changeToken !== stagedChangeToken
      || lastAttemptData !== data
      || (pending !== null && pending.data !== data)
    ) return failedSnapshot();
    return { ...snapshot };
  };

  const createCheckpoint = async (
    data: string,
    reason: RecoveryCheckpointReason,
  ): Promise<BackupWriteResult> => {
    if (disposed || data.length === 0) return { stored: false, reason: 'empty' };
    await whenIdle();
    if (revisionSync !== null) await revisionSync;
    const checkpointChangeToken = changeToken;
    const checkpointStaged = pending;

    const prepared = await beginValidateAndHash(data).promise;
    if (!prepared.ok) return { stored: false, reason: 'storage_unavailable' };
    // Hashing is asynchronous. Do not allocate a revision for bytes that a
    // newer staged snapshot has already superseded while the hash was away.
    if (
      disposed
      || changeToken !== checkpointChangeToken
      || pending !== checkpointStaged
    ) return { stored: false, reason: 'storage_unavailable' };
    const authorization = options.authorizeWrite();
    if (isWriteFailure(authorization)) return checkpointFailure(saveAuthorizationResult(authorization));

    const allocate = (): RecoveryCheckpoint => {
      const persistenceRevision = nextRevision(revision);
      revision = persistenceRevision;
      return {
        profileId: options.profileId,
        persistenceRevision,
        runId: stateRunId(prepared.validation.state),
        runRevision: stateRunRevision(prepared.validation.state),
        capturedAt: options.now(),
        checksum: prepared.checksum,
        data,
        reason,
      };
    };
    const putCheckpoint = async (record: RecoveryCheckpoint): Promise<RecoveryWriteResult> => {
      try {
        return writeResult(await options.repository.putCheckpoint(record, options.authorizeWrite));
      } catch {
        return unavailableWrite();
      }
    };
    let result = await putCheckpoint(allocate());
    if (isStaleRevision(result) && !disposed) {
      // Another tab used this revision for a different checkpoint while this
      // one was blocked. Catch up and store it under the next free revision.
      await resyncRevision();
      if (!disposed) result = await putCheckpoint(allocate());
    }
    return result.stored
      ? result.pruneFailure === undefined
        ? { stored: true }
        : { stored: true, pruneFailure: result.pruneFailure }
      : checkpointFailure(result);
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
    changeToken += 1;
    replacementToken += 1;
    listeners.clear();
    if (inFlight === null) settleIdle();
  };

  return {
    stage,
    resyncRevision,
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
