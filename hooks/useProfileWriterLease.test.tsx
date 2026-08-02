// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  writerLeaseKey,
  WRITER_LEASE_ARBITRATION_MS,
  WRITER_LEASE_RENEW_MS,
  WRITER_LEASE_TTL_MS,
} from '../utils/profileWriterLease';
import { useProfileWriterLease } from './useProfileWriterLease';

describe('useProfileWriterLease', () => {
  let values: Map<string, string>;
  let nowRef: { current: number };
  let storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  beforeEach(() => {
    vi.useFakeTimers();
    values = new Map();
    nowRef = { current: 1_000 };
    storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('settles an uncontested claim before becoming owner', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    expect(lease.result.current.status).toBe('checking');
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    expect(lease.result.current.status).toBe('owner');
    expect(lease.result.current.verify()).toBe(true);
  });

  it('stays blocked behind a live foreign owner and claims after expiry', async () => {
    values.set(writerLeaseKey('profile'), JSON.stringify({
      version: 1,
      ownerId: 'tab-a',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.blockedReason).toBe('foreign_owner');

    nowRef.current += WRITER_LEASE_TTL_MS + 1;
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_RENEW_MS));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    expect(lease.result.current.status).toBe('owner');
    expect(lease.result.current.blockedReason).toBeNull();
  });

  it('distinguishes unavailable storage from a foreign owner', async () => {
    const unavailableStorage = {
      getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage: unavailableStorage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));
    await act(async () => Promise.resolve());
    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.blockedReason).toBe('storage_unavailable');
  });

  it('classifies claim write failures as unavailable storage', async () => {
    const writeUnavailableStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem: vi.fn(),
    };
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage: writeUnavailableStorage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));

    await act(async () => Promise.resolve());

    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.blockedReason).toBe('storage_unavailable');
  });

  it('becomes blocked when a foreign storage event replaces its lease', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    expect(lease.result.current.status).toBe('owner');

    const key = writerLeaseKey('profile');
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-b',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key })));

    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.verify()).toBe(false);
  });

  it('ignores storage events for other profile leases', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));

    values.set(writerLeaseKey('profile'), JSON.stringify({
      version: 1,
      ownerId: 'tab-b',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: writerLeaseKey('another-profile'),
    })));

    expect(lease.result.current.status).toBe('owner');
  });

  it('renews ownership and rechecks when the document becomes visible', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    const key = writerLeaseKey('profile');
    const firstExpiry = JSON.parse(values.get(key)!).expiresAt;

    nowRef.current += WRITER_LEASE_RENEW_MS;
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_RENEW_MS));
    expect(JSON.parse(values.get(key)!).expiresAt).toBeGreaterThan(firstExpiry);

    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-b',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(lease.result.current.status).toBe('blocked');
  });

  it('fails closed synchronously when verification cannot read storage', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    storage.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };

    let verified = true;
    act(() => { verified = lease.result.current.verify(); });

    expect(verified).toBe(false);
    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.blockedReason).toBe('storage_unavailable');
  });

  it('returns a typed storage denial while preserving boolean verification', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    storage.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };

    let authorization: unknown;
    act(() => { authorization = lease.result.current.authorizeWrite(); });

    expect(authorization).toEqual({
      ok: false,
      reason: 'storage_unavailable',
    });
    expect(lease.result.current.verify()).toBe(false);
    expect(lease.result.current.blockedReason).toBe('storage_unavailable');
  });

  it('invalidates a pending takeover when a newer ownership check wins', async () => {
    const key = writerLeaseKey('profile');
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-a',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));

    let takeover: Promise<boolean>;
    act(() => { takeover = lease.result.current.takeOver(); });
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-c',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key })));

    await expect(takeover!).resolves.toBe(false);
    expect(lease.result.current.status).toBe('blocked');
    expect(JSON.parse(values.get(key)!).ownerId).toBe('tab-c');
  });

  it('rejects takeover when a foreign owner replaces it during arbitration', async () => {
    const key = writerLeaseKey('profile');
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-a',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));

    let tookOver = true;
    await act(async () => {
      const result = lease.result.current.takeOver();
      values.set(key, JSON.stringify({
        version: 1,
        ownerId: 'tab-c',
        expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
      }));
      await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
      tookOver = await result;
    });

    expect(tookOver).toBe(false);
    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.blockedReason).toBe('foreign_owner');
  });

  it('releases only its matching lease', async () => {
    const key = writerLeaseKey('profile');
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));

    expect(lease.result.current.release()).toBe(true);
    expect(values.has(key)).toBe(false);

    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-b',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    expect(lease.result.current.release()).toBe(false);
    expect(JSON.parse(values.get(key)!).ownerId).toBe('tab-b');
  });

  it('classifies release removal failures as unavailable storage', async () => {
    const removeUnavailableStorage = {
      getItem: storage.getItem,
      setItem: storage.setItem,
      removeItem: () => { throw new DOMException('blocked', 'SecurityError'); },
    };
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage: removeUnavailableStorage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));

    let released = true;
    act(() => { released = lease.result.current.release(); });

    expect(released).toBe(false);
    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.blockedReason).toBe('storage_unavailable');
    expect(JSON.parse(values.get(writerLeaseKey('profile'))!).ownerId).toBe('tab-a');
  });

  it('forces takeover and cleans every timer and listener on unmount', async () => {
    const key = writerLeaseKey('profile');
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-a',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));

    let tookOver = false;
    await act(async () => {
      const result = lease.result.current.takeOver();
      await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
      tookOver = await result;
    });
    expect(tookOver).toBe(true);
    expect(JSON.parse(values.get(key)!).ownerId).toBe('tab-b');

    lease.unmount();
    expect(JSON.parse(values.get(key)!).ownerId).toBe('tab-b');
    expect(removeWindow).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('settles and fully cleans a pending takeover on unmount', async () => {
    const key = writerLeaseKey('profile');
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-a',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));

    let takeover!: Promise<boolean>;
    act(() => { takeover = lease.result.current.takeOver(); });
    const forcedLease = values.get(key);
    lease.unmount();

    await expect(takeover).resolves.toBe(false);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(removeWindow).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        WRITER_LEASE_RENEW_MS + WRITER_LEASE_ARBITRATION_MS,
      );
    });
    expect(values.get(key)).toBe(forcedLease);
    expect(vi.getTimerCount()).toBe(0);
  });
});
