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
// A table whose random pool is empty though entries are left. Vanilla Keys no
// longer skip places the run can't reach, so the tests stand one in.
const blocked = vi.hoisted(() => ({ table: undefined as string | undefined }));
vi.mock('../utils/gameEngine', async importOriginal => {
  const engine = await importOriginal<typeof import('../utils/gameEngine')>();
  return {
    ...engine,
    randomUnlockPool: (...args: Parameters<typeof engine.randomUnlockPool>) =>
      args[3] !== undefined && args[3] === blocked.table ? [] : engine.randomUnlockPool(...args),
  };
});

afterEach(() => {
  cleanup();
  setStartArea(undefined);
  blocked.table = undefined;
});

const renderWith = async (unlocks: ReturnType<typeof createFreshState>['unlocks'], gameModeId = 'vanilla') => {
  game.current = { ...createFreshState(), keys: 5, unlocks, gameModeId, rollUnlock: vi.fn() };
  const { GachaSection } = await import('./GachaSection');
  render(<GachaSection />);
};

const card = (label: string) => screen.getByRole('button', { name: `Unlock from ${label}` }) as HTMLButtonElement;

describe('Spend Keys cards', () => {
  it('block a table whose remaining entries are all ineligible instead of offering Unlock', async () => {
    const fresh = createFreshState().unlocks;
    expect(randomUnlockPool(fresh, 'vanilla', 'key', TableType.BOSSES).length).toBeGreaterThan(0);
    blocked.table = TableType.BOSSES;

    await renderWith(fresh);

    const bosses = card('Bosses');
    expect(bosses.disabled).toBe(true);
    expect(bosses.textContent).toContain('Blocked');
    expect(bosses.textContent).not.toContain('Done');
  });

  it('offers Unlock on Vanilla Bosses while no boss can be reached yet', async () => {
    await renderWith(createFreshState().unlocks);

    expect(card('Bosses').disabled).toBe(false);
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

describe('Spend Keys Chunks card', () => {
  it('counts the start chunk out of every land chunk, as the share card does', async () => {
    const chunks = ['49,50', '49,49', '50,49', '48,50', '50,51', '51,50', '52,50', '51,49'];
    await renderWith({ ...createFreshState().unlocks, regions: [], chunks }, 'chunked');

    // Once read 8/622 here and 9/623 on the share map card.
    const { runProgress } = await import('../utils/runProgress');
    const shared = runProgress({ ...createFreshState().unlocks, chunks }, 'chunked');
    expect(card('Chunks').textContent).toContain(`${shared.unlocked}/${shared.total}`);
    expect(card('Chunks').textContent).toContain('9/623');
  });
});

describe('Spend Keys has no start-chunk milestone line', () => {
  it('shows no start-chunk Key countdown on the start chunk', async () => {
    await renderWith({ ...createFreshState().unlocks, regions: [], chunks: [] }, 'chunked');
    expect(screen.queryByTestId('start-chunk-milestone')).toBeNull();
    expect(document.body.textContent).not.toMatch(/to a Key|guaranteed Key/);
  });
});
