/**
 * Where each pet comes from, and its group, as the OSRS Wiki's Pet page lists them
 * (https://oldschool.runescape.wiki/w/Pet, read 4 October 2026). The pet picker groups pets by
 * it, and searching for a boss, skill or activity finds its pet. data/petSources.test.ts keeps it
 * in step with data/pets.ts.
 */
import type { Pet } from './pets';

export type PetGroup = 'Boss' | 'Skilling' | 'Other';

export const PET_GROUPS: readonly { group: PetGroup; label: string }[] = [
  { group: 'Boss', label: 'Boss pets' },
  { group: 'Skilling', label: 'Skilling pets' },
  { group: 'Other', label: 'Other pets' },
];

export interface PetSource {
  /** The boss, skill or activity it comes from, in the wiki's words. */
  source: string;
  group: PetGroup;
  /** Short names players search by, such as "cox" or "kq". */
  aliases?: readonly string[];
}

const boss = (source: string, aliases?: readonly string[]): PetSource => ({ source, group: 'Boss', ...(aliases ? { aliases } : {}) });
const skill = (source: string, aliases?: readonly string[]): PetSource => ({ source, group: 'Skilling', ...(aliases ? { aliases } : {}) });
const other = (source: string, aliases?: readonly string[]): PetSource => ({ source, group: 'Other', ...(aliases ? { aliases } : {}) });

export const PET_SOURCES: Readonly<Record<number, PetSource>> = {
  502001: boss('Abyssal Sire'),
  502002: boss('Alchemical Hydra'),
  502003: boss('Callisto and Artio'),
  502004: boss('Cerberus'),
  502005: boss('Chaos Elemental and Chaos Fanatic'),
  502006: boss('Commander Zilyana', ['gwd', 'sara', 'saradomin']),
  502007: boss('Corporeal Beast', ['corp']),
  502008: boss('Dagannoth Prime', ['dks', 'dagannoth kings']),
  502009: boss('Dagannoth Supreme', ['dks', 'dagannoth kings']),
  502010: boss('Dagannoth Rex', ['dks', 'dagannoth kings']),
  502011: boss('TzHaar Fight Cave', ['jad', 'fight caves']),
  502012: boss('General Graardor', ['gwd', 'bandos']),
  502013: boss('Giant Mole'),
  502014: boss('Grotesque Guardians', ['gargoyles']),
  502015: boss('Inferno', ['zuk']),
  502016: boss('Kalphite Queen', ['kq']),
  502017: boss('King Black Dragon', ['kbd']),
  502018: boss('Kraken'),
  502019: boss("Kree'arra", ['gwd', 'arma', 'armadyl']),
  502020: boss("K'ril Tsutsaroth", ['gwd', 'zammy', 'zamorak']),
  502021: boss('Scorpia'),
  502022: boss('Skotizo'),
  502023: boss('Thermonuclear smoke devil', ['thermy']),
  502024: boss('Venenatis and Spindel'),
  502025: boss("Vet'ion and Calvar'ion"),
  502026: boss('Vorkath'),
  502027: boss('Wintertodt', ['wt']),
  502028: boss('Zulrah'),
  502029: boss('Chambers of Xeric', ['cox', 'raids']),
  502030: boss('Theatre of Blood', ['tob', 'raids']),
  502031: other('Master clue scrolls'),
  502032: other('Barbarian Assault'),
  502033: skill('Fishing'),
  502034: skill('Mining'),
  502035: skill('Woodcutting'),
  502036: skill('Hunter (chinchompas only)', ['chins']),
  502037: skill('Agility'),
  502038: skill('Farming'),
  502039: skill('Thieving'),
  502040: skill('Runecraft'),
  502041: other('Hunting herbiboars'),
  502042: other('Hunting chompy birds'),
  502043: boss('Sarachnis'),
  502044: boss('Zalcano'),
  502045: boss('The Gauntlet', ['cg', 'corrupted gauntlet']),
  502046: boss("The Nightmare and Phosani's Nightmare"),
  502047: other('Soul Wars'),
  502048: boss('Tempoross'),
  502049: boss('Nex', ['gwd']),
  502050: other('Guardians of the Rift', ['gotr']),
  502051: boss('Tombs of Amascut', ['toa', 'raids']),
  502052: boss('Phantom Muspah'),
  502053: boss('The Whisperer'),
  502054: boss('Duke Sucellus'),
  502055: boss('Vardorvis'),
  502056: boss('The Leviathan'),
  502057: boss('Scurrius'),
  502058: boss('Sol Heredit', ['colosseum']),
  502059: other("Hunter's guild rumours"),
  502060: boss('Araxxor'),
  502061: boss('The Hueycoatl'),
  502062: boss('Amoxliatl'),
  502063: boss('Royal Titans'),
  502064: boss('Yama'),
  502065: boss('Doom of Mokhaiotl'),
  502066: skill('Sailing'),
  502067: boss('Shellbane Gryphon'),
  502068: boss('Brutus'),
  502069: boss('Maggot King'),
  502070: boss('Mad Angel'),
  502071: other('Hunting Wyrmscraig Goats'),
};

/** The pet's picture on the OSRS Wiki, by its name (every pet's is there; petSources.test.ts lists them). */
export const petImageFile = (pet: Pet): string => `${pet.name.replace(/ /g, '_')}.png`;

/** Lower case, without apostrophes or other punctuation, so "kril" finds K'ril. */
const fold = (text: string): string => text.toLowerCase().replace(/['’.()-]/g, '').replace(/\s+/g, ' ').trim();

/** Whether the pet matches what the player typed: every word in its name, source or a short name. */
export const petMatches = (pet: Pet, query: string): boolean => {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const source = PET_SOURCES[pet.id];
  const haystack = fold([pet.name, source?.source ?? '', ...(source?.aliases ?? [])].join(' '));
  return words.every((word) => haystack.includes(word));
};
