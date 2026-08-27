import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { Profile, ProfileMetadata } from '../types';
import {
  acquireProfileMetadataLock,
  commitProfileMetadataCandidate,
  initializeProfileMetadata,
  mutateProfileMetadata,
  resumeProfileDeletion,
  PROFILE_METADATA_LOCK_ARBITRATION_MS,
  PROFILE_METADATA_LOCK_KEY,
  PROFILE_METADATA_LOCK_RETRY_MS,
  PROFILE_METADATA_LOCK_TIMEOUT_MS,
  PROFILE_METADATA_LOCK_TTL_MS,
  profileMetadataLockRetryDelay,
  releaseProfileMetadataLock,
  type ProfileTransactionDependencies,
} from './profileMetadataTransaction';
import {
  LEGACY_SAVE_KEY,
  PROFILE_METADATA_BACKUP_KEY,
  PROFILE_METADATA_RECOVERY_KEY,
  PROFILES_KEY,
  parseProfileMetadata,
} from './profileMetadata';
import { openRecoveryDatabase } from './recoveryDatabase';
import type { RecoveryCheckpoint, RecoveryHead, RecoveryRepository } from './recoveryTypes';
import { claimWriterLease, readWriterLease, writerLeaseKey } from './profileWriterLease';
import { profileOwnedKeys } from './profileStorage';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
};

const deferred = <T,>(): Deferred<T> => {
  let resolve!: Deferred<T>['resolve'];
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
};

type TestStorage = ProfileTransactionDependencies['storage'] & {
  values: Map<string, string>;
  calls: string[];
};

const createStorage = (entries: readonly (readonly [string, string])[] = []): TestStorage => {
  const values = new Map(entries);
  const calls: string[] = [];
  return {
    values,
    calls,
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => {
      calls.push(`get:${key}`);
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      calls.push(`set:${key}`);
      values.set(key, value);
    },
    removeItem: key => {
      calls.push(`remove:${key}`);
      values.delete(key);
    },
  };
};

const createClock = (start = 1_000) => {
  let current = start;
  return {
    now: () => current,
    wait: vi.fn(async (milliseconds: number) => { current += milliseconds; }),
    set: (value: number) => { current = value; },
  };
};

const createDependencies = (
  storage = createStorage(),
  ownerId = 'tab-a',
  clock = createClock(),
): ProfileTransactionDependencies => ({
  storage,
  ownerId,
  now: clock.now,
  wait: clock.wait,
  validateGameSave: raw => raw.startsWith('valid:'),
  createProfileId: () => `${ownerId}-profile`,
});

const metadata = (revision: number, name = 'Alpha'): ProfileMetadata => ({
  version: 2,
  revision,
  profiles: [{ id: 'alpha', name, createdAt: 1 }],
  activeProfileId: 'alpha',
  deletions: [],
});

const lockRaw = (ownerId: string, expiresAt: number): string => JSON.stringify({
  version: 1,
  ownerId,
  expiresAt,
});

describe('profile metadata lock', () => {
  it.each([
    { label: 'remaining legitimate lifetime', raw: lockRaw('tab-b', 1_500), want: 500 },
    { label: 'expired lock', raw: lockRaw('tab-b', 999), want: 0 },
    { label: 'missing lock', raw: null, want: 0 },
    { label: 'malformed lock', raw: '{bad', want: 0 },
    {
      label: 'untrusted far-future expiry',
      raw: lockRaw('tab-b', 99_000),
      want: PROFILE_METADATA_LOCK_TTL_MS,
    },
  ])('bounds the provider retry delay for $label', ({ raw, want }) => {
    const storage = createStorage(raw === null ? [] : [[PROFILE_METADATA_LOCK_KEY, raw]]);

    expect(profileMetadataLockRetryDelay(createDependencies(storage))).toBe(want);
  });

  it('uses an immediate bounded retry when the lock cannot be read', () => {
    const storage = createStorage();
    storage.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };

    expect(profileMetadataLockRetryDelay(createDependencies(storage))).toBe(0);
  });

  it.each([
    { label: 'absent', raw: null },
    { label: 'expired', raw: lockRaw('tab-b', 999) },
    { label: 'malformed', raw: '{bad' },
  ])('acquires an $label lock and verifies ownership after arbitration', async ({ raw }) => {
    const storage = createStorage(raw === null ? [] : [[PROFILE_METADATA_LOCK_KEY, raw]]);
    const clock = createClock();

    await expect(acquireProfileMetadataLock(createDependencies(storage, 'tab-a', clock))).resolves.toEqual({
      status: 'acquired',
      lock: { version: 1, ownerId: 'tab-a', expiresAt: 1_000 + PROFILE_METADATA_LOCK_TTL_MS },
    });
    expect(clock.wait).toHaveBeenCalledWith(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    expect(storage.values.get(PROFILE_METADATA_LOCK_KEY)).toBe(lockRaw(
      'tab-a',
      1_000 + PROFILE_METADATA_LOCK_TTL_MS,
    ));
  });

  it('waits only to the deadline behind an unexpired foreign lock', async () => {
    const storage = createStorage([[PROFILE_METADATA_LOCK_KEY, lockRaw('tab-b', 99_000)]]);
    const clock = createClock();

    await expect(acquireProfileMetadataLock(createDependencies(storage, 'tab-a', clock))).resolves.toEqual({
      status: 'busy',
      lock: null,
    });
    expect(clock.now()).toBe(1_000 + PROFILE_METADATA_LOCK_TIMEOUT_MS);
    expect(storage.calls.some(call => call.startsWith('set:'))).toBe(false);
  });

  it('does not begin a claim without enough time left to arbitrate', async () => {
    const storage = createStorage();
    const clock = createClock();
    const getItem = storage.getItem;
    let lockReads = 0;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === PROFILE_METADATA_LOCK_KEY && ++lockReads === 2) {
        clock.set(1_000 + PROFILE_METADATA_LOCK_TIMEOUT_MS - PROFILE_METADATA_LOCK_ARBITRATION_MS + 1);
      }
      return value;
    };

    await expect(acquireProfileMetadataLock(createDependencies(storage, 'tab-a', clock))).resolves.toEqual({
      status: 'busy',
      lock: null,
    });
    expect(storage.calls).toEqual([
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `get:${PROFILE_METADATA_LOCK_KEY}`,
    ]);
    expect(clock.wait).not.toHaveBeenCalled();
  });

  it('does not acquire when arbitration resumes at the deadline', async () => {
    const storage = createStorage();
    const clock = createClock();
    const getItem = storage.getItem;
    let lockReads = 0;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === PROFILE_METADATA_LOCK_KEY && ++lockReads === 2) {
        clock.set(1_000 + PROFILE_METADATA_LOCK_TIMEOUT_MS - PROFILE_METADATA_LOCK_ARBITRATION_MS - 1);
      }
      return value;
    };
    const wait = vi.fn(async () => { clock.set(1_000 + PROFILE_METADATA_LOCK_TIMEOUT_MS); });

    await expect(acquireProfileMetadataLock({
      ...createDependencies(storage, 'tab-a', clock),
      wait,
    })).resolves.toEqual({
      status: 'busy',
      lock: null,
    });
    expect(wait).toHaveBeenCalledWith(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    expect(storage.calls.filter(call => call === `set:${PROFILE_METADATA_LOCK_KEY}`)).toHaveLength(1);
  });

  it('fails closed when lock storage cannot be read or written', async () => {
    const readFailure = createStorage();
    readFailure.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    await expect(acquireProfileMetadataLock(createDependencies(readFailure))).resolves.toEqual({
      status: 'storage_unavailable',
      lock: null,
    });

    const writeFailure = createStorage();
    writeFailure.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    await expect(acquireProfileMetadataLock(createDependencies(writeFailure))).resolves.toEqual({
      status: 'storage_unavailable',
      lock: null,
    });
  });

  it('owner-checks release and reports removal failure', () => {
    const storage = createStorage([[PROFILE_METADATA_LOCK_KEY, lockRaw('tab-a', 3_000)]]);

    expect(releaseProfileMetadataLock(createDependencies(storage, 'tab-b'))).toBe('not_owner');
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(true);
    expect(releaseProfileMetadataLock(createDependencies(storage, 'tab-a'))).toBe('released');
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);

    storage.values.set(PROFILE_METADATA_LOCK_KEY, lockRaw('tab-a', 3_000));
    storage.removeItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    expect(releaseProfileMetadataLock(createDependencies(storage, 'tab-a'))).toBe('storage_unavailable');
  });

  it('arbitrates simultaneous empty-lock observations to exactly one owner', async () => {
    const shared = createStorage();
    const clockA = createClock();
    const clockB = createClock();
    let absentReadsA = 2;
    let absentReadsB = 2;
    let continueA!: () => void;
    let continueB!: () => void;
    const storageA = Object.create(shared) as TestStorage;
    const storageB = Object.create(shared) as TestStorage;
    storageA.getItem = key => {
      if (key === PROFILE_METADATA_LOCK_KEY && absentReadsA > 0) {
        absentReadsA -= 1;
        shared.calls.push(`get:${key}`);
        return null;
      }
      return shared.getItem(key);
    };
    storageB.getItem = key => {
      if (key === PROFILE_METADATA_LOCK_KEY && absentReadsB > 0) {
        absentReadsB -= 1;
        shared.calls.push(`get:${key}`);
        return null;
      }
      return shared.getItem(key);
    };
    const waitA = vi.fn(() => new Promise<void>(resolve => { continueA = resolve; }));
    const waitB = vi.fn(() => new Promise<void>(resolve => { continueB = resolve; }));
    const pendingA = acquireProfileMetadataLock({ ...createDependencies(storageA, 'tab-a', clockA), wait: waitA });
    const pendingB = acquireProfileMetadataLock({ ...createDependencies(storageB, 'tab-b', clockB), wait: waitB });

    expect(waitA).toHaveBeenCalledWith(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    expect(waitB).toHaveBeenCalledWith(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    expect(shared.calls.filter(call => call === `set:${PROFILE_METADATA_LOCK_KEY}`)).toHaveLength(2);
    expect(shared.values.get(PROFILE_METADATA_LOCK_KEY)).toBe(lockRaw('tab-b', 3_000));
    continueB();
    const resultB = await pendingB;
    clockA.set(1_000 + PROFILE_METADATA_LOCK_TIMEOUT_MS);
    continueA();
    const resultA = await pendingA;

    expect([resultA.status, resultB.status].sort()).toEqual(['acquired', 'busy']);
    expect(shared.values.get(PROFILE_METADATA_LOCK_KEY)).toBe(lockRaw('tab-b', 3_000));
  });
});

