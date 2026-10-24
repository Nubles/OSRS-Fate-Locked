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
  pickRandomPoolEntry,
  randomUnlockPool,
} from './gameEngine';

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
  // The shared policy no longer keeps random Keys to reachable places; this one
  // still does, so the place checks a policy can switch on stay covered.
  const placeFiltered: VanillaRandomAccessPolicy = { ...VANILLA_RANDOM_ACCESS_POLICY, randomCosts: ['key', 'chaosKey'] };

  it('lets a random Key land on an activity whose area the run cannot reach', () => {
    for (const cost of ['key', 'chaosKey'] as const) {
      expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'vanilla', cost)).toBe(true);
      expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'chunked', cost)).toBe(true);
    }
  });

  it('filters a vanilla activity until its exact area is accessible under a place-filtering policy', () => {
    const lockedOutpost = makeUnlocks();
    const openOutpost = makeUnlocks({ regions: ["Void Knights' Outpost"] });

    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', lockedOutpost, 'vanilla', 'key', placeFiltered)).toBe(false);
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', openOutpost, 'vanilla', 'key', placeFiltered)).toBe(true);
  });

  it('never filters activity rolls outside Vanilla and Chunked', () => {
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'chunked', 'key', placeFiltered)).toBe(false);
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'xtreme', 'key', placeFiltered)).toBe(true);
  });

  it('under a place-filtering policy, lets a Chunked run roll a minigame once it owns the chunk it is entered from', () => {
    const owned = makeUnlocks({ chunks: ['41,40'] });
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', owned, 'chunked', 'key', placeFiltered)).toBe(true);
    // Another chunk of the same named area is not enough.
    const others = namedAreaChunks("Void Knights' Outpost").map(c => `${c.cx},${c.cy}`).filter(key => key !== '41,40');
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks({ chunks: others }), 'chunked', 'key', placeFiltered)).toBe(false);
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

describe('Random Keys roll every place left, reachable or not (October 2026)', () => {
  const start = makeUnlocks();
  const PLACE_TABLES = [TableType.BOSSES, TableType.MINIGAMES, TableType.GUILDS, TableType.BANKS];

  it('offers every boss, minigame, guild and bank on a new Vanilla or Chunked run, to Keys and Chaos Keys alike', () => {
    for (const mode of ['vanilla', 'chunked'])
      for (const cost of ['key', 'chaosKey'] as const)
        for (const table of PLACE_TABLES)
          expect(randomUnlockPool(start, mode, cost, table).length, `${mode} ${cost} ${table}`).toBe(getPoolAndStateKey(table).pool.length);
  });

  it('includes the Mimic, the Bank boat and places behind an unfinished entry quest', () => {
    const chunked = (table: TableType) => randomUnlockPool(start, 'chunked', 'key', table).map(c => c.item);
    expect(chunked(TableType.BOSSES)).toEqual(expect.arrayContaining(['Mimic', 'Barrows Brothers']));
    expect(chunked(TableType.BANKS)).toContain('8999');
  });

  it('still drops what the run already holds', () => {
    const owned = makeUnlocks({ bosses: ['Giant Mole'], guilds: ["Champions' Guild"] });
    expect(randomUnlockPool(owned, 'vanilla', 'key', TableType.BOSSES).map(c => c.item)).not.toContain('Giant Mole');
    expect(randomUnlockPool(owned, 'chunked', 'chaosKey', TableType.GUILDS).map(c => c.item)).not.toContain("Champions' Guild");
  });
});

