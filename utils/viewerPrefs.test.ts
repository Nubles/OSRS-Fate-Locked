// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { confirmSpendPref, tableOutlookPref } from './viewerPrefs';

describe('viewer prefs', () => {
  it('start with Ask before spending on and the table outlook off', () => {
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
