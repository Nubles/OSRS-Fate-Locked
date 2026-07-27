import { TableType } from '../types';

/**
 * Vanilla-mode hard geographic gates for activities.
 *
 * Each entry uses a literal canonical tracked area from REGIONS_LIST and
 * MISTHALIN_AREAS. Multiple areas are alternative entrances, so reaching any
 * one of them is sufficient.
 */
export const ACTIVITY_ACCESS_AREAS: Readonly<Record<string, readonly string[]>> = {
  // Bosses
  'Chambers of Xeric': ['Mount Quidamortem'],
  'Theatre of Blood': ['Ver Sinhaza'],
  'The Gauntlet': ['Prifddinas'],
  'The Nightmare': ['Slepe'],
  "Phosani's Nightmare": ['Slepe'],
  'Corporeal Beast': ['Graveyard of Shadows'],
  'Alchemical Hydra': ['Mount Karuulm'],
  Cerberus: ['Taverley'],
  'Grotesque Guardians': ['Slayer Tower'],
  Kraken: ['Piscatoris Fishing Colony'],
  Skotizo: ['Catacombs of Kourend'],
  'Thermonuclear Smoke Devil': ['Castle Wars'],
  "Calvar'ion": ['Graveyard of Shadows'],
  Scorpia: ["Scorpia's Cave"],
  'The Hueycoatl': ['Darkfrost'],
  'Moons of Peril': ['Cam Torum'],
  'Fortis Colosseum': ['Civitas illa Fortis'],
  Vardorvis: ['The Stranglewood'],
  'Barrows Brothers': ['Barrows'],
  Bryophyta: ['Varrock'],
  'Dagannoth Kings': ['Waterbirth Island'],
  'Deranged Archaeologist': ['Fossil Island'],
  'Giant Mole': ['Falador'],
  Hespori: ['Farming Guild'],
  'Kalphite Queen': ['Kalphite Lair'],
  'King Black Dragon': ['Lava Maze'],
  Obor: ['Edgeville'],
  Sarachnis: ['Hosidius'],
  Scurrius: ['Varrock'],
  Zulrah: ['Zul-Andra'],
  Wintertodt: ['Wintertodt Camp'],
  Tempoross: ['Ruins of Unkah'],
  Zalcano: ['Prifddinas'],
  'TzHaar Fight Cave': ['Mor Ul Rek (TzHaar City)'],
  Inferno: ['Mor Ul Rek (TzHaar City)'],
  "TzHaar-Ket-Rak's Challenges": ['Mor Ul Rek (TzHaar City)'],
  'Tormented Demons': ['Lumbridge'],
  'The Royal Titans': ['Asgarnian Ice Dungeon'],
  Yama: ['Kebos Lowlands'],
  'Doom of Mokhaiotl': ['Tlati Rainforest'],
  'Gemstone Crab': ['Tlati Rainforest'],
  'Shellbane Gryphon': ['The Great Conch'],

  // Minigames
  'Barbarian Assault': ['Barbarian Outpost'],
  'Bounty Hunter': ['Ferox Enclave'],
  'Castle Wars': ['Castle Wars'],
  'Clan Wars': ['Ferox Enclave'],
  "Emir's Arena": ['Duel Arena / PvP Arena'],
  'Intelligence Gathering': ['Piscarilius'],
  'Last Man Standing': ['Ferox Enclave'],
  'Mage Arena': ['Mage Arena'],
  'Nightmare Zone': ['Yanille'],
  'Pest Control': ["Void Knights' Outpost"],
  'Soul Wars': ['Isle of Souls'],
  'Temple Trekking': ['Burgh de Rott', 'Paterdomus'],
  'TzHaar Fight Pit': ['Mor Ul Rek (TzHaar City)'],
  'Archery Competition': ['Ranging Guild'],
  'Blast Furnace': ['Keldagrim'],
  'Fishing Trawler': ['Port Khazard'],
  "Giants' Foundry": ['Al Kharid'],
  'Gnome Ball': ['Tree Gnome Stronghold'],
  'Gnome Restaurant': ['Tree Gnome Stronghold'],
  'Guardians of the Rift': ['Al Kharid'],
  'Mage Training Arena': ['Mage Training Arena'],
  'Mastering Mixology': ['Aldarin'],
  Mess: ['Hosidius'],
  'Pyramid Plunder': ['Sophanem'],
  "Rogues' Den": ['Burthorpe'],
  "Sorceress's Garden": ['Al Kharid'],
  'Stealing Artefacts': ['Piscarilius'],
  'Tithe Farm': ['Hosidius'],
  'Trouble Brewing': ["Mos Le'Harmless"],
  'Vale Totems': ['Auburnvale'],
  'Volcanic Mine': ['Fossil Island'],
  "Shades of Mort'ton": ["Mort'ton"],
  'Tai Bwo Wannai Cleanup': ['Tai Bwo Wannai'],
  "Warriors' Guild": ["Warriors' Guild"],
  'Burthorpe Games Room': ['Burthorpe'],
  'Tears of Guthix': ['Lumbridge'],
  'Brimhaven Agility Arena': ['Brimhaven'],
  'Hallowed Sepulchre': ['Darkmeyer'],
};

