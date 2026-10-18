// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { FATE_MAP_PREF_KEYS, readFateMapPref } from './fateMapPrefs';
import { setFateMapPref, useFateMapPref } from './fateMapPrefsHook';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('fate map prefs', () => {
  it('are both on by default', () => {
    expect(readFateMapPref('fog')).toBe(true);
    expect(readFateMapPref('spin')).toBe(true);
  });

  it('keep each choice per viewer in its own localStorage key', () => {
    setFateMapPref('fog', false);
    expect(localStorage.getItem(FATE_MAP_PREF_KEYS.fog)).toBe('off');
    expect(readFateMapPref('fog')).toBe(false);
    expect(readFateMapPref('spin')).toBe(true);
    setFateMapPref('fog', true);
    expect(readFateMapPref('fog')).toBe(true);
  });

  it('ignore stored values they do not know', () => {
    localStorage.setItem(FATE_MAP_PREF_KEYS.spin, 'maybe');
    expect(readFateMapPref('spin')).toBe(true);
  });

  it('last this page only when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readFateMapPref('spin')).toBe(true);
    expect(() => setFateMapPref('spin', false)).not.toThrow();
    expect(readFateMapPref('spin')).toBe(false);
    setFateMapPref('spin', true);
  });

  it('re-render their hook when a choice changes', () => {
    const { result } = renderHook(() => useFateMapPref('fog'));
    expect(result.current).toBe(true);
    act(() => setFateMapPref('fog', false));
    expect(result.current).toBe(false);
  });
});
