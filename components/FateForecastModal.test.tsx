// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
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
