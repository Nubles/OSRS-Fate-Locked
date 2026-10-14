import { useSyncExternalStore } from 'react';

/**
 * Which interface the viewer sees: the classic tracker layout or the OSRS
 * interface layout. A per-viewer preference, kept in localStorage outside
 * GameState so it never travels with saves, sync codes or exports.
 *
 * The default comes from VITE_DEFAULT_UI_STYLE at build time, so a preview
 * build can open in the OSRS layout while main keeps the classic one.
 *
 * The OSRS layout has three options of its own, kept the same way (per
 * viewer, outside GameState): the interface style (2007 brown stone or 2010
 * grey stone), the client layout (resizable or a fixed-width game client) and
 * the text size (normal, medium or large). All four are mirrored onto <html> data
 * attributes by applyUiStyle(), which index.tsx calls before the first paint:
 *   data-ui="classic|osrs"
 *   data-osrs-style="2007|2010"
 *   data-osrs-client="resizable|fixed"
 *   data-osrs-text="normal|medium|large"
 * The OSRS stylesheets scope to html[data-ui="osrs"], so the options have no
 * effect while the classic layout is on.
 */
export type UiStyle = 'classic' | 'osrs';
export type InterfaceStyle = '2007' | '2010';
export type ClientLayout = 'resizable' | 'fixed';
export type TextSize = 'normal' | 'medium' | 'large';

export const UI_STYLE_KEY = 'fate_ui_style_v1';
export const INTERFACE_STYLE_KEY = 'fate_osrs_interface_style_v1';
export const CLIENT_LAYOUT_KEY = 'fate_osrs_client_layout_v1';
export const TEXT_SIZE_KEY = 'fate_osrs_text_size_v1';
const CHANGE_EVENT = 'fate:ui-style';

export const DEFAULT_INTERFACE_STYLE: InterfaceStyle = '2007';
export const DEFAULT_CLIENT_LAYOUT: ClientLayout = 'resizable';
export const DEFAULT_TEXT_SIZE: TextSize = 'normal';

export const defaultUiStyle = (): UiStyle =>
  import.meta.env.VITE_DEFAULT_UI_STYLE === 'osrs' ? 'osrs' : 'classic';

/** Reads one stored choice; anything missing, unknown or unreadable gives the fallback. */
const readChoice = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null && (allowed as readonly string[]).includes(raw)) return raw as T;
  } catch { /* storage blocked: fall back to the default */ }
  return fallback;
};

const writeChoice = (key: string, value: string): void => {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: the choice lasts this page only */ }
};

const notify = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const readUiStyle = (): UiStyle => readChoice<UiStyle>(UI_STYLE_KEY, ['classic', 'osrs'], defaultUiStyle());
export const readInterfaceStyle = (): InterfaceStyle =>
  readChoice<InterfaceStyle>(INTERFACE_STYLE_KEY, ['2007', '2010'], DEFAULT_INTERFACE_STYLE);
export const readClientLayout = (): ClientLayout =>
  readChoice<ClientLayout>(CLIENT_LAYOUT_KEY, ['resizable', 'fixed'], DEFAULT_CLIENT_LAYOUT);
export const readTextSize = (): TextSize =>
  readChoice<TextSize>(TEXT_SIZE_KEY, ['normal', 'medium', 'large'], DEFAULT_TEXT_SIZE);

/** The streamer overlay (#/overlay) is a transparent badge bar: never frame it as a fixed client. */
const isOverlayRoute = (): boolean => {
  try { return typeof window !== 'undefined' && window.location.hash.startsWith('#/overlay'); } catch { return false; }
};

/**
 * Mirrors the layout and its OSRS options onto <html> data attributes so the
 * OSRS stylesheets can scope to them. Called before the first paint and after
 * every change.
 */
export const applyUiStyle = (style: UiStyle = readUiStyle()): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.dataset;
  root.ui = style;
  root.osrsStyle = readInterfaceStyle();
  root.osrsClient = isOverlayRoute() ? 'resizable' : readClientLayout();
  root.osrsText = readTextSize();
};

export const setUiStyle = (style: UiStyle): void => {
  writeChoice(UI_STYLE_KEY, style);
  applyUiStyle(style);
  notify();
};

const setOption = (key: string, value: string): void => {
  writeChoice(key, value);
  applyUiStyle();
  notify();
};

export const setInterfaceStyle = (value: InterfaceStyle): void => setOption(INTERFACE_STYLE_KEY, value);
export const setClientLayout = (value: ClientLayout): void => setOption(CLIENT_LAYOUT_KEY, value);
export const setTextSize = (value: TextSize): void => setOption(TEXT_SIZE_KEY, value);

const subscribe = (onChange: () => void) => {
  // Another tab changed a choice: re-mirror it here too, then re-render.
  const onStorage = () => { applyUiStyle(); onChange(); };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
};

export const useUiStyle = (): UiStyle => useSyncExternalStore(subscribe, readUiStyle, defaultUiStyle);

export const useIsOsrsUi = (): boolean => useUiStyle() === 'osrs';

export const useInterfaceStyle = (): InterfaceStyle =>
  useSyncExternalStore(subscribe, readInterfaceStyle, () => DEFAULT_INTERFACE_STYLE);

export const useClientLayout = (): ClientLayout =>
  useSyncExternalStore(subscribe, readClientLayout, () => DEFAULT_CLIENT_LAYOUT);

export const useTextSize = (): TextSize =>
  useSyncExternalStore(subscribe, readTextSize, () => DEFAULT_TEXT_SIZE);
