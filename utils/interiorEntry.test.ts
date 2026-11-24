import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { initialState } from '../context/GameContext';
import { interiorArea } from '../data/interiorAreas';
import { ChunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { chunkForPlace } from './chunkLocations';
import { evaluateEntityAccess } from './entityAccess';
import { isAreaReachable } from './reachability';
import { interiorEntry, type InteriorContext, type InteriorRecord } from './interiorEntry';

const service = new ChunkContentService();
const records = new Map<string, InteriorRecord>();

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
  for (const record of service.interiorRecords()) records.set(record.key, record);
});

const run = (changes: Partial<UnlockState>): UnlockState => ({ ...structuredClone(initialState.unlocks), ...changes });
const context = (unlocks: UnlockState, reachable?: Set<string>): InteriorContext => ({
  unlocks, gameModeId: 'vanilla', reachable,
  chunkEntryRequirements: (cx, cy) => service.chunkEntryRequirements(cx, cy),
});
const idOf = ({ cx, cy }: { cx: number; cy: number }) => String(cx * 256 + cy);

/** Keldagrim's entrance, 43,58, is in Mountain Camp; its route needs The Giant Dwarf started. */
const KELDAGRIM = '44,159';
const RAT_PITS = '30,73';
/** Mor Ul Rek's entrance, 44,49, is in Musa Point. */
const MOR_UL_REK = '37,80';

describe('interiorArea', () => {
  it('gives the area an interior belongs to, or none', () => {
    expect(interiorArea('Keldagrim')).toBe('Keldagrim');
    expect(interiorArea('Blast Furnace')).toBe('Keldagrim');
    expect(interiorArea('Keldagrim Rat Pits')).toBe('Keldagrim');
    expect(interiorArea('Mor Ul Rek#Inner Area')).toBe('Mor Ul Rek (TzHaar City)');
    expect(interiorArea('Inferno')).toBe('Mor Ul Rek (TzHaar City)');
    expect(interiorArea("Warriors' Guild#Basement")).toBe("Warriors' Guild");
    expect(interiorArea("Heroes' Guild#Basement")).toBe('Taverley');
    expect(interiorArea("Cerberus' Lair")).toBeUndefined();
    expect(interiorArea('Crandor and Karamja Dungeon')).toBeUndefined();
  });
});

