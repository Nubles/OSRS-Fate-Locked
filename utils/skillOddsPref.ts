import { useSyncExternalStore } from 'react';

/**
 * How the skill cards show their roll odds: the small "i" button in each
 * card's corner (the default), or the older box over the whole card when you
 * hover it. A per-viewer preference in localStorage, outside GameState (like
 * utils/uiStyle.ts), so it never travels with saves, sync codes or exports.
 * With storage blocked the choice lasts this page only.
 */
export const SKILL_ODDS_HOVER_KEY = 'fate_skill_odds_hover_v1';
const CHANGE_EVENT = 'fate:skill-odds-pref';
let memory: boolean | undefined;

export const readSkillOddsHover = (): boolean => {
  try {
    const raw = localStorage.getItem(SKILL_ODDS_HOVER_KEY);
    if (raw === 'on') return true;
    if (raw === 'off') return false;
  } catch { /* storage blocked: this page's choice, else the default */ }
  return memory ?? false;
};

export const setSkillOddsHover = (on: boolean): void => {
  memory = on;
  try { localStorage.setItem(SKILL_ODDS_HOVER_KEY, on ? 'on' : 'off'); } catch { /* lasts this page only */ }
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

/** True when the player turned the old hover box back on in Settings. */
export const useSkillOddsHover = (): boolean =>
  useSyncExternalStore(subscribe, readSkillOddsHover, () => false);
