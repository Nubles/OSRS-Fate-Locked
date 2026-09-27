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
  /** Once this diary (or a harder tier of it) is done, the player can switch the option to go here instead. */
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

const item = (id: string, label: string, ids: readonly number[], unlocks: readonly string[],
  options: Readonly<Record<string, TravelOption>>, page: string, oldid: number): TravelMethod =>
  ({ id, label, unlocks, match: { items: ids }, options, source: wiki(page, oldid) });

/**
 * A teleport tablet, broken from the inventory. A standard tablet needs
 * Teleport Tablets; another spellbook's tablet needs that spellbook, as the
 * app's route data has it for the Arceuus ones.
 */
const tablet = (book: SpellBook, name: string, ids: readonly number[], to: readonly string[], oldid: number,
  extra: { page?: string; options?: Readonly<Record<string, TravelOption>>; afterDiary?: TravelOption['afterDiary'] } = {}) =>
  item(`tablet:${slug(name)}`, `${name} tablet`, ids, book === 'standard' ? ['Teleport Tablets'] : BOOK_UNLOCKS[book],
    { Break: { to, ...(extra.afterDiary ? { afterDiary: extra.afterDiary } : {}) }, ...extra.options },
    extra.page ?? `${name} (tablet)`, oldid);

/** A house tablet redirected to a house location: it lands outside that house's portal. */
const houseTablet = (name: string, id: number, to: readonly string[], oldid: number) =>
  item(`tablet:${slug(name)}`, `${name} tablet`, [id], ['Teleport Tablets'], { Break: { to } }, name, oldid);

/** A one-use teleport scroll. The app's route data asks no unlock for them. */
const scroll = (name: string, id: number, to: readonly string[], oldid: number, page = name) =>
  item(`scroll:${slug(name)}`, `${name} scroll`, [id], [], { Teleport: { to } }, page, oldid);

const TABLETS: readonly TravelMethod[] = [
  tablet('standard', 'Varrock teleport', [8007], ['50,53'], 15184222, {
    afterDiary: { diary: 'Varrock Medium', to: ['49,54'] },
    options: { Varrock: { to: ['50,53'] }, 'Grand Exchange': { to: ['49,54'] } },
  }),
  tablet('standard', 'Lumbridge teleport', [8008], ['50,50'], 15185081),
  tablet('standard', 'Falador teleport', [8009], ['46,52'], 15185079),
  tablet('standard', 'Camelot teleport', [8010], ['43,54'], 15185080, {
    afterDiary: { diary: 'Kandarin Hard', to: ['42,54'] },
    options: { Camelot: { to: ['43,54'] }, "Seers' Village": { to: ['42,54'] } },
  }),
  tablet('standard', 'Ardougne teleport', [8011], ['41,51'], 15183982),
  tablet('standard', 'Watchtower teleport', [8012], ['39,48'], 15185084, {
    afterDiary: { diary: 'Ardougne Hard', to: ['40,48'] },
    options: { Watchtower: { to: ['39,48'] }, Yanille: { to: ['40,48'] } },
  }),
  tablet('standard', 'Kourend castle teleport', [28790], ['25,57'], 15287395),
  tablet('standard', 'Civitas illa fortis teleport', [28824], ['26,48'], 15192363),

  houseTablet('Rimmington teleport', 11741, ['46,50'], 15309324),
  houseTablet('Taverley teleport', 11742, ['45,54'], 15309326),
  houseTablet('Pollnivneach teleport', 11743, ['52,46'], 15309321),
  houseTablet('Rellekka teleport', 11744, ['41,56'], 15309323),
  houseTablet('Brimhaven teleport', 11745, ['43,49'], 15309318),
  houseTablet('Yanille teleport', 11746, ['39,48'], 15342795),
  houseTablet('Trollheim teleport', 11747, ['45,57'], 15309327),
  houseTablet('Hosidius teleport', 19651, ['27,54'], 15309320),
  houseTablet('Prifddinas teleport', 23771, ['50,94'], 15309322),

  tablet('ancient', 'Paddewwa teleport', [12781], ['48,154'], 15186395),
  tablet('ancient', 'Senntisten teleport', [12782], ['51,52'], 15186394),
  tablet('ancient', 'Kharyrll teleport', [12779], ['54,54'], 15186392),
  tablet('ancient', 'Lassar teleport', [12780], ['46,54'], 15186393),
  tablet('ancient', 'Dareeyak teleport', [12777], ['46,57'], 15186390),
  tablet('ancient', 'Carrallanger teleport', [12776], ['49,57'], 15186389),
  tablet('ancient', 'Annakarl teleport', [12775], ['51,60'], 15186388),
  tablet('ancient', 'Ghorrock teleport', [12778], ['46,60'], 15186391),

  tablet('lunar', 'Moonclan teleport', [24949], ['32,61', '33,61'], 15189870),
  tablet('lunar', 'Ourania teleport', [24951], ['38,50'], 15189871),
  tablet('lunar', 'Waterbirth teleport', [24953], ['39,58'], 15189872),
  tablet('lunar', 'Barbarian teleport', [24955], ['39,55'], 15189873),
  tablet('lunar', 'Khazard teleport', [24957], ['41,49'], 15189874),
  tablet('lunar', 'Fishing guild teleport', [24959], ['40,52', '40,53'], 15189875),
  tablet('lunar', 'Catherby teleport', [24961], ['43,53'], 15189876),
  tablet('lunar', 'Ice plateau teleport', [24963], ['46,61'], 15189877),

  tablet('arceuus', 'Arceuus library teleport', [19613], ['25,59', '25,60'], 15231347),
  tablet('arceuus', 'Draynor manor teleport', [19615], ['48,52'], 15187517),
  tablet('arceuus', 'Mind altar teleport', [19617], ['46,54'], 15187518),
  tablet('arceuus', 'Salve graveyard teleport', [19619], ['53,54'], 15187519),
  tablet('arceuus', "Fenkenstrain's castle teleport", [19621], ['55,55'], 15187520),
  tablet('arceuus', 'West ardougne teleport', [19623], ['39,51'], 15187521),
  tablet('arceuus', 'Harmony island teleport', [19625], ['59,44'], 15187522),
  tablet('arceuus', 'Cemetery teleport', [19627], ['46,58'], 15187523),
  tablet('arceuus', 'Barrows teleport', [19629], ['55,51'], 15187524),
  tablet('arceuus', 'Ape atoll teleport', [19631], ['43,142'], 15187525),
  tablet('arceuus', 'Battlefront teleport', [22949], ['21,58'], 15189104),
];

