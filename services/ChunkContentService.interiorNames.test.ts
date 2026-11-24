import { beforeAll, describe, expect, it, vi } from 'vitest';
import full from '../public/chunk-content.json';
import { ChunkContentService, interiorDisplayName } from './ChunkContentService';

const service = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => full })));
  expect(await service.init()).toBe(true);
  vi.unstubAllGlobals();
});
const names = (cx: number, cy: number) => (service.contentFor(cx, cy)?.interiors ?? []).map(i => i.name);
const ids = (cx: number, cy: number) => (service.contentFor(cx, cy)?.interiors ?? []).map(i => i.sourceId);

describe('interior display names in the chunk panel list', () => {
  it('turns source keys into readable names', () => {
    expect(interiorDisplayName('Karuulm Slayer Dungeon#Lobby')).toBe('Karuulm Slayer Dungeon (Lobby)');
    expect(interiorDisplayName("Myth's Guild#Basement")).toBe("Myths' Guild (Basement)");
    expect(interiorDisplayName('Interior 4763')).toBe('Unnamed interior');
    expect(interiorDisplayName('Keldagrim')).toBe('Keldagrim');
  });

  it('shows readable names but keeps the raw source ids', () => {
    expect(names(38, 44)).toContain("Myths' Guild (Basement)");
    expect(ids(38, 44)).toContain("Myth's Guild#Basement");
    expect(names(20, 59)).toContain('Karuulm Slayer Dungeon (Lobby)');
    expect(names(18, 55)).toContain('Unnamed interior');
    expect(ids(18, 55)).toContain('4763');
  });

  it('leaves no raw key or placeholder in any listed name', () => {
    const listed = service.aggregate(service.allChunkCoords()).interiors ?? [];
    expect(listed.length).toBeGreaterThan(700);
    expect(listed.filter(i => i.name.includes('#') || /^Interior \d+$/.test(i.name))).toEqual([]);
  });

  it('keeps raw names where they are matched, not shown', () => {
    expect(service.interiorsEnteredFrom(38, 44).map(i => i.name)).toContain("Myth's Guild#Basement");
    expect(service.interiorRecords().find(r => r.key === '29,140')?.name).toBe("Myth's Guild#Basement");
  });
});
