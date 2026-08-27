import 'fake-indexeddb/auto';

import { IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRecoveryDatabase, RecoveryDatabaseError } from './recoveryDatabase';
import type { RecoveryHead } from './recoveryTypes';
import type { RecoveryCheckpoint } from './recoveryTypes';

const openedRepositories: Array<{ close: () => void }> = [];

afterEach(() => {
  for (const repository of openedRepositories.splice(0)) repository.close();
  vi.restoreAllMocks();
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

type ObservedRequestMethod = 'get' | 'put' | 'delete';

const observeRequestSuccesses = (
  labelRequest: (
    method: ObservedRequestMethod,
    storeName: string,
    input: unknown,
  ) => string | null,
) => {
  const successes: string[] = [];
  const nativeGet = IDBObjectStore.prototype.get;
  const nativePut = IDBObjectStore.prototype.put;
  const nativeDelete = IDBObjectStore.prototype.delete;
  const observe = <T,>(request: IDBRequest<T>, label: string | null): IDBRequest<T> => {
    if (label !== null) {
      request.addEventListener('success', () => { successes.push(label); }, { once: true });
    }
    return request;
  };
  const spies = [
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (
      this: IDBObjectStore,
      query: IDBValidKey | IDBKeyRange,
    ) {
      return observe(nativeGet.call(this, query), labelRequest('get', this.name, query));
    }),
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      const request = key === undefined
        ? nativePut.call(this, value)
        : nativePut.call(this, value, key);
      return observe(request, labelRequest('put', this.name, value));
    }),
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (
      this: IDBObjectStore,
      query: IDBValidKey | IDBKeyRange,
    ) {
      return observe(nativeDelete.call(this, query), labelRequest('delete', this.name, query));
    }),
  ];
  return {
    successes,
    restore: () => { for (const spy of spies) spy.mockRestore(); },
  };
};

const denyAfterSuccesses = (
  successes: readonly string[],
  required: readonly string[],
) => () => required.every(label => successes.includes(label))
  ? { ok: false as const, reason: 'ownership_conflict' as const }
  : { ok: true as const };

type HeadReadbackFault = {
  label: string;
  replacement: (candidate: RecoveryHead) => RecoveryHead | null;
};

