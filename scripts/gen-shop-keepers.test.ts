import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import {
  buildShopKeepers, CONTRACT_PATH, infoboxOwnerFields, jsonText, NO_KEEPER, ownerNames, readDoc, readSource, shopNames,
} from './gen-shop-keepers.mjs';

const service = new ChunkContentService();

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
});

const contract = () => JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as { schema: number; about: string; shops: Record<string, string[]> };

describe('shop keeper owner field', () => {
  it('reads one owner', () => {
    // Fine Fashions, revision 14991756.
    expect(ownerNames(' [[Rometti]]')).toEqual(['Rometti']);
  });

  it("takes a piped link's label, as the game shows the NPC", () => {
    // Varrock Swordshop, revision 15393727.
    expect(ownerNames(' [[Shop keeper (Varrock Swordshop)|Shop keeper]]')).toEqual(['Shop keeper']);
  });

  it("drops a page title's bracketed qualifier", () => {
    // Armoury (Combat Training Camp).
    expect(ownerNames(' [[Shop keeper (Combat Training Camp)]]')).toEqual(['Shop keeper']);
    expect(ownerNames(" [[Werewolf (Darkmeyer)#Lord Myrmel's home]]")).toEqual(['Werewolf']);
  });

  it('gives several names for several owners', () => {
    // Lumbridge General Store, Falador Party Room, Slayer Equipment (shop), Pickaxe-Is-Mine, Rat & Bat.
    expect(ownerNames(' [[Shop keeper (Lumbridge)|Shop keeper]], [[Shop assistant (Lumbridge)|Shop assistant]]'))
      .toEqual(['Shop keeper', 'Shop assistant']);
    expect(ownerNames(' [[Lucy]], [[Megan]]')).toEqual(['Lucy', 'Megan']);
    expect(ownerNames(' [[Turael]]/[[Aya]]')).toEqual(['Turael', 'Aya']);
    expect(ownerNames(' [[Tati]] and [[Sune]]')).toEqual(['Tati', 'Sune']);
    // A bracketed note is no owner, even with a link in it.
    expect(ownerNames(' [[Carl]] <br/> [[Roy]] (After [[Sins of the Father]])')).toEqual(['Carl', 'Roy']);
  });

  it("reads the owner of a shop whose name ends in s'", () => {
    // Agelus' Farm Shop, revision 14991807: the name gives no owner the plugin's own pattern finds.
    const source = { shops: { "Agelus' Farm Shop": { page: "Agelus' Farm Shop", revision: 14991807, owner: [' [[Agelus]]'] } } };
    expect(buildShopKeepers(source, ["Agelus' Farm Shop"], {}).shops).toEqual({ "Agelus' Farm Shop": ['Agelus'] });
  });

  it('reads the merchant who keeps a stall', () => {
    // Ardougne Silver Stall., revision 15318488.
    expect(ownerNames(' [[Silver merchant]]')).toEqual(['Silver merchant']);
    expect(ownerNames(' [[Fur trader (East Ardougne)|Fur Trader]]')).toEqual(['Fur Trader']);
  });

  it('gives no name for no owner, and mends a misspelt label', () => {
    expect(ownerNames(' None')).toEqual([]);
    expect(ownerNames(' No')).toEqual([]);
    expect(ownerNames(' [[Shopkeeper (Cam Torum)|Shopkeeeper]]')).toEqual(['Shopkeeper']);
  });

  it('reads every owner field of a versioned infobox, and nothing outside it', () => {
    const page = [
      '{{Otheruses|the shop}}',
      '{{Infobox Shop',
      '|version1 = Before',
      '|name = Trader Stan\'s Trading Post',
      '|owner1 = [[Trader Stan]]',
      '|owner2 = [[Trader Crewmember]]',
      '|map = {{Map|x=1|y=2}}',
      '}}',
      '{{Infobox NPC',
      '|owner = [[Not a shop keeper]]',
      '}}',
    ].join('\n');
    expect(infoboxOwnerFields(page)).toEqual(['[[Trader Stan]]', '[[Trader Crewmember]]']);
  });
});

describe('shop keeper table', () => {
  it('has a key for every shop name the export can put in a SHOPS row, and no other key', () => {
    // content.shops through the service, for every chunk with its interiors.
    const fromService = new Set<string>();
    for (const { cx, cy } of service.allChunkCoords()) for (const name of service.contentFor(cx, cy)?.shops ?? []) fromService.add(name);
    const names = shopNames(readDoc());
    expect(names.length).toBeGreaterThan(400);
    expect([...fromService].sort()).toEqual([...names].sort());
    const keys = Object.keys(contract().shops);
    expect(keys).toEqual(names);
    expect([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(keys);
  });

  it('has a key for every shop row of every golden bundle', () => {
    const keys = new Set(Object.keys(contract().shops));
    const dir = 'contracts/golden-bundles';
    const rows = readdirSync(dir).filter((file) => file.endsWith('.bundle.json.gz')).flatMap((file) => {
      const bundle = JSON.parse(gunzipSync(readFileSync(`${dir}/${file}`)).toString('utf8'));
      return Object.values(bundle.rules.chunks as Record<string, { categories: Record<string, { name: string; targetKind?: string }[]> }>)
        .flatMap((snapshot) => snapshot.categories.SHOPS ?? []).filter((row) => row.targetKind === 'SHOP');
    });
    expect(rows.length).toBeGreaterThan(100);
    expect([...new Set(rows.map((row) => row.name))].filter((name) => !keys.has(name))).toEqual([]);
  });

  it('is what the generator builds from the committed source', () => {
    expect(readFileSync(CONTRACT_PATH, 'utf8').replace(/\r\n?/g, '\n'))
      .toBe(jsonText(buildShopKeepers(readSource(), shopNames(readDoc()))));
    expect(Object.keys(contract())).toEqual(['schema', 'about', 'shops']);
    expect(contract().schema).toBe(1);
  });

  it('keeps the page and revision of every shop in the source', () => {
    for (const [name, record] of Object.entries(readSource().shops as Record<string, { page: string; revision: number; owner: string[] }>)) {
      expect(record.page, name).toBeTruthy();
      expect(Number.isInteger(record.revision) && record.revision > 0, name).toBe(true);
      expect(Array.isArray(record.owner), name).toBe(true);
    }
  });

  it('leaves a list empty only for a reviewed shop', () => {
    const empty = Object.entries(contract().shops).filter(([, keepers]) => !keepers.length).map(([name]) => name);
    expect(empty).toEqual(Object.keys(NO_KEEPER).sort());
    expect(empty.length).toBeLessThan(20);
    expect(contract().shops['Fine Fashions']).toEqual(['Rometti']);
    expect(contract().shops['Varrock Swordshop']).toEqual(['Shop keeper']);
    expect(contract().shops["Agelus' Farm Shop"]).toEqual(['Agelus']);
    expect(contract().shops['Dyes to Die For']).toEqual(['Xochitl']);
  });

  it('is imported by no module of the app', () => {
    // It is for the plugin: nothing of it goes into the app or the bundle the relay carries.
    const sources = import.meta.glob<string>(
      ['../{components,context,hooks,services,utils,data,config,workers}/**/*.{ts,tsx,js,mjs}', '../*.{ts,tsx}', '!../**/*.test.{ts,tsx}'],
      { query: '?raw', import: 'default', eager: true },
    );
    expect(Object.entries(sources).filter(([, text]) => /shop-keepers/.test(text)).map(([path]) => path)).toEqual([]);
  });
});