describe('interiorEntry', () => {
  it('locks an owned interior while its entrance chunk is locked', () => {
    // The owner's decision for Keldagrim rolled with Mountain Camp locked.
    const unlocks = run({ regions: ['Keldagrim'], quests: ['The Giant Dwarf'] });
    expect(interiorEntry(records.get(KELDAGRIM)!, context(unlocks))).toBe('LOCKED');
  });

  it('locks an interior whose area is not rolled, even through an open entrance', () => {
    const unlocks = run({ regions: ['Mountain Camp'], quests: ['The Giant Dwarf'] });
    expect(interiorEntry(records.get(KELDAGRIM)!, context(unlocks))).toBe('LOCKED');
    expect(interiorEntry(records.get(MOR_UL_REK)!, context(run({ regions: ['Musa Point'] })))).toBe('LOCKED');
    expect(interiorEntry(records.get(MOR_UL_REK)!, context(run({ regions: ['Musa Point', 'Mor Ul Rek (TzHaar City)'] }))))
      .toBe('ALLOWED');
  });

  it("holds an interior to its route's requirements", () => {
    const owned = { regions: ['Keldagrim', 'Mountain Camp'] };
    expect(interiorEntry(records.get(KELDAGRIM)!, context(run({ ...owned, quests: ['The Giant Dwarf'] })))).toBe('ALLOWED');
    // "Started" can't be confirmed from completed quests alone.
    expect(interiorEntry(records.get(KELDAGRIM)!, context(run(owned)))).toBe('UNKNOWN');
    const dwarf = run({ ...owned, quests: ['The Giant Dwarf'] });
    expect(interiorEntry(records.get(RAT_PITS)!, context(dwarf))).toBe('NOT_READY');
    expect(interiorEntry(records.get(RAT_PITS)!, context({ ...dwarf, quests: ['The Giant Dwarf', 'Ratcatchers'] })))
      .toBe('ALLOWED');
  });

  it('needs What Lies Below for the Chaos altar through the Tunnel of Chaos (51,54)', () => {
    // OSRS Wiki 'Chaos Altar': the tunnel opens after partial completion of What Lies Below.
    const chaos = [...records.values()].find(record => record.name === 'Chaos altar')!;
    const chunked = (unlocks: UnlockState): InteriorContext => ({ ...context(unlocks), gameModeId: 'chunked' });
    // Partial progress can't be confirmed from completed quests alone.
    expect(interiorEntry(chaos, chunked(run({ chunks: ['51,54'], quests: [] })))).toBe('UNKNOWN');
    expect(interiorEntry(chaos, chunked(run({ chunks: ['51,54'], quests: ['What Lies Below'] })))).toBe('ALLOWED');
    // The Wilderness ruins (47,56) need no quest.
    expect(interiorEntry(chaos, chunked(run({ chunks: ['47,56'], quests: [] })))).toBe('ALLOWED');
  });

  it('opens the Motherlode Mine from the Ice Mountain camp (47,53) as well as Falador (47,52)', () => {
    // OSRS Wiki 'Motherlode Mine' revision 15383536: the Dwarven Mine camp in Ice Mountain's foothills leads
    // to the north entrance; 'Dwarven Mine' revision 15376949 puts that camp entrance in 47,53.
    const mine = records.get('58,88')!;
    expect(mine.name).toBe('Motherlode Mine');
    const chunked = (unlocks: UnlockState): InteriorContext => ({ ...context(unlocks), gameModeId: 'chunked' });
    const iceMountain = run({ chunks: ['47,53'], regions: [], quests: [] });
    expect(isAreaReachable('Motherlode Mine', iceMountain, 'chunked')).toBe(true);
    expect(interiorEntry(mine, chunked(iceMountain))).toBe('ALLOWED');
    expect(interiorEntry(mine, chunked(run({ chunks: ['47,52'], regions: [], quests: [] })))).toBe('ALLOWED');
    expect(interiorEntry(mine, chunked(run({ chunks: ['46,53'], regions: [], quests: [] })))).toBe('LOCKED');
  });

  it("holds an interior to its entrance chunk's own requirements", () => {
    const lumbridge = chunkForPlace('Lumbridge')!;
    const cellar: InteriorRecord = { key: '1,1', name: 'Test Cellar', entrances: [{ chunkId: idOf(lumbridge), requirements: [] }] };
    const gated: InteriorContext = {
      ...context(run({})),
      chunkEntryRequirements: (cx, cy) => (cx === lumbridge.cx && cy === lumbridge.cy ? ['Ratcatchers Complete the quest'] : []),
    };
    expect(interiorEntry(cellar, gated)).toBe('NOT_READY');
    expect(interiorEntry(cellar, { ...gated, unlocks: run({ quests: ['Ratcatchers'] }) })).toBe('ALLOWED');
  });

  it('is not ready while no route reaches the entrance', () => {
    const unlocks = run({ regions: ['Keldagrim', 'Mountain Camp'], quests: ['The Giant Dwarf'] });
    expect(interiorEntry(records.get(KELDAGRIM)!, context(unlocks, new Set()))).toBe('NOT_READY');
    expect(interiorEntry(records.get(KELDAGRIM)!, context(unlocks, new Set([idOf({ cx: 43, cy: 58 })])))).toBe('ALLOWED');
  });

  it('takes the most usable way in', () => {
    const cave: InteriorRecord = {
      key: '1,1',
      name: 'Test Cave',
      entrances: [
        { chunkId: idOf(chunkForPlace('Falador')!), requirements: [] },
        { chunkId: idOf(chunkForPlace('Lumbridge')!), requirements: [] },
      ],
    };
    expect(interiorEntry(cave, context(run({})))).toBe('ALLOWED');
    expect(interiorEntry({ ...cave, entrances: cave.entrances.slice(0, 1) }, context(run({})))).toBe('LOCKED');
  });

  it('opens the Abyss through the Mage of Zamorak, not through Kourend', () => {
    // A player in Temple of the Eye was told the Abyss was locked: the source's rifts out to
    // Kourend's Blood and Soul Altars were read as its only ways in.
    const abyss = records.get('47,75')!;
    expect(abyss.entrances.map(({ chunkId }) => chunkId)).toEqual([idOf({ cx: 48, cy: 55 })]);
    // The ditch is open from the start in Vanilla, so Enter the Abyss is all the Abyss needs.
    expect(interiorEntry(abyss, context(run({ quests: ['Enter the Abyss'] })))).toBe('ALLOWED');
    expect(interiorEntry(abyss, context(run({})))).toBe('NOT_READY');
  });

  it("opens a rune altar through its rift in the Abyss, as the altar's Diary tasks do", () => {
    // The Mind altar's ruins are in Goblin Village (46,54); its rift needs only Enter the Abyss.
    const mind = records.get('43,75')!;
    expect(interiorEntry(mind, context(run({})))).toBe('NOT_READY');
    expect(interiorEntry(mind, context(run({ quests: ['Enter the Abyss'] })))).toBe('ALLOWED');
    expect(interiorEntry(mind, context(run({ regions: ['Goblin Village'] })))).toBe('ALLOWED');
    // The death rift also needs Mourning's End Part II.
    const death = records.get('34,75')!;
    expect(interiorEntry(death, context(run({ quests: ['Enter the Abyss'] })))).toBe('NOT_READY');
    expect(interiorEntry(death, context(run({ quests: ['Enter the Abyss', "Mourning's End Part II"] })))).toBe('ALLOWED');
    // The law rift needs Troll Stronghold, and the blood rift Sins of the Father (to the True Blood Altar).
    const law = records.get('38,75')!;
    expect(interiorEntry(law, context(run({ quests: ['Enter the Abyss'] })))).toBe('NOT_READY');
    expect(interiorEntry(law, context(run({ quests: ['Enter the Abyss', 'Troll Stronghold'] })))).toBe('ALLOWED');
    // The cosmic rift needs Lost City and skips Zanaris, which the altar otherwise belongs to.
    const cosmic = records.get('33,75')!;
    expect(interiorEntry(cosmic, context(run({ quests: ['Enter the Abyss'] })))).toBe('NOT_READY');
    expect(interiorEntry(cosmic, context(run({ quests: ['Enter the Abyss', 'Lost City'] })))).toBe('ALLOWED');
    expect(interiorEntry({ ...cosmic, entrances: cosmic.entrances.filter((way) => !way.outsideArea) },
      context(run({ quests: ['Enter the Abyss', 'Lost City'] })))).toBe('LOCKED');
    const blood = records.get('44,74')!;
    expect(interiorEntry(blood, context(run({ quests: ['Enter the Abyss'] })))).toBe('NOT_READY');
    expect(interiorEntry(blood, context(run({ quests: ['Enter the Abyss', 'Sins of the Father'] })))).toBe('ALLOWED');
  });

  it('knows nothing of an interior with no entrance, unless its area is locked', () => {
    expect(interiorEntry({ key: '1,1', name: 'Test Cave', entrances: [] }, context(run({})))).toBe('UNKNOWN');
    const keldagrim: InteriorRecord = { key: '1,1', name: 'Keldagrim', entrances: [] };
    expect(interiorEntry(keldagrim, context(run({})))).toBe('LOCKED');
    expect(interiorEntry(keldagrim, context(run({ regions: ['Keldagrim'] })))).toBe('UNKNOWN');
  });
});

