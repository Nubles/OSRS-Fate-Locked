import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableType, UnlockState } from '../types';
import { VANILLA_RANDOM_ACCESS_POLICY, type VanillaRandomAccessPolicy } from '../data/activityAccess';
import { REGION_GROUPS } from '../data/items';
import { setStartArea } from './freeAreas';
import {
  describeRandomPoolBlockers,
  getPoolAndStateKey,
  isRandomUnlockEligible,
  isOmniDirectUnlockAvailable,
  isValidUnlock,
  pickRandomPoolEntry,
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
  it('filters a vanilla activity until its exact area is accessible', () => {
    const lockedOutpost = makeUnlocks();
    const openOutpost = makeUnlocks({ regions: ["Void Knights' Outpost"] });

    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', lockedOutpost, 'vanilla')).toBe(false);
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', openOutpost, 'vanilla')).toBe(true);
  });

  it('keeps activity rolls available outside vanilla', () => {
    expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', makeUnlocks(), 'chunked')).toBe(true);
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

describe('describeRandomPoolBlockers', () => {
  it('describes blockers for the configured Chaos cost without applying them to Standard', () => {
    const candidates = [{ table: TableType.MINIGAMES, item: 'Pest Control' }];
    const chaosOnly: VanillaRandomAccessPolicy = {
      ...VANILLA_RANDOM_ACCESS_POLICY,
      randomCosts: ['chaosKey'],
    };

    expect(
      describeRandomPoolBlockers(candidates, makeUnlocks(), 'vanilla', 'chaosKey', 3, chaosOnly),
    ).toEqual({
      sample: ["Pest Control — needs Void Knights' Outpost"],
      remaining: 0,
    });
    expect(
      describeRandomPoolBlockers(candidates, makeUnlocks(), 'vanilla', 'key', 3, chaosOnly),
    ).toEqual({
      sample: [],
      remaining: 0,
    });
  });

  it('returns the first blocked activities in candidate order without drawing RNG', () => {
    const random = vi.spyOn(Math, 'random');

    expect(
      describeRandomPoolBlockers(
        [
          { table: TableType.MINIGAMES, item: 'Pest Control' },
          { table: TableType.MINIGAMES, item: 'Last Man Standing' },
          { table: TableType.MINIGAMES, item: 'Shooting Stars' },
        ],
        makeUnlocks(),
        'vanilla',
        'key',
        1,
      ),
    ).toEqual({
      sample: ["Pest Control — needs Void Knights' Outpost"],
      remaining: 1,
    });

    expect(random).not.toHaveBeenCalled();
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
});
