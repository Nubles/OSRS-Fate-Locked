import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimProfileDeletionLease,
  claimWriterLease,
  readWriterLease,
  releaseWriterLease,
  renewWriterLease,
  verifyWriterLease,
  writerLeaseKey,
  WRITER_LEASE_TTL_MS,
} from './profileWriterLease';
import { PROFILES_KEY } from './profileMetadata';

const PROFILE = 'FATE_PROFILE_test';

describe('profile writer leases', () => {
  let values: Map<string, string>;
  let storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  beforeEach(() => {
    values = new Map();
    storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
    };
  });

  it('claims an empty lease and verifies only its owner', () => {
    expect(claimWriterLease(storage, PROFILE, 'tab-a', 1_000)).toMatchObject({
      status: 'owned',
      lease: { version: 1, ownerId: 'tab-a', expiresAt: 1_000 + WRITER_LEASE_TTL_MS },
    });
    expect(verifyWriterLease(storage, PROFILE, 'tab-a', 1_001).status).toBe('owned');
    expect(verifyWriterLease(storage, PROFILE, 'tab-b', 1_001).status).toBe('blocked');
  });

  it('blocks a normal claim behind an unexpired foreign owner', () => {
    claimWriterLease(storage, PROFILE, 'tab-a', 1_000);
    expect(claimWriterLease(storage, PROFILE, 'tab-b', 1_001).status).toBe('blocked');
    expect(readWriterLease(storage, PROFILE)).toMatchObject({
      ok: true,
      lease: { ownerId: 'tab-a' },
    });
  });

  it('claims an expired or malformed record', () => {
    claimWriterLease(storage, PROFILE, 'tab-a', 1_000);
    expect(claimWriterLease(
      storage,
      PROFILE,
      'tab-b',
      1_000 + WRITER_LEASE_TTL_MS + 1,
    ).status).toBe('owned');

    values.set(writerLeaseKey(PROFILE), '{bad');
    expect(claimWriterLease(storage, PROFILE, 'tab-c', 50_000).status).toBe('owned');
  });

  it('replaces an unsupported lease version during a normal claim', () => {
    values.set(writerLeaseKey(PROFILE), JSON.stringify({
      version: 2,
      ownerId: 'future-tab',
      expiresAt: 50_000,
    }));

    expect(claimWriterLease(storage, PROFILE, 'tab-a', 1_000)).toMatchObject({
      status: 'owned',
      lease: { version: 1, ownerId: 'tab-a' },
    });
  });

  it('requires matching ownership to renew or release', () => {
    claimWriterLease(storage, PROFILE, 'tab-a', 1_000);
    expect(renewWriterLease(storage, PROFILE, 'tab-b', 2_000).status).toBe('blocked');
    expect(releaseWriterLease(storage, PROFILE, 'tab-b')).toBe('not_owner');
    expect(releaseWriterLease(storage, PROFILE, 'tab-a')).toBe('released');
    expect(values.has(writerLeaseKey(PROFILE))).toBe(false);
  });

  it('supports an explicit forced takeover', () => {
    claimWriterLease(storage, PROFILE, 'tab-a', 1_000);
    expect(claimWriterLease(storage, PROFILE, 'tab-b', 1_001, true)).toMatchObject({
      status: 'owned',
      lease: { ownerId: 'tab-b' },
    });
  });

  it('does not let forced takeover replace an active profile-deletion reservation', () => {
    values.set(writerLeaseKey(PROFILE), JSON.stringify({
      version: 1,
      ownerId: 'deleting-tab',
      expiresAt: 31_000,
      purpose: 'profile_delete',
      deletionId: 'delete-test-1',
    }));

    expect(claimWriterLease(storage, PROFILE, 'game-tab', 1_001, true).status).toBe('blocked');
    expect(readWriterLease(storage, PROFILE)).toMatchObject({
      ok: true,
      lease: { ownerId: 'deleting-tab', purpose: 'profile_delete', deletionId: 'delete-test-1' },
    });
  });

  it('denies normal verification, renewal, and forced takeover while a tombstone exists', () => {
    values.set(PROFILES_KEY, JSON.stringify({
      version: 2,
      revision: 9,
      profiles: [{ id: 'beta', name: 'Beta', createdAt: 2 }],
      activeProfileId: 'beta',
      deletions: [{
        version: 1,
        deletionId: 'delete-alpha-1',
        profileId: 'test',
        requestedAt: 1,
        phase: 'pending_cleanup',
      }],
    }));
    values.set(writerLeaseKey(PROFILE), JSON.stringify({
      version: 1,
      ownerId: 'stale-game-tab',
      expiresAt: 31_000,
    }));

    expect(verifyWriterLease(storage, PROFILE, 'stale-game-tab', 1_000).status).toBe('blocked');
    expect(renewWriterLease(storage, PROFILE, 'stale-game-tab', 1_000).status).toBe('blocked');
    expect(claimWriterLease(storage, PROFILE, 'new-game-tab', 1_000).status).toBe('blocked');
    expect(claimWriterLease(storage, PROFILE, 'forced-game-tab', 100_000, true).status).toBe('blocked');

    expect(claimProfileDeletionLease(
      storage,
      PROFILE,
      'cleanup-tab',
      100_000,
      'delete-alpha-1',
    )).toMatchObject({
      status: 'owned',
      lease: {
        ownerId: 'cleanup-tab',
        purpose: 'profile_delete',
        deletionId: 'delete-alpha-1',
      },
    });
    expect(claimProfileDeletionLease(
      storage,
      PROFILE,
      'wrong-cleanup-tab',
      200_000,
      'delete-alpha-2',
    ).status).toBe('blocked');
  });

  it('stops authorizing a deletion lease after its exact intent is remotely finalized', () => {
    values.set(PROFILES_KEY, JSON.stringify({
      version: 2,
      revision: 10,
      profiles: [{ id: 'beta', name: 'Beta', createdAt: 2 }],
      activeProfileId: 'beta',
      deletions: [],
    }));
    values.set(writerLeaseKey(PROFILE), JSON.stringify({
      version: 1,
      ownerId: 'late-cleanup-tab',
      expiresAt: 31_000,
      purpose: 'profile_delete',
      deletionId: 'delete-alpha-1',
    }));

    expect(verifyWriterLease(storage, PROFILE, 'late-cleanup-tab', 1_000).status).toBe('blocked');
    expect(renewWriterLease(storage, PROFILE, 'late-cleanup-tab', 1_000).status).toBe('blocked');
  });

  it('fails closed without writing a lease for future profile metadata', () => {
    values.set(PROFILES_KEY, JSON.stringify({
      version: 3,
      revision: 1,
      profiles: [{ id: 'test', name: 'Future', createdAt: 1 }],
      activeProfileId: 'test',
      deletions: [],
    }));

    expect(claimWriterLease(storage, PROFILE, 'game-tab', 1_000, true).status).toBe('blocked');
    expect(values.has(writerLeaseKey(PROFILE))).toBe(false);
  });

  it('fails closed when storage cannot be read or written', () => {
    expect(claimWriterLease({
      getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }, PROFILE, 'tab-a', 1_000).status).toBe('unavailable');

    expect(claimWriterLease({
      getItem: () => null,
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem: vi.fn(),
    }, PROFILE, 'tab-a', 1_000).status).toBe('unavailable');
  });

  it('loses arbitration when another owner replaces the just-written claim', () => {
    storage.setItem = (key, value) => {
      values.set(key, value);
      values.set(key, JSON.stringify({ version: 1, ownerId: 'tab-b', expiresAt: 31_000 }));
    };
    expect(claimWriterLease(storage, PROFILE, 'tab-a', 1_000).status).toBe('blocked');
  });
});
