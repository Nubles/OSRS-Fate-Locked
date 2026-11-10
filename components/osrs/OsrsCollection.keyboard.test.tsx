// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../../context/GameContext';
import OsrsCollection from './OsrsCollection';

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined, clear: () => undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe('OSRS Collection screen keyboard access', () => {
  it('lets the keyboard reach its scrolling panels, which hold no controls of their own', () => {
    const html = renderToStaticMarkup(<GameProvider storageKey="osrs-collection-keyboard-test"><OsrsCollection /></GameProvider>);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const panels = Array.from(doc.querySelectorAll('[role="group"][tabindex="0"]'));
    expect(panels.map(panel => panel.getAttribute('aria-label'))).toEqual(['Unlock coverage', 'Collection log rolls']);
    for (const panel of panels) {
      expect(panel.getAttribute('style')).toContain('overflow-y:auto');
      expect(panel.querySelector('button, a[href], input, select, textarea')).toBeNull();
    }
  });
});
