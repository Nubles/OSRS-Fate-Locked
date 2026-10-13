import { useSyncExternalStore } from 'react';
import type { TableType } from '../../types';

/**
 * View state the compact Keys panel (home screen) and the wide Keys screen
 * share, so opening the wide screen keeps the category, table and entry the
 * player was looking at. Per page view only, never saved. The classic layout
 * never reads it.
 */
export type FarmSubTab = 'SLAYER' | 'CLUES' | 'BOSSING' | 'ACTIVITIES';

interface KeysViewState {
  farmTab: FarmSubTab;
  bossQuery: string;
  spendTable: TableType | null;
  historyEntry: string | null;
}

let state: KeysViewState = { farmTab: 'SLAYER', bossQuery: '', spendTable: null, historyEntry: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<KeysViewState>) => {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const get = () => state;

export const useKeysView = (): KeysViewState => useSyncExternalStore(subscribe, get, get);
export const setFarmTab = (farmTab: FarmSubTab) => set({ farmTab });
export const setBossQuery = (bossQuery: string) => set({ bossQuery });
export const setSpendTable = (spendTable: TableType | null) => set({ spendTable });
export const setHistoryEntry = (historyEntry: string | null) => set({ historyEntry });

/**
 * Where the Spend Keys reveal draws while the wide Spend Keys board is open:
 * the board's reveal window registers its body here, and the roll reveal
 * renders into it instead of over the whole screen.
 */
let revealHost: HTMLElement | null = null;
const hostListeners = new Set<() => void>();
export const setRevealHost = (el: HTMLElement | null) => {
  if (el === revealHost) return;
  revealHost = el;
  hostListeners.forEach(l => l());
};
const subscribeHost = (l: () => void) => { hostListeners.add(l); return () => { hostListeners.delete(l); }; };
const getHost = () => revealHost;
export const useRevealHost = (): HTMLElement | null => useSyncExternalStore(subscribeHost, getHost, getHost);
