// @vitest-environment jsdom
// Farm Keys with "Ask before Key clicks" on, both layouts: the question comes
// first, and the 0.6 s rolling animation plays only for a roll that happens.
// Real cards, real useFarmModel.handleRoll, real utils/spendConfirm and SpendConfirm.
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MINIGAMES_LIST } from '../constants';
import { confirmSpendPref } from '../utils/viewerPrefs';

const rollForKey = vi.hoisted(() => vi.fn());
const game = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return { ...actual, useGame: () => game.current };
});
vi.mock('../services/WikiService', () => ({
  wikiService: { getImage: vi.fn(() => Promise.resolve(null)), getCachedImage: vi.fn(() => null), fetchImage: vi.fn(async () => null) },
}));

const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const question = () => screen.queryByRole('alertdialog')?.querySelector('p')?.textContent ?? null;
const answer = async (name: 'Yes' | 'No') => {
  const button = await screen.findByRole('button', { name }, { timeout: 10_000 });
  await act(async () => { fireEvent.click(button); await new Promise(resolve => setTimeout(resolve, 20)); });
};

beforeEach(async () => {
  const { initialState } = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  game.current = {
    ...initialState,
    unlocks: { ...initialState.unlocks, skills: { Slayer: 10 }, minigames: [MINIGAMES_LIST[0]] },
    animationsEnabled: false,
    gameModeId: 'classic',
    customMode: undefined,
    history: [],
    rollForKey,
    claimPet: vi.fn(),
  };
  confirmSpendPref.set(true);
  // Load the box once so each ask shows without waiting on the import.
  await import('./SpendConfirm');
});
afterEach(async () => {
  if (screen.queryByRole('button', { name: 'No' })) await answer('No');
  cleanup();
  confirmSpendPref.set(false);
  rollForKey.mockReset();
});

describe('classic Farm Keys card with Ask before Key clicks on', () => {
  const card = async (name: string) => (await screen.findByText(name)).closest('button') as HTMLButtonElement;

  it('asks first, plays the animation only after Yes, then rolls', async () => {
    const { ActionSection } = await import('./ActionSection');
    render(<ActionSection />);
    fireEvent.click(await card('Mazchna'));
    await wait(100);
    expect({ rolling: screen.queryByText('FATE') !== null, question: question() }).toEqual({ rolling: false, question: 'Roll for a Key from Slayer (Mazchna)?' });

    await answer('Yes');
    expect(screen.queryByText('FATE')).not.toBeNull();
    expect(rollForKey).not.toHaveBeenCalled();
    await wait(700);
    expect(screen.queryByText('FATE')).toBeNull();
    expect(rollForKey.mock.calls.map(call => call[0])).toEqual(['Slayer (Mazchna)']);
  }, 30_000);

  it('plays nothing and rolls nothing on No', async () => {
    const { ActionSection } = await import('./ActionSection');
    render(<ActionSection />);
    fireEvent.click(await card('Mazchna'));
    await answer('No');
    await wait(700);
    expect(screen.queryByText('FATE')).toBeNull();
    expect(rollForKey).not.toHaveBeenCalled();
  }, 30_000);

  it('asks about a second card clicked while the first one is rolling', async () => {
    const { ActionSection } = await import('./ActionSection');
    render(<ActionSection />);
    fireEvent.click(await card('Mazchna'));
    await answer('Yes');
    fireEvent.click(await card('Vannaka'));
    await wait(50);
    expect(question()).toBe('Roll for a Key from Slayer (Vannaka)?');
    await answer('Yes');
    await wait(700);
    expect(rollForKey.mock.calls.map(call => call[0])).toEqual(['Slayer (Mazchna)', 'Slayer (Vannaka)']);
  }, 30_000);
});

describe('OSRS Farm Keys card with Ask before Key clicks on', () => {
  beforeEach(async () => {
    game.current = { ...game.current, gameModeId: 'vanilla' };
    const { setFarmTab } = await import('./osrs/OsrsKeysState');
    setFarmTab('ACTIVITIES');
  });

  it('asks first, plays the animation only after Yes, then rolls', async () => {
    const { OsrsFarmKeys } = await import('./osrs/OsrsFarmKeys');
    render(<OsrsFarmKeys wide />);
    const cardEl = document.querySelector(`.okf-card[data-examine-name="${MINIGAMES_LIST[0]}"]`) as HTMLElement;
    fireEvent.click(within(cardEl).getByRole('button', { name: 'Roll' }));
    await wait(100);
    expect(question()).toMatch(/^Roll for a Key from /);
    expect(within(cardEl).queryByText('Rolling...')).toBeNull();

    await answer('Yes');
    expect(within(cardEl).queryByText('Rolling...')).not.toBeNull();
    expect(rollForKey).not.toHaveBeenCalled();
    await wait(700);
    expect(rollForKey).toHaveBeenCalledTimes(1);
  }, 30_000);
});
