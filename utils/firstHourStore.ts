import { useSyncExternalStore } from 'react';

/**
 * What the guided first hour is showing right now, published by its driver
 * (components/FirstHourGuide.tsx, loaded lazily) for the pieces that draw it
 * elsewhere: the OSRS chatbox speaks its instruction, and the classic coach
 * strip and the chatbox's tour hint stay quiet while it runs. Kept tiny on
 * purpose: the entry chunk imports it.
 */
export interface FirstHourView {
  title: string;
  body: string;
  /** done: the step just finished; the body says what was learned. */
  phase: 'doing' | 'done';
  percent: number;
  stepNumber: number;
  stepCount: number;
  /** Spend step: "1/3 Keys spent". */
  counter?: string;
  optional: boolean;
  /** Item sprite (public/osrs-ui) for the OSRS chatbox. */
  icon: string;
  next: () => void;
  skipStep: () => void;
  skipGuide: () => void;
}

let view: FirstHourView | null = null;
const listeners = new Set<() => void>();

export const getFirstHourView = (): FirstHourView | null => view;

export const setFirstHourView = (next: FirstHourView | null): void => {
  if (next === view) return;
  view = next;
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The guide's current instruction, or null when it is not running. */
export const useFirstHourView = (): FirstHourView | null => useSyncExternalStore(subscribe, getFirstHourView, getFirstHourView);

// ── On/off (Settings → Guided first hour), per viewer, outside GameState ────

export const FIRST_HOUR_ENABLED_KEY = 'fate_first_hour_enabled_v1';
const CHANGE_EVENT = 'fate:first-hour';

/** On unless the viewer turned it off. */
export const readFirstHourEnabled = (): boolean => {
  try { return localStorage.getItem(FIRST_HOUR_ENABLED_KEY) !== '0'; } catch { return true; }
};

/** Turning it on restarts the guide for the current run (FirstHourGuide listens). */
export const writeFirstHourEnabled = (on: boolean): void => {
  try { localStorage.setItem(FIRST_HOUR_ENABLED_KEY, on ? '1' : '0'); } catch { /* lasts this page only */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribeEnabled = (l: () => void) => {
  window.addEventListener(CHANGE_EVENT, l);
  return () => window.removeEventListener(CHANGE_EVENT, l);
};

export const useFirstHourEnabled = (): boolean => useSyncExternalStore(subscribeEnabled, readFirstHourEnabled, () => true);
