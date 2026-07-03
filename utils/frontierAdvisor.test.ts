import { describe, it, expect } from 'vitest';
import { rankFrontierChunks } from './frontierAdvisor';
import { ALL_CHUNK_KEYS, chunkKey, parseChunkKey, CHUNKED_START_KEY, getChunkFrontier, chunkSubArea } from './chunkAdjacency';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { isNamedAreaReachableViaChunks } from './reachability';

// Minimal unlocks shape — the impact engine reads quests/diaries/levels etc.
// through the journal status helpers, which tolerate empty collections.
const baseUnlocks = (chunks: string[]) => ({
  chunks,
  regions: [],
  quests: [],
  diaries: [],
  skills: {},
  levels: {},
  equipment: {},
  bosses: [],
  minigames: [],
  arcana: [],
  housing: [],
  merchants: [],
  storage: [],
  guilds: [],
  slayer: [],
  farming: [],
  mobility: [],
});

describe('rankFrontierChunks', () => {
  it('returns nothing outside Chunked mode', () => {
    expect(rankFrontierChunks(baseUnlocks([]), 'locked')).toEqual([]);
    expect(rankFrontierChunks(baseUnlocks([]), undefined)).toEqual([]);
  });

  it('a fresh run ranks exactly the start chunk\'s frontier, never unlocked chunks', () => {
    const ranked = rankFrontierChunks(baseUnlocks([]), 'chunked');
    const frontierKeys = new Set(getChunkFrontier([]).map(chunkKey));
    expect(ranked.length).toBe(frontierKeys.size);
    expect(ranked.length).toBeGreaterThan(0);
    for (const r of ranked) {
      expect(frontierKeys.has(r.key)).toBe(true);
      expect(r.key).not.toBe(CHUNKED_START_KEY);
    }
  });

  it('detects a first foothold in a new named sub-area and scores its impact', () => {
    // Find a sub-area chunk whose orthogonal neighbor is on the map but in a
    // DIFFERENT (or no) sub-area — unlocking the neighbor puts the sub-area
    // chunk on the frontier as a first foothold.
    const all = new Set(ALL_CHUNK_KEYS);
    let target: string | null = null;
    let neighbor: string | null = null;
    outer:
    for (const [area, chunks] of Object.entries(SUB_AREA_CHUNKS)) {
      for (const c of chunks) {
        const key = chunkKey(c);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nKey = `${c.cx + dx},${c.cy + dy}`;
          if (!all.has(nKey) || nKey === CHUNKED_START_KEY) continue;
          if (chunkSubArea(nKey) === area) continue;
          // The neighbor must not itself foothold the area, and the area must
          // not be reachable from just the start chunk.
          if (isNamedAreaReachableViaChunks(area, [nKey])) continue;
          target = key; neighbor = nKey;
          break outer;
        }
      }
    }
    expect(target).not.toBeNull();

    const ranked = rankFrontierChunks(baseUnlocks([neighbor!]), 'chunked');
    const hit = ranked.find((r) => r.key === target);
    expect(hit).toBeDefined();
    expect(hit!.newAreas.length).toBeGreaterThan(0);
    expect(hit!.newAreas).toContain(chunkSubArea(target!));
  });

  it('layers chunk content in as a ranking tie-breaker with capped weight', () => {
    const contentFor = (cx: number, cy: number) =>
      `${cx},${cy}` === getChunkFrontier([]).map(chunkKey)[0]
        ? { monsters: [{ name: 'Goblin' }], shops: ['General Store'], quests: {} }
        : null;
    const hasBank = (cx: number, cy: number) => `${cx},${cy}` === getChunkFrontier([]).map(chunkKey)[0];

    const ranked = rankFrontierChunks(baseUnlocks([]), 'chunked', contentFor, hasBank);
    const enriched = ranked.find((r) => r.content);
    expect(enriched).toBeDefined();
    expect(enriched!.content).toEqual({ monsters: 1, shops: 1, quests: 0, hasBank: true });
    expect(enriched!.contentScore).toBeCloseTo(3 + 1 + 0 + 0.2);
    // Content alone (max ~9.something) must stay below a real foothold's
    // typical cascade weight — sanity-check the cap arithmetic holds.
    expect(enriched!.contentScore).toBeLessThan(10);
  });

  it('sorts by sortScore (impact + content + per-foothold bonus), descending', () => {
    const ranked = rankFrontierChunks(baseUnlocks([]), 'chunked');
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].sortScore).toBeGreaterThanOrEqual(ranked[i].sortScore);
    }
    // Every new-area foothold carries its flat bonus in the sort key — the
    // impact engine can't see area-gated merchants/resources, so a foothold
    // must never rank as if it were an empty tile.
    for (const r of ranked) {
      expect(r.sortScore).toBeCloseTo(r.cascadeScore + r.contentScore + r.newAreas.length * 3);
    }
  });
});
