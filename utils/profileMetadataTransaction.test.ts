import { describe, expect, it, vi } from 'vitest';
import type { Profile, ProfileMetadata } from '../types';
import {
  acquireProfileMetadataLock,
  commitProfileMetadataCandidate,
  initializeProfileMetadata,
  mutateProfileMetadata,
  PROFILE_METADATA_LOCK_ARBITRATION_MS,
  PROFILE_METADATA_LOCK_KEY,
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
} from './profileMetadata';

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
  version: 1,
  revision,
  profiles: [{ id: 'alpha', name, createdAt: 1 }],
  activeProfileId: 'alpha',
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
      version: 1,
      revision: 0,
      profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }],
      activeProfileId: 'alpha',
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
      version: 1,
      revision: 0,
      profiles: [{ id: 'beta', name: 'Recovered Profile 1', createdAt: 1_025 }],
      activeProfileId: 'beta',
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
      version: 1,
      revision: 0,
      profiles: [{ id: 'tab-a-profile', name: 'Main Account', createdAt: 1_025 }],
      activeProfileId: 'tab-a-profile',
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
      version: 1,
      revision: 0,
      profiles: [{ id: 'tab-a-profile', name: 'Main Account', createdAt: 1_025 }],
      activeProfileId: 'tab-a-profile',
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
  it.each([
    { source: 'primary', primaryFuture: true },
    { source: 'backup', primaryFuture: false },
  ])('archives a future $source but never rewrites either registry copy', async ({ primaryFuture }) => {
    const supported = metadata(4, 'Supported');
    const supportedRaw = JSON.stringify(supported);
    const futureRaw = JSON.stringify({ version: 2, revision: 9, futureField: true });
    const primaryRaw = primaryFuture ? futureRaw : supportedRaw;
    const backupRaw = primaryFuture ? supportedRaw : futureRaw;
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

  it('recovers exact save keys in memory while keeping a future registry read-only', async () => {
    const futureRaw = JSON.stringify({ version: 2, opaque: { value: 1 } });
    const storage = createStorage([
      [PROFILES_KEY, futureRaw],
      ['FATE_PROFILE_beta', 'valid:beta'],
      ['FATE_PROFILE_beta__backups', 'valid:not-a-base-save'],
    ]);
    const recovered: ProfileMetadata = {
      version: 1,
      revision: 0,
      profiles: [{ id: 'beta', name: 'Recovered Profile 1', createdAt: 1_025 }],
      activeProfileId: 'beta',
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
      const futureRaw = JSON.stringify({ version: 2, opaque: { value: 1 } });
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
      version: 1,
      revision: 4,
      profiles: [
        { id: 'alpha', name: 'Current alpha', createdAt: 1 },
        { id: 'beta', name: 'Interleaved beta', createdAt: 2 },
      ],
      activeProfileId: 'beta',
    };
    const created: Profile = { id: 'gamma', name: 'Gamma', createdAt: 3 };
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(stale)],
      [PROFILE_METADATA_BACKUP_KEY, JSON.stringify(metadata(0, 'Old backup'))],
    ]);
    const expected: ProfileMetadata = {
      version: 1,
      revision: 5,
      profiles: [...newer.profiles, created],
      activeProfileId: 'gamma',
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
      version: 1,
      revision: 4,
      profiles,
      activeProfileId: 'profile-0',
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
      version: 1,
      revision: 4,
      profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }, created],
      activeProfileId: 'alpha',
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
      version: 1,
      revision: 4,
      profiles: [
        { id: 'alpha', name: 'Current alpha', createdAt: 1 },
        { id: 'beta', name: 'Interleaved beta', createdAt: 2 },
      ],
      activeProfileId: 'beta',
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
      version: 1,
      revision: 1,
      profiles: [
        { id: 'alpha', name: 'Alpha', createdAt: 1 },
        { id: 'beta', name: 'Beta', createdAt: 2 },
      ],
      activeProfileId: 'alpha',
    };
    const newer: ProfileMetadata = {
      version: 1,
      revision: 4,
      profiles: [{ id: 'beta', name: 'Beta', createdAt: 2 }],
      activeProfileId: 'beta',
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
      version: 1,
      revision: 4,
      profiles: [
        { id: 'alpha', name: 'Alpha', createdAt: 1 },
        { id: 'beta', name: 'Beta', createdAt: 2 },
      ],
      activeProfileId: 'alpha',
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
  version: 1,
  revision: 7,
  profiles: [
    { id: 'alpha', name: 'Alpha', createdAt: 1 },
    { id: 'beta', name: 'Beta', createdAt: 2 },
  ],
  activeProfileId,
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

describe('coordinated profile deletion', () => {
  it.each([
    {
      label: 'missing profile',
      current: deletableMetadata(),
      profileId: 'missing',
      reason: 'not_found',
      extraEntries: [] as Array<readonly [string, string]>,
    },
    {
      label: 'last profile',
      current: metadata(7),
      profileId: 'alpha',
      reason: 'last_profile',
      extraEntries: [] as Array<readonly [string, string]>,
    },
    {
      label: 'profile with an unexpired writer lease',
      current: deletableMetadata(),
      profileId: 'alpha',
      reason: 'profile_in_use',
      extraEntries: [[
        'FATE_PROFILE_alpha__writer',
        JSON.stringify({ version: 1, ownerId: 'game-tab', expiresAt: 9_000 }),
      ]] as Array<readonly [string, string]>,
    },
  ] as const)('rejects a $label without removing profile data or changing metadata', async ({
    current,
    profileId,
    reason,
    extraEntries,
  }) => {
    const raw = JSON.stringify(current);
    const originalBackup = JSON.stringify(metadata(6, 'Earlier backup'));
    const storage = createStorage([
      [PROFILES_KEY, raw],
      [PROFILE_METADATA_BACKUP_KEY, originalBackup],
      ...extraEntries,
    ]);

    await expect(mutateProfileMetadata(createDependencies(storage), {
      type: 'delete',
      profileId,
    })).resolves.toEqual({
      ok: false,
      reason,
      metadata: current,
      notice: null,
    });
    expect(profileOwnedRemovalCalls(storage)).toEqual([]);
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(originalBackup);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it.each([
    ['expired', JSON.stringify({ version: 1, ownerId: 'game-tab', expiresAt: 1_000 })],
    ['malformed', '{broken'],
  ])('does not let an %s writer lease block deletion', async (_label, leaseRaw) => {
    const current = deletableMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      ...alphaOwnedKeys.map(key => [key, `secret:${key}`] as const),
      ['FATE_PROFILE_alpha__writer', leaseRaw],
    ]);
    const expected: ProfileMetadata = {
      version: 1,
      revision: 8,
      profiles: [current.profiles[1]],
      activeProfileId: 'beta',
    };

    await expect(mutateProfileMetadata(createDependencies(storage), {
      type: 'delete',
      profileId: 'alpha',
    })).resolves.toEqual({
      ok: true,
      metadata: expected,
      notice: null,
      deleteDetails: { removedEntries: 7, removalFailures: 0, rollbackFailures: 0 },
    });
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(expected));
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it('verifies the previous registry backup before removing only the seven owned keys', async () => {
    const current = deletableMetadata();
    const oldBackup = JSON.stringify(metadata(4, 'Old backup'));
    const unrelatedEntries = [
      ['FATE_PROFILE_beta', 'beta-save'],
      ['FATE_PROFILE_alpha_misleading', 'misleading'],
      ['FATE_PROFILES_custom', 'unregistered'],
    ] as const;
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      [PROFILE_METADATA_BACKUP_KEY, oldBackup],
      ...alphaOwnedKeys.map(key => [key, `secret:${key}`] as const),
      ...unrelatedEntries,
    ]);
    const expected: ProfileMetadata = {
      version: 1,
      revision: 8,
      profiles: [current.profiles[1]],
      activeProfileId: 'beta',
    };

    await expect(mutateProfileMetadata(createDependencies(storage), {
      type: 'delete',
      profileId: 'alpha',
    })).resolves.toEqual({
      ok: true,
      metadata: expected,
      notice: null,
      deleteDetails: { removedEntries: 7, removalFailures: 0, rollbackFailures: 0 },
    });

    const backupWrite = storage.calls.indexOf(`set:${PROFILE_METADATA_BACKUP_KEY}`);
    const backupReadback = storage.calls.indexOf(`get:${PROFILE_METADATA_BACKUP_KEY}`, backupWrite);
    const firstRemoval = storage.calls.indexOf(`remove:${alphaOwnedKeys[0]}`);
    expect(backupWrite).toBeGreaterThan(-1);
    expect(backupReadback).toBeGreaterThan(backupWrite);
    expect(firstRemoval).toBeGreaterThan(backupReadback);
    expect(profileOwnedRemovalCalls(storage)).toEqual(alphaOwnedKeys.map(key => `remove:${key}`));
    for (const key of alphaOwnedKeys) expect(storage.values.has(key)).toBe(false);
    for (const [key, value] of unrelatedEntries) expect(storage.values.get(key)).toBe(value);
    expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(current));
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(expected));
  });

  it('keeps profile data untouched when the safety backup cannot be verified', async () => {
    const current = deletableMetadata();
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      ...alphaOwnedKeys.map(key => [key, `secret:${key}`] as const),
    ]);
    const getItem = storage.getItem;
    storage.getItem = key => key === PROFILE_METADATA_BACKUP_KEY
      ? (storage.calls.push(`get:${key}`), '{mismatch')
      : getItem(key);

    await expect(mutateProfileMetadata(createDependencies(storage), {
      type: 'delete',
      profileId: 'alpha',
    })).resolves.toEqual({
      ok: false,
      reason: 'backup_failed',
      metadata: current,
      notice: null,
      deleteDetails: { removedEntries: 0, removalFailures: 0, rollbackFailures: 0 },
    });
    expect(profileOwnedRemovalCalls(storage)).toEqual([]);
    for (const key of alphaOwnedKeys) expect(storage.values.get(key)).toBe(`secret:${key}`);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(current));
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it('counts removal failures without touching unrelated data or leaking storage contents', async () => {
    const current = deletableMetadata('beta');
    const failingKeys = [alphaOwnedKeys[1], alphaOwnedKeys[4]];
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      ...alphaOwnedKeys.map(key => [key, `secret:${key}`] as const),
      ['FATE_PROFILE_beta', 'beta-secret'],
      ['FATE_PROFILE_alpha_misleading', 'misleading-secret'],
    ]);
    const removeItem = storage.removeItem;
    storage.removeItem = key => {
      if (failingKeys.includes(key as typeof failingKeys[number])) {
        storage.calls.push(`remove:${key}`);
        throw new DOMException('blocked', 'SecurityError');
      }
      removeItem(key);
    };

    const result = await mutateProfileMetadata(createDependencies(storage), {
      type: 'delete',
      profileId: 'alpha',
    });

    expect(result).toMatchObject({
      ok: true,
      metadata: { revision: 8, activeProfileId: 'beta' },
      deleteDetails: { removedEntries: 5, removalFailures: 2, rollbackFailures: 0 },
    });
    expect(JSON.stringify(result)).not.toContain('FATE_PROFILE_alpha');
    expect(JSON.stringify(result)).not.toContain('secret:');
    expect(storage.values.get('FATE_PROFILE_beta')).toBe('beta-secret');
    expect(storage.values.get('FATE_PROFILE_alpha_misleading')).toBe('misleading-secret');
    for (const key of failingKeys) expect(storage.values.get(key)).toBe(`secret:${key}`);
  });

  it.each(['throw', 'mismatch'] as const)(
    'restores every successfully removed stored value after a primary %s',
    async failure => {
      const current = deletableMetadata();
      const originalEntries = alphaOwnedKeys.map(key => [key, `secret:${key}`] as const);
      const storage = createStorage([
        [PROFILES_KEY, JSON.stringify(current)],
        ...originalEntries,
        ['FATE_PROFILE_beta', 'beta-secret'],
      ]);
      const getItem = storage.getItem;
      const setItem = storage.setItem;
      storage.getItem = key => {
        if (failure === 'mismatch' && key === PROFILES_KEY && storage.calls.includes(`set:${PROFILES_KEY}`)) {
          storage.calls.push(`get:${key}`);
          storage.values.set(PROFILES_KEY, JSON.stringify({ ...current, revision: 99 }));
          return storage.values.get(PROFILES_KEY) ?? null;
        }
        return getItem(key);
      };
      storage.setItem = (key, value) => {
        if (failure === 'throw' && key === PROFILES_KEY) {
          storage.calls.push(`set:${key}`);
          throw new DOMException('full', 'QuotaExceededError');
        }
        setItem(key, value);
      };

      const result = await mutateProfileMetadata(createDependencies(storage), {
        type: 'delete',
        profileId: 'alpha',
      });

      expect(result).toEqual({
        ok: false,
        reason: 'verification_failed',
        metadata: current,
        notice: null,
        deleteDetails: { removedEntries: 7, removalFailures: 0, rollbackFailures: 0 },
      });
      for (const [key, value] of originalEntries) expect(storage.values.get(key)).toBe(value);
      expect(storage.values.get('FATE_PROFILE_beta')).toBe('beta-secret');
      expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(current));
      expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
    },
  );

  it('restores only originally stored values that were successfully removed', async () => {
    const current = deletableMetadata();
    const removalFailure = alphaOwnedKeys[1];
    const storedAndRemoved = [alphaOwnedKeys[0], alphaOwnedKeys[3]];
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      ...storedAndRemoved.map(key => [key, `secret:${key}`] as const),
      [removalFailure, `secret:${removalFailure}`],
    ]);
    const removeItem = storage.removeItem;
    storage.removeItem = key => {
      if (key === removalFailure) {
        storage.calls.push(`remove:${key}`);
        throw new DOMException('blocked', 'SecurityError');
      }
      removeItem(key);
    };
    const setItem = storage.setItem;
    const rollbackWrites: string[] = [];
    storage.setItem = (key, value) => {
      if (key === PROFILES_KEY) {
        storage.calls.push(`set:${key}`);
        throw new DOMException('full', 'QuotaExceededError');
      }
      if (alphaOwnedKeys.includes(key as typeof alphaOwnedKeys[number])) rollbackWrites.push(key);
      setItem(key, value);
    };

    const result = await mutateProfileMetadata(createDependencies(storage), {
      type: 'delete',
      profileId: 'alpha',
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'verification_failed',
      metadata: current,
      deleteDetails: { removedEntries: 2, removalFailures: 1, rollbackFailures: 0 },
    });
    expect(rollbackWrites).toEqual(storedAndRemoved);
    expect(storage.values.get(removalFailure)).toBe(`secret:${removalFailure}`);
  });

  it('counts rollback failures without exposing raw keys or stored values', async () => {
    const current = deletableMetadata();
    const rollbackFailures = [alphaOwnedKeys[0], alphaOwnedKeys[3]];
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      ...alphaOwnedKeys.map(key => [key, `secret:${key}`] as const),
    ]);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === PROFILES_KEY || rollbackFailures.includes(key as typeof rollbackFailures[number])) {
        storage.calls.push(`set:${key}`);
        throw new DOMException('full', 'QuotaExceededError');
      }
      setItem(key, value);
    };

    const result = await mutateProfileMetadata(createDependencies(storage), {
      type: 'delete',
      profileId: 'alpha',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'verification_failed',
      metadata: current,
      notice: null,
      deleteDetails: { removedEntries: 7, removalFailures: 0, rollbackFailures: 2 },
    });
    expect(JSON.stringify(result)).not.toContain('FATE_PROFILE_alpha');
    expect(JSON.stringify(result)).not.toContain('secret:');
    for (const key of rollbackFailures) expect(storage.values.has(key)).toBe(false);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it.each([
    { label: 'new unexpired writer lease', reason: 'profile_in_use', mode: 'lease' },
    { label: 'writer-lease read failure', reason: 'storage_unavailable', mode: 'read_failure' },
  ] as const)(
    'rejects a $label found after backup verification and before removal',
    async ({ reason, mode }) => {
      const current = deletableMetadata();
      const storage = createStorage([
        [PROFILES_KEY, JSON.stringify(current)],
        ...alphaOwnedKeys.map(key => [key, `secret:${key}`] as const),
      ]);
      const getItem = storage.getItem;
      let backupVerified = false;
      storage.getItem = key => {
        if (
          key === PROFILE_METADATA_BACKUP_KEY
          && storage.calls.includes(`set:${PROFILE_METADATA_BACKUP_KEY}`)
        ) {
          const value = getItem(key);
          backupVerified = true;
          if (mode === 'lease') {
            storage.values.set('FATE_PROFILE_alpha__writer', JSON.stringify({
              version: 1,
              ownerId: 'new-game-tab',
              expiresAt: 9_000,
            }));
          }
          return value;
        }
        if (backupVerified && mode === 'read_failure' && key === 'FATE_PROFILE_alpha__writer') {
          storage.calls.push(`get:${key}`);
          throw new DOMException('blocked', 'SecurityError');
        }
        return getItem(key);
      };

      await expect(mutateProfileMetadata(createDependencies(storage), {
        type: 'delete',
        profileId: 'alpha',
      })).resolves.toEqual({
        ok: false,
        reason,
        metadata: current,
        notice: null,
        deleteDetails: { removedEntries: 0, removalFailures: 0, rollbackFailures: 0 },
      });
      expect(profileOwnedRemovalCalls(storage)).toEqual([]);
      expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(current));
      expect(storage.values.get(PROFILE_METADATA_BACKUP_KEY)).toBe(JSON.stringify(current));
      expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
    },
  );

  it.each(['ignored', 'mismatch', 'read_failure'] as const)(
    'counts a rollback write whose readback is %s as a rollback failure',
    async failure => {
      const current = deletableMetadata();
      const failedKey = alphaOwnedKeys[0];
      const storage = createStorage([
        [PROFILES_KEY, JSON.stringify(current)],
        ...alphaOwnedKeys.map(key => [key, `secret:${key}`] as const),
      ]);
      const getItem = storage.getItem;
      const setItem = storage.setItem;
      let rollingBack = false;
      storage.getItem = key => {
        if (rollingBack && failure === 'read_failure' && key === failedKey) {
          storage.calls.push(`get:${key}`);
          throw new DOMException('blocked', 'SecurityError');
        }
        return getItem(key);
      };
      storage.setItem = (key, value) => {
        if (key === PROFILES_KEY) {
          storage.calls.push(`set:${key}`);
          rollingBack = true;
          throw new DOMException('full', 'QuotaExceededError');
        }
        if (rollingBack && key === failedKey) {
          if (failure === 'ignored') {
            storage.calls.push(`set:${key}`);
            return;
          }
          if (failure === 'mismatch') {
            setItem(key, 'different');
            return;
          }
        }
        setItem(key, value);
      };

      const result = await mutateProfileMetadata(createDependencies(storage), {
        type: 'delete',
        profileId: 'alpha',
      });

      expect(result).toEqual({
        ok: false,
        reason: 'verification_failed',
        metadata: current,
        notice: null,
        deleteDetails: { removedEntries: 7, removalFailures: 0, rollbackFailures: 1 },
      });
      expect(JSON.stringify(result)).not.toContain('FATE_PROFILE_alpha');
      expect(JSON.stringify(result)).not.toContain('secret:');
      expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
    },
  );

  it('counts only stored values whose removal call succeeded as removed entries', async () => {
    const current = deletableMetadata();
    const storedKeys = [alphaOwnedKeys[0], alphaOwnedKeys[3]];
    const storage = createStorage([
      [PROFILES_KEY, JSON.stringify(current)],
      ...storedKeys.map(key => [key, `secret:${key}`] as const),
    ]);

    const result = await mutateProfileMetadata(createDependencies(storage), {
      type: 'delete',
      profileId: 'alpha',
    });

    expect(result).toMatchObject({
      ok: true,
      metadata: { revision: 8, activeProfileId: 'beta' },
      deleteDetails: { removedEntries: 2, removalFailures: 0, rollbackFailures: 0 },
    });
    expect(profileOwnedRemovalCalls(storage)).toEqual(alphaOwnedKeys.map(key => `remove:${key}`));
    for (const key of storedKeys) expect(storage.values.has(key)).toBe(false);
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
      version: 1,
      revision: 4,
      profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }, created],
      activeProfileId: 'beta',
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
