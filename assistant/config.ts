/**
 * Fate Assistant — PROTOTYPE feature flag.
 *
 * The entire assistant lives under this one `assistant/` folder and is mounted
 * from a single <AssistantMount/> line in App.tsx. It is OFF by default: the app
 * behaves exactly as before unless the user explicitly opts in, and they can
 * toggle it on/off at any time. To remove the feature entirely: delete this
 * folder and the one <AssistantMount/> line — nothing else imports it.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'fate:assistant:enabled';
const listeners = new Set<() => void>();

export const isAssistantEnabled = (): boolean => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};

export const setAssistantEnabled = (on: boolean): void => {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  listeners.forEach(l => l());
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
};

/** Reactive flag: re-renders when the toggle flips (in any tab). */
export const useAssistantEnabled = (): boolean =>
  useSyncExternalStore(subscribe, isAssistantEnabled, () => false);

/** Shown next to the assistant everywhere, so it's clearly experimental. */
export const ASSISTANT_PROTOTYPE_LABEL = 'PROTOTYPE';
