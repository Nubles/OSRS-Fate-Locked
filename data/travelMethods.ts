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

/**
 * Options for an item whose worn menu names each place, while its other
 * options (such as Rub) open a choice of all of them. A place the app has no
 * chunk for goes nowhere known, so its option stays UNKNOWN, and so does a
 * choice that would be left with a single known chunk.
 */
export const choice = (places: Readonly<Record<string, readonly string[]>>, ...choose: string[]) => {
  const known = [...new Set(Object.values(places).flat())];
  const all = known.length === 1 && Object.values(places).some((to) => to.length === 0) ? [] : known;
  return {
    ...Object.fromEntries(choose.map((option) => [option, { to: all }])),
    ...Object.fromEntries(Object.entries(places).map(([option, to]) => [option, { to }])),
  };
};

/**
 * Teleport jewellery and the other teleport items with their own unlock.
 * Only charged ids: an uncharged item can't teleport. Where a variant (such
 * as the eternal or imbued one) shares the menu, it shares the row, and its
 * page is cited beside it. Wearable ids are in the pinned equipment catalogue.
 */
const SLAYER_RING = ['37,53', '38,53', '53,55', '43,156', '49,71', '31,72'];

const JEWELLERY: readonly TravelMethod[] = [
  // Amulet of glory (t), oldid 15352301; Amulet of eternal glory, oldid 15345507.
  item('item:amulet-of-glory', 'Amulet of glory',
    [1706, 1708, 1710, 1712, 11976, 11978, 10360, 10358, 10356, 10354, 11966, 11964, 19707], ['Jewelry Teleports'],
    choice({ Edgeville: ['48,54'], Karamja: ['45,49'], 'Draynor Village': ['48,50'], 'Al Kharid': ['51,49'] }, 'Rub'),
    'Amulet of glory', 15356028),
  item('item:ring-of-dueling', 'Ring of dueling', [2566, 2564, 2562, 2560, 2558, 2556, 2554, 2552], ['Jewelry Teleports'],
    choice({
      "Emir's Arena": ['51,50'], 'Castle Wars': ['38,48'], 'Ferox Enclave': ['49,56'],
      // The landing square crosses into 28,48.
      'Fortis Colosseum': ['27,48', '28,48'],
    }, 'Rub'),
    'Ring of dueling', 15322346),
  item('item:games-necklace', 'Games necklace', [3867, 3865, 3863, 3861, 3859, 3857, 3855, 3853], ['Jewelry Teleports'],
    choice({
      Burthorpe: ['45,55'], 'Barbarian Outpost': ['39,55'], 'Corporeal Beast': ['46,66'],
      'Tears of Guthix': ['50,148'], 'Wintertodt Camp': ['25,61'],
    }, 'Rub'),
    'Games necklace', 15351957),
  item('item:combat-bracelet', 'Combat bracelet', [11124, 11122, 11120, 11118, 11974, 11972], ['Jewelry Teleports'],
    choice({ "Warriors' Guild": ['45,55'], "Champions' Guild": ['49,52'], Monastery: ['47,54'], 'Ranging Guild': ['41,53'] }, 'Rub'),
    'Combat bracelet', 15320281),
  item('item:skills-necklace', 'Skills necklace', [11111, 11109, 11107, 11105, 11970, 11968], ['Jewelry Teleports'],
    choice({
      'Fishing Guild': ['40,52'], 'Mining Guild': ['47,152'], 'Crafting Guild': ['45,51'],
      'Cooking Guild': ['49,53'], 'Woodcutting Guild': ['25,54'], 'Farming Guild': ['19,58'],
    }, 'Rub'),
    'Skills necklace', 15340883),
  // Ring of wealth (i), oldid 15341258.
  item('item:ring-of-wealth', 'Ring of wealth',
    [11988, 11986, 11984, 11982, 11980, 20790, 20789, 20788, 20787, 20786], ['Jewelry Teleports'],
    choice({ Miscellania: ['39,60'], 'Grand Exchange': ['49,54'], Falador: ['46,52'], Dondakan: ['44,158'] }, 'Rub'),
    'Ring of wealth', 15341259),
  // The Eyrie is a jewellery teleport, not Eagle Transport.
  item('item:necklace-of-passage', 'Necklace of passage', [21155, 21153, 21151, 21149, 21146], ['Jewelry Teleports'],
    choice({ "Wizards' Tower": ['48,49'], 'The Outpost': ['37,52'], "Eagles' Eyrie": ['53,49'], Wyrmscraig: ['40,34'] }, 'Rub'),
    'Necklace of passage', 15309251),
  item('item:burning-amulet', 'Burning amulet', [21175, 21173, 21171, 21169, 21166], ['Jewelry Teleports'],
    choice({ 'Chaos Temple': ['50,56'], 'Bandit Camp': ['47,57'], 'Lava Maze': ['47,60'] }, 'Rub'),
    'Burning amulet', 15188167),

  item('item:digsite-pendant', 'Digsite pendant', [11190, 11191, 11192, 11193, 11194], ['Digsite Pendant'],
    choice({ Digsite: ['52,53'], 'Fossil Island': ['58,60'], 'Lithkren Dungeon': ['55,163'] }, 'Rub'),
    'Digsite pendant', 15302156),
  // Slayer ring (eternal), oldid 15322601. Rubbed, or teleporting worn or not,
  // it opens a choice: the Stronghold Slayer Cave (its landing square crosses
  // into 38,53), the Slayer Tower, the Fremennik Slayer Dungeon, Tarn's Lair,
  // the Dark Beasts and the Wyrmscraig Cavern (40,134, which the app has no
  // chunk for yet).
  item('item:slayer-ring', 'Slayer ring', [11873, 11872, 11871, 11870, 11869, 11868, 11867, 11866, 21268], ['Slayer Ring'],
    { Rub: { to: SLAYER_RING }, Teleport: { to: SLAYER_RING } },
    'Slayer ring', 15286008),
  item('item:xerics-talisman', "Xeric's talisman", [13393], ["Xeric's Talisman"],
    choice({
      "Xeric's Lookout": ['24,55'], "Xeric's Glade": ['27,55'], "Xeric's Inferno": ['23,59'],
      "Xeric's Heart": ['25,57'], "Xeric's Honour": ['19,55'],
    }, 'Rub'),
    "Xeric's talisman", 15343014),
  // Slepe (59,151) and Castle Drakan (49,120) have no chunk in the app yet.
  item('item:drakans-medallion', "Drakan's medallion", [22400], ["Drakan's Medallion"],
    choice({ 'Ver Sinhaza': ['57,50'], Darkmeyer: ['56,52'], Slepe: [], 'Castle Drakan': [] }, 'Teleport'),
    "Drakan's medallion", 15304192),
  // Rubbed or worn, it goes inside the temple; after the hard Desert Diary the
  // player can switch it to the entrance, and the worn menu splits in two.
  item('item:camulet', 'Camulet', [6707], ['Camulet'], {
    Rub: { to: ['48,145'], afterDiary: { diary: 'Desert Hard', to: ['49,45'] } },
    Teleport: { to: ['48,145'], afterDiary: { diary: 'Desert Hard', to: ['49,45'] } },
    Temple: { to: ['48,145'] },
    Surface: { to: ['49,45'] },
  }, 'Camulet', 15355566),
  item('item:ring-of-the-elements', 'Ring of the elements', [26818], ['Ring of the Elements'],
    choice({ 'Air Altar': ['46,51'], 'Water Altar': ['49,49'], 'Earth Altar': ['51,54'], 'Fire Altar': ['51,51'] },
      'Rub', 'Last Destination'),
    'Ring of the elements', 15321585),
  // Enchanted lyre(i), oldid 15322185. Played, it goes to Rellekka until the
  // hard Fremennik Diary adds Waterbirth Island (and the elite, the isles).
  // The worn menu spells Jatizso "Jatiszo".
  item('item:enchanted-lyre', 'Enchanted lyre', [3691, 6125, 6126, 6127, 13079, 23458], ['Enchanted Lyre'], {
    Play: { to: ['41,56'], afterDiary: { diary: 'Fremennik Hard', to: ['39,58', '37,59', '36,59'] } },
    Rellekka: { to: ['41,56'] }, 'Waterbirth Island': { to: ['39,58'] }, Neitiznot: { to: ['36,59'] }, Jatiszo: { to: ['37,59'] },
  }, 'Enchanted lyre', 15351821),
  item('item:pharaohs-sceptre', "Pharaoh's sceptre", [26948], ["Pharaoh's Sceptre"],
    choice({ Jalsavrah: ['30,69'], Jaleustrophos: ['52,44'], Jaldraocht: ['50,45'], Jaltevas: ['51,42'] },
      'Teleport', 'Last-Teleport'),
    "Pharaoh's sceptre", 15322386),
  item('item:ectophial', 'Ectophial', [4251], ['Ectophial'], { Teleport: { to: ['57,55'] } }, 'Ectophial', 15195604),
  // It lands at the Grand Tree (2466,3492 on the Grand Tree's page, oldid 15114413).
  item('item:royal-seed-pod', 'Royal seed pod', [19564], ['Royal Seed Pod'], { Commune: { to: ['38,54'] } },
    'Royal seed pod', 15323014),
  // Eternal teleport crystal, oldid 15261005.
  item('item:teleport-crystal', 'Teleport crystal', [6102, 6101, 6100, 6099, 13102, 23946], ['Crystal Teleport Seed'],
    { Lletya: { to: ['36,49'] }, Prifddinas: { to: ['51,94'] } },
    'Teleport crystal', 15261004),
  // The Book of the Dead, oldid 15317141, shares the stories and names each one's pin.
  item('item:kharedsts-memoirs', "Kharedst's memoirs", [21760, 25818], ["Kharedst's Memoirs"],
    choice({
      'Lunch by the Lancalliums': ['26,56'], "The Fisher's Flute": ['28,58'], 'History and Hearsay': ['23,55'],
      'Jewellery of Jubilation': ['24,58'], 'A Dark Disposition': ['26,58'],
    }, 'Reminisce'),
    "Kharedst's memoirs", 15316631),
];

