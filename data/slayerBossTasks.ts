/**
 * Boss tasks (the Like a Boss reward): the bosses each master can assign, as
 * BOSSES_LIST names, and the Slayer level a boss asks for. Read from
 * data/sources/slayer-corrections.json `bossTasks` the way
 * scripts/chunk-content-transform.mjs reads it (a boss's substitutes count,
 * bar Konar's and Krystilia's crazy archaeologist); utils/farmGates.test.ts pins the two
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

/**
 * The Boss Slayer table's other requirements (wiki "Boss Slayer" oldid
 * 15405674): quests, levels, and levels any one of which is enough. A master
 * assigns the boss only once they are met. Keyed like BOSS_TASK_BOSSES.
 */
export interface BossTaskRequirement { quests?: readonly string[]; skills?: Readonly<Record<string, number>>; anySkill?: Readonly<Record<string, number>> }
const GOD_WARS_ENTRY = { Strength: 60, Agility: 60 };
const PRIEST_IN_PERIL: BossTaskRequirement = { quests: ['Priest in Peril'] };
const DESERT_TREASURE_II: BossTaskRequirement = { quests: ['Desert Treasure II'] };
export const BOSS_TASK_REQUIREMENTS: Readonly<Record<string, BossTaskRequirement>> = {
  Araxxor: PRIEST_IN_PERIL,
  'Barrows Brothers': PRIEST_IN_PERIL,
  'Commander Zilyana': { quests: ['Death Plateau'], skills: { Agility: 70 } },
  'Duke Sucellus': DESERT_TREASURE_II,
  'General Graardor': { quests: ['Death Plateau'], skills: { Strength: 70 } },
  'Grotesque Guardians': PRIEST_IN_PERIL,
  "K'ril Tsutsaroth": { quests: ['Death Plateau'], skills: { Hitpoints: 70 }, anySkill: GOD_WARS_ENTRY },
  'King Black Dragon': { quests: ['Dragon Slayer I'] },
  "Kree'arra": { quests: ['Death Plateau'], skills: { Ranged: 70 }, anySkill: GOD_WARS_ENTRY },
  'The Leviathan': DESERT_TREASURE_II,
  'Maggot King': { quests: ['The Blood Moon Rises'] },
  'Phantom Muspah': { quests: ['Secrets of the North'] },
  'Shellbane Gryphon': { quests: ['Troubled Tortugans'] },
  Vardorvis: DESERT_TREASURE_II,
  Vorkath: { quests: ['Dragon Slayer II'] },
  'The Whisperer': DESERT_TREASURE_II,
  Zulrah: { quests: ['Regicide'] },
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
  // Her tasks count only in the Wilderness, so the Fossil Island archaeologist does not stand in.
  Krystilia: WILDERNESS.filter(boss => boss !== 'Deranged Archaeologist'),
};
