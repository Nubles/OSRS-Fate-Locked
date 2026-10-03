import { describe, expect, it } from 'vitest';
import { PETS } from '../data/pets';
import { DropSource, type LogEntry, type PetCompensationState } from '../types';
import {
  earlierPetRolls,
  gambitStakeFor,
  keysToWithhold,
  notEligiblePetCompensation,
  PET_COMPENSATION_ID,
  petCompensationOffer,
  petCompensationResult,
  validCompensationPets,
} from './petCompensation';

const entry = (type: LogEntry['type'], source?: string): LogEntry => ({
  id: `${type}-${source}`,
  timestamp: 1,
  type,
  message: '',
  ...(source ? { source } : {}),
});

const offer = (keyOnlyPets: number, omniPets = 0): PetCompensationState => ({
  releaseId: PET_COMPENSATION_ID,
  status: 'pending',
  keyOnlyPets,
  omniPets,
});

const vanilla = { ritualCostMultiplier: 1, pityEnabled: true, pityThreshold: 50 };

describe('earlier pet rolls', () => {
  it('counts the pet rolls that paid only a Key apart from those that brought an Omni-Key', () => {
    const history = [
      entry('ROLL_SUCCESS', DropSource.PET),
      entry('ROLL_SUCCESS', DropSource.PET),
      entry('ROLL_OMNI', DropSource.PET),
      entry('ROLL_SUCCESS', DropSource.RAID),
      entry('ROLL_OMNI', DropSource.QUEST_GRANDMASTER),
      // A pet claimed since the change is not an earlier roll.
      entry('PET', DropSource.PET),
    ];
    expect(earlierPetRolls(history)).toEqual({ keyOnlyPets: 2, omniPets: 1 });
    expect(petCompensationOffer(history)).toEqual(offer(2, 1));
  });

  it('offers nothing to a run that never rolled a pet', () => {
    expect(petCompensationOffer([entry('ROLL_SUCCESS', DropSource.RAID), entry('PET', DropSource.PET)]))
      .toEqual(notEligiblePetCompensation());
  });
});

describe('naming earlier pets', () => {
  it('needs one known, unclaimed pet for each earlier pet roll, none twice', () => {
    const [a, b, c] = PETS;
    expect(validCompensationPets(offer(1, 1), [a.id, b.id], [])).toBe(true);
    expect(validCompensationPets(offer(1, 1), [a.id], [])).toBe(false);
    expect(validCompensationPets(offer(1, 1), [a.id, b.id, c.id], [])).toBe(false);
    expect(validCompensationPets(offer(1, 1), [a.id, a.id], [])).toBe(false);
    expect(validCompensationPets(offer(1, 1), [a.id, 157004], [])).toBe(false);
    expect(validCompensationPets(offer(1, 1), [a.id, b.id], [b.id])).toBe(false);
  });
});

describe('the pet compensation choices', () => {
  const run = { keys: 4, specialKeys: 1, keysOwed: 0, fatePoints: 10 };

  it("'owe' gives an Omni-Key for each Key-only pet and owes as many Standard Keys", () => {
    expect(petCompensationResult(run, offer(2, 1), 'owe', vanilla)).toEqual({
      specialKeysAwarded: 2, keysOwedAdded: 2, pityKeysAwarded: 0, keysWithheld: 0,
      keys: 4, keysOwed: 2, fatePoints: 10,
    });
  });

  it("'free' gives the Omni-Keys and nothing else", () => {
    expect(petCompensationResult(run, offer(2), 'free', vanilla)).toEqual({
      specialKeysAwarded: 2, keysOwedAdded: 0, pityKeysAwarded: 0, keysWithheld: 0,
      keys: 4, keysOwed: 0, fatePoints: 10,
    });
  });

  it("'gamble' adds the mode's Gambit stake of Fate for each Key it gives up", () => {
    expect(gambitStakeFor(vanilla)).toBe(15);
    expect(gambitStakeFor({ ritualCostMultiplier: 2 })).toBe(30);
    expect(petCompensationResult(run, offer(2), 'gamble', vanilla)).toMatchObject({
      keysOwed: 2, fatePoints: 40, pityKeysAwarded: 0,
    });
    expect(petCompensationResult(run, offer(1), 'gamble', { ...vanilla, ritualCostMultiplier: 2 }))
      .toMatchObject({ fatePoints: 40 });
  });

  it("'gamble' Fate that reaches the pity line pays its Pity Key, which settles the owed Key first", () => {
    // 45 + 15 = 60: one Pity Key and 10 carried, and the Pity Key goes to the Key owed.
    expect(petCompensationResult({ ...run, fatePoints: 45 }, offer(1), 'gamble', vanilla)).toEqual({
      specialKeysAwarded: 1, keysOwedAdded: 1, pityKeysAwarded: 1, keysWithheld: 1,
      keys: 4, keysOwed: 0, fatePoints: 10,
    });
    // 49 + 3 × 15 = 94: one Pity Key settles one of the three owed.
    expect(petCompensationResult({ ...run, fatePoints: 49 }, offer(3), 'gamble', vanilla)).toMatchObject({
      pityKeysAwarded: 1, keysWithheld: 1, keys: 4, keysOwed: 2, fatePoints: 44,
    });
    // Without pity there is no line to reach.
    expect(petCompensationResult({ ...run, fatePoints: 45 }, offer(1), 'gamble', { ...vanilla, pityEnabled: false }))
      .toMatchObject({ pityKeysAwarded: 0, keysOwed: 1, fatePoints: 60 });
  });

  it('never passes the save format limit', () => {
    expect(petCompensationResult({ ...run, specialKeys: 99 }, offer(3), 'free', vanilla, 100))
      .toMatchObject({ specialKeysAwarded: 1 });
    expect(petCompensationResult({ ...run, keys: 100, keysOwed: 0, fatePoints: 45 }, offer(1), 'gamble', vanilla, 100))
      .toMatchObject({ pityKeysAwarded: 1, keysWithheld: 1, keys: 100 });
    expect(petCompensationResult({ ...run, keysOwed: 99 }, offer(3), 'owe', vanilla, 100))
      .toMatchObject({ keysOwed: 100 });
  });

  it('a pet roll that already brought an Omni-Key earns nothing more', () => {
    expect(petCompensationResult(run, offer(0, 2), 'owe', vanilla)).toMatchObject({
      specialKeysAwarded: 0, keysOwed: 0, fatePoints: 10,
    });
  });
});

describe('owed Keys', () => {
  it('take the Keys a transition earned, up to what is owed', () => {
    expect(keysToWithhold(2, 5, 6)).toBe(1);
    expect(keysToWithhold(1, 5, 7)).toBe(1);
    expect(keysToWithhold(3, 5, 7)).toBe(2);
    expect(keysToWithhold(0, 5, 7)).toBe(0);
    expect(keysToWithhold(undefined, 5, 7)).toBe(0);
    // Spending Keys earns none.
    expect(keysToWithhold(2, 5, 4)).toBe(0);
  });
});
