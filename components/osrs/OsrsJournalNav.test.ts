import { describe, expect, it } from 'vitest';
import { getOsrsNav, openOsrsScreen } from '../../utils/osrsNav';
import { getOsrsJournalNav, openOsrsJournal, setOsrsJournalTab } from './OsrsJournalNav';

describe('opening the OSRS Journal window on a tab', () => {
  it('shows the journal screen on the chosen tab, and keeps the last tab when none is given', () => {
    openOsrsScreen('home');
    openOsrsJournal('diaries');
    expect(getOsrsNav().screen).toBe('journal');
    expect(getOsrsJournalNav().tab).toBe('diaries');
    openOsrsScreen('home');
    openOsrsJournal();
    expect(getOsrsJournalNav().tab).toBe('diaries');
    setOsrsJournalTab('ready');
    expect(getOsrsJournalNav().tab).toBe('ready');
    openOsrsScreen('home');
  });
});
