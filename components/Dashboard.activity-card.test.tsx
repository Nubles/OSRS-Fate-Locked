/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';

const state = vi.hoisted(() => ({
  unlocks: null as UnlockState | null,
  gameModeId: 'vanilla',
}));

const freshUnlocks = (): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  banks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

state.unlocks = freshUnlocks();

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      unlocks: state.unlocks ?? freshUnlocks(),
      gameModeId: state.gameModeId,
      customMode: undefined,
      levelUpSkill: vi.fn(),
      unlockContent: vi.fn(),
      toggleAnimations: vi.fn(),
      toggleAdvisors: vi.fn(),
      toggleRevealAll: vi.fn(),
      completeOnboarding: vi.fn(),
      saveNote: vi.fn(),
    }),
  };
});

vi.mock('../services/WikiService', () => ({
  wikiService: { fetchImage: vi.fn(async () => null) },
}));

import { Dashboard } from './Dashboard';

afterEach(() => {
  cleanup();
  state.unlocks = freshUnlocks();
  state.gameModeId = 'vanilla';
});

const openBosses = async () => {
  const user = userEvent.setup();
  render(<Dashboard suspendModals />);
  await user.click(screen.getByRole('button', { name: /Activities & Utility/ }));
  return screen.getByText('The Mad Angel').closest('div.relative') as HTMLElement;
};

describe('Dashboard activity cards', () => {
  it('marks locked boss locations red even when the boss is owned', async () => {
    state.unlocks = { ...freshUnlocks(), bosses: ['The Mad Angel'] };
    const card = await openBosses();

    expect(within(card).getByTitle('Requires location unlock').className).toContain('text-red-400');
    expect(within(card).getByTitle('Requires unlock: Wyrmscraig').className).toContain('text-red-300');
    expect(within(card).getAllByText('— Requires unlock')).toHaveLength(2);
  });

  it('marks the location green when its access area is unlocked without requiring the whole continent', async () => {
    state.unlocks = { ...freshUnlocks(), regions: ['Wyrmscraig'] };
    const card = await openBosses();

    expect(within(card).getByTitle('Location unlocked').className).toContain('text-emerald-400');
    expect(within(card).getByTitle('Wyrmscraig unlocked').className).toContain('text-emerald-300');
    expect(within(card).queryByText('— Requires unlock')).toBeNull();
  });

  it('uses chunk ownership instead of region ownership for boss locations in chunked mode', async () => {
    state.gameModeId = 'chunked';
    state.unlocks = { ...freshUnlocks(), regions: ['Wyrmscraig'] };
    const lockedCard = await openBosses();
    expect(within(lockedCard).getByTitle('Requires unlock: Wyrmscraig').className).toContain('text-red-300');

    cleanup();
    state.unlocks = { ...freshUnlocks(), chunks: ['39,34'] };
    const unlockedCard = await openBosses();
    expect(within(unlockedCard).getByTitle('Wyrmscraig unlocked').className).toContain('text-emerald-300');
    expect(within(unlockedCard).getByTitle('Location unlocked').className).toContain('text-emerald-400');
  });

  it('shows The Mad Angel tier and all authored access metadata when unowned', async () => {
    const card = await openBosses();

    expect(within(card).getByText('Mid tier')).toBeTruthy();
    expect(within(card).getByText('The Open Seas')).toBeTruthy();
    expect(within(card).getByText('Wyrmscraig')).toBeTruthy();
    expect(within(card).getByText('Fallen From Grace')).toBeTruthy();
    expect(within(card).getByText('Not owned')).toBeTruthy();
  });

  it('shows both blocker labels before owned The Mad Angel becomes ready', async () => {
    state.unlocks = { ...freshUnlocks(), bosses: ['The Mad Angel'] };
    const card = await openBosses();

    expect(within(card).getByText('Not ready')).toBeTruthy();
    expect(within(card).getByText('Wyrmscraig')).toBeTruthy();
    expect(within(card).getByText('Fallen From Grace')).toBeTruthy();
  });

  it('shows Ready when owned The Mad Angel has Wyrmscraig and Fallen From Grace', async () => {
    state.unlocks = {
      ...freshUnlocks(),
      bosses: ['The Mad Angel'],
      regions: ['Wyrmscraig'],
      quests: ['Fallen From Grace'],
    };
    const card = await openBosses();

    expect(within(card).getByText('Ready')).toBeTruthy();
  });
});
