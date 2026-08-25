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
    const values = new Map<string, string>();
    const setItem = vi.fn()
      .mockImplementationOnce(() => {
        throw new DOMException('full', 'QuotaExceededError');
      })
      .mockImplementation((key: string, value: string) => {
        values.set(key, value);
      });
    const getItem = vi.fn((key: string) => values.get(key) ?? null);

    stagePendingSave('profile-a', '{"keys":1}');
    expect(flushPendingSave({ setItem, getItem }, 'profile-a', () => ({ ok: true }))).toEqual({
      ok: false,
      reason: 'storage_unavailable',
    });
    expect(getSaveStatus('profile-a')).toBe('failed');

    stagePendingSave('profile-a', '{"keys":3}');
    expect(getSaveStatus('profile-a')).toBe('failed');
    expect(flushPendingSave({ setItem, getItem }, 'profile-a', () => ({ ok: true }))).toEqual({ ok: true });
    expect(setItem).toHaveBeenLastCalledWith('profile-a', '{"keys":3}');
    expect(getPendingSave('profile-a')).toBeNull();
  });

  it('retries a quota write after removing disposable caches and verifies the readback', () => {
    const values = new Map<string, string>([
      ['fate_clog_sync_v1', 'large retired disposable cache'],
      ['FATE_PROFILE_existing', '{"keys":2}'],
      ['user_note', 'keep me'],
    ]);
    const setItem = vi.fn()
      .mockImplementationOnce(() => {
        throw new DOMException('full', 'QuotaExceededError');
      })
      .mockImplementation((key: string, value: string) => {
        values.set(key, value);
      });
    const getItem = vi.fn((key: string) => values.get(key) ?? null);
    const removeItem = vi.fn((key: string) => {
      values.delete(key);
    });

    stagePendingSave('FATE_PROFILE_quota', '{"keys":3}');

    expect(flushPendingSave(
      { setItem, getItem, removeItem },
      'FATE_PROFILE_quota',
      () => ({ ok: true }),
    )).toEqual({ ok: true });
    expect(values.get('FATE_PROFILE_quota')).toBe('{"keys":3}');
    expect(values.has('fate_clog_sync_v1')).toBe(false);
    expect(values.get('FATE_PROFILE_existing')).toBe('{"keys":2}');
    expect(values.get('user_note')).toBe('keep me');
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(getItem).toHaveBeenLastCalledWith('FATE_PROFILE_quota');
  });

  it('keeps a staged snapshot when the quota retry also fails', () => {
    const setItem = vi.fn(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const getItem = vi.fn(() => null);
    const removeItem = vi.fn();
    stagePendingSave('FATE_PROFILE_quota', '{"keys":4}');

    expect(flushPendingSave(
      { setItem, getItem, removeItem },
      'FATE_PROFILE_quota',
      () => ({ ok: true }),
    )).toEqual({ ok: false, reason: 'storage_unavailable' });
    expect(getPendingSave('FATE_PROFILE_quota')).toEqual({
      data: '{"keys":4}',
      status: 'failed',
      reason: 'storage_unavailable',
    });
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(removeItem).toHaveBeenCalledTimes(9);
  });

  it('does not treat a mismatched readback as a successful save', () => {
    const setItem = vi.fn();
    const getItem = vi.fn(() => '{"keys":different}');
    const removeItem = vi.fn();
    stagePendingSave('FATE_PROFILE_mismatch', '{"keys":5}');

    expect(flushPendingSave(
      { setItem, getItem, removeItem },
      'FATE_PROFILE_mismatch',
      () => ({ ok: true }),
    )).toEqual({ ok: false, reason: 'storage_unavailable' });
    expect(getPendingSave('FATE_PROFILE_mismatch')).toMatchObject({
      data: '{"keys":5}',
      status: 'failed',
      reason: 'storage_unavailable',
    });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledWith('FATE_PROFILE_mismatch');
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('does not discard caches for a non-quota storage failure', () => {
    const setItem = vi.fn(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const getItem = vi.fn(() => null);
    const removeItem = vi.fn();

    stagePendingSave('FATE_PROFILE_blocked', '{"keys":6}');

    expect(flushPendingSave(
      { setItem, getItem, removeItem },
      'FATE_PROFILE_blocked',
      () => ({ ok: true }),
    )).toEqual({ ok: false, reason: 'storage_unavailable' });
    expect(removeItem).not.toHaveBeenCalled();
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('marks authorization storage denial failed without invoking durable storage', () => {
    const setItem = vi.fn();
    const getItem = vi.fn();
    stagePendingSave('profile-a', '{"keys":9}');

    expect(flushPendingSave(
      { setItem, getItem },
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
    const getItem = vi.fn();
    stagePendingSave('profile-a', '{"keys":9}');

    expect(flushPendingSave(
      { setItem, getItem },
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
