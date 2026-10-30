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

const makePref = (key: string, defaultOn: boolean | (() => boolean)): ViewerPref => {
  const fallback = (): boolean => (typeof defaultOn === 'function' ? defaultOn() : defaultOn);
  const event = `fate:pref:${key}`;
  let memory: boolean | undefined;
  const read = (): boolean => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === 'on') return true;
      if (raw === 'off') return false;
    } catch { /* storage blocked: this page's choice, else the default */ }
    return memory ?? fallback();
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
  const use = (): boolean => useSyncExternalStore(subscribe, read, fallback);
  return { key, read, set, use };
};

/** Spend Keys: the line under each table saying how many draws you could use now. */
export const tableOutlookPref = makePref('fate_table_outlook_v1', false);

/** Ask before Key clicks: a Yes / No box before a click spends a Key or rolls for one (utils/spendConfirm.ts). */
// On unless the build says 'off' (component tests do: vite.config.ts).
export const confirmSpendPref = makePref('fate_confirm_spend_v1', () => import.meta.env.VITE_ASK_BEFORE_KEY_CLICKS !== 'off');

/** The short note about your last session after a break. */
export const welcomeBackPref = makePref('fate_welcome_back_v1', true);

/** The OSRS chatbox's Clan tab: other players' unlocks from the Fate Locked Discord. */
export const clanBroadcastsPref = makePref('fate_clan_broadcasts_v1', true);

/** Effects: the Fate orb's ring fills (and flashes) as a miss adds Fate. Follows the Animations switch too. */
export const fateFillPref = makePref('fate_effect_fate_fill_v1', true);

/** Effects: the Fate orb glows once the run is close to its Pity Key. */
export const pityGlowPref = makePref('fate_effect_pity_glow_v1', true);

/** Effects: a chat line when a Key ends a long run of misses ("Dry run over: 41 rolls."). */
export const dryRunLinesPref = makePref('fate_effect_dry_runs_v1', true);

/** Effects: a soft sound on a miss, a chime on a Key and a short fanfare on an unlock (utils/fateSounds.ts). Off unless chosen. */
export const soundsPref = makePref('fate_effect_sounds_v1', false);