/** Where the house portals are: Rimmington, Taverley, Pollnivneach, Hosidius, Aldarin, Rellekka, Brimhaven, Yanille, Prifddinas. */
const HOUSE_PORTALS = ['46,50', '45,54', '52,46', '27,54', '22,46', '41,56', '43,49', '39,48', '50,94'];

/**
 * Worn teleport equipment: diary rewards, capes and the rest. None needs an
 * unlock from the app's lists (the game asks for the diary, level or quest
 * itself), so the destination alone decides. A lower tier without a teleport
 * isn't matched; a tier with fewer options simply never shows the others.
 * Left out: the Sailing cape (its teleport can take the boat, which has no
 * fixed place), the Ring of returning (the respawn point) and Ghommal's hilts
 * and defenders (their pages mark no landing square).
 */
const EQUIPMENT: readonly TravelMethod[] = [
  // Cloaks 1 to 3: oldids 15322173, 15271698, 15347094; Ardougne max cape, oldid 15262598.
  item('item:ardougne-cloak', 'Ardougne cloak', [13121, 13122, 13123, 13124, 20760], [], {
    'Monastery Teleport': { to: ['40,50'] }, 'Kandarin Monastery': { to: ['40,50'] },
    'Farm Teleport': { to: ['41,52'] }, 'Ardougne Farm': { to: ['41,52'] },
  }, 'Ardougne cloak 4', 15352885),
  // Amulets 2 and 3 (oldids 15186683, 15186684) teleport to Nardah only.
  item('item:desert-amulet', 'Desert amulet', [13134, 13135, 13136], [], {
    Teleport: { to: ['53,45'] }, Nardah: { to: ['53,45'] }, 'Kalphite cave': { to: ['51,48'] },
  }, 'Desert amulet 4', 15242227),
  // Rings 2 and 3: oldids 15186666, 15284006. To the cabbage patch south of Falador.
  item("item:explorers-ring", "Explorer's ring", [13126, 13127, 13128], [], { Teleport: { to: ['47,51'] } },
    "Explorer's ring 4", 15242240),
  // Boots 1 to 3: oldids 15186689, 15347400, 15347402. To Rellekka, not the golden apple tree (G7).
  item('item:fremennik-sea-boots', 'Fremennik sea boots', [13129, 13130, 13131, 13132], [], { Teleport: { to: ['41,57'] } },
    'Fremennik sea boots 4', 15242230),
  // Headgear 3: oldid 15186705. To Sherlock.
  item('item:kandarin-headgear', 'Kandarin headgear', [13139, 13140], [], { Teleport: { to: ['42,53'] } },
    'Kandarin headgear 4', 15242233),
  // Gloves 3 (oldid 15266075) go to the gem mine only. The Slayer Master is Duradel, in Shilo Village.
  item('item:karamja-gloves', 'Karamja gloves', [11140, 13103], [], {
    'Gem Mine': { to: ['44,146'] }, 'Slayer Master': { to: ['44,46'] },
  }, 'Karamja gloves 4', 15266078),
  // Legs 1 to 3: oldids 15186665, 15186668, 15186695. Legs 1 and 2 go to the Ectofuntus's slime pit only.
  item('item:morytania-legs', 'Morytania legs', [13112, 13113, 13114, 13115], [], {
    'Ecto Teleport': { to: ['57,154'] }, 'Ectofuntus Pit': { to: ['57,154'] },
    'Burgh Teleport': { to: ['54,50'] }, 'Burgh de Rott': { to: ['54,50'] },
  }, 'Morytania legs 4', 15348856),
  // Blessings 1 to 3: oldids 15240314, 15240313, 15240310; 1 and 2 go to the woodland only, whose
  // landing area crosses into 24,54.
  item("item:radas-blessing", "Rada's blessing", [22941, 22943, 22945, 22947], [], {
    'Kourend Woodland': { to: ['24,53', '24,54'] }, 'Mount Karuulm': { to: ['20,59'] },
  }, "Rada's blessing 4", 15242366),
  // Banner 3: oldid 15265264. To the Piscatoris Fishing Colony.
  item('item:western-banner', 'Western banner', [13143, 13144], [], { Teleport: { to: ['36,57'] } },
    'Western banner 4', 15265266),
  // Sword 3: oldid 15186672. To the Fountain of Rune, which its own page (oldid 15339934) maps in 52,60.
  item('item:wilderness-sword', 'Wilderness sword', [13110, 13111], [], { Teleport: { to: ['52,60'] } },
    'Wilderness sword 4', 15242364),

  // Teleport opens a choice of the house and the portals; Tele to POH goes to the house, wherever it is.
  item('item:construct-cape', 'Construct. cape', [9789, 9790], [], {
    Teleport: { to: HOUSE_PORTALS }, 'Tele to POH': { to: [] },
  }, 'Construct. cape', 15327003),
  item('item:crafting-cape', 'Crafting cape', [9780, 9781], [], { Teleport: { to: ['45,51'] } }, 'Crafting cape', 15232507),
  item('item:farming-cape', 'Farming cape', [9810, 9811], [], { Teleport: { to: ['19,58'] } }, 'Farming cape', 15327005),
  item('item:fishing-cape', 'Fishing cape', [9798, 9799], [], {
    'Fishing Guild': { to: ['40,53'] }, "Otto's Grotto": { to: ['39,54'] },
  }, 'Fishing cape', 15327000),
  // A choice of the Feldip and Wilderness hunter areas, and the Hunter Guild once unlocked.
  item('item:hunter-cape', 'Hunter cape', [9948, 9949], [], { Teleport: { to: ['39,45', '49,58', '24,47'] } },
    'Hunter cape', 15316570),
  item('item:strength-cape', 'Strength cape', [9750, 9751], [], {
    Teleport: { to: ['44,55'] }, "Warriors' Guild": { to: ['44,55'] },
  }, 'Strength cape', 15342993),
  // To the Legends' Guild gates; the guild's page (oldid 15352122) maps it within 42,52.
  item('item:quest-point-cape', 'Quest point cape', [9813, 13068], [], { Teleport: { to: ['42,52'] } },
    'Quest point cape', 15320190),
  // A choice of the sixteen diary masters.
  item('item:achievement-diary-cape', 'Achievement diary cape', [19476, 13069], [], {
    Teleport: {
      to: ['40,51', '51,48', '46,52', '41,56', '42,53', '43,49', '44,46', '43,46',
        '38,80', '25,57', '50,50', '54,54', '50,53', '48,54', '38,54', '48,50'],
    },
  }, 'Achievement diary cape', 15342685),
  // To Falo the Bard, whose square on his page (oldid 15351077) crosses into 42,55.
  item('item:music-cape', 'Music cape', [13221, 13222], [], { Teleport: { to: ['41,55', '42,55'] } }, 'Music cape', 15344582),
  // Mythical max cape, oldid 15262599. To the Myths' Guild.
  item('item:mythical-cape', 'Mythical cape', [22114, 24855], [], { Teleport: { to: ['38,44'] } }, 'Mythical cape', 15242067),
  // 13280 is the cape in the inventory and 13342 the cape worn. Teleports opens every skill cape's
  // teleport and the house portals; Home goes to the house, wherever it is. The worn menu's Guild
  // Teleports and Skilling Areas open lists the page doesn't give, so they aren't matched. The other
  // max capes keep none of these teleports.
  item('item:max-cape', 'Max cape', [13280, 13342], [], {
    Teleports: { to: ['44,55', '40,53', '45,51', '19,58', '39,54', '39,45', '49,58', '24,47', '47,46', ...HOUSE_PORTALS] },
    'POH Portals': { to: HOUSE_PORTALS }, Home: { to: [] }, 'Crafting Guild': { to: ['45,51'] },
  }, 'Max cape', 15352882),

  // The Champions' Guild; the landing square crosses into 50,52.
  item('item:chronicle', 'Chronicle', [13660], [], { Teleport: { to: ['49,52', '50,52'] } }, 'Chronicle', 15324584),
  // Skull sceptre (i), oldid 15322318. To the Stronghold of Security's entrance.
  item('item:skull-sceptre', 'Skull sceptre', [9013, 21276], [], { Invoke: { to: ['48,53'] } }, 'Skull sceptre', 15332191),
  // The Ghorrock Dungeon's landing (45,161) has no chunk in the app yet.
  item('item:ring-of-shadows', 'Ring of shadows', [28327], [],
    choice({
      'Ancient Vault': ['51,100'], 'Ghorrock Dungeon': [], 'The Scar': ['31,100'],
      'Lassar Undercity': ['40,100'], 'The Stranglewood': ['18,53'],
    }, 'Teleport'),
    'Ring of shadows', 15278103),
  item('item:pendant-of-ates', 'Pendant of Ates', [29893], [],
    choice({
      Darkfrost: ['23,51'], 'Twilight Temple': ['26,50'], "Ralos' Rise": ['22,49'],
      'North Aldarin': ['22,46'], Kastori: ['21,48'], 'Nemus Retreat': ['21,51'],
    }, 'Rub'),
    'Pendant of Ates', 15319355),
  item('item:giantsoul-amulet', 'Giantsoul amulet', [30638], [],
    choice({ Bryophyta: ['49,154'], Obor: ['48,153'], 'Branda and Eldric': ['46,149'] }, 'Rub'),
    'Giantsoul amulet', 15356803),
  // The Temple of the Eye (56,147) has no chunk in the app yet.
  item('item:amulet-of-the-eye', 'Amulet of the Eye', [26914, 26990, 26992, 26994], [], { Teleport: { to: [] } },
    'Amulet of the Eye', 15309207),
  // A choice of the Pandemonium, Port Roberts, Red Rock and Deepfin Point.
  item("item:sailors-amulet", "Sailors' amulet", [32399], [], { Teleport: { to: ['47,46', '29,51', '43,39', '30,43'] } },
    "Sailors' amulet", 15319506),
  // To the Lumbridge cow field.
  item('item:cowbell-amulet', 'Cowbell amulet', [33104], [], { Teleport: { to: ['50,51'] } }, 'Cowbell amulet', 15338665),
];

export const TRAVEL_METHODS: readonly TravelMethod[] = [...SPELLS, ...TABLETS, ...SCROLLS, ...JEWELLERY, ...EQUIPMENT];
