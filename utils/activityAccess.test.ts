import { afterEach, describe, expect, it } from 'vitest';
import { UnlockState } from '../types';
import { setStartArea } from './freeAreas';
import { bankChunkKey, chunkedBankOwned, farmPlaceReachable, getActivityAccess } from './activityAccess';
import { ACTIVITY_CHUNKS, FARM_SLAYER_CARD_CHUNKS } from '../data/activityChunks';
import { BOSSES_LIST, GUILDS_LIST, MINIGAMES_LIST } from '../data/items';
import { BANK_IDS } from '../data/banks';

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

afterEach(() => {
  setStartArea(undefined);
});

describe('getActivityAccess', () => {
  it('requires the literal named area for Pest Control and Last Man Standing', () => {
    setStartArea('none');

    expect(getActivityAccess('Pest Control', makeUnlocks(), 'vanilla')).toEqual({
      eligible: false,
      requiredAreas: ["Void Knights' Outpost"],
      explanation: "Needs Void Knights' Outpost",
    });
    expect(getActivityAccess('Pest Control', makeUnlocks({ regions: ["Void Knights' Outpost"] }), 'vanilla').eligible).toBe(
      true,
    );

    expect(getActivityAccess('Last Man Standing', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Last Man Standing', makeUnlocks({ regions: ['Ferox Enclave'] }), 'vanilla').eligible).toBe(
      true,
    );
  });

  it('uses Falador for Giant Mole and Edgeville for Obor', () => {
    setStartArea('none');

    expect(getActivityAccess('Giant Mole', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Giant Mole', makeUnlocks({ regions: ['Falador'] }), 'vanilla').eligible).toBe(true);
    expect(getActivityAccess('Obor', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Obor', makeUnlocks({ regions: ['Edgeville'] }), 'vanilla').eligible).toBe(true);
  });

  it("requires Wizards' Tower for Guardians of the Rift rather than Al Kharid", () => {
    setStartArea('none');

    expect(getActivityAccess('Guardians of the Rift', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Guardians of the Rift', makeUnlocks({ regions: ['Al Kharid'] }), 'vanilla').eligible).toBe(
      false,
    );
    expect(
      getActivityAccess('Guardians of the Rift', makeUnlocks({ regions: ["Wizards' Tower"] }), 'vanilla').eligible,
    ).toBe(true);
  });

  it('requires Forgotten Cemetery for Crazy Archaeologist', () => {
    setStartArea('none');

    expect(getActivityAccess('Crazy Archaeologist', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(
      getActivityAccess('Crazy Archaeologist', makeUnlocks({ regions: ['Forgotten Cemetery'] }), 'vanilla').eligible,
    ).toBe(true);
  });

  it('allows any declared geographic gateway', () => {
    setStartArea('none');

    expect(getActivityAccess('Temple Trekking', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Temple Trekking', makeUnlocks({ regions: ['Burgh de Rott'] }), 'vanilla').eligible).toBe(
      true,
    );
    expect(getActivityAccess('Temple Trekking', makeUnlocks({ regions: ['Paterdomus'] }), 'vanilla').eligible).toBe(true);
  });

  it('keeps explicit non-gates eligible without any area unlocks', () => {
    setStartArea('none');

    for (const activity of ['Mimic', 'Shooting Stars', 'Mahogany Homes', 'Forestry']) {
      expect(getActivityAccess(activity, makeUnlocks(), 'vanilla')).toEqual({
        eligible: true,
        requiredAreas: [],
        explanation: '',
      });
    }
  });

  it('does not consider skills, quests, items, or combat state', () => {
    setStartArea('none');

    const geographicOnly = getActivityAccess(
      'Pest Control',
      makeUnlocks({ regions: ["Void Knights' Outpost"] }),
      'vanilla',
    );
    const withOtherRequirements = getActivityAccess(
      'Pest Control',
      makeUnlocks({
        regions: ["Void Knights' Outpost"],
        equipment: { Bronze: 0 },
        skills: { Combat: 1 },
        levels: { Combat: 3 },
        quests: [],
      }),
      'vanilla',
    );

    expect(withOtherRequirements).toEqual(geographicOnly);
  });

  it('preserves eligibility in modes without Key reserves', () => {
    setStartArea('none');

    expect(getActivityAccess('Pest Control', makeUnlocks(), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Pest Control', makeUnlocks(), 'xtreme')).toEqual({
      eligible: true,
      requiredAreas: [],
      explanation: '',
    });
  });

  it('fails closed for a missing vanilla activity declaration', () => {
    setStartArea('none');

    expect(getActivityAccess('Unknown activity', makeUnlocks(), 'vanilla')).toEqual({
      eligible: false,
      requiredAreas: [],
      explanation: 'Missing location declaration',
    });
  });

  it('fails closed for inherited object property names', () => {
    setStartArea('none');

    for (const activity of ['toString', '__proto__']) {
      expect(getActivityAccess(activity, makeUnlocks(), 'vanilla')).toEqual({
        eligible: false,
        requiredAreas: [],
        explanation: 'Missing location declaration',
      });
    }
  });
});

describe('getActivityAccess in Chunked', () => {
  const chunked = (chunks: string[] = [], over: Partial<UnlockState> = {}) => makeUnlocks({ chunks, ...over });

  it('counts only the exact entrance chunk, not a foothold in the named area (map review 5)', () => {
    // Lumbridge's start chunk used to open Tormented Demons and Tears of Guthix (both entered from 49,49).
    for (const activity of ['Tormented Demons', 'Tears of Guthix']) {
      expect(getActivityAccess(activity, chunked(), 'chunked')).toEqual({
        eligible: false,
        requiredAreas: ['Lumbridge (49, 49)'],
        explanation: 'Needs Lumbridge (49, 49)',
      });
      expect(getActivityAccess(activity, chunked(['49,49']), 'chunked').eligible).toBe(true);
    }
    // Two rolls toward Varrock's south fence used to open Scurrius and Bryophyta.
    expect(getActivityAccess('Scurrius', chunked(['50,51', '50,52']), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Scurrius', chunked(['50,51', '50,52', '50,53', '50,54']), 'chunked').eligible).toBe(true);
    // Any one of several entrances is enough.
    expect(getActivityAccess('Callisto', chunked(['51,58']), 'chunked').eligible).toBe(true);
  });

  it('opens nothing located from the start chunk alone', () => {
    const start = chunked();
    const located = [...BOSSES_LIST, ...MINIGAMES_LIST, ...GUILDS_LIST]
      .filter(activity => getActivityAccess(activity, start, 'chunked').eligible);
    expect(located).toEqual(['Forestry']);
  });

  it('follows the stated rule for places with no single chunk', () => {
    expect(getActivityAccess('Forestry', chunked(), 'chunked').eligible).toBe(true);
    expect(getActivityAccess('Mimic', chunked(), 'chunked')).toEqual({
      eligible: false,
      requiredAreas: ['a Mimic casket from an Elite or Master clue'],
      explanation: 'Needs a Mimic casket from an Elite or Master clue',
    });
    expect(getActivityAccess('Barracuda Trials', chunked(), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Barracuda Trials', chunked([], {
      skills: { Sailing: 1 }, levels: { Sailing: 1 }, quests: ['Pandemonium'],
    }), 'chunked').eligible).toBe(true);
    // Shooting Stars: any crash site the run owns, Abyssal Sire: the Zanaris shed.
    expect(getActivityAccess('Shooting Stars', chunked(), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Shooting Stars', chunked(['50,49']), 'chunked').eligible).toBe(true);
    expect(getActivityAccess('Abyssal Sire', chunked(['50,49']), 'chunked').eligible).toBe(true);
    expect(getActivityAccess('Unknown activity', chunked(), 'chunked').eligible).toBe(false);
  });

  it('keeps Vanilla on its named areas', () => {
    setStartArea('none');
    expect(getActivityAccess('Tormented Demons', makeUnlocks({ regions: ['Lumbridge'] }), 'vanilla').eligible).toBe(true);
    expect(getActivityAccess('Mimic', makeUnlocks(), 'vanilla').eligible).toBe(true);
  });
});

describe('Chunked banks and Farm places', () => {
  it('counts a bank only in an owned chunk, and the virtual Forestry entry anywhere', () => {
    expect(bankChunkKey('12850')).toBe('50,50');
    const start = makeUnlocks();
    const owned = BANK_IDS.filter(bank => chunkedBankOwned(bank, start));
    expect(owned.filter(bank => bankChunkKey(bank) !== undefined)).toEqual(['12850']);
    expect(owned.filter(bank => bankChunkKey(bank) === undefined)).toHaveLength(BANK_IDS.length - 125);
  });

  it('offers Brutus and Slayer masters in Chunked only from their own chunk', () => {
    const start = makeUnlocks();
    const brutus = ACTIVITY_CHUNKS.Brutus;
    expect(farmPlaceReachable(brutus, start, 'chunked')).toBe(false);
    expect(farmPlaceReachable(brutus, makeUnlocks({ chunks: ['50,51'] }), 'chunked')).toBe(true);
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS.Turael, start, 'chunked')).toBe(false);
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS.Aya, makeUnlocks({ chunks: ['45,55'] }), 'chunked')).toBe(true);
    // A Boss Task card shows with any master who gives boss tasks.
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS['Boss Task'], makeUnlocks({ chunks: ['44,46'] }), 'chunked')).toBe(true);
    expect(farmPlaceReachable(undefined, start, 'chunked')).toBe(false);
    // Every other mode keeps the full Farm list.
    expect(farmPlaceReachable(brutus, start, 'vanilla')).toBe(true);
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS.Turael, start, 'vanilla')).toBe(true);
  });
});

