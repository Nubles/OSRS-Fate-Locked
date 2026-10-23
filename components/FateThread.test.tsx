// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UI_STYLE_KEY } from '../utils/uiStyle';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: {
      bosses: ['Vorkath'], regions: [], chunks: [], minigames: [], guilds: [], mobility: [], arcana: [],
      housing: [], storage: [], merchants: [], farming: [], skills: { Attack: 1 }, equipment: {},
    },
    history: [{ id: 'u1', type: 'UNLOCK', timestamp: Date.parse('2026-09-19T12:00:00Z'), message: 'Unlocked Vorkath', meta: { item: 'Vorkath' } }],
  }),
}));

import { FateThread } from './FateThread';

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
});
