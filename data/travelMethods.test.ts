import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { ALL_CHUNK_KEYS } from '../utils/chunkAdjacency';
import { OCEAN_CHUNK_KEYS } from '../utils/oceanAccess';
import { ARCANA_LIST, MOBILITY_LIST, POH_LIST } from './items';
import { NON_TRAVEL_OPTIONS, TRAVEL_METHODS } from './travelMethods';

/** Every chunk a player can stand in: land, ocean and interiors. */
let places: Set<string>;

beforeAll(async () => {
  const service = new ChunkContentService();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
  places = new Set([...ALL_CHUNK_KEYS, ...OCEAN_CHUNK_KEYS, ...service.interiorRecords().map((record) => record.key)]);
});

const destinations = (method: (typeof TRAVEL_METHODS)[number]) =>
  [...Object.values(method.options), ...Object.values(method.codes ?? {})].flatMap((option) => option.to);

describe('TRAVEL_METHODS', () => {
  it('have unique ids', () => {
    const ids = TRAVEL_METHODS.map((method) => method.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('match by exactly one kind, with ids or a spellbook and name', () => {
    for (const method of TRAVEL_METHODS) {
      const kinds = Object.keys(method.match);
      expect(kinds, method.id).toHaveLength(1);
      const match = method.match as Record<string, unknown>;
      if ('spell' in match) {
        const spell = match.spell as { book: string; name: string };
        expect(['standard', 'ancient', 'lunar', 'arceuus'], method.id).toContain(spell.book);
        expect(spell.name.trim(), method.id).not.toBe('');
      } else {
        const ids = match[kinds[0]] as number[];
        expect(['items', 'objects', 'npcs'], method.id).toContain(kinds[0]);
        expect(ids.length, method.id).toBeGreaterThan(0);
        expect(ids.every((id) => Number.isInteger(id) && id >= 0), method.id).toBe(true);
      }
    }
  });

  it('need only unlocks the app has', () => {
    const known = new Set<string>([...MOBILITY_LIST, ...ARCANA_LIST, ...POH_LIST]);
    const unknown = TRAVEL_METHODS.flatMap((method) =>
      method.unlocks.filter((id) => !known.has(id)).map((id) => `${method.id}: ${id}`));
    expect(unknown).toEqual([]);
  });

  it('name only travel options', () => {
    const never = new Set(NON_TRAVEL_OPTIONS.map((option) => option.toLowerCase()));
    for (const method of TRAVEL_METHODS) {
      const options = Object.keys(method.options);
      expect(options.length, method.id).toBeGreaterThan(0);
      expect(options.filter((option) => never.has(option.trim().toLowerCase())), method.id).toEqual([]);
    }
  });

  it('go only to land, ocean or interior chunks', () => {
    const nowhere = TRAVEL_METHODS.flatMap((method) => destinations(method)
      .filter((key) => !places.has(key)).map((key) => `${method.id}: ${key}`));
    expect(nowhere).toEqual([]);
  });

  it('cite a source', () => {
    for (const method of TRAVEL_METHODS) expect(method.source.trim(), method.id).not.toBe('');
  });
});
