import { describe, expect, it, vi } from 'vitest';
import type { ProfileMetadata } from '../types';
import {
  acquireProfileMetadataLock,
  commitProfileMetadataCandidate,
  PROFILE_METADATA_LOCK_ARBITRATION_MS,
  PROFILE_METADATA_LOCK_KEY,
  PROFILE_METADATA_LOCK_TIMEOUT_MS,
  PROFILE_METADATA_LOCK_TTL_MS,
  releaseProfileMetadataLock,
  type ProfileTransactionDependencies,
} from './profileMetadataTransaction';
import { PROFILE_METADATA_BACKUP_KEY, PROFILES_KEY } from './profileMetadata';

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
