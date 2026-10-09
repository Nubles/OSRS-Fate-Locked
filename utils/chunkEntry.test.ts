import { beforeAll, describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import type { UnlockState } from '../types';
import { chunkEntry, chunkEntryReason, loadRunRoutes, PANDEMONIUM_ROUTE, runReach, type ReachSource } from './chunkEntry';
import { loadWalkSections } from './walkSections';
import { CHUNKED_START } from './chunkAdjacency';
import { chunkForPlace } from './chunkLocations';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';

// Routes walk the Chunk Picker sections, which load with the chunk content.
beforeAll(() => Promise.all([loadWalkSections(), loadRunRoutes()]));

const fresh = (): UnlockState => structuredClone(initialState.unlocks);
const idOf = ({ cx, cy }: { cx: number; cy: number }) => String(cx * 256 + cy);
const lumbridge = chunkForPlace('Lumbridge')!;
const falador = chunkForPlace('Falador')!;
const [oceanCx, oceanCy] = [...OCEAN_CHUNK_KEYS][0].split(',').map(Number);
const ocean = { cx: oceanCx, cy: oceanCy };

/** No transport at all, and one gate: the chunk north of Lumbridge needs Cook's Assistant. */
const north = { cx: lumbridge.cx, cy: lumbridge.cy + 1 };
const source: ReachSource = {
  connectGraph: () => ({}),
  questSections: () => ({ [idOf(north)]: ["Cook's Assistant"] }),
};

describe('chunkEntry', () => {
  it('locks a chunk the run does not own, whatever the reach says', () => {
    expect(chunkEntry(falador, fresh(), 'vanilla')).toBe('LOCKED');
    expect(chunkEntry(falador, fresh(), 'vanilla', new Set([idOf(falador)]))).toBe('LOCKED');
  });

  it('allows an owned chunk that a route reaches', () => {
    expect(chunkEntry(lumbridge, fresh(), 'vanilla', new Set([idOf(lumbridge)]))).toBe('ALLOWED');
  });

  it('holds an owned chunk no route reaches as not ready', () => {
    expect(chunkEntry(lumbridge, fresh(), 'vanilla', new Set())).toBe('NOT_READY');
  });

  it('counts an owned chunk as reached when there is no reach to go on', () => {
    expect(chunkEntry(lumbridge, fresh(), 'vanilla')).toBe('ALLOWED');
  });

  it('opens the ocean with Sailing and Pandemonium', () => {
    expect(chunkEntry(ocean, fresh(), 'vanilla')).toBe('LOCKED');
    const sailor = { ...fresh(), skills: { ...fresh().skills, Sailing: 1 }, quests: ['Pandemonium'] };
    expect(chunkEntry(ocean, sailor, 'vanilla')).toBe('ALLOWED');
  });

  // A player reported on 9 October 2026 that RuneLite locked the sea and the
  // Shipyard mid-Pandemonium, while the quest list said they could do it.
  it('opens the chunks Pandemonium uses while the quest is under way from Port Sarim', () => {
    const route = [...PANDEMONIUM_ROUTE].map((key) => {
      const [cx, cy] = key.split(',').map(Number);
      return { cx, cy };
    });
    const portSarim = { ...fresh(), regions: [...fresh().regions, 'Port Sarim'] };
    for (const coord of route) {
      expect(chunkEntry(coord, fresh(), 'vanilla'), `${coord.cx},${coord.cy} without Port Sarim`).toBe('LOCKED');
      expect(chunkEntry(coord, portSarim, 'vanilla'), `${coord.cx},${coord.cy} from Port Sarim`).toBe('ALLOWED');
    }
    const done = { ...portSarim, quests: ['Pandemonium'] };
    expect(chunkEntry({ cx: 47, cy: 47 }, done, 'vanilla')).toBe('LOCKED');
    expect(chunkEntry({ cx: 32, cy: 42 }, done, 'vanilla')).toBe('LOCKED');
    // No route reaches Port Sarim, so the quest can't start.
    expect(chunkEntry({ cx: 47, cy: 46 }, portSarim, 'vanilla', new Set())).toBe('LOCKED');
  });
});

describe('runReach', () => {
  it('walks from Lumbridge, and from the free chunk in Chunked runs', () => {
    expect(runReach(source, fresh(), 'vanilla').has(idOf(lumbridge))).toBe(true);
    const chunked = { ...fresh(), regions: [], chunks: [] };
    expect([...runReach(source, chunked, 'chunked')]).toEqual([idOf(CHUNKED_START)]);
  });

  it('does not enter a chunk behind an unfinished quest until it is done', () => {
    expect(runReach(source, fresh(), 'vanilla').has(idOf(north))).toBe(false);
    const done = { ...fresh(), quests: ["Cook's Assistant"] };
    expect(runReach(source, done, 'vanilla').has(idOf(north))).toBe(true);
  });

  it('leaves out chunks the run does not own', () => {
    expect(runReach(source, fresh(), 'vanilla').has(idOf(falador))).toBe(false);
  });

  // A player reported on 8 October 2026 that RuneLite called their Kourend
  // and elf camp chunks Unlocked while the tracker called them stranded.
  it('takes no travel network the run has not unlocked, as the tracker does', () => {
    const hosidius = SUB_AREA_CHUNKS.Hosidius[0];
    const fairyRings = { ...source, connectGraph: () => ({ [idOf(lumbridge)]: ['Zanaris'], Zanaris: [idOf(hosidius)] }) };
    const kourend = { ...fresh(), regions: [...fresh().regions, 'Hosidius'] };
    const across = (unlocks: UnlockState) => runReach(fairyRings, unlocks, 'vanilla').has(idOf(hosidius));
    expect(across(kourend)).toBe(false);
    const rings = {
      ...kourend, mobility: ['Fairy Rings'], quests: ['Fairytale I - Growing Pains'], equipment: { ...kourend.equipment, Weapon: 1 },
    };
    expect(across(rings)).toBe(true);
  });
});

describe('chunkEntryReason', () => {
  const sailor = () => ({ ...fresh(), skills: { ...fresh().skills, Sailing: 1 }, quests: ['Pandemonium'] });

  it('gives none for an ALLOWED chunk', () => {
    expect(chunkEntryReason(lumbridge, 'ALLOWED', fresh(), 'vanilla', [])).toBeUndefined();
  });

  it('says what would unlock a LOCKED chunk', () => {
    expect(chunkEntryReason(falador, 'LOCKED', fresh(), 'vanilla', [])).toBe('Unlock Falador');
    expect(chunkEntryReason(falador, 'LOCKED', fresh(), 'chunked', [])).toBe('Chunk not unlocked');
    expect(chunkEntryReason(ocean, 'LOCKED', fresh(), 'vanilla', [])).toBe('Needs Sailing and Pandemonium');
    expect(chunkEntryReason(ocean, 'LOCKED', sailor(), 'chunked', [])).toBe('Not reached from your coast');
  });

  it("names the quest a NOT_READY chunk's entry needs, or the missing route", () => {
    expect(chunkEntryReason(north, 'NOT_READY', fresh(), 'vanilla', ["Cook's Assistant"])).toBe("Needs Cook's Assistant");
    expect(chunkEntryReason(north, 'NOT_READY', fresh(), 'vanilla', ['Not A Real Quest'])).toBe('No route from Lumbridge');
    const done = { ...fresh(), quests: ["Cook's Assistant"] };
    expect(chunkEntryReason(north, 'NOT_READY', done, 'vanilla', ["Cook's Assistant"])).toBe('No route from Lumbridge');
    expect(chunkEntryReason(north, 'NOT_READY', fresh(), 'chunked', [])).toBe('No route from your start chunk');
  });
});