const HEAD_READBACK_FAULTS: readonly HeadReadbackFault[] = [
  { label: 'missing', replacement: () => null },
  { label: 'stale', replacement: candidate => ({ ...candidate, persistenceRevision: 2 }) },
  { label: 'profileId mismatch', replacement: candidate => ({ ...candidate, profileId: 'beta' }) },
  {
    label: 'persistenceRevision mismatch',
    replacement: candidate => ({ ...candidate, persistenceRevision: 5 }),
  },
  { label: 'runId mismatch', replacement: candidate => ({ ...candidate, runId: 'run-other' }) },
  { label: 'runRevision mismatch', replacement: candidate => ({ ...candidate, runRevision: 2 }) },
  { label: 'capturedAt mismatch', replacement: candidate => ({ ...candidate, capturedAt: 1_800_000_000_000 }) },
  { label: 'checksum mismatch', replacement: candidate => ({ ...candidate, checksum: 'b'.repeat(64) }) },
  { label: 'data mismatch', replacement: candidate => ({ ...candidate, data: '{"revision":999}' }) },
];

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

  it.each(HEAD_READBACK_FAULTS)(
    'does not report a $label post-put head readback as stored and rolls the write back',
    async ({ replacement }) => {
      const repository = await openRepository();
      const prior = head({ persistenceRevision: 3 });
      const candidate = head({ persistenceRevision: 4 });
      await expect(repository.putHead(prior, allowWrite)).resolves.toEqual({ stored: true });

      const nativePut = IDBObjectStore.prototype.put;
      const nativeDelete = IDBObjectStore.prototype.delete;
      let injectedRequestSucceeded = false;
      const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        value: unknown,
      ) {
        const attempted = value as RecoveryHead;
        const request = nativePut.call(this, attempted);
        if (this.name !== 'heads' || attempted.persistenceRevision !== candidate.persistenceRevision) {
          return request;
        }
        request.addEventListener('success', () => {
          const corrupted = replacement(candidate);
          const injected = corrupted === null
            ? [nativeDelete.call(this, candidate.profileId)]
            : corrupted.profileId === candidate.profileId
              ? [nativePut.call(this, corrupted)]
              : [
                  nativeDelete.call(this, candidate.profileId),
                  nativePut.call(this, corrupted),
                ];
          let completed = 0;
          for (const injectedRequest of injected) {
            injectedRequest.addEventListener('success', () => {
              completed += 1;
              injectedRequestSucceeded = completed === injected.length;
            }, { once: true });
          }
        }, { once: true });
        return request;
      });

      let result;
      try {
        result = await repository.putHead(candidate, allowWrite);
      } finally {
        putSpy.mockRestore();
      }

      expect(injectedRequestSucceeded).toBe(true);
      expect(result).toEqual({ stored: false, reason: 'storage_unavailable' });
      await expect(repository.getHead('alpha')).resolves.toEqual(prior);
      await expect(repository.getHead('beta')).resolves.toBeNull();
    },
  );

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

  it('rolls back a successful head put when ownership is lost before commit', async () => {
    const repository = await openRepository();
    const prior = head({ persistenceRevision: 3 });
    const candidate = head({ persistenceRevision: 4 });
    await expect(repository.putHead(prior, allowWrite)).resolves.toEqual({ stored: true });
    let headGets = 0;
    const requests = observeRequestSuccesses((method, storeName, input) => {
      if (storeName !== 'heads') return null;
      if (method === 'put'
        && (input as Partial<RecoveryHead>).persistenceRevision === candidate.persistenceRevision) {
        return 'head-put';
      }
      if (method === 'get' && input === candidate.profileId) {
        headGets += 1;
        return headGets === 2 ? 'head-readback' : null;
      }
      return null;
    });

    try {
      await expect(repository.putHead(
        candidate,
        denyAfterSuccesses(requests.successes, ['head-put', 'head-readback']),
      )).resolves.toEqual({ stored: false, reason: 'ownership_conflict' });
    } finally {
      requests.restore();
    }

    expect(requests.successes).toEqual(['head-put', 'head-readback']);
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

  it('treats an identical checkpoint retry as an idempotent success without rewriting', async () => {
    let checkpointWrites = 0;
    const repository = await openRecoveryDatabase({
      databaseName: uniqueDbName(),
      transactionAdapter: {
        beforeRequest: (operation) => {
          if (operation === 'put-checkpoint') checkpointWrites += 1;
        },
      },
    });
    openedRepositories.push(repository);
    const record = checkpoint(7);

    await expect(repository.putCheckpoint(record, allowWrite)).resolves.toEqual({ stored: true });
    await expect(repository.putCheckpoint({ ...record }, allowWrite))
      .resolves.toEqual({ stored: true });
    expect(checkpointWrites).toBe(1);
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([record]);
  });

  it('rejects a conflicting duplicate checkpoint and preserves the original record', async () => {
    const repository = await openRepository();
    const original = checkpoint(8);
    const conflicting = { ...original, data: JSON.stringify({ revision: 800 }) };

    await expect(repository.putCheckpoint(original, allowWrite)).resolves.toEqual({ stored: true });
    await expect(repository.putCheckpoint(conflicting, allowWrite))
      .resolves.toEqual({ stored: false, reason: 'stale_revision' });
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([original]);
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

  it('rolls back a successful checkpoint put when ownership is lost before commit', async () => {
    const repository = await openRepository();
    const existing = checkpoint(2);
    const candidate = checkpoint(3);
    await expect(repository.putCheckpoint(existing, allowWrite)).resolves.toEqual({ stored: true });
    const requests = observeRequestSuccesses((method, storeName, input) => (
      method === 'put'
      && storeName === 'checkpoints'
      && (input as Partial<RecoveryCheckpoint>).persistenceRevision === candidate.persistenceRevision
        ? 'checkpoint-put'
        : null
    ));

    try {
      await expect(repository.putCheckpoint(
        candidate,
        denyAfterSuccesses(requests.successes, ['checkpoint-put']),
      )).resolves.toEqual({ stored: false, reason: 'ownership_conflict' });
    } finally {
      requests.restore();
    }

    expect(requests.successes).toEqual(['checkpoint-put']);
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([existing]);
  });

  it('rolls back a successful metadata put when ownership is lost before commit', async () => {
    const repository = await openRepository();
    const requests = observeRequestSuccesses((method, storeName, input) => (
      method === 'put'
      && storeName === 'metadata'
      && (input as { key?: unknown }).key === 'mirror'
        ? 'metadata-put'
        : null
    ));

    try {
      await expect(repository.putMetadata(
        'mirror',
        { value: 8 },
        denyAfterSuccesses(requests.successes, ['metadata-put']),
      )).resolves.toEqual({ stored: false, reason: 'ownership_conflict' });
    } finally {
      requests.restore();
    }

    expect(requests.successes).toEqual(['metadata-put']);
    await expect(repository.getMetadata('mirror')).resolves.toBeNull();
  });

  it('rolls back a successful checkpoint deletion when ownership is lost before commit', async () => {
    const repository = await openRepository();
    const existing = checkpoint(2);
    await expect(repository.putCheckpoint(existing, allowWrite)).resolves.toEqual({ stored: true });
    const requests = observeRequestSuccesses((method, storeName, input) => (
      method === 'delete'
      && storeName === 'checkpoints'
      && Array.isArray(input)
      && input[0] === 'alpha'
      && input[1] === 2
        ? 'checkpoint-delete'
        : null
    ));

    try {
      await expect(repository.deleteCheckpoints(
        'alpha',
        [2],
        denyAfterSuccesses(requests.successes, ['checkpoint-delete']),
      )).resolves.toEqual({ stored: false, reason: 'ownership_conflict' });
    } finally {
      requests.restore();
    }

    expect(requests.successes).toEqual(['checkpoint-delete']);
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([existing]);
  });

  it('aborts profile cleanup when ownership changes after the final delete request', async () => {
    const repository = await openRepository();
    const existingHead = head({ persistenceRevision: 5 });
    const existingCheckpoint = checkpoint(4);
    const existingMetadata = { profileId: 'alpha', marker: 'keep-on-takeover' };
    await expect(repository.putHead(existingHead, allowWrite)).resolves.toEqual({ stored: true });
    await expect(repository.putCheckpoint(existingCheckpoint, allowWrite))
      .resolves.toEqual({ stored: true });
    await expect(repository.putMetadata('profile-alpha-marker', existingMetadata, allowWrite))
      .resolves.toEqual({ stored: true });

    const requests = observeRequestSuccesses((method, storeName, input) => {
      if (method !== 'delete') return null;
      if (storeName === 'heads' && input === 'alpha') return 'profile-head-delete';
      if (storeName === 'checkpoints'
        && Array.isArray(input)
        && input[0] === 'alpha'
        && input[1] === existingCheckpoint.persistenceRevision) {
        return 'profile-checkpoint-delete';
      }
      if (storeName === 'metadata' && input === 'profile-alpha-marker') {
        return 'profile-metadata-delete';
      }
      return null;
    });
    const expectedSuccesses = [
      'profile-head-delete',
      'profile-checkpoint-delete',
      'profile-metadata-delete',
    ];

    try {
      await expect(repository.deleteProfileData?.(
        'alpha',
        denyAfterSuccesses(requests.successes, expectedSuccesses),
      )).resolves.toEqual({ stored: false, reason: 'ownership_conflict' });
    } finally {
      requests.restore();
    }

    expect(requests.successes).toEqual(expectedSuccesses);
    await expect(repository.getHead('alpha')).resolves.toEqual(existingHead);
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([existingCheckpoint]);
    await expect(repository.getMetadata('profile-alpha-marker')).resolves.toEqual(existingMetadata);
  });

  it('deletes only the target profile and reports idempotent committed removal counts', async () => {
    const repository = await openRepository();
    const alphaHead = head({ profileId: 'alpha', persistenceRevision: 5 });
    const betaHead = head({
      profileId: 'beta',
      persistenceRevision: 8,
      runId: 'run-beta',
      data: JSON.stringify({ revision: 8 }),
    });
    const alphaCheckpoint = checkpoint(4);
    const betaCheckpoint = {
      ...checkpoint(7),
      profileId: 'beta',
      runId: 'run-beta',
      data: JSON.stringify({ revision: 7 }),
    };
    await repository.putHead(alphaHead, allowWrite);
    await repository.putHead(betaHead, allowWrite);
    await repository.putCheckpoint(alphaCheckpoint, allowWrite);
    await repository.putCheckpoint(betaCheckpoint, allowWrite);
    await repository.putMetadata('profile-alpha-marker', { profileId: 'alpha', marker: 'remove' }, allowWrite);
    await repository.putMetadata('profile-beta-marker', { profileId: 'beta', marker: 'keep' }, allowWrite);
    await repository.putMetadata('shared-marker', { marker: 'keep' }, allowWrite);

    await expect(repository.deleteProfileData?.('alpha', allowWrite))
      .resolves.toEqual({ stored: true, removedEntries: 3 });
    await expect(repository.deleteProfileData?.('alpha', allowWrite))
      .resolves.toEqual({ stored: true, removedEntries: 0 });

    await expect(repository.getHead('alpha')).resolves.toBeNull();
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual([]);
    await expect(repository.getMetadata('profile-alpha-marker')).resolves.toBeNull();
    await expect(repository.getHead('beta')).resolves.toEqual(betaHead);
    await expect(repository.listCheckpoints('beta')).resolves.toEqual([betaCheckpoint]);
    await expect(repository.getMetadata('profile-beta-marker'))
      .resolves.toEqual({ profileId: 'beta', marker: 'keep' });
    await expect(repository.getMetadata('shared-marker')).resolves.toEqual({ marker: 'keep' });
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

  it('prunes interval checkpoints after an ordinary checkpoint write', async () => {
    const now = new Date(2026, 7, 25, 12, 0, 0, 0).getTime();
    const repository = await openRecoveryDatabase({
      databaseName: uniqueDbName(),
      now: () => now,
    });
    openedRepositories.push(repository);

    for (let revision = 1; revision <= 7; revision += 1) {
      await expect(repository.putCheckpoint(
        checkpoint(revision, now + revision),
        allowWrite,
      )).resolves.toEqual({ stored: true });
    }

    const remaining = await repository.listCheckpoints('alpha');
    expect(remaining).toHaveLength(6);
    expect(remaining.map(record => record.persistenceRevision)).not.toContain(1);
  });

  it('rolls back a completed retention prune when ownership is lost before commit', async () => {
    const now = new Date(2026, 7, 25, 12, 0, 0, 0).getTime();
    const repository = await openRecoveryDatabase({
      databaseName: uniqueDbName(),
      now: () => now,
    });
    openedRepositories.push(repository);
    for (let revision = 1; revision <= 6; revision += 1) {
      await expect(repository.putCheckpoint(checkpoint(revision, now + revision), allowWrite))
        .resolves.toEqual({ stored: true });
    }
    const requests = observeRequestSuccesses((method, storeName, input) => (
      method === 'delete'
      && storeName === 'checkpoints'
      && Array.isArray(input)
      && input[0] === 'alpha'
      && input[1] === 1
        ? 'prune-checkpoint-delete'
        : null
    ));

    try {
      await expect(repository.putCheckpoint(
        checkpoint(7, now + 7),
        denyAfterSuccesses(requests.successes, ['prune-checkpoint-delete']),
      )).resolves.toEqual({ stored: true, pruneFailure: 'ownership_conflict' });
    } finally {
      requests.restore();
    }

    expect(requests.successes).toEqual(['prune-checkpoint-delete']);
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual(
      Array.from({ length: 7 }, (_, index) => checkpoint(7 - index, now + 7 - index)),
    );
  });

  it('surfaces a prune failure without losing the stored checkpoint', async () => {
    const now = new Date(2026, 7, 25, 12, 0, 0, 0).getTime();
    const repository = await openRecoveryDatabase({
      databaseName: uniqueDbName(),
      now: () => now,
    });
    openedRepositories.push(repository);
    for (let revision = 1; revision <= 6; revision += 1) {
      await expect(repository.putCheckpoint(checkpoint(revision, now + revision), allowWrite))
        .resolves.toEqual({ stored: true });
    }
    let authorizationCalls = 0;
    const ownershipExpiresDuringPrune = () => {
      authorizationCalls += 1;
      return authorizationCalls <= 3
        ? { ok: true as const }
        : { ok: false as const, reason: 'ownership_conflict' as const };
    };

    await expect(repository.putCheckpoint(checkpoint(7, now + 7), ownershipExpiresDuringPrune))
      .resolves.toEqual({ stored: true, pruneFailure: 'ownership_conflict' });
    await expect(repository.listCheckpoints('alpha')).resolves.toEqual(
      Array.from({ length: 7 }, (_, index) => checkpoint(7 - index, now + 7 - index)),
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
