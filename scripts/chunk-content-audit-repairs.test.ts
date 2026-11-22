import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readPinnedChunkSource } from './chunk-source.mjs';
import { assertInteriorMetadataConservation } from './chunk-interiors.mjs';
import { transformChunkContent } from './chunk-content-transform.mjs';
import full from '../public/chunk-content.json';
import { ChunkContentService, type EntityKind } from '../services/ChunkContentService';

let source: any;
const service = new ChunkContentService();
beforeAll(async () => {
  source = (await readPinnedChunkSource()).data;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => full })));
  await service.init();
  vi.unstubAllGlobals();
});

describe('full-source content conservation', () => {
  it('retains each named diary reference in located runtime content and counts each named clue only once', () => {
    const evidence = assertInteriorMetadataConservation(source, full.chunks, full.interiors);
    expect(evidence).toHaveLength(108);
    const aggregate = service.aggregate(service.allChunkCoords());
    for (const row of evidence) {
      const record = source.chunks[row.id];
      for (const [area, refs] of Object.entries(record.Diary ?? {})) for (const ref of String(refs).split(',').map(ref => ref.trim())) {
        expect(aggregate.diaries[area]?.split(',').map(ref => ref.trim()), `${row.id}: ${area}/${ref}`).toContain(ref);
      }
    }
    const yubi = Object.entries(full.interiors).filter(([id, entry]) => id === "Yu'biusk" || entry.name === "Yu'biusk");
    expect(yubi.reduce((sum, [, entry]) => sum + ((entry.content as any).c?.hard ?? 0), 0)).toBe(1);
  });

  it('rejects field-level metadata loss and duplicate clue evidence', () => {
    const missing = structuredClone(full.interiors) as any;
    delete missing['Falador Mole Lair'].content.d;
    expect(() => assertInteriorMetadataConservation(source, full.chunks, missing)).toThrow('Lost interior diary evidence: Falador Mole Lair/Falador/HD3');
    const doubled = structuredClone(full.interiors) as any;
    doubled["Yu'biusk"].content.c = { hard: 1 };
    expect(() => assertInteriorMetadataConservation(source, full.chunks, doubled)).toThrow('Interior clue conservation failed');
  });

  it('indexes every source search-term group from the same full entity and item locations as the service', () => {
    const kinds: Record<string, EntityKind> = { Monsters: 'monster', NPCs: 'npc', Objects: 'object' };
    const expected = new Map<string, Set<string>>();
    for (const [key, terms] of Object.entries(source.searchTerms)) {
      const [tag, family] = key.split('|');
      if (family !== 'Items' && !kinds[family]) continue;
      const ids = expected.get(tag) ?? new Set();
      for (const raw of Object.keys(terms as object)) {
        const name = raw.split('#')[0].trim();
        const locations = family === 'Items' ? service.itemSourceChunks(name) : service.entityLocations(name, [kinds[family]])?.locations ?? [];
        for (const location of locations) ids.add(String(location.cx * 256 + location.cy));
      }
      if (ids.size) expected.set(tag, ids);
    }
    expect(Object.keys(full.tags).sort()).toEqual([...expected.keys()].sort());
    for (const [tag, ids] of expected) expect([...new Set(service.tagChunks(tag).map(loc => String(loc.cx * 256 + loc.cy)))].sort(), tag).toEqual([...ids].sort());
  });

  it('includes a ground-spawn-only search term without a shop or drop table', () => {
    const result = transformChunkContent({ walkableChunks: ['256'], chunks: { 256: { Spawn: { 'Mining token': 1 } } }, searchTerms: { 'mining|Items': { 'Mining token': true } } }, { countFloors: {} });
    expect(result.full.tags.mining).toEqual(['256']);
  });
});

describe('reviewed shop placements (chunk audit, November 2026)', () => {
  const shopsIn = (id: string): string[] => (full.chunks as Record<string, { s?: string[] }>)[id]?.s ?? [];

  it("lists Spria's Slayer Equipment shop in Draynor and Chris's Lost Property shop at Emir's Arena", () => {
    // OSRS Wiki 'Slayer Equipment (shop)' rev 15364486: Spria, Draynor Village, 3092,3268 (48,51).
    expect(shopsIn('12339')).toContain('Slayer Equipment (shop)');
    // OSRS Wiki 'Lost Property shop' rev 15349467: Chris, Emir's Arena, 3385,3269 (52,51).
    expect(shopsIn('13363')).toContain('Lost Property shop');
    expect((full.taskUnlocks.Shops as Record<string, Record<string, string[]>>)['Lost Property shop']['13363'])
      .toEqual(['Previously earned the replacement quest reward']);
  });

  it("names Sir Tiffy Cashien's shops by their Wiki titles", () => {
    // OSRS Wiki 'Initiate Temple Knight Armoury' rev 15318625 and 'Proselyte Temple Knight Armoury' rev 15318742.
    const shops = full.taskUnlocks.Shops as Record<string, Record<string, string[]>>;
    const items = full.shopItems as Record<string, string[]>;
    for (const [title, quest, item] of [
      ['Initiate Temple Knight Armoury', 'Recruitment Drive', 'Initiate sallet'],
      ['Proselyte Temple Knight Armoury', 'The Slug Menace', 'Proselyte sallet'],
    ]) {
      expect(shopsIn('11828')).toContain(title);
      expect(shops[title]['11828']).toEqual([`${quest} Complete the quest`]);
      expect(items[title]).toContain(item);
    }
    expect(shopsIn('11828').filter(name => name.startsWith('Sir Tiffy Cashien'))).toEqual([]);
    expect(Object.keys(items).filter(name => name.startsWith('Sir Tiffy Cashien'))).toEqual([]);
  });
});