const commitStorage = (
  previous: ProfileMetadata,
  candidate: ProfileMetadata,
  ownerId = 'tab-a',
) => createStorage([
  [PROFILE_METADATA_LOCK_KEY, lockRaw(ownerId, 3_000)],
  [PROFILES_KEY, JSON.stringify(previous)],
  [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(metadata(0, 'Old backup'))],
]);

describe('verified profile metadata commit', () => {
  it('verifies ownership, backs up the previous value, and verifies the candidate in order', () => {
    const previous = metadata(7);
    const candidate = metadata(8, 'Renamed');
    const storage = commitStorage(previous, candidate);
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toEqual({
      ok: true,
      metadata: candidate,
      notice: null,
    });
    expect(storage.calls).toEqual([
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILES_KEY}`,
      `get:${PROFILES_KEY}`,
    ]);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(previous));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(candidate));
  });

  it('rejects a candidate that does not advance exactly one revision', () => {
    const previous = metadata(7);
    const candidate = metadata(9, 'Skipped');
    const storage = commitStorage(previous, candidate);
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toEqual({
      ok: false,
      reason: 'invalid_metadata',
      metadata: previous,
      notice: null,
    });
    expect(storage.calls).toEqual([]);
  });

  it('does not write metadata after lock replacement immediately before commit', () => {
    const previous = metadata(7);
    const candidate = metadata(8, 'Renamed');
    const storage = commitStorage(previous, candidate, 'tab-b');
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toMatchObject({
      ok: false,
      reason: 'busy',
      metadata: previous,
    });
    expect(storage.calls).toEqual([`get:${PROFILE_METADATA_LOCK_KEY}`]);
  });

  it('does not write primary when ownership is replaced after backup verification', () => {
    const previous = metadata(7);
    const candidate = metadata(8, 'Renamed');
    const storage = commitStorage(previous, candidate);
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === PROFILE_METADATA_BACKUP_KEY) {
        storage.values.set(PROFILE_METADATA_LOCK_KEY, lockRaw('tab-b', 3_000));
      }
      return value;
    };
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toMatchObject({
      ok: false,
      reason: 'busy',
      metadata: previous,
    });
    expect(storage.calls).toEqual([
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_LOCK_KEY}`,
    ]);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(previous));
  });

  it('does not write primary when the post-backup ownership read fails', () => {
    const previous = metadata(7);
    const candidate = metadata(8, 'Renamed');
    const storage = commitStorage(previous, candidate);
    const getItem = storage.getItem;
    let lockReads = 0;
    storage.getItem = key => {
      if (key === PROFILE_METADATA_LOCK_KEY && ++lockReads === 2) {
        storage.calls.push(`get:${key}`);
        throw new DOMException('blocked', 'SecurityError');
      }
      return getItem(key);
    };
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toMatchObject({
      ok: false,
      reason: 'storage_unavailable',
      metadata: previous,
    });
    expect(storage.calls).toEqual([
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_LOCK_KEY}`,
    ]);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(previous));
  });

  it('does not write primary when the backup write throws', () => {
    const previous = metadata(7);
    const candidate = metadata(8, 'Renamed');
    const storage = commitStorage(previous, candidate);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === PROFILE_METADATA_BACKUP_KEY) {
        storage.calls.push(`set:${key}`);
        throw new DOMException('full', 'QuotaExceededError');
      }
      setItem(key, value);
    };
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toMatchObject({
      ok: false,
      reason: 'backup_failed',
      metadata: previous,
    });
    expect(storage.calls).toEqual([
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
    ]);
  });

  it('does not write primary when backup readback differs byte-for-byte', () => {
    const previous = metadata(7);
    const candidate = metadata(8, 'Renamed');
    const storage = commitStorage(previous, candidate);
    const getItem = storage.getItem;
    storage.getItem = key => key === PROFILE_METADATA_BACKUP_KEY
      ? (storage.calls.push(`get:${key}`), JSON.stringify(metadata(6, 'Interleaved')))
      : getItem(key);
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toMatchObject({
      ok: false,
      reason: 'backup_failed',
      metadata: previous,
    });
    expect(storage.calls).toEqual([
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_BACKUP_KEY}`,
    ]);
  });

  it('reports primary write failure after a verified backup', () => {
    const previous = metadata(7);
    const candidate = metadata(8, 'Renamed');
    const storage = commitStorage(previous, candidate);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === PROFILES_KEY) {
        storage.calls.push(`set:${key}`);
        throw new DOMException('full', 'QuotaExceededError');
      }
      setItem(key, value);
    };
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toMatchObject({
      ok: false,
      reason: 'verification_failed',
      metadata: previous,
    });
    expect(storage.calls).toEqual([
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILES_KEY}`,
    ]);
  });

  it('reports primary readback mismatch after a verified backup', () => {
    const previous = metadata(7);
    const candidate = metadata(8, 'Renamed');
    const storage = commitStorage(previous, candidate);
    const getItem = storage.getItem;
    storage.getItem = key => key === PROFILES_KEY
      ? (storage.calls.push(`get:${key}`), JSON.stringify(metadata(9, 'Interleaved')))
      : getItem(key);
    storage.calls.length = 0;

    expect(commitProfileMetadataCandidate(createDependencies(storage), previous, candidate)).toMatchObject({
      ok: false,
      reason: 'verification_failed',
      metadata: previous,
    });
    expect(storage.calls).toEqual([
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_LOCK_KEY}`,
      `set:${PROFILES_KEY}`,
      `get:${PROFILES_KEY}`,
    ]);
  });
});

const registryKeys = new Set([
  PROFILE_METADATA_RECOVERY_KEY,
  PROFILE_METADATA_BACKUP_KEY,
  PROFILES_KEY,
]);

const registryDurabilityCalls = (storage: TestStorage): string[] => {
  const firstWrite = storage.calls.findIndex(call => {
    const [operation, key] = call.split(':');
    return operation === 'set' && registryKeys.has(key);
  });
  if (firstWrite < 0) return [];
  return storage.calls.slice(firstWrite).filter(call => registryKeys.has(call.slice(call.indexOf(':') + 1)));
};

const registryWrites = (storage: TestStorage): string[] =>
  storage.calls.filter(call => call.startsWith('set:') && registryKeys.has(call.slice(4)));

const profileMetadataCopyWrites = (storage: TestStorage): string[] =>
  storage.calls.filter(call => (
    call === `set:${PROFILES_KEY}` || call === `set:${PROFILE_METADATA_BACKUP_KEY}`
  ));

const recoverySequence = [
  `set:${PROFILE_METADATA_RECOVERY_KEY}`,
  `get:${PROFILE_METADATA_RECOVERY_KEY}`,
  `set:${PROFILE_METADATA_BACKUP_KEY}`,
  `get:${PROFILE_METADATA_BACKUP_KEY}`,
  `set:${PROFILES_KEY}`,
  `get:${PROFILES_KEY}`,
];

const failRecoveryArchive = (
  storage: TestStorage,
  failure: 'write' | 'read' | 'mismatch',
): void => {
  const getItem = storage.getItem;
  const setItem = storage.setItem;
  storage.getItem = key => {
    if (key !== PROFILE_METADATA_RECOVERY_KEY || failure === 'write') return getItem(key);
    storage.calls.push(`get:${key}`);
    if (failure === 'read') throw new DOMException('blocked', 'SecurityError');
    return '{"different":true}';
  };
  storage.setItem = (key, value) => {
    if (key !== PROFILE_METADATA_RECOVERY_KEY || failure !== 'write') {
      setItem(key, value);
      return;
    }
    storage.calls.push(`set:${key}`);
    throw new DOMException('full', 'QuotaExceededError');
  };
};

const withNewerPrimaryDuringArbitration = (
  storage: TestStorage,
  newest: ProfileMetadata,
): ProfileTransactionDependencies => {
  const clock = createClock();
  const advance = clock.wait;
  let installed = false;
  return {
    ...createDependencies(storage, 'tab-a', clock),
    wait: vi.fn(async milliseconds => {
      if (!installed && milliseconds === PROFILE_METADATA_LOCK_ARBITRATION_MS) {
        storage.values.set(PROFILES_KEY, JSON.stringify(newest));
        installed = true;
      }
      await advance(milliseconds);
    }),
  };
};

