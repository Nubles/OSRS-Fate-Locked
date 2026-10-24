import { TableType } from '../types';
import { usesActivityKeyReserves } from '../config/gameModes';

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
  'Corporeal Beast': ['Chaos Temple'],
  'Alchemical Hydra': ['Mount Karuulm'],
  Cerberus: ['Taverley'],
  'Grotesque Guardians': ['Slayer Tower'],
  Kraken: ['Piscatoris Fishing Colony'],
  Skotizo: ['Catacombs of Kourend'],
  'Thermonuclear Smoke Devil': ['Feldip Hills'],
  "Calvar'ion": ['Graveyard of Shadows'],
  Artio: ['Graveyard of Shadows'],
  Spindel: ['Graveyard of Shadows'],
  'Crazy Archaeologist': ['Forgotten Cemetery'],
  'Chaos Fanatic': ['Lava Maze'],
  // The Escape Caves entrances (50,59 51,58 51,59) open with Chaos Temple, beside the Bone Yard.
  Callisto: ['Chaos Temple'],
  Venenatis: ['Chaos Temple'],
  "Vet'ion": ['Chaos Temple'],
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
  Yama: ['Shayzien'],
  'Doom of Mokhaiotl': ['Tlati Rainforest'],
  'Gemstone Crab': ['Tlati Rainforest'],
  'Shellbane Gryphon': ['The Great Conch'],
  'The Mad Angel': ['Wyrmscraig'],
  // Torfinn sails to Ungael from Rellekka, and the island's chunk opens with Rellekka.
  Vorkath: ['Rellekka'],
  // Each entrance's chunk, as the map owns it.
  'Tombs of Amascut': ['Sophanem'],
  'The Fractured Archive': ['Lumbridge'],
  Nex: ['Burthorpe'],
  'General Graardor': ['Burthorpe'],
  'Commander Zilyana': ['Burthorpe'],
  "Kree'arra": ['Burthorpe'],
  "K'ril Tsutsaroth": ['Burthorpe'],
  Araxxor: ['Darkmeyer'],
  'Chaos Elemental': ["Scorpia's Cave"],
  'Duke Sucellus': ['Weiss'],
  'Phantom Muspah': ['Weiss'],
  'The Leviathan': ["Wizards' Tower"],
  'The Whisperer': ['Goblin Village'],
  Amoxliatl: ["Ralos' Rise"],
  'Maggot King': ['Darkmeyer'],

  // Minigames
  'Barbarian Assault': ['Barbarian Outpost'],
  'Bounty Hunter': ['Ferox Enclave'],
  'Castle Wars': ['Castle Wars'],
  'Clan Wars': ['Ferox Enclave'],
  "Emir's Arena": ['Duel Arena / PvP Arena', 'Mage Training Arena'],
  // Captain Ginea runs it from the Shayzien encampment, 23,56 (accuracy audit G1).
  'Intelligence Gathering': ['Shayzien'],
  'Last Man Standing': ['Ferox Enclave'],
  "Pete Kayer's Challenges": ['Ferox Enclave'],
  'Mage Arena': ['Mage Arena'],
  'Nightmare Zone': ['Yanille'],
  'Pest Control': ["Void Knights' Outpost"],
  'Soul Wars': ['Isle of Souls'],
  'Temple Trekking': ['Burgh de Rott', 'Paterdomus'],
  'TzHaar Fight Pit': ['Mor Ul Rek (TzHaar City)'],
  'Archery Competition': ['Hemenster'],
  'Blast Furnace': ['Keldagrim'],
  'Fishing Trawler': ['Port Khazard'],
  "Giants' Foundry": ["Giants' Plateau"],
  'Gnome Ball': ['Tree Gnome Stronghold'],
  'Gnome Restaurant': ['Tree Gnome Stronghold'],
  'Guardians of the Rift': ["Wizards' Tower"],
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
  'Abyssal Sire', // no tracked named-area gate (fairy-ring interior)
  'Mimic', // no tracked named-area gate (casket-triggered encounter)

  // Distributed, event, or untracked-content activities.
  'Shooting Stars', // no tracked named-area gate (world event)
  'Impetuous Impulses', // no tracked named-area gate (multiple crop-circle entrances)
  'Mahogany Homes', // no tracked named-area gate (distributed contracts)
  'Forestry', // no tracked named-area gate (world event)
  'Barracuda Trials', // no tracked named-area gate (untracked Sailing destinations)
]);

