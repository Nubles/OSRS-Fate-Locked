import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import { openRecoveryDatabase, RecoveryDatabaseError } from './recoveryDatabase';
import type { RecoveryHead } from './recoveryTypes';
import type { RecoveryCheckpoint } from './recoveryTypes';

const openedRepositories: Array<{ close: () => void }> = [];

afterEach(() => {
  for (const repository of openedRepositories.splice(0)) repository.close();
});

const uniqueDbName = (): string => `recovery-test-${Date.now()}-${Math.random()}`;

const head = (overrides: Partial<RecoveryHead> = {}): RecoveryHead => ({
  profileId: 'alpha',
  persistenceRevision: 1,
  runId: 'run-alpha',
  runRevision: 1,
  capturedAt: 1_700_000_000_000,
  checksum: 'a'.repeat(64),
  data: JSON.stringify({ revision: 1 }),
  ...overrides,
});

const allowWrite = () => ({ ok: true as const });

const checkpoint = (
  persistenceRevision: number,
  capturedAt = 1_700_000_000_000 + persistenceRevision,
): RecoveryCheckpoint => ({
  ...head({ persistenceRevision, capturedAt }),
  reason: 'interval',
});

const openRepository = async () => {
  const repository = await openRecoveryDatabase({ databaseName: uniqueDbName() });
  openedRepositories.push(repository);
  return repository;
};

