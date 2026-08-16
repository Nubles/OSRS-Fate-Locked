/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';

const state = vi.hoisted(() => ({
  unlocks: null as UnlockState | null,
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
      gameModeId: 'vanilla',
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
});

const openBosses = async () => {
  const user = userEvent.setup();
  render(<Dashboard suspendModals />);
  await user.click(screen.getByRole('button', { name: /Activities & Utility/ }));
  return screen.getByText('The Mad Angel').closest('div.relative') as HTMLElement;
};

describe('Dashboard activity cards', () => {
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
