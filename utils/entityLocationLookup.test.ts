import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import generated from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { RESOURCE_MAP } from '../data/resourceData';
import { SOURCE_TYPE_KINDS } from './chunkLocations';
import { findEntityLocations } from './entityLocationLookup';

const source = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => generated })));
  await source.init();
});
afterAll(() => vi.unstubAllGlobals());

describe('reviewed resource-host location links', () => {
  it.each([
    ['Mage Arena Shop', 'SHOP', 'shop'],
    ['Magpie Impling', 'DROP', 'npc'],
    ['Dragon Impling', 'DROP', 'npc'],
    ['Duke Horacio', 'SPAWN', 'npc'],
    ['Chambers of Xeric', 'DROP', 'object'],
    ['Theatre of Blood', 'DROP', 'object'],
  ])('%s resolves through its actual spatial identity', (name, type, kind) => {
    const hit = findEntityLocations(source, name, SOURCE_TYPE_KINDS[type]);
    expect(hit?.kind).toBe(kind);
    expect(hit!.locations.length).toBeGreaterThan(0);
  });

  it('resolves every reviewed curated row using the production resource source kinds', () => {
    const names = new Set(['mage arena shop', 'magpie impling', 'dragon impling', 'duke horacio', 'chambers of xeric', 'theatre of blood']);
    const rows = Object.values(RESOURCE_MAP).flat().filter(row => !row.requirementsUnverified && names.has(row.name.toLowerCase()) && ['DROP', 'SHOP', 'SPAWN'].includes(row.type));
    expect(rows.length).toBe(24);
    for (const row of rows) expect(findEntityLocations(source, row.name, SOURCE_TYPE_KINDS[row.type])?.locations.length, row.name).toBeGreaterThan(0);
  });

  it('uses raid entrances, not arbitrary names or invented drop objects', () => {
    expect(findEntityLocations(source, 'Chambers of Xeric', ['monster'])?.locations).toContainEqual(expect.objectContaining({ cx: 19, cy: 55 }));
    expect(findEntityLocations(source, 'Theatre of Blood', ['monster'])?.locations).toContainEqual(expect.objectContaining({ cx: 57, cy: 50 }));
    expect(findEntityLocations(source, 'Duke Horacio', ['monster'])).toBeNull();
    expect(findEntityLocations(source, 'Banker', ['monster'])).toBeNull();
    expect(findEntityLocations(source, 'Some unreviewed raid', ['monster'])).toBeNull();
    expect(findEntityLocations(source, 'Mage Arena Shop', ['monster'])).toBeNull();
  });

  it.each(['constructor', '__proto__', 'toString'])('unknown input %s cannot select an inherited alias', name => {
    expect(findEntityLocations({ entityLocations: () => null }, name, ['monster'])).toBeNull();
  });
});
