// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmSpendPref, tableOutlookPref } from './viewerPrefs';

describe('viewer prefs', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('start with Ask before Key clicks on and the table outlook off', () => {
    vi.stubEnv('VITE_ASK_BEFORE_KEY_CLICKS', '');
    localStorage.clear();
    expect(confirmSpendPref.read()).toBe(true);
    expect(tableOutlookPref.read()).toBe(false);
  });

  it('keep a choice the player made', () => {
    confirmSpendPref.set(false);
    expect(localStorage.getItem(confirmSpendPref.key)).toBe('off');
    expect(confirmSpendPref.read()).toBe(false);
    confirmSpendPref.set(true);
    expect(confirmSpendPref.read()).toBe(true);
  });
});
