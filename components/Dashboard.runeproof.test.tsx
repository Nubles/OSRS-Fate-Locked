/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';

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

import { Dashboard } from './Dashboard';

afterEach(cleanup);

describe('Dashboard private RuneProof entry', () => {
  it('exposes the preview entry in test mode', () => {
    render(<Dashboard suspendModals />);
    expect(screen.getByRole('button', { name: 'RuneProof' }).getAttribute('title'))
      .toBe('Explore quest requirements');
    expect(screen.queryByRole('button', { name: 'Goal Planner' })).toBeNull();
  });
});
