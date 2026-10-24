/* @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DropSource } from '../types';
import { vanillaBossKeyStage } from '../config/vanillaKeyEconomy';
import { BOSS_TASK_NEEDS_UNLOCK, SLAYER_LOCKED } from '../utils/farmGates';

/**
 * Farm Keys' Slayer gates in both layouts (critique GP-10): a master the run
 * can't use is greyed out with why, and the Boss Task card asks which boss the
 * task was, then rolls from that boss's Key stash like a kill.
 */
const rollForKey = vi.fn();
const game: { current: Record<string, unknown> } = { current: {} };
const osrs = { on: false };

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return { ...actual, useGame: () => game.current };
});
vi.mock('../services/WikiService', () => ({
  wikiService: { fetchImage: vi.fn(() => Promise.resolve(null)), getImage: vi.fn(() => Promise.resolve(null)), getCachedImage: vi.fn(() => null) },
}));
vi.mock('../utils/uiStyle', async () => {
  const actual = await vi.importActual<typeof import('../utils/uiStyle')>('../utils/uiStyle');
  return { ...actual, useIsOsrsUi: () => osrs.on };
});

const start = async (unlocks: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
  const { initialState } = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  game.current = {
    ...initialState,
    gameModeId: 'vanilla',
    unlocks: { ...initialState.unlocks, ...unlocks, skills: { ...initialState.unlocks.skills, ...(unlocks.skills as object) } },
    history: [],
    rollForKey,
    claimPet: vi.fn(),
    ...extra,
  };
};

// Slayer tier 10 with Like a Boss: in Vanilla with no areas only Krystilia, in Edgeville, gives boss tasks.
const bossTaskRun = (extra: Record<string, unknown> = {}) => start(
  { skills: { Slayer: 10 }, slayerUnlocks: ['Like a Boss'], bosses: ['Callisto', 'Scorpia', 'Vorkath'] },
  extra,
);

const expectStashRoll = (boss: string, bossClass: string, awarded = 0) => expect(rollForKey).toHaveBeenCalledWith(
  DropSource.SLAYER_BOSS, vanillaBossKeyStage(boss, awarded).currentRate, 3, expect.any(Number), expect.any(Number),
  undefined, { kind: 'boss', bossName: boss, bossClass },
);

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { rollForKey.mockReset(); });

describe('classic Farm Keys Slayer cards', () => {
  beforeEach(() => { osrs.on = false; });

  const renderClassic = async () => {
    const { ActionSection } = await import('./ActionSection');
    render(<ActionSection />);
    // The Slayer cards load with the tab.
    await screen.findByRole('heading', { name: 'Boss Task' });
  };
  const masterButton = (name: string) => screen.getByRole('heading', { name }).closest('button') as HTMLButtonElement;

  it('greys out every master while Slayer is locked, with why', async () => {
    await start({});
    await renderClassic();
    const duradel = masterButton('Duradel');
    expect(duradel.disabled).toBe(true);
    expect(within(duradel).getByText(SLAYER_LOCKED)).toBeTruthy();
    // Nine masters and the Boss Task card.
    expect(screen.getAllByText(SLAYER_LOCKED)).toHaveLength(10);
  });

  it('greys out Duradel until Shilo Village, and rolls an open master as before', async () => {
    await start({ skills: { Slayer: 5 } });
    await renderClassic();
    expect(masterButton('Duradel').disabled).toBe(true);
    expect(within(masterButton('Duradel')).getByText('Needs the Shilo Village area')).toBeTruthy();
    vi.useFakeTimers();
    fireEvent.click(masterButton('Vannaka'));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(rollForKey).toHaveBeenCalledWith(DropSource.SLAYER_VANNAKA, 20, 1, expect.any(Number), expect.any(Number), undefined, undefined);
  });

  it('says the Boss Task card needs Like a Boss', async () => {
    await start({ skills: { Slayer: 10 }, bosses: ['Callisto'] });
    await renderClassic();
    expect(screen.getByText(BOSS_TASK_NEEDS_UNLOCK)).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Which boss was the task?' })).toBeNull();
  });

  it('asks which boss the task was, then rolls from that boss’s stash', async () => {
    await bossTaskRun({ bossStandardKeysAwarded: { Callisto: 1 } });
    await renderClassic();
    const picker = screen.getByRole('combobox', { name: 'Which boss was the task?' }) as HTMLSelectElement;
    // Krystilia gives only Wilderness bosses: no Vorkath.
    expect([...picker.options].map(o => o.value)).toEqual(['', 'Callisto', 'Scorpia']);
    const rollBtn = picker.parentElement!.querySelector('button') as HTMLButtonElement;
    expect(rollBtn.disabled).toBe(true);
    fireEvent.change(picker, { target: { value: 'Callisto' } });
    expect(rollBtn.disabled).toBe(false);
    expect(rollBtn.textContent).toContain(`${vanillaBossKeyStage('Callisto', 1).currentRate}% Chance`);
    vi.useFakeTimers();
    fireEvent.click(rollBtn);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expectStashRoll('Callisto', 'mid', 1);
    // The next boss task asks again.
    expect(picker.value).toBe('');
  });
});