const openRawDatabase = (databaseName: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

describe('transactional recovery database', () => {
  it('opens the version-one schema with the required keys and checkpoint index', async () => {
    const databaseName = uniqueDbName();
    const repository = await openRecoveryDatabase({ databaseName });
    openedRepositories.push(repository);
    repository.close();

    const database = await openRawDatabase(databaseName);
    expect([...database.objectStoreNames]).toEqual(['checkpoints', 'heads', 'metadata']);
    const transaction = database.transaction('checkpoints', 'readonly');
    const checkpoints = transaction.objectStore('checkpoints');
    expect(checkpoints.keyPath).toEqual(['profileId', 'persistenceRevision']);
    expect(checkpoints.indexNames.contains('byProfileCapturedAt')).toBe(true);
    expect(checkpoints.index('byProfileCapturedAt').keyPath)
      .toEqual(['profileId', 'capturedAt']);
    expect(database.transaction('heads', 'readonly').objectStore('heads').keyPath)
      .toBe('profileId');
    expect(database.transaction('metadata', 'readonly').objectStore('metadata').keyPath)
      .toBe('key');
    database.close();
  });

  it('commits and reads back an exact journal head', async () => {
    const repository = await openRepository();

    await expect(repository.putHead(head({ persistenceRevision: 4 }), allowWrite))
      .resolves.toEqual({ stored: true });
    await expect(repository.getHead('alpha')).resolves.toEqual(
      head({ persistenceRevision: 4 }),
    );
  });

  it('cannot publish an older head over a newer revision', async () => {
    const repository = await openRepository();

    await expect(repository.putHead(head({ persistenceRevision: 9 }), allowWrite))
      .resolves.toEqual({ stored: true });
    await expect(repository.putHead(head({ persistenceRevision: 8 }), allowWrite))
      .resolves.toMatchObject({ stored: false, reason: 'stale_revision' });
    await expect(repository.getHead('alpha')).resolves.toEqual(
      head({ persistenceRevision: 9 }),
    );
  });

  it('aborts a head transaction when ownership changes after the request begins', async () => {
    const repository = await openRepository();
    const prior = head({ persistenceRevision: 3 });
    await expect(repository.putHead(prior, allowWrite)).resolves.toEqual({ stored: true });

    let calls = 0;
    const ownershipChangesAfterRequest = () => {
      calls += 1;
      return calls === 1
        ? { ok: true as const }
        : { ok: false as const, reason: 'ownership_conflict' as const };
    };

    await expect(repository.putHead(
      head({ persistenceRevision: 4 }),
      ownershipChangesAfterRequest,
    )).resolves.toEqual({ stored: false, reason: 'ownership_conflict' });
    await expect(repository.getHead('alpha')).resolves.toEqual(prior);
  });

  it('stores, lists, and deletes immutable checkpoints and metadata transactionally', async () => {
    const repository = await openRepository();
    const older = checkpoint(2, 1_700_000_000_002);
    const newer = checkpoint(3, 1_700_000_000_003);

    await expect(repository.putCheckpoint(older, allowWrite)).resolves.toEqual({ stored: true });
    await expect(repository.putCheckpoint(newer, allowWrite)).resolves.toEqual({ stored: true });
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([newer, older]);

    await expect(repository.putMetadata('mirror', { value: 7 }, allowWrite))
      .resolves.toEqual({ stored: true });
    await expect(repository.getMetadata<{ value: number }>('mirror')).resolves.toEqual({ value: 7 });

    await expect(repository.deleteCheckpoints('alpha', [2], allowWrite))
      .resolves.toEqual({ stored: true });
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([newer]);
  });

  it('aborts checkpoint, metadata, and deletion transactions when reauthorization fails', async () => {
    const repository = await openRepository();
    const existing = checkpoint(2);
    await expect(repository.putCheckpoint(existing, allowWrite)).resolves.toEqual({ stored: true });

    const losesOwnership = () => ({
      ok: false as const,
      reason: 'ownership_conflict' as const,
    });
    await expect(repository.putCheckpoint(checkpoint(3), losesOwnership))
      .resolves.toEqual({ stored: false, reason: 'ownership_conflict' });
    await expect(repository.putMetadata('mirror', { value: 8 }, losesOwnership))
      .resolves.toEqual({ stored: false, reason: 'ownership_conflict' });
    await expect(repository.deleteCheckpoints('alpha', [2], losesOwnership))
      .resolves.toEqual({ stored: false, reason: 'ownership_conflict' });

    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([existing]);
    await expect(repository.getMetadata('mirror')).resolves.toBeNull();
  });

  it('prunes only checkpoints outside the retention keep set before one quota retry', async () => {
    const now = new Date(2026, 7, 25, 12, 0, 0, 0).getTime();
    let headWrites = 0;
    const repository = await openRecoveryDatabase({
      databaseName: uniqueDbName(),
      now: () => now,
      transactionAdapter: {
        beforeRequest: (operation) => {
          if (operation === 'put-head') {
            headWrites += 1;
            if (headWrites === 1) throw new DOMException('full', 'QuotaExceededError');
          }
        },
      },
    });
    openedRepositories.push(repository);

    for (let revision = 1; revision <= 8; revision += 1) {
      await expect(repository.putCheckpoint(
        checkpoint(revision, new Date(2026, 7, 25, revision, 0, 0, 0).getTime()),
        allowWrite,
      )).resolves.toEqual({ stored: true });
    }

    await expect(repository.putHead(head({ persistenceRevision: 9 }), allowWrite))
      .resolves.toEqual({ stored: true });
    expect(headWrites).toBe(2);
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual(
      expect.arrayContaining(Array.from({ length: 6 }, (_, index) => (
        checkpoint(index + 3, new Date(2026, 7, 25, index + 3, 0, 0, 0).getTime())
      ))),
    );
    await expect(repository.listCheckpoints('alpha')).resolves.not.toEqual(
      expect.arrayContaining([
        checkpoint(1, new Date(2026, 7, 25, 1, 0, 0, 0).getTime()),
        checkpoint(2, new Date(2026, 7, 25, 2, 0, 0, 0).getTime()),
      ]),
    );
  });

  it('returns a quota failure after one retry and leaves the prior head intact', async () => {
    const databaseName = uniqueDbName();
    const initialRepository = await openRecoveryDatabase({ databaseName });
    openedRepositories.push(initialRepository);
    const prior = head({ persistenceRevision: 41 });
    await expect(initialRepository.putHead(prior, allowWrite)).resolves.toEqual({ stored: true });
    initialRepository.close();

    let headWrites = 0;
    const repository = await openRecoveryDatabase({
      databaseName,
      transactionAdapter: {
        beforeRequest: (operation) => {
          if (operation === 'put-head') {
            headWrites += 1;
            throw new DOMException('full', 'QuotaExceededError');
          }
        },
      },
    });
    openedRepositories.push(repository);

    await expect(repository.putHead(head({ persistenceRevision: 42 }), allowWrite))
      .resolves.toEqual({ stored: false, reason: 'quota' });
    expect(headWrites).toBe(2);
    await expect(repository.getHead('alpha')).resolves.toEqual(prior);
  });

  it('returns a typed quota result when pruning itself cannot read checkpoints', async () => {
    let headWrites = 0;
    const repository = await openRecoveryDatabase({
      databaseName: uniqueDbName(),
      transactionAdapter: {
        beforeRequest: (operation) => {
          if (operation === 'put-head') {
            headWrites += 1;
            if (headWrites === 1) throw new DOMException('full', 'QuotaExceededError');
          }
          if (operation === 'list-checkpoints') {
            throw new DOMException('full', 'QuotaExceededError');
          }
        },
      },
    });
    openedRepositories.push(repository);

    await expect(repository.putHead(head({ persistenceRevision: 5 }), allowWrite))
      .resolves.toEqual({ stored: false, reason: 'quota' });
  });

  it.each([
    ['unavailable', 'SecurityError'],
    ['quota', 'QuotaExceededError'],
    ['aborted', 'AbortError'],
    ['blocked', 'BlockedError'],
    ['unknown', 'UnknownError'],
  ] as const)('translates an IndexedDB %s open exception into a typed error', async (code, name) => {
    const indexedDBThatFails = {
      open: () => {
        throw new DOMException(name, name);
      },
    } as unknown as IDBFactory;

    await expect(openRecoveryDatabase({ indexedDB: indexedDBThatFails }))
      .rejects.toMatchObject({
        name: 'RecoveryDatabaseError',
        code,
      } satisfies Partial<RecoveryDatabaseError>);
  });

  it('translates a malformed IndexedDB open result into an unknown typed error', async () => {
    const malformedFactory = {
      open: () => undefined,
    } as unknown as IDBFactory;

    await expect(openRecoveryDatabase({ indexedDB: malformedFactory }))
      .rejects.toMatchObject({ name: 'RecoveryDatabaseError', code: 'unknown' });
  });
});
