import { useSyncExternalStore } from 'react';

/**
 * Which full-screen interface the OSRS layout shows. The classic layout never
 * reads this. Per page view only (not saved): every visit opens on Home.
 *
 *   home    - the Main board: Journal + Keys panel on the left, Progression on the right
 *   keys    - the wide Keys interface (Farm Keys NPC cards, Spend Keys, History boards)
 *   journal - the full Journal window (Journal board)
 */
export type OsrsScreen = 'home' | 'keys' | 'journal';
export type OsrsKeysTab = 'farm' | 'spend' | 'history';

/**
 * progressionWide: the Progression tab on show is drawn full width on its
 * board (Sync & Roll, Activities & Utility, Collection), so the home screen
 * hides its left column (Journal card + Keys panel). Dashboard sets it.
 */
interface NavState { screen: OsrsScreen; keysTab: OsrsKeysTab; progressionWide: boolean }

let state: NavState = { screen: 'home', keysTab: 'farm', progressionWide: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const getOsrsNav = (): NavState => state;

export const openOsrsScreen = (screen: OsrsScreen, keysTab?: OsrsKeysTab): void => {
  state = { ...state, screen, keysTab: keysTab ?? state.keysTab };
  emit();
};

export const setOsrsKeysTab = (keysTab: OsrsKeysTab): void => {
  state = { ...state, keysTab };
  emit();
};

export const setOsrsProgressionWide = (progressionWide: boolean): void => {
  if (state.progressionWide === progressionWide) return;
  state = { ...state, progressionWide };
  emit();
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const useOsrsNav = (): NavState => useSyncExternalStore(subscribe, getOsrsNav, getOsrsNav);