/** Activities with no hard location gate expressible by the tracked named areas. */
export const NO_HARD_LOCATION_GATE = new Set<string>([
  // Boss venues or entrances not represented by a single tracked named area.
  'Tombs of Amascut', // no tracked named-area gate (Necropolis)
  'Nex', // no tracked named-area gate (God Wars Dungeon)
  'General Graardor', // no tracked named-area gate (God Wars Dungeon)
  'Commander Zilyana', // no tracked named-area gate (God Wars Dungeon)
  "Kree'arra", // no tracked named-area gate (God Wars Dungeon)
  "K'ril Tsutsaroth", // no tracked named-area gate (God Wars Dungeon)
  'Abyssal Sire', // no tracked named-area gate (fairy-ring interior)
  'Araxxor', // no tracked named-area gate (Morytania Spider Cave)
  'Artio', // no tracked named-area gate (Wilderness bear cave)
  'Callisto', // no tracked named-area gate (Wilderness bear cave)
  'Chaos Elemental', // no tracked named-area gate (roaming Wilderness boss)
  'Chaos Fanatic', // no tracked named-area gate (Wilderness altar site)
  'Crazy Archaeologist', // no tracked named-area gate (Wilderness ruin)
  'Spindel', // no tracked named-area gate (Wilderness spider cave)
  'Venenatis', // no tracked named-area gate (Wilderness spider cave)
  "Vet'ion", // no tracked named-area gate (Wilderness skeleton cave)
  'Vorkath', // no tracked named-area gate (Ungael)
  'Galvek', // no tracked named-area gate (quest instance)
  'Duke Sucellus', // no tracked named-area gate (Ghorrock Prison)
  'The Leviathan', // no tracked named-area gate (The Scar)
  'The Whisperer', // no tracked named-area gate (The Scar)
  'Mimic', // no tracked named-area gate (casket-triggered encounter)
  'Phantom Muspah', // no tracked named-area gate (Ghorrock Dungeon)
  'Amoxliatl', // no tracked named-area gate (Ruins of Tapoyauik)

  // Distributed, event, or untracked-content activities.
  'Shooting Stars', // no tracked named-area gate (world event)
  'Impetuous Impulses', // no tracked named-area gate (multiple crop-circle entrances)
  'Mahogany Homes', // no tracked named-area gate (distributed contracts)
  'Forestry', // no tracked named-area gate (world event)
  'Rat Pits', // no tracked named-area gate (multiple venues)
  'Barracuda Trials', // no tracked named-area gate (untracked Sailing destinations)
]);

/** Policy metadata consumed by vanilla random-unlock and omni-direct flows. */
export const VANILLA_RANDOM_ACCESS_POLICY = {
  filteredTables: [TableType.BOSSES, TableType.MINIGAMES],
  randomCosts: ['key', 'chaosKey'],
  omniDirectBypasses: true,
} as const;
