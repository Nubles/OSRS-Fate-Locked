import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableType, UnlockState } from '../types';
import { VANILLA_RANDOM_ACCESS_POLICY, type VanillaRandomAccessPolicy } from '../data/activityAccess';
import { MISTHALIN_AREAS, REGION_GROUPS, REGIONS_LIST } from '../data/items';
import { setStartArea, unlockableAreas } from './freeAreas';
import { namedAreaChunks } from './reachability';
import {
  checkUnlockAvailability,
  getPoolAndStateKey,
  isRandomUnlockEligible,
  isOmniDirectUnlockAvailable,
  isValidUnlock,
  pickChaosEntry,
  pickRandomPoolEntry,
  pickRandomUnlock,
  randomUnlockPool,
  randomUnlockTables,
} from './gameEngine';
import { chaosPicksTableFirst } from './seededRng';

const baseUnlocks: UnlockState = {
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  chunks: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
};

const makeUnlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({ ...baseUnlocks, ...overrides });

beforeEach(() => {
  setStartArea('none');
});

afterEach(() => {
  setStartArea(undefined);
  vi.restoreAllMocks();
});

describe('isRandomUnlockEligible', () => {
  it('filters a vanilla activity until its exact area is accessible', () => {
    const lockedOutpost = makeUnlocks();
    const openOutpost = makeUnlocks({ regions: ["Void Knights' Outpost"] });

    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', lockedOutpost, 'vanilla')).toBe(false);
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', openOutpost, 'vanilla')).toBe(true);
  });

  it('keeps activity rolls available outside Vanilla and Chunked', () => {
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'chunked')).toBe(false);
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'xtreme')).toBe(true);
  });

  it('lets a Chunked run roll a minigame once it owns the chunk it is entered from', () => {
    const owned = makeUnlocks({ chunks: ['41,40'] });
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', owned, 'chunked')).toBe(true);
    // Another chunk of the same named area is not enough.
    const others = namedAreaChunks("Void Knights' Outpost").map(c => `${c.cx},${c.cy}`).filter(key => key !== '41,40');
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks({ chunks: others }), 'chunked')).toBe(false);
  });

  it('preserves normal validity behavior for tables outside the location policy', () => {
    const lockedState = makeUnlocks();

    expect(isRandomUnlockEligible(TableType.REGIONS, 'Morytania', lockedState, 'vanilla')).toBe(
      isValidUnlock(TableType.REGIONS, 'Morytania', lockedState),
    );
  });

  it('uses the shared table scope and hard-geography decisions when filtering a vanilla pool', () => {
    const noGeography: VanillaRandomAccessPolicy = {
      ...VANILLA_RANDOM_ACCESS_POLICY,
      requiresTrackedHardGeography: false,
    };
    const noFilteredTables: VanillaRandomAccessPolicy = {
      ...VANILLA_RANDOM_ACCESS_POLICY,
      filteredTables: [],
    };

    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'vanilla', 'key', noGeography)).toBe(true);
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'vanilla', 'key', noFilteredTables)).toBe(true);
  });

  it('applies hard geography only to configured random costs', () => {
    const standardOnly: VanillaRandomAccessPolicy = {
      ...VANILLA_RANDOM_ACCESS_POLICY,
      randomCosts: ['key'],
    };

    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'vanilla', 'key', standardOnly)).toBe(false);
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'vanilla', 'chaosKey', standardOnly)).toBe(true);
  });
});

describe('isOmniDirectUnlockAvailable', () => {
  it('uses the shared Omni allow decision for inaccessible direct selections', () => {
    const restricted: VanillaRandomAccessPolicy = {
      ...VANILLA_RANDOM_ACCESS_POLICY,
      omniDirect: { allowsLocationIneligible: false, warnsPlayer: true },
    };

    expect(isOmniDirectUnlockAvailable(TableType.BOSSES, 'Giant Mole', makeUnlocks(), 'vanilla', restricted)).toBe(false);
    expect(isOmniDirectUnlockAvailable(TableType.BOSSES, 'Giant Mole', makeUnlocks({ regions: ['Falador'] }), 'vanilla', restricted)).toBe(true);
    expect(isOmniDirectUnlockAvailable(TableType.BOSSES, 'Giant Mole', makeUnlocks(), 'vanilla')).toBe(true);
  });
});

