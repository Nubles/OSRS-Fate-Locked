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

interface NavState { screen: OsrsScreen; keysTab: OsrsKeysTab }

let state: NavState = { screen: 'home', keysTab: 'farm' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const getOsrsNav = (): NavState => state;

export const openOsrsScreen = (screen: OsrsScreen, keysTab?: OsrsKeysTab): void => {
  state = { screen, keysTab: keysTab ?? state.keysTab };
  emit();
};

export const setOsrsKeysTab = (keysTab: OsrsKeysTab): void => {
  state = { ...state, keysTab };
  emit();
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const useOsrsNav = (): NavState => useSyncExternalStore(subscribe, getOsrsNav, getOsrsNav);
