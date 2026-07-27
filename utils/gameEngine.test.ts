import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableType, UnlockState } from '../types';
import { setStartArea } from './freeAreas';
import {
  describeRandomPoolBlockers,
  isRandomUnlockEligible,
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
});

describe('describeRandomPoolBlockers', () => {
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
