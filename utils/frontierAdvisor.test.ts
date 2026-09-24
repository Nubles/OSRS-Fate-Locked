import { describe, it, expect } from 'vitest';
import { rankFrontierChunks } from './frontierAdvisor';
import { ALL_CHUNK_KEYS, chunkKey, parseChunkKey, CHUNKED_START_KEY, getChunkFrontier, chunkSubArea } from './chunkAdjacency';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { isNamedAreaReachableViaChunks } from './reachability';
import { computeUnlockImpact } from './unlockImpact';
import { QUEST_DATA } from '../data/questData';

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

  it('simulates frontier chunks that quest and diary locations name exactly', () => {
    // West Falador (46,52) is one of Black Knights' Fortress's exact-chunk
    // locations, but 46,53 already holds Falador, so it is no new foothold.
    const quests: string[] = [];
    for (const quest of Object.values(QUEST_DATA)) {
      if (quests.reduce((sum, id) => sum + QUEST_DATA[id].points, 0) >= 12) break;
      if (quest.kind === 'quest' && quest.id !== "Black Knights' Fortress") quests.push(quest.id);
    }
    const unlocks = { ...baseUnlocks(['46,53', '47,54']), quests, equipment: { Head: 1, Body: 1 } };
    const expected = computeUnlockImpact(unlocks, { ...unlocks, chunks: [...unlocks.chunks, '46,52'] }, 'chunked');
    expect(expected.directQuestNames).toContain("Black Knights' Fortress");

    const row = rankFrontierChunks(unlocks, 'chunked').find(r => r.key === '46,52');
    expect(row?.newAreas).toEqual([]);
    expect(row?.newQuestNames).toEqual(expected.directQuestNames);
    expect(row?.score).toBe(expected.directScore);
    expect(row?.sortScore).toBeGreaterThanOrEqual(expected.cascadeScore);
    expect(row?.sortScore).toBeGreaterThan(0);
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
    // Bank 3 + one shop 1 + one monster 0.2, quartered.
    expect(enriched!.contentScore).toBeCloseTo((3 + 1 + 0 + 0.2) / 4);
  });

  it('never lets chunk content alone outrank a new-area foothold', () => {
    const footholds = new Set(rankFrontierChunks(baseUnlocks([]), 'chunked').filter(r => r.newAreas.length > 0).map(r => r.key));
    // The most content a chunk can score, on every chunk that is no foothold.
    const rich = (cx: number, cy: number) => footholds.has(`${cx},${cy}`) ? null : {
      monsters: Array.from({ length: 9 }, () => ({ name: 'Goblin' })),
      shops: ['A', 'B', 'C', 'D'],
      quests: { a: 1, b: 1, c: 1, d: 1 },
    };
    const ranked = rankFrontierChunks(baseUnlocks([]), 'chunked', rich, (cx, cy) => !footholds.has(`${cx},${cy}`));
    const bare = ranked.filter(r => r.newAreas.length === 0);
    expect(footholds.size).toBeGreaterThan(0);
    expect(bare.length).toBeGreaterThan(0);
    for (const foothold of ranked.filter(r => r.newAreas.length > 0)) {
      for (const tile of bare.filter(r => r.cascadeScore <= foothold.cascadeScore)) {
        expect(ranked.indexOf(foothold)).toBeLessThan(ranked.indexOf(tile));
      }
    }
    for (const tile of bare) expect(tile.contentScore).toBeLessThan(3);
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
