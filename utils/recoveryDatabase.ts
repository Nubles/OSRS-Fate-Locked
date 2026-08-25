import { selectRetainedCheckpointKeys } from './recoveryRetention';
import type {
  RecoveryCheckpoint,
  RecoveryHead,
  RecoveryRepository,
  RecoveryWriteResult,
} from './recoveryTypes';
import type { SaveWriteAuthorization } from './profileWriterLease';

const DEFAULT_DATABASE_NAME = 'fate-locked-recovery-v1';
const DATABASE_VERSION = 1;
const HEADS_STORE = 'heads';
const CHECKPOINTS_STORE = 'checkpoints';
const METADATA_STORE = 'metadata';
const CHECKPOINT_INDEX = 'byProfileCapturedAt';

export type RecoveryDatabaseErrorCode =
  | 'unavailable'
  | 'quota'
  | 'aborted'
  | 'blocked'
  | 'unknown';

export class RecoveryDatabaseError extends Error {
  readonly code: RecoveryDatabaseErrorCode;
  readonly cause: unknown;

  constructor(code: RecoveryDatabaseErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'RecoveryDatabaseError';
    this.code = code;
    this.cause = cause;
  }
}

export type RecoveryDatabaseOperation =
  | 'get-head'
  | 'put-head'
  | 'list-checkpoints'
  | 'put-checkpoint'
  | 'delete-checkpoint'
  | 'get-metadata'
  | 'put-metadata';

/**
 * A narrow adapter seam used by deterministic tests. The default path always
 * uses native IDB transactions and requests. `beforeRequest` may throw a
 * DOMException to exercise browser failures without replacing IndexedDB.
 */
export interface RecoveryTransactionAdapter {
  transaction?: (
    database: IDBDatabase,
    storeNames: string | string[],
    mode: IDBTransactionMode,
  ) => IDBTransaction;
  beforeRequest?: (
    operation: RecoveryDatabaseOperation,
    storeName: string,
  ) => void;
}

export interface OpenRecoveryDatabaseOptions {
  databaseName?: string;
  indexedDB?: IDBFactory;
  now?: () => number;
  transactionAdapter?: RecoveryTransactionAdapter;
}

type MetadataEnvelope = { key: string; value: unknown };

const isNamedError = (error: unknown, name: string): boolean => (
  typeof error === 'object'
  && error !== null
  && 'name' in error
  && (error as { name?: unknown }).name === name
);

const classifyError = (error: unknown): RecoveryDatabaseErrorCode => {
  if (error instanceof RecoveryDatabaseError) return error.code;
  if (isNamedError(error, 'QuotaExceededError')) return 'quota';
  if (isNamedError(error, 'AbortError')) return 'aborted';
  if (isNamedError(error, 'BlockedError')) return 'blocked';
  if (isNamedError(error, 'SecurityError') || isNamedError(error, 'NotSupportedError')) {
    return 'unavailable';
  }
  return 'unknown';
};

const toDatabaseError = (
  error: unknown,
  message = 'IndexedDB recovery storage failed.',
): RecoveryDatabaseError => {
  if (error instanceof RecoveryDatabaseError) return error;
  const code = classifyError(error);
  return new RecoveryDatabaseError(code, message, error);
};

const transactionDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(
      tx.error ?? new DOMException('Aborted', 'AbortError'),
    );
    tx.onerror = () => reject(
      tx.error ?? new DOMException('Failed', 'UnknownError'),
    );
  });

const requestDone = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(
      request.error ?? new DOMException('Failed', 'UnknownError'),
    );
  });

const abortTransaction = async (
  tx: IDBTransaction,
  completion: Promise<void>,
): Promise<void> => {
  try {
    tx.abort();
  } catch {
    // The transaction may already have aborted because a request failed.
  }
  try {
    await completion;
  } catch {
    // The caller is returning a typed operation result, not exposing abort.
  }
};

const keyForCheckpoint = (profileId: string, persistenceRevision: number): string =>
  `${profileId}:${persistenceRevision}`;

const isWriteFailure = (
  authorization: SaveWriteAuthorization,
): authorization is { ok: false; reason: 'ownership_conflict' | 'storage_unavailable' } =>
  authorization.ok === false;

