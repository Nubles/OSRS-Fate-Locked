/**
 * Every pet a run can claim, as the collection log's All Pets page lists them
 * (data/pets.test.ts keeps the two the same). Each new pet gives one Omni-Key,
 * once per pet, so a run records the ids of the pets it has claimed. The list
 * is kept apart from the collection log so the game state doesn't load it.
 */
export interface Pet {
  id: number;
  name: string;
}

export const PETS: readonly Pet[] = [
  { id: 502001, name: 'Abyssal orphan' },
  { id: 502002, name: 'Ikkle Hydra (serpentine)' },
  { id: 502003, name: 'Callisto cub' },
  { id: 502004, name: 'Hellpuppy' },
  { id: 502005, name: 'Pet chaos elemental' },
  { id: 502006, name: 'Pet Zilyana' },
  { id: 502007, name: 'Pet dark core' },
  { id: 502008, name: 'Pet Dagannoth Prime' },
  { id: 502009, name: 'Pet Dagannoth Supreme' },
  { id: 502010, name: 'Pet Dagannoth Rex' },
  { id: 502011, name: 'TzRek-Jad' },
  { id: 502012, name: 'Pet General Graardor' },
  { id: 502013, name: 'Baby Mole' },
  { id: 502014, name: 'Noon' },
  { id: 502015, name: 'Jal-Nib-Rek' },
  { id: 502016, name: 'Kalphite Princess' },
  { id: 502017, name: 'Prince Black Dragon' },
  { id: 502018, name: 'Pet Kraken' },
  { id: 502019, name: 'Pet Kree\'arra' },
  { id: 502020, name: 'Pet K\'ril Tsutsaroth' },
  { id: 502021, name: 'Scorpia\'s offspring' },
  { id: 502022, name: 'Skotos' },
  { id: 502023, name: 'Pet Smoke Devil' },
  { id: 502024, name: 'Venenatis spiderling' },
  { id: 502025, name: 'Vet\'ion Jr.' },
  { id: 502026, name: 'Vorki' },
  { id: 502027, name: 'Phoenix' },
  { id: 502028, name: 'Pet Snakeling' },
  { id: 502029, name: 'Olmlet' },
  { id: 502030, name: 'Lil\' Zik' },
  { id: 502031, name: 'Bloodhound' },
  { id: 502032, name: 'Pet Penance Queen' },
  { id: 502033, name: 'Heron' },
  { id: 502034, name: 'Rock golem' },
  { id: 502035, name: 'Beaver' },
  { id: 502036, name: 'Baby chinchompa (grey)' },
  { id: 502037, name: 'Giant Squirrel' },
  { id: 502038, name: 'Tangleroot' },
  { id: 502039, name: 'Rocky' },
  { id: 502040, name: 'Rift guardian (fire)' },
  { id: 502041, name: 'Herbi' },
  { id: 502042, name: 'Chompy chick' },
  { id: 502043, name: 'Sraracha' },
  { id: 502044, name: 'Smolcano' },
  { id: 502045, name: 'Youngllef' },
  { id: 502046, name: 'Little Nightmare' },
  { id: 502047, name: 'Lil\' Creator' },
  { id: 502048, name: 'Tiny tempor' },
  { id: 502049, name: 'Nexling' },
  { id: 502050, name: 'Abyssal protector' },
  { id: 502051, name: 'Tumeken\'s guardian' },
  { id: 502052, name: 'Muphin (ranged)' },
  { id: 502053, name: 'Wisp' },
  { id: 502054, name: 'Baron' },
  { id: 502055, name: 'Butch' },
  { id: 502056, name: 'Lil\'viathan' },
  { id: 502057, name: 'Scurry' },
  { id: 502058, name: 'Smol Heredit' },
  { id: 502059, name: 'Quetzin' },
  { id: 502060, name: 'Nid' },
  { id: 502061, name: 'Huberte' },
  { id: 502062, name: 'Moxi' },
  { id: 502063, name: 'Bran' },
  { id: 502064, name: 'Yami' },
  { id: 502065, name: 'Dom' },
  { id: 502066, name: 'Soup' },
  { id: 502067, name: 'Gull (pet)' },
  { id: 502068, name: 'Beef' },
  { id: 502069, name: 'Maggot marquess' },
  { id: 502070, name: 'Aggy' },
  { id: 502071, name: 'Mr McGroot' },
];

const BY_ID = new Map(PETS.map((pet) => [pet.id, pet]));

export const petById = (id: number): Pet | undefined => BY_ID.get(id);

/** The pets a run hasn't claimed yet, in the collection log's order. */
export const unclaimedPets = (claimed: readonly number[] | undefined): Pet[] => {
  const taken = new Set(claimed ?? []);
  return PETS.filter((pet) => !taken.has(pet.id));
};
