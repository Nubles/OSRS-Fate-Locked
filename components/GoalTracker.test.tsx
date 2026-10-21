// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({
  loaded: vi.fn(),
  progress: vi.fn(() => ({ percentage: 40, missing: ['Fishing 50'], totalSteps: 5, completedSteps: 2 })),
}));
const game = vi.hoisted(() => ({
  pinnedGoals: [] as string[],
  togglePin: () => {},
  gameModeId: 'vanilla',
  unlocks: undefined as unknown,
}));

vi.mock('../context/GameContext', () => ({ useGame: () => game }));
// Stands in for the Resource Engine; the factory runs only if something imports it.
vi.mock('../utils/supplyChain', () => {
  engine.loaded();
  return { calculateEngineItemProgress: engine.progress };
});

import { GoalTracker, goalNeedsResourceEngine } from './GoalTracker';

const freshUnlocks = async () =>
  (await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext')).createFreshState().unlocks;

afterEach(() => {
  cleanup();
  game.pinnedGoals = [];
});

describe('GoalTracker', () => {
  it('knows which pinned goals are Resource Engine items', () => {
    expect(goalNeedsResourceEngine('Demon Slayer')).toBe(false); // quest
    expect(goalNeedsResourceEngine('Dragon Slayer II')).toBe(false); // strategy entry
    expect(goalNeedsResourceEngine('Huasca')).toBe(true);
  });

  it('shows quest goals without loading the Resource Engine', async () => {
    game.unlocks = await freshUnlocks();
    game.pinnedGoals = ['Demon Slayer'];
    render(<GoalTracker />);
    expect(await screen.findByText('Demon Slayer')).toBeTruthy();
    expect(engine.loaded).not.toHaveBeenCalled();
  });

  it('loads the engine for an item goal and shows every card together', async () => {
    game.unlocks = await freshUnlocks();
    game.pinnedGoals = ['Demon Slayer', 'Huasca'];
    render(<GoalTracker />);
    expect(await screen.findByText('Huasca')).toBeTruthy();
    expect(screen.getByText('Demon Slayer')).toBeTruthy();
    expect(engine.loaded).toHaveBeenCalledTimes(1);
    expect(engine.progress).toHaveBeenCalledWith('Huasca', game);
    expect(screen.getByText(/Fishing 50/)).toBeTruthy();
  });
});
