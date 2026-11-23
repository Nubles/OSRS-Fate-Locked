// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { MERCY_QUIET_MS } from '../utils/chunkedFate';

const game = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../context/GameContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../context/GameContext')>()),
  useGame: () => game.current,
}));
// No quest is doable in this test's chunks; the real check needs chunk content.
const content = vi.hoisted(() => ({ ready: true, error: null as string | null, init: vi.fn(() => new Promise<boolean>(() => {})) }));
vi.mock('../services/ChunkContentService', () => ({ chunkContentService: { get ready() { return content.ready; }, get error() { return content.error; }, init: content.init, subscribe: () => () => {} } }));
const quests = vi.hoisted(() => ({ rows: [] as { id: string; bucket: string }[] }));
vi.mock('./QuestDoabilityPanel', () => ({ chunkedQuestRows: () => quests.rows }));

afterEach(() => { cleanup(); vi.useRealTimers(); quests.rows = []; content.ready = true; content.error = null; content.init.mockClear(); });

const dry = (over: Record<string, unknown> = {}) => {
  const fresh = createFreshState();
  game.current = {
    ...fresh,
    gameModeId: 'chunked',
    keys: 0,
    specialKeys: 0,
    chaosKeys: 0,
    unlocks: { ...fresh.unlocks, skills: { Attack: 1, Hitpoints: 10, Woodcutting: 2 }, levels: { ...fresh.unlocks.levels, Attack: 10, Woodcutting: 20 } },
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
    // Mercy is shut by the waiting Breakthroughs, and the line says so.
    expect(screen.getByText("Fate's Mercy")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Call on Fate' })).toBeNull();
    expect(screen.getByText("Fate's Mercy waits until you roll the Breakthrough for Attack.")).toBeTruthy();
    // Hitpoints is free and at tier 10, so it never waits for a Breakthrough.
    expect(screen.getAllByRole('button', { name: 'Roll' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Roll' })[1]);
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

  it('keeps Mercy shut and offers Retry when the chunk content failed to load', async () => {
    content.ready = false;
    content.error = 'HTTP 503';
    // Doable in the run's chunks, but the check cannot see it without the data.
    quests.rows = [{ id: "Cook's Assistant", bucket: 'DOABLE' }];
    dry({ chunkedBreakthroughs: { Attack: 2, Hitpoints: 2, Woodcutting: 3 } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    render(<ChunkedFatePanel />);
    expect(screen.getByRole('alert').textContent).toContain('Could not load the chunk data to check your quests.');
    expect((screen.getByRole('button', { name: 'Call on Fate' }) as HTMLButtonElement).disabled).toBe(true);
    const calls = content.init.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry chunk data' }));
    expect(content.init.mock.calls.length).toBe(calls + 1);
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

  it('moves the quiet-spell countdown on and opens Mercy when it ends, with the panel left open (chunked-fate.d3[3])', async () => {
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    vi.useFakeTimers();
    const t0 = Date.parse('2026-11-20T12:00:00Z');
    vi.setSystemTime(t0);
    const fresh = createFreshState();
    dry({ chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 }, chunkedProgressAt: t0 - MERCY_QUIET_MS + 5 * 60_000,
      unlocks: { ...fresh.unlocks, skills: { Hitpoints: 1, Woodcutting: 2 }, levels: { ...fresh.unlocks.levels, Woodcutting: 15 } } });
    render(<ChunkedFatePanel />);
    expect(screen.getByText(/nothing new comes for 5 minutes, it opens anyway\./)).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText(/nothing new comes for 4 minutes, it opens anyway\./)).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(4 * 60_000); });
    expect(screen.queryByText(/it opens anyway/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Call on Fate' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/nothing new has come for 3 days/)).toBeTruthy();
    // The clock stops once nothing on the panel counts down.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps no clock while the line that shows has no countdown', async () => {
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    vi.useFakeTimers();
    dry({ chunkedProgressAt: Date.now() });
    render(<ChunkedFatePanel />);
    expect(screen.getByText("Fate's Mercy waits until you roll the Breakthrough for Attack.")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
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

  it('says a Fortunate omen stops at the 95% cap like every other Fortunate text (chunked-fate.d1[3])', async () => {
    dry({ keys: 1, rituals: { fortunateRollsLeft: 3 } });
    const { ChunkedFatePanel } = await import('./ChunkedFatePanel');
    const first = render(<ChunkedFatePanel />);
    expect(screen.getByText('Fortunate: your next 3 Key rolls are 5% better, up to 95%.')).toBeTruthy();
    first.unmount();
    dry({ keys: 1, rituals: { fortunateRollsLeft: 1 } });
    render(<ChunkedFatePanel osrs />);
    expect(screen.getByText('Fortunate: your next Key roll is 5% better, up to 95%.')).toBeTruthy();
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
