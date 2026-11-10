// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../../context/GameContext';
import { OsrsChatbox } from './OsrsChatbox';
import { OsrsJournalScreen } from './OsrsJournalScreen';

// The chatbox only reads the profile's name, for its input line.
vi.mock('../../context/ProfileContext', () => ({ useProfiles: () => ({ activeProfileName: 'Tester' }) }));

/**
 * A tablist may hold only tabs (WCAG 1.3.1, the ARIA "required owned elements" rule). Both
 * rows also carry other controls, which sit beside the tablist, in the same flex row.
 */
const parse = (node: React.ReactNode): Document => {
  const html = renderToStaticMarkup(<GameProvider storageKey="osrs-tablists-test">{node}</GameProvider>);
  return new DOMParser().parseFromString(html, 'text/html');
};

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined, clear: () => undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe('OSRS layout tab rows', () => {
  it('keeps the chat note, the fold button and Timelapse out of the chat filters', () => {
    const doc = parse(<OsrsChatbox />);
    const tablist = doc.querySelector('[role="tablist"][aria-label="Chat filters"]')!;
    const tabs = Array.from(tablist.children);
    // Clan broadcasts are on unless the player turns them off, so its tab shows too.
    expect(tabs.map(tab => tab.textContent)).toEqual(['All', 'Game', 'Rolls', 'Unlocks', 'Rituals', 'Clan']);
    expect(tabs.every(tab => tab.getAttribute('role') === 'tab')).toBe(true);
    // Still one flex row: the tablist adds no box of its own.
    expect(tablist.getAttribute('style')).toBe('display:contents');
    const row = tablist.parentElement!;
    expect(row.classList.contains('osrs-chat-tabs')).toBe(true);
    expect(row.hasAttribute('role')).toBe(false);
    const beside = Array.from(row.children).slice(1);
    expect(beside.map(el => el.tagName)).toEqual(['SPAN', 'BUTTON', 'BUTTON']);
    expect(beside[0].classList.contains('osrs-chat-note')).toBe(true);
    expect(beside[1].getAttribute('aria-label')).toMatch(/^(Show|Hide) the chatbox$/);
    expect(beside[2].textContent).toBe('Timelapse');
    expect(beside.some(el => el.hasAttribute('role'))).toBe(false);
  });

  it('keeps the search box and Filters out of the Journal sections', () => {
    const doc = parse(<OsrsJournalScreen />);
    const tablist = doc.querySelector('[role="tablist"][aria-label="Journal sections"]')!;
    const tabs = Array.from(tablist.children);
    expect(tabs.length).toBeGreaterThan(2);
    expect(tabs.every(tab => tab.getAttribute('role') === 'tab' && tab.classList.contains('ojs-tab'))).toBe(true);
    expect(tabs.filter(tab => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(tablist.getAttribute('style')).toBe('display:contents');
    const row = tablist.parentElement!;
    expect(row.classList.contains('ojs-tabs')).toBe(true);
    expect(row.hasAttribute('role')).toBe(false);
    expect(row.querySelector(':scope > .ojs-search input[aria-label="Search the journal"]')).not.toBeNull();
  });
});
