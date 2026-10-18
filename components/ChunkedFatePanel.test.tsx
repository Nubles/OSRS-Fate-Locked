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
const content = vi.hoisted(() => ({ ready: true }));
vi.mock('../services/ChunkContentService', () => ({ chunkContentService: { get ready() { return content.ready; }, init: () => new Promise(() => {}) } }));
const quests = vi.hoisted(() => ({ rows: [] as { id: string; bucket: string }[] }));
vi.mock('./QuestDoabilityPanel', () => ({ chunkedQuestRows: () => quests.rows }));

afterEach(() => { cleanup(); quests.rows = []; content.ready = true; });

const dry = (over: Record<string, unknown> = {}) => {
  const fresh = createFreshState();
  game.current = {
    ...fresh,
    gameModeId: 'chunked',
    keys: 0,
    specialKeys: 0,
    chaosKeys: 0,
    unlocks: { ...fresh.unlocks, skills: { Attack: 1, Hitpoints: 1, Woodcutting: 2 }, levels: { ...fresh.unlocks.levels, Attack: 10, Woodcutting: 20 } },
    rollBreakthrough: vi.fn(),
    callOnFate: vi.fn(),
    exploreChunk: vi.fn(),
    ...over,
  };
};

describe('Chunked fate panel', () => {
  it('offers a Breakthrough roll for each capped skill and hides Mercy until they are rolled', async () => {
    dry();
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    expect(screen.getByText(/Breakthroughs ready/)).toBeTruthy();
    expect(screen.getByText('Woodcutting reached level 20, its tier 2 cap. Roll for levels 21-30.')).toBeTruthy();
    // Every run starts with Hitpoints at its cap; once a combat style trains it, the panel says why.
    expect(screen.getByText(/Hitpoints starts at level 10, the cap of tier 1/)).toBeTruthy();
    // Mercy is shut by the waiting Breakthroughs, and the line says so.
    expect(screen.getByText("Fate's Mercy")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Call on Fate' })).toBeNull();
    expect(screen.getByText("Fate's Mercy waits until you roll the Breakthrough for Attack.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Roll' })[2]);
    expect(game.current.rollBreakthrough).toHaveBeenCalledWith('Woodcutting');
  });

  it("offers Fate's Mercy once the run is dry", async () => {
    dry({ chunkedBreakthroughs: { Attack: 2, Hitpoints: 2, Woodcutting: 3 } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    const call = screen.getByRole('button', { name: 'Call on Fate' }) as HTMLButtonElement;
    expect(call.disabled).toBe(false);
    fireEvent.click(call);
    // The panel sends nothing: the provider lists the doable quests and draws the roll itself.
    expect(game.current.callOnFate).toHaveBeenCalledWith();
  });

  it('says why Mercy is shut without waiting for the chunk content', async () => {
    content.ready = false;
    const fresh = createFreshState();
    dry({ chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 },
      unlocks: { ...fresh.unlocks, skills: { Hitpoints: 1, Woodcutting: 2 }, levels: { ...fresh.unlocks.levels, Woodcutting: 15 } } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    expect(screen.getByText(/Fate's Mercy waits while Woodcutting can still level/)).toBeTruthy();
    expect(screen.queryByText(/Checking your chunks/)).toBeNull();
  });

  it('keeps Mercy shut while a quest is doable, and says which', async () => {
    quests.rows = [{ id: "Cook's Assistant", bucket: 'DOABLE' }, { id: 'Dragon Slayer I', bucket: 'LOCKED' }];
    dry({ chunkedBreakthroughs: { Attack: 2, Hitpoints: 2, Woodcutting: 3 } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    expect((screen.getByRole('button', { name: 'Call on Fate' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Fate's Mercy waits while Cook's Assistant is doable in your chunks. If you can't, and nothing new comes for 3 days, it opens anyway.")).toBeTruthy();
  });

  it('says what keeps Mercy shut when the run has no Keys: a skill with room, or Fate for a ritual', async () => {
    const fresh = createFreshState();
    dry({ chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 },
      unlocks: { ...fresh.unlocks, skills: { Hitpoints: 1, Woodcutting: 2 }, levels: { ...fresh.unlocks.levels, Woodcutting: 15 } } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    const first = render(<ChunkedFatePanel />);
    expect(screen.getByText("Fate's Mercy waits while Woodcutting can still level in your chunks: level 15 of its tier cap 20. If you can't, and nothing new comes for 3 days, it opens anyway.")).toBeTruthy();
    first.unmount();
    dry({ chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 }, fatePoints: 30 });
    render(<ChunkedFatePanel osrs />);
    expect(screen.getByText("Fate's Mercy waits while you have 30 Fate: enough for the Ritual of Chaos (25 Fate) at the Void Altar.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Call on Fate' })).toBeNull();
  });

  it('shows nothing while the run still has Keys and nothing is capped', async () => {
    const fresh = createFreshState();
    dry({ keys: 2, unlocks: { ...fresh.unlocks, skills: {}, levels: { ...fresh.unlocks.levels, Hitpoints: 10 } } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    const { container } = render(<ChunkedFatePanel />);
    expect(container.textContent).toBe('');
  });

  it('lists the things a new chunk offers and rolls the one the player ticks', async () => {
    const fresh = createFreshState();
    dry({
      keys: 1,
      unlocks: { ...fresh.unlocks, chunks: ['49,50'], skills: { Hitpoints: 1, Attack: 1, Woodcutting: 1 } },
      chunkExplore: { from: 0, done: {} },
    });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    expect(screen.getByText('Explore your new chunks')).toBeTruthy();
    const thieving = screen.getByRole('button', { name: 'Trained Thieving' }) as HTMLButtonElement;
    expect(thieving.disabled).toBe(true);
    expect(thieving.title).toBe('Needs Thieving tier 2.');
    // The reason is printed too: phones have no hover.
    expect(screen.getByText(/Trained Thieving: needs Thieving tier 2\./)).toBeTruthy();
    // The chunk's tree patch needs its patch type unlocked too.
    expect((screen.getByRole('button', { name: 'Trained Farming' }) as HTMLButtonElement).title).toBe('Needs Farming tier 2.');
    // Chunks read by their own name and coordinates, so two Lumbridge chunks read apart.
    expect(screen.getByText('Lumbridge Castle Backyard (49, 50)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fought something' }));
    expect(game.current.exploreChunk).toHaveBeenCalledWith('49,50', '@monster', expect.any(Number), expect.any(Number));
    expect(screen.queryByText("Fate's Mercy")).toBeNull();
  });

  it('says a run with no combat style has nothing to fight with (fate review V5)', async () => {
    const fresh = createFreshState();
    dry({
      keys: 1,
      unlocks: { ...fresh.unlocks, chunks: ['49,50'], skills: { Hitpoints: 1, Woodcutting: 1 } },
      chunkExplore: { from: 0, done: {} },
    });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    const fought = screen.getByRole('button', { name: 'Fought something' }) as HTMLButtonElement;
    expect(fought.disabled).toBe(true);
    expect(fought.title).toBe('Needs a combat style (melee, Magic, or Ranged with a Weapon slot).');
  });

  it('draws the same rolls in the OSRS layout, one chunk when compact', async () => {
    const fresh = createFreshState();
    dry({
      keys: 1,
      unlocks: { ...fresh.unlocks, chunks: ['49,50', '50,49'], skills: { Hitpoints: 1, Woodcutting: 1 } },
      chunkExplore: { from: 0, done: { '49,50': ['@monster'] } },
    });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    const { container } = render(<ChunkedFatePanel osrs compact />);
    expect(container.querySelector('.ofate')).toBeTruthy();
    const explore = container.querySelector('.ofate-block')!;
    expect(explore.textContent).toContain('Explore your new chunks');
    // Newest chunk first; the compact panel lists just that one.
    expect(explore.querySelectorAll('.ofate-row')).toHaveLength(1);
    expect(explore.querySelector('.ofate-left')?.textContent).toMatch(/^\d left$/);
    expect(explore.textContent).toContain('And 1 more chunk to explore.');
    expect(explore.querySelector('.ofate-btn')?.className).toContain('osrs-btn');
  });
});
