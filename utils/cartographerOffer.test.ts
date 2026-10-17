import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshState } from '../context/GameContext';
import type { GameState, LogEntry } from '../types';
import { chunkKey, getChunkFrontier } from './chunkAdjacency';
import { cartographerHint, cartographerOffer } from './cartographerOffer';
import { drawFloat, seededContext } from './seededRng';

const run = (over: Partial<GameState> = {}): GameState => ({ ...createFreshState(), gameModeId: 'chunked', ...over });
const keys = (state: GameState) => cartographerOffer(state).map(chunkKey);
const logged = (state: GameState, message: string): GameState => ({
  ...state,
  history: [...state.history, { id: message, timestamp: 1, type: 'LEVEL_UP', message, hash: message } as LogEntry],
});

afterEach(() => vi.restoreAllMocks());

describe('cartographerOffer', () => {
  it('offers the same three frontier chunks on every load of an unseeded run, without Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const state = run({ runId: 'run-a', unlocks: { ...createFreshState().unlocks, chunks: ['49,50', '51,50'] } });
    const offer = keys(state);

    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    const frontier = new Set(getChunkFrontier(state.unlocks.chunks ?? [], state.unlocks).map(chunkKey));
    for (const key of offer) expect(frontier.has(key)).toBe(true);
    expect(keys(structuredClone(state))).toEqual(offer);
    expect(random).not.toHaveBeenCalled();
  });

  it('draws a new offer once the run logs something, and differs between runs', () => {
    const state = run({ runId: 'run-a' });
    const offers = new Set([keys(state).join(';')]);
    for (let i = 0; i < 6; i++) offers.add(keys(logged(state, `level ${i}`)).join(';'));
    expect(offers.size).toBeGreaterThan(1);
    const others = new Set(['run-b', 'run-c', 'run-d', 'run-e'].map(runId => keys(run({ runId })).join(';')));
    expect(others.size).toBeGreaterThan(1);
  });

  it('draws what nextFloat would on a seeded run', () => {
    const state = logged(run({ runId: 'run-a', rngSeed: 'FATE-2026-W42', rngVersion: 2 }), 'level 1');
    const pool = getChunkFrontier(state.unlocks.chunks ?? [], state.unlocks);
    const expected: string[] = [];
    for (let i = 0; i < 3; i++) {
      expected.push(chunkKey(pool.splice(Math.floor(drawFloat('FATE-2026-W42', seededContext(state), 'cartographer', i) * pool.length), 1)[0]));
    }
    expect(keys(state)).toEqual(expected);
  });

  it('offers fewer when the frontier is small', () => {
    const state = run();
    const frontier = getChunkFrontier([], state.unlocks);
    expect(cartographerOffer(state)).toHaveLength(Math.min(3, frontier.length));
  });
});

describe('cartographerHint', () => {
  it('counts shops and monsters in plain English', () => {
    expect(cartographerHint({ bank: true, shops: 1, monsters: 1 })).toBe('bank · 1 shop · 1 monster');
    expect(cartographerHint({ bank: false, shops: 2, monsters: 4 })).toBe('2 shops · 4 monsters');
    expect(cartographerHint({ bank: false, shops: 0, monsters: 0 })).toBe('quiet terrain');
  });
});
