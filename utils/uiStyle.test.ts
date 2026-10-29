// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_LAYOUT_KEY,
  INTERFACE_STYLE_KEY,
  TEXT_SIZE_KEY,
  TIER_MARKS_KEY,
  UI_DEFAULT_KEY,
  UI_STYLE_KEY,
  applyUiStyle,
  decideDefaultUiStyle,
  decideEffectiveUiStyle,
  decideUiStyle,
  defaultUiStyle,
  readClientLayout,
  readInterfaceStyle,
  readTextSize,
  readTierMarks,
  readEffectiveUiStyle,
  readUiStyle,
  setClientLayout,
  setInterfaceStyle,
  setTextSize,
  setTierMarks,
  setUiStyle,
  storageHasRun,
} from './uiStyle';

const stored = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value); },
  removeItem: (key: string) => { stored.delete(key); },
  key: (index: number) => [...stored.keys()][index] ?? null,
  get length() { return stored.size; },
};
const blockedStorage = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('SecurityError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

const html = () => document.documentElement;

beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', memoryStorage);
  for (const name of ['ui', 'osrsStyle', 'osrsClient', 'osrsText']) delete html().dataset[name];
  window.location.hash = '';
});
afterEach(() => vi.unstubAllGlobals());

describe('OSRS layout options', () => {
  it('default to the 2007 style, the resizable client, normal text and numeral tier marks', () => {
    expect(readInterfaceStyle()).toBe('2007');
    expect(readClientLayout()).toBe('resizable');
    expect(readTextSize()).toBe('normal');
    expect(readTierMarks()).toBe('numerals');
  });

  it('read back what was written', () => {
    setInterfaceStyle('2010');
    setClientLayout('fixed');
    setTextSize('large');
    setTierMarks('gems');
    expect(stored.get(TIER_MARKS_KEY)).toBe('gems');
    expect(readTierMarks()).toBe('gems');
    expect(stored.get(INTERFACE_STYLE_KEY)).toBe('2010');
    expect(stored.get(CLIENT_LAYOUT_KEY)).toBe('fixed');
    expect(stored.get(TEXT_SIZE_KEY)).toBe('large');
    expect(readInterfaceStyle()).toBe('2010');
    expect(readClientLayout()).toBe('fixed');
    expect(readTextSize()).toBe('large');
  });

  it('ignore garbage values and fall back to the defaults', () => {
    stored.set(INTERFACE_STYLE_KEY, '2012');
    stored.set(CLIENT_LAYOUT_KEY, 'FIXED');
    stored.set(TEXT_SIZE_KEY, '{"size":"large"}');
    stored.set(TIER_MARKS_KEY, 'Gems');
    stored.set(UI_STYLE_KEY, 'osrs ');
    expect(readInterfaceStyle()).toBe('2007');
    expect(readClientLayout()).toBe('resizable');
    expect(readTextSize()).toBe('normal');
    expect(readTierMarks()).toBe('numerals');
    expect(readUiStyle()).toBe(defaultUiStyle());
  });

  it('fall back to the defaults when storage is blocked, and writing does not throw', () => {
    vi.stubGlobal('localStorage', blockedStorage);
    expect(readInterfaceStyle()).toBe('2007');
    expect(readClientLayout()).toBe('resizable');
    expect(readTextSize()).toBe('normal');
    expect(() => setInterfaceStyle('2010')).not.toThrow();
    expect(() => setClientLayout('fixed')).not.toThrow();
    expect(() => setTextSize('large')).not.toThrow();
    expect(() => setTierMarks('gems')).not.toThrow();
    expect(() => setUiStyle('osrs')).not.toThrow();
  });

  it('mirror every choice onto <html> data attributes', () => {
    applyUiStyle('classic');
    expect(html().dataset.ui).toBe('classic');
    expect(html().getAttribute('data-osrs-style')).toBe('2007');
    expect(html().getAttribute('data-osrs-client')).toBe('resizable');
    expect(html().getAttribute('data-osrs-text')).toBe('normal');

    setUiStyle('osrs');
    setInterfaceStyle('2010');
    setClientLayout('fixed');
    setTextSize('large');
    expect(html().dataset.ui).toBe('osrs');
    expect(html().getAttribute('data-osrs-style')).toBe('2010');
    expect(html().getAttribute('data-osrs-client')).toBe('fixed');
    expect(html().getAttribute('data-osrs-text')).toBe('large');
  });

  it('never frame the streamer overlay as a fixed client', () => {
    stored.set(CLIENT_LAYOUT_KEY, 'fixed');
    window.location.hash = '#/overlay?code=XYZ';
    applyUiStyle();
    expect(html().getAttribute('data-osrs-client')).toBe('resizable');
  });

  it('tell subscribers about each change', () => {
    const seen = vi.fn();
    window.addEventListener('fate:ui-style', seen);
    setInterfaceStyle('2010');
    setClientLayout('fixed');
    setTextSize('large');
    window.removeEventListener('fate:ui-style', seen);
    expect(seen).toHaveBeenCalledTimes(3);
  });
});

