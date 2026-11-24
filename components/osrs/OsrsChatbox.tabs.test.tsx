/* @vitest-environment jsdom */
// The chatbox's tabs are the History panel's filters: Game keeps what the
// History Level filter keeps (achievement rewards too) and Rolls keeps a lost
// Chunked Breakthrough, which is stored as a LEVEL_UP but is a fate roll.
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { historyFilterMatches, type HistoryFilter } from '../LogViewer';
import type { LogEntry } from '../../types';

const game: { current: Record<string, unknown> } = { current: {} };
vi.mock('../../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
  return { ...actual, useGame: () => game.current };
});
vi.mock('../../context/ProfileContext', () => ({ useProfiles: () => ({ activeProfileName: 'Run' }) }));
vi.mock('../../utils/osrsNav', async () => {
  const actual = await vi.importActual<typeof import('../../utils/osrsNav')>('../../utils/osrsNav');
  return { ...actual, useOsrsNav: () => ({ screen: 'home', progressionWide: false }) };
});
vi.mock('./OsrsShellChatNotices', () => ({ useOsrsChatNotices: () => [] }));

const history: LogEntry[] = [
  { id: 'a', timestamp: 1, type: 'ACHIEVEMENT', message: 'Achievement back pay', details: 'For the 2 achievements: +4 Fate.' },
  { id: 'b', timestamp: 2, type: 'LEVEL_UP', message: 'No Breakthrough for Mining', meta: { breakthrough: 'Mining', tier: 3, won: false } },
  { id: 'c', timestamp: 3, type: 'LEVEL_UP', message: 'Attack reached level 10' },
  { id: 'd', timestamp: 4, type: 'ROLL_FAIL', message: 'The roll missed' },
  { id: 'e', timestamp: 5, type: 'UNLOCK', message: 'Unlocked Lumbridge' },
  { id: 'f', timestamp: 6, type: 'ALTAR', message: 'Ritual of the Gambler' },
] as LogEntry[];
const MESSAGES = history.map(h => h.message);

describe('the OSRS chatbox tabs match the History panel filters', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it.each<[string, HistoryFilter]>([
    ['All', 'ALL'],
    ['Game', 'PROGRESS'],
    ['Rolls', 'ROLLS'],
    ['Unlocks', 'UNLOCKS'],
    ['Rituals', 'RITUALS'],
  ])('the %s tab shows what the History %s filter shows', async (tab, filter) => {
    const { initialState } = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
    const { OsrsChatbox } = await import('./OsrsChatbox');
    localStorage.setItem('fate_osrs_chat_collapsed_v1', '0');
    game.current = { ...initialState, gameModeId: 'chunked', history, lastEvent: null, linkedAccount: '' };
    const r = render(<OsrsChatbox />);
    // All is the tab the chatbox opens on (clicking it again folds the box).
    if (tab !== 'All') fireEvent.click(screen.getByRole('tab', { name: tab }));
    const shown = MESSAGES.filter(m => (r.container.textContent ?? '').includes(m));
    expect(shown).toEqual(history.filter(h => historyFilterMatches(h, filter)).map(h => h.message));
  });

  it('files an achievement reward under Game and a lost Breakthrough under Rolls', async () => {
    const { initialState } = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
    const { OsrsChatbox } = await import('./OsrsChatbox');
    localStorage.setItem('fate_osrs_chat_collapsed_v1', '0');
    game.current = { ...initialState, gameModeId: 'chunked', history, lastEvent: null, linkedAccount: '' };
    const r = render(<OsrsChatbox />);
    fireEvent.click(screen.getByRole('tab', { name: 'Game' }));
    expect(r.container.textContent).toContain('Achievement back pay');
    expect(r.container.textContent).not.toContain('No Breakthrough for Mining');
    fireEvent.click(screen.getByRole('tab', { name: 'Rolls' }));
    expect(r.container.textContent).toContain('No Breakthrough for Mining');
    expect(r.container.textContent).not.toContain('Achievement back pay');
  });
});
