/* @vitest-environment jsdom */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ authoring: false }));
vi.mock('../utils/mapAuthoring', () => ({
  MAP_AUTHORING_FLAG: 'fate-map-authoring',
  mapAuthoringAvailable: () => flags.authoring,
}));
vi.mock('../services/ChunkContentService', () => ({
  chunkContentService: {
    ready: true,
    error: null,
    subscribe: vi.fn(() => () => {}),
    init: vi.fn(async () => true),
    contentFor: vi.fn(() => null),
    aggregate: vi.fn(() => null),
    entityLocations: vi.fn(() => null),
    connectGraph: vi.fn(() => ({})),
    hasBank: vi.fn(() => false),
    itemSources: vi.fn(() => []),
    overlays: vi.fn(() => ({
      'Shooting Stars': [{ x: 3200, y: 3200, cx: 50, cy: 50 }],
      'Impling Spawns': [{ x: 3200, y: 3200, cx: 50, cy: 50 }],
      Clues: ['Beginner', 'Easy', 'Medium', 'Hard', 'Elite', 'Master'].map(t => ({ x: 3200, y: 3200, cx: 50, cy: 50, t })),
    })),
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

// browser[0]: in the classic layout the World pane is shorter than 600 px in a
// 1366x768 or 1440x900 window, and the map box (a fixed 600 px) was cut off by
// it, hiding the lower overlay buttons and the zoom buttons. jsdom has no
// layout, so this pins the CSS contract: on wide screens the box fills its
// pane, and the overlay list scrolls inside the box.
describe('World map box in the classic layout', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('fills the World pane on wide screens and keeps the phone height', async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<RegionMap />); });
    const box = view.getByTestId('world-map-box');
    const classes = box.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['lg:absolute', 'lg:inset-0', 'lg:h-auto', 'relative', 'overflow-hidden']));
    expect(classes).not.toContain('lg:h-[600px]');
    // Phone: unchanged fixed height in the scrolling page.
    expect(classes).toContain('h-[min(600px,70vh)]');
  });

  it('caps the overlay panel to the box and lets its list scroll', async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<RegionMap />); });
    const list = view.getByTestId('map-overlay-list');
    expect(list.textContent).toContain('Shooting Stars');
    expect(list.textContent).toContain('Master clue');
    expect(list.className.split(/\s+/)).toEqual(expect.arrayContaining(['overflow-y-auto', 'min-h-0']));
    const panel = list.parentElement!;
    expect(panel.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex', 'flex-col', 'min-h-0']));
    const anchor = panel.parentElement!;
    expect(anchor.className).toContain('max-h-[calc(100%-3.5rem)]');
    expect(anchor.className.split(/\s+/)).toEqual(expect.arrayContaining(['absolute', 'flex', 'flex-col']));
  });

  it('leaves the OSRS layout map without the classic box', async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<RegionMap osrs />); });
    expect(view.queryByTestId('world-map-box')).toBeNull();
  });
});
