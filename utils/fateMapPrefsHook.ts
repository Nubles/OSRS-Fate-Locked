import { useSyncExternalStore } from 'react';
import { FATE_MAP_PREF_KEYS, fateMapPrefMemory, readFateMapPref, type FateMapPref } from './fateMapPrefs';

/** Changing and watching Chunked's map options (utils/fateMapPrefs.ts); only lazily loaded screens import this. */
const CHANGE_EVENT = 'fate:map-prefs';

export const setFateMapPref = (pref: FateMapPref, on: boolean): void => {
  fateMapPrefMemory[pref] = on;
  try { localStorage.setItem(FATE_MAP_PREF_KEYS[pref], on ? 'on' : 'off'); } catch { /* lasts this page only */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

export const useFateMapPref = (pref: FateMapPref): boolean =>
  useSyncExternalStore(subscribe, () => readFateMapPref(pref), () => true);