describe('profile metadata startup', () => {
  it('returns a valid current registry without rewriting metadata', async () => {
    const current = metadata(7);
    const raw = JSON.stringify(current);
    const storage = createStorage([
      [PROFILES_KEY, raw],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(metadata(6, 'Backup'))],
    ]);

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
      ok: true,
      metadata: current,
      notice: null,
    });
    expect(registryWrites(storage)).toEqual([]);
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it('migrates a valid legacy registry through verified backup and primary writes', async () => {
    const legacyRaw = JSON.stringify({
      profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }],
      activeProfileId: 'alpha',
    });
    const storage = createStorage([[PROFILES_KEY, legacyRaw]]);
    const normalized: ProfileMetadata = {
      version: 2,
      revision: 0,
      profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }],
      activeProfileId: 'alpha',
      deletions: [],
    };
    const durable = { ...normalized, revision: 1 };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
      ok: true,
      metadata: durable,
      notice: null,
    });
    expect(registryDurabilityCalls(storage)).toEqual([
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_BACKUP_KEY}`,
      `set:${PROFILES_KEY}`,
      `get:${PROFILES_KEY}`,
    ]);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(normalized));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(durable));
  });

  it('archives a corrupt primary before repairing it from the supported backup', async () => {
    const primaryRaw = '{broken';
    const recovered = metadata(3, 'From backup');
    const backupRaw = JSON.stringify(recovered);
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, backupRaw],
    ]);
    const durable = { ...recovered, revision: 4 };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
      ok: true,
      metadata: durable,
      notice: {
        kind: 'repaired',
        recoveredProfiles: 0,
        generatedNames: 0,
        unreadableSaves: 0,
        overflowSaves: 0,
        rollbackFailures: 0,
      },
    });
    expect(registryDurabilityCalls(storage)).toEqual(recoverySequence);
    expect(storage.values.get(PROFILE_METADATA_RECOVERY_KEY)).toBe(JSON.stringify({
      version: 1,
      capturedAt: 1_025,
      primary: primaryRaw,
      backup: backupRaw,
    }));
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(durable));
  });

  it('round-trips deletion intents exactly while repairing from the registry backup', async () => {
    const primaryRaw = '{broken';
    const recovered = {
      version: 2 as const,
      revision: 3,
      profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }],
      activeProfileId: 'alpha',
      deletions: [{
        version: 1 as const,
        deletionId: 'delete-beta-1',
        profileId: 'beta',
        requestedAt: 12,
        phase: 'pending_cleanup' as const,
      }],
    };
    const backupRaw = JSON.stringify(recovered);
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, backupRaw],
    ]);
    const durable = { ...recovered, revision: 4 };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toMatchObject({
      ok: true,
      metadata: durable,
    });
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(durable));
  });

  it('archives dual corruption before reconstructing an exact profile save', async () => {
    const primaryRaw = '{bad';
    const backupRaw = '{also-bad';
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, backupRaw],
      ['FATE_PROFILE_beta', 'valid:beta-save'],
      ['FATE_PROFILE_beta__backups', 'valid:not-a-base-save'],
    ]);
    const baseline: ProfileMetadata = {
      version: 2,
      revision: 0,
      profiles: [{ id: 'beta', name: 'Recovered Profile 1', createdAt: 1_025 }],
      activeProfileId: 'beta',
      deletions: [],
    };
    const durable = { ...baseline, revision: 1 };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
      ok: true,
      metadata: durable,
      notice: {
        kind: 'repaired',
        recoveredProfiles: 1,
        generatedNames: 1,
        unreadableSaves: 0,
        overflowSaves: 0,
        rollbackFailures: 0,
      },
    });
    expect(registryDurabilityCalls(storage)).toEqual(recoverySequence);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(baseline));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(durable));
  });

  it('rereads and copies the latest legacy single-save body during repair execution', async () => {
    const storage = createStorage([[LEGACY_SAVE_KEY, 'valid:planned']]);
    const getItem = storage.getItem;
    let legacyReads = 0;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === LEGACY_SAVE_KEY && ++legacyReads === 2) return 'valid:latest';
      return value;
    };
    const baseline: ProfileMetadata = {
      version: 2,
      revision: 0,
      profiles: [{ id: 'tab-a-profile', name: 'Main Account', createdAt: 1_025 }],
      activeProfileId: 'tab-a-profile',
      deletions: [],
    };
    const durable = { ...baseline, revision: 1 };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
      ok: true,
      metadata: durable,
      notice: null,
    });
    expect(legacyReads).toBe(2);
    expect(storage.values.get('FATE_PROFILE_tab-a-profile')).toBe('valid:latest');
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(baseline));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(durable));
  });

  it('durably initializes a fresh registry without a recovery envelope', async () => {
    const storage = createStorage();
    const baseline: ProfileMetadata = {
      version: 2,
      revision: 0,
      profiles: [{ id: 'tab-a-profile', name: 'Main Account', createdAt: 1_025 }],
      activeProfileId: 'tab-a-profile',
      deletions: [],
    };
    const durable = { ...baseline, revision: 1 };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
      ok: true,
      metadata: durable,
      notice: null,
    });
    expect(registryDurabilityCalls(storage)).toEqual([
      `set:${PROFILE_METADATA_BACKUP_KEY}`,
      `get:${PROFILE_METADATA_BACKUP_KEY}`,
      `set:${PROFILES_KEY}`,
      `get:${PROFILES_KEY}`,
    ]);
    expect(storage.values.has(PROFILE_METADATA_RECOVERY_KEY)).toBe(false);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(baseline));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(durable));
  });

  it.each(['write', 'read', 'mismatch'] as const)(
    'keeps corrupt metadata read-only when recovery-envelope %s verification fails',
    async failure => {
      const primaryRaw = '{broken';
      const recovered = metadata(3, 'Recovered');
      const backupRaw = JSON.stringify(recovered);
      const storage = createStorage([
        [PROFILES_KEY, primaryRaw],
        [PROFILE_METADATA_BACKUP_KEY, backupRaw],
      ]);
      failRecoveryArchive(storage, failure);

      await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
        ok: false,
        reason: 'backup_failed',
        metadata: recovered,
        notice: {
          kind: 'read_only',
          recoveredProfiles: 0,
          generatedNames: 0,
          unreadableSaves: 0,
          overflowSaves: 0,
          rollbackFailures: 0,
        },
      });
      expect(storage.values.get(PROFILES_KEY)).toBe(primaryRaw);
      expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
      expect(registryWrites(storage).filter(call => call !== `set:${PROFILE_METADATA_RECOVERY_KEY}`)).toEqual([]);

      storage.calls.length = 0;
      await expect(mutateProfileMetadata(createDependencies(storage), {
        type: 'rename',
        profileId: 'alpha',
        name: 'Blocked rename',
      })).resolves.toMatchObject({
        ok: false,
        reason: 'backup_failed',
        metadata: recovered,
        notice: { kind: 'read_only' },
      });
      expect(storage.values.get(PROFILES_KEY)).toBe(primaryRaw);
      expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
      expect(registryWrites(storage).filter(call => call !== `set:${PROFILE_METADATA_RECOVERY_KEY}`)).toEqual([]);
    },
  );
});

describe('unsupported profile metadata startup', () => {
  it('archives a future primary but never rewrites either registry copy', async () => {
    const supported = metadata(4, 'Supported');
    const supportedRaw = JSON.stringify(supported);
    const futureRaw = JSON.stringify({ version: 3, revision: 9, futureField: true });
    const primaryRaw = futureRaw;
    const backupRaw = supportedRaw;
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, backupRaw],
    ]);

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
      ok: false,
      reason: 'unsupported_metadata',
      metadata: supported,
      notice: {
        kind: 'unsupported',
        recoveredProfiles: 0,
        generatedNames: 0,
        unreadableSaves: 0,
        overflowSaves: 0,
        rollbackFailures: 0,
      },
    });
    expect(registryDurabilityCalls(storage)).toEqual([
      `set:${PROFILE_METADATA_RECOVERY_KEY}`,
      `get:${PROFILE_METADATA_RECOVERY_KEY}`,
    ]);
    expect(storage.values.get(PROFILE_METADATA_RECOVERY_KEY)).toBe(JSON.stringify({
      version: 1,
      capturedAt: 1_025,
      primary: primaryRaw,
      backup: backupRaw,
    }));
    expect(storage.values.get(PROFILES_KEY)).toBe(primaryRaw);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it.each([
    {
      label: 'version-one primary',
      primaryRaw: JSON.stringify({
        version: 1,
        revision: 4,
        profiles: [{ id: 'alpha', name: 'Supported', createdAt: 1 }],
        activeProfileId: 'alpha',
      }),
    },
    { label: 'version-two primary', primaryRaw: JSON.stringify(metadata(4, 'Supported')) },
  ])('keeps $label read-only when the backup is future-versioned', async ({ primaryRaw }) => {
    const futureRaw = JSON.stringify({ version: 3, opaque: { preserved: true } });
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, futureRaw],
    ]);

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported_metadata',
      notice: { kind: 'unsupported' },
    });
    expect(profileMetadataCopyWrites(storage)).toEqual([]);
    expect(storage.values.get(PROFILES_KEY)).toBe(primaryRaw);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(futureRaw);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it.each([
    {
      label: 'version-one primary',
      primaryRaw: JSON.stringify({
        version: 1,
        revision: 4,
        profiles: [{ id: 'alpha', name: 'Supported', createdAt: 1 }],
        activeProfileId: 'alpha',
      }),
    },
    { label: 'version-two primary', primaryRaw: JSON.stringify(metadata(4, 'Supported')) },
  ])('refuses mutation against $label when the backup is future-versioned', async ({ primaryRaw }) => {
    const futureRaw = JSON.stringify({ version: 3, opaque: { preserved: true } });
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, futureRaw],
    ]);

    await expect(mutateProfileMetadata(createDependencies(storage), {
      type: 'rename',
      profileId: 'alpha',
      name: 'Must not persist',
    })).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported_metadata',
      notice: { kind: 'unsupported' },
    });
    expect(profileMetadataCopyWrites(storage)).toEqual([]);
    expect(storage.values.get(PROFILES_KEY)).toBe(primaryRaw);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(futureRaw);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it('recovers exact save keys in memory while keeping a future registry read-only', async () => {
    const futureRaw = JSON.stringify({ version: 3, opaque: { value: 1 } });
    const storage = createStorage([
      [PROFILES_KEY, futureRaw],
      ['FATE_PROFILE_beta', 'valid:beta'],
      ['FATE_PROFILE_beta__backups', 'valid:not-a-base-save'],
    ]);
    const recovered: ProfileMetadata = {
      version: 2,
      revision: 0,
      profiles: [{ id: 'beta', name: 'Recovered Profile 1', createdAt: 1_025 }],
      activeProfileId: 'beta',
      deletions: [],
    };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
      ok: false,
      reason: 'unsupported_metadata',
      metadata: recovered,
      notice: {
        kind: 'unsupported',
        recoveredProfiles: 1,
        generatedNames: 1,
        unreadableSaves: 0,
        overflowSaves: 0,
        rollbackFailures: 0,
      },
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(futureRaw);
    expect(storage.values.has(PROFILE_METADATA_BACKUP_KEY)).toBe(false);
    expect(registryWrites(storage)).toEqual([`set:${PROFILE_METADATA_RECOVERY_KEY}`]);
  });

  it.each(['write', 'read', 'mismatch'] as const)(
    'retains the recovered in-memory registry when future-version archival %s verification fails',
    async failure => {
      const supported = metadata(4, 'Supported backup');
      const backupRaw = JSON.stringify(supported);
      const futureRaw = JSON.stringify({ version: 3, opaque: { value: 1 } });
      const storage = createStorage([
        [PROFILES_KEY, futureRaw],
        [PROFILE_METADATA_BACKUP_KEY, backupRaw],
      ]);
      failRecoveryArchive(storage, failure);

      await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toEqual({
        ok: false,
        reason: 'backup_failed',
        metadata: supported,
        notice: {
          kind: 'read_only',
          recoveredProfiles: 0,
          generatedNames: 0,
          unreadableSaves: 0,
          overflowSaves: 0,
          rollbackFailures: 0,
        },
      });
      expect(storage.values.get(PROFILES_KEY)).toBe(futureRaw);
      expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
      expect(registryWrites(storage).filter(call => call !== `set:${PROFILE_METADATA_RECOVERY_KEY}`)).toEqual([]);
    },
  );
});

describe('typed profile metadata mutations', () => {
  it('creates against the newest registry observed after lock arbitration', async () => {
    const stale = metadata(1, 'Stale alpha');
    const newer: ProfileMetadata = {
      version: 2,
      revision: 4,
      profiles: [
        { id: 'alpha', name: 'Current alpha', createdAt: 1 },
        { id: 'beta', name: 'Interleaved beta', createdAt: 2 },
      ],
      activeProfileId: 'beta',
      deletions: [],
    };
    const created: Profile = { id: 'gamma', name: 'Gamma', createdAt: 3 };
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(stale)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(metadata(0, 'Old backup'))],
    ]);
    const expected: ProfileMetadata = {
      version: 2,
      revision: 5,
      profiles: [...newer.profiles, created],
      activeProfileId: 'gamma',
      deletions: [],
    };

    await expect(mutateProfileMetadata(
      withNewerPrimaryDuringArbitration(storage, newer),
      { type: 'create', profile: created },
    )).resolves.toEqual({ ok: true, metadata: expected, notice: null });
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(newer));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(expected));
  });

  it('rejects an eleventh profile against the newest locked registry without rewriting', async () => {
    const stale = metadata(1);
    const profiles: Profile[] = Array.from({ length: 10 }, (_, index) => ({
      id: `profile-${index}`,
      name: `Profile ${index}`,
      createdAt: index,
    }));
    const newer: ProfileMetadata = {
      version: 2,
      revision: 4,
      profiles,
      activeProfileId: 'profile-0',
      deletions: [],
    };
    const originalBackup = JSON.stringify(metadata(0, 'Old backup'));
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(stale)],
      [PROFILE_METADATA_BACKUP_KEY, originalBackup],
    ]);

    await expect(mutateProfileMetadata(
      withNewerPrimaryDuringArbitration(storage, newer),
      { type: 'create', profile: { id: 'profile-10', name: 'Profile 10', createdAt: 10 } },
    )).resolves.toEqual({
      ok: false,
      reason: 'max_profiles',
      metadata: newer,
      notice: null,
    });
    expect(registryWrites(storage)).toEqual([]);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(newer));
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(originalBackup);
  });

  it('treats an identical pre-generated create as an idempotent success', async () => {
    const created: Profile = { id: 'beta', name: 'Beta', createdAt: 2 };
    const newest: ProfileMetadata = {
      version: 2,
      revision: 4,
      profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }, created],
      activeProfileId: 'alpha',
      deletions: [],
    };
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(newest)]]);

    await expect(mutateProfileMetadata(
      createDependencies(storage),
      { type: 'create', profile: created },
    )).resolves.toEqual({ ok: true, metadata: newest, notice: null });
    expect(registryWrites(storage)).toEqual([]);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(newest));
  });

  it('rejects a conflicting duplicate create ID without rewriting', async () => {
    const newest = metadata(4);
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(newest)]]);

    await expect(mutateProfileMetadata(createDependencies(storage), {
      type: 'create',
      profile: { id: 'alpha', name: 'Different', createdAt: 99 },
    })).resolves.toEqual({
      ok: false,
      reason: 'invalid_metadata',
      metadata: newest,
      notice: null,
    });
    expect(registryWrites(storage)).toEqual([]);
  });

  it.each([
    {
      label: 'unsafe create ID',
      mutation: { type: 'create', profile: { id: 'unsafe/id', name: 'Unsafe', createdAt: 2 } } as const,
    },
    {
      label: 'unsanitized rename',
      mutation: { type: 'rename', profileId: 'alpha', name: '   ' } as const,
    },
  ])('rejects an $label when the complete candidate is invalid', async ({ mutation }) => {
    const newest = metadata(4);
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(newest)]]);

    await expect(mutateProfileMetadata(createDependencies(storage), mutation)).resolves.toEqual({
      ok: false,
      reason: 'invalid_metadata',
      metadata: newest,
      notice: null,
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(newest));
    expect(storage.values.has(PROFILE_METADATA_BACKUP_KEY)).toBe(false);
    expect(registryWrites(storage)).toEqual([]);
  });

  it('renames against the newest registry without losing an interleaved create', async () => {
    const stale = metadata(1, 'Stale alpha');
    const newer: ProfileMetadata = {
      version: 2,
      revision: 4,
      profiles: [
        { id: 'alpha', name: 'Current alpha', createdAt: 1 },
        { id: 'beta', name: 'Interleaved beta', createdAt: 2 },
      ],
      activeProfileId: 'beta',
      deletions: [],
    };
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(stale)]]);
    const expected: ProfileMetadata = {
      ...newer,
      revision: 5,
      profiles: [
        { id: 'alpha', name: 'Renamed alpha', createdAt: 1 },
        { id: 'beta', name: 'Interleaved beta', createdAt: 2 },
      ],
    };

    await expect(mutateProfileMetadata(
      withNewerPrimaryDuringArbitration(storage, newer),
      { type: 'rename', profileId: 'alpha', name: 'Renamed alpha' },
    )).resolves.toEqual({ ok: true, metadata: expected, notice: null });
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(newer));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(expected));
  });

  it.each([
    { label: 'rename', mutation: { type: 'rename', profileId: 'alpha', name: 'Gone' } as const },
    { label: 'select', mutation: { type: 'select', profileId: 'alpha' } as const },
  ])('returns not_found when $label targets an ID removed before lock acquisition', async ({ mutation }) => {
    const stale: ProfileMetadata = {
      version: 2,
      revision: 1,
      profiles: [
        { id: 'alpha', name: 'Alpha', createdAt: 1 },
        { id: 'beta', name: 'Beta', createdAt: 2 },
      ],
      activeProfileId: 'alpha',
      deletions: [],
    };
    const newer: ProfileMetadata = {
      version: 2,
      revision: 4,
      profiles: [{ id: 'beta', name: 'Beta', createdAt: 2 }],
      activeProfileId: 'beta',
      deletions: [],
    };
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(stale)]]);

    await expect(mutateProfileMetadata(
      withNewerPrimaryDuringArbitration(storage, newer),
      mutation,
    )).resolves.toEqual({
      ok: false,
      reason: 'not_found',
      metadata: newer,
      notice: null,
    });
    expect(registryWrites(storage)).toEqual([]);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(newer));
  });

  it('selects a valid newest profile with exactly one verified revision increment', async () => {
    const newest: ProfileMetadata = {
      version: 2,
      revision: 4,
      profiles: [
        { id: 'alpha', name: 'Alpha', createdAt: 1 },
        { id: 'beta', name: 'Beta', createdAt: 2 },
      ],
      activeProfileId: 'alpha',
      deletions: [],
    };
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(newest)]]);
    const expected: ProfileMetadata = { ...newest, revision: 5, activeProfileId: 'beta' };

    await expect(mutateProfileMetadata(createDependencies(storage), {
      type: 'select',
      profileId: 'beta',
    })).resolves.toEqual({ ok: true, metadata: expected, notice: null });
    expect(storage.calls.filter(call => call === `set:${PROFILE_METADATA_BACKUP_KEY}`)).toHaveLength(1);
    expect(storage.calls.filter(call => call === `set:${PROFILES_KEY}`)).toHaveLength(1);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(newest));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(expected));
  });
});

const deletableMetadata = (activeProfileId: 'alpha' | 'beta' = 'alpha'): ProfileMetadata => ({
  version: 2,
  revision: 7,
  profiles: [
    { id: 'alpha', name: 'Alpha', createdAt: 1 },
    { id: 'beta', name: 'Beta', createdAt: 2 },
  ],
  activeProfileId,
  deletions: [],
});

const alphaOwnedKeys = [
  'FATE_PROFILE_alpha',
  'FATE_PROFILE_alpha__backups',
  'FATE_PROFILE_alpha__exportNag',
  'FATE_PROFILE_alpha__discord',
  'FATE_PROFILE_alpha__discordCursor',
  'fate_features_seen_v1_alpha',
  'FATE_PROFILE_alpha__writer',
] as const;

const profileOwnedRemovalCalls = (storage: TestStorage): string[] =>
  storage.calls.filter(call => alphaOwnedKeys.some(key => call === `remove:${key}`));

type ControlledWait = {
  ownerId: string;
  milliseconds: number;
  resolve: () => void;
};

const createTwoClientTransactionHarness = (
  entries: readonly (readonly [string, string])[],
) => {
  const storage = createStorage(entries);
  const waiting: ControlledWait[] = [];
  const dependencies = (ownerId: string): ProfileTransactionDependencies => ({
    storage,
    ownerId,
    now: () => 1_000,
    wait: milliseconds => new Promise<void>(resolve => {
      waiting.push({ ownerId, milliseconds, resolve });
    }),
    validateGameSave: raw => raw.startsWith('valid:'),
    createProfileId: () => `${ownerId}-profile`,
  });
  const release = async (ownerId: string, milliseconds: number): Promise<void> => {
    const index = waiting.findIndex(wait => (
      wait.ownerId === ownerId && wait.milliseconds === milliseconds
    ));
    expect(index).toBeGreaterThanOrEqual(0);
    const [entry] = waiting.splice(index, 1);
    entry.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { storage, waiting, dependencies, release };
};

const currentStoredRegistry = (storage: TestStorage): ProfileMetadata => {
  const parsed = parseProfileMetadata(storage.values.get(PROFILES_KEY) ?? null);
  expect(parsed.status).toBe('current');
  if (parsed.status !== 'current') throw new Error('Expected a current durable registry');
  return parsed.metadata;
};

const expectUniqueProfileIds = (registry: ProfileMetadata): void => {
  expect(new Set(registry.profiles.map(profile => profile.id)).size)
    .toBe(registry.profiles.length);
};

describe('deterministic two-client profile transactions', () => {
  it('preserves two distinct creates that overlap during lock arbitration', async () => {
    const initial = metadata(0);
    const harness = createTwoClientTransactionHarness([
      [PROFILES_KEY, JSON.stringify(initial)],
    ]);
    const first = mutateProfileMetadata(harness.dependencies('client-a'), {
      type: 'create',
      profile: { id: 'beta', name: 'Beta', createdAt: 2 },
    });
    const second = mutateProfileMetadata(harness.dependencies('client-b'), {
      type: 'create',
      profile: { id: 'gamma', name: 'Gamma', createdAt: 3 },
    });

    expect(harness.waiting.map(wait => wait.ownerId).sort()).toEqual(['client-a', 'client-b']);
    expect(currentStoredRegistry(harness.storage).revision).toBe(0);
    await harness.release('client-a', PROFILE_METADATA_LOCK_ARBITRATION_MS);
    const firstResult = await first;
    await harness.release('client-b', PROFILE_METADATA_LOCK_RETRY_MS);
    await harness.release('client-b', PROFILE_METADATA_LOCK_ARBITRATION_MS);
    const secondResult = await second;

    expect(firstResult).toMatchObject({ ok: true, metadata: { revision: 1 } });
    expect(secondResult).toMatchObject({ ok: true, metadata: { revision: 2 } });
    const durable = currentStoredRegistry(harness.storage);
    expect(durable.revision).toBe(2);
    expect(durable.profiles.map(profile => profile.id)).toEqual(['alpha', 'beta', 'gamma']);
    expectUniqueProfileIds(durable);
  });

  it('preserves a rename that overlaps a distinct create', async () => {
    const initial = metadata(4);
    const harness = createTwoClientTransactionHarness([
      [PROFILES_KEY, JSON.stringify(initial)],
    ]);
    const rename = mutateProfileMetadata(harness.dependencies('client-a'), {
      type: 'rename',
      profileId: 'alpha',
      name: 'Renamed alpha',
    });
    const create = mutateProfileMetadata(harness.dependencies('client-b'), {
      type: 'create',
      profile: { id: 'beta', name: 'Beta', createdAt: 2 },
    });

    expect(harness.waiting).toHaveLength(2);
    await harness.release('client-a', PROFILE_METADATA_LOCK_ARBITRATION_MS);
    await rename;
    await harness.release('client-b', PROFILE_METADATA_LOCK_RETRY_MS);
    await harness.release('client-b', PROFILE_METADATA_LOCK_ARBITRATION_MS);
    await create;

    const durable = currentStoredRegistry(harness.storage);
    expect(durable.revision).toBe(6);
    expect(durable.profiles).toEqual([
      { id: 'alpha', name: 'Renamed alpha', createdAt: 1 },
      { id: 'beta', name: 'Beta', createdAt: 2 },
    ]);
    expectUniqueProfileIds(durable);
  });

  it('returns valid results for overlapping selects and persists a valid active ID', async () => {
    const initial: ProfileMetadata = {
      version: 2,
      revision: 8,
      profiles: [
        { id: 'alpha', name: 'Alpha', createdAt: 1 },
        { id: 'beta', name: 'Beta', createdAt: 2 },
        { id: 'gamma', name: 'Gamma', createdAt: 3 },
      ],
      activeProfileId: 'alpha',
      deletions: [],
    };
    const harness = createTwoClientTransactionHarness([
      [PROFILES_KEY, JSON.stringify(initial)],
    ]);
    const selectBeta = mutateProfileMetadata(harness.dependencies('client-a'), {
      type: 'select',
      profileId: 'beta',
    });
    const selectGamma = mutateProfileMetadata(harness.dependencies('client-b'), {
      type: 'select',
      profileId: 'gamma',
    });

    expect(harness.waiting).toHaveLength(2);
    await harness.release('client-a', PROFILE_METADATA_LOCK_ARBITRATION_MS);
    const betaResult = await selectBeta;
    await harness.release('client-b', PROFILE_METADATA_LOCK_RETRY_MS);
    await harness.release('client-b', PROFILE_METADATA_LOCK_ARBITRATION_MS);
    const gammaResult = await selectGamma;

    expect(betaResult).toMatchObject({ ok: true, metadata: { revision: 9, activeProfileId: 'beta' } });
    expect(gammaResult).toMatchObject({ ok: true, metadata: { revision: 10, activeProfileId: 'gamma' } });
    const durable = currentStoredRegistry(harness.storage);
    expect(durable.revision).toBe(10);
    expect(durable.profiles.some(profile => profile.id === durable.activeProfileId)).toBe(true);
    expectUniqueProfileIds(durable);
  });

  it('blocks behind a crashed lock before expiry and progresses immediately after expiry', async () => {
    const initial = metadata(0);
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(initial)],
      [PROFILE_METADATA_LOCK_KEY, lockRaw('crashed-client', 2_600)],
    ]);
    let now = 1_000;
    const dependencies = (ownerId: string): ProfileTransactionDependencies => ({
      ...createDependencies(storage, ownerId),
      now: () => now,
      wait: async milliseconds => { now += milliseconds; },
    });

    const blocked = await mutateProfileMetadata(dependencies('client-a'), {
      type: 'create',
      profile: { id: 'beta', name: 'Beta', createdAt: 2 },
    });
    expect(blocked).toEqual({ ok: false, reason: 'busy', metadata: null, notice: null });
    expect(currentStoredRegistry(storage)).toEqual(initial);

    now = 2_600;
    const progressed = await mutateProfileMetadata(dependencies('client-b'), {
      type: 'create',
      profile: { id: 'beta', name: 'Beta', createdAt: 2 },
    });
    expect(progressed).toMatchObject({ ok: true, metadata: { revision: 1 } });
    expect(currentStoredRegistry(storage).profiles.map(profile => profile.id))
      .toEqual(['alpha', 'beta']);
  });

  it('reports verification_failed when a lock-ignoring client overwrites primary before readback', async () => {
    const initial = metadata(3);
    const oldClientRegistry = {
      version: 1,
      revision: 40,
      profiles: [
        { id: 'alpha', name: 'Old client alpha', createdAt: 1 },
        { id: 'legacy-client', name: 'Legacy client', createdAt: 40 },
      ],
      activeProfileId: 'legacy-client',
    };
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(initial)]]);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      setItem(key, value);
      if (key === PROFILES_KEY) {
        storage.values.set(PROFILES_KEY, JSON.stringify(oldClientRegistry));
      }
    };

    const result = await mutateProfileMetadata(createDependencies(storage, 'current-client'), {
      type: 'rename',
      profileId: 'alpha',
      name: 'Current client rename',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'verification_failed',
      metadata: initial,
      notice: null,
    });
    expect(parseProfileMetadata(storage.values.get(PROFILES_KEY) ?? null)).toEqual({
      status: 'legacy',
      metadata: { ...oldClientRegistry, version: 2, deletions: [] },
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(oldClientRegistry));
  });
});

const profileSaveWrites = (storage: TestStorage): string[] =>
  storage.calls.filter(call => call.startsWith('set:FATE_PROFILE_'));

const nonLockWrites = (storage: TestStorage): string[] =>
  storage.calls.filter(call => call.startsWith('set:') && call !== `set:${PROFILE_METADATA_LOCK_KEY}`);

describe('profile transaction ownership rechecks', () => {
  it('does not replace a recovery envelope after its owned lock expires during resolution', async () => {
    const recovered = metadata(3, 'Recovered');
    const primaryRaw = '{broken';
    const backupRaw = JSON.stringify(recovered);
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, backupRaw],
      [PROFILE_METADATA_RECOVERY_KEY, 'older-envelope'],
    ]);
    const clock = createClock();
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === PROFILE_METADATA_BACKUP_KEY) clock.set(1_000 + PROFILE_METADATA_LOCK_TTL_MS);
      return value;
    };

    await expect(initializeProfileMetadata(createDependencies(storage, 'tab-a', clock))).resolves.toEqual({
      ok: false,
      reason: 'busy',
      metadata: recovered,
      notice: {
        kind: 'repaired',
        recoveredProfiles: 0,
        generatedNames: 0,
        unreadableSaves: 0,
        overflowSaves: 0,
        rollbackFailures: 0,
      },
    });
    expect(storage.values.get(PROFILE_METADATA_RECOVERY_KEY)).toBe('older-envelope');
    expect(storage.values.get(PROFILES_KEY)).toBe(primaryRaw);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
    expect(nonLockWrites(storage)).toEqual([]);
  });

  it('does not replace a recovery envelope after lock ownership changes during resolution', async () => {
    const recovered = metadata(3, 'Recovered');
    const primaryRaw = '{broken';
    const backupRaw = JSON.stringify(recovered);
    const foreignLock = lockRaw('tab-b', 9_000);
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, backupRaw],
      [PROFILE_METADATA_RECOVERY_KEY, 'older-envelope'],
    ]);
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === PROFILE_METADATA_BACKUP_KEY) {
        storage.values.set(PROFILE_METADATA_LOCK_KEY, foreignLock);
      }
      return value;
    };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toMatchObject({
      ok: false,
      reason: 'busy',
      metadata: recovered,
    });
    expect(storage.values.get(PROFILE_METADATA_RECOVERY_KEY)).toBe('older-envelope');
    expect(storage.values.get(PROFILES_KEY)).toBe(primaryRaw);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
    expect(storage.values.get(PROFILE_METADATA_LOCK_KEY)).toBe(foreignLock);
    expect(nonLockWrites(storage)).toEqual([]);
  });

  it('does not report durable startup success after its lock expires during resolution', async () => {
    const current = metadata(7);
    const raw = JSON.stringify(current);
    const storage = createStorage([[PROFILES_KEY, raw]]);
    const clock = createClock();
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === LEGACY_SAVE_KEY) clock.set(1_000 + PROFILE_METADATA_LOCK_TTL_MS);
      return value;
    };

    await expect(initializeProfileMetadata(createDependencies(storage, 'tab-a', clock))).resolves.toEqual({
      ok: false,
      reason: 'busy',
      metadata: current,
      notice: null,
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
    expect(nonLockWrites(storage)).toEqual([]);
  });

  it('does not report an idempotent create success after lock ownership changes', async () => {
    const created = { id: 'beta', name: 'Beta', createdAt: 2 };
    const current: ProfileMetadata = {
      version: 2,
      revision: 4,
      profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }, created],
      activeProfileId: 'beta',
      deletions: [],
    };
    const raw = JSON.stringify(current);
    const foreignLock = lockRaw('tab-b', 9_000);
    const storage = createStorage([[PROFILES_KEY, raw]]);
    const retried = {
      id: 'beta',
      get name() {
        storage.values.set(PROFILE_METADATA_LOCK_KEY, foreignLock);
        return 'Beta';
      },
      createdAt: 2,
    } as Profile;

    await expect(mutateProfileMetadata(
      createDependencies(storage),
      { type: 'create', profile: retried },
    )).resolves.toEqual({
      ok: false,
      reason: 'busy',
      metadata: current,
      notice: null,
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
    expect(storage.values.get(PROFILE_METADATA_LOCK_KEY)).toBe(foreignLock);
    expect(nonLockWrites(storage)).toEqual([]);
  });

  it('does not copy a legacy save after lock ownership changes during its execution reread', async () => {
    const foreignLock = lockRaw('tab-b', 9_000);
    const storage = createStorage([[LEGACY_SAVE_KEY, 'valid:legacy']]);
    const getItem = storage.getItem;
    let legacyReads = 0;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === LEGACY_SAVE_KEY && ++legacyReads === 2) {
        storage.values.set(PROFILE_METADATA_LOCK_KEY, foreignLock);
      }
      return value;
    };

    await expect(initializeProfileMetadata(createDependencies(storage))).resolves.toMatchObject({
      ok: false,
      reason: 'busy',
    });
    expect(storage.values.has('FATE_PROFILE_tab-a-profile')).toBe(false);
    expect(storage.values.has(PROFILES_KEY)).toBe(false);
    expect(storage.values.has(PROFILE_METADATA_BACKUP_KEY)).toBe(false);
    expect(storage.values.get(PROFILE_METADATA_LOCK_KEY)).toBe(foreignLock);
    expect(profileSaveWrites(storage)).toEqual([]);
  });
});

describe('legacy copy validation ordering', () => {
  it('rejects an invalid generated repair candidate before copying the legacy save', async () => {
    const storage = createStorage([[LEGACY_SAVE_KEY, 'valid:legacy']]);
    const deps = {
      ...createDependencies(storage),
      createProfileId: () => 'unsafe/id',
    };

    await expect(initializeProfileMetadata(deps)).resolves.toMatchObject({
      ok: false,
      reason: 'invalid_metadata',
    });
    expect(storage.values.has('FATE_PROFILE_unsafe/id')).toBe(false);
    expect(storage.values.has(PROFILES_KEY)).toBe(false);
    expect(storage.values.has(PROFILE_METADATA_BACKUP_KEY)).toBe(false);
    expect(profileSaveWrites(storage)).toEqual([]);
  });

  it.each([
    {
      label: 'create',
      mutation: {
        type: 'create',
        profile: { id: 'unsafe/id', name: 'Unsafe', createdAt: 2 },
      } as const,
    },
    {
      label: 'rename',
      mutation: {
        type: 'rename',
        profileId: 'tab-a-profile',
        name: '   ',
      } as const,
    },
  ])('rejects an invalid $label candidate before copying a valid legacy save', async ({ mutation }) => {
    const storage = createStorage([[LEGACY_SAVE_KEY, 'valid:legacy']]);

    await expect(mutateProfileMetadata(createDependencies(storage), mutation)).resolves.toMatchObject({
      ok: false,
      reason: 'invalid_metadata',
    });
    expect(storage.values.has('FATE_PROFILE_tab-a-profile')).toBe(false);
    expect(storage.values.has(PROFILES_KEY)).toBe(false);
    expect(storage.values.has(PROFILE_METADATA_BACKUP_KEY)).toBe(false);
    expect(profileSaveWrites(storage)).toEqual([]);
  });
});

const abortableDependencies = (
  storage: TestStorage,
  shouldAbort: () => boolean,
) => ({
  ...createDependencies(storage),
  shouldAbort,
});

describe('profile transaction cancellation boundaries', () => {
  it('aborts after the locked reread before replacing a recovery envelope', async () => {
    const recovered = metadata(3, 'Recovered');
    const primaryRaw = '{broken';
    const backupRaw = JSON.stringify(recovered);
    const storage = createStorage([
      [PROFILES_KEY, primaryRaw],
      [PROFILE_METADATA_BACKUP_KEY, backupRaw],
      [PROFILE_METADATA_RECOVERY_KEY, 'existing-recovery'],
    ]);
    let aborted = false;
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === LEGACY_SAVE_KEY) aborted = true;
      return value;
    };

    await expect(initializeProfileMetadata(
      abortableDependencies(storage, () => aborted),
    )).resolves.toMatchObject({ ok: false, reason: 'busy' });

    expect(storage.values.get(PROFILE_METADATA_RECOVERY_KEY)).toBe('existing-recovery');
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(backupRaw);
    expect(storage.values.get(PROFILES_KEY)).toBe(primaryRaw);
    expect(nonLockWrites(storage)).toEqual([]);
  });

  it('does not report no-write success after cancellation during the locked reread', async () => {
    const current = metadata(7);
    const raw = JSON.stringify(current);
    const storage = createStorage([[PROFILES_KEY, raw]]);
    let aborted = false;
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === LEGACY_SAVE_KEY) aborted = true;
      return value;
    };

    await expect(initializeProfileMetadata(
      abortableDependencies(storage, () => aborted),
    )).resolves.toEqual({
      ok: false,
      reason: 'busy',
      metadata: current,
      notice: null,
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
    expect(nonLockWrites(storage)).toEqual([]);
  });

  it('aborts after the legacy execution reread before copying the save', async () => {
    const storage = createStorage([[LEGACY_SAVE_KEY, 'valid:legacy']]);
    let aborted = false;
    let legacyReads = 0;
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === LEGACY_SAVE_KEY && ++legacyReads === 2) aborted = true;
      return value;
    };

    await expect(initializeProfileMetadata(
      abortableDependencies(storage, () => aborted),
    )).resolves.toMatchObject({ ok: false, reason: 'busy' });
    expect(storage.values.has('FATE_PROFILE_tab-a-profile')).toBe(false);
    expect(storage.values.has(PROFILE_METADATA_BACKUP_KEY)).toBe(false);
    expect(storage.values.has(PROFILES_KEY)).toBe(false);
    expect(profileSaveWrites(storage)).toEqual([]);
  });

  it('aborts immediately before the metadata backup write', async () => {
    const current = metadata(7);
    const raw = JSON.stringify(current);
    const storage = createStorage([
      [PROFILES_KEY, raw],
      [PROFILE_METADATA_BACKUP_KEY, 'existing-backup'],
    ]);
    let sourcesRead = false;
    let aborted = false;
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (key === LEGACY_SAVE_KEY) sourcesRead = true;
      if (key === PROFILE_METADATA_LOCK_KEY && sourcesRead) aborted = true;
      return value;
    };

    await expect(mutateProfileMetadata(
      abortableDependencies(storage, () => aborted),
      { type: 'rename', profileId: 'alpha', name: 'Renamed' },
    )).resolves.toMatchObject({ ok: false, reason: 'busy' });
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe('existing-backup');
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
  });

  it('aborts immediately before the metadata primary write', async () => {
    const current = metadata(7);
    const raw = JSON.stringify(current);
    const storage = createStorage([
      [PROFILES_KEY, raw],
      [PROFILE_METADATA_BACKUP_KEY, raw],
    ]);
    let backupVerified = false;
    let aborted = false;
    const getItem = storage.getItem;
    storage.getItem = key => {
      const value = getItem(key);
      if (
        key === PROFILE_METADATA_BACKUP_KEY
        && storage.calls.includes(`set:${PROFILE_METADATA_BACKUP_KEY}`)
      ) backupVerified = true;
      if (key === PROFILE_METADATA_LOCK_KEY && backupVerified) aborted = true;
      return value;
    };

    await expect(mutateProfileMetadata(
      abortableDependencies(storage, () => aborted),
      { type: 'rename', profileId: 'alpha', name: 'Renamed' },
    )).resolves.toMatchObject({ ok: false, reason: 'busy' });
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(raw);
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
  });

});

describe('durable profile deletion tombstones', () => {
  const intent = {
    version: 1 as const,
    deletionId: 'delete-alpha-1',
    profileId: 'alpha',
    requestedAt: 1_000,
    phase: 'pending_cleanup' as const,
  };

  const pendingMetadata = (): ProfileMetadata => ({
    version: 2,
    revision: 5,
    profiles: [{ id: 'beta', name: 'Beta', createdAt: 2 }],
    activeProfileId: 'beta',
    deletions: [intent],
  });

  const emptyRecoveryRepository = (): (() => Promise<RecoveryRepository>) => {
    const databaseName = `profile-delete-empty-${Date.now()}-${Math.random()}`;
    return () => openRecoveryDatabase({ databaseName });
  };

  it('commits the tombstone before cleanup and never rolls visibility back when cleanup fails', async () => {
    const previous: ProfileMetadata = {
      version: 2,
      revision: 4,
      profiles: [
        { id: 'alpha', name: 'Alpha', createdAt: 1 },
        { id: 'beta', name: 'Beta', createdAt: 2 },
      ],
      activeProfileId: 'alpha',
      deletions: [],
    };
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(previous)],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
      ['FATE_PROFILE_beta', 'valid:beta'],
    ]);
    let metadataObservedByCleanup: ProfileMetadata | null = null;
    const deleteProfileData = vi.fn(async () => {
      metadataObservedByCleanup = JSON.parse(storage.values.get(PROFILES_KEY) ?? 'null') as ProfileMetadata;
      return { stored: false as const, reason: 'storage_unavailable' as const };
    });
    const dependencies = {
      ...createDependencies(storage),
      createDeletionId: () => 'delete-alpha-1',
      openRecoveryRepository: async () => ({
        deleteProfileData,
        close: vi.fn(),
      } as unknown as RecoveryRepository),
    };

    const result = await mutateProfileMetadata(dependencies, {
      type: 'delete',
      profileId: 'alpha',
    });

    expect(metadataObservedByCleanup).toEqual({
      version: 2,
      revision: 5,
      profiles: [{ id: 'beta', name: 'Beta', createdAt: 2 }],
      activeProfileId: 'beta',
      deletions: [{
        version: 1,
        deletionId: 'delete-alpha-1',
        profileId: 'alpha',
        requestedAt: 1_025,
        phase: 'pending_cleanup',
      }],
    });
    expect(result).toMatchObject({
      ok: true,
      metadata: metadataObservedByCleanup,
      deleteDetails: {
        removedEntries: 0,
        removalFailures: 0,
        rollbackFailures: 0,
        cleanupPending: true,
        deletionId: 'delete-alpha-1',
      },
    });
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('valid:alpha');
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
  });

  it('notifies the caller immediately after the tombstone commit while cleanup is still pending', async () => {
    const previous = deletableMetadata();
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(previous)]]);
    const repository = deferred<RecoveryRepository>();
    const observed: ProfileMetadata[] = [];
    let settled = false;
    const deletion = mutateProfileMetadata({
      ...createDependencies(storage),
      createDeletionId: () => 'delete-alpha-1',
      onProfileDeletionCommitted: committed => {
        observed.push(committed);
        expect(JSON.parse(storage.values.get(PROFILES_KEY) ?? 'null')).toEqual(committed);
      },
      openRecoveryRepository: () => repository.promise,
    }, { type: 'delete', profileId: 'alpha' }).finally(() => { settled = true; });

    await vi.waitFor(() => expect(observed).toHaveLength(1));

    expect(settled).toBe(false);
    expect(observed[0].profiles.map(profile => profile.id)).toEqual(['beta']);
    expect(observed[0].deletions).toEqual([
      expect.objectContaining({ profileId: 'alpha', phase: 'pending_cleanup' }),
    ]);

    repository.resolve({
      deleteProfileData: vi.fn(async () => ({ stored: false, reason: 'storage_unavailable' })),
      close: vi.fn(),
    } as unknown as RecoveryRepository);
    await deletion;
  });

  it('changes no profile-owned or IndexedDB data when the tombstone primary cannot be verified', async () => {
    const previous = deletableMetadata();
    const raw = JSON.stringify(previous);
    const storage = createStorage([
      [PROFILES_KEY, raw],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
      ['FATE_PROFILE_alpha__backups', 'backup:alpha'],
    ]);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === PROFILES_KEY) throw new DOMException('full', 'QuotaExceededError');
      setItem(key, value);
    };
    const openRecoveryRepository = vi.fn();
    const onProfileDeletionCommitted = vi.fn();

    await expect(mutateProfileMetadata({
      ...createDependencies(storage),
      createDeletionId: () => 'delete-alpha-1',
      onProfileDeletionCommitted,
      openRecoveryRepository,
    }, { type: 'delete', profileId: 'alpha' })).resolves.toMatchObject({
      ok: false,
      reason: 'verification_failed',
      metadata: previous,
      deleteDetails: {
        removedEntries: 0,
        removalFailures: 0,
        rollbackFailures: 0,
        cleanupPending: false,
        deletionId: null,
      },
    });
    expect(onProfileDeletionCommitted).not.toHaveBeenCalled();
    expect(openRecoveryRepository).not.toHaveBeenCalled();
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('valid:alpha');
    expect(storage.values.get('FATE_PROFILE_alpha__backups')).toBe('backup:alpha');
    expect(storage.values.has('FATE_PROFILE_alpha__writer')).toBe(false);
  });

  it('releases metadata authority before invoking the cleanup worker', async () => {
    const previous = deletableMetadata();
    const storage = createStorage([[PROFILES_KEY, JSON.stringify(previous)]]);
    let lockWasHeldDuringCleanup = false;
    const deleteProfileData = vi.fn(async () => {
      lockWasHeldDuringCleanup = storage.values.has(PROFILE_METADATA_LOCK_KEY);
      return { stored: false as const, reason: 'storage_unavailable' as const };
    });

    await mutateProfileMetadata({
      ...createDependencies(storage),
      createDeletionId: () => 'delete-alpha-1',
      openRecoveryRepository: async () => ({
        deleteProfileData,
        close: vi.fn(),
      } as unknown as RecoveryRepository),
    }, { type: 'delete', profileId: 'alpha' });

    expect(deleteProfileData).toHaveBeenCalledTimes(1);
    expect(lockWasHeldDuringCleanup).toBe(false);
  });

  it('retains the committed tombstone when production dependencies provide no recovery repository', async () => {
    const previous = deletableMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(previous)],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
      ['FATE_PROFILE_beta', 'valid:beta'],
    ]);

    const result = await mutateProfileMetadata({
      ...createDependencies(storage),
      createDeletionId: () => 'delete-alpha-1',
    }, { type: 'delete', profileId: 'alpha' });

    expect(result).toEqual({
      ok: true,
      metadata: {
        version: 2,
        revision: 8,
        profiles: [previous.profiles[1]],
        activeProfileId: 'beta',
        deletions: [{ ...intent, requestedAt: 1_025 }],
      },
      notice: null,
      deleteDetails: {
        removedEntries: 0,
        removalFailures: 0,
        rollbackFailures: 0,
        cleanupPending: true,
        deletionId: 'delete-alpha-1',
      },
    });
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('valid:alpha');
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
    expect(storage.values.has('FATE_PROFILE_alpha__writer')).toBe(false);
  });

  it.each([
    {
      label: 'recovery database open failure',
      openRecoveryRepository: () => Promise.reject(new Error('IndexedDB blocked')),
    },
    {
      label: 'repository without profile deletion support',
      openRecoveryRepository: async () => ({ close: vi.fn() } as unknown as RecoveryRepository),
    },
  ])('retains the intent after $label', async ({ openRecoveryRepository }) => {
    const current = pendingMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(current)],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
    ]);

    await expect(resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'cleanup-tab'),
      openRecoveryRepository,
    })).resolves.toEqual({
      status: 'cleanup_pending',
      reason: 'storage_unavailable',
      metadata: current,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(current));
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('valid:alpha');
    expect(storage.values.has('FATE_PROFILE_alpha__writer')).toBe(false);
  });

  it('keeps the tombstone and releases its lease when cancellation arrives after commit', async () => {
    const previous = deletableMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(previous)],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
    ]);
    let aborted = false;
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      setItem(key, value);
      if (key === PROFILES_KEY) {
        const parsed = parseProfileMetadata(value);
        if (parsed.status === 'current' && parsed.metadata.deletions.length === 1) aborted = true;
      }
    };
    const openRecoveryRepository = vi.fn();

    const result = await mutateProfileMetadata({
      ...createDependencies(storage),
      createDeletionId: () => 'delete-alpha-1',
      shouldAbort: () => aborted,
      openRecoveryRepository,
    }, { type: 'delete', profileId: 'alpha' });

    expect(result).toMatchObject({
      ok: true,
      metadata: {
        revision: 8,
        profiles: [previous.profiles[1]],
        activeProfileId: 'beta',
        deletions: [{ ...intent, requestedAt: 1_025 }],
      },
      deleteDetails: {
        cleanupPending: true,
        deletionId: 'delete-alpha-1',
      },
    });
    expect(openRecoveryRepository).not.toHaveBeenCalled();
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('valid:alpha');
    expect(storage.values.has('FATE_PROFILE_alpha__writer')).toBe(false);
  });

  it('finalizes a successful cleanup and clears the deletion intent', async () => {
    const previous = deletableMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(previous)],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
      ['FATE_PROFILE_beta', 'valid:beta'],
    ]);

    const result = await mutateProfileMetadata({
      ...createDependencies(storage),
      createDeletionId: () => 'delete-alpha-1',
      openRecoveryRepository: emptyRecoveryRepository(),
    }, { type: 'delete', profileId: 'alpha' });

    expect(result).toEqual({
      ok: true,
      metadata: {
        version: 2,
        revision: 9,
        profiles: [previous.profiles[1]],
        activeProfileId: 'beta',
        deletions: [],
      },
      notice: null,
      deleteDetails: {
        removedEntries: 2,
        removalFailures: 0,
        rollbackFailures: 0,
        cleanupPending: false,
        deletionId: null,
      },
    });
    expect(storage.values.has('FATE_PROFILE_alpha')).toBe(false);
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
  });

  it('returns cleanup pending after one bounded metadata-lock attempt', async () => {
    const current = pendingMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_LOCK_KEY, lockRaw('foreign-tab', 99_000)],
    ]);
    const clock = createClock();

    const result = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'cleanup-tab', clock),
      openRecoveryRepository: emptyRecoveryRepository(),
    });

    expect(result).toEqual({
      status: 'cleanup_pending',
      reason: 'busy',
      metadata: current,
      removedEntries: 1,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(clock.now()).toBe(1_000 + PROFILE_METADATA_LOCK_TIMEOUT_MS);
    expect(clock.wait).toHaveBeenCalledTimes(
      PROFILE_METADATA_LOCK_TIMEOUT_MS / PROFILE_METADATA_LOCK_RETRY_MS,
    );
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(current));
    expect(storage.values.has('FATE_PROFILE_alpha__writer')).toBe(false);
  });

  it('does not remove profile data until the tombstone backup is verified', async () => {
    const current = pendingMetadata();
    const staleBackup = deletableMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(staleBackup)],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
    ]);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === PROFILE_METADATA_BACKUP_KEY) {
        throw new DOMException('full', 'QuotaExceededError');
      }
      setItem(key, value);
    };
    const openRecoveryRepository = vi.fn();

    const result = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'cleanup-tab'),
      openRecoveryRepository,
    });

    expect(result).toEqual({
      status: 'cleanup_pending',
      reason: 'storage_unavailable',
      metadata: current,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(openRecoveryRepository).not.toHaveBeenCalled();
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('valid:alpha');
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(current));
  });

  it('uses one metadata-authority acquisition to repair a stale tombstone backup, then resumes later', async () => {
    const current = pendingMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(deletableMetadata())],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
      ['FATE_PROFILE_beta', 'valid:beta'],
    ]);
    const openRecoveryRepository = vi.fn();

    const first = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'repair-worker'),
      openRecoveryRepository,
    });

    expect(first).toEqual({
      status: 'cleanup_pending',
      reason: 'busy',
      metadata: current,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(current));
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('valid:alpha');
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
    expect(openRecoveryRepository).not.toHaveBeenCalled();
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
    expect(storage.values.has('FATE_PROFILE_alpha__writer')).toBe(false);

    const second = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'cleanup-worker'),
      openRecoveryRepository: emptyRecoveryRepository(),
    });

    expect(second).toEqual({
      status: 'completed',
      metadata: {
        ...current,
        revision: 6,
        deletions: [],
      },
      removedEntries: 2,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(storage.values.has('FATE_PROFILE_alpha')).toBe(false);
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
  });

  it('resumes in a new worker after cancellation following the IndexedDB commit', async () => {
    const current = pendingMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(current)],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
      ['FATE_PROFILE_beta', 'valid:beta'],
    ]);
    const databaseName = `profile-delete-resume-${Date.now()}-${Math.random()}`;
    const setupRepository = await openRecoveryDatabase({ databaseName });
    const authorize = () => ({ ok: true as const });
    await setupRepository.putHead({
      profileId: 'alpha',
      persistenceRevision: 3,
      runId: 'run-alpha',
      runRevision: 3,
      capturedAt: 3,
      checksum: 'a'.repeat(64),
      data: 'valid:alpha',
    }, authorize);
    await setupRepository.putHead({
      profileId: 'beta',
      persistenceRevision: 4,
      runId: 'run-beta',
      runRevision: 4,
      capturedAt: 4,
      checksum: 'b'.repeat(64),
      data: 'valid:beta',
    }, authorize);
    setupRepository.close();

    let aborted = false;
    const first = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'first-worker'),
      shouldAbort: () => aborted,
      openRecoveryRepository: async () => {
        const repository = await openRecoveryDatabase({ databaseName });
        const deleteProfileData = repository.deleteProfileData?.bind(repository);
        if (deleteProfileData === undefined) throw new Error('Profile cleanup is unavailable.');
        repository.deleteProfileData = async (...args) => {
          const result = await deleteProfileData(...args);
          aborted = true;
          return result;
        };
        return repository;
      },
    });

    expect(first).toEqual({
      status: 'cleanup_pending',
      reason: 'busy',
      metadata: current,
      removedEntries: 1,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('valid:alpha');
    expect(storage.values.has('FATE_PROFILE_alpha__writer')).toBe(false);
    const afterFirst = await openRecoveryDatabase({ databaseName });
    await expect(afterFirst.getHead('alpha')).resolves.toBeNull();
    await expect(afterFirst.getHead('beta')).resolves.toMatchObject({ profileId: 'beta' });
    afterFirst.close();

    const second = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'second-worker'),
      openRecoveryRepository: () => openRecoveryDatabase({ databaseName }),
    });

    expect(second).toEqual({
      status: 'completed',
      metadata: {
        ...current,
        revision: 6,
        deletions: [],
      },
      removedEntries: 2,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(storage.values.has('FATE_PROFILE_alpha')).toBe(false);
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
    expect(storage.values.has('FATE_PROFILE_alpha__writer')).toBe(false);
  });

  it('retains the intent and reports readback failures without restoring removed keys', async () => {
    const current = pendingMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(current)],
      ['FATE_PROFILE_alpha', 'valid:alpha'],
      ['FATE_PROFILE_alpha__backups', 'backup:alpha'],
    ]);
    const removeItem = storage.removeItem;
    storage.removeItem = key => {
      removeItem(key);
      if (key === 'FATE_PROFILE_alpha') storage.values.set(key, 'late-writer-value');
    };

    const result = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'cleanup-tab'),
      openRecoveryRepository: emptyRecoveryRepository(),
    });

    expect(result).toEqual({
      status: 'cleanup_pending',
      reason: 'storage_unavailable',
      metadata: current,
      removedEntries: 1,
      removalFailures: 1,
      rollbackFailures: 0,
    });
    expect(storage.values.get('FATE_PROFILE_alpha')).toBe('late-writer-value');
    expect(storage.values.has('FATE_PROFILE_alpha__backups')).toBe(false);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(current));
    expect(profileOwnedKeys('beta').some(key => storage.calls.includes(`remove:${key}`))).toBe(false);
  });

  it.each([
    'remove_exception',
    'readback_exception',
    'reappearance',
  ] as const)('retains the intent when deletion-lease cleanup has a $mode failure', async mode => {
    const current = pendingMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(current)],
      ['FATE_PROFILE_beta', 'valid:beta'],
    ]);
    const leaseKey = writerLeaseKey('FATE_PROFILE_alpha');
    const getItem = storage.getItem;
    const removeItem = storage.removeItem;
    let leaseRemovalAttempted = false;
    storage.getItem = key => {
      if (key === leaseKey && leaseRemovalAttempted && mode === 'readback_exception') {
        throw new DOMException('blocked', 'SecurityError');
      }
      return getItem(key);
    };
    storage.removeItem = key => {
      if (key !== leaseKey) {
        removeItem(key);
        return;
      }
      leaseRemovalAttempted = true;
      if (mode === 'remove_exception') {
        throw new DOMException('blocked', 'SecurityError');
      }
      const raw = storage.values.get(key) ?? null;
      removeItem(key);
      if (mode === 'reappearance' && raw !== null) storage.values.set(key, raw);
    };

    const result = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'cleanup-tab'),
      openRecoveryRepository: emptyRecoveryRepository(),
    });

    expect(result).toEqual({
      status: 'cleanup_pending',
      reason: 'storage_unavailable',
      metadata: current,
      removedEntries: 0,
      removalFailures: 1,
      rollbackFailures: 0,
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(current));
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
  });

  it('counts a deletion lease as removed when removeItem throws after deleting it', async () => {
    const current = pendingMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(current)],
      ['FATE_PROFILE_beta', 'valid:beta'],
    ]);
    const leaseKey = writerLeaseKey('FATE_PROFILE_alpha');
    const removeItem = storage.removeItem;
    storage.removeItem = key => {
      removeItem(key);
      if (key === leaseKey) throw new DOMException('late exception', 'SecurityError');
    };

    const result = await resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'cleanup-tab'),
      openRecoveryRepository: emptyRecoveryRepository(),
    });

    expect(result).toEqual({
      status: 'completed',
      metadata: {
        ...current,
        revision: 6,
        deletions: [],
      },
      removedEntries: 1,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(storage.values.has(leaseKey)).toBe(false);
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
  });

  it('treats an already-finalized remote intent as an idempotent completion', async () => {
    const finalized: ProfileMetadata = {
      ...pendingMetadata(),
      revision: 6,
      deletions: [],
    };
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(finalized)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(finalized)],
      ['FATE_PROFILE_beta', 'valid:beta'],
    ]);
    const openRecoveryRepository = vi.fn();

    await expect(resumeProfileDeletion(intent, {
      ...createDependencies(storage, 'late-worker'),
      openRecoveryRepository,
    })).resolves.toEqual({
      status: 'completed',
      metadata: finalized,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    expect(openRecoveryRepository).not.toHaveBeenCalled();
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('valid:beta');
  });
});
