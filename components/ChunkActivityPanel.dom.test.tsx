/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChunkContent } from '../services/ChunkContentService';

const mocks = vi.hoisted(() => {
  const state = { content: null as ChunkContent | null };
  return {
    state,
    service: {
      ready: true,
      init: vi.fn(async () => true),
      contentFor: vi.fn(() => state.content),
      aggregate: vi.fn(() => state.content),
      entrancesFor: vi.fn(() => []),
      connectGraph: vi.fn(() => ({})),
      skillYields: vi.fn(() => ({})),
      taskRequirements: vi.fn(() => []),
      chunkEntryRequirements: vi.fn(() => []),
      hasBank: vi.fn(() => false),
      shopStock: vi.fn(() => []),
    },
  };
});

vi.mock('../services/ChunkContentService', () => ({ chunkContentService: mocks.service }));
vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return { ...actual, useGame: () => ({ ...actual.initialState, customMode: undefined }) };
});

import { ChunkActivityPanel } from './ChunkActivityPanel';

const emptyContent = (): ChunkContent => ({
  name: 'Varrock West', monsters: [], npcs: [], objects: [], shops: [], quests: {}, diaries: {}, clues: {}, spawns: [],
});

const baseProps = {
  chunk: { cx: 50, cy: 53 },
  region: 'Misthalin',
  subArea: 'Varrock',
  regionChunks: [{ cx: 50, cy: 53 }],
  unlocked: true,
  individualChunkOwnership: true,
  onClose: () => undefined,
} as const;

afterEach(cleanup);
beforeEach(() => {
  mocks.state.content = { ...emptyContent(), monsters: [{ name: 'Rat', count: 3, slayer: null }] };
  mocks.service.chunkEntryRequirements.mockReturnValue(['Dragon Slayer I']);
  mocks.service.entrancesFor.mockReturnValue([{
    location: 'Taverley Dungeon',
    label: 'Entrance to Taverley Dungeon',
    wikiPage: 'Taverley_Dungeon',
    requirements: ['Example Quest'],
  }]);
  mocks.service.hasBank.mockReturnValue(true);
});

describe('ChunkActivityPanel summary hierarchy', () => {
  it('shows uniform availability and neutral chunk-owned area totals', async () => {
    render(<ChunkActivityPanel {...baseProps} />);
    expect(screen.getByText('Available now')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'Access & facilities' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    expect(screen.getByText('Indexed activities')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Access & facilities' })).toBeNull();
    expect(screen.queryByText('Available now')).toBeNull();
  });
});
