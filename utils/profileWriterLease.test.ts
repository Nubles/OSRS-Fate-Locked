import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimWriterLease,
  readWriterLease,
  releaseWriterLease,
  renewWriterLease,
  verifyWriterLease,
  writerLeaseKey,
  WRITER_LEASE_TTL_MS,
} from './profileWriterLease';

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
