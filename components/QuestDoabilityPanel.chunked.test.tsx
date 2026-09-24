// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fullChunkContent from '../public/chunk-content.json';
import { createFreshState } from '../context/GameContext';
import { chunkContentService } from '../services/ChunkContentService';
import { setStartArea } from '../utils/freeAreas';

const game = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../context/GameContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../context/GameContext')>()),
  useGame: () => game.current,
}));

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => structuredClone(fullChunkContent) })));
  expect(await chunkContentService.init()).toBe(true);
});

afterEach(() => {
  cleanup();
  setStartArea('misthalin');
});

describe('QuestDoabilityPanel in Chunked mode', () => {
  it('routes from the free start chunk, so a fresh run is not entirely stranded', async () => {
    setStartArea('none');
    const state = createFreshState();
    game.current = { ...state, gameModeId: 'chunked' };
    const { QuestDoabilityPanel } = await import('./QuestDoabilityPanel');

    render(<QuestDoabilityPanel />);

    await waitFor(() => expect(screen.getByText('Quest doability')).toBeTruthy());
    const summary = screen.getByText(/of \d+ doable now/).textContent ?? '';
    expect(summary).toMatch(/by chunk reachability/);
    expect(screen.queryByText('Owned but no route')).toBeNull();
    expect(screen.queryAllByTitle('Owned but no route — show on map')).toHaveLength(0);
  });
});
