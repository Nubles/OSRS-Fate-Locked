import { beforeAll, describe, expect, it } from 'vitest';
import content from '../public/chunk-content.json';
import { SAILING_PORT_CHUNKS } from '../data/seaAccess';
import type { UnlockState } from '../types';
import { ALL_CHUNK_KEYS, CHUNKED_START, chunkKey, chunkedWalk, getChunkFrontier } from './chunkAdjacency';
import { chunkReachability } from './chunkReach';
import { chunkUnlocked } from './chunkLocations';
import { ISLAND_CHUNK_IDS, LAND_CHUNK_IDS, SEA_LANDING_IDS } from './chunkWalkReach';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';
import { reachedOwnedChunks } from './reachability';
import { travelReachability } from './travelReach';
import { loadWalkSections } from './walkSections';

// The frontier walks the Chunk Picker sections, which load with the chunk content.
beforeAll(() => loadWalkSections());

const connect = (content as unknown as { connect: Record<string, string[]> }).connect;
const run = (chunks: string[], over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks, mobility: [], arcana: [], housing: [],
  merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  banks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {}, ...over,
} as UnlockState);
const sailor = { skills: { Sailing: 1 }, levels: { Sailing: 1 }, quests: ['Pandemonium'] };
const keyOf = (id: string) => `${Math.floor(+id / 256)},${+id % 256}`;
const frontier = (unlocks: UnlockState) => getChunkFrontier(unlocks.chunks ?? [], unlocks).map(chunkKey);

/** Rolls every frontier chunk, again and again, until none is left; checks each one is reached once owned. */
const expand = (unlocks: UnlockState) => {
  const offeredUnreached: string[] = [];
  for (let step = 0; step < 300; step++) {
    const next = frontier(unlocks);
    if (!next.length) break;
    unlocks.chunks = [...(unlocks.chunks ?? []), ...next];
    const reached = reachedOwnedChunks(unlocks);
    offeredUnreached.push(...next.filter(key => !reached.has(key)));
  }
  return { owned: new Set([chunkKey(CHUNKED_START), ...(unlocks.chunks ?? [])]), offeredUnreached };
};

describe('Chunked frontier (map.md finding 1)', () => {
  it('still starts with the four chunks around the start chunk', () => {
    expect(frontier(run([])).sort()).toEqual(['49,50', '50,49', '50,51', '51,50']);
  });

  it("offers no chunk behind a wall, river or cliff: Wizards' Tower and the Kalphite Lair stay off it", () => {
    const next = frontier(run(['50,49', '49,49']));
    // 48,49 is walked into over Draynor's bridge from 48,50, never from 49,49;
    // 50,48 has no way in from 50,49 at all.
    expect(next).not.toContain('48,49');
    expect(next).not.toContain('50,48');
    expect(frontier(run(['49,50', '48,50']))).toContain('48,49');
  });

  it('grows only from owned land a route reaches', () => {
    // Owning the cut-off Wizards' Tower adds nothing to the frontier.
    expect(frontier(run(['48,49'])).sort()).toEqual(frontier(run([])).sort());
    expect(reachedOwnedChunks(run(['48,49']))).toEqual(new Set(['50,50']));
  });

  it('every chunk it offers, rolled, is one the run reaches, before Sailing and after', () => {
    const before = expand(run([]));
    expect(before.offeredUnreached).toEqual([]);
    const after = expand(run([...before.owned].filter(key => key !== '50,50'), sailor));
    expect(after.offeredUnreached).toEqual([]);
  });

  it('never offers Entrana from Falador or the Digsite from the Mage Training Arena by walking', () => {
    const { owned } = expand(run([]));
    expect(owned.has('45,52')).toBe(true); // Falador
    expect(owned.has('44,52')).toBe(false); // Entrana, a boat away
  });
});

