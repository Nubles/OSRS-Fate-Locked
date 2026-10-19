import { useSyncExternalStore } from 'react';

/**
 * How the classic layout draws its Journal tab: 'ready' opens the Journal
 * window on everything the run can tick off now (the window the OSRS layout
 * shows), 'classic' keeps the Quests, Diaries, Combat and Doable tabs.
 * A per-viewer preference, kept in localStorage outside GameState like the
 * layout choice in utils/uiStyle.ts. The OSRS layout always shows the window.
 */
export type JournalLayout = 'ready' | 'classic';

export const JOURNAL_LAYOUT_KEY = 'fate_journal_layout_v1';
const CHANGE_EVENT = 'fate:journal-layout';
export const DEFAULT_JOURNAL_LAYOUT: JournalLayout = 'ready';

// The last choice made on this page, for when storage is blocked.
let pageChoice: JournalLayout | null = null;

export const readJournalLayout = (): JournalLayout => {
  try {
    const raw = localStorage.getItem(JOURNAL_LAYOUT_KEY);
    if (raw === 'ready' || raw === 'classic') return raw;
  } catch { /* storage blocked: this page's choice, else the default */ }
  return pageChoice ?? DEFAULT_JOURNAL_LAYOUT;
};

export const setJournalLayout = (layout: JournalLayout): void => {
  pageChoice = layout;
  try { localStorage.setItem(JOURNAL_LAYOUT_KEY, layout); } catch { /* the choice lasts this page only */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

export const useJournalLayout = (): JournalLayout =>
  useSyncExternalStore(subscribe, readJournalLayout, () => DEFAULT_JOURNAL_LAYOUT);
