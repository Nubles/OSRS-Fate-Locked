/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChunkContent } from '../services/ChunkContentService';

const mocks = vi.hoisted(() => {
  const state = { content: null as ChunkContent | null, completedQuests: [] as string[], regions: [] as string[] };
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
  return { ...actual, useGame: () => ({
    ...actual.initialState,
    unlocks: { ...actual.initialState.unlocks, quests: mocks.state.completedQuests, regions: mocks.state.regions },
    customMode: undefined,
  }) };
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
  mocks.state.completedQuests = [];
  mocks.state.regions = [];
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

describe('ChunkActivityPanel activity accordions', () => {
  it('groups quest, combat, and gathering rows while preserving locked labels', async () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { 'Sheep Shearer': 'first' },
      monsters: [{ name: 'Rat', count: 3, slayer: null }, { name: 'King Black Dragon', count: 1, slayer: null }],
      objects: [['Herb patch', 1], ['Yew tree', 2]],
    };
    mocks.state.completedQuests = ['Sheep Shearer'];

    render(<ChunkActivityPanel {...baseProps} />);

    const quests = screen.getByRole('button', { name: /Quests/ });
    const combat = screen.getByRole('button', { name: /Combat/ });
    const gathering = screen.getByRole('button', { name: /Gathering/ });
    expect(quests.getAttribute('aria-expanded')).toBe('true');
    expect(combat.getAttribute('aria-expanded')).toBe('false');
    expect(gathering.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(combat);
    await userEvent.click(gathering);
    expect(quests.getAttribute('aria-expanded')).toBe('true');
    expect(combat.getAttribute('aria-expanded')).toBe('true');
    expect(gathering.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTitle('Completed').textContent).toContain('Sheep Shearer');
    expect(screen.getByText('Yew tree').parentElement?.parentElement?.className).toContain('text-gray-400');
  });

  it('uses neutral availability wording for combat and gathering rows in mixed area scope', async () => {
    mocks.state.content = {
      ...emptyContent(),
      quests: { 'Sheep Shearer': 'first' },
      monsters: [{ name: 'King Black Dragon', count: 1, slayer: null }],
      objects: [['Herb patch', 1], ['Yew tree', 2]],
    };
    mocks.state.regions = ['Misthalin'];

    render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    await userEvent.click(screen.getByRole('button', { name: /Combat/ }));
    await userEvent.click(screen.getByRole('button', { name: /Gathering/ }));

    expect(screen.getByText('King Black Dragon').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getByText('Herb patch').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getByText('Yew tree').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getByText('Area')).toBeTruthy();
    expect(screen.getByText('Sheep Shearer').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');

  });
  it('opens Combat by default when quests are absent and omits empty groups', () => {
    mocks.state.content = {
      ...emptyContent(),
      monsters: [{ name: 'Rat', count: 3, slayer: null }],
    };

    render(<ChunkActivityPanel {...baseProps} />);

    expect(screen.getByRole('button', { name: /Combat/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: /Quests/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Gathering/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Shops/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Travel/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Other/ })).toBeNull();
  });

  it('groups shops, travel, and reference rows without losing nested controls', async () => {
    mocks.state.content = {
      ...emptyContent(),
      shops: ['Varrock General Store', 'Odd Shop'],
      quests: { 'Sheep Shearer': 'first' },
      monsters: [{ name: 'Rat', count: 1, slayer: null }],
      objects: [['Fairy ring', 1], ['Herb patch', 1], ['Yew tree', 1], ['Statue', 2]],
      npcs: ["Cooks' Guild", 'Castle Wars', 'Shopkeeper'],
      diaries: { Lumbridge: 'LB1' },
      clues: { hard: 1 },
      spawns: ['Bronze dagger'],
    };
    mocks.service.shopStock.mockReturnValue(['Bronze dagger']);
    mocks.service.connectGraph.mockReturnValue({ '12853': ['12854'] });
    const onShowChunk = vi.fn();
    window.addEventListener('fate:show-chunk', onShowChunk);

    render(<ChunkActivityPanel {...baseProps} />);

    expect(screen.getByRole('button', { name: /Shops/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Travel/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Other/ })).toBeTruthy();
    const accordionLabels = screen.getAllByRole('button')
      .map(button => button.getAttribute('aria-label'))
      .filter((label): label is string => /^(Quests|Combat|Gathering|Shops|Travel|Other),/.test(label))
      .map(label => label.split(',')[0]);
    expect(accordionLabels).toEqual(['Quests', 'Combat', 'Gathering', 'Shops', 'Travel', 'Other']);
    expect(accordionLabels).toHaveLength(6);
    expect(screen.queryByText('Travel links')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Shops/ }));
    await userEvent.click(screen.getAllByTitle('Show stock')[0]);
    expect(screen.getAllByText('Bronze dagger')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: /Travel/ }));
    await userEvent.click(screen.getByTitle('Needs the "Fairy Rings" network'));
    expect(onShowChunk).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Other/ }));
    expect(screen.getByText('Shopkeeper')).toBeTruthy();
    expect(screen.getAllByText('Bronze dagger').length).toBeGreaterThan(1);
    window.removeEventListener('fate:show-chunk', onShowChunk);
  });
  it('keeps Shops, Travel, and Other rows neutral in mixed area scope', async () => {
    mocks.state.content = {
      ...emptyContent(),
      shops: ['Varrock General Store'],
      objects: [['Fairy ring', 1]],
      npcs: ["Cooks' Guild"],
    };
    mocks.state.regions = ['Misthalin'];

    render(<ChunkActivityPanel {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Whole area' }));
    await userEvent.click(screen.getByRole('button', { name: /Travel/ }));
    await userEvent.click(screen.getByRole('button', { name: /Other/ }));

    expect(screen.getByText('Varrock General Store').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getByText('Fairy ring').closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
    expect(screen.getAllByText("Cooks' Guild")[0].closest('div')?.getAttribute('title')).toBe('Availability varies across this area');
  });

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