describe('pickRandomPoolEntry', () => {
  it('does not invoke the gameplay draw when a filtered pool is empty', () => {
    const nextFloat = vi.fn(() => 0.5);

    expect(pickRandomPoolEntry([], nextFloat)).toBeUndefined();
    expect(nextFloat).not.toHaveBeenCalled();
  });
});

describe('a Chaos Key picks a table, then an entry (GP-6)', () => {
  const pool = [
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(item => ({ table: TableType.BANKS, item })),
    { table: TableType.SKILLS, item: 'Attack' },
    { table: TableType.EQUIPMENT, item: 'Head' }, { table: TableType.EQUIPMENT, item: 'Body' },
  ];

  it('gives every table with an entry the same chance, whatever its size', () => {
    const picks = (u: number) => pickChaosEntry(pool, index => index === 0 ? u : 0)!.table;
    // Three tables, in pool order: Banks, Skills, Equipment.
    expect([0, 0.34, 0.67].map(picks)).toEqual([TableType.BANKS, TableType.SKILLS, TableType.EQUIPMENT]);
    // The second draw picks uniformly inside the chosen table.
    expect(pickChaosEntry(pool, index => index === 0 ? 0.9 : 0.5)).toEqual({ table: TableType.EQUIPMENT, item: 'Body' });
    expect(pickChaosEntry(pool, index => index === 0 ? 0 : 0.99)).toEqual({ table: TableType.BANKS, item: 'h' });
  });

  it('draws twice, table then entry, and never for an empty pool', () => {
    const draw = vi.fn(() => 0.5);
    pickChaosEntry(pool, draw);
    expect(draw.mock.calls).toEqual([[0], [1]]);
    const none = vi.fn(() => 0.5);
    expect(pickChaosEntry([], none)).toBeUndefined();
    expect(none).not.toHaveBeenCalled();
  });

  it('shares Chaos draws equally among the tables a fresh Vanilla or Chunked run can draw from', () => {
    for (const mode of ['vanilla', 'chunked']) {
      const fresh = randomUnlockPool(makeUnlocks(), mode, 'chaosKey');
      const tables = randomUnlockTables(mode).filter(t => fresh.some(c => c.table === t));
      const counts = new Map<TableType, number>();
      const steps = tables.length * 40;
      for (let i = 0; i < steps; i++) {
        const picked = pickChaosEntry(fresh, index => index === 0 ? (i + 0.5) / steps : 0)!;
        counts.set(picked.table, (counts.get(picked.table) ?? 0) + 1);
      }
      expect([...counts.keys()]).toEqual(tables);
      expect(new Set(counts.values())).toEqual(new Set([40]));
    }
  });

  it('keeps Standard Keys and old seeded Chaos draws on one draw over the whole pool', () => {
    const nextFloat = vi.fn((_purpose: string, _index?: number) => 0.95);
    expect(pickRandomUnlock(pool, 'key', true, nextFloat)).toEqual({ table: TableType.EQUIPMENT, item: 'Body' });
    expect(nextFloat.mock.calls).toEqual([['gacha']]);
    nextFloat.mockClear();
    // 0.5 of 11 entries is the sixth bank; table-first would pick Skills.
    nextFloat.mockReturnValue(0.5);
    expect(pickRandomUnlock(pool, 'chaosKey', false, nextFloat)).toEqual({ table: TableType.BANKS, item: 'f' });
    expect(nextFloat.mock.calls).toEqual([['chaos']]);
    nextFloat.mockClear();
    expect(pickRandomUnlock(pool, 'chaosKey', true, nextFloat)).toEqual({ table: TableType.SKILLS, item: 'Attack' });
    expect(nextFloat.mock.calls).toEqual([['chaos', 0], ['chaos', 1]]);
  });

  it('uses the table-first pick on unseeded runs and on runs seeded from version 3', () => {
    expect(chaosPicksTableFirst({})).toBe(true);
    expect(chaosPicksTableFirst({ rngSeed: 'S', rngVersion: 3 })).toBe(true);
    for (const rngVersion of [undefined, 1, 2] as const) expect(chaosPicksTableFirst({ rngSeed: 'S', rngVersion })).toBe(false);
  });
});

