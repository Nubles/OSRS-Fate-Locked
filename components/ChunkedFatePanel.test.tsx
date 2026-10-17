// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshState } from '../context/GameContext';

const game = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../context/GameContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../context/GameContext')>()),
  useGame: () => game.current,
}));
// No quest is doable in this test's chunks; the real check needs chunk content.
vi.mock('../services/ChunkContentService', () => ({ chunkContentService: { ready: true, init: () => Promise.resolve() } }));
vi.mock('./QuestDoabilityPanel', () => ({ chunkedQuestRows: () => [] }));

afterEach(cleanup);

const dry = (over: Record<string, unknown> = {}) => {
  const fresh = createFreshState();
  game.current = {
    ...fresh,
    gameModeId: 'chunked',
    keys: 0,
    specialKeys: 0,
    chaosKeys: 0,
    unlocks: { ...fresh.unlocks, skills: { Hitpoints: 1, Woodcutting: 2 }, levels: { ...fresh.unlocks.levels, Woodcutting: 20 } },
    rollBreakthrough: vi.fn(),
    callOnFate: vi.fn(),
    ...over,
  };
};

describe('Chunked fate panel', () => {
  it('offers a Breakthrough roll for each capped skill and hides Mercy until they are rolled', async () => {
    dry();
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    expect(screen.getByText(/Breakthroughs ready/)).toBeTruthy();
    expect(screen.getByText('Woodcutting').parentElement?.textContent).toContain('reached level 20. Roll for levels 21-30.');
    expect(screen.queryByText("Fate's Mercy")).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Roll' })[1]);
    expect(game.current.rollBreakthrough).toHaveBeenCalledWith('Woodcutting');
  });

  it("offers Fate's Mercy once the run is dry", async () => {
    dry({ chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    const call = screen.getByRole('button', { name: 'Call on Fate' }) as HTMLButtonElement;
    expect(call.disabled).toBe(false);
    fireEvent.click(call);
    expect(game.current.callOnFate).toHaveBeenCalled();
  });

  it('shows nothing while the run still has Keys and nothing is capped', async () => {
    const fresh = createFreshState();
    dry({ keys: 2, unlocks: { ...fresh.unlocks, skills: {}, levels: { ...fresh.unlocks.levels, Hitpoints: 10 } } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    const { container } = render(<ChunkedFatePanel />);
    expect(container.textContent).toBe('');
  });
});
