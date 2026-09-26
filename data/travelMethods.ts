/**
 * Travel methods that RuneLite can recognise by id: spells by spellbook and
 * name, and items, objects and NPCs by their ids. Each lists its menu
 * options and where they go, so the app can decide each option for a run
 * (utils/travelDecisions.ts) and the plugin only looks the decision up.
 *
 * Reviewed by hand. Every row cites its source; destinations are chunk keys
 * of land, ocean or interiors ("cx,cy").
 */

export type SpellBook = 'standard' | 'ancient' | 'lunar' | 'arceuus';

/** How the plugin recognises a method: exactly one of these. */
export type TravelMatch =
  | { spell: { book: SpellBook; name: string } }
  | { items: readonly number[] }
  | { objects: readonly number[] }
  | { npcs: readonly number[] };

export interface TravelOption {
  /** Where the option can take the player; one chunk means the destination is certain. */
  to: readonly string[];
  /** Once this diary is done, the player can switch the option to go here instead. */
  afterDiary?: { diary: string; to: readonly string[] };
}

export interface TravelMethod {
  /** Stable id, such as "spell:lumbridge-teleport". */
  id: string;
  label: string;
  /** Unlock ids from MOBILITY_LIST, ARCANA_LIST or POH_LIST; all of them are needed. */
  unlocks: readonly string[];
  match: TravelMatch;
  /** Keyed by the menu option's exact text. */
  options: Readonly<Record<string, TravelOption>>;
  /** Tag-only: never blocked, whatever the decision. */
  advisory?: boolean;
  /** Fairy ring codes and where they go. */
  codes?: Readonly<Record<string, TravelOption>>;
  source: string;
}

/** Menu options that are never travel; a travel row must not name one. */
export const NON_TRAVEL_OPTIONS: readonly string[] = [
  'Walk here', 'Attack', 'Talk-to', 'Trade', 'Bank', 'Collect', 'Deposit', 'Wear', 'Wield', 'Equip', 'Remove',
  'Use', 'Drop', 'Examine', 'Check', 'Configure', 'Inspect', 'Pickpocket', 'Follow', 'Cancel',
];

const wiki = (page: string, oldid: number) =>
  `https://oldschool.runescape.wiki/w/${encodeURIComponent(page.replace(/ /g, '_'))}?oldid=${oldid}`;

const BOOK_UNLOCKS: Readonly<Record<SpellBook, readonly string[]>> = {
  standard: [],
  ancient: ['Ancient Magicks'],
  lunar: ['Lunar Spellbook'],
  arceuus: ['Arceuus Spellbook'],
};

const slug = (name: string) => name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * A teleport spell, cast from its spellbook. Destinations are the chunks of
 * the landing square the wiki marks; a square across a chunk border gives
 * two, and the decision stays UNKNOWN.
 */
const spell = (book: SpellBook, name: string, to: readonly string[], oldid: number,
  options: { page?: string; afterDiary?: TravelOption['afterDiary'] } = {}): TravelMethod => ({
  id: `spell:${book}:${slug(name)}`,
  label: name,
  unlocks: BOOK_UNLOCKS[book],
  match: { spell: { book, name } },
  options: { Cast: { to, ...(options.afterDiary ? { afterDiary: options.afterDiary } : {}) } },
  source: wiki(options.page ?? name, oldid),
});

