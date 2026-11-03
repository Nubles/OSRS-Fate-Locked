// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { readCollapsed, SHORT_SCREEN_PX } from './OsrsChatbox';

const KEY = 'fate_osrs_chat_collapsed_v1';
const setHeight = (px: number) => Object.defineProperty(window, 'innerHeight', { value: px, configurable: true });

describe('the OSRS chatbox fold (layout review #9)', () => {
  afterEach(() => { localStorage.clear(); setHeight(768); });

  it('starts folded on a screen shorter than 850 px and open on a taller one', () => {
    setHeight(768);
    expect(readCollapsed()).toBe(true);
    setHeight(SHORT_SCREEN_PX);
    expect(readCollapsed()).toBe(false);
  });

  it('keeps the viewer’s own choice whatever the screen', () => {
    setHeight(768);
    localStorage.setItem(KEY, '0');
    expect(readCollapsed()).toBe(false);
    setHeight(1080);
    localStorage.setItem(KEY, '1');
    expect(readCollapsed()).toBe(true);
  });
});
