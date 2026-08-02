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
    expect(flushPendingSave({ setItem }, 'profile-a', () => true)).toEqual({
      ok: false,
      reason: 'storage_unavailable',
    });
    expect(getSaveStatus('profile-a')).toBe('failed');

    stagePendingSave('profile-a', '{"keys":3}');
    expect(getSaveStatus('profile-a')).toBe('failed');
    expect(flushPendingSave({ setItem }, 'profile-a', () => true)).toEqual({ ok: true });
    expect(setItem).toHaveBeenLastCalledWith('profile-a', '{"keys":3}');
    expect(getPendingSave('profile-a')).toBeNull();
  });

  it('keeps a blocked snapshot without invoking storage', () => {
    const setItem = vi.fn();
    stagePendingSave('profile-a', '{"keys":9}');

    expect(flushPendingSave({ setItem }, 'profile-a', () => false)).toEqual({
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
