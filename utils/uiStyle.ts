import { useSyncExternalStore } from 'react';
import { LEGACY_SAVE_KEY, PROFILE_METADATA_BACKUP_KEY, PROFILES_KEY } from './profileMetadata';

/**
 * Which interface the viewer sees: the classic tracker layout or the OSRS
 * interface layout. A per-viewer preference, kept in localStorage outside
 * GameState so it never travels with saves, sync codes or exports.
 *
 * Without a saved choice, the default depends on the browser (see
 * decideDefaultUiStyle): a new visitor, with no run in this browser, starts in
 * the OSRS layout; a browser that already held a run keeps the classic one. The
 * default is worked out once and recorded under UI_DEFAULT_KEY, so starting a
 * run does not flip a new visitor back to classic on the next load. That record
 * is not a choice: the Settings toggle writes UI_STYLE_KEY, which always wins.
 * VITE_DEFAULT_UI_STYLE ('osrs' or 'classic') at build time overrides the
 * default for everyone.
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
/** How the OSRS layout marks a skill or slot tier: Roman numerals, or the older cut gems. */
export type TierMarks = 'numerals' | 'gems';

export const UI_STYLE_KEY = 'fate_ui_style_v1';
/** The default this browser was given when it first opened the tracker (not a choice). */
export const UI_DEFAULT_KEY = 'fate_ui_default_v1';
export const INTERFACE_STYLE_KEY = 'fate_osrs_interface_style_v1';
export const CLIENT_LAYOUT_KEY = 'fate_osrs_client_layout_v1';
export const TEXT_SIZE_KEY = 'fate_osrs_text_size_v1';
export const TIER_MARKS_KEY = 'fate_osrs_tier_marks_v1';
const CHANGE_EVENT = 'fate:ui-style';

export const DEFAULT_INTERFACE_STYLE: InterfaceStyle = '2007';
export const DEFAULT_CLIENT_LAYOUT: ClientLayout = 'resizable';
export const DEFAULT_TEXT_SIZE: TextSize = 'normal';
export const DEFAULT_TIER_MARKS: TierMarks = 'numerals';

const isUiStyle = (value: unknown): value is UiStyle => value === 'classic' || value === 'osrs';

export interface UiDefaultInputs {
  /** VITE_DEFAULT_UI_STYLE at build time; 'osrs' or 'classic' sets the default for everyone. */
  envDefault?: string | null;
  /** The default recorded on this browser's first visit (UI_DEFAULT_KEY), if any. */
  storedDefault: string | null;
  /** Whether this browser already holds a run (a profile list or a save). */
  hasExistingRun: boolean;
  /** The streamer overlay (#/overlay) keeps the classic look. */
  overlay?: boolean;
}

/**
 * The layout a viewer gets before choosing one in Settings. A new visitor (no
 * run in this browser) starts in the OSRS layout; a browser that already held
 * a run keeps the classic one it has always shown. Narrow screens still draw
 * the classic layout (see decideEffectiveUiStyle), whatever the default.
 */
export const decideDefaultUiStyle = ({ envDefault, storedDefault, hasExistingRun, overlay = false }: UiDefaultInputs): UiStyle => {
  if (isUiStyle(envDefault)) return envDefault;
  if (overlay) return 'classic';
  if (isUiStyle(storedDefault)) return storedDefault;
  return hasExistingRun ? 'classic' : 'osrs';
};

/** The layout in force: an explicit choice from Settings always wins over the default. */
export const decideUiStyle = (storedChoice: string | null, inputs: UiDefaultInputs): UiStyle =>
  isUiStyle(storedChoice) ? storedChoice : decideDefaultUiStyle(inputs);

/** The layout actually drawn: narrow screens always get classic. */
export const decideEffectiveUiStyle = (style: UiStyle, wideEnough: boolean): UiStyle =>
  style === 'osrs' && wideEnough ? 'osrs' : 'classic';

type KeyedStorage = Pick<Storage, 'getItem' | 'key' | 'length'>;

/** Whether this browser holds a run: the profile list (or its backup), a profile's save, or the pre-profiles save. */
export const storageHasRun = (storage: KeyedStorage): boolean => {
  try {
    if ([PROFILES_KEY, PROFILE_METADATA_BACKUP_KEY, LEGACY_SAVE_KEY].some(key => storage.getItem(key) !== null)) return true;
    for (let i = 0; i < storage.length; i++) {
      if (storage.key(i)?.startsWith('FATE_PROFILE_')) return true;
    }
  } catch { /* storage blocked: nothing can be saved here, so no run either */ }
  return false;
};

/**
 * This browser's default layout. Worked out once, before the first paint
 * (index.tsx calls applyUiStyle before the app can create a profile), and
 * recorded so that the run a new visitor then starts does not turn them into
 * an "existing player" on the next load.
 */
