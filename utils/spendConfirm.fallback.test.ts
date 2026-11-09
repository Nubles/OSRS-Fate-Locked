// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { confirmThen, warmSpendConfirm } from './spendConfirm';
import { confirmSpendPref } from './viewerPrefs';

// A tab left open across a new version: the box's file is gone from the server.
vi.mock('../components/SpendConfirm', () => {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/SpendConfirm-old.js');
});

describe('confirmThen when the Yes / No box cannot be fetched', () => {
  afterEach(() => { confirmSpendPref.set(false); vi.restoreAllMocks(); });

  it('asks with the browser box instead, and acts on OK', async () => {
    confirmSpendPref.set(true);
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const act = vi.fn();
    confirmThen('Roll for a Key from Slayer (Vannaka)?', act);
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(ask).toHaveBeenCalledWith('Roll for a Key from Slayer (Vannaka)?');
  });

  it('does not act on Cancel, and the next click asks again', async () => {
    confirmSpendPref.set(true);
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const act = vi.fn();
    confirmThen('Spend 1 Key on Skills?', act);
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await Promise.resolve();
    expect(act).not.toHaveBeenCalled();

    ask.mockReturnValue(true);
    confirmThen('Spend 1 Key on Skills?', act);
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('treats a browser that blocks its own box as a No', async () => {
    confirmSpendPref.set(true);
    const ask = vi.spyOn(window, 'confirm').mockImplementation(() => { throw new Error('blocked'); });
    const act = vi.fn();
    confirmThen('Roll for a Key from Clue (Easy)?', act);
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await Promise.resolve();
    expect(act).not.toHaveBeenCalled();
  });

  it('warms nothing while the setting is off, and a failed warm-up stays quiet for the caller to ignore', async () => {
    confirmSpendPref.set(false);
    await expect(warmSpendConfirm()).resolves.toBeUndefined();
    confirmSpendPref.set(true);
    await expect(warmSpendConfirm()).rejects.toBeTruthy();
  });
});
