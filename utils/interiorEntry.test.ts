import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { initialState } from '../context/GameContext';
import { interiorArea } from '../data/interiorAreas';
import { ChunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { chunkForPlace } from './chunkLocations';
import { evaluateEntityAccess } from './entityAccess';
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

  it('knows nothing of an interior with no entrance, unless its area is locked', () => {
    expect(interiorEntry({ key: '1,1', name: 'Test Cave', entrances: [] }, context(run({})))).toBe('UNKNOWN');
    const keldagrim: InteriorRecord = { key: '1,1', name: 'Keldagrim', entrances: [] };
    expect(interiorEntry(keldagrim, context(run({})))).toBe('LOCKED');
    expect(interiorEntry(keldagrim, context(run({ regions: ['Keldagrim'] })))).toBe('UNKNOWN');
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
