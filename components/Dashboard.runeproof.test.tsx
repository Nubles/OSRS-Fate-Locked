/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';

const featureState = vi.hoisted(() => ({
  availability: 'OFF' as 'OFF' | 'PREVIEW',
}));

const freshUnlocks = (): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  banks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      unlocks: freshUnlocks(),
      gameModeId: 'vanilla',
      customMode: undefined,
      levelUpSkill: vi.fn(),
      unlockContent: vi.fn(),
    }),
  };
});

vi.mock('../services/WikiService', () => ({
  wikiService: { fetchImage: vi.fn(async () => null) },
}));

vi.mock('../utils/questRoutes/featureFlag', () => ({
  runeProofAvailability: vi.fn(() => featureState.availability),
}));

import { Dashboard } from './Dashboard';

afterEach(() => {
  cleanup();
  featureState.availability = 'OFF';
});

describe('Dashboard RuneProof entry', () => {
  it('preserves the existing Goal Planner label and title while preview is off', () => {
    featureState.availability = 'OFF';
    render(<Dashboard suspendModals />);

    expect(screen.getByRole('button', { name: 'Goal Planner' }).getAttribute('title'))
      .toBe('Plan the route to any quest, diary, or region');
    expect(screen.queryByRole('button', { name: 'RuneProof' })).toBeNull();
  });

  it('labels the same Dashboard entry RuneProof in private preview', () => {
    featureState.availability = 'PREVIEW';
    render(<Dashboard suspendModals />);

    expect(screen.getByRole('button', { name: 'RuneProof' }).getAttribute('title'))
      .toBe('Get the next reviewed action for your run');
    expect(screen.queryByRole('button', { name: 'Goal Planner' })).toBeNull();
  });
});
