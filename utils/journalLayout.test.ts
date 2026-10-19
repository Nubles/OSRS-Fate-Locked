// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_JOURNAL_LAYOUT, JOURNAL_LAYOUT_KEY, readJournalLayout, setJournalLayout } from './journalLayout';

describe('journal layout choice', () => {
  afterEach(() => localStorage.removeItem(JOURNAL_LAYOUT_KEY));

  it('opens on Ready now until the viewer picks Classic', () => {
    expect(DEFAULT_JOURNAL_LAYOUT).toBe('ready');
    expect(readJournalLayout()).toBe('ready');
    setJournalLayout('classic');
    expect(readJournalLayout()).toBe('classic');
    expect(localStorage.getItem(JOURNAL_LAYOUT_KEY)).toBe('classic');
  });

  it('ignores an unknown stored value', () => {
    setJournalLayout('ready');
    localStorage.setItem(JOURNAL_LAYOUT_KEY, 'sideways');
    expect(readJournalLayout()).toBe('ready');
  });
});
