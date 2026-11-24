// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_STYLE_KEY } from '../utils/uiStyle';

const baseUnlocks = {
  bosses: ['Vorkath'], regions: [], chunks: [], minigames: [], guilds: [], mobility: [], arcana: [],
  housing: [], storage: [], merchants: [], farming: [], skills: { Attack: 1 }, equipment: {},
};
const game = vi.hoisted(() => ({ unlocks: null as unknown as Record<string, unknown> }));
vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: game.unlocks,
    history: [
      { id: 'u1', type: 'UNLOCK', timestamp: Date.parse('2026-09-19T12:00:00Z'), message: 'Unlocked Vorkath', meta: { item: 'Vorkath' } },
      { id: 'u2', type: 'UNLOCK', timestamp: Date.parse('2026-09-20T12:00:00Z'), message: 'Unlocked Lumbridge', meta: { item: '12850', category: 'Banks' } },
    ],
  }),
}));

import { FateThread } from './FateThread';

beforeEach(() => { game.unlocks = baseUnlocks; });
afterEach(() => {
  cleanup();
  localStorage.removeItem(UI_STYLE_KEY);
});

describe('FateThread', () => {
  it('keeps the classic header and glowing stars in the classic layout', () => {
    render(<FateThread onClose={vi.fn()} />);
    expect(screen.getByText('2 unlocks across 2 tables')).toBeTruthy();
    expect(document.querySelector('.owb-thread')).toBeNull();
    expect(document.querySelector('radialGradient#fateCore')).toBeTruthy();
  });

  it('draws a stone window with stone buttons and flat dots in the OSRS layout', () => {
    localStorage.setItem(UI_STYLE_KEY, 'osrs');
    const onClose = vi.fn();
    render(<FateThread onClose={onClose} />);
    expect(screen.getByRole('heading', { name: 'Fate Thread' })).toBeTruthy();
    expect(screen.getByText('2 unlocks across 2 tables')).toBeTruthy();
    for (const name of ['Replay', 'Zoom in', 'Zoom out', 'Fit']) {
      expect(screen.getByRole('button', { name }).className).toContain('osrs-btn');
    }
    // No glow: no drop-shadow filters and no radial core.
    expect(document.querySelector('radialGradient')).toBeNull();
    for (const dot of document.querySelectorAll('circle')) expect((dot as SVGElement).style.filter).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('draws Bank and Slayer unlocks too, banks by their place name (chunked-fate.d1[1])', () => {
    localStorage.setItem(UI_STYLE_KEY, 'osrs');
    game.unlocks = { ...baseUnlocks, banks: ['12850', '12342'], slayerUnlocks: ['Broader Fletching'] };
    const { container } = render(<FateThread onClose={vi.fn()} />);
    expect(screen.getByText('5 unlocks across 4 tables')).toBeTruthy();
    const legend = container.querySelector('.owb-thread-legend')!.textContent;
    expect(legend).toContain('Banks2');
    expect(legend).toContain('Slayer1');
    // Each table keeps its own colour, not the shared grey fallback.
    const hubs = [...container.querySelectorAll('.owb-thread-legend-row .dot')].map(d => (d as HTMLElement).style.background);
    expect(new Set(hubs).size).toBe(hubs.length);
    // A bank reads by its name, and its time comes from the log entry keyed by its id.
    const tips = [...container.querySelectorAll('circle')].map(c => {
      fireEvent.mouseEnter(c);
      return container.querySelector('.owb-thread-tip')?.textContent ?? '';
    });
    expect(tips.find(t => t.startsWith('Lumbridge Castle'))).toMatch(/^Lumbridge CastleBanks · unlocked (?!seeded)/);
    expect(tips.some(t => t.startsWith('EdgevilleBanks'))).toBe(true);
    expect(tips.some(t => t.startsWith('Broader FletchingSlayer'))).toBe(true);
  });
});

