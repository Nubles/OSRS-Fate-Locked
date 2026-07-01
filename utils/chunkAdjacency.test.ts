import { describe, it, expect } from 'vitest';
import {
  ALL_CHUNKS, ALL_CHUNK_KEYS, chunkKey, parseChunkKey,
  CHUNKED_START, CHUNKED_START_KEY, isChunkUnlocked, isFrontierChunk, getChunkFrontier,
} from './chunkAdjacency';

describe('chunk key helpers', () => {
  it('round-trips through chunkKey/parseChunkKey', () => {
    const c = { cx: 12, cy: 34 };
    expect(parseChunkKey(chunkKey(c))).toEqual(c);
  });
});

describe('ALL_CHUNKS', () => {
  it('has no duplicate coordinates', () => {
    expect(new Set(ALL_CHUNK_KEYS).size).toBe(ALL_CHUNK_KEYS.length);
  });

  it('includes the fixed start chunk', () => {
    expect(ALL_CHUNK_KEYS).toContain(CHUNKED_START_KEY);
  });
});

describe('isChunkUnlocked', () => {
  it('the start chunk is always unlocked, even with an empty unlock list', () => {
    expect(isChunkUnlocked(CHUNKED_START_KEY, [])).toBe(true);
  });

  it('a rolled chunk is unlocked once present in the list', () => {
    const key = chunkKey({ cx: CHUNKED_START.cx + 1, cy: CHUNKED_START.cy });
    expect(isChunkUnlocked(key, [])).toBe(false);
    expect(isChunkUnlocked(key, [key])).toBe(true);
  });
});

describe('isFrontierChunk / getChunkFrontier', () => {
  it('with nothing unlocked, the frontier is exactly the 4 neighbours of the start chunk', () => {
    const frontier = getChunkFrontier([]);
    const expected = [
      { cx: CHUNKED_START.cx + 1, cy: CHUNKED_START.cy },
      { cx: CHUNKED_START.cx - 1, cy: CHUNKED_START.cy },
      { cx: CHUNKED_START.cx, cy: CHUNKED_START.cy + 1 },
      { cx: CHUNKED_START.cx, cy: CHUNKED_START.cy - 1 },
    ].filter(c => ALL_CHUNK_KEYS.includes(chunkKey(c))); // only neighbours actually on the map grid
    expect(frontier.map(chunkKey).sort()).toEqual(expected.map(chunkKey).sort());
  });

  it('the start chunk itself is never in its own frontier', () => {
    expect(getChunkFrontier([]).some(c => chunkKey(c) === CHUNKED_START_KEY)).toBe(false);
  });

  it('a chunk two steps away is not in the frontier until the chunk between is unlocked', () => {
    const near = chunkKey({ cx: CHUNKED_START.cx + 1, cy: CHUNKED_START.cy });
    const far = chunkKey({ cx: CHUNKED_START.cx + 2, cy: CHUNKED_START.cy });
    expect(isFrontierChunk(far, [])).toBe(false);
    expect(isFrontierChunk(far, [near])).toBe(true);
  });

  it('an already-unlocked chunk is never its own frontier member', () => {
    const near = chunkKey({ cx: CHUNKED_START.cx + 1, cy: CHUNKED_START.cy });
    expect(isFrontierChunk(near, [near])).toBe(false);
  });

  it('a chunk unrelated to the unlocked cluster is not in the frontier', () => {
    const farAway = ALL_CHUNKS.find(c => Math.abs(c.cx - CHUNKED_START.cx) > 20 || Math.abs(c.cy - CHUNKED_START.cy) > 20);
    expect(farAway).toBeDefined();
    expect(isFrontierChunk(chunkKey(farAway!), [])).toBe(false);
  });
});
