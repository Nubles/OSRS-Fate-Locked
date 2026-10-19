// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { randomUnlockPool, randomUnlockTables } from '../utils/gameEngine';
import { chanceWithin, keysToTarget, rangeShare } from '../utils/fateForecast';
import { TableType } from '../types';

const game = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('../context/GameContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../context/GameContext')>()),
  useGame: () => game.current,
}));
vi.mock('./SectionGuide', () => ({ SectionGuide: () => null }));

afterEach(() => cleanup());

describe('FateForecastModal', () => {
  it('shows the real chances for the first table, not "most likely" or a flat 80%', async () => {
    const state = { ...createFreshState(), gameModeId: 'vanilla', keys: 0 };
    game.current = state;
    const { FateForecastModal } = await import('./FateForecastModal');
    render(<FateForecastModal onClose={vi.fn()} />);

    // The detail opens on the first table that still has something to draw.
    const first = randomUnlockTables('vanilla')
      .filter(table => table !== TableType.SKILLS && table !== TableType.EQUIPMENT)
      .map(table => randomUnlockPool(state.unlocks, 'vanilla', 'key', table).length)
      .find(remaining => remaining > 0)!;
    const forecast = keysToTarget(first);
    const text = document.body.textContent ?? '';
    expect(text).toContain(`${forecast.p50}Keys or fewer: a ${Math.round(chanceWithin(forecast, forecast.p50) * 100)}% chance`);
    expect(text).toContain(`A ${Math.round(rangeShare(forecast) * 100)}% chance within ${forecast.p10}–${forecast.p90} Keys`);
    expect(text).not.toContain('most likely');
  });
});

describe('FateForecastModal keyboard access', () => {
  it('takes focus on open, keeps Tab inside, closes on Escape and hands focus back', async () => {
    // jsdom has no layout; count attached elements as visible for the trap.
    const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() { return (this as HTMLElement).parentNode; },
    });
    try {
      game.current = { ...createFreshState(), gameModeId: 'vanilla', keys: 0 };
      const { FateForecastModal } = await import('./FateForecastModal');
      const opener = document.createElement('button');
      opener.textContent = 'Forecast';
      document.body.appendChild(opener);
      opener.focus();
      const onClose = vi.fn();
      const { unmount } = render(<FateForecastModal onClose={onClose} />);

      const dialog = screen.getByRole('dialog', { name: 'Fate Forecast' });
      expect(dialog.contains(document.activeElement)).toBe(true);

      const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
      const last = buttons[buttons.length - 1];
      last.focus();
      fireEvent.keyDown(last, { key: 'Tab' });
      expect(document.activeElement).toBe(buttons[0]);
      fireEvent.keyDown(buttons[0], { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      unmount();
      expect(document.activeElement).toBe(opener);
      opener.remove();
    } finally {
      if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
    }
  });
});