class OwnershipAbort extends Error {
  constructor(readonly result: RecoveryWriteResult) {
    super('Recovery write ownership changed during the transaction.');
    this.name = 'OwnershipAbort';
  }
}

const writeFailureForError = (error: unknown): RecoveryWriteResult => {
  const code = classifyError(error);
  if (code === 'quota') return { stored: false, reason: 'quota' };
  return { stored: false, reason: 'storage_unavailable' };
};

const createStores = (db: IDBDatabase, upgradeTransaction?: IDBTransaction): void => {
  if (!db.objectStoreNames.contains(HEADS_STORE)) {
    db.createObjectStore(HEADS_STORE, { keyPath: 'profileId' });
  }
  let checkpoints: IDBObjectStore | undefined;
  if (!db.objectStoreNames.contains(CHECKPOINTS_STORE)) {
    checkpoints = db.createObjectStore(CHECKPOINTS_STORE, {
      keyPath: ['profileId', 'persistenceRevision'],
    });
  } else if (upgradeTransaction !== undefined) {
    checkpoints = upgradeTransaction.objectStore(CHECKPOINTS_STORE);
  }
  if (checkpoints !== undefined && !checkpoints.indexNames.contains(CHECKPOINT_INDEX)) {
    checkpoints.createIndex(CHECKPOINT_INDEX, ['profileId', 'capturedAt']);
  }
  if (!db.objectStoreNames.contains(METADATA_STORE)) {
    db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
  }
};

const openDatabase = (
  factory: IDBFactory | undefined,
  databaseName: string,
): Promise<IDBDatabase> => {
  if (factory === undefined || typeof factory.open !== 'function') {
    return Promise.reject(new RecoveryDatabaseError(
      'unavailable',
      'IndexedDB recovery storage is unavailable.',
    ));
  }

  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    let blocked = false;
    try {
      request = factory.open(databaseName, DATABASE_VERSION);
    } catch (error) {
      reject(toDatabaseError(error, 'Unable to open IndexedDB recovery storage.'));
      return;
    }
    if (request === undefined || request === null || typeof request !== 'object') {
      reject(new RecoveryDatabaseError(
        'unknown',
        'IndexedDB returned an invalid open request.',
        request,
      ));
      return;
    }

    request.onupgradeneeded = () => {
      try {
        createStores(request.result, request.transaction ?? undefined);
      } catch (error) {
        try {
          request.transaction?.abort();
        } catch {
          // The open request will report the upgrade failure.
        }
        reject(toDatabaseError(error, 'Unable to upgrade IndexedDB recovery storage.'));
      }
    };
    request.onblocked = () => {
      blocked = true;
      reject(new RecoveryDatabaseError(
        'blocked',
        'IndexedDB recovery storage upgrade is blocked by another tab.',
      ));
    };
    request.onerror = () => {
      if (blocked) return;
      reject(toDatabaseError(
        request.error,
        'Unable to open IndexedDB recovery storage.',
      ));
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      resolve(request.result);
    };
  });
};

const sortedCheckpoints = (records: RecoveryCheckpoint[]): RecoveryCheckpoint[] => (
  records.sort((a, b) => {
    if (a.capturedAt !== b.capturedAt) return b.capturedAt - a.capturedAt;
    if (a.persistenceRevision !== b.persistenceRevision) {
      return b.persistenceRevision - a.persistenceRevision;
    }
    const aKey = keyForCheckpoint(a.profileId, a.persistenceRevision);
    const bKey = keyForCheckpoint(b.profileId, b.persistenceRevision);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  })
);

class IndexedDbRecoveryRepository implements RecoveryRepository {
  private closed = false;

