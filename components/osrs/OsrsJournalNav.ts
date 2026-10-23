import { useSyncExternalStore } from 'react';
import { openOsrsScreen } from '../../utils/osrsNav';

/**
 * Which tab the OSRS Journal window (screen 'journal') shows, so whatever
 * opens it can preselect one: the Journal card rows on the home screen open
 * Quest list, Diaries or Combat. Per page view only, like utils/osrsNav.ts.
 */
export type OsrsJournalTab = 'ready' | 'almost' | 'quests' | 'diaries' | 'combat';

interface JournalNavState { tab: OsrsJournalTab }

let state: JournalNavState = { tab: 'ready' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const getOsrsJournalNav = (): JournalNavState => state;

export const setOsrsJournalTab = (tab: OsrsJournalTab): void => {
  if (state.tab === tab) return;
  state = { tab };
  emit();
};

/** Open the Journal window, on the given tab (or the last one shown). */
export const openOsrsJournal = (tab?: OsrsJournalTab): void => {
  if (tab) setOsrsJournalTab(tab);
  openOsrsScreen('journal');
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const useOsrsJournalNav = (): JournalNavState => useSyncExternalStore(subscribe, getOsrsJournalNav, getOsrsJournalNav);
