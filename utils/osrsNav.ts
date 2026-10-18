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
/** progressionTabs: the Progression tab row (id + label), published by the
 * home screen so the Journal screen can show the same row. */
export interface OsrsProgressionTab { id: string; label: string }
interface NavState { screen: OsrsScreen; keysTab: OsrsKeysTab; progressionWide: boolean; progressionTabs: OsrsProgressionTab[] }

let state: NavState = { screen: 'home', keysTab: 'farm', progressionWide: false, progressionTabs: [] };
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

export const setOsrsProgressionTabs = (progressionTabs: OsrsProgressionTab[]): void => {
  const same = progressionTabs.length === state.progressionTabs.length
    && progressionTabs.every((t, i) => t.id === state.progressionTabs[i].id && t.label === state.progressionTabs[i].label);
  if (same) return;
  state = { ...state, progressionTabs };
  emit();
};
/** Leave the current screen for a Progression tab on the home screen. */
export const openOsrsProgressionTab = (id: string): void => {
  openOsrsScreen('home');
  window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target: `tab:${id}` } }));
};
/**
 * The screen a jump needs. Palette jumps, chat hints, "Show on map" and "Plan
 * a route" fire window events that change the home screen (a Progression tab,
 * a modal it owns) or the Keys panel, so from the Journal or Keys screen they
 * must bring that screen into view. null: the current screen already shows it.
 *   tab:* / open:* / plan-goal -> home (Dashboard owns those tabs and modals)
 *   ctrl:*                     -> the Keys panel: home when its left column is
 *                                 showing, otherwise the wide Keys screen
 */
export const screenForJump = (target: string, nav: Pick<NavState, 'screen' | 'progressionWide'>): OsrsScreen | null => {
  if (target.startsWith('ctrl:')) {
    if (nav.screen === 'keys' || (nav.screen === 'home' && !nav.progressionWide)) return null;
    return 'keys';
  }
  if (target.startsWith('tab:') || target.startsWith('open:') || target === 'plan-goal') {
    return nav.screen === 'home' ? null : 'home';
  }
  return null;
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const useOsrsNav = (): NavState => useSyncExternalStore(subscribe, getOsrsNav, getOsrsNav);
