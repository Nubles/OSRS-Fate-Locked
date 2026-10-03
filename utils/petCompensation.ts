import { ritualFateCost } from '../config/economy';
import type { GameModeRules } from '../config/gameModes';
import { isPetId } from '../data/petIds';
import {
  DropSource,
  type GameState,
  type LogEntry,
  type PetCompensationChoice,
  type PetCompensationState,
} from '../types';

/** The What's New release that made each new pet an Omni-Key; its offer is frozen under this id. */
export const PET_COMPENSATION_ID = '2026-10-03-pet-omni-keys';

export const notEligiblePetCompensation = (): PetCompensationState => ({
  releaseId: PET_COMPENSATION_ID,
  status: 'not_eligible',
  keyOnlyPets: 0,
  omniPets: 0,
});

/**
 * The pet rolls a run made before a pet gave an Omni-Key. Each paid a Standard
 * Key, and some brought the old 25% Omni-Key too.
 */
export const earlierPetRolls = (history: readonly LogEntry[]): { keyOnlyPets: number; omniPets: number } => {
  let keyOnlyPets = 0;
  let omniPets = 0;
  for (const entry of history) {
    if (entry.source !== DropSource.PET) continue;
    if (entry.type === 'ROLL_SUCCESS') keyOnlyPets += 1;
    else if (entry.type === 'ROLL_OMNI') omniPets += 1;
  }
  return { keyOnlyPets, omniPets };
};

/** Freeze the one-time offer for a save from before pets gave an Omni-Key. */
export const petCompensationOffer = (history: readonly LogEntry[]): PetCompensationState => {
  const { keyOnlyPets, omniPets } = earlierPetRolls(history);
  return keyOnlyPets + omniPets > 0
    ? { releaseId: PET_COMPENSATION_ID, status: 'pending', keyOnlyPets, omniPets }
    : notEligiblePetCompensation();
};

/** The Fate a 'gamble' choice gives for each Key it gives up: the mode's Void Gambit minimum stake. */
export const gambitStakeFor = (rules: Pick<GameModeRules, 'ritualCostMultiplier'>): number =>
  ritualFateCost('GAMBIT', rules.ritualCostMultiplier);

/** When each earlier pet roll was made, oldest first, so the offer can say which is which. */
export const earlierPetRollTimes = (history: readonly LogEntry[]): { keyOnly: number[]; omni: number[] } => {
  const keyOnly: number[] = [];
  const omni: number[] = [];
  for (const entry of history) {
    if (entry.source !== DropSource.PET) continue;
    if (entry.type === 'ROLL_SUCCESS') keyOnly.push(entry.timestamp);
    else if (entry.type === 'ROLL_OMNI') omni.push(entry.timestamp);
  }
  return { keyOnly, omni };
};

/**
 * What the player said each earlier pet roll was: a pet, or null for one that
 * was not a new pet (a duplicate, a mistake, or one they can't remember). A
 * pet must be known, named once and not already claimed. Null is always
 * allowed, so the offer can always be settled and never traps What's New.
 */
export const validCompensationPets = (
  offer: PetCompensationState,
  keyOnly: ReadonlyArray<number | null>,
  omni: ReadonlyArray<number | null>,
  claimed: readonly number[] | undefined,
): boolean => {
  const taken = new Set(claimed ?? []);
  const named = [...keyOnly, ...omni].filter((id): id is number => id !== null);
  return keyOnly.length === offer.keyOnlyPets
    && omni.length === offer.omniPets
    && new Set(named).size === named.length
    && named.every((id) => isPetId(id) && !taken.has(id));
};

export interface PetCompensationResult {
  specialKeysAwarded: number;
  keysOwedAdded: number;
  pityKeysAwarded: number;
  keysWithheld: number;
  keys: number;
  keysOwed: number;
  fatePoints: number;
}

/**
 * What a choice does to the run, for the pet rolls that paid only a Key and
 * were named as a pet (earned): each earns an Omni-Key. 'owe' and 'gamble' give
 * up one future Standard Key for each, and
 * 'gamble' adds a Gambit stake of Fate for each: Fate that reaches the pity
 * threshold pays its Pity Key and carries the rest, as a failed roll's does,
 * and any Key it pays settles what the run owes first. No counter passes
 * maxCounter, the save format's limit.
 */
export const petCompensationResult = (
  state: Pick<GameState, 'keys' | 'specialKeys' | 'keysOwed' | 'fatePoints'>,
  earned: number,
  choice: PetCompensationChoice,
  rules: Pick<GameModeRules, 'ritualCostMultiplier' | 'pityEnabled' | 'pityThreshold'>,
  maxCounter = Number.MAX_SAFE_INTEGER,
): PetCompensationResult => {
  const pets = earned;
  const specialKeysAwarded = Math.min(pets, Math.max(0, maxCounter - state.specialKeys));
  const keysOwedAdded = choice === 'free' ? 0 : pets;
  const grant = choice === 'gamble' ? gambitStakeFor(rules) * pets : 0;
  const fateTotal = state.fatePoints + grant;
  const pity = grant > 0 && rules.pityEnabled && rules.pityThreshold > 0
    ? Math.floor(fateTotal / rules.pityThreshold)
    : 0;
  const fatePoints = Math.min(maxCounter, fateTotal - pity * rules.pityThreshold);
  const owed = Math.min(maxCounter, (state.keysOwed ?? 0) + keysOwedAdded);
  const keysWithheld = Math.min(owed, pity);
  // A Pity Key past the counter limit is dropped, as the Weighted Fate offer drops one.
  const pityKeysAwarded = Math.min(pity, keysWithheld + Math.max(0, maxCounter - state.keys));
  return {
    specialKeysAwarded,
    keysOwedAdded,
    pityKeysAwarded,
    keysWithheld,
    keys: state.keys + pityKeysAwarded - keysWithheld,
    keysOwed: owed - keysWithheld,
    fatePoints,
  };
};

/** Keys a transition earned that go to what the run owes, and what it then still owes. */
export const keysToWithhold = (keysOwed: number | undefined, keysBefore: number, keysAfter: number): number =>
  Math.max(0, Math.min(keysOwed ?? 0, keysAfter - keysBefore));