describe('canonical Regions unlock pool', () => {
  it('offers Iorwerth Camp once and never offers the legacy Elf Camp name', () => {
    const { pool, stateKey } = getPoolAndStateKey(TableType.REGIONS);
    expect(stateKey).toBe('region');
    expect(pool.filter((name) => name === 'Iorwerth Camp')).toHaveLength(1);
    expect(pool).not.toContain('Elf Camp');
    expect(REGION_GROUPS.Tirannwn).toEqual([
      'Prifddinas', 'Lletya', 'Tyras Camp', 'Isafdar', 'Zul-Andra',
      'Arandar', 'Gwenith', 'Iorwerth Camp', 'Poison Waste',
    ]);
  });

  it('does not let a retained alias debt consume a Region roll slot or make its owner rollable', () => {
    const unlocks = {
      ...baseUnlocks,
      regions: [...REGIONS_LIST.filter(name => name !== 'Falador'), 'Elf Camp'],
    };

    expect(checkUnlockAvailability(unlocks).regions).toBe(true);
    expect(isValidUnlock(TableType.REGIONS, 'Iorwerth Camp', unlocks)).toBe(false);
    expect(getPoolAndStateKey(TableType.REGIONS).pool).not.toContain('Elf Camp');
  });
});

describe('areas a mode leaves locked in Misthalin', () => {
  const lockedMisthalin = MISTHALIN_AREAS.filter(area => area !== 'Lumbridge');

  it('adds legacy Xtreme\'s locked Misthalin areas to the Areas list, and nothing else', () => {
    expect(unlockableAreas('xtreme')).toEqual([...lockedMisthalin, ...REGIONS_LIST]);
    expect(unlockableAreas('xtreme')).not.toContain('Lumbridge');
    expect(unlockableAreas('vanilla')).toEqual(REGIONS_LIST);
    expect(unlockableAreas('chunked')).toEqual(REGIONS_LIST);
    expect(unlockableAreas('custom', {
      pityEnabled: true, pityThreshold: 50, omniChanceBase: 2, ritualCostMultiplier: 1,
      regionModifiers: false, startArea: 'lumbridge',
    })).toEqual([...lockedMisthalin, ...REGIONS_LIST]);
  });

  it('lets a legacy Xtreme run roll Varrock, Draynor and the rest of Misthalin', () => {
    setStartArea('lumbridge');
    const fresh = makeUnlocks();

    const areas = randomUnlockPool(fresh, 'xtreme', 'key', TableType.REGIONS).map(entry => entry.item);
    expect(areas).toEqual(expect.arrayContaining(lockedMisthalin));
    expect(areas).not.toContain('Lumbridge');
    expect(getPoolAndStateKey(TableType.REGIONS, 'xtreme').pool).toEqual(expect.arrayContaining(lockedMisthalin));

    // Every area outside Misthalin owned: only Misthalin is left to roll.
    const outside = makeUnlocks({ regions: [...REGIONS_LIST] });
    expect(checkUnlockAvailability(outside, 'xtreme').regions).toBe(true);
    expect(randomUnlockPool(outside, 'xtreme', 'key', TableType.REGIONS).map(entry => entry.item).sort())
      .toEqual([...lockedMisthalin].sort());
    expect(checkUnlockAvailability(makeUnlocks({ regions: [...REGIONS_LIST, ...lockedMisthalin] }), 'xtreme').regions)
      .toBe(false);
  });

  it('keeps Misthalin out of the Vanilla and Chunked Areas pools', () => {
    setStartArea(undefined);
    const outside = makeUnlocks({ regions: [...REGIONS_LIST] });
    expect(randomUnlockPool(makeUnlocks(), 'vanilla', 'key', TableType.REGIONS).map(entry => entry.item))
      .not.toContain('Varrock');
    expect(checkUnlockAvailability(outside, 'vanilla').regions).toBe(false);
    expect(getPoolAndStateKey(TableType.REGIONS, 'vanilla').pool).toEqual(REGIONS_LIST);
    expect(getPoolAndStateKey(TableType.REGIONS, 'chunked').pool).toEqual(REGIONS_LIST);
  });
});

