/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REGION_CHUNKS } from '../data/regionChunks';
import { MAP_SEED_HASH, REGION_DRAFT_BACKUP_KEY, REGION_DRAFT_KEY, SUBAREA_DRAFT_KEY } from '../utils/mapDraft';

const flags = vi.hoisted(() => ({ authoring: false }));
vi.mock('../utils/mapAuthoring', () => ({
  MAP_AUTHORING_FLAG: 'fate-map-authoring',
  mapAuthoringAvailable: () => flags.authoring,
}));
vi.mock('../services/ChunkContentService', () => ({
  chunkContentService: {
    ready: false,
    init: vi.fn(async () => false),
    contentFor: vi.fn(() => null),
    aggregate: vi.fn(() => null),
    entityLocations: vi.fn(() => null),
    connectGraph: vi.fn(() => ({})),
    hasBank: vi.fn(() => false),
    itemSources: vi.fn(() => []),
    overlays: vi.fn(() => []),
    questSections: vi.fn(() => []),
    searchEntities: vi.fn(() => []),
    searchItems: vi.fn(() => []),
    tagChunks: vi.fn(() => []),
    tagList: vi.fn(() => []),
  },
}));
vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return { ...actual, useGame: () => ({ ...actual.initialState, gameModeId: 'vanilla', customMode: undefined }) };
});

import { RegionMap } from './RegionMap';

// A hand-painted draft left over from an earlier session, stamped with
// today's seed so the authoring loader would apply it as-is: two chunks
// instead of the shipped ~600.
const painted = { Misthalin: [{ cx: 50, cy: 50 }], Morytania: [{ cx: 40, cy: 40 }] };
const paintedSub = { Lumbridge: [{ cx: 40, cy: 40 }] };
const DRAFT = JSON.stringify({ v: 2, seed: MAP_SEED_HASH, dirty: true, data: painted });
const SUB_DRAFT = JSON.stringify({ v: 2, seed: MAP_SEED_HASH, dirty: true, data: paintedSub });
const BACKUP = JSON.stringify({ v: 2, seed: 'older-seed', dirty: true, data: painted });

const shippedCount = Object.values(REGION_CHUNKS).reduce((n, list) => n + list.length, 0);
const chunkRectCount = (root: HTMLElement) => root.querySelector('svg > g')!.querySelectorAll(':scope > rect').length;

describe('World map with a stored authoring draft', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    localStorage.clear();
    localStorage.setItem(REGION_DRAFT_KEY, DRAFT);
    localStorage.setItem(SUBAREA_DRAFT_KEY, SUB_DRAFT);
    localStorage.setItem(REGION_DRAFT_BACKUP_KEY, BACKUP);
  });
  afterEach(() => {
    cleanup();
    flags.authoring = false;
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it.each([['classic', false], ['OSRS', true]])('shows players the shipped map in the %s layout, hides the tool, and leaves their draft in storage', async (_layout, osrs) => {
    flags.authoring = false;
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<RegionMap osrs={osrs} />); });

    expect(chunkRectCount(view.container)).toBe(shippedCount);
    expect(view.queryByTitle('Toggle chunk authoring mode')).toBeNull();
    expect(view.container.textContent).not.toMatch(/Authoring (ON|OFF)|Paint continent/);

    expect(localStorage.getItem(REGION_DRAFT_KEY)).toBe(DRAFT);
    expect(localStorage.getItem(SUBAREA_DRAFT_KEY)).toBe(SUB_DRAFT);
    expect(localStorage.getItem(REGION_DRAFT_BACKUP_KEY)).toBe(BACKUP);
  });

  it('still loads the draft for a maintainer with authoring enabled', async () => {
    flags.authoring = true;
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<RegionMap />); });

    expect(chunkRectCount(view.container)).toBe(2);
    const toggle = view.getByTitle('Toggle chunk authoring mode');
    expect(toggle.textContent).toContain('Authoring OFF');
    await act(async () => { fireEvent.click(toggle); });
    expect(toggle.textContent).toContain('Authoring ON');
  });
});

describe('World map controls', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('gives every button on the map a name a screen reader can read', async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<RegionMap />); });

    // The two zoom buttons are icons only: they had no name at all.
    expect(view.getByRole('button', { name: 'Zoom in' }).getAttribute('title')).toBe('Zoom in');
    expect(view.getByRole('button', { name: 'Zoom out' }).getAttribute('title')).toBe('Zoom out');
    const unnamed = Array.from(view.container.querySelectorAll('button'))
      .filter(button => !(button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent?.trim()));
    expect(unnamed).toEqual([]);
  });

  it('says whether the chunk grid is on', async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<RegionMap />); });
    const grid = view.getByTitle('Toggle chunk grid (64-tile)');
    const before = grid.getAttribute('aria-pressed');
    expect(['true', 'false']).toContain(before);
    await act(async () => { fireEvent.click(grid); });
    expect(grid.getAttribute('aria-pressed')).toBe(before === 'true' ? 'false' : 'true');
  });
});
