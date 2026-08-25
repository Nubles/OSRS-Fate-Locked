import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blockPendingSave,
  discardPendingSave,
  flushPendingSave,
  getPendingSave,
  getSaveStatus,
  hasAnyPendingSaves,
  resetPendingSavesForTest,
  stagePendingSave,
  subscribePendingSaves,
} from './pendingSaves';

describe('pending save registry', () => {
  beforeEach(resetPendingSavesForTest);

  it('keeps only the newest staged snapshot for each profile', () => {
    stagePendingSave('profile-a', '{"keys":1}');
    stagePendingSave('profile-a', '{"keys":2}');
    stagePendingSave('profile-b', '{"keys":7}');

    expect(getPendingSave('profile-a')?.data).toBe('{"keys":2}');
    expect(getPendingSave('profile-b')?.data).toBe('{"keys":7}');
    expect(getSaveStatus('profile-a')).toBe('saving');
    expect(hasAnyPendingSaves()).toBe(true);
  });

  it('contains a write failure and later recovers the newest snapshot', () => {
    const setItem = vi.fn()
      .mockImplementationOnce(() => {
        throw new DOMException('full', 'QuotaExceededError');
      })
      .mockImplementation(() => undefined);

    stagePendingSave('profile-a', '{"keys":1}');
    expect(flushPendingSave({ setItem }, 'profile-a', () => ({ ok: true }))).toEqual({
      ok: false,
      reason: 'storage_unavailable',
    });
    expect(getSaveStatus('profile-a')).toBe('failed');

    stagePendingSave('profile-a', '{"keys":3}');
    expect(getSaveStatus('profile-a')).toBe('failed');
    expect(flushPendingSave({ setItem }, 'profile-a', () => ({ ok: true }))).toEqual({ ok: true });
    expect(setItem).toHaveBeenLastCalledWith('profile-a', '{"keys":3}');
    expect(getPendingSave('profile-a')).toBeNull();
  });

  it('reclaims a legacy disposable cache, preserves user data, and retries once', () => {
    const values = new Map<string, string>([
      ['fate_clog_sync_v1', 'large retired disposable cache'],
      ['FATE_PROFILE_existing', '{"keys":2}'],
      ['user_note', 'keep me'],
    ]);
    const storage = {
      setItem: vi.fn((key: string, value: string) => {
        if (values.has('fate_clog_sync_v1')) {
          throw new DOMException('full', 'QuotaExceededError');
        }
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
    };

    stagePendingSave('FATE_PROFILE_quota', '{"keys":3}');

    expect(flushPendingSave(storage, 'FATE_PROFILE_quota', () => ({ ok: true })))
      .toEqual({ ok: true });
    expect(values.get('FATE_PROFILE_quota')).toBe('{"keys":3}');
    expect(values.has('fate_clog_sync_v1')).toBe(false);
    expect(values.get('FATE_PROFILE_existing')).toBe('{"keys":2}');
    expect(values.get('user_note')).toBe('keep me');
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it('does not discard caches for a non-quota storage failure', () => {
    const storage = {
      setItem: vi.fn(() => {
        throw new DOMException('blocked', 'SecurityError');
      }),
      removeItem: vi.fn(),
    };

    stagePendingSave('FATE_PROFILE_blocked', '{"keys":4}');

    expect(flushPendingSave(storage, 'FATE_PROFILE_blocked', () => ({ ok: true })))
      .toEqual({ ok: false, reason: 'storage_unavailable' });
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('marks authorization storage denial failed without invoking durable storage', () => {
    const setItem = vi.fn();
    stagePendingSave('profile-a', '{"keys":9}');

    expect(flushPendingSave(
      { setItem },
      'profile-a',
      () => ({ ok: false, reason: 'storage_unavailable' }),
    )).toEqual({
      ok: false,
      reason: 'storage_unavailable',
    });
    expect(setItem).not.toHaveBeenCalled();
    expect(getPendingSave('profile-a')).toEqual({
      data: '{"keys":9}',
      status: 'failed',
      reason: 'storage_unavailable',
    });
    expect(getSaveStatus('profile-a')).toBe('failed');
  });

  it('keeps a blocked snapshot without invoking storage', () => {
    const setItem = vi.fn();
    stagePendingSave('profile-a', '{"keys":9}');

    expect(flushPendingSave(
      { setItem },
      'profile-a',
      () => ({ ok: false, reason: 'ownership_conflict' }),
    )).toEqual({
      ok: false,
      reason: 'ownership_conflict',
    });
    expect(setItem).not.toHaveBeenCalled();
    expect(getPendingSave('profile-a')).toMatchObject({
      data: '{"keys":9}',
      status: 'saving',
      reason: 'ownership_conflict',
    });
    expect(getSaveStatus('profile-a')).toBe('saving');
  });

  it('emits only when blocking changes a staged snapshot', () => {
    stagePendingSave('profile-a', '{"keys":9}');
    const listener = vi.fn();
    const unsubscribe = subscribePendingSaves(listener);

    blockPendingSave('profile-a');
    blockPendingSave('profile-a');
    unsubscribe();

    expect(getPendingSave('profile-a')).toMatchObject({
      status: 'saving',
      reason: 'ownership_conflict',
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('preserves ownership conflict when staging a newer blocked snapshot', () => {
    stagePendingSave('profile-a', '{"keys":9}');
    blockPendingSave('profile-a');
    const listener = vi.fn();
    const unsubscribe = subscribePendingSaves(listener);

    stagePendingSave('profile-a', '{"keys":10}');
    blockPendingSave('profile-a');
    unsubscribe();

    expect(getPendingSave('profile-a')).toEqual({
      data: '{"keys":10}',
      status: 'saving',
      reason: 'ownership_conflict',
    });
    expect(getSaveStatus('profile-a')).toBe('saving');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers and discards only the selected profile', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingSaves(listener);

    stagePendingSave('profile-a', 'a');
    stagePendingSave('profile-b', 'b');
    discardPendingSave('profile-a');
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(3);
    expect(getPendingSave('profile-a')).toBeNull();
    expect(getPendingSave('profile-b')?.data).toBe('b');
  });
});
