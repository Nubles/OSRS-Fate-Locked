import { useSyncExternalStore } from 'react';

/**
 * Small on/off choices each viewer makes for themselves, kept in localStorage
 * outside GameState (like utils/skillOddsPref.ts) so they never travel with
 * saves, sync codes or exports. With storage blocked a choice lasts this page.
 */
export interface ViewerPref {
  key: string;
  read: () => boolean;
  set: (on: boolean) => void;
  use: () => boolean;
}

const makePref = (key: string, fallback: boolean): ViewerPref => {
  const event = `fate:pref:${key}`;
  let memory: boolean | undefined;
  const read = (): boolean => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === 'on') return true;
      if (raw === 'off') return false;
    } catch { /* storage blocked: this page's choice, else the default */ }
    return memory ?? fallback;
  };
  const set = (on: boolean): void => {
    memory = on;
    try { localStorage.setItem(key, on ? 'on' : 'off'); } catch { /* lasts this page only */ }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(event));
  };
  const subscribe = (onChange: () => void): (() => void) => {
    window.addEventListener(event, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(event, onChange);
      window.removeEventListener('storage', onChange);
    };
  };
  const use = (): boolean => useSyncExternalStore(subscribe, read, () => fallback);
  return { key, read, set, use };
};

/** Spend Keys: the line under each table saying how many draws you could use now. */
export const tableOutlookPref = makePref('fate_table_outlook_v1', false);

/** The short note about your last session after a break. */
export const welcomeBackPref = makePref('fate_welcome_back_v1', true);

/** The OSRS chatbox's Clan tab: other players' unlocks from the Fate Locked Discord. */
export const clanBroadcastsPref = makePref('fate_clan_broadcasts_v1', true);
