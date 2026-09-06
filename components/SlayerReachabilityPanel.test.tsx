/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  service: {
    ready: true,
    init: vi.fn(async () => true),
    slayerMasters: vi.fn(() => ({
      Mortimer: {
        Crawling: { weight: 10, slayer: 5 },
      },
    })),
    entityLocations: vi.fn(() => ({
      locations: [{ cx: 40, cy: 35 }],
    })),
  },
  game: {
    unlocks: {
      equipment: {},
      skills: { Attack: 10, Strength: 10, Defence: 10, Hitpoints: 10, Prayer: 10, Ranged: 10, Magic: 10, Slayer: 6 },
      levels: { Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99, Prayer: 99, Ranged: 99, Magic: 99, Slayer: 60 },
      regions: ['Wyrmscraig'],
      chunks: [],
      mobility: [],
      arcana: [],
      housing: [],
      merchants: [],
      minigames: [],
      bosses: [],
      storage: [],
      guilds: [],
      farming: [],
      slayerUnlocks: [],
      quests: ['Fallen From Grace'],
      diaries: [],
      cas: [],
      completedTasks: [],
      collectionLog: {},
    },
    gameModeId: 'vanilla',
  },
}));

vi.mock('../services/ChunkContentService', () => ({ chunkContentService: mocks.service }));
vi.mock('../context/GameContext', () => ({ useGame: () => mocks.game }));
vi.mock('../utils/chunkLocations', () => ({
  chunkUnlocked: () => true,
  showChunkOnMap: vi.fn(),
}));

import { SlayerReachabilityPanel } from './SlayerReachabilityPanel';

afterEach(cleanup);

describe('SlayerReachabilityPanel Mortimer access', () => {
  it('renders Mortimer’s master Slayer gate instead of a low-level assignment gate', () => {
    render(<SlayerReachabilityPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Mortimer/ }));

    expect(screen.getAllByText('Master: Slayer 99 or Slayer 70 + Combat 100')).toHaveLength(2);
    expect(screen.queryByText('Slayer 5')).toBeNull();
    expect(screen.queryByText('lvl 5')).toBeNull();
  });
});
