// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_LAYOUT_KEY,
  INTERFACE_STYLE_KEY,
  TEXT_SIZE_KEY,
  UI_STYLE_KEY,
  applyUiStyle,
  defaultUiStyle,
  readClientLayout,
  readInterfaceStyle,
  readTextSize,
  readUiStyle,
  setClientLayout,
  setInterfaceStyle,
  setTextSize,
  setUiStyle,
} from './uiStyle';

const stored = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value); },
  removeItem: (key: string) => { stored.delete(key); },
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
  it('default to the 2007 style, the resizable client and normal text', () => {
    expect(readInterfaceStyle()).toBe('2007');
    expect(readClientLayout()).toBe('resizable');
    expect(readTextSize()).toBe('normal');
  });

  it('read back what was written', () => {
    setInterfaceStyle('2010');
    setClientLayout('fixed');
    setTextSize('large');
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
    stored.set(UI_STYLE_KEY, 'osrs ');
    expect(readInterfaceStyle()).toBe('2007');
    expect(readClientLayout()).toBe('resizable');
    expect(readTextSize()).toBe('normal');
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