describe('OSRS Farm Keys Slayer cards', () => {
  beforeEach(async () => {
    osrs.on = true;
    const { setFarmTab } = await import('./osrs/OsrsKeysState');
    setFarmTab('SLAYER');
  });
  const card = (name: string) => document.querySelector(`.okf-card[data-examine-name="${name}"]`) as HTMLElement;
  const row = (name: string) => document.querySelector(`.okf-row[data-examine-name="${name}"]`) as HTMLElement;

  it('greys out a master the run can’t use, with why (wide and compact)', async () => {
    await start({ skills: { Slayer: 4 }, regions: ['Shilo Village'], quests: ['Shilo Village'] });
    const { OsrsFarmKeys } = await import('./osrs/OsrsFarmKeys');
    const { unmount } = render(<OsrsFarmKeys wide />);
    expect(within(card('Duradel')).getByText('Needs Slayer tier 5 (level 50)')).toBeTruthy();
    expect((within(card('Duradel')).getByRole('button', { name: 'Roll' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(card('Vannaka')).getByRole('button', { name: 'Roll' }) as HTMLButtonElement).disabled).toBe(false);
    unmount();
    render(<OsrsFarmKeys />);
    expect(within(row('Duradel')).getByText('Needs Slayer tier 5 (level 50)')).toBeTruthy();
    expect((within(row('Duradel')).getByRole('button', { name: 'Roll' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks which boss the task was, then rolls from that boss’s stash (wide)', async () => {
    await bossTaskRun();
    const { OsrsFarmKeys } = await import('./osrs/OsrsFarmKeys');
    render(<OsrsFarmKeys wide />);
    const boss = card('Boss Task');
    const btn = within(boss).getByRole('button', { name: 'Roll' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(within(boss).getByRole('combobox', { name: 'Which boss was the task?' }), { target: { value: 'Callisto' } });
    expect(btn.disabled).toBe(false);
    vi.useFakeTimers();
    fireEvent.click(btn);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expectStashRoll('Callisto', 'mid');
  });

  it('rolls from the compact list too, and says why it can’t when nothing is unlocked', async () => {
    await bossTaskRun();
    const { OsrsFarmKeys } = await import('./osrs/OsrsFarmKeys');
    const { unmount } = render(<OsrsFarmKeys />);
    const boss = row('Boss Task');
    fireEvent.change(within(boss).getByRole('combobox', { name: 'Which boss was the task?' }), { target: { value: 'Callisto' } });
    vi.useFakeTimers();
    fireEvent.click(within(boss).getByRole('button', { name: 'Roll' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expectStashRoll('Callisto', 'mid');
    unmount();
    vi.useRealTimers();
    await start({ skills: { Slayer: 10 } });
    render(<OsrsFarmKeys />);
    expect(within(row('Boss Task')).getByText(BOSS_TASK_NEEDS_UNLOCK)).toBeTruthy();
    expect((within(row('Boss Task')).getByRole('button', { name: 'Roll' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