/** Every teleport spell with a fixed destination (not the house, the boat or a respawn point). */
const SPELLS: readonly TravelMethod[] = [
  spell('standard', 'Lumbridge Teleport', ['50,50'], 14918404),
  spell('standard', 'Varrock Teleport', ['50,53'], 14918406, { afterDiary: { diary: 'Varrock Medium', to: ['49,54'] } }),
  spell('standard', 'Falador Teleport', ['46,52'], 14918402),
  spell('standard', 'Camelot Teleport', ['43,54'], 14918400, { afterDiary: { diary: 'Kandarin Hard', to: ['42,54'] } }),
  spell('standard', 'Ardougne Teleport', ['41,51'], 14918399),
  spell('standard', 'Watchtower Teleport', ['39,48'], 14863767, { afterDiary: { diary: 'Ardougne Hard', to: ['40,48'] } }),
  spell('standard', 'Trollheim Teleport', ['45,57'], 15134848),
  spell('standard', 'Ape Atoll Teleport', ['43,43'], 14906055, { page: 'Ape Atoll Teleport (standard)' }),
  spell('standard', 'Kourend Castle Teleport', ['25,57'], 15311656),
  spell('standard', 'Civitas illa Fortis Teleport', ['26,48', '26,49'], 15019227),

  spell('ancient', 'Paddewwa Teleport', ['48,154'], 15331334),
  // The wiki's landing square (3320,3337) is west of the Exam Centre's chunk.
  spell('ancient', 'Senntisten Teleport', ['51,52'], 15331335),
  spell('ancient', 'Kharyrll Teleport', ['54,54'], 15356290),
  spell('ancient', 'Lassar Teleport', ['46,54'], 15354949),
  spell('ancient', 'Dareeyak Teleport', ['46,57'], 15331341),
  spell('ancient', 'Carrallanger Teleport', ['49,57'], 15331347),
  spell('ancient', 'Annakarl Teleport', ['51,60'], 15331346),
  spell('ancient', 'Ghorrock Teleport', ['46,60'], 15329225),

  spell('lunar', 'Moonclan Teleport', ['32,61', '33,61'], 14863798),
  spell('lunar', 'Ourania Teleport', ['38,50'], 15345906),
  spell('lunar', 'Waterbirth Teleport', ['39,58'], 15015720),
  spell('lunar', 'Barbarian Teleport', ['39,55'], 15134840),
  spell('lunar', 'Khazard Teleport', ['41,49'], 15134854),
  spell('lunar', 'Fishing Guild Teleport', ['40,52', '40,53'], 14863806),
  spell('lunar', 'Catherby Teleport', ['43,53'], 14863808),
  spell('lunar', 'Ice Plateau Teleport', ['46,61'], 15134857),
  spell('lunar', 'Tele Group Moonclan', ['32,61', '33,61'], 14863799),
  spell('lunar', 'Tele Group Waterbirth', ['39,58'], 14863801),
  spell('lunar', 'Tele Group Barbarian', ['39,55'], 14863803),
  spell('lunar', 'Tele Group Khazard', ['41,49'], 14863805),
  spell('lunar', 'Tele Group Fishing Guild', ['40,52', '40,53'], 14863807),
  spell('lunar', 'Tele Group Catherby', ['43,53'], 14863809),
  spell('lunar', 'Tele Group Ice Plateau', ['46,61'], 14863811),

  spell('arceuus', 'Arceuus Library Teleport', ['25,59'], 15343814),
  spell('arceuus', 'Draynor Manor Teleport', ['48,52'], 14863776),
  spell('arceuus', 'Battlefront Teleport', ['21,58'], 15252748),
  spell('arceuus', 'Mind Altar Teleport', ['46,54'], 15081091),
  spell('arceuus', 'Salve Graveyard Teleport', ['53,54'], 14863780),
  spell('arceuus', "Fenkenstrain's Castle Teleport", ['55,55'], 14863781),
  spell('arceuus', 'West Ardougne Teleport', ['39,51'], 14961024),
  spell('arceuus', 'Harmony Island Teleport', ['59,44'], 14863783),
  spell('arceuus', 'Cemetery Teleport', ['46,58'], 15266150),
  spell('arceuus', 'Barrows Teleport', ['55,51'], 15151762),
  // The same name as the standard spell; the spellbook tells them apart. It
  // lands inside the Ape Atoll Dungeon (2771,9102, from the tablet's page): the
  // spell page draws that tile on the surface map, 6400 tiles north.
  spell('arceuus', 'Ape Atoll Teleport', ['43,142'], 14863786, { page: 'Ape Atoll Teleport (Arceuus)' }),
];

export const TRAVEL_METHODS: readonly TravelMethod[] = [...SPELLS];
