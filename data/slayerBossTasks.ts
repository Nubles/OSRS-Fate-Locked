/**
 * Boss tasks (the Like a Boss reward): the bosses each master can assign, as
 * BOSSES_LIST names, and the Slayer level a boss asks for. Read from
 * data/sources/slayer-corrections.json `bossTasks` the way
 * scripts/chunk-content-transform.mjs reads it (a boss's substitutes count,
 * bar Konar's crazy archaeologist); utils/farmGates.test.ts pins the two
 * together, so this stays a small table in the app instead of the whole file.
 */
export const BOSS_TASK_UNLOCK = 'Like a Boss';

/** The Slayer level a boss task boss needs; the rest need none. */
export const BOSS_TASK_SLAYER_LEVELS: Readonly<Record<string, number>> = {
  'Abyssal Sire': 85,
  'Alchemical Hydra': 95,
  Araxxor: 92,
  Cerberus: 91,
  'Grotesque Guardians': 75,
  Kraken: 87,
  'Maggot King': 74,
  'Shellbane Gryphon': 51,
  'Thermonuclear Smoke Devil': 93,
  Vorkath: 18,
};

const WILDERNESS = [
  'Callisto', 'Artio', 'Chaos Elemental', 'Chaos Fanatic', 'Crazy Archaeologist', 'Deranged Archaeologist',
  'Scorpia', 'Venenatis', 'Spindel', "Vet'ion", "Calvar'ion",
];

const ALL = [
  ...WILDERNESS, 'Abyssal Sire', 'Alchemical Hydra', 'Araxxor', 'Barrows Brothers', 'Cerberus',
  'Commander Zilyana', 'Dagannoth Kings', 'Duke Sucellus', 'General Graardor', 'Giant Mole',
  'Grotesque Guardians', "K'ril Tsutsaroth", 'Kalphite Queen', 'King Black Dragon', 'Kraken', "Kree'arra",
  'The Leviathan', 'Maggot King', 'Phantom Muspah', 'Sarachnis', 'Shellbane Gryphon',
  'Thermonuclear Smoke Devil', 'Vardorvis', 'Vorkath', 'The Whisperer', 'Zulrah',
];

/** Each master who gives boss tasks, by SLAYER_MASTER_REQUIREMENTS name, and the bosses they assign. */
export const BOSS_TASK_BOSSES: Readonly<Record<string, readonly string[]>> = {
  'Konar quo Maten': ALL.filter(boss => boss !== 'Deranged Archaeologist'),
  Nieve: ALL.filter(boss => boss !== 'Alchemical Hydra'),
  Duradel: ALL.filter(boss => boss !== 'Alchemical Hydra'),
  Krystilia: WILDERNESS,
};
