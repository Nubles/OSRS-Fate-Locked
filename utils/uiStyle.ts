import { useSyncExternalStore } from 'react';

/**
 * Which interface the viewer sees: the classic tracker layout or the OSRS
 * interface layout. A per-viewer preference, kept in localStorage outside
 * GameState so it never travels with saves, sync codes or exports.
 *
 * The default comes from VITE_DEFAULT_UI_STYLE at build time, so a preview
 * build can open in the OSRS layout while main keeps the classic one.
 */
export type UiStyle = 'classic' | 'osrs';

export const UI_STYLE_KEY = 'fate_ui_style_v1';
const CHANGE_EVENT = 'fate:ui-style';

export const defaultUiStyle = (): UiStyle =>
  import.meta.env.VITE_DEFAULT_UI_STYLE === 'osrs' ? 'osrs' : 'classic';

export const readUiStyle = (): UiStyle => {
  try {
    const raw = localStorage.getItem(UI_STYLE_KEY);
    if (raw === 'osrs' || raw === 'classic') return raw;
  } catch { /* storage blocked: fall back to the build default */ }
  return defaultUiStyle();
};

/** Mirrors the style onto <html data-ui> so the OSRS skin stylesheet can scope to it. */
export const applyUiStyle = (style: UiStyle = readUiStyle()): void => {
  if (typeof document !== 'undefined') document.documentElement.dataset.ui = style;
};

export const setUiStyle = (style: UiStyle): void => {
  try { localStorage.setItem(UI_STYLE_KEY, style); } catch { /* ignore */ }
  applyUiStyle(style);
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

export const useUiStyle = (): UiStyle => useSyncExternalStore(subscribe, readUiStyle, defaultUiStyle);

export const useIsOsrsUi = (): boolean => useUiStyle() === 'osrs';