  constructor(
    private readonly database: IDBDatabase,
    private readonly now: () => number,
    private readonly adapter?: RecoveryTransactionAdapter,
  ) {}

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new RecoveryDatabaseError('unavailable', 'Recovery database is closed.');
    }
  }

  private beginTransaction(
    storeNames: string | string[],
    mode: IDBTransactionMode,
  ): IDBTransaction {
    this.ensureOpen();
    try {
      return this.adapter?.transaction
        ? this.adapter.transaction(this.database, storeNames, mode)
        : this.database.transaction(storeNames, mode);
    } catch (error) {
      throw toDatabaseError(error, 'Unable to start an IndexedDB transaction.');
    }
  }

  private request<T>(
    operation: RecoveryDatabaseOperation,
    storeName: string,
    requestFactory: () => IDBRequest<T>,
  ): IDBRequest<T> {
    this.adapter?.beforeRequest?.(operation, storeName);
    try {
      return requestFactory();
    } catch (error) {
      throw toDatabaseError(error, 'IndexedDB recovery request failed.');
    }
  }

  private async transaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    operation: (tx: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const tx = this.beginTransaction(storeNames, mode);
    const completion = transactionDone(tx);
    try {
      const result = await operation(tx);
      await completion;
      return result;
    } catch (error) {
      await abortTransaction(tx, completion);
      throw toDatabaseError(error);
    }
  }

  private async transactionWithOwnership<T>(
    storeNames: string | string[],
    authorizeWrite: () => SaveWriteAuthorization,
    operation: RecoveryDatabaseOperation,
    body: (tx: IDBTransaction, authorize: () => SaveWriteAuthorization) => Promise<T>,
  ): Promise<T | RecoveryWriteResult> {
    const initialAuthorization = authorizeWrite();
    if (isWriteFailure(initialAuthorization)) return {
      stored: false,
      reason: initialAuthorization.reason,
    };

    const tx = this.beginTransaction(storeNames, 'readwrite');
    const completion = transactionDone(tx);
    try {
      const result = await body(tx, authorizeWrite);
      await completion;
      return result;
    } catch (error) {
      await abortTransaction(tx, completion);
      if (error instanceof OwnershipAbort) return error.result;
      if (error instanceof RecoveryDatabaseError) throw error;
      throw toDatabaseError(error, `IndexedDB ${operation} failed.`);
    }
  }

  async getHead(profileId: string): Promise<RecoveryHead | null> {
    const result = await this.transaction(HEADS_STORE, 'readonly', async (tx) => {
      const store = tx.objectStore(HEADS_STORE);
      return requestDone(this.request(
        'get-head',
        HEADS_STORE,
        () => store.get(profileId),
      ));
    });
    return (result as RecoveryHead | undefined) ?? null;
  }

  private async putHeadOnce(
    record: RecoveryHead,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult> {
    try {
      const result = await this.transactionWithOwnership(
        HEADS_STORE,
        authorizeWrite,
        'put-head',
        async (tx, authorize) => {
          const store = tx.objectStore(HEADS_STORE);
          const current = await requestDone(this.request(
            'get-head',
            HEADS_STORE,
            () => store.get(record.profileId),
          )) as RecoveryHead | undefined;
          if (current !== undefined && current.persistenceRevision > record.persistenceRevision) {
            return { stored: false, reason: 'stale_revision' } as const;
          }
          const writeAuthorization = authorize();
          if (isWriteFailure(writeAuthorization)) {
            throw new OwnershipAbort({ stored: false, reason: writeAuthorization.reason });
          }
          await requestDone(this.request(
            'put-head',
            HEADS_STORE,
            () => store.put(record),
          ));
          return { stored: true } as const;
        },
      );
      return result as RecoveryWriteResult;
    } catch (error) {
      return writeFailureForError(error);
    }
  }

  async putHead(
    record: RecoveryHead,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult> {
    const first = await this.putHeadOnce(record, authorizeWrite);
    if (first.stored) return first;
    if (!('reason' in first) || first.reason !== 'quota') return first;

    const pruned = await this.prune(record.profileId, authorizeWrite);
    if (pruned.stored === false) return pruned;
    return this.putHeadOnce(record, authorizeWrite);
  }

  async listCheckpoints(profileId: string): Promise<RecoveryCheckpoint[]> {
    const result = await this.transaction(CHECKPOINTS_STORE, 'readonly', async (tx) => {
      const store = tx.objectStore(CHECKPOINTS_STORE);
      const index = store.index(CHECKPOINT_INDEX);
      const range = IDBKeyRange.bound(
        [profileId, Number.NEGATIVE_INFINITY],
        [profileId, Number.POSITIVE_INFINITY],
      );
      return requestDone(this.request(
        'list-checkpoints',
        CHECKPOINTS_STORE,
        () => index.getAll(range),
      ));
    });
    return sortedCheckpoints((result as RecoveryCheckpoint[]).filter(
      (record) => record.profileId === profileId,
    ));
  }

  async putCheckpoint(
    record: RecoveryCheckpoint,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult> {
    try {
      const result = await this.transactionWithOwnership(
        CHECKPOINTS_STORE,
        authorizeWrite,
        'put-checkpoint',
        async (tx, authorize) => {
          const writeAuthorization = authorize();
          if (isWriteFailure(writeAuthorization)) {
            throw new OwnershipAbort({ stored: false, reason: writeAuthorization.reason });
          }
          const store = tx.objectStore(CHECKPOINTS_STORE);
          await requestDone(this.request(
            'put-checkpoint',
            CHECKPOINTS_STORE,
            () => store.put(record),
          ));
          return { stored: true } as const;
        },
      );
      return result as RecoveryWriteResult;
    } catch (error) {
      return writeFailureForError(error);
    }
  }

  private async deleteCheckpointKeys(
    profileId: string,
    keys: readonly (readonly [string, number])[],
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult> {
    try {
      const result = await this.transactionWithOwnership(
        CHECKPOINTS_STORE,
        authorizeWrite,
        'delete-checkpoint',
        async (tx, authorize) => {
          const store = tx.objectStore(CHECKPOINTS_STORE);
          for (const [keyProfileId, revision] of keys) {
            if (keyProfileId !== profileId) continue;
            const writeAuthorization = authorize();
            if (isWriteFailure(writeAuthorization)) {
              throw new OwnershipAbort({ stored: false, reason: writeAuthorization.reason });
            }
            await requestDone(this.request(
              'delete-checkpoint',
              CHECKPOINTS_STORE,
              () => store.delete([profileId, revision]),
            ));
          }
          return { stored: true } as const;
        },
      );
      return result as RecoveryWriteResult;
    } catch (error) {
      return writeFailureForError(error);
    }
  }

  async deleteCheckpoints(
    profileId: string,
    revisions: readonly number[],
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult> {
    return this.deleteCheckpointKeys(
      profileId,
      revisions.map((revision) => [profileId, revision] as const),
      authorizeWrite,
    );
  }

  private async prune(
    profileId: string,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult> {
    try {
      const records = await this.listCheckpoints(profileId);
      const retained = selectRetainedCheckpointKeys(records, this.now());
      const deletions = records
        .filter((record) => !retained.has(keyForCheckpoint(record.profileId, record.persistenceRevision)))
        .map((record) => [record.profileId, record.persistenceRevision] as const);
      return await this.deleteCheckpointKeys(profileId, deletions, authorizeWrite);
    } catch (error) {
      return writeFailureForError(error);
    }
  }

  async getMetadata<T>(key: string): Promise<T | null> {
    const result = await this.transaction(METADATA_STORE, 'readonly', async (tx) => {
      const store = tx.objectStore(METADATA_STORE);
      return requestDone(this.request(
        'get-metadata',
        METADATA_STORE,
        () => store.get(key),
      ));
    });
    return ((result as MetadataEnvelope | undefined)?.value as T | undefined) ?? null;
  }

  async putMetadata<T>(
    key: string,
    value: T,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult> {
    try {
      const result = await this.transactionWithOwnership(
        METADATA_STORE,
        authorizeWrite,
        'put-metadata',
        async (tx, authorize) => {
          const writeAuthorization = authorize();
          if (isWriteFailure(writeAuthorization)) {
            throw new OwnershipAbort({ stored: false, reason: writeAuthorization.reason });
          }
          const store = tx.objectStore(METADATA_STORE);
          await requestDone(this.request(
            'put-metadata',
            METADATA_STORE,
            () => store.put({ key, value }),
          ));
          return { stored: true } as const;
        },
      );
      return result as RecoveryWriteResult;
    } catch (error) {
      return writeFailureForError(error);
    }
  }
}

export const openRecoveryDatabase = async (
  options: OpenRecoveryDatabaseOptions = {},
): Promise<RecoveryRepository> => {
  const factory = options.indexedDB
    ?? (typeof indexedDB === 'undefined' ? undefined : indexedDB);
  const database = await openDatabase(
    factory,
    options.databaseName ?? DEFAULT_DATABASE_NAME,
  );
  return new IndexedDbRecoveryRepository(
    database,
    options.now ?? Date.now,
    options.transactionAdapter,
  );
};