describe('OSRS layout on narrow screens', () => {
  const stubWidth = (wide: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide, media: query, addEventListener: () => {}, removeEventListener: () => {} }));

  it('draws the classic layout below the minimum width but keeps the saved choice', () => {
    stubWidth(false);
    setUiStyle('osrs');
    expect(readUiStyle()).toBe('osrs');
    expect(readEffectiveUiStyle()).toBe('classic');
    expect(html().dataset.ui).toBe('classic');
  });

  it('draws the OSRS layout on wide screens', () => {
    stubWidth(true);
    setUiStyle('osrs');
    expect(readEffectiveUiStyle()).toBe('osrs');
    expect(html().dataset.ui).toBe('osrs');
  });

  it('never turns the OSRS layout on by itself', () => {
    stubWidth(true);
    setUiStyle('classic');
    expect(readEffectiveUiStyle()).toBe('classic');
  });
});

describe('the default layout (no choice made in Settings)', () => {
  const newVisitor = { storedDefault: null, hasExistingRun: false };
  const existingPlayer = { storedDefault: null, hasExistingRun: true };
  const drawn = (choice: string | null, inputs: Parameters<typeof decideUiStyle>[1], wide: boolean) =>
    decideEffectiveUiStyle(decideUiStyle(choice, inputs), wide);

  it('starts a new visitor on a wide screen in the OSRS layout', () => {
    expect(drawn(null, newVisitor, true)).toBe('osrs');
  });

  it('draws the classic layout for a new visitor on a narrow screen', () => {
    expect(decideUiStyle(null, newVisitor)).toBe('osrs');
    expect(drawn(null, newVisitor, false)).toBe('classic');
  });

  it('keeps the classic layout for a browser that already holds a run', () => {
    expect(drawn(null, existingPlayer, true)).toBe('classic');
  });

  it('always lets an explicit choice win', () => {
    expect(drawn('classic', newVisitor, true)).toBe('classic');
    expect(drawn('osrs', existingPlayer, true)).toBe('osrs');
    expect(drawn('osrs', { ...newVisitor, envDefault: 'classic' }, true)).toBe('osrs');
    expect(drawn('classic', { ...existingPlayer, envDefault: 'osrs' }, true)).toBe('classic');
    // Narrow screens still draw classic, whatever was chosen.
    expect(drawn('osrs', existingPlayer, false)).toBe('classic');
  });

  it('lets the build setting override the default for everyone', () => {
    expect(drawn(null, { ...existingPlayer, envDefault: 'osrs' }, true)).toBe('osrs');
    expect(drawn(null, { ...newVisitor, envDefault: 'classic' }, true)).toBe('classic');
    expect(drawn(null, { ...newVisitor, storedDefault: 'osrs', envDefault: 'classic' }, true)).toBe('classic');
    // Anything else in the setting is ignored.
    expect(drawn(null, { ...newVisitor, envDefault: '' }, true)).toBe('osrs');
    expect(drawn(null, { ...existingPlayer, envDefault: 'OSRS' }, true)).toBe('classic');
  });

  it('keeps the default recorded on the first visit, run or no run', () => {
    expect(decideDefaultUiStyle({ storedDefault: 'osrs', hasExistingRun: true })).toBe('osrs');
    expect(decideDefaultUiStyle({ storedDefault: 'classic', hasExistingRun: false })).toBe('classic');
    expect(decideDefaultUiStyle({ storedDefault: 'fixed', hasExistingRun: true })).toBe('classic');
  });

  it('keeps the streamer overlay classic', () => {
    expect(decideDefaultUiStyle({ ...newVisitor, overlay: true })).toBe('classic');
  });

  it('counts the profile list, a profile save or the pre-profiles save as a run', () => {
    expect(storageHasRun(memoryStorage)).toBe(false);
    stored.set(UI_STYLE_KEY, 'osrs');
    stored.set('fate_features_seen_v1_abc', '[]');
    expect(storageHasRun(memoryStorage)).toBe(false);
    for (const key of ['FATE_PROFILES', 'FATE_PROFILES__backup', 'FATE_UIM_SAVE_V1', 'FATE_PROFILE_abc']) {
      stored.clear();
      stored.set(key, '{}');
      expect(storageHasRun(memoryStorage)).toBe(true);
    }
    expect(storageHasRun(blockedStorage as unknown as Storage)).toBe(false);
  });
});

