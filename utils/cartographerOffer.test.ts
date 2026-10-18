import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshState, gameReducer } from '../context/GameContext';
import type { GameState, LogEntry } from '../types';
import { chunkKey, getChunkFrontier } from './chunkAdjacency';
import { cartographerHint, drawCartographerOffer, liveCartographerOffer } from './cartographerOffer';
import { drawFloat, seededContext } from './seededRng';

const run = (over: Partial<GameState> = {}): GameState => ({ ...createFreshState(), gameModeId: 'chunked', ...over });
const keys = (state: GameState) => drawCartographerOffer(state).map(chunkKey);
const logged = (state: GameState, message: string): GameState => ({
  ...state,
  history: [...state.history, { id: message, timestamp: 1, type: 'LEVEL_UP', message, hash: message } as LogEntry],
});

afterEach(() => vi.restoreAllMocks());

describe('drawCartographerOffer', () => {
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
    expect(drawCartographerOffer(state)).toHaveLength(Math.min(3, frontier.length));
  });
});

// Audit V4 (October 2026): the offer used to be redrawn from the newest history
// entry, so logging anything (even a free past-cap level) reshuffled it, and
// RITUAL_CARTOGRAPHER charted any frontier chunk at all. Fate now draws the
// offer once, the run keeps it, and the reducer charts only from it.
describe('the kept Cartographer offer', () => {
  type S = Parameters<typeof gameReducer>[0];
  const chunked = (over: Partial<GameState> = {}): S => ({
    ...createFreshState(), runId: 'run-v4', lastEvent: null, gameModeId: 'chunked', gameModeLocked: true, fatePoints: 40,
    ...over,
    unlocks: { ...createFreshState().unlocks, chunks: [], skills: { Hitpoints: 1, Woodcutting: 1 }, levels: { ...createFreshState().unlocks.levels, Woodcutting: 10 } },
  } as S);
  const draw = (s: S) => gameReducer(s, { type: 'CARTOGRAPHER_DRAW_OFFER' });
  const chart = (s: S, key: string) => gameReducer(s, { type: 'RITUAL_CARTOGRAPHER', payload: { chunkKey: key, label: '' } });

  it('refuses a frontier chunk fate did not offer, and charts an offered one', () => {
    const s = draw(chunked());
    const offered = liveCartographerOffer(s);
    expect(offered).toHaveLength(Math.min(3, getChunkFrontier([], s.unlocks).length));
    const notOffered = getChunkFrontier([], s.unlocks).map(chunkKey).find(k => !offered.includes(k));
    expect(notOffered).toBeDefined();
    expect(chart(s, notOffered!)).toBe(s);
    // Without a drawn offer nothing can be charted at all.
    expect(chart(chunked(), offered[0])).toEqual(expect.objectContaining({ fatePoints: 40 }));
    expect(chart(chunked(), offered[0]).unlocks.chunks).toEqual([]);
    const charted = chart(s, offered[1]);
    expect(charted.unlocks.chunks).toEqual([offered[1]]);
    expect(charted.fatePoints).toBe(0);
    expect(charted.cartographerOffer).toBeUndefined();
  });

  it('keeps the same offer through any amount of logging and reopening', () => {
    let s = draw(chunked());
    const offered = s.cartographerOffer;
    const frontier = getChunkFrontier([], s.unlocks).map(chunkKey);
    const seen = new Set(liveCartographerOffer(s));
    for (let i = 0; i < 30; i++) {
      s = gameReducer(s, { type: 'LEVEL_UP', payload: { skill: 'Woodcutting', chaosRoll: 0.99 } });
      s = draw(s);
      liveCartographerOffer(s).forEach(k => seen.add(k));
    }
    expect(s.fatePoints).toBe(40);
    expect(s.cartographerOffer).toEqual(offered);
    expect(seen.size).toBe(Math.min(3, frontier.length));
    expect(draw(s)).toBe(s); // reopening the chooser changes nothing
  });

  it('draws a new offer only once none of the kept chunks is on the frontier', () => {
    const s = draw(chunked());
    const [a, b, c] = s.cartographerOffer!;
    // Another unlock (a Chunks Key, say) takes one offered chunk: the other two stay.
    const one = { ...s, unlocks: { ...s.unlocks, chunks: [a] } };
    expect(liveCartographerOffer(one)).toEqual([b, c]);
    expect(draw(one)).toBe(one);
    // Once every kept chunk is gone from the frontier, the next opening draws afresh.
    const all = { ...s, unlocks: { ...s.unlocks, chunks: [a, b, c] } };
    expect(liveCartographerOffer(all)).toEqual([]);
    const redrawn = draw(all);
    expect(redrawn.cartographerOffer).toEqual(drawCartographerOffer(all).map(chunkKey));
    expect(redrawn.cartographerOffer!.length).toBeGreaterThan(0);
  });

  it('draws nothing outside Chunked', () => {
    const vanilla = { ...chunked(), gameModeId: 'vanilla' };
    expect(draw(vanilla)).toBe(vanilla);
  });
});

describe('cartographerHint', () => {
  it('counts shops and monsters in plain English', () => {
    expect(cartographerHint({ bank: true, shops: 1, monsters: 1 })).toBe('bank · 1 shop · 1 monster');
    expect(cartographerHint({ bank: false, shops: 2, monsters: 4 })).toBe('2 shops · 4 monsters');
    expect(cartographerHint({ bank: false, shops: 0, monsters: 0 })).toBe('quiet terrain');
  });
});