/**
 * A route that is plainly blocked (a quest not held) reads NOT_READY even when it
 * also has a requirement the save can't answer; UNKNOWN only when every blocker
 * is one of those (status-precedence). The real routes are moved to an owned
 * Lumbridge entrance so only the route's own requirements decide.
 */
describe("a blocked route's status", () => {
  const throughLumbridge = (key: string, name: string): InteriorRecord => {
    const record = records.get(key)!;
    expect(record.name).toBe(name);
    return { ...record, entrances: record.entrances.map((entrance) => ({ ...entrance, chunkId: idOf(chunkForPlace('Lumbridge')!) })) };
  };

  it('keeps The Scar not ready without Temple of the Eye, unknown with it, open with Desert Treasure II too', () => {
    const scar = throughLumbridge('31,100', 'The Scar');
    expect(interiorEntry(scar, context(run({})))).toBe('NOT_READY');
    expect(interiorEntry(scar, context(run({ quests: ['Temple of the Eye'] })))).toBe('UNKNOWN');
    expect(interiorEntry(scar, context(run({ quests: ['Temple of the Eye', 'Desert Treasure II'] })))).toBe('ALLOWED');
  });

  it('keeps a route with only requirements the save cannot answer unknown', () => {
    const cave: InteriorRecord = { key: '1,1', name: 'Test Cave', entrances: [{
      chunkId: idOf(chunkForPlace('Lumbridge')!), requirements: ['Test Cave: a task needs confirmation', 'Started Ratcatchers'],
    }] };
    expect(interiorEntry(cave, context(run({})))).toBe('UNKNOWN');
  });
});

describe("the app's own content checks", () => {
  it('agree with the entry for the interior the content is in', () => {
    // TzHaar-Ket live in Mor Ul Rek's outer area, 39,80, entered from Musa Point's 44,49.
    const monster = (unlocks: UnlockState) =>
      evaluateEntityAccess('TzHaar-Ket', 'monster', { cx: 44, cy: 49, sourceId: '10064' }, unlocks, 'vanilla', service);
    const outer = records.get('39,80')!;
    const karamja = run({ regions: ['Musa Point'] });
    expect(monster(karamja)).toEqual({ status: 'LOCKED', reasons: ['Unlock Mor Ul Rek (TzHaar City)'] });
    expect(interiorEntry(outer, context(karamja))).toBe('LOCKED');
    const city = run({ regions: ['Musa Point', 'Mor Ul Rek (TzHaar City)'] });
    expect(monster(city).status).toBe('ALLOWED');
    expect(interiorEntry(outer, context(city))).toBe('ALLOWED');
  });
});

describe('ChunkContentService.interiorRecords', () => {
  it('lists every interior with a chunk of its own, keyed by that chunk', () => {
    expect(records.size).toBe(service.interiorRecords().length);
    expect(records.size).toBeGreaterThan(600);
    for (const key of records.keys()) expect(key).toMatch(/^\d+,\d+$/);
    expect(records.get(KELDAGRIM)).toEqual({
      key: KELDAGRIM,
      name: 'Keldagrim',
      entrances: [{ chunkId: idOf({ cx: 43, cy: 58 }), requirements: ['Started The Giant Dwarf'] }],
    });
  });
});