describe('the default layout in this browser', () => {
  const stubWidth = (wide: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide, media: query, addEventListener: () => {}, removeEventListener: () => {} }));

  beforeEach(() => { vi.stubEnv('VITE_DEFAULT_UI_STYLE', ''); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('opens a new visitor in the OSRS layout and stays there once they start a run', () => {
    stubWidth(true);
    applyUiStyle();
    expect(html().dataset.ui).toBe('osrs');
    expect(stored.get(UI_DEFAULT_KEY)).toBe('osrs');
    // The default is not a choice: Settings stays free to record one.
    expect(stored.has(UI_STYLE_KEY)).toBe(false);
    stored.set('FATE_PROFILES', '{}');
    stored.set('FATE_PROFILE_abc', '{}');
    expect(readUiStyle()).toBe('osrs');
    expect(readEffectiveUiStyle()).toBe('osrs');
  });

  it('keeps an existing player in the classic layout', () => {
    stubWidth(true);
    stored.set('FATE_PROFILES', '{}');
    applyUiStyle();
    expect(html().dataset.ui).toBe('classic');
    expect(stored.get(UI_DEFAULT_KEY)).toBe('classic');
    stored.clear();
    expect(readUiStyle()).toBe('osrs');
    stored.set(UI_DEFAULT_KEY, 'classic');
    expect(readUiStyle()).toBe('classic');
  });

  it('follows the narrow-screen rule for a new visitor without saving a choice', () => {
    stubWidth(false);
    applyUiStyle();
    expect(html().dataset.ui).toBe('classic');
    expect(readUiStyle()).toBe('osrs');
    expect(stored.has(UI_STYLE_KEY)).toBe(false);
    // Widening the window brings the OSRS layout, as for a saved OSRS choice.
    stubWidth(true);
    applyUiStyle();
    expect(html().dataset.ui).toBe('osrs');
  });

  it('lets a choice made in Settings win over the default', () => {
    stubWidth(true);
    setUiStyle('classic');
    expect(readEffectiveUiStyle()).toBe('classic');
    expect(html().dataset.ui).toBe('classic');
  });

  it('still honours the build setting', () => {
    stubWidth(true);
    vi.stubEnv('VITE_DEFAULT_UI_STYLE', 'osrs');
    stored.set('FATE_PROFILES', '{}');
    expect(readEffectiveUiStyle()).toBe('osrs');
    vi.stubEnv('VITE_DEFAULT_UI_STYLE', 'classic');
    stored.clear();
    expect(readEffectiveUiStyle()).toBe('classic');
    // A forced default is not recorded as this browser's own.
    expect(stored.has(UI_DEFAULT_KEY)).toBe(false);
  });

  it('keeps the streamer overlay classic without recording a default', () => {
    stubWidth(true);
    window.location.hash = '#/overlay?code=XYZ';
    applyUiStyle();
    expect(html().dataset.ui).toBe('classic');
    expect(stored.has(UI_DEFAULT_KEY)).toBe(false);
  });

  it('starts in the OSRS layout when storage is blocked', () => {
    stubWidth(true);
    vi.stubGlobal('localStorage', blockedStorage);
    expect(readEffectiveUiStyle()).toBe('osrs');
  });
});
