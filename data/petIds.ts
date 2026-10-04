/**
 * The id of every pet a run can claim, as data/pets.ts lists them with their
 * names (data/pets.test.ts keeps the two the same). The game state and the
 * save format need only the ids, so the names load with the screens.
 */
export const PET_IDS: readonly number[] = [
  502001, 502002, 502003, 502004, 502005, 502006, 502007, 502008,
  502009, 502010, 502011, 502012, 502013, 502014, 502015, 502016,
  502017, 502018, 502019, 502020, 502021, 502022, 502023, 502024,
  502025, 502026, 502027, 502028, 502029, 502030, 502031, 502032,
  502033, 502034, 502035, 502036, 502037, 502038, 502039, 502040,
  502041, 502042, 502043, 502044, 502045, 502046, 502047, 502048,
  502049, 502050, 502051, 502052, 502053, 502054, 502055, 502056,
  502057, 502058, 502059, 502060, 502061, 502062, 502063, 502064,
  502065, 502066, 502067, 502068, 502069, 502070, 502071,
];

const KNOWN = new Set(PET_IDS);

export const isPetId = (id: number): boolean => KNOWN.has(id);
