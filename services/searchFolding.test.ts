// ui-osrs-b.d2[0]: the damage calculator's monster search and the World
// map's Highlight searches ignore apostrophes, as the journal searches do.
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fullChunkContent from '../public/chunk-content.json';
import { MONSTER_CATALOGUE } from '../data/monsterCatalogue';
import { chunkContentService } from './ChunkContentService';
import { foldText } from '../utils/textFold';

const names = <T extends { name: string }>(xs: T[]) => xs.map(x => x.name);

describe('monster search (both layouts of the damage calculator)', () => {
  afterAll(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('finds bosses whose names hold an apostrophe when it is left out', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    const rows = JSON.parse(readFileSync(new URL(`../public/${MONSTER_CATALOGUE.asset}`, import.meta.url), 'utf8'));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => rows })));
    vi.resetModules();
    const { monsterService } = await import('./MonsterService');
    await monsterService.init();
    expect(names(monsterService.search('kril'))).toContain("K'ril Tsutsaroth");
    expect(names(monsterService.search('kreearra'))[0]).toBe("Kree'arra");
    expect(names(monsterService.search('vetion'))).toContain("Vet'ion");
    expect(names(monsterService.search('kril '))).toContain("K'ril Tsutsaroth");
    // Starts-with still ranks ahead of contains, on the folded text.
    const starts = (n: string) => foldText(n).text.startsWith('kr');
    const kr = names(monsterService.search('kr', 200));
    expect(kr.some(n => !starts(n))).toBe(true);
    const firstContains = kr.findIndex(n => !starts(n));
    expect(kr.slice(firstContains).some(starts)).toBe(false);
  });
});

describe('World map Highlight searches', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => fullChunkContent })));
    expect(await chunkContentService.init()).toBe(true);
  });
  afterAll(() => vi.unstubAllGlobals());

  it('finds drop items without their apostrophe', () => {
    expect(names(chunkContentService.searchItems('larrans key'))[0]).toBe("Larran's key");
    expect(names(chunkContentService.searchItems('blue dhide body'))).toContain("Blue d'hide body");
    expect(names(chunkContentService.searchItems('larrans key '))[0]).toBe("Larran's key");
  });

  it('finds entities without their apostrophe, as the item search does', () => {
    expect(names(chunkContentService.searchEntities('kril'))).toContain("K'ril Tsutsaroth");
    expect(names(chunkContentService.searchEntities('kreearra'))).toContain("Kree'arra");
  });
});
