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
      ready: true as boolean,
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
  mocks.service.ready = true;
  mocks.service.init.mockReset();
  mocks.service.init.mockImplementation(async () => true);
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

describe('ChunkActivityPanel body states', () => {
  it('treats ready chunks with no indexed document as empty and keeps access before it', () => {
    mocks.state.content = null;

    render(<ChunkActivityPanel {...baseProps} />);

    const access = screen.getByRole('heading', { name: 'Access & facilities' });
    const empty = screen.getByText('No indexed content');
    expect(access.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByText('Available now')).toBeNull();
    expect(screen.queryByText('Needs unlocks')).toBeNull();
  });

  it('shows loading without an access card or zero summary while initialization is pending', () => {
    mocks.service.ready = false;
    mocks.service.init.mockImplementation(() => new Promise<boolean>(() => undefined));

    render(<ChunkActivityPanel {...baseProps} />);

    expect(screen.getByLabelText('Loading chunk content')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Access & facilities' })).toBeNull();
    expect(screen.queryByText('Available now')).toBeNull();
    expect(screen.queryByText('Needs unlocks')).toBeNull();
  });

  it('announces failed loading and retries initialization', async () => {
    mocks.service.ready = false;
    mocks.service.init
      .mockResolvedValueOnce(false)
      .mockImplementation(async () => {
        mocks.service.ready = true;
        return true;
      });

    render(<ChunkActivityPanel {...baseProps} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Chunk content unavailable');
    expect(screen.queryByText('Available now')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Retry loading chunk content' }));
    expect(await screen.findByText('Available now')).toBeTruthy();
  });
});