// The Guthixian temple scroll lands at 4062,4556, in a region no area or
// interior covers, so it is left out; so is the Revenant cave scroll, which
// offers three entrances.
const SCROLLS: readonly TravelMethod[] = [
  scroll('Nardah teleport', 12402, ['53,45'], 15186014),
  scroll('Digsite teleport', 12403, ['51,53'], 15186009),
  scroll('Feldip hills teleport', 12404, ['39,45'], 15186010),
  scroll('Lunar isle teleport', 12405, ['32,61'], 15186011),
  scroll("Mort'ton teleport", 12406, ['54,51'], 15186012),
  scroll('Pest control teleport', 12407, ['41,41'], 15186015),
  scroll('Piscatoris teleport', 12408, ['36,57'], 15186016),
  scroll('Tai bwo wannai teleport', 12409, ['43,47'], 15186007),
  scroll('Iorwerth camp teleport', 12410, ['34,50'], 15186008),
  scroll("Mos le'harmless teleport", 12411, ['57,46'], 15186013),
  scroll('Lumberyard teleport', 12642, ['51,54'], 15186290),
  scroll('Zul-andra teleport', 12938, ['34,47'], 15186555),
  scroll('Key master teleport', 13249, ['20,19'], 15259810),
  scroll('Watson teleport', 23387, ['25,55'], 15257420),
  scroll('Spider cave teleport', 29782, ['57,53'], 15192620),
  scroll('Colossal wyrm teleport', 30040, ['25,45'], 15192735, 'Colossal wyrm teleport scroll'),
  scroll('Chasm teleport', 30775, ['22,157'], 15350393, 'Chasm teleport scroll'),
  scroll('Ardeaglais teleport', 34033, ['39,34'], 15291623),
];

export const TRAVEL_METHODS: readonly TravelMethod[] = [...SPELLS, ...TABLETS, ...SCROLLS];