/**
 * Chunked mode places each activity by the chunks it is entered from
 * (data/activityChunks.ts, generated from the chunk data). These have no single
 * entrance, so each follows its own rule instead.
 */
export type ChunkedActivityRule =
  | { kind: 'anywhere'; reason: string }
  | { kind: 'sailing'; reason: string }
  | { kind: 'not-random'; needs: string; reason: string };

export const CHUNKED_ACTIVITY_RULES: Readonly<Record<string, ChunkedActivityRule>> = {
  Forestry: { kind: 'anywhere', reason: 'A world event that comes to any group of trees.' },
  'Barracuda Trials': {
    kind: 'sailing',
    reason: 'Raced at sea in your own boat, so it counts once the run can sail (Sailing and Pandemonium).',
  },
  Mimic: {
    kind: 'not-random',
    needs: 'a Mimic casket from an Elite or Master clue',
    reason: 'Fought from a casket out of an Elite or Master clue, which no chunk holds and the tracker does not follow, so random Keys skip it. An Omni-Key can still pick it.',
  },
};

/** Policy metadata consumed by vanilla random-unlock and omni-direct flows. */
export interface VanillaRandomAccessPolicy {
  readonly filteredTables: readonly TableType[];
  readonly randomCosts: readonly ('key' | 'chaosKey')[];
  readonly requiresTrackedHardGeography: boolean;
  readonly emptyEligiblePool: {
    readonly noUnlock: boolean;
    readonly retainsKey: boolean;
    readonly preservesRngProgression: boolean;
  };
  readonly omniDirect: {
    readonly allowsLocationIneligible: boolean;
    readonly warnsPlayer: boolean;
  };
}

export const VANILLA_RANDOM_ACCESS_POLICY = {
  filteredTables: [TableType.BOSSES, TableType.MINIGAMES],
  // In Vanilla a random Key or Chaos Key rolls anything left in its table, as
  // fate picks, places the run can't reach yet included (October 2026). Only
  // Saradomin's Ward narrows a Key's draw to what the run can use.
  randomCosts: [],
  requiresTrackedHardGeography: true,
  emptyEligiblePool: { noUnlock: true, retainsKey: true, preservesRngProgression: true },
  omniDirect: { allowsLocationIneligible: true, warnsPlayer: true },
} as const satisfies VanillaRandomAccessPolicy;

/** Reject unsupported empty-pool rules before a caller can create an undefined selection. */
export const validateVanillaRandomAccessPolicy = (
  policy: VanillaRandomAccessPolicy = VANILLA_RANDOM_ACCESS_POLICY,
): VanillaRandomAccessPolicy => {
  const empty = policy.emptyEligiblePool;
  if (!empty.noUnlock || !empty.retainsKey || !empty.preservesRngProgression) {
    throw new Error('Vanilla empty random pools must reject without spending a key or consuming RNG.');
  }
  return policy;
};

/** Validate the configured Standard/Chaos empty-pool invariant for an attempted random draw. */
export const validateEmptyRandomPoolHandling = (
  modeId: string,
  cost: 'key' | 'chaosKey',
  policy: VanillaRandomAccessPolicy = VANILLA_RANDOM_ACCESS_POLICY,
): void => {
  if (usesActivityKeyReserves(modeId) && policy.randomCosts.includes(cost)) {
    validateVanillaRandomAccessPolicy(policy);
  }
};
