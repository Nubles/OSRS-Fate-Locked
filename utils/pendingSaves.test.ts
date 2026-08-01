import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
    expect(flushPendingSave({ setItem }, 'profile-a')).toEqual({
      ok: false,
      reason: 'storage_unavailable',
    });
    expect(getSaveStatus('profile-a')).toBe('failed');

    stagePendingSave('profile-a', '{"keys":3}');
    expect(getSaveStatus('profile-a')).toBe('failed');
    expect(flushPendingSave({ setItem }, 'profile-a')).toEqual({ ok: true });
    expect(setItem).toHaveBeenLastCalledWith('profile-a', '{"keys":3}');
    expect(getPendingSave('profile-a')).toBeNull();
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
