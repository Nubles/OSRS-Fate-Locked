import { ritualFateCost } from '../config/economy';
import type { GameModeRules } from '../config/gameModes';
import { petById } from '../data/pets';
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

/**
 * Pets the player named for the offer: one per earlier pet roll, each a known
 * pet, none twice and none already claimed.
 */
export const validCompensationPets = (
  offer: PetCompensationState,
  petIds: readonly number[],
  claimed: readonly number[] | undefined,
): boolean => {
  const taken = new Set(claimed ?? []);
  return petIds.length === offer.keyOnlyPets + offer.omniPets
    && new Set(petIds).size === petIds.length
    && petIds.every((id) => petById(id) !== undefined && !taken.has(id));
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
 * What a choice does to the run. Every pet roll that paid only a Key earns an
 * Omni-Key. 'owe' and 'gamble' give up one future Standard Key for each, and
 * 'gamble' adds a Gambit stake of Fate for each: Fate that reaches the pity
 * threshold pays its Pity Key and carries the rest, as a failed roll's does,
 * and any Key it pays settles what the run owes first. No counter passes
 * maxCounter, the save format's limit.
 */
export const petCompensationResult = (
  state: Pick<GameState, 'keys' | 'specialKeys' | 'keysOwed' | 'fatePoints'>,
  offer: PetCompensationState,
  choice: PetCompensationChoice,
  rules: Pick<GameModeRules, 'ritualCostMultiplier' | 'pityEnabled' | 'pityThreshold'>,
  maxCounter = Number.MAX_SAFE_INTEGER,
): PetCompensationResult => {
  const pets = offer.keyOnlyPets;
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