export const defaultUiStyle = (): UiStyle => {
  const envDefault = import.meta.env.VITE_DEFAULT_UI_STYLE;
  const overlay = isOverlayRoute();
  let storedDefault: string | null = null;
  try { storedDefault = localStorage.getItem(UI_DEFAULT_KEY); } catch { /* blocked: decide afresh */ }
  if (isUiStyle(envDefault) || overlay || isUiStyle(storedDefault)) {
    return decideDefaultUiStyle({ envDefault, storedDefault, hasExistingRun: false, overlay });
  }
  let hasExistingRun = false;
  try { hasExistingRun = storageHasRun(localStorage); } catch { /* blocked: no run */ }
  const style = decideDefaultUiStyle({ storedDefault: null, hasExistingRun });
  writeChoice(UI_DEFAULT_KEY, style);
  return style;
};

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

export const readUiStyle = (): UiStyle => {
  let storedChoice: string | null = null;
  try { storedChoice = localStorage.getItem(UI_STYLE_KEY); } catch { /* blocked: use the default */ }
  return isUiStyle(storedChoice) ? storedChoice : defaultUiStyle();
};
export const readInterfaceStyle = (): InterfaceStyle =>
  readChoice<InterfaceStyle>(INTERFACE_STYLE_KEY, ['2007', '2010'], DEFAULT_INTERFACE_STYLE);
export const readClientLayout = (): ClientLayout =>
  readChoice<ClientLayout>(CLIENT_LAYOUT_KEY, ['resizable', 'fixed'], DEFAULT_CLIENT_LAYOUT);
export const readTextSize = (): TextSize =>
  readChoice<TextSize>(TEXT_SIZE_KEY, ['normal', 'medium', 'large'], DEFAULT_TEXT_SIZE);
export const readTierMarks = (): TierMarks =>
  readChoice<TierMarks>(TIER_MARKS_KEY, ['numerals', 'gems'], DEFAULT_TIER_MARKS);

/**
 * The OSRS layout is drawn for desktop-sized windows; below this width its
 * fixed side panels leave no room (the World tab's areas column shrinks to
 * nothing), so narrow screens show the classic layout while the choice stays
 * saved. Widening the window brings the OSRS layout back.
 */
export const OSRS_MIN_WIDTH = 720;
const WIDE_QUERY = `(min-width: ${OSRS_MIN_WIDTH}px)`;

/** True when the window is wide enough for the OSRS layout (always true where matchMedia is missing). */
export const isWideEnoughForOsrs = (): boolean => {
  try {
    return typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia(WIDE_QUERY).matches;
  } catch { return true; }
};

/** The layout actually drawn: the saved choice, except that narrow screens always get classic. */
export const readEffectiveUiStyle = (): UiStyle => decideEffectiveUiStyle(readUiStyle(), isWideEnoughForOsrs());

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
  root.ui = decideEffectiveUiStyle(style, isWideEnoughForOsrs());
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
export const setTierMarks = (value: TierMarks): void => setOption(TIER_MARKS_KEY, value);

const subscribe = (onChange: () => void) => {
  // Another tab changed a choice: re-mirror it here too, then re-render.
  const onStorage = () => { applyUiStyle(); onChange(); };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  // Crossing the minimum width switches between the OSRS and classic layouts.
  let media: MediaQueryList | null = null;
  try { media = typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null; } catch { media = null; }
  media?.addEventListener?.('change', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
    media?.removeEventListener?.('change', onStorage);
  };
};

/** The saved choice (what the menus show as on or off). */
export const useUiStyle = (): UiStyle => useSyncExternalStore(subscribe, readUiStyle, defaultUiStyle);

/** Whether the OSRS layout is drawn: the saved choice on a wide enough window. */
export const useIsOsrsUi = (): boolean =>
  useSyncExternalStore(subscribe, readEffectiveUiStyle, defaultUiStyle) === 'osrs';

/** Whether the window is wide enough for the OSRS layout, kept current on resize. */
export const useIsWideEnoughForOsrs = (): boolean =>
  useSyncExternalStore(subscribe, isWideEnoughForOsrs, () => true);

export const useInterfaceStyle = (): InterfaceStyle =>
  useSyncExternalStore(subscribe, readInterfaceStyle, () => DEFAULT_INTERFACE_STYLE);

export const useClientLayout = (): ClientLayout =>
  useSyncExternalStore(subscribe, readClientLayout, () => DEFAULT_CLIENT_LAYOUT);

export const useTextSize = (): TextSize =>
  useSyncExternalStore(subscribe, readTextSize, () => DEFAULT_TEXT_SIZE);

export const useTierMarks = (): TierMarks =>
  useSyncExternalStore(subscribe, readTierMarks, () => DEFAULT_TIER_MARKS);
