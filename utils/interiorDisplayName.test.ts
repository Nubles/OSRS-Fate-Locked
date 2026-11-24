import { beforeAll, describe, expect, it, vi } from 'vitest';
import panel from '../components/ChunkActivityPanel.tsx?raw';
import serviceSource from '../services/ChunkContentService.ts?raw';
import full from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { interiorDisplayName } from './interiorDisplayName';

const service = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => full })));
  expect(await service.init()).toBe(true);
  vi.unstubAllGlobals();
});
const shown = (cx: number, cy: number) => (service.contentFor(cx, cy)?.interiors ?? []).map(i => interiorDisplayName(i.name));
const ids = (cx: number, cy: number) => (service.contentFor(cx, cy)?.interiors ?? []).map(i => i.sourceId);

describe('interior display names in the chunk panel list', () => {
  it('turns source keys into readable names', () => {
    expect(interiorDisplayName('Karuulm Slayer Dungeon#Lobby')).toBe('Karuulm Slayer Dungeon (Lobby)');
    expect(interiorDisplayName("Myth's Guild#Basement")).toBe("Myths' Guild (Basement)");
    expect(interiorDisplayName('Gryphons (dungeon)#Task-only')).toBe('Gryphons (dungeon), Task-only');
    expect(interiorDisplayName('Interior 4763')).toBe('Unnamed interior');
    expect(interiorDisplayName('Keldagrim')).toBe('Keldagrim');
  });

  it('shows readable names but keeps the raw source ids', () => {
    expect(shown(38, 44)).toContain("Myths' Guild (Basement)");
    expect(ids(38, 44)).toContain("Myth's Guild#Basement");
    expect(shown(20, 59)).toContain('Karuulm Slayer Dungeon (Lobby)');
    expect(shown(18, 55)).toContain('Unnamed interior');
    expect(ids(18, 55)).toContain('4763');
  });

  it('leaves no raw key or placeholder in any shown name', () => {
    const listed = (service.aggregate(service.allChunkCoords()).interiors ?? []).map(i => interiorDisplayName(i.name));
    expect(listed.length).toBeGreaterThan(700);
    expect(listed.filter(n => n.includes('#') || /^Interior \d+$/.test(n) || /\)\s*\(/.test(n))).toEqual([]);
  });

  it('keeps raw names where they are matched, not shown', () => {
    expect(service.contentFor(38, 44)?.interiors?.map(i => i.name)).toContain("Myth's Guild#Basement");
    expect(service.interiorsEnteredFrom(38, 44).map(i => i.name)).toContain("Myth's Guild#Basement");
    expect(service.interiorRecords().find(r => r.key === '29,140')?.name).toBe("Myth's Guild#Basement");
  });

  it('is applied in the chunk panel, not in the eagerly loaded service', () => {
    expect(panel.match(/content\.interiors\.map\(i => interiorDisplayName\(i\.name\)\)/g)).toHaveLength(2);
    expect(serviceSource).not.toContain('interiorDisplayName');
  });
});