describe('Chunked random pools hold only places in owned chunks (economy review 1, 2)', () => {
  const start = makeUnlocks();
  const items = (table: TableType, unlocks: UnlockState = start, cost: 'key' | 'chaosKey' = 'key') =>
    randomUnlockPool(unlocks, 'chunked', cost, table).map(c => c.item);

  it('offers only the start chunk bank (and the virtual Forestry entry) on a new run', () => {
    const banks = items(TableType.BANKS);
    expect(banks.filter(id => /^\d+$/.test(id))).toEqual(['12850']);
    expect(banks.length).toBeLessThanOrEqual(2);
    expect(items(TableType.BANKS, start, 'chaosKey')).toEqual(banks);
    // Vanilla keeps every bank not yet unlocked.
    expect(randomUnlockPool(start, 'vanilla', 'key', TableType.BANKS).length).toBe(getPoolAndStateKey(TableType.BANKS).pool.length);
  });

  it('adds a bank once its own chunk is owned', () => {
    // Draynor Village bank, 48,50.
    const id = String(48 * 256 + 50);
    expect(items(TableType.BANKS)).not.toContain(id);
    expect(items(TableType.BANKS, makeUnlocks({ chunks: ['49,50', '48,50'] }))).toContain(id);
  });

  it('offers no boss, guild or located minigame on a new run', () => {
    expect(items(TableType.BOSSES)).toEqual([]);
    expect(items(TableType.GUILDS)).toEqual([]);
    expect(items(TableType.MINIGAMES)).toEqual(['Forestry']);
    expect(randomUnlockPool(start, 'chunked', 'chaosKey').filter(c =>
      [TableType.BOSSES, TableType.GUILDS, TableType.MINIGAMES, TableType.BANKS].includes(c.table)).length).toBeLessThanOrEqual(3);
  });

  it('opens a guild from its entrance chunk', () => {
    expect(items(TableType.GUILDS, makeUnlocks({ chunks: ['49,52'] }))).toEqual(["Champions' Guild"]);
  });

  it('rolls the Bank boat once the run can sail (content audit fix 3)', () => {
    expect(items(TableType.BANKS)).not.toContain('8999');
    expect(items(TableType.BANKS, makeUnlocks({ skills: { Sailing: 1 }, levels: { Sailing: 1 }, quests: ['Pandemonium'] }))).toContain('8999');
  });

  it('keeps random Keys off places behind an unfinished entry quest, and off the Mimic (content audit fixes 1, 2)', () => {
    const morytania = makeUnlocks({ chunks: ['55,51'] });
    expect(items(TableType.BOSSES, morytania)).not.toContain('Barrows Brothers');
    expect(items(TableType.BOSSES, { ...morytania, quests: ['Priest in Peril'] })).toContain('Barrows Brothers');
    expect(isRandomUnlockEligible(TableType.BOSSES, 'Mimic', start, 'chunked')).toBe(false);
    // An Omni-Key may still pick either.
    expect(isOmniDirectUnlockAvailable(TableType.BOSSES, 'Mimic', start, 'chunked')).toBe(true);
    expect(isOmniDirectUnlockAvailable(TableType.BOSSES, 'Barrows Brothers', morytania, 'chunked')).toBe(true);
  });

  it('keeps Vanilla guild rolls unfiltered', () => {
    expect(randomUnlockPool(start, 'vanilla', 'key', TableType.GUILDS).length).toBe(getPoolAndStateKey(TableType.GUILDS).pool.length);
  });
});