describe('Chunked land before and with Sailing (findings 2 and 3)', () => {
  it('reaches 337 of the 623 land chunks by walking alone, and no island but by a walking path', () => {
    const { owned } = expand(run([]));
    expect(ALL_CHUNK_KEYS).toHaveLength(623);
    expect(owned.size).toBe(337);
    for (const key of ['47,46', '34,54', '29,53', '45,44', '44,52', '36,43', '30,48', '32,49']) {
      expect(owned.has(key), key).toBe(false);
    }
    // The islands walking reaches are Crandor, through the walking data's
    // Karamja path, and the Catherby shore chunk the data files under Entrana.
    expect([...ISLAND_CHUNK_IDS].map(keyOf).filter(key => owned.has(key)).sort()).toEqual(['43,52', '44,50', '44,51']);
  });

  it('reaches all 623 land chunks once the run can sail', () => {
    const { owned } = expand(run([], sailor));
    expect(new Set(ALL_CHUNK_KEYS)).toEqual(new Set([...owned].filter(key => LAND_CHUNK_IDS.has(String(+key.split(',')[0] * 256 + +key.split(',')[1])))));
    expect(owned.size).toBe(623);
  });

  it('puts every port and coast on the frontier from Port Sarim, the sea being one sea', () => {
    const strip = run(['49,50', '48,50', '47,50', '47,51', '47,49'], sailor);
    const walk = chunkedWalk(strip.chunks!, strip);
    expect(walk.reached.has('47,49')).toBe(true);
    expect(walk.sea).toBe(true);
    const next = frontier(strip);
    // Catherby, Rellekka and Brimhaven touch no chunk of open sea; Piscarilius
    // and Land's End are across it; The Pandemonium and Ynysdail are islands.
    for (const key of ['43,53', '41,57', '43,50', '28,57', '23,53', '47,46', '34,54']) expect(next, key).toContain(key);
    // The boat landings join too: the monks' boat from Port Sarim to Entrana.
    expect(next).toContain('44,52');
    expect(next.length).toBeGreaterThan(150);
  });

  it('keeps the coast off the frontier before Sailing, and the sea locked', () => {
    const strip = run(['49,50', '48,50', '47,50', '47,51', '47,49']);
    expect(frontier(strip)).not.toContain('43,53');
    expect(chunkedWalk(strip.chunks!, strip).sea).toBe(false);
    expect(chunkUnlocked(24, 41, strip, 'chunked')).toBe(false);
    expect(chunkUnlocked(24, 41, { ...strip, ...sailor }, 'chunked')).toBe(true);
  });

  it('opens every body of water from any coast the run reaches', () => {
    const strip = run(['49,50', '48,50', '47,50', '47,51', '47,49'], sailor);
    const reach = travelReachability(connect, strip, CHUNKED_START, undefined, 'chunked');
    // The Pandemonium's pocket (47,48), the open sea (24,41) and a one-chunk sea (49,48).
    for (const key of ['47,48', '24,41', '49,48']) {
      const [cx, cy] = key.split(',').map(Number);
      expect(reach.reachable.has(String(cx * 256 + cy)), key).toBe(true);
    }
  });
});

describe('Chunked reach passes only through owned chunks (finding 10)', () => {
  it('no longer reaches the Kalphite Lair through the Lumbridge castle cellar', () => {
    for (const reach of [chunkReachability, travelReachability]) {
      const result = reach(connect, run(['50,48']), CHUNKED_START, undefined, 'chunked');
      expect(result.stranded.has(String(50 * 256 + 48))).toBe(true);
    }
  });

  it('still joins two owned chunks a place without a chunk opens onto', () => {
    // 50,50 -> the castle cellar -> 50,50: arriving that way reaches all of a chunk.
    const result = chunkReachability({ [String(50 * 256 + 50)]: ['Cellar'], Cellar: [String(54 * 256 + 47)] }, run(['54,47']), CHUNKED_START, undefined, 'chunked');
    expect(result.reachable.has(String(54 * 256 + 47))).toBe(true);
    const chained = chunkReachability({ [String(50 * 256 + 50)]: ['Cellar'], Cellar: ['Cave'], Cave: [String(54 * 256 + 47)] }, run(['54,47']), CHUNKED_START, undefined, 'chunked');
    expect(chained.reachable.has(String(54 * 256 + 47))).toBe(false);
  });

  it('leaves the other modes passing through any chain of them', () => {
    const lumbridge = { cx: 50, cy: 50 };
    const chained = chunkReachability({ [String(50 * 256 + 50)]: ['Cellar'], Cellar: ['Cave'], Cave: [String(54 * 256 + 47)] }, run([], { regions: ['Ruins of Uzer'] }), lumbridge, undefined, 'vanilla');
    expect(chained.reachable.has(String(54 * 256 + 47))).toBe(true);
  });
});

describe('reachedOwnedChunks', () => {
  it('is the start chunk and the owned land walked to from it', () => {
    expect(reachedOwnedChunks(run([]))).toEqual(new Set(['50,50']));
    expect(reachedOwnedChunks(run(['50,49', '48,49']))).toEqual(new Set(['50,50', '50,49']));
    expect(reachedOwnedChunks(run(['49,50', '48,50', '48,49']))).toEqual(new Set(['50,50', '49,50', '48,50', '48,49']));
  });

  it('takes a gate of the caller, such as a quest the entry needs', () => {
    const blocked = (id: string) => id === String(49 * 256 + 50);
    expect(reachedOwnedChunks(run(['49,50', '48,50']), blocked)).toEqual(new Set(['50,50']));
  });

  it('holds the sea once the run sails it from a coast it reaches', () => {
    const reached = reachedOwnedChunks(run(['50,49', '49,49'], sailor));
    expect(reached.has('49,48')).toBe(true);
    expect([...OCEAN_CHUNK_KEYS].every(key => reached.has(key))).toBe(true);
  });
});

describe('sea data', () => {
  it('names every chunk with a Port master as a port, all of them land', () => {
    const chunks = (content as unknown as { chunks: Record<string, { p?: string[] }> }).chunks;
    const withPortMaster = Object.entries(chunks)
      .filter(([, chunk]) => (chunk.p ?? []).includes('Port master'))
      .map(([id]) => keyOf(id)).sort();
    expect([...SAILING_PORT_CHUNKS].sort()).toEqual(withPortMaster);
    for (const key of withPortMaster) expect(ALL_CHUNK_KEYS, key).toContain(key);
  });

  it('lands on every port, the ones that touch no open sea included', () => {
    for (const key of ['43,53', '41,57', '43,50', '41,49', '46,49']) {
      const [cx, cy] = key.split(',').map(Number);
      expect(SEA_LANDING_IDS.has(String(cx * 256 + cy)), key).toBe(true);
    }
  });
});
