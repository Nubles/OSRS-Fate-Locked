// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { REGIONS_LIST, ROLLABLE_POH_ITEMS } from '../data/items';
import { setStartArea } from '../utils/freeAreas';
import { randomUnlockPool } from '../utils/gameEngine';
import { TableType } from '../types';

const game = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../context/GameContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../context/GameContext')>()),
  useGame: () => game.current,
}));

afterEach(() => {
  cleanup();
  setStartArea(undefined);
});

const renderWith = async (unlocks: ReturnType<typeof createFreshState>['unlocks'], gameModeId = 'vanilla') => {
  game.current = { ...createFreshState(), keys: 5, unlocks, gameModeId, rollUnlock: vi.fn() };
  const { GachaSection } = await import('./GachaSection');
  render(<GachaSection />);
};

const card = (label: string) => screen.getByRole('button', { name: `Roll ${label}` }) as HTMLButtonElement;

describe('Spend Keys cards', () => {
  it('block a table whose remaining entries are all ineligible instead of offering Roll', async () => {
    const fresh = createFreshState().unlocks;
    const eligible = randomUnlockPool(fresh, 'vanilla', 'key', TableType.BOSSES).map(entry => entry.item);
    expect(eligible.length).toBeGreaterThan(0);

    await renderWith({ ...fresh, bosses: eligible });

    const bosses = card('Bosses');
    expect(bosses.disabled).toBe(true);
    expect(bosses.textContent).toContain('Blocked');
    expect(bosses.textContent).not.toContain('Done');
  });

  it('count Housing against the rollable facilities, excluding retired ones', async () => {
    await renderWith(createFreshState().unlocks);

    expect(card('Housing').textContent).toContain(`0/${ROLLABLE_POH_ITEMS.length}`);
  });
});

describe('Spend Keys Areas card', () => {
  it("counts legacy Xtreme's locked Misthalin areas and keeps rolling once only they remain", async () => {
    setStartArea('lumbridge');
    await renderWith({ ...createFreshState().unlocks, regions: [...REGIONS_LIST] }, 'xtreme');

    const areas = card('Areas');
    expect(areas.textContent).toContain(`${REGIONS_LIST.length}/${REGIONS_LIST.length + 8}`);
    expect(areas.disabled).toBe(false);
  });

  it('keeps the Vanilla Areas total to the areas outside Misthalin', async () => {
    await renderWith(createFreshState().unlocks);

    expect(card('Areas').textContent).toContain(`0/${REGIONS_LIST.length}`);
  });
});
