
import { DropSource, TableType } from '../types';
import { ENRICHED_SOURCES } from './resourceEnrichment';

export type SourceType =
  | 'DROP'
  | 'SHOP'
  | 'SPAWN'
  | 'SKILL'
  | 'MINIGAME'
  | 'MERCHANT'
  | 'QUEST'
  | 'PICKPOCKET' // Thieving NPCs / stalls
  | 'CLUE';      // Treasure Trail rewards

export interface ResourceSource {
  type: SourceType;
  name: string; // e.g. "Chaos Druid", "Farming Patch", "General Store"
  regions: string[]; // List of regions where this specific source exists
  skills?: Record<string, number>; // Specific levels required to access/kill
  quests?: string[];
  unlockId?: string; // Specific unlock ID from TableType (e.g. 'Farming Guild')
  unlockTable?: TableType; // Authoritative gacha table for this unlock when explicit
  notes?: string; // e.g. "Edgeville Dungeon"
  inputs?: Record<string, number>; // Ingredients -> Quantity
  outputYield?: number; // How many items are produced per operation (default 1)
  rarity?: string; // Drop rate / acquisition odds, e.g. "1/512", "Common", "Always"
}

/**
 * Explicit gacha-table provenance for legacy resource sources that predate
 * `unlockTable`. This is authored data, not a lookup through gacha pools;
 * unknown IDs deliberately resolve to no typed dependency.
 */
export const RESOURCE_UNLOCK_TABLES: Readonly<Record<string, TableType>> = {
  // Bosses
  'Abyssal Sire': TableType.BOSSES,
  'Alchemical Hydra': TableType.BOSSES,
  'Araxxor': TableType.BOSSES,
  'Artio': TableType.BOSSES,
  'Barrows Brothers': TableType.BOSSES,
  'Bryophyta': TableType.BOSSES,
  'Callisto': TableType.BOSSES,
  "Calvar'ion": TableType.BOSSES,
  'Cerberus': TableType.BOSSES,
  'Chambers of Xeric': TableType.BOSSES,
  'Chaos Elemental': TableType.BOSSES,
  'Chaos Fanatic': TableType.BOSSES,
  'Commander Zilyana': TableType.BOSSES,
  'Corporeal Beast': TableType.BOSSES,
  'Crazy Archaeologist': TableType.BOSSES,
  'Dagannoth Kings': TableType.BOSSES,
  'Deranged Archaeologist': TableType.BOSSES,
  'Duke Sucellus': TableType.BOSSES,
  'Fortis Colosseum': TableType.BOSSES,
  'General Graardor': TableType.BOSSES,
  'Giant Mole': TableType.BOSSES,
  'Grotesque Guardians': TableType.BOSSES,
  'Hespori': TableType.BOSSES,
  'Kalphite Queen': TableType.BOSSES,
  'King Black Dragon': TableType.BOSSES,
  'Kraken': TableType.BOSSES,
  "Kree'arra": TableType.BOSSES,
  "K'ril Tsutsaroth": TableType.BOSSES,
  'Nex': TableType.BOSSES,
  'Obor': TableType.BOSSES,
  'Phantom Muspah': TableType.BOSSES,
  "Phosani's Nightmare": TableType.BOSSES,
  'Sarachnis': TableType.BOSSES,
  'Scorpia': TableType.BOSSES,
  'Scurrius': TableType.BOSSES,
  'Shellbane Gryphon': TableType.BOSSES,
  'Skotizo': TableType.BOSSES,
  'Spindel': TableType.BOSSES,
  'Tempoross': TableType.BOSSES,
  'The Gauntlet': TableType.BOSSES,
  'The Hueycoatl': TableType.BOSSES,
  'The Leviathan': TableType.BOSSES,
  'The Nightmare': TableType.BOSSES,
  'The Whisperer': TableType.BOSSES,
  'Theatre of Blood': TableType.BOSSES,
  'Thermonuclear Smoke Devil': TableType.BOSSES,
  'Tombs of Amascut': TableType.BOSSES,
  'Vardorvis': TableType.BOSSES,
  'Venenatis': TableType.BOSSES,
  "Vet'ion": TableType.BOSSES,
  'Vorkath': TableType.BOSSES,
  'Wintertodt': TableType.BOSSES,
  'Zalcano': TableType.BOSSES,
  'Zulrah': TableType.BOSSES,
  // Minigames
  'Barbarian Assault': TableType.MINIGAMES,
  'Blast Furnace': TableType.MINIGAMES,
  'Fishing Trawler': TableType.MINIGAMES,
  'Hallowed Sepulchre': TableType.MINIGAMES,
  'Mage Training Arena': TableType.MINIGAMES,
  'Mastering Mixology': TableType.MINIGAMES,
  'Nightmare Zone': TableType.MINIGAMES,
  'Pest Control': TableType.MINIGAMES,
  "Sorceress's Garden": TableType.MINIGAMES,
  'Temple Trekking': TableType.MINIGAMES,
  'Tithe Farm': TableType.MINIGAMES,
  'Volcanic Mine': TableType.MINIGAMES,
};

export interface ResourceUnlockDependency {
  table: TableType;
  id: string;
}

export const resourceUnlockDependency = (
  source: Pick<ResourceSource, 'unlockId' | 'unlockTable'>,
): ResourceUnlockDependency | null => {
  if (!source.unlockId) return null;
  const table = source.unlockTable ?? RESOURCE_UNLOCK_TABLES[source.unlockId];
  return table ? { table, id: source.unlockId } : null;
};

export const RESOURCE_MAP: Record<string, ResourceSource[]> = {
  // --- HERBS ---
  'Ranarr Weed': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Misthalin', 'Kandarin', 'Morytania', 'Kourend & Kebos', 'Tirannwn', 'Fremennik', 'Varlamore'], skills: { 'Farming': 32 }, notes: 'Requires Seeds', outputYield: 8 }, 
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin', 'Wilderness', 'Morytania'], notes: 'Edgeville Dungeon / Yanille / Wildy' },
    { type: 'DROP', name: 'Aberrant Spectre', regions: ['Morytania', 'Kandarin', 'Kourend & Kebos'], skills: { 'Slayer': 60 }, notes: 'Slayer Tower / Catacombs' },
    { type: 'DROP', name: 'Flesh Crawler', regions: ['Misthalin'], notes: 'Stronghold of Security' },
    { type: 'MINIGAME', name: 'Sinister Chest', regions: ['Kandarin'], skills: {'Agility': 40}, notes: 'Requires Sinister Key' }
  ],
  'Snapdragon': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Misthalin', 'Kandarin', 'Morytania', 'Kourend & Kebos', 'Tirannwn', 'Fremennik', 'Varlamore'], skills: { 'Farming': 62 }, notes: 'Requires Seeds', outputYield: 8 },
    { type: 'DROP', name: 'Nechryael', regions: ['Morytania', 'Kourend & Kebos'], skills: { 'Slayer': 80 } },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', notes: 'Boss Drop' },
    { type: 'DROP', name: 'Hydra', regions: ['Kourend & Kebos'], skills: {'Slayer': 95}, notes: 'Karuulm Dungeon' }
  ],
  'Torstol': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Misthalin', 'Kandarin', 'Morytania', 'Kourend & Kebos', 'Tirannwn', 'Fremennik', 'Varlamore'], skills: { 'Farming': 85 }, notes: 'Requires Seeds', outputYield: 8 },
    { type: 'MINIGAME', name: 'Sinister Chest', regions: ['Kandarin'], skills: {'Agility': 40}, notes: 'Guaranteed Drop' },
    { type: 'DROP', name: 'Commander Zilyana', regions: ['Fremennik'], unlockId: 'Commander Zilyana' },
    { type: 'DROP', name: 'Thermonuclear Smoke Devil', regions: ['Kandarin'], skills: {'Slayer': 93}, unlockId: 'Thermonuclear Smoke Devil' }
  ],
  'Irit Leaf': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 44}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin', 'Morytania'] },
    { type: 'DROP', name: 'Moss Giant', regions: ['Any'], notes: 'Common drop' }
  ],
  'Kwuarm': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 56}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Aberrant Spectre', regions: ['Morytania', 'Kandarin'] },
    { type: 'DROP', name: 'Wyrm', regions: ['Kourend & Kebos'], skills: {'Slayer': 62} }
  ],
  'Cadantine': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 67}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Nechryael', regions: ['Morytania', 'Kourend & Kebos'], skills: {'Slayer': 80} },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75} }
  ],
  'Dwarf Weed': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 79}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Kurask', regions: ['Fremennik', 'Tirannwn'], skills: {'Slayer': 70} },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75} }
  ],
  'Toadflax': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 38}, notes: 'Seed required', outputYield: 8 },
    { type: 'MINIGAME', name: 'Brimstone Chest', regions: ['Kourend & Kebos'] },
    { type: 'DROP', name: 'Cave Horror', regions: ['Islands & Others'], skills: {'Slayer': 58}, quests: ['Cabin Fever'] }
  ],
  'Avantoe': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 50}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin', 'Morytania'] },
    { type: 'DROP', name: 'Turoth', regions: ['Fremennik'], skills: {'Slayer': 55} }
  ],
  'Lantadyme': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 73}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah' },
    { type: 'DROP', name: 'Steel Dragon', regions: ['Karamja', 'Kourend & Kebos'] }
  ],
  'Harralander': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 26}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin', 'Morytania'] }
  ],

  // --- POTIONS ---
  'Prayer Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 38 }, inputs: {'Ranarr Weed': 1, 'Snape Grass': 1, 'Vial of Water': 1}, notes: 'Standard Recipe (3-dose)', outputYield: 1 },
    { type: 'DROP', name: 'Maniacal Monkey', regions: ['Kandarin'], quests: ['Monkey Madness I'], skills: {'Hunter': 60} },
    { type: 'MINIGAME', name: 'Barrows Chest', regions: ['Morytania'], unlockId: 'Barrows Brothers' },
    { type: 'DROP', name: 'Wyrm', regions: ['Kourend & Kebos'], skills: {'Slayer': 62}, notes: 'Uncommon drop (3-dose)' }
  ],
  'Super Attack': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 45 }, inputs: {'Irit Leaf': 1, 'Eye of Newt': 1, 'Vial of Water': 1} }
  ],
  'Super Strength': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 55 }, inputs: {'Kwuarm': 1, 'Limpwurt Root': 1, 'Vial of Water': 1} }
  ],
  'Super Defence': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 66 }, inputs: {'Cadantine': 1, 'White Berries': 1, 'Vial of Water': 1} }
  ],
  'Super Restore': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 63 }, inputs: {'Snapdragon': 1, 'Red Spiders\' Eggs': 1, 'Vial of Water': 1} }
  ],
  'Stamina Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 77 }, inputs: {'Super Energy(4)': 1, 'Amylase Crystal': 4} }
  ],
  'Ranging Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 72 }, inputs: {'Dwarf Weed': 1, 'Wine of Zamorak': 1, 'Vial of Water': 1} },
    { type: 'DROP', name: 'Tarn Razorlor', regions: ['Morytania'], quests: ['Haunted Mine'] }
  ],
  'Saradomin Brew': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 81 }, inputs: {'Toadflax': 1, 'Crushed Nest': 1, 'Vial of Water': 1} },
    { type: 'DROP', name: 'Giant Mole', regions: ['Asgarnia'], unlockId: 'Giant Mole', notes: 'Common drop (2-dose)' },
    { type: 'DROP', name: 'Demonic Gorilla', regions: ['Kandarin'], quests: ['Monkey Madness II'], notes: 'No Slayer level required' }
  ],
  'Super Combat Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: {'Herblore': 90}, inputs: {'Super Attack': 1, 'Super Strength': 1, 'Super Defence': 1, 'Torstol': 1}, notes: 'Combine 4-dose potions' }
  ],
  'Anti-venom': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: {'Herblore': 87}, inputs: {'Zulrah\'s Scales': 20, 'Antidote++': 1}, notes: 'Requires Antidote++ (Coconut Milk + Toadflax + Magic Roots)' },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', notes: 'Also drops Antidote++' }
  ],
  'Energy Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: {'Herblore': 26}, inputs: {'Harralander': 1, 'Chocolate Dust': 1, 'Vial of Water': 1} }
  ],
  'Super Energy(4)': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: {'Herblore': 52}, inputs: {'Avantoe': 1, 'Mort Myre Fungus': 1, 'Vial of Water': 1}, outputYield: 1 }
  ],

  // --- SECONDARIES ---
  'Snape Grass': [
    { type: 'SKILL', name: 'Allotment Patch', regions: ['Misthalin', 'Kandarin', 'Morytania', 'Kourend & Kebos', 'Tirannwn', 'Fremennik', 'Varlamore'], skills: { 'Farming': 61 }, notes: 'High yield', outputYield: 25 },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Fremennik'], notes: 'Waterbirth Island' },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Kourend & Kebos'], notes: 'Hosidius Shore' }
  ],
  'Red Spiders\' Eggs': [
    { type: 'DROP', name: 'Spidine', regions: ['Kandarin'], quests: ['Tower of Life'], notes: 'Tower of Life (Fastest)', outputYield: 3 },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Misthalin', 'Wilderness'], notes: 'Edgeville Dungeon / Forthos / Wildy' },
    { type: 'DROP', name: 'Sarachnis', regions: ['Kourend & Kebos'], unlockId: 'Sarachnis', notes: 'Common Drop' },
    { type: 'DROP', name: 'Spidines/Red Spiders', regions: ['Misthalin', 'Karamja'], notes: 'Varrock Sewers/Brimhaven' }
  ],
  'Mort Myre Fungus': [
    { type: 'SKILL', name: 'Bloom (Swamp logs)', regions: ['Morytania'], skills: { 'Prayer': 1 }, quests: ['Nature Spirit'], notes: 'Cast Bloom on rotting logs', outputYield: 2 }
  ],
  'Blue Dragon Scale': [
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Kandarin'], quests: ['Dragon Slayer II'], notes: 'Myths\' Guild (Fastest)' },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Asgarnia'], notes: 'Taverley Dungeon' },
    { type: 'DROP', name: 'Blue Dragon', regions: ['Asgarnia', 'Kandarin', 'Misthalin'] }
  ],
  'Wine of Zamorak': [
    { type: 'SPAWN', name: 'Telegrab Spawn', regions: ['Asgarnia'], skills: {'Magic': 33}, notes: 'Chaos Temple (Monks will attack)' },
    { type: 'MINIGAME', name: 'Tithe Farm', regions: ['Kourend & Kebos'], unlockId: 'Tithe Farm', notes: 'Purchase with Points' },
    { type: 'DROP', name: 'Kalphite Queen', regions: ['Kharidian Desert'], unlockId: 'Kalphite Queen' },
    { type: 'DROP', name: 'Zamorak Warrior', regions: ['Morytania'], notes: 'ZMI Altar' }
  ],
  'Limpwurt Root': [
    { type: 'SKILL', name: 'Flower Patch', regions: ['Misthalin', 'Kandarin', 'Kourend & Kebos', 'Fremennik'], skills: {'Farming': 26}, notes: 'Reliable yield', outputYield: 3 },
    { type: 'DROP', name: 'Kurask', regions: ['Fremennik', 'Tirannwn'], skills: {'Slayer': 70} },
    { type: 'DROP', name: 'Hill Giant', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Wilderness', 'Kharidian Desert', 'Kourend & Kebos', 'Varlamore'], notes: 'Common drop' }
  ],
  'White Berries': [
    { type: 'SKILL', name: 'Bush Patch', regions: ['Misthalin', 'Kandarin', 'Kourend & Kebos', 'Morytania'], skills: {'Farming': 59}, notes: 'Requires Seeds', outputYield: 4 },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Wilderness'], notes: 'Lava Dragon Isle' },
    { type: 'DROP', name: 'Kurask', regions: ['Fremennik', 'Tirannwn'], skills: {'Slayer': 70} }
  ],
  'Crushed Nest': [
    { type: 'SKILL', name: 'Bird Houses', regions: ['Islands & Others'], skills: {'Hunter': 5}, quests: ['Bone Voyage'], notes: 'Fossil Island runs', outputYield: 10 },
    { type: 'DROP', name: 'Giant Mole', regions: ['Asgarnia'], unlockId: 'Giant Mole', notes: 'Exchange skins/claws' },
    { type: 'DROP', name: 'Callisto', regions: ['Wilderness'], unlockId: 'Callisto' }
  ],
  'Eye of Newt': [
    { type: 'SHOP', name: 'Herblore Shop', regions: ['Asgarnia', 'Kandarin', 'Misthalin'], notes: 'Taverley / Catherby / Port Sarim' },
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin', 'Morytania'] }
  ],
  'Vial of Water': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'], notes: 'Most general stores stock packs' },
    { type: 'SKILL', name: 'Use Vial on Fountain', regions: ['Any'], notes: 'Requires Empty Vial' }
  ],
  'Amylase Crystal': [
    { type: 'MERCHANT', name: 'Grace', regions: ['Asgarnia'], notes: 'Burthorpe (10 Marks of Grace)', outputYield: 100 }
  ],
  'Chocolate Dust': [
    { type: 'SHOP', name: 'Food Shop', regions: ['Kandarin'], notes: 'Buy Chocolate Bar (Grand Tree/Catherby) and grind' },
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: {'Chocolate Bar': 1, 'Knife': 0} }
  ],
  'Chocolate Bar': [
    { type: 'SHOP', name: 'Food Shop', regions: ['Kandarin'], notes: 'Grand Tree Groceries / Catherby' }
  ],

  // --- LOGS ---
  'Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Any'], skills: {'Woodcutting': 1}, notes: 'Normal Tree' }
  ],
  'Oak Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Any'], skills: {'Woodcutting': 15}, notes: 'Common tree' }
  ],
  'Willow Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Any'], skills: {'Woodcutting': 30}, notes: 'Draynor / Catherby' }
  ],
  'Teak Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Karamja', 'Islands & Others', 'Kourend & Kebos', 'Feldip Hills'], skills: {'Woodcutting': 35}, notes: 'Hardwood Groves' },
    { type: 'SKILL', name: 'Hardwood Patch', regions: ['Islands & Others'], skills: {'Farming': 35}, outputYield: 20 }
  ],
  'Maple Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Kandarin', 'Misthalin', 'Fremennik'], skills: {'Woodcutting': 45}, notes: 'Seers / Misc' },
    { type: 'MINIGAME', name: 'Kingdom of Miscellania', regions: ['Fremennik'], quests: ['Throne of Miscellania'] }
  ],
  'Mahogany Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Karamja', 'Islands & Others', 'Kourend & Kebos'], skills: {'Woodcutting': 50} },
    { type: 'SKILL', name: 'Hardwood Patch', regions: ['Islands & Others'], skills: {'Farming': 55}, outputYield: 20 },
    { type: 'MINIGAME', name: 'Kingdom of Miscellania', regions: ['Fremennik'], quests: ['Throne of Miscellania'] }
  ],
  'Yew Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Any'], skills: {'Woodcutting': 60} },
    { type: 'DROP', name: 'Ent', regions: ['Wilderness', 'Kourend & Kebos'] },
    { type: 'DROP', name: 'Giant Mole', regions: ['Asgarnia'], unlockId: 'Giant Mole' }
  ],
  'Magic Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Kandarin', 'Islands & Others', 'Wilderness', 'Tirannwn'], skills: {'Woodcutting': 75}, notes: 'Seers / Mage Arena / Prifddinas' },
    { type: 'DROP', name: 'Skeletal Wyvern', regions: ['Asgarnia'], skills: {'Slayer': 72} },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah' },
    { type: 'DROP', name: 'Callisto', regions: ['Wilderness'], unlockId: 'Callisto' },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath' },
    { type: 'MINIGAME', name: 'Wintertodt', regions: ['Kourend & Kebos'], unlockId: 'Wintertodt' }
  ],
  'Redwood Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Kourend & Kebos'], skills: {'Woodcutting': 90}, notes: 'Woodcutting Guild' }
  ],

  // --- CONSTRUCTION ---
  'Oak Plank': [
    { type: 'MERCHANT', name: 'Sawmill Operator', regions: ['Misthalin', 'Kourend & Kebos'], inputs: {'Oak Logs': 1, 'Coins': 250}, notes: 'Convert logs' },
    { type: 'SKILL', name: 'Plank Make', regions: ['Fremennik'], skills: {'Magic': 86}, inputs: {'Oak Logs': 1, 'Nature Rune': 1, 'Astral Rune': 2}, notes: 'Lunar Spell' }
  ],
  'Teak Plank': [
    { type: 'MERCHANT', name: 'Sawmill Operator', regions: ['Misthalin', 'Kourend & Kebos'], inputs: {'Teak Logs': 1, 'Coins': 500} },
    { type: 'SKILL', name: 'Plank Make', regions: ['Fremennik'], skills: {'Magic': 86}, inputs: {'Teak Logs': 1, 'Nature Rune': 1, 'Astral Rune': 2} },
    { type: 'DROP', name: 'Callisto', regions: ['Wilderness'], unlockId: 'Callisto' }
  ],
  'Mahogany Plank': [
    { type: 'MERCHANT', name: 'Sawmill Operator', regions: ['Misthalin', 'Kourend & Kebos'], inputs: {'Mahogany Logs': 1, 'Coins': 1500} },
    { type: 'SKILL', name: 'Plank Make', regions: ['Fremennik'], skills: {'Magic': 86}, inputs: {'Mahogany Logs': 1, 'Nature Rune': 1, 'Astral Rune': 2} },
    { type: 'DROP', name: 'Callisto', regions: ['Wilderness'], unlockId: 'Callisto' },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah' }
  ],

  // --- CRAFTING & PROCESSING ---
  'Bucket of Sand': [
    { type: 'SKILL', name: 'Sandstone Grinder', regions: ['Kharidian Desert'], skills: {'Mining': 35}, notes: 'Quarry (Fastest)', outputYield: 50 },
    { type: 'MERCHANT', name: 'Bert (Daily)', regions: ['Kandarin'], skills: {'Crafting': 50}, quests: ['The Hand in the Sand'], notes: '84/day free', outputYield: 84 },
    { type: 'SHOP', name: 'Charter Ships', regions: ['Kandarin', 'Karamja', 'Asgarnia'], notes: 'Restocks slowly' }
  ],
  'Soda Ash': [
    { type: 'SHOP', name: 'Charter Ships', regions: ['Kandarin', 'Karamja', 'Asgarnia'], notes: 'Catherby/Port Sarim' },
    { type: 'DROP', name: 'Killerwatt', regions: ['Kandarin'], skills: {'Slayer': 37}, notes: 'Draynor Manor (Portal)' }
  ],
  'Giant Seaweed': [
    { type: 'SKILL', name: 'Seaweed Patch', regions: ['Islands & Others'], skills: {'Farming': 23}, quests: ['Bone Voyage'], notes: 'Fossil Island Underwater', outputYield: 30 },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Kourend & Kebos'], notes: 'Piscarilius Shore (Regular Seaweed)' }
  ],
  'Flax': [
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', notes: 'Massive quantities', outputYield: 100 },
    { type: 'DROP', name: 'Kurask', regions: ['Fremennik', 'Tirannwn'], skills: {'Slayer': 70} },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Kandarin'], notes: 'Seers\' Village Fields' }
  ],
  'Molten Glass': [
    { type: 'SKILL', name: 'Superglass Make', regions: ['Fremennik'], skills: {'Magic': 77, 'Crafting': 61}, quests: ['Lunar Diplomacy'], inputs: {'Bucket of Sand': 1, 'Giant Seaweed': 0.16}, notes: 'Giant Seaweed = 6 Glass' },
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: {'Crafting': 1}, inputs: {'Bucket of Sand': 1, 'Soda Ash': 1} }
  ],
  'Black D\'hide Body': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 84}, inputs: {'Black Dragon Leather': 3, 'Thread': 1, 'Needle': 0}, notes: 'Requires 3 leather' },
    { type: 'DROP', name: 'Magpie Impling', regions: ['Any'], skills: {'Hunter': 65} }
  ],
  'Black Dragon Leather': [
    { type: 'SKILL', name: 'Tan Leather', regions: ['Any'], inputs: {'Black Dragonhide': 1, 'Coins': 20}, notes: 'Use Tanner or Lunar Spell' }
  ],
  'Black Dragonhide': [
    { type: 'DROP', name: 'Black Dragon', regions: ['Asgarnia', 'Tirannwn'], notes: 'Taverley Dungeon' },
    { type: 'DROP', name: 'Black Dragon', regions: ['Kandarin', 'Tirannwn'], quests: ['Dragon Slayer II'], notes: 'Myths\' Guild' },
    { type: 'DROP', name: 'KBD', regions: ['Wilderness'], unlockId: 'King Black Dragon' },
    { type: 'DROP', name: 'Brutal Black Dragon', regions: ['Kourend & Kebos'], skills: {'Slayer': 77}, notes: 'Catacombs' },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath' }
  ],
  'Red Dragonhide': [
    { type: 'DROP', name: 'Red Dragon', regions: ['Karamja'], notes: 'Brimhaven Dungeon' },
    { type: 'DROP', name: 'Red Dragon', regions: ['Kourend & Kebos'], notes: 'Forthos Dungeon' },
    { type: 'DROP', name: 'Brutal Red Dragon', regions: ['Kourend & Kebos'], notes: 'Forthos Dungeon — no Slayer level required' }
  ],
  'Blue Dragonhide': [
    { type: 'DROP', name: 'Blue Dragon', regions: ['Asgarnia'], notes: 'Taverley Dungeon / Heroes Guild' },
    { type: 'DROP', name: 'Blue Dragon', regions: ['Kandarin'], notes: 'Ogre Enclave / Myths Guild' },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath', notes: 'Guaranteed 2x' }
  ],
  'Green Dragonhide': [
    { type: 'DROP', name: 'Green Dragon', regions: ['Wilderness'], notes: 'Revs/Graveyard/East Wildy' },
    { type: 'DROP', name: 'Green Dragon', regions: ['Kandarin', 'Wilderness'], quests: ['Dragon Slayer II'], notes: 'Myths Guild' },
    { type: 'DROP', name: 'Brutal Green Dragon', regions: ['Kandarin'], notes: 'Ancient Cavern' }
  ],
  'Uncut Dragonstone': [
    { type: 'MINIGAME', name: 'Crystal Chest', regions: ['Asgarnia'], notes: 'Reward' },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'] },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath' },
    { type: 'DROP', name: 'Rune Dragon', regions: ['Kandarin', 'Fremennik'], quests: ['Dragon Slayer II'] }
  ],

  // --- MINING & ORES ---
  'Copper Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Any'], skills: {'Mining': 1} }
  ],
  'Tin Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Any'], skills: {'Mining': 1} }
  ],
  'Clay': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Fremennik', 'Kourend & Kebos', 'Karamja', 'Wilderness'], skills: {'Mining': 1} }
  ],
  'Rune Essence': [
    { type: 'SKILL', name: 'Mining', regions: ['Misthalin'], quests: ['Rune Mysteries'], notes: 'Rune Essence Mine' }
  ],
  'Blurite Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Asgarnia'], skills: {'Mining': 10}, notes: 'Knight\'s Sword Dungeon' }
  ],
  'Limestone': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Morytania', 'Kandarin', 'Tirannwn'], skills: {'Mining': 10} },
    { type: 'SHOP', name: 'Stonemason', regions: ['Fremennik'] }
  ],
  'Barronite Shards': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Asgarnia'], skills: {'Mining': 14}, quests: ['Below Ice Mountain'], notes: 'Camdozaal' }
  ],
  'Iron Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Any'], skills: {'Mining': 15} },
    { type: 'SHOP', name: 'Ore Seller', regions: ['Fremennik', 'Kourend & Kebos'] }
  ],
  'Silver Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Asgarnia', 'Misthalin', 'Kandarin', 'Fremennik', 'Kourend & Kebos', 'Karamja'], skills: {'Mining': 20}, notes: 'Crafting Guild / Al Kharid / TzHaar' },
    { type: 'SHOP', name: 'Silver Merchant', regions: ['Kandarin'] }
  ],
  'Volcanic Ash': [
    { type: 'SKILL', name: 'Ash Pile', regions: ['Islands & Others'], skills: {'Mining': 22}, quests: ['Bone Voyage'], notes: 'Fossil Island' }
  ],
  'Coal': [
    { type: 'MINIGAME', name: 'Kingdom of Miscellania', regions: ['Fremennik'], quests: ['Throne of Miscellania'], notes: 'Passive Gathering', outputYield: 400 },
    { type: 'SHOP', name: 'Blast Furnace Shop', regions: ['Fremennik'], unlockId: 'Blast Furnace' },
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Fremennik', 'Kourend & Kebos', 'Karamja', 'Wilderness', 'Morytania'], skills: {'Mining': 30}, notes: 'Motherlode Mine / Guild' },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75} },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', outputYield: 200 }
  ],
  'Sandstone': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Kharidian Desert'], skills: {'Mining': 35}, notes: 'Quarry' }
  ],
  'Dense Essence Block': [
    { type: 'SKILL', name: 'Mining', regions: ['Kourend & Kebos'], skills: {'Mining': 38, 'Crafting': 38}, quests: ['A Kingdom Divided'], notes: 'Arceuus Essence Mine' }
  ],
  'Gem Rock': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Karamja'], skills: {'Mining': 40}, quests: ['Shilo Village'], notes: 'Shilo Village' },
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Fremennik'], skills: {'Mining': 40}, quests: ['Lunar Diplomacy'], notes: 'Lunar Isle' }
  ],
  'Gold Ore': [
    { type: 'SHOP', name: 'Blast Furnace Shop', regions: ['Fremennik'], unlockId: 'Blast Furnace', notes: 'Ordan (Best source)' },
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Asgarnia', 'Karamja', 'Kharidian Desert', 'Fremennik', 'Tirannwn'], skills: { 'Mining': 40 }, notes: 'Crafting Guild / Brimhaven / Arzinian / TzHaar' },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75} }
  ],
  'Calcified Deposit': [
    { type: 'SKILL', name: 'Calcified Rocks', regions: ['Varlamore'], skills: {'Mining': 41}, notes: 'Cam Torum' }
  ],
  'Volcanic Sulphur': [
    { type: 'SKILL', name: 'Mining', regions: ['Kourend & Kebos'], skills: {'Mining': 42}, notes: 'Lovakengj Sulphur Mine' }
  ],
  'Granite': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Kharidian Desert'], skills: {'Mining': 45}, notes: 'Quarry' }
  ],
  'Mithril Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Karamja', 'Fremennik', 'Wilderness'], skills: {'Mining': 55}, notes: 'Mining Guild / Motherlode' },
    { type: 'SHOP', name: 'Blast Furnace Shop', regions: ['Fremennik'] },
    { type: 'MINIGAME', name: 'Zalcano', regions: ['Tirannwn'], unlockId: 'Zalcano', outputYield: 20 }
  ],
  'Daeyalt Essence': [
    { type: 'SKILL', name: 'Mining', regions: ['Morytania'], skills: {'Mining': 60}, quests: ['Sins of the Father'], notes: 'Darkmeyer' }
  ],
  'Lovakite Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Kourend & Kebos'], skills: {'Mining': 65}, notes: 'Lovakengj Mine' }
  ],
  'Adamantite Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Karamja', 'Wilderness', 'Tirannwn', 'Fremennik'], skills: {'Mining': 70}, notes: 'Mining Guild / Motherlode' },
    { type: 'MINIGAME', name: 'Zalcano', regions: ['Tirannwn'], unlockId: 'Zalcano', outputYield: 15 },
    { type: 'DROP', name: 'Aviansie', regions: ['Fremennik'], skills: {'Agility': 70}, notes: 'Noted (Fremennik Hard)' },
    { type: 'DROP', name: 'Skeletal Wyvern', regions: ['Asgarnia'], skills: {'Slayer': 72} }
  ],
  'Runite Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Wilderness', 'Asgarnia', 'Misthalin', 'Tirannwn', 'Fremennik'], skills: { 'Mining': 85 }, notes: 'Heroes Guild / Wildy / Myths Guild' },
    { type: 'DROP', name: 'Crystal Geode', regions: ['Tirannwn'], skills: {'Woodcutting': 1}, notes: 'Rare from chopping crystal trees' },
    { type: 'DROP', name: 'Wyrm', regions: ['Kourend & Kebos'], skills: {'Slayer': 62} },
    { type: 'MINIGAME', name: 'Zalcano', regions: ['Tirannwn'], unlockId: 'Zalcano', outputYield: 2 },
    { type: 'DROP', name: 'Rune Dragon', regions: ['Kandarin', 'Fremennik'], quests: ['Dragon Slayer II'] }
  ],
  'Amethyst': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Asgarnia'], skills: {'Mining': 92}, notes: 'Mining Guild' }
  ],
  'Pure Essence': [
    { type: 'SKILL', name: 'Mining', regions: ['Misthalin'], quests: ['Rune Mysteries'], notes: 'Rune Essence Mine' },
    { type: 'DROP', name: 'Twisted Banshee', regions: ['Kourend & Kebos'], skills: {'Slayer': 15}, notes: 'Catacombs (Noted)', outputYield: 13 },
    { type: 'DROP', name: 'Skeletal Wyvern', regions: ['Asgarnia'], skills: {'Slayer': 72}, notes: 'Asgarnian Ice Dungeon (Noted)', outputYield: 250 },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', notes: 'Boss Drop (Noted)', outputYield: 1500 },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75}, notes: 'Slayer Tower', outputYield: 150 },
    { type: 'DROP', name: 'Abyssal Demon', regions: ['Morytania', 'Kourend & Kebos', 'Misthalin'], skills: {'Slayer': 85}, notes: 'Slayer Tower / Catacombs / Abyssal Area', outputYield: 60 }
  ],

  // --- PICKAXES ---
  'Iron Pickaxe': [
    { type: 'SHOP', name: 'Nurmof\'s Pickaxe Shop', regions: ['Asgarnia'], notes: 'Dwarven Mine' }
  ],
  'Steel Pickaxe': [
    { type: 'SHOP', name: 'Nurmof\'s Pickaxe Shop', regions: ['Asgarnia'], notes: 'Dwarven Mine' }
  ],
  'Black Pickaxe': [
    { type: 'MINIGAME', name: 'Clue Scroll (Easy)', regions: ['Any'], notes: 'Easy Clue Reward' },
    { type: 'SHOP', name: 'Pickaxe Shop', regions: ['Wilderness'], notes: 'Deep Wilderness (Level 50)' }
  ],
  'Mithril Pickaxe': [
    { type: 'SHOP', name: 'Nurmof\'s Pickaxe Shop', regions: ['Asgarnia'], notes: 'Dwarven Mine' },
    { type: 'DROP', name: 'Blue Dragon', regions: ['Asgarnia', 'Kandarin'] }
  ],
  'Adamant Pickaxe': [
    { type: 'SHOP', name: 'Nurmof\'s Pickaxe Shop', regions: ['Asgarnia'], notes: 'Dwarven Mine' },
    { type: 'DROP', name: 'Wyrm', regions: ['Kourend & Kebos'], skills: {'Slayer': 62} }
  ],
  'Rune Pickaxe': [
    { type: 'SHOP', name: 'Lliann\'s Wares', regions: ['Tirannwn'], quests: ['Song of the Elves'], notes: 'Prifddinas' },
    { type: 'MINIGAME', name: 'Zalcano', regions: ['Tirannwn'], unlockId: 'Zalcano' },
    { type: 'DROP', name: 'Callisto', regions: ['Wilderness'], unlockId: 'Callisto' },
    { type: 'DROP', name: 'Venenatis', regions: ['Wilderness'], unlockId: 'Venenatis' },
    { type: 'DROP', name: 'Vet\'ion', regions: ['Wilderness'], unlockId: 'Vet\'ion' },
    { type: 'DROP', name: 'Chaos Elemental', regions: ['Wilderness'], unlockId: 'Chaos Elemental' },
    { type: 'DROP', name: 'Scorpia', regions: ['Wilderness'], unlockId: 'Scorpia' }
  ],
  'Dragon Pickaxe': [
    { type: 'DROP', name: 'Chaos Elemental', regions: ['Wilderness'], unlockId: 'Chaos Elemental', notes: 'Safe spottable' },
    { type: 'DROP', name: 'King Black Dragon', regions: ['Wilderness'], unlockId: 'King Black Dragon' },
    { type: 'DROP', name: 'Kalphite Queen', regions: ['Kharidian Desert'], unlockId: 'Kalphite Queen' },
    { type: 'MINIGAME', name: 'Volcanic Mine', regions: ['Islands & Others'], unlockId: 'Volcanic Mine', notes: 'Broken pickaxe from Ore Pack' }
  ],
  'Crystal Pickaxe': [
    { type: 'SKILL', name: 'Singing Bowl', regions: ['Tirannwn'], inputs: {'Crystal Tool Seed': 1, 'Dragon Pickaxe': 1, 'Crystal Shard': 120}, skills: {'Smithing': 76, 'Crafting': 76} }
  ],
  'Infernal Pickaxe': [
    { type: 'SKILL', name: 'Fusion', regions: ['Any'], inputs: {'Smouldering Stone': 1, 'Dragon Pickaxe': 1}, skills: {'Smithing': 85} }
  ],

  // --- BARS & SMITHING ---
  'Bronze Bar': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: {'Smithing': 1}, inputs: {'Copper Ore': 1, 'Tin Ore': 1} }
  ],
  'Iron Bar': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: {'Smithing': 15}, inputs: {'Iron Ore': 1} }
  ],
  'Steel Bar': [
    { type: 'SKILL', name: 'Blast Furnace', regions: ['Fremennik'], skills: {'Smithing': 30}, inputs: {'Iron Ore': 1, 'Coal': 1}, notes: 'Requires 1 Coal at BF, 2 elsewhere' },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75} },
    { type: 'MINIGAME', name: 'Zalcano', regions: ['Tirannwn'], unlockId: 'Zalcano', outputYield: 15 }
  ],
  'Gold Bar': [
    { type: 'SKILL', name: 'Blast Furnace', regions: ['Fremennik'], skills: {'Smithing': 40}, inputs: {'Gold Ore': 1}, notes: 'Instant with Goldsmith Gauntlets' },
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: {'Smithing': 40}, inputs: {'Gold Ore': 1} },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75} },
    { type: 'DROP', name: 'Spiritual Mage', regions: ['Fremennik', 'Wilderness'], skills: {'Slayer': 83} },
    { type: 'MINIGAME', name: 'Zalcano', regions: ['Tirannwn'], unlockId: 'Zalcano', outputYield: 15 }
  ],
  'Mithril Bar': [
    { type: 'SKILL', name: 'Blast Furnace', regions: ['Fremennik'], skills: {'Smithing': 50}, inputs: {'Mithril Ore': 1, 'Coal': 2}, notes: 'Requires 2 Coal at BF' },
    { type: 'DROP', name: 'Mithril Dragon', regions: ['Kandarin'], notes: 'Ancient Cavern' },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75} }
  ],
  'Adamantite Bar': [
    { type: 'SKILL', name: 'Blast Furnace', regions: ['Fremennik'], skills: {'Smithing': 70}, inputs: {'Adamantite Ore': 1, 'Coal': 3}, notes: 'Requires 3 Coal at BF' },
    { type: 'DROP', name: 'Aviansie', regions: ['Fremennik'], skills: {'Agility': 70} },
    { type: 'DROP', name: 'Rune Dragon', regions: ['Kandarin'], quests: ['Dragon Slayer II'] }
  ],
  'Rune Bar': [
    { type: 'SKILL', name: 'Blast Furnace', regions: ['Fremennik'], skills: {'Smithing': 85}, inputs: {'Runite Ore': 1, 'Coal': 4}, notes: 'Requires 4 Coal at BF' },
    { type: 'DROP', name: 'Magpie Impling', regions: ['Any'], skills: {'Hunter': 65} },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath' },
    { type: 'DROP', name: 'Rune Dragon', regions: ['Kandarin'], quests: ['Dragon Slayer II'] },
    { type: 'DROP', name: 'Nechryael', regions: ['Morytania', 'Kourend & Kebos'], skills: {'Slayer': 80} }
  ],
  'Blurite Bar': [
    { type: 'SKILL', name: 'Furnace', regions: ['Asgarnia'], skills: {'Smithing': 13}, inputs: {'Blurite Ore': 1}, quests: ['The Knight\'s Sword'] }
  ],
  'Elemental Bar': [
    { type: 'SKILL', name: 'Elemental Furnace', regions: ['Kandarin'], skills: {'Smithing': 20}, inputs: {'Elemental Ore': 1, 'Coal': 4}, quests: ['Elemental Workshop I'], notes: 'Seers Village' }
  ],
  'Elemental Ore': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Kandarin'], skills: {'Mining': 20}, quests: ['Elemental Workshop I'], notes: 'Elemental Workshop' }
  ],
  'Lovakite Bar': [
    { type: 'SKILL', name: 'Furnace', regions: ['Kourend & Kebos'], skills: {'Smithing': 45}, inputs: {'Lovakite Ore': 1, 'Coal': 2}, notes: 'Lovakengj Furnace' }
  ],
  'Cannonball': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: {'Smithing': 35}, inputs: {'Steel Bar': 1, 'Ammo Mould': 0}, notes: '4 per bar', outputYield: 4 },
    { type: 'DROP', name: 'Corporeal Beast', regions: ['Wilderness'], unlockId: 'Corporeal Beast', notes: '2000 Noted', outputYield: 2000 }
  ],
  'Hammer': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'], notes: 'Basic tool' },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Any'], notes: 'Smithing areas' }
  ],
  'Ammo Mould': [
    { type: 'SHOP', name: 'Nulodion', regions: ['Asgarnia'], quests: ['Dwarf Cannon'], notes: 'Ice Mountain' }
  ],
  'Bar Mould': [
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Asgarnia'], notes: 'Crafting Guild / Shops' }
  ],
  'Goldsmith Gauntlets': [
    { type: 'QUEST', name: 'Family Crest', regions: ['Asgarnia', 'Kandarin', 'Misthalin', 'Kharidian Desert'], notes: 'Quest Reward' }
  ],
  'Ice Gloves': [
    { type: 'DROP', name: 'Ice Queen', regions: ['Asgarnia'], notes: 'White Wolf Mountain' }
  ],
  'Smithing Catalyst': [
    { type: 'MINIGAME', name: 'Giants\' Foundry', regions: ['Kourend & Kebos'], notes: 'Reward Shop' }
  ],
  'Imcando Hammer': [
    { type: 'MINIGAME', name: 'Camdozaal', regions: ['Asgarnia'], skills: {'Mining': 14, 'Smithing': 14}, quests: ['Below Ice Mountain'], notes: 'Barronite Deposits' }
  ],

  // --- FISHING & FOOD ---
  'Raw Shrimps': [
    { type: 'SKILL', name: 'Net Fishing', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Karamja', 'Kourend & Kebos', 'Fremennik', 'Tirannwn', 'Wilderness'], skills: {'Fishing': 1} }
  ],
  'Raw Sardine': [
    { type: 'SKILL', name: 'Bait Fishing', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Karamja', 'Wilderness'], skills: {'Fishing': 5}, inputs: {'Fishing Bait': 1} }
  ],
  'Raw Herring': [
    { type: 'SKILL', name: 'Bait Fishing', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Karamja', 'Wilderness'], skills: {'Fishing': 10}, inputs: {'Fishing Bait': 1} }
  ],
  'Raw Anchovies': [
    { type: 'SKILL', name: 'Net Fishing', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Karamja', 'Wilderness'], skills: {'Fishing': 15} }
  ],
  'Raw Trout': [
    { type: 'SKILL', name: 'Fly Fishing', regions: ['Misthalin', 'Kandarin', 'Fremennik', 'Kourend & Kebos'], skills: {'Fishing': 20}, inputs: {'Feather': 1} }
  ],
  'Raw Pike': [
    { type: 'SKILL', name: 'Bait Fishing', regions: ['Misthalin', 'Kandarin', 'Asgarnia'], skills: {'Fishing': 25}, inputs: {'Fishing Bait': 1} }
  ],
  'Raw Slimy Eel': [
    { type: 'SKILL', name: 'Bait Fishing', regions: ['Misthalin'], skills: {'Fishing': 28}, inputs: {'Fishing Bait': 1}, notes: 'Lumbridge Swamp Caves' }
  ],
  'Raw Salmon': [
    { type: 'SKILL', name: 'Fly Fishing', regions: ['Misthalin', 'Kandarin', 'Fremennik', 'Kourend & Kebos'], skills: {'Fishing': 30}, inputs: {'Feather': 1} }
  ],
  'Raw Tuna': [
    { type: 'SKILL', name: 'Harpoon/Cage Fishing', regions: ['Karamja', 'Kandarin', 'Wilderness', 'Kourend & Kebos', 'Fremennik', 'Misthalin'], skills: {'Fishing': 35} }
  ],
  'Raw Cave Eel': [
    { type: 'SKILL', name: 'Bait Fishing', regions: ['Misthalin'], skills: {'Fishing': 38}, inputs: {'Fishing Bait': 1}, notes: 'Lumbridge Swamp Caves' }
  ],
  'Raw Lobster': [
    { type: 'SKILL', name: 'Cage Fishing', regions: ['Karamja', 'Kandarin', 'Wilderness', 'Kourend & Kebos', 'Fremennik', 'Misthalin'], skills: {'Fishing': 40} }
  ],
  'Raw Bass': [
    { type: 'SKILL', name: 'Big Net Fishing', regions: ['Kandarin', 'Kourend & Kebos', 'Fremennik'], skills: {'Fishing': 46} }
  ],
  'Raw Swordfish': [
    { type: 'SKILL', name: 'Harpoon Fishing', regions: ['Karamja', 'Kandarin', 'Wilderness', 'Kourend & Kebos', 'Fremennik', 'Misthalin'], skills: {'Fishing': 50} }
  ],
  'Raw Lava Eel': [
    { type: 'SKILL', name: 'Oily Rod Fishing', regions: ['Misthalin', 'Wilderness'], skills: {'Fishing': 53}, inputs: {'Fishing Bait': 1}, quests: ['Heroes\' Quest'] }
  ],
  'Raw Monkfish': [
    { type: 'SKILL', name: 'Net Fishing', regions: ['Kandarin'], skills: {'Fishing': 62}, quests: ['Swan Song'], notes: 'Piscatoris' }
  ],
  'Raw Karambwan': [
    { type: 'SKILL', name: 'Karambwan Vessel', regions: ['Karamja'], skills: {'Fishing': 65}, quests: ['Tai Bwo Wannai Trio'], inputs: {'Raw Karambwanji': 1} }
  ],
  'Raw Shark': [
    { type: 'SKILL', name: 'Harpoon Fishing', regions: ['Kandarin', 'Fremennik', 'Kourend & Kebos'], skills: {'Fishing': 76}, notes: 'Fishing Guild / Catherby' },
    { type: 'MINIGAME', name: 'Temple Trekking', regions: ['Morytania'], notes: 'Reward Token (Hard)' },
    { type: 'DROP', name: 'Kraken', regions: ['Kandarin'], unlockId: 'Kraken', skills: {'Slayer': 87} },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', outputYield: 100 }
  ],
  'Raw Sea Turtle': [
    { type: 'MINIGAME', name: 'Fishing Trawler', regions: ['Kandarin'], skills: {'Fishing': 79} },
    { type: 'DROP', name: 'Mithril Dragon', regions: ['Kandarin'], notes: 'Ancient Cavern' }
  ],
  'Infernal Eel': [
    { type: 'SKILL', name: 'Oily Rod Fishing', regions: ['Karamja'], skills: {'Fishing': 80}, inputs: {'Fishing Bait': 1}, notes: 'Mor Ul Rek (Requires Fire Cape)' }
  ],
  'Raw Manta Ray': [
    { type: 'MINIGAME', name: 'Fishing Trawler', regions: ['Kandarin'], skills: {'Fishing': 81} },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath', outputYield: 2 },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', outputYield: 35 }
  ],
  'Minnow': [
    { type: 'SKILL', name: 'Net Fishing', regions: ['Kandarin'], skills: {'Fishing': 82}, notes: 'Fishing Guild Platform' }
  ],
  'Raw Anglerfish': [
    { type: 'SKILL', name: 'Rod Fishing', regions: ['Kourend & Kebos'], skills: {'Fishing': 82}, inputs: {'Sandworms': 1}, notes: 'Piscarilius' }
  ],
  'Raw Dark Crab': [
    { type: 'SKILL', name: 'Cage Fishing', regions: ['Wilderness'], skills: {'Fishing': 85}, inputs: {'Dark Fishing Bait': 1}, notes: 'Resource Area' }
  ],
  'Sacred Eel': [
    { type: 'SKILL', name: 'Rod Fishing', regions: ['Tirannwn'], skills: {'Fishing': 87}, inputs: {'Fishing Bait': 1}, quests: ['Regicide'], notes: 'Zul-Andra' }
  ],

  // --- FISHING SUPPLIES ---
  'Small Fishing Net': [
    { type: 'SHOP', name: 'Fishing Shop', regions: ['Misthalin', 'Kandarin', 'Karamja', 'Fremennik'] },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Misthalin'], notes: 'Lumbridge Swamp' }
  ],
  'Big Fishing Net': [
    { type: 'SHOP', name: 'Fishing Shop', regions: ['Kandarin'], notes: 'Catherby / Fishing Guild' },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Kandarin'], notes: 'Fishing Guild' }
  ],
  'Fishing Rod': [
    { type: 'SHOP', name: 'Fishing Shop', regions: ['Misthalin', 'Kandarin', 'Karamja', 'Fremennik'] }
  ],
  'Fly Fishing Rod': [
    { type: 'SHOP', name: 'Fishing Shop', regions: ['Misthalin', 'Kandarin', 'Karamja', 'Fremennik'] }
  ],
  'Harpoon': [
    { type: 'SHOP', name: 'Fishing Shop', regions: ['Kandarin', 'Karamja', 'Fremennik'], notes: 'Catherby / Port Sarim' },
    { type: 'DROP', name: 'Wyrm', regions: ['Kourend & Kebos'], skills: {'Slayer': 62} }
  ],
  'Lobster Pot': [
    { type: 'SHOP', name: 'Fishing Shop', regions: ['Kandarin', 'Karamja', 'Fremennik'], notes: 'Catherby / Port Sarim' }
  ],
  'Karambwan Vessel': [
    { type: 'SHOP', name: 'Tiadeche\'s Karambwan Stall', regions: ['Karamja'], quests: ['Tai Bwo Wannai Trio'] }
  ],
  'Oily Fishing Rod': [
    { type: 'SKILL', name: 'Use Blamish Oil on Fly Rod', regions: ['Any'], quests: ['Heroes\' Quest'] }
  ],
  'Barbarian Rod': [
    { type: 'SKILL', name: 'Search Bed', regions: ['Kandarin'], notes: 'Otto\'s Grotto', skills: {'Fishing': 48, 'Strength': 15, 'Agility': 15} }
  ],
  'Pearl Fishing Rod': [
    { type: 'MINIGAME', name: 'Aerial Fishing', regions: ['Kourend & Kebos'], notes: 'Molch Island (Purchase with Pearls)' }
  ],
  'Fishing Bait': [
    { type: 'SHOP', name: 'Fishing Shop', regions: ['Any'] },
    { type: 'DROP', name: 'Zombie', regions: ['Any'] }
  ],
  'Feather': [
    { type: 'SHOP', name: 'Fishing Shop', regions: ['Any'] },
    { type: 'DROP', name: 'Chicken', regions: ['Any'] }
  ],
  'Sandworms': [
    { type: 'SKILL', name: 'Digging', regions: ['Kourend & Kebos'], notes: 'Piscarilius Sands', skills: {'Hunter': 15} },
    { type: 'SHOP', name: 'Fishmonger', regions: ['Kourend & Kebos'], notes: 'Piscarilius (Warren)' }
  ],
  'Dark Fishing Bait': [
    { type: 'DROP', name: 'Ankou', regions: ['Wilderness', 'Kourend & Kebos', 'Misthalin'] },
    { type: 'DROP', name: 'Zombie', regions: ['Wilderness', 'Kandarin'] }
  ],
  'Raw Karambwanji': [
    { type: 'SKILL', name: 'Net Fishing', regions: ['Karamja'], skills: {'Fishing': 5}, notes: 'Tai Bwo Wannai Lake' }
  ],
  
  // --- RUNES ---
  'Air Rune': [
    { type: 'SHOP', name: 'Magic Shop', regions: ['Misthalin', 'Kandarin', 'Wilderness'], notes: 'Aubury / Betty / Lundail' }
  ],
  'Water Rune': [
    { type: 'SHOP', name: 'Magic Shop', regions: ['Misthalin', 'Kandarin', 'Wilderness'], notes: 'Aubury / Betty / Lundail' }
  ],
  'Earth Rune': [
    { type: 'SHOP', name: 'Magic Shop', regions: ['Misthalin', 'Kandarin', 'Wilderness'], notes: 'Aubury / Betty / Lundail' }
  ],
  'Fire Rune': [
    { type: 'SHOP', name: 'Magic Shop', regions: ['Misthalin', 'Kandarin', 'Wilderness'], notes: 'Aubury / Betty / Lundail' },
    { type: 'DROP', name: 'Fire Giant', regions: ['Kandarin', 'Wilderness', 'Kourend & Kebos'], notes: 'Common drop' }
  ],
  'Mind Rune': [
    { type: 'SHOP', name: 'Magic Shop', regions: ['Misthalin', 'Kandarin', 'Wilderness'], notes: 'Aubury / Betty / Lundail' }
  ],
  'Chaos Rune': [
    { type: 'SHOP', name: 'Magic Shop', regions: ['Kandarin', 'Wilderness'], notes: 'Wizards Guild / Lundail' },
    { type: 'MINIGAME', name: 'Barrows Chest', regions: ['Morytania'] },
    { type: 'DROP', name: 'Greater Demon', regions: ['Kourend & Kebos', 'Wilderness', 'Kandarin'] },
    { type: 'DROP', name: 'Moss Giant', regions: ['Any'], notes: 'Common drop' }
  ],
  'Nature Rune': [
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Karamja'], skills: { 'Runecraft': 44 }, notes: 'Nature Altar' },
    { type: 'DROP', name: 'Moss Giant', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Karamja', 'Wilderness', 'Kourend & Kebos', 'Fremennik', 'Varlamore', 'The Open Seas', 'Islands & Others'] },
    { type: 'SHOP', name: 'Mage Arena Shop', regions: ['Wilderness'], notes: 'Lundail' },
    { type: 'SHOP', name: 'Magic Guild Store', regions: ['Kandarin'], skills: {'Magic': 66} },
    { type: 'DROP', name: 'Kurask', regions: ['Fremennik', 'Tirannwn'], skills: {'Slayer': 70} },
    { type: 'DROP', name: 'Basilisk', regions: ['Fremennik'], skills: {'Slayer': 40} }
  ],
  'Law Rune': [
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Asgarnia'], skills: { 'Runecraft': 54 }, notes: 'Entrana (No weapons allowed)' },
    { type: 'SHOP', name: 'Mage Arena Shop', regions: ['Wilderness'], notes: 'Lundail' },
    { type: 'DROP', name: 'Hill Giant', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Kourend & Kebos', 'Wilderness', 'Kharidian Desert', 'Varlamore'] },
    { type: 'DROP', name: 'Cockatrice', regions: ['Fremennik'], skills: {'Slayer': 25} }
  ],
  'Cosmic Rune': [
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Misthalin'], skills: { 'Runecraft': 27 }, notes: 'Zanaris (Lost City)' },
    { type: 'SHOP', name: 'Mage Arena Shop', regions: ['Wilderness'], notes: 'Lundail' },
    { type: 'SHOP', name: 'Ali\'s Discount Wares', regions: ['Kharidian Desert', 'Misthalin'], quests: ['The Feud'], notes: 'Pollnivneach' }
  ],
  'Blood Rune': [
    { type: 'SKILL', name: 'True Blood Altar', regions: ['Morytania'], skills: { 'Runecraft': 77 }, quests: ['Sins of the Father'] },
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Kourend & Kebos'], skills: { 'Runecraft': 77, 'Mining': 38, 'Crafting': 38 }, notes: 'Arceuus (Zeah)' },
    { type: 'SHOP', name: 'Mage Arena Shop', regions: ['Wilderness'], notes: 'Lundail' },
    { type: 'DROP', name: 'Bloodveld', regions: ['Morytania', 'Kandarin', 'Kourend & Kebos'], skills: {'Slayer': 50} },
    { type: 'MINIGAME', name: 'Barrows Chest', regions: ['Morytania'], unlockId: 'Barrows Brothers' }
  ],
  'Soul Rune': [
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Kourend & Kebos'], skills: { 'Runecraft': 90 }, notes: 'Arceuus (Zeah)' },
    { type: 'SHOP', name: 'Mage Arena Shop', regions: ['Wilderness'], notes: 'Lundail' },
    { type: 'DROP', name: 'Spiritual Mage', regions: ['Fremennik', 'Wilderness'], skills: {'Slayer': 83} },
    { type: 'DROP', name: 'Cerberus', regions: ['Asgarnia'], skills: {'Slayer': 91}, unlockId: 'Cerberus' },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath' }
  ],
  'Death Rune': [
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Misthalin', 'Tirannwn'], skills: {'Runecraft': 65}, quests: ['Mourning\'s End Part II'] },
    { type: 'SHOP', name: 'Magic Guild Store', regions: ['Kandarin'], skills: {'Magic': 66} },
    { type: 'DROP', name: 'Nechryael', regions: ['Morytania', 'Kourend & Kebos'], skills: {'Slayer': 80} },
    { type: 'DROP', name: 'Ankou', regions: ['Misthalin', 'Kourend & Kebos', 'Wilderness'] },
    { type: 'MINIGAME', name: 'Barrows Chest', regions: ['Morytania'], unlockId: 'Barrows Brothers' }
  ],
  'Astral Rune': [
    { type: 'SHOP', name: 'Baba Yaga', regions: ['Fremennik'], quests: ['Lunar Diplomacy'] },
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Fremennik'], skills: {'Runecraft': 40}, quests: ['Lunar Diplomacy'], notes: 'Lunar Isle' }
  ],

  // --- GEAR & BONES ---
  'Dragon Bones': [
    { type: 'DROP', name: 'Green Dragon', regions: ['Wilderness'], notes: 'Wilderness (various locations)' },
    { type: 'DROP', name: 'Green Dragon', regions: ['Kandarin', 'Wilderness'], quests: ['Dragon Slayer II'], notes: 'Myths\' Guild' },
    { type: 'DROP', name: 'Blue Dragon', regions: ['Asgarnia'], notes: 'Taverley Dungeon / Heroes Guild' },
    { type: 'DROP', name: 'Blue Dragon', regions: ['Kandarin'], notes: 'Ogre Enclave' },
    { type: 'DROP', name: 'Red Dragon', regions: ['Karamja'], notes: 'Brimhaven Dungeon' },
    { type: 'DROP', name: 'Red Dragon', regions: ['Kourend & Kebos'], notes: 'Forthos Dungeon' },
    { type: 'DROP', name: 'Black Dragon', regions: ['Asgarnia', 'Tirannwn'], notes: 'Taverley Dungeon' },
    { type: 'DROP', name: 'Black Dragon', regions: ['Kandarin', 'Tirannwn'], quests: ['Dragon Slayer II'], notes: 'Myths\' Guild' },
    { type: 'DROP', name: 'Black Dragon', regions: ['Kourend & Kebos', 'Tirannwn'], notes: 'Catacombs' },
    { type: 'DROP', name: 'King Black Dragon', regions: ['Wilderness'], unlockId: 'King Black Dragon' },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath', notes: 'Superior Dragon Bones' }
  ],
  'Wyvern Bones': [
    { type: 'DROP', name: 'Skeletal Wyvern', regions: ['Asgarnia'], skills: {'Slayer': 72}, notes: 'Asgarnian Ice Dungeon' },
    { type: 'DROP', name: 'Ancient Wyvern', regions: ['Islands & Others'], skills: {'Slayer': 82}, notes: 'Fossil Island' }
  ],
  'Abyssal Whip': [
    { type: 'DROP', name: 'Abyssal Demon', regions: ['Morytania', 'Kourend & Kebos', 'Misthalin'], skills: {'Slayer': 85}, notes: 'Slayer Tower / Catacombs / Abyssal Area' }
  ],
  'Dark Bow': [
    { type: 'DROP', name: 'Dark Beast', regions: ['Tirannwn', 'Misthalin'], skills: {'Slayer': 90}, notes: 'Mourner Tunnels / Isle of Souls' }
  ],
  'Black Mask': [
    { type: 'DROP', name: 'Cave Horror', regions: ['Islands & Others'], skills: { 'Slayer': 58 }, quests: ['Cabin Fever'], notes: 'Mos Le\'Harmless Caves' }
  ],
  'Trident of the Seas': [
    { type: 'DROP', name: 'Cave Kraken', regions: ['Kandarin'], skills: {'Slayer': 87}, notes: 'Kraken Cove (Small)' },
    { type: 'DROP', name: 'Kraken', regions: ['Kandarin'], skills: {'Slayer': 87}, unlockId: 'Kraken', notes: 'Boss Drop (Full)' }
  ],
  'Occult Necklace': [
    { type: 'DROP', name: 'Smoke Devil', regions: ['Kandarin'], skills: {'Slayer': 93}, notes: 'Smoke Devil Dungeon' },
    { type: 'DROP', name: 'Thermonuclear Smoke Devil', regions: ['Kandarin'], skills: {'Slayer': 93}, unlockId: 'Thermonuclear Smoke Devil' }
  ],
  'Granite Maul': [
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75}, notes: 'Slayer Tower' }
  ],
  'Leaf-Bladed Sword': [
    { type: 'DROP', name: 'Kurask', regions: ['Fremennik', 'Tirannwn'], skills: {'Slayer': 70} },
    { type: 'DROP', name: 'Turoth', regions: ['Fremennik'], skills: {'Slayer': 55} }
  ],
  'Leaf-Bladed Battleaxe': [
    { type: 'DROP', name: 'Kurask', regions: ['Fremennik', 'Tirannwn'], skills: {'Slayer': 70} }
  ],
  'Dragon Boots': [
    { type: 'DROP', name: 'Spiritual Mage', regions: ['Fremennik', 'Wilderness'], skills: {'Slayer': 83}, notes: 'God Wars Dungeon' }
  ],
  'Rune Scimitar': [
    { type: 'DROP', name: 'Fire Giant', regions: ['Kandarin', 'Wilderness', 'Kourend & Kebos'], notes: 'Waterfall / Deep Wildy / Catacombs' },
    { type: 'DROP', name: 'Zamorak Warrior', regions: ['Morytania', 'Kandarin'], notes: 'ZMI / GWD' },
    { type: 'SKILL', name: 'Smithing', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Kourend & Kebos', 'Wilderness', 'Fremennik'], skills: {'Smithing': 90}, inputs: {'Rune Bar': 2}, notes: 'Requires 2 Bars + Anvil' },
    { type: 'SHOP', name: 'Daga\'s Scimitar Smithy', regions: ['Islands & Others'], notes: 'Ape Atoll' }
  ],
  'Dragon Scimitar': [
    { type: 'SHOP', name: 'Daga\'s Scimitar Smithy', regions: ['Islands & Others'], quests: ['Monkey Madness I'], notes: 'Ape Atoll' }
  ],
  'Rune Crossbow': [
    { type: 'DROP', name: 'Crazy Archaeologist', regions: ['Wilderness'], unlockId: 'Crazy Archaeologist' },
    { type: 'DROP', name: 'Deranged Archaeologist', regions: ['Islands & Others'], unlockId: 'Deranged Archaeologist' },
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: {'Fletching': 69}, inputs: {'Runite Limbs': 1, 'Yew Stock': 1, 'Crossbow String': 1}, notes: 'Assembly' },
    { type: 'DROP', name: 'Iron Dragon', regions: ['Karamja', 'Kourend & Kebos'] }
  ],
  'Runite Limbs': [
    { type: 'DROP', name: 'Iron Dragon', regions: ['Karamja', 'Kourend & Kebos'] },
    { type: 'DROP', name: 'Steel Dragon', regions: ['Karamja', 'Kourend & Kebos'] },
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: {'Smithing': 91}, inputs: {'Rune Bar': 1} },
    { type: 'DROP', name: 'Aviansie', regions: ['Fremennik'], skills: {'Agility': 70} }
  ],
  'Yew Stock': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: {'Fletching': 69}, inputs: {'Yew Logs': 1, 'Knife': 0} }
  ],
  'Crossbow String': [
    { type: 'SKILL', name: 'Spinning', regions: ['Any'], skills: {'Crafting': 10}, inputs: {'Sinew': 1} },
    { type: 'SKILL', name: 'Spinning', regions: ['Any'], skills: {'Crafting': 10}, inputs: {'Tree Roots': 1} }
  ],
  'Anti-Dragon Shield': [
    { type: 'SHOP', name: 'Oziach', regions: ['Misthalin'], quests: ['Dragon Slayer I'], notes: 'Edgeville' },
    { type: 'SPAWN', name: 'Duke Horacio', regions: ['Misthalin'], notes: 'Lumbridge Castle (Free during quest)' }
  ],
  'Barrows Gloves': [
    { type: 'SHOP', name: 'Culinaromancer\'s Chest', regions: ['Misthalin'], quests: ['Recipe for Disaster'], notes: 'Lumbridge Basement' }
  ],
  'Climbing Boots': [
    { type: 'SHOP', name: 'Tenzing', regions: ['Asgarnia'], quests: ['Death Plateau'], notes: 'Burthorpe' }
  ],
  'Amulet of Glory': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 80, 'Magic': 68}, inputs: {'Dragonstone Amulet': 1, 'Cosmic Rune': 1}, notes: 'Enchant Lvl-5' },
    { type: 'DROP', name: 'Dragon Impling', regions: ['Any'], skills: {'Hunter': 83} }
  ],
  'Dragonstone Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 80}, inputs: {'Gold Bar': 1, 'Dragonstone': 1, 'Amulet Mould': 0, 'Ball of Wool': 1} }
  ],
  'Dragonstone': [
    { type: 'MINIGAME', name: 'Crystal Chest', regions: ['Asgarnia'], notes: 'Reward' },
    { type: 'DROP', name: 'Rune Dragon', regions: ['Kandarin', 'Fremennik'], quests: ['Dragon Slayer II'] },
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 55}, inputs: {'Uncut Dragonstone': 1, 'Chisel': 0} }
  ],
  'Amulet of Power': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 70, 'Magic': 57}, inputs: {'Diamond Amulet': 1, 'Cosmic Rune': 1}, notes: 'Enchant Lvl-4' },
    { type: 'DROP', name: 'Magpie Impling', regions: ['Any'], skills: {'Hunter': 65} },
    { type: 'SHOP', name: 'Quartermaster', regions: ['Kourend & Kebos'], notes: 'Shayzien (requires favor)' }
  ],
  'Diamond Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 70}, inputs: {'Gold Bar': 1, 'Diamond': 1, 'Amulet Mould': 0, 'Ball of Wool': 1} }
  ],
  'Diamond': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 43}, inputs: {'Uncut Diamond': 1, 'Chisel': 0} }
  ],
  'Uncut Diamond': [
    { type: 'SKILL', name: 'Mining', regions: ['Any'], skills: {'Mining': 40}, notes: 'Gem Rocks' },
    { type: 'DROP', name: 'Monster Drop', regions: ['Any'], notes: 'Rare drop table' }
  ],
  'Zenyte Shard': [
    { type: 'DROP', name: 'Demonic Gorilla', regions: ['Kandarin'], quests: ['Monkey Madness II'], notes: '1/300 Drop — no Slayer level required' }
  ],
  'Uncut Zenyte': [
    { type: 'SKILL', name: 'Fusion', regions: ['Any'], skills: {'Crafting': 89}, inputs: {'Zenyte Shard': 1, 'Uncut Onyx': 1}, notes: 'Fools gold?' }
  ],
  'Uncut Onyx': [
    { type: 'SHOP', name: 'TzHaar-Hur-Lek', regions: ['Karamja'], notes: 'Costs 260k Tokkul' },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'] },
    { type: 'DROP', name: 'Tekton', regions: ['Kourend & Kebos'], notes: 'CoX' }
  ],
  'Zenyte Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 98}, inputs: {'Gold Bar': 1, 'Zenyte': 1, 'Amulet Mould': 0, 'Ball of Wool': 1} }
  ],
  'Zenyte': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: {'Crafting': 89}, inputs: {'Uncut Zenyte': 1, 'Chisel': 0} }
  ],
  'Amulet of Torture': [
    { type: 'SKILL', name: 'Enchanting', regions: ['Any'], skills: {'Magic': 93}, inputs: {'Zenyte Amulet': 1, 'Cosmic Rune': 1, 'Blood Rune': 20} }
  ],
  'Necklace of Anguish': [
    { type: 'SKILL', name: 'Enchanting', regions: ['Any'], skills: {'Magic': 93}, inputs: {'Zenyte Necklace': 1, 'Cosmic Rune': 1, 'Blood Rune': 20} }
  ],
  'Tormented Bracelet': [
    { type: 'SKILL', name: 'Enchanting', regions: ['Any'], skills: {'Magic': 93}, inputs: {'Zenyte Bracelet': 1, 'Cosmic Rune': 1, 'Blood Rune': 20} }
  ],
  'Elysian Spirit Shield': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: {'Prayer': 90, 'Smithing': 85}, inputs: {'Elysian Sigil': 1, 'Blessed Spirit Shield': 1}, notes: 'Requires NPC in Edgeville if skill too low' }
  ],
  'Elysian Sigil': [
    { type: 'DROP', name: 'Corporeal Beast', regions: ['Wilderness'], unlockId: 'Corporeal Beast' }
  ],
  'Blessed Spirit Shield': [
    { type: 'SKILL', name: 'Blessing', regions: ['Any'], skills: {'Prayer': 85}, inputs: {'Spirit Shield': 1, 'Holy Elixir': 1} }
  ],
  'Spirit Shield': [
    { type: 'DROP', name: 'Corporeal Beast', regions: ['Wilderness'] }
  ],
  'Holy Elixir': [
    { type: 'DROP', name: 'Corporeal Beast', regions: ['Wilderness'] }
  ],
  'Godsword Blade': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: {'Smithing': 80}, inputs: {'Godsword Shard 1': 1, 'Godsword Shard 2': 1, 'Godsword Shard 3': 1} }
  ],
  'Armadyl Godsword': [
    { type: 'SKILL', name: 'Assembly', regions: ['Any'], inputs: {'Godsword Blade': 1, 'Armadyl Hilt': 1} }
  ],
  'Armadyl Hilt': [
    { type: 'DROP', name: 'Kree\'arra', regions: ['Fremennik'], unlockId: 'Kree\'arra' }
  ],
  'Bandos Godsword': [
    { type: 'SKILL', name: 'Assembly', regions: ['Any'], inputs: {'Godsword Blade': 1, 'Bandos Hilt': 1} }
  ],
  'Bandos Hilt': [
    { type: 'DROP', name: 'General Graardor', regions: ['Fremennik'], unlockId: 'General Graardor' }
  ],
  'Saradomin Godsword': [
    { type: 'SKILL', name: 'Assembly', regions: ['Any'], inputs: {'Godsword Blade': 1, 'Saradomin Hilt': 1} }
  ],
  'Saradomin Hilt': [
    { type: 'DROP', name: 'Commander Zilyana', regions: ['Fremennik'], unlockId: 'Commander Zilyana' }
  ],
  'Zamorak Godsword': [
    { type: 'SKILL', name: 'Assembly', regions: ['Any'], inputs: {'Godsword Blade': 1, 'Zamorak Hilt': 1} }
  ],
  'Zamorak Hilt': [
    { type: 'DROP', name: 'K\'ril Tsutsaroth', regions: ['Fremennik'], unlockId: 'K\'ril Tsutsaroth' }
  ],

  // --- RAIDS & ENDGAME ---
  'Twisted Bow': [
    { type: 'DROP', name: 'Chambers of Xeric', regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' }
  ],
  'Kodai Wand': [
    { type: 'DROP', name: 'Chambers of Xeric', regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' }
  ],
  'Elder Maul': [
    { type: 'DROP', name: 'Chambers of Xeric', regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' }
  ],
  'Dragon Claws': [
    { type: 'DROP', name: 'Chambers of Xeric', regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' }
  ],
  'Ancestral Robe Top': [
    { type: 'DROP', name: 'Chambers of Xeric', regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' }
  ],
  'Ancestral Robe Bottom': [
    { type: 'DROP', name: 'Chambers of Xeric', regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' }
  ],
  'Ancestral Hat': [
    { type: 'DROP', name: 'Chambers of Xeric', regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' }
  ],
  'Scythe of Vitur': [
    { type: 'DROP', name: 'Theatre of Blood', regions: ['Morytania'], unlockId: 'Theatre of Blood' }
  ],
  'Ghrazi Rapier': [
    { type: 'DROP', name: 'Theatre of Blood', regions: ['Morytania'], unlockId: 'Theatre of Blood' }
  ],
  'Sanguinesti Staff': [
    { type: 'DROP', name: 'Theatre of Blood', regions: ['Morytania'], unlockId: 'Theatre of Blood' }
  ],
  'Justiciar Faceguard': [
    { type: 'DROP', name: 'Theatre of Blood', regions: ['Morytania'], unlockId: 'Theatre of Blood' }
  ],
  'Justiciar Chestguard': [
    { type: 'DROP', name: 'Theatre of Blood', regions: ['Morytania'], unlockId: 'Theatre of Blood' }
  ],
  'Justiciar Legguards': [
    { type: 'DROP', name: 'Theatre of Blood', regions: ['Morytania'], unlockId: 'Theatre of Blood' }
  ],
  'Avernic Defender Hilt': [
    { type: 'DROP', name: 'Theatre of Blood', regions: ['Morytania'], unlockId: 'Theatre of Blood' }
  ],
  'Tumeken\'s Shadow': [
    { type: 'DROP', name: 'Tombs of Amascut', regions: ['Kharidian Desert'], unlockId: 'Tombs of Amascut' }
  ],
  'Osmumten\'s Fang': [
    { type: 'DROP', name: 'Tombs of Amascut', regions: ['Kharidian Desert'], unlockId: 'Tombs of Amascut' }
  ],
  'Masori Body': [
    { type: 'DROP', name: 'Tombs of Amascut', regions: ['Kharidian Desert'], unlockId: 'Tombs of Amascut' }
  ],
  'Masori Chaps': [
    { type: 'DROP', name: 'Tombs of Amascut', regions: ['Kharidian Desert'], unlockId: 'Tombs of Amascut' }
  ],
  'Masori Mask': [
    { type: 'DROP', name: 'Tombs of Amascut', regions: ['Kharidian Desert'], unlockId: 'Tombs of Amascut' }
  ],
  'Elidinis\' Ward': [
    { type: 'DROP', name: 'Tombs of Amascut', regions: ['Kharidian Desert'], unlockId: 'Tombs of Amascut' }
  ],
  'Lightbearer': [
    { type: 'DROP', name: 'Tombs of Amascut', regions: ['Kharidian Desert'], unlockId: 'Tombs of Amascut' }
  ],
  'Zaryte Crossbow': [
    { type: 'DROP', name: 'Nex', regions: ['Fremennik'], unlockId: 'Nex' }
  ],
  'Torva Full Helm': [
    { type: 'DROP', name: 'Nex', regions: ['Fremennik'], unlockId: 'Nex' }
  ],
  'Torva Platebody': [
    { type: 'DROP', name: 'Nex', regions: ['Fremennik'], unlockId: 'Nex' }
  ],
  'Torva Platelegs': [
    { type: 'DROP', name: 'Nex', regions: ['Fremennik'], unlockId: 'Nex' }
  ],
  'Inquisitor\'s Mace': [
    { type: 'DROP', name: 'The Nightmare', regions: ['Morytania'], unlockId: 'The Nightmare' }
  ],
  'Inquisitor\'s Great Helm': [
    { type: 'DROP', name: 'The Nightmare', regions: ['Morytania'], unlockId: 'The Nightmare' }
  ],
  'Inquisitor\'s Hauberk': [
    { type: 'DROP', name: 'The Nightmare', regions: ['Morytania'], unlockId: 'The Nightmare' }
  ],
  'Inquisitor\'s Plateskirt': [
    { type: 'DROP', name: 'The Nightmare', regions: ['Morytania'], unlockId: 'The Nightmare' }
  ],
  'Nightmare Staff': [
    { type: 'DROP', name: 'The Nightmare', regions: ['Morytania'], unlockId: 'The Nightmare' }
  ],
  'Soulreaper Axe': [
    { type: 'SKILL', name: 'Assembly', regions: ['Any'], inputs: {'Leviathan Lure': 1, 'Siren\'s Staff': 1, 'Executioner\'s Axe Head': 1, 'Eye of the Duke': 1} }
  ],
  'Virtus Mask': [
    { type: 'DROP', name: 'Duke Sucellus', regions: ['Fremennik'], unlockId: 'Duke Sucellus' },
    { type: 'DROP', name: 'The Leviathan', regions: ['Morytania'], unlockId: 'The Leviathan' },
    { type: 'DROP', name: 'The Whisperer', regions: ['Fremennik'], unlockId: 'The Whisperer' },
    { type: 'DROP', name: 'Vardorvis', regions: ['Varlamore', 'Kourend & Kebos'], unlockId: 'Vardorvis' }
  ],
  'Virtus Robe Top': [
    { type: 'DROP', name: 'Duke Sucellus', regions: ['Fremennik'], unlockId: 'Duke Sucellus' },
    { type: 'DROP', name: 'The Leviathan', regions: ['Morytania'], unlockId: 'The Leviathan' },
    { type: 'DROP', name: 'The Whisperer', regions: ['Fremennik'], unlockId: 'The Whisperer' },
    { type: 'DROP', name: 'Vardorvis', regions: ['Varlamore', 'Kourend & Kebos'], unlockId: 'Vardorvis' }
  ],
  'Virtus Robe Bottom': [
    { type: 'DROP', name: 'Duke Sucellus', regions: ['Fremennik'], unlockId: 'Duke Sucellus' },
    { type: 'DROP', name: 'The Leviathan', regions: ['Morytania'], unlockId: 'The Leviathan' },
    { type: 'DROP', name: 'The Whisperer', regions: ['Fremennik'], unlockId: 'The Whisperer' },
    { type: 'DROP', name: 'Vardorvis', regions: ['Varlamore', 'Kourend & Kebos'], unlockId: 'Vardorvis' }
  ],
  'Voidwaker': [
    { type: 'SKILL', name: 'Assembly', regions: ['Wilderness'], inputs: {'Voidwaker Blade': 1, 'Voidwaker Hilt': 1, 'Voidwaker Gem': 1} }
  ],
  'Voidwaker Blade': [
    { type: 'DROP', name: 'Vet\'ion', regions: ['Wilderness'], unlockId: 'Vet\'ion' },
    { type: 'DROP', name: 'Calvar\'ion', regions: ['Wilderness'], unlockId: 'Calvar\'ion' }
  ],
  'Voidwaker Hilt': [
    { type: 'DROP', name: 'Callisto', regions: ['Wilderness'], unlockId: 'Callisto' },
    { type: 'DROP', name: 'Artio', regions: ['Wilderness'], unlockId: 'Artio' }
  ],
  'Voidwaker Gem': [
    { type: 'DROP', name: 'Venenatis', regions: ['Wilderness'], unlockId: 'Venenatis' },
    { type: 'DROP', name: 'Spindel', regions: ['Wilderness'], unlockId: 'Spindel' }
  ],
  'Blade of Saeldor': [
    { type: 'MINIGAME', name: 'The Gauntlet', regions: ['Tirannwn'], unlockId: 'The Gauntlet', notes: 'Enhanced Crystal Weapon Seed' }
  ],
  'Bow of Faerdhinen': [
    { type: 'MINIGAME', name: 'The Gauntlet', regions: ['Tirannwn'], unlockId: 'The Gauntlet', notes: 'Enhanced Crystal Weapon Seed' }
  ],
  'Crystal Armour Seed': [
    { type: 'MINIGAME', name: 'The Gauntlet', regions: ['Tirannwn'], unlockId: 'The Gauntlet' }
  ],

  // --- SLAYER & BOSS UNIQUES ---
  'Abyssal Bludgeon': [
    { type: 'SKILL', name: 'Overseer', regions: ['Kourend & Kebos'], inputs: {'Bludgeon Claw': 1, 'Bludgeon Spine': 1, 'Bludgeon Axon': 1}, notes: 'Combine at Overseer' }
  ],
  'Abyssal Dagger': [
    { type: 'DROP', name: 'Abyssal Sire', regions: ['Wilderness'], unlockId: 'Abyssal Sire' }
  ],
  'Primordial Boots': [
    { type: 'SKILL', name: 'Runecrafting', regions: ['Asgarnia'], inputs: {'Primordial Crystal': 1, 'Dragon Boots': 1}, skills: {'Runecraft': 60, 'Magic': 60} }
  ],
  'Pegasian Boots': [
    { type: 'SKILL', name: 'Runecrafting', regions: ['Asgarnia'], inputs: {'Pegasian Crystal': 1, 'Ranger Boots': 1}, skills: {'Runecraft': 60, 'Magic': 60} }
  ],
  'Eternal Boots': [
    { type: 'SKILL', name: 'Runecrafting', regions: ['Asgarnia'], inputs: {'Eternal Crystal': 1, 'Infinity Boots': 1}, skills: {'Runecraft': 60, 'Magic': 60} }
  ],
  'Primordial Crystal': [
    { type: 'DROP', name: 'Cerberus', regions: ['Asgarnia'], unlockId: 'Cerberus' }
  ],
  'Pegasian Crystal': [
    { type: 'DROP', name: 'Cerberus', regions: ['Asgarnia'], unlockId: 'Cerberus' }
  ],
  'Eternal Crystal': [
    { type: 'DROP', name: 'Cerberus', regions: ['Asgarnia'], unlockId: 'Cerberus' }
  ],
  'Ferocious Gloves': [
    { type: 'SKILL', name: 'Lithkren Machine', regions: ['Kourend & Kebos'], inputs: {'Hydra Leather': 1, 'Barrows Gloves': 1}, quests: ['Dragon Slayer II'] }
  ],
  'Hydra Leather': [
    { type: 'DROP', name: 'Alchemical Hydra', regions: ['Kourend & Kebos'], unlockId: 'Alchemical Hydra' }
  ],
  'Hydra\'s Claw': [
    { type: 'DROP', name: 'Alchemical Hydra', regions: ['Kourend & Kebos'], unlockId: 'Alchemical Hydra' }
  ],
  'Dragon Hunter Lance': [
    { type: 'SKILL', name: 'Smithing', regions: ['Kourend & Kebos'], inputs: {'Hydra\'s Claw': 1, 'Zamorakian Hasta': 1} }
  ],
  'Neitiznot Faceguard': [
    { type: 'SKILL', name: 'Crafting', regions: ['Fremennik'], inputs: {'Basilisk Jaw': 1, 'Helm of Neitiznot': 1} }
  ],
  'Basilisk Jaw': [
    { type: 'DROP', name: 'Basilisk Knight', regions: ['Fremennik'], skills: {'Slayer': 60} }
  ],
  'Dragonfire Shield': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: {'Smithing': 90}, inputs: {'Draconic Visage': 1, 'Anti-Dragon Shield': 1}, notes: 'Or pay Oziach 1.25m' }
  ],
  'Dragonfire Ward': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: {'Smithing': 90}, inputs: {'Skeletal Visage': 1, 'Anti-Dragon Shield': 1}, notes: 'Or pay Oziach 1.25m' }
  ],
  'Draconic Visage': [
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath' },
    { type: 'DROP', name: 'King Black Dragon', regions: ['Wilderness'], unlockId: 'King Black Dragon' },
    { type: 'DROP', name: 'Wyvern', regions: ['Islands & Others', 'Asgarnia'] }
  ],
  'Skeletal Visage': [
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath' }
  ],
  'Toxic Blowpipe': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], inputs: {'Tanzanite Fang': 1}, skills: {'Fletching': 53} }
  ],
  'Trident of the Swamp': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], inputs: {'Magic Fang': 1, 'Trident of the Seas': 1}, skills: {'Crafting': 59} }
  ],
  'Serpentine Helm': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], inputs: {'Serpentine Visage': 1}, skills: {'Crafting': 52} }
  ],
  'Magic Fang': [
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah' }
  ],
  'Tanzanite Fang': [
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah' }
  ],
  'Serpentine Visage': [
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah' }
  ],
  
  // --- MINIGAME & SKILLING UNIQUES ---
  'Void Knight Top': [
    { type: 'MINIGAME', name: 'Pest Control', regions: ['Void Knights\' Outpost'], notes: 'Purchase with points' }
  ],
  'Void Knight Robe': [
    { type: 'MINIGAME', name: 'Pest Control', regions: ['Void Knights\' Outpost'], notes: 'Purchase with points' }
  ],
  'Void Knight Gloves': [
    { type: 'MINIGAME', name: 'Pest Control', regions: ['Void Knights\' Outpost'], notes: 'Purchase with points' }
  ],
  'Void Knight Helm': [
    { type: 'MINIGAME', name: 'Pest Control', regions: ['Void Knights\' Outpost'], notes: 'Purchase with points' }
  ],
  'Fighter Torso': [
    { type: 'MINIGAME', name: 'Barbarian Assault', regions: ['Kandarin'], notes: 'Purchase with points' }
  ],
  'Rune Pouch': [
    { type: 'MINIGAME', name: 'LMS Shop', regions: ['Wilderness'], notes: 'Purchase with points' },
    { type: 'MERCHANT', name: 'Slayer Master', regions: ['Any'], notes: 'Purchase with Slayer Points' }
  ],
  'Looting Bag': [
    { type: 'DROP', name: 'Wilderness Monsters', regions: ['Wilderness'], notes: 'Common drop in Wildy' },
    { type: 'MERCHANT', name: 'Slayer Master', regions: ['Any'], notes: 'Purchase with Slayer Points' }
  ],
  'Herb Sack': [
    { type: 'MINIGAME', name: 'Tithe Farm', regions: ['Kourend & Kebos'], notes: 'Purchase with points' },
    { type: 'MERCHANT', name: 'Slayer Master', regions: ['Any'], notes: 'Purchase with Slayer Points' }
  ],
  'Seed Box': [
    { type: 'MINIGAME', name: 'Tithe Farm', regions: ['Kourend & Kebos'], notes: 'Purchase with points' }
  ],
  'Gem Bag': [
    { type: 'MINIGAME', name: 'Motherlode Mine', regions: ['Asgarnia'], notes: 'Purchase with Nuggets' }
  ],
  'Coal Bag': [
    { type: 'MINIGAME', name: 'Motherlode Mine', regions: ['Asgarnia'], notes: 'Purchase with Nuggets' }
  ],
  'Fish Barrel': [
    { type: 'MINIGAME', name: 'Tempoross', regions: ['Kharidian Desert'], unlockId: 'Tempoross' }
  ],
  'Tackle Box': [
    { type: 'MINIGAME', name: 'Tempoross', regions: ['Kharidian Desert'], unlockId: 'Tempoross' }
  ],
  'Log Basket': [
    { type: 'MINIGAME', name: 'Forestry Shop', regions: ['Any'], notes: 'Buy with Anima-Infused Bark' }
  ],
  'Bottomless Compost Bucket': [
    { type: 'DROP', name: 'Hespori', regions: ['Kourend & Kebos'], unlockId: 'Hespori' }
  ],
  'Crystal Axe': [
    { type: 'SKILL', name: 'Singing Bowl', regions: ['Tirannwn'], inputs: {'Crystal Tool Seed': 1, 'Dragon Axe': 1, 'Crystal Shard': 120}, skills: {'Smithing': 76, 'Crafting': 76} }
  ],
  'Crystal Harpoon': [
    { type: 'SKILL', name: 'Singing Bowl', regions: ['Tirannwn'], inputs: {'Crystal Tool Seed': 1, 'Dragon Harpoon': 1, 'Crystal Shard': 120}, skills: {'Smithing': 76, 'Crafting': 76} }
  ],
  'Infernal Axe': [
    { type: 'SKILL', name: 'Fusion', regions: ['Any'], inputs: {'Smouldering Stone': 1, 'Dragon Axe': 1}, skills: {'Smithing': 85} }
  ],
  'Infernal Harpoon': [
    { type: 'SKILL', name: 'Fusion', regions: ['Any'], inputs: {'Smouldering Stone': 1, 'Dragon Harpoon': 1}, skills: {'Smithing': 85} }
  ],
  'Smouldering Stone': [
    { type: 'DROP', name: 'Cerberus', regions: ['Asgarnia'], unlockId: 'Cerberus' },
    { type: 'DROP', name: 'Hellhound', regions: ['Any'], notes: 'Very rare' }
  ],
  'Crystal Tool Seed': [
    { type: 'MINIGAME', name: 'Zalcano', regions: ['Tirannwn'], unlockId: 'Zalcano' },
    { type: 'MINIGAME', name: 'The Gauntlet', regions: ['Tirannwn'], unlockId: 'The Gauntlet' }
  ],

  // --- QUEST ITEMS ---
  'Silverlight': [
    { type: 'QUEST', name: 'Demon Slayer', regions: ['Misthalin'], notes: 'Quest Reward' }
  ],
  'Darklight': [
    { type: 'QUEST', name: 'Shadow of the Storm', regions: ['Kharidian Desert'], notes: 'Quest Reward' }
  ],
  'Arclight': [
    { type: 'SKILL', name: 'Catacombs Altar', regions: ['Kourend & Kebos'], inputs: {'Darklight': 1, 'Ancient Shard': 3} }
  ],
  'Wolfbane': [
    { type: 'QUEST', name: 'Priest in Peril', regions: ['Morytania'], notes: 'Quest Reward' }
  ],
  'Excalibur': [
    { type: 'QUEST', name: 'Merlin\'s Crystal', regions: ['Kandarin'], notes: 'Quest Reward' }
  ],
  'Ancient Mace': [
    { type: 'QUEST', name: 'Another Slice of H.A.M.', regions: ['Misthalin'], notes: 'Quest Reward' }
  ],
  'Barrelchest Anchor': [
    { type: 'QUEST', name: 'The Great Brain Robbery', regions: ['Morytania'], notes: 'Quest Reward' },
    { type: 'MERCHANT', name: 'Perdu', regions: ['Any'], notes: 'Reclaim' }
  ],
  'Keris Partisan': [
    { type: 'QUEST', name: 'Beneath Cursed Sands', regions: ['Kharidian Desert'], notes: 'Quest Reward' }
  ],

  // --- GEMS ---
  'Uncut Sapphire': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Any'], skills: { 'Mining': 1 }, notes: 'Gem rocks / rare from any rock' },
    { type: 'DROP', name: 'Gem Drop Table', regions: ['Any'], rarity: 'Common', notes: 'Shared gem drop table' }
  ],
  'Uncut Emerald': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Any'], skills: { 'Mining': 1 }, notes: 'Gem rocks / rare from any rock' },
    { type: 'DROP', name: 'Gem Drop Table', regions: ['Any'], rarity: 'Uncommon', notes: 'Shared gem drop table' }
  ],
  'Uncut Ruby': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Any'], skills: { 'Mining': 1 }, notes: 'Gem rocks / rare from any rock' },
    { type: 'DROP', name: 'Gem Drop Table', regions: ['Any'], rarity: 'Rare', notes: 'Shared gem drop table' }
  ],
  'Sapphire': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 20 }, inputs: { 'Uncut Sapphire': 1, 'Chisel': 0 } }
  ],
  'Emerald': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 27 }, inputs: { 'Uncut Emerald': 1, 'Chisel': 0 } }
  ],
  'Ruby': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 34 }, inputs: { 'Uncut Ruby': 1, 'Chisel': 0 } }
  ],
  'Opal': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Uncut Opal': 1, 'Chisel': 0 }, notes: 'May crush at low level' }
  ],
  'Uncut Opal': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Karamja', 'Fremennik'], skills: { 'Mining': 40 }, notes: 'Gem rocks (Shilo / Lunar Isle)' }
  ],
  'Red Topaz': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 16 }, inputs: { 'Uncut Red Topaz': 1, 'Chisel': 0 } }
  ],
  'Uncut Red Topaz': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Karamja', 'Fremennik'], skills: { 'Mining': 40 }, notes: 'Gem rocks (Shilo / Lunar Isle)' }
  ],

  // --- COOKED FOOD ---
  'Shrimps': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 1 }, inputs: { 'Raw Shrimps': 1 } }
  ],
  'Trout': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 15 }, inputs: { 'Raw Trout': 1 } }
  ],
  'Salmon': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 25 }, inputs: { 'Raw Salmon': 1 } }
  ],
  'Lobster': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 40 }, inputs: { 'Raw Lobster': 1 } }
  ],
  'Swordfish': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 45 }, inputs: { 'Raw Swordfish': 1 } }
  ],
  'Monkfish': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 62 }, inputs: { 'Raw Monkfish': 1 }, quests: ['Swan Song'] }
  ],
  'Shark': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 80 }, inputs: { 'Raw Shark': 1 } }
  ],
  'Cooked Karambwan': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 30 }, inputs: { 'Raw Karambwan': 1 }, quests: ['Tai Bwo Wannai Trio'], notes: 'Poisonous if cooked wrong' }
  ],
  'Anglerfish': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 84 }, inputs: { 'Raw Anglerfish': 1 } }
  ],
  'Manta Ray': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], skills: { 'Cooking': 91 }, inputs: { 'Raw Manta Ray': 1 } }
  ],

  // --- BONES ---
  'Bones': [
    { type: 'DROP', name: 'Chicken', regions: ['Any'], rarity: 'Always' },
    { type: 'DROP', name: 'Common Monster', regions: ['Any'], notes: 'Most low-level humanoids/animals' }
  ],
  'Big Bones': [
    { type: 'DROP', name: 'Hill Giant', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Wilderness', 'Kharidian Desert', 'Kourend & Kebos', 'Varlamore'], rarity: 'Always' },
    { type: 'DROP', name: 'Moss Giant', regions: ['Any'], rarity: 'Always' },
    { type: 'DROP', name: 'Fire Giant', regions: ['Kandarin', 'Wilderness', 'Kourend & Kebos'], rarity: 'Always' }
  ],
  'Babydragon Bones': [
    { type: 'DROP', name: 'Baby Blue Dragon', regions: ['Asgarnia', 'Kandarin'], rarity: 'Always', notes: 'Taverley / Ogre Enclave' }
  ],
  'Lava Dragon Bones': [
    { type: 'DROP', name: 'Lava Dragon', regions: ['Wilderness'], rarity: 'Always', notes: 'Lava Dragon Isle' }
  ],
  'Superior Dragon Bones': [
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath', rarity: 'Always' },
    { type: 'DROP', name: 'Adamant Dragon', regions: ['Kandarin'], quests: ['Dragon Slayer II'], rarity: 'Always' },
    { type: 'DROP', name: 'Rune Dragon', regions: ['Kandarin', 'Fremennik'], quests: ['Dragon Slayer II'], rarity: 'Always' }
  ],
  'Hydra Bones': [
    { type: 'DROP', name: 'Alchemical Hydra', regions: ['Kourend & Kebos'], unlockId: 'Alchemical Hydra', rarity: 'Always' }
  ],

  // --- TANNING & TEXTILES ---
  'Cowhide': [
    { type: 'DROP', name: 'Cow', regions: ['Any'], rarity: 'Always', notes: 'Lumbridge / Crafting Guild pen' }
  ],
  'Leather': [
    { type: 'SKILL', name: 'Tan Leather', regions: ['Any'], inputs: { 'Cowhide': 1, 'Coins': 1 }, notes: 'Use a Tanner' }
  ],
  'Hard Leather': [
    { type: 'SKILL', name: 'Tan Leather', regions: ['Any'], inputs: { 'Cowhide': 1, 'Coins': 3 }, notes: 'Use a Tanner' }
  ],
  'Green Dragon Leather': [
    { type: 'SKILL', name: 'Tan Leather', regions: ['Any'], inputs: { 'Green Dragonhide': 1, 'Coins': 20 } }
  ],
  'Blue Dragon Leather': [
    { type: 'SKILL', name: 'Tan Leather', regions: ['Any'], inputs: { 'Blue Dragonhide': 1, 'Coins': 20 } }
  ],
  'Red Dragon Leather': [
    { type: 'SKILL', name: 'Tan Leather', regions: ['Any'], inputs: { 'Red Dragonhide': 1, 'Coins': 20 } }
  ],
  'Wool': [
    { type: 'SKILL', name: 'Shear Sheep', regions: ['Any'], notes: 'Sheep pens (e.g. Lumbridge / Farming Guild)' }
  ],
  'Ball of Wool': [
    { type: 'SKILL', name: 'Spinning Wheel', regions: ['Any'], inputs: { 'Wool': 1 } },
    { type: 'SHOP', name: 'Crafting Shop', regions: ['Misthalin', 'Asgarnia'], notes: "Wyson / Crafting Guild" }
  ],
  'Thread': [
    { type: 'SHOP', name: 'Crafting Shop', regions: ['Misthalin', 'Asgarnia', 'Kandarin'], notes: 'Stocked widely' }
  ],
  'Needle': [
    { type: 'SHOP', name: 'Crafting Shop', regions: ['Misthalin', 'Asgarnia', 'Kandarin'] },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Misthalin'], notes: 'Various buildings' }
  ],

  // --- TOOLS & CONTAINERS ---
  'Chisel': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'] },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Any'], notes: 'Crafting areas' }
  ],
  'Knife': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'] },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Any'] }
  ],
  'Spade': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'] },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Any'], notes: 'Farming areas' }
  ],
  'Pot': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'] },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Any'], notes: 'Kitchens' }
  ],
  'Jug': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'] },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Any'], notes: 'Kitchens / bars' }
  ],
  'Bucket': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'] },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Any'] }
  ],
  'Empty Vial': [
    { type: 'SHOP', name: 'General Store', regions: ['Any'], notes: 'Sold in packs' },
    { type: 'SHOP', name: 'Herblore Shop', regions: ['Asgarnia', 'Kandarin', 'Misthalin'] }
  ],

  // --- SEEDS ---
  'Ranarr Seed': [
    { type: 'PICKPOCKET', name: 'Master Farmer', regions: ['Misthalin', 'Kandarin'], skills: { 'Thieving': 38 }, rarity: 'Uncommon', notes: 'Draynor / Ardougne' },
    { type: 'DROP', name: 'Bird Nest', regions: ['Any'], rarity: 'Rare' }
  ],
  'Snapdragon Seed': [
    { type: 'PICKPOCKET', name: 'Master Farmer', regions: ['Misthalin', 'Kandarin'], skills: { 'Thieving': 38 }, rarity: 'Rare' },
    { type: 'DROP', name: 'Bird Nest', regions: ['Any'], rarity: 'Rare' }
  ],
  'Torstol Seed': [
    { type: 'PICKPOCKET', name: 'Master Farmer', regions: ['Misthalin', 'Kandarin'], skills: { 'Thieving': 38 }, rarity: 'Rare' },
    { type: 'DROP', name: 'Bird Nest', regions: ['Any'], rarity: 'Very rare' }
  ],
  'Yew Seed': [
    { type: 'DROP', name: 'Bird Nest', regions: ['Any'], rarity: 'Rare' },
    { type: 'PICKPOCKET', name: 'Master Farmer', regions: ['Misthalin', 'Kandarin'], skills: { 'Thieving': 38 }, rarity: 'Very rare' }
  ],
  'Magic Seed': [
    { type: 'DROP', name: 'Bird Nest', regions: ['Any'], rarity: 'Very rare' },
    { type: 'MINIGAME', name: 'Kingdom of Miscellania', regions: ['Fremennik'], quests: ['Throne of Miscellania'], notes: 'Hardwood/herb allocation' }
  ],
  'Bird Nest': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Any'], skills: { 'Woodcutting': 1 }, rarity: 'Random while chopping' },
    { type: 'SKILL', name: 'Bird Houses', regions: ['Islands & Others'], skills: { 'Hunter': 5 }, quests: ['Bone Voyage'], notes: 'Fossil Island runs' }
  ],

  // --- AMMUNITION ---
  'Arrow Shaft': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 1 }, inputs: { 'Logs': 1, 'Knife': 0 }, outputYield: 15 }
  ],
  'Headless Arrow': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 1 }, inputs: { 'Arrow Shaft': 1, 'Feather': 1 }, outputYield: 1 }
  ],
  'Bronze Arrow': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 1 }, inputs: { 'Headless Arrow': 1, 'Bronze Arrowtips': 1 } },
    { type: 'SHOP', name: 'Archery Shop', regions: ['Misthalin', 'Kandarin'] }
  ],
  'Steel Arrow': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 30 }, inputs: { 'Headless Arrow': 1, 'Steel Arrowtips': 1 } }
  ],
  'Rune Arrow': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 75 }, inputs: { 'Headless Arrow': 1, 'Rune Arrowtips': 1 } },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath', notes: 'Dragon arrows variant also drops' }
  ],
  'Bronze Arrowtips': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: { 'Smithing': 1 }, inputs: { 'Bronze Bar': 1 }, outputYield: 15 }
  ],
  'Steel Arrowtips': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: { 'Smithing': 35 }, inputs: { 'Steel Bar': 1 }, outputYield: 15 }
  ],
  'Rune Arrowtips': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: { 'Smithing': 90 }, inputs: { 'Rune Bar': 1 }, outputYield: 15 }
  ],
  'Broad Arrows': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 52 }, inputs: { 'Headless Arrow': 1, 'Broad Arrowheads': 1 }, notes: 'Requires Slayer unlock' },
    { type: 'MERCHANT', name: 'Slayer Master', regions: ['Any'], notes: 'Buy with Slayer Points/coins' }
  ],
  'Amethyst Arrow': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 82 }, inputs: { 'Headless Arrow': 1, 'Amethyst Arrowtips': 1 } }
  ],
  'Amethyst Arrowtips': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 85 }, inputs: { 'Amethyst': 1, 'Chisel': 0 }, outputYield: 15 }
  ],

  // --- TREASURE TRAIL REWARDS ---
  'Ranger Boots': [
    { type: 'CLUE', name: 'Clue Scroll (Elite)', regions: ['Any'], rarity: '1/1133', notes: 'Reward casket' },
    { type: 'CLUE', name: 'Clue Scroll (Hard)', regions: ['Any'], rarity: '1/1625', notes: 'Reward casket' }
  ],
  'Robin Hood Hat': [
    { type: 'CLUE', name: 'Clue Scroll (Hard)', regions: ['Any'], rarity: '1/1133', notes: 'Reward casket' },
    { type: 'CLUE', name: 'Clue Scroll (Elite)', regions: ['Any'], rarity: '1/1133' }
  ],
  'Holy Sandals': [
    { type: 'CLUE', name: 'Clue Scroll (Elite)', regions: ['Any'], rarity: '1/1625', notes: 'Reward casket' }
  ],

  // --- CRAFTED ITEMS (generated by scripts/buildCraftables.mjs) ---
  'Adamant 2h Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 84 }, inputs: { 'Adamantite Bar': 3 } }
  ],
  'Adamant Arrowtips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 75 }, inputs: { 'Adamantite Bar': 1 }, outputYield: 15 }
  ],
  'Adamant Axe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 71 }, inputs: { 'Adamantite Bar': 1 } }
  ],
  'Adamant Battleaxe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 80 }, inputs: { 'Adamantite Bar': 3 } }
  ],
  'Adamant Bolts(unf)': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 73 }, inputs: { 'Adamantite Bar': 1 }, outputYield: 10 }
  ],
  'Adamant Chainbody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 81 }, inputs: { 'Adamantite Bar': 3 } }
  ],
  'Adamant Claws': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 83 }, inputs: { 'Adamantite Bar': 2 } }
  ],
  'Adamant Dagger': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 70 }, inputs: { 'Adamantite Bar': 1 } }
  ],
  'Adamant Dart Tip': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 74 }, inputs: { 'Adamantite Bar': 1 }, outputYield: 10 }
  ],
  'Adamant Full Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 77 }, inputs: { 'Adamantite Bar': 2 } }
  ],
  'Adamant Javelin Tips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 76 }, inputs: { 'Adamantite Bar': 1 }, outputYield: 5 }
  ],
  'Adamant Keel Parts': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 74 }, inputs: { 'Adamantite Bar': 5 } }
  ],
  'Adamant Kiteshield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 82 }, inputs: { 'Adamantite Bar': 3 } }
  ],
  'Adamant Knife': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 77 }, inputs: { 'Adamantite Bar': 1 }, outputYield: 5 }
  ],
  'Adamant Longsword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 76 }, inputs: { 'Adamantite Bar': 2 } }
  ],
  'Adamant Mace': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 72 }, inputs: { 'Adamantite Bar': 1 } }
  ],
  'Adamant Med Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 73 }, inputs: { 'Adamantite Bar': 1 } }
  ],
  'Adamant Platebody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 88 }, inputs: { 'Adamantite Bar': 5 } }
  ],
  'Adamant Platelegs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 86 }, inputs: { 'Adamantite Bar': 3 } }
  ],
  'Adamant Plateskirt': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 86 }, inputs: { 'Adamantite Bar': 3 } }
  ],
  'Adamant Scimitar': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 75 }, inputs: { 'Adamantite Bar': 2 } }
  ],
  'Adamant Sq Shield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 78 }, inputs: { 'Adamantite Bar': 2 } }
  ],
  'Adamant Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 74 }, inputs: { 'Adamantite Bar': 1 } }
  ],
  'Adamant Warhammer': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 79 }, inputs: { 'Adamantite Bar': 3 } }
  ],
  'Amulet of Bounty': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 7 }, inputs: { 'Opal Amulet': 1, 'Cosmic Rune': 1, 'Water Rune': 1 } }
  ],
  'Amulet of Chemistry': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 27 }, inputs: { 'Jade Amulet': 1, 'Cosmic Rune': 1, 'Air Rune': 3 } }
  ],
  'Amulet of Defence': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 27 }, inputs: { 'Emerald Amulet': 1, 'Cosmic Rune': 1, 'Air Rune': 3 } }
  ],
  'Amulet of Fury': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 87 }, inputs: { 'Onyx Amulet': 1, 'Cosmic Rune': 1, 'Fire Rune': 20, 'Earth Rune': 20 } }
  ],
  'Amulet of Magic': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 7 }, inputs: { 'Sapphire Amulet': 1, 'Cosmic Rune': 1, 'Water Rune': 1 } }
  ],
  'Amulet of Nature': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 27 }, inputs: { 'Pre-nature Amulet': 1, 'Cosmic Rune': 1, 'Air Rune': 3 } }
  ],
  'Amulet of Strength': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 49 }, inputs: { 'Ruby Amulet': 1, 'Cosmic Rune': 1, 'Fire Rune': 5 } }
  ],
  'Berserker Necklace': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 87 }, inputs: { 'Onyx Necklace': 1, 'Cosmic Rune': 1, 'Fire Rune': 20, 'Earth Rune': 20 } }
  ],
  'Binding Necklace': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 27 }, inputs: { 'Emerald Necklace': 1, 'Cosmic Rune': 1, 'Air Rune': 3 } }
  ],
  'Black D\'hide Chaps': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 82 }, inputs: { 'Black Dragon Leather': 2, 'Thread': 1 } }
  ],
  'Black D\'hide Shield': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 83 }, inputs: { 'Black Dragon Leather': 2, 'Redwood Shield': 1, 'Rune Nails': 15 } }
  ],
  'Black D\'hide Vambraces': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 79 }, inputs: { 'Black Dragon Leather': 1, 'Thread': 1 } }
  ],
  'Blue D\'hide Body': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 71 }, inputs: { 'Blue Dragon Leather': 3, 'Thread': 1 } }
  ],
  'Blue D\'hide Chaps': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 68 }, inputs: { 'Blue Dragon Leather': 2, 'Thread': 1 } }
  ],
  'Blue D\'hide Shield': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 69 }, inputs: { 'Blue Dragon Leather': 2, 'Yew Shield': 1, 'Mithril Nails': 15 } }
  ],
  'Blue D\'hide Vambraces': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 66 }, inputs: { 'Blue Dragon Leather': 1, 'Thread': 1 } }
  ],
  'Bracelet of Clay': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 7 }, inputs: { 'Sapphire Bracelet': 1, 'Cosmic Rune': 1, 'Water Rune': 1 } }
  ],
  'Bracelet of Slaughter': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 49 }, inputs: { 'Topaz Bracelet': 1, 'Cosmic Rune': 1, 'Fire Rune': 5 } }
  ],
  'Bronze 2h Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 14 }, inputs: { 'Bronze Bar': 3 } }
  ],
  'Bronze Axe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 1 }, inputs: { 'Bronze Bar': 1 } }
  ],
  'Bronze Battleaxe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 10 }, inputs: { 'Bronze Bar': 3 } }
  ],
  'Bronze Bolts (unf)': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 3 }, inputs: { 'Bronze Bar': 1 }, outputYield: 10 }
  ],
  'Bronze Chainbody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 11 }, inputs: { 'Bronze Bar': 3 } }
  ],
  'Bronze Claws': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 13 }, inputs: { 'Bronze Bar': 2 } }
  ],
  'Bronze Dagger': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 1 }, inputs: { 'Bronze Bar': 1 } }
  ],
  'Bronze Dart Tip': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 4 }, inputs: { 'Bronze Bar': 1 }, outputYield: 10 }
  ],
  'Bronze Full Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 7 }, inputs: { 'Bronze Bar': 2 } }
  ],
  'Bronze Javelin Tips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 6 }, inputs: { 'Bronze Bar': 1 }, outputYield: 5 }
  ],
  'Bronze Keel Parts': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 10 }, inputs: { 'Bronze Bar': 5 } }
  ],
  'Bronze Kiteshield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 12 }, inputs: { 'Bronze Bar': 3 } }
  ],
  'Bronze Knife': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 7 }, inputs: { 'Bronze Bar': 1 }, outputYield: 5 }
  ],
  'Bronze Limbs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 6 }, inputs: { 'Bronze Bar': 1 } }
  ],
  'Bronze Longsword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 6 }, inputs: { 'Bronze Bar': 2 } }
  ],
  'Bronze Mace': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 2 }, inputs: { 'Bronze Bar': 1 } }
  ],
  'Bronze Med Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 3 }, inputs: { 'Bronze Bar': 1 } }
  ],
  'Bronze Nails': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 4 }, inputs: { 'Bronze Bar': 1 }, outputYield: 15 }
  ],
  'Bronze Platebody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 18 }, inputs: { 'Bronze Bar': 5 } }
  ],
  'Bronze Platelegs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 16 }, inputs: { 'Bronze Bar': 3 } }
  ],
  'Bronze Plateskirt': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 16 }, inputs: { 'Bronze Bar': 3 } }
  ],
  'Bronze Scimitar': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 5 }, inputs: { 'Bronze Bar': 2 } }
  ],
  'Bronze Sq Shield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 8 }, inputs: { 'Bronze Bar': 2 } }
  ],
  'Bronze Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 4 }, inputs: { 'Bronze Bar': 1 } }
  ],
  'Bronze Warhammer': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 9 }, inputs: { 'Bronze Bar': 3 } }
  ],
  'Bronze Wire': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 4 }, inputs: { 'Bronze Bar': 1 } }
  ],
  'Coif': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 38 }, inputs: { 'Leather': 1, 'Thread': 1 } }
  ],
  'Combat Bracelet': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 68 }, inputs: { 'Dragonstone Bracelet': 1, 'Cosmic Rune': 1, 'Water Rune': 15, 'Earth Rune': 15 } }
  ],
  'Diamond Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 70 }, inputs: { 'Gold Bar': 1, 'Diamond': 1 } }
  ],
  'Diamond Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 58 }, inputs: { 'Diamond': 1, 'Gold Bar': 1 } }
  ],
  'Diamond Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 56 }, inputs: { 'Gold Bar': 1, 'Diamond': 1 } }
  ],
  'Diamond Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 43 }, inputs: { 'Gold Bar': 1, 'Diamond': 1 } }
  ],
  'Dodgy Necklace': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 7 }, inputs: { 'Opal Necklace': 1, 'Cosmic Rune': 1, 'Water Rune': 1 } }
  ],
  'Dragonstone Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 80 }, inputs: { 'Gold Bar': 1, 'Dragonstone': 1 } }
  ],
  'Dragonstone Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 74 }, inputs: { 'Dragonstone': 1, 'Gold Bar': 1 } }
  ],
  'Dragonstone Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 55 }, inputs: { 'Gold Bar': 1, 'Dragonstone': 1 } }
  ],
  'Efaritay\'s Aid': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 49 }, inputs: { 'Topaz Ring': 1, 'Cosmic Rune': 1, 'Fire Rune': 5 } }
  ],
  'Emerald Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Emerald Amulet (u)': 1, 'Ball of Wool': 1 } },
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 80 }, inputs: { 'Emerald Amulet (u)': 1, 'Water Rune': 5, 'Earth Rune': 10, 'Astral Rune': 2 } }
  ],
  'Emerald Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 31 }, inputs: { 'Emerald': 1, 'Gold Bar': 1 } }
  ],
  'Emerald Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 30 }, inputs: { 'Emerald': 1, 'Gold Bar': 1 } }
  ],
  'Emerald Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 29 }, inputs: { 'Emerald': 1, 'Gold Bar': 1 } }
  ],
  'Emerald Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 27 }, inputs: { 'Emerald': 1, 'Gold Bar': 1 } }
  ],
  'Expeditious Bracelet': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 7 }, inputs: { 'Opal Bracelet': 1, 'Cosmic Rune': 1, 'Water Rune': 1 } }
  ],
  'Flamtaer Bracelet': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 27 }, inputs: { 'Jade Bracelet': 1, 'Cosmic Rune': 1, 'Air Rune': 3 } }
  ],
  'Gold Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Gold Amulet (u)': 1, 'Ball of Wool': 1 } },
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 80 }, inputs: { 'Gold Amulet (u)': 1, 'Water Rune': 5, 'Earth Rune': 10, 'Astral Rune': 2 } }
  ],
  'Gold Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 8 }, inputs: { 'Gold Bar': 1 } }
  ],
  'Gold Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 7 }, inputs: { 'Gold Bar': 1 } }
  ],
  'Gold Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 6 }, inputs: { 'Gold Bar': 1 } }
  ],
  'Gold Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 5 }, inputs: { 'Gold Bar': 1 } }
  ],
  'Green D\'hide Body': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 63 }, inputs: { 'Green Dragon Leather': 3, 'Thread': 1 } }
  ],
  'Green D\'hide Chaps': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 60 }, inputs: { 'Green Dragon Leather': 2, 'Thread': 1 } }
  ],
  'Green D\'hide Shield': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 62 }, inputs: { 'Green Dragon Leather': 2, 'Maple Shield': 1, 'Steel Nails': 15 } }
  ],
  'Green D\'hide Vambraces': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 57 }, inputs: { 'Green Dragon Leather': 1, 'Thread': 1 } }
  ],
  'Hard Leather Shield': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 41 }, inputs: { 'Hard Leather': 2, 'Oak Shield': 1, 'Bronze Nails': 15 } }
  ],
  'Hardleather Body': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 28 }, inputs: { 'Hard Leather': 1, 'Thread': 1 } }
  ],
  'Inoculation Bracelet': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 49 }, inputs: { 'Ruby Bracelet': 1, 'Cosmic Rune': 1, 'Fire Rune': 5 } }
  ],
  'Iron 2h Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 29 }, inputs: { 'Iron Bar': 3 } }
  ],
  'Iron Arrowtips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 20 }, inputs: { 'Iron Bar': 1 }, outputYield: 15 }
  ],
  'Iron Axe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 16 }, inputs: { 'Iron Bar': 1 } }
  ],
  'Iron Battleaxe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 25 }, inputs: { 'Iron Bar': 3 } }
  ],
  'Iron Bolts (unf)': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 18 }, inputs: { 'Iron Bar': 1 }, outputYield: 10 }
  ],
  'Iron Chainbody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 26 }, inputs: { 'Iron Bar': 3 } }
  ],
  'Iron Claws': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 28 }, inputs: { 'Iron Bar': 2 } }
  ],
  'Iron Dagger': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 15 }, inputs: { 'Iron Bar': 1 } }
  ],
  'Iron Dart Tip': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 19 }, inputs: { 'Iron Bar': 1 }, outputYield: 10 }
  ],
  'Iron Full Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 22 }, inputs: { 'Iron Bar': 2 } }
  ],
  'Iron Javelin Tips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 21 }, inputs: { 'Iron Bar': 1 }, outputYield: 5 }
  ],
  'Iron Keel Parts': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 22 }, inputs: { 'Iron Bar': 5 } }
  ],
  'Iron Kiteshield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 27 }, inputs: { 'Iron Bar': 3 } }
  ],
  'Iron Knife': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 22 }, inputs: { 'Iron Bar': 1 }, outputYield: 5 }
  ],
  'Iron Limbs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 23 }, inputs: { 'Iron Bar': 1 } }
  ],
  'Iron Longsword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 21 }, inputs: { 'Iron Bar': 2 } }
  ],
  'Iron Mace': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 17 }, inputs: { 'Iron Bar': 1 } }
  ],
  'Iron Med Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 18 }, inputs: { 'Iron Bar': 1 } }
  ],
  'Iron Nails': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 19 }, inputs: { 'Iron Bar': 1 }, outputYield: 15 }
  ],
  'Iron Platebody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 33 }, inputs: { 'Iron Bar': 5 } }
  ],
  'Iron Platelegs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 31 }, inputs: { 'Iron Bar': 3 } }
  ],
  'Iron Plateskirt': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 31 }, inputs: { 'Iron Bar': 3 } }
  ],
  'Iron Scimitar': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 20 }, inputs: { 'Iron Bar': 2 } }
  ],
  'Iron Sheet': [
    { type: 'SKILL', name: 'Metal Press', regions: ['Any'], skills: { 'Smithing': 45 }, inputs: { 'Iron Bar': 1 } }
  ],
  'Iron Spit': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 17 }, inputs: { 'Iron Bar': 1 } }
  ],
  'Iron Sq Shield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 23 }, inputs: { 'Iron Bar': 2 } }
  ],
  'Iron Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 19 }, inputs: { 'Iron Bar': 1 } }
  ],
  'Iron Warhammer': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 24 }, inputs: { 'Iron Bar': 3 } }
  ],
  'Jade Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Jade Amulet (u)': 1, 'Ball of Wool': 1 } },
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 80 }, inputs: { 'Jade Amulet (u)': 1, 'Water Rune': 5, 'Earth Rune': 10, 'Astral Rune': 2 } }
  ],
  'Jade Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 34 }, inputs: { 'Jade': 1, 'Silver Bar': 1 } }
  ],
  'Jade Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 29 }, inputs: { 'Jade': 1, 'Silver Bar': 1 } }
  ],
  'Jade Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 25 }, inputs: { 'Jade': 1, 'Silver Bar': 1 } }
  ],
  'Jade Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 13 }, inputs: { 'Jade': 1, 'Silver Bar': 1 } }
  ],
  'Leather Body': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 14 }, inputs: { 'Leather': 1, 'Thread': 1 } }
  ],
  'Leather Boots': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 7 }, inputs: { 'Leather': 1, 'Thread': 1 } }
  ],
  'Leather Chaps': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 18 }, inputs: { 'Leather': 1, 'Thread': 1 } }
  ],
  'Leather Cowl': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 9 }, inputs: { 'Leather': 1, 'Thread': 1 } }
  ],
  'Leather Gloves': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Leather': 1, 'Thread': 1 } }
  ],
  'Leather Vambraces': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 11 }, inputs: { 'Leather': 1, 'Thread': 1 } }
  ],
  'Mithril 2h Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 64 }, inputs: { 'Mithril Bar': 3 } }
  ],
  'Mithril Arrowtips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 55 }, inputs: { 'Mithril Bar': 1 }, outputYield: 15 }
  ],
  'Mithril Axe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 51 }, inputs: { 'Mithril Bar': 1 } }
  ],
  'Mithril Battleaxe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 60 }, inputs: { 'Mithril Bar': 3 } }
  ],
  'Mithril Bolts (unf)': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 53 }, inputs: { 'Mithril Bar': 1 }, outputYield: 10 }
  ],
  'Mithril Chainbody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 61 }, inputs: { 'Mithril Bar': 3 } }
  ],
  'Mithril Claws': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 63 }, inputs: { 'Mithril Bar': 2 } }
  ],
  'Mithril Dagger': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 50 }, inputs: { 'Mithril Bar': 1 } }
  ],
  'Mithril Dart Tip': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 54 }, inputs: { 'Mithril Bar': 1 }, outputYield: 10 }
  ],
  'Mithril Full Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 57 }, inputs: { 'Mithril Bar': 2 } }
  ],
  'Mithril Javelin Tips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 56 }, inputs: { 'Mithril Bar': 1 }, outputYield: 5 }
  ],
  'Mithril Keel Parts': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 56 }, inputs: { 'Mithril Bar': 5 } }
  ],
  'Mithril Kiteshield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 62 }, inputs: { 'Mithril Bar': 3 } }
  ],
  'Mithril Knife': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 57 }, inputs: { 'Mithril Bar': 1 }, outputYield: 5 }
  ],
  'Mithril Limbs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 56 }, inputs: { 'Mithril Bar': 1 } }
  ],
  'Mithril Longsword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 56 }, inputs: { 'Mithril Bar': 2 } }
  ],
  'Mithril Mace': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 52 }, inputs: { 'Mithril Bar': 1 } }
  ],
  'Mithril Med Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 53 }, inputs: { 'Mithril Bar': 1 } }
  ],
  'Mithril Nails': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 54 }, inputs: { 'Mithril Bar': 1 }, outputYield: 15 }
  ],
  'Mithril Platebody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 68 }, inputs: { 'Mithril Bar': 5 } }
  ],
  'Mithril Platelegs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 66 }, inputs: { 'Mithril Bar': 3 } }
  ],
  'Mithril Plateskirt': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 66 }, inputs: { 'Mithril Bar': 3 } }
  ],
  'Mithril Scimitar': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 55 }, inputs: { 'Mithril Bar': 2 } }
  ],
  'Mithril Sq Shield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 58 }, inputs: { 'Mithril Bar': 2 } }
  ],
  'Mithril Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 54 }, inputs: { 'Mithril Bar': 1 } }
  ],
  'Mithril Warhammer': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 59 }, inputs: { 'Mithril Bar': 3 } }
  ],
  'Necklace of Faith': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 49 }, inputs: { 'Topaz Necklace': 1, 'Cosmic Rune': 1, 'Fire Rune': 5 } }
  ],
  'Onyx Amulet': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 80 }, inputs: { 'Onyx Amulet (u)': 1, 'Water Rune': 5, 'Earth Rune': 10, 'Astral Rune': 2 } }
  ],
  'Opal Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Opal Amulet (u)': 1, 'Ball of Wool': 1 } },
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 80 }, inputs: { 'Opal Amulet (u)': 1, 'Water Rune': 5, 'Earth Rune': 10, 'Astral Rune': 2 } }
  ],
  'Opal Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 27 }, inputs: { 'Silver Bar': 1, 'Opal': 1 } }
  ],
  'Opal Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 22 }, inputs: { 'Opal': 1, 'Silver Bar': 1 } }
  ],
  'Opal Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 16 }, inputs: { 'Opal': 1, 'Silver Bar': 1 } }
  ],
  'Opal Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Opal': 1, 'Silver Bar': 1 } }
  ],
  'Phoenix Necklace': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 57 }, inputs: { 'Diamond Necklace': 1, 'Cosmic Rune': 1, 'Earth Rune': 10 } }
  ],
  'Red D\'hide Body': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 77 }, inputs: { 'Red Dragon Leather': 3, 'Thread': 1 } }
  ],
  'Red D\'hide Chaps': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 75 }, inputs: { 'Red Dragon Leather': 2, 'Thread': 1 } }
  ],
  'Red D\'hide Shield': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 76 }, inputs: { 'Red Dragon Leather': 2, 'Magic Shield': 1, 'Adamantite Nails': 15 } }
  ],
  'Red D\'hide Vambraces': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 73 }, inputs: { 'Red Dragon Leather': 1, 'Thread': 1 } }
  ],
  'Regen Bracelet': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 87 }, inputs: { 'Onyx Bracelet': 1, 'Cosmic Rune': 1, 'Fire Rune': 20, 'Earth Rune': 20 } }
  ],
  'Ring of Forging': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 49 }, inputs: { 'Ruby Ring': 1, 'Cosmic Rune': 1, 'Fire Rune': 5 } }
  ],
  'Ring of Life': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 57 }, inputs: { 'Diamond Ring': 1, 'Cosmic Rune': 1, 'Earth Rune': 10 } }
  ],
  'Ring of Pursuit': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 7 }, inputs: { 'Opal Ring': 1, 'Cosmic Rune': 1, 'Water Rune': 1 } }
  ],
  'Ring of Recoil': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 7 }, inputs: { 'Sapphire Ring': 1, 'Cosmic Rune': 1, 'Water Rune': 1 } }
  ],
  'Ring of Stone': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 87 }, inputs: { 'Onyx Ring': 1, 'Cosmic Rune': 1, 'Fire Rune': 20, 'Earth Rune': 20 } }
  ],
  'Ring of Suffering': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 93 }, inputs: { 'Zenyte Ring': 1, 'Cosmic Rune': 1, 'Soul Rune': 20, 'Blood Rune': 20 } }
  ],
  'Ring of Wealth': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 68 }, inputs: { 'Dragonstone Ring': 1, 'Cosmic Rune': 1, 'Earth Rune': 15, 'Water Rune': 15 } }
  ],
  'Ruby Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Ruby Amulet (u)': 1, 'Ball of Wool': 1 } },
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 80 }, inputs: { 'Ruby Amulet (u)': 1, 'Water Rune': 5, 'Earth Rune': 10, 'Astral Rune': 2 } }
  ],
  'Ruby Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 50 }, inputs: { 'Ruby': 1, 'Gold Bar': 1 } }
  ],
  'Ruby Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 42 }, inputs: { 'Ruby': 1, 'Gold Bar': 1 } }
  ],
  'Ruby Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 40 }, inputs: { 'Ruby': 1, 'Gold Bar': 1 } }
  ],
  'Ruby Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 34 }, inputs: { 'Gold Bar': 1, 'Ruby': 1 } }
  ],
  'Rune 2h Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 99 }, inputs: { 'Rune Bar': 3 } }
  ],
  'Rune Axe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 86 }, inputs: { 'Rune Bar': 1 } }
  ],
  'Rune Battleaxe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 95 }, inputs: { 'Rune Bar': 3 } }
  ],
  'Rune Chainbody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 96 }, inputs: { 'Rune Bar': 3 } }
  ],
  'Rune Claws': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 98 }, inputs: { 'Rune Bar': 2 } }
  ],
  'Rune Dagger': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 85 }, inputs: { 'Rune Bar': 1 } }
  ],
  'Rune Dart Tip': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 89 }, inputs: { 'Rune Bar': 1 }, outputYield: 10 }
  ],
  'Rune Full Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 92 }, inputs: { 'Rune Bar': 2 } }
  ],
  'Rune Javelin Tips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 91 }, inputs: { 'Rune Bar': 1 }, outputYield: 5 }
  ],
  'Rune Keel Parts': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 86 }, inputs: { 'Rune Bar': 5 } }
  ],
  'Rune Kiteshield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 97 }, inputs: { 'Rune Bar': 3 } }
  ],
  'Rune Knife': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 92 }, inputs: { 'Rune Bar': 1 }, outputYield: 5 }
  ],
  'Rune Longsword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 91 }, inputs: { 'Rune Bar': 2 } }
  ],
  'Rune Mace': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 87 }, inputs: { 'Rune Bar': 1 } }
  ],
  'Rune Med Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 88 }, inputs: { 'Rune Bar': 1 } }
  ],
  'Rune Nails': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 89 }, inputs: { 'Rune Bar': 1 }, outputYield: 15 }
  ],
  'Rune Platebody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 99 }, inputs: { 'Rune Bar': 5 } }
  ],
  'Rune Platelegs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 99 }, inputs: { 'Rune Bar': 3 } }
  ],
  'Rune Plateskirt': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 99 }, inputs: { 'Rune Bar': 3 } }
  ],
  'Rune Sq Shield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 93 }, inputs: { 'Rune Bar': 2 } }
  ],
  'Rune Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 89 }, inputs: { 'Rune Bar': 1 } }
  ],
  'Rune Warhammer': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 94 }, inputs: { 'Rune Bar': 3 } }
  ],
  'Sapphire Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Sapphire Amulet (u)': 1, 'Ball of Wool': 1 } },
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 80 }, inputs: { 'Sapphire Amulet (u)': 1, 'Water Rune': 5, 'Earth Rune': 10, 'Astral Rune': 2 } }
  ],
  'Sapphire Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 24 }, inputs: { 'Sapphire': 1, 'Gold Bar': 1 } }
  ],
  'Sapphire Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 23 }, inputs: { 'Sapphire': 1, 'Gold Bar': 1 } }
  ],
  'Sapphire Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 22 }, inputs: { 'Sapphire': 1, 'Gold Bar': 1 } }
  ],
  'Sapphire Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 20 }, inputs: { 'Gold Bar': 1, 'Sapphire': 1 } }
  ],
  'Skills Necklace': [
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 68 }, inputs: { 'Dragon Necklace': 1, 'Cosmic Rune': 1, 'Earth Rune': 15, 'Water Rune': 15 } }
  ],
  'Steel 2h Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 44 }, inputs: { 'Steel Bar': 3 } }
  ],
  'Steel Axe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 31 }, inputs: { 'Steel Bar': 1 } }
  ],
  'Steel Battleaxe': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 40 }, inputs: { 'Steel Bar': 3 } }
  ],
  'Steel Bolts (unf)': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 33 }, inputs: { 'Steel Bar': 1 }, outputYield: 10 }
  ],
  'Steel Chainbody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 41 }, inputs: { 'Steel Bar': 3 } }
  ],
  'Steel Claws': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 43 }, inputs: { 'Steel Bar': 2 } }
  ],
  'Steel Dagger': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 30 }, inputs: { 'Steel Bar': 1 } }
  ],
  'Steel Dart Tip': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 34 }, inputs: { 'Steel Bar': 1 }, outputYield: 10 }
  ],
  'Steel Full Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 37 }, inputs: { 'Steel Bar': 2 } }
  ],
  'Steel Javelin Tips': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 36 }, inputs: { 'Steel Bar': 1 }, outputYield: 5 }
  ],
  'Steel Keel Parts': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 38 }, inputs: { 'Steel Bar': 5 } }
  ],
  'Steel Kiteshield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 42 }, inputs: { 'Steel Bar': 3 } }
  ],
  'Steel Knife': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 37 }, inputs: { 'Steel Bar': 1 }, outputYield: 5 }
  ],
  'Steel Limbs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 36 }, inputs: { 'Steel Bar': 1 } }
  ],
  'Steel Longsword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 36 }, inputs: { 'Steel Bar': 2 } }
  ],
  'Steel Mace': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 32 }, inputs: { 'Steel Bar': 1 } }
  ],
  'Steel Med Helm': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 33 }, inputs: { 'Steel Bar': 1 } }
  ],
  'Steel Nails': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 34 }, inputs: { 'Steel Bar': 1 }, outputYield: 15 }
  ],
  'Steel Platebody': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 48 }, inputs: { 'Steel Bar': 5 } }
  ],
  'Steel Platelegs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 46 }, inputs: { 'Steel Bar': 3 } }
  ],
  'Steel Plateskirt': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 46 }, inputs: { 'Steel Bar': 3 } }
  ],
  'Steel Scimitar': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 35 }, inputs: { 'Steel Bar': 2 } }
  ],
  'Steel Sq Shield': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 38 }, inputs: { 'Steel Bar': 2 } }
  ],
  'Steel Studs': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 36 }, inputs: { 'Steel Bar': 1 } }
  ],
  'Steel Sword': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 34 }, inputs: { 'Steel Bar': 1 } }
  ],
  'Steel Warhammer': [
    { type: 'SKILL', name: 'Anvil', regions: ['Any'], skills: { 'Smithing': 39 }, inputs: { 'Steel Bar': 3 } }
  ],
  'Studded Body': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 41 }, inputs: { 'Leather Body': 1, 'Steel Studs': 1 } }
  ],
  'Studded Chaps': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 44 }, inputs: { 'Leather Chaps': 1, 'Steel Studs': 1 } }
  ],
  'Topaz Amulet': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 1 }, inputs: { 'Topaz Amulet (u)': 1, 'Ball of Wool': 1 } },
    { type: 'SKILL', name: 'Magic', regions: ['Any'], skills: { 'Magic': 80 }, inputs: { 'Topaz Amulet (u)': 1, 'Water Rune': 5, 'Earth Rune': 10, 'Astral Rune': 2 } }
  ],
  'Topaz Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 45 }, inputs: { 'Red Topaz': 1, 'Silver Bar': 1 } }
  ],
  'Topaz Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 38 }, inputs: { 'Red Topaz': 1, 'Silver Bar': 1 } }
  ],
  'Topaz Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 32 }, inputs: { 'Red Topaz': 1, 'Silver Bar': 1 } }
  ],
  'Topaz Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 16 }, inputs: { 'Red Topaz': 1, 'Silver Bar': 1 } }
  ],

  // --- POTIONS (generated by scripts/buildPotions.mjs) ---
  'Agility Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 34 }, inputs: { 'Vial of Water': 1, 'Toadflax': 1, 'Toad\'s Legs': 1 } }
  ],
  'Ancient Brew': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 85 }, inputs: { 'Dwarf Weed': 1, 'Vial of Water': 1, 'Nihil Dust': 1 } }
  ],
  'Anti-poison Supermix': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 51 }, inputs: { 'Superantipoison': 1, 'Caviar': 1 } }
  ],
  'Anti-venom+': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 94 }, inputs: { 'Anti-venom': 1, 'Torstol': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 94 }, inputs: { 'Anti-venom': 1, 'Torstol': 1, 'Vial of Water': 1 } }
  ],
  'Antidote+': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 68 }, inputs: { 'Coconut Milk': 1, 'Toadflax': 1, 'Yew Roots': 1 } }
  ],
  'Antidote++': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 79 }, inputs: { 'Coconut Milk': 1, 'Irit Leaf': 1, 'Magic Roots': 1 } }
  ],
  'Antifire Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 69 }, inputs: { 'Lantadyme': 1, 'Vial of Water': 1, 'Dragon Scale Dust': 1 } }
  ],
  'Antipoison': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 5 }, inputs: { 'Marrentill': 1, 'Vial of Water': 1, 'Unicorn Horn Dust': 1 } }
  ],
  'Attack Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 3 }, inputs: { 'Guam Leaf': 1, 'Vial of Water': 1, 'Eye of Newt': 1 } }
  ],
  'Bastion Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 80 }, inputs: { 'Cadantine': 1, 'Vial of Blood': 1, 'Wine of Zamorak': 1 } }
  ],
  'Battlemage Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 80 }, inputs: { 'Cadantine': 1, 'Vial of Blood': 1, 'Potato Cactus': 1 } }
  ],
  'Blighted Overload': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 83 }, inputs: { 'Super Combat Potion': 1, 'Ranging Potion': 1, 'Magic Potion': 1, 'Chitin': 1 } }
  ],
  'Combat Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 36 }, inputs: { 'Harralander': 1, 'Vial of Water': 1, 'Goat Horn Dust': 1 } }
  ],
  'Compost Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 22 }, inputs: { 'Harralander': 1, 'Vial of Water': 1, 'Volcanic Ash': 1 } }
  ],
  'Defence Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 30 }, inputs: { 'Ranarr Weed': 1, 'Vial of Water': 1, 'White Berries': 1 } }
  ],
  'Divine Bastion Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 86 }, inputs: { 'Bastion Potion': 1, 'Crystal Dust': 1 } }
  ],
  'Divine Battlemage Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 86 }, inputs: { 'Battlemage Potion': 1, 'Crystal Dust': 1 } }
  ],
  'Divine Magic Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 78 }, inputs: { 'Magic Potion': 1, 'Crystal Dust': 1 } }
  ],
  'Divine Ranging Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 74 }, inputs: { 'Ranging Potion': 1, 'Crystal Dust': 1 } }
  ],
  'Divine Super Attack Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 70 }, inputs: { 'Super Attack': 1, 'Crystal Dust': 1 } }
  ],
  'Divine Super Combat Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 97 }, inputs: { 'Super Combat Potion': 1, 'Crystal Dust': 1 } }
  ],
  'Divine Super Defence Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 70 }, inputs: { 'Super Defence': 1, 'Crystal Dust': 1 } }
  ],
  'Divine Super Strength Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 70 }, inputs: { 'Super Strength': 1, 'Crystal Dust': 1 } }
  ],
  'Egniol Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 1 }, inputs: { 'Crystal Dust (The Gauntlet)': 10 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 1 }, inputs: { 'Corrupted Dust': 10 } }
  ],
  'Extended Anti-venom+': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 94 }, inputs: { 'Anti-venom+': 1, 'Araxyte Venom Sack': 1 } }
  ],
  'Extended Antifire': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 84 }, inputs: { 'Antifire Potion': 1, 'Lava Scale Shard': 1 } }
  ],
  'Extended Stamina Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 85 }, inputs: { 'Stamina Potion': 1, 'Marlin Scales': 1 } }
  ],
  'Extended Super Antifire': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 98 }, inputs: { 'Super Antifire Potion': 1, 'Lava Scale Shard': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 98 }, inputs: { 'Extended Antifire': 1, 'Crushed Superior Dragon Bones': 1 } }
  ],
  'Extreme Energy Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 66 }, inputs: { 'Super Energy': 1, 'Yellow Fin': 1 } }
  ],
  'Fishing Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 50 }, inputs: { 'Avantoe': 1, 'Vial of Water': 1, 'Snape Grass': 1 } }
  ],
  'Forgotten Brew': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 91 }, inputs: { 'Ancient Brew': 1, 'Ancient Essence': 20 } }
  ],
  'Goblin Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 47 }, inputs: { 'Vial of Water': 1, 'Toadflax': 1, 'Pharmakos Berries': 1 } }
  ],
  'Guthix Balance': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 22 }, inputs: { 'Restore Potion': 1, 'Garlic': 1, 'Silver Dust': 1 } }
  ],
  'Guthix Rest': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 18 }, inputs: { 'Cup of Hot Water': 1, 'Guam Leaf': 2, 'Harralander': 1, 'Marrentill': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 18 }, inputs: { 'Marrentill': 1, 'Herb Tea Mix (2 Guams and Harralander)': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 18 }, inputs: { 'Harralander': 1, 'Herb Tea Mix (2 Guams and Marrentill)': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 18 }, inputs: { 'Guam Leaf': 1, 'Herb Tea Mix (harralander, Marrentill and Guam)': 1 } }
  ],
  'Haemostatic Dressing': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 56 }, inputs: { 'Haemostatic Poultice': 1, 'Cotton Yarn': 1 } }
  ],
  'Hunter Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 53 }, inputs: { 'Avantoe': 1, 'Vial of Water': 1, 'Kebbit Teeth Dust': 1 } }
  ],
  'Magic Essence': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 57 }, inputs: { 'Vial of Water': 1, 'Star Flower': 1, 'Gorak Claw Powder': 1 } }
  ],
  'Magic Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 76 }, inputs: { 'Lantadyme': 1, 'Vial of Water': 1, 'Potato Cactus': 1 } }
  ],
  'Menaphite Remedy': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 88 }, inputs: { 'Dwarf Weed': 1, 'Vial of Water': 1, 'Lily of the Sands': 1 } }
  ],
  'Relicym\'s Balm': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 8 }, inputs: { 'Vial of Water': 1, 'Rogue\'s Purse': 1, 'Snake Weed': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 8 }, inputs: { 'Unfinished Potion (Rogue\'s Purse)': 1, 'Snake Weed': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 8 }, inputs: { 'Snakeweed Mixture': 1, 'Rogue\'s Purse': 1 } }
  ],
  'Restore Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 22 }, inputs: { 'Harralander': 1, 'Vial of Water': 1, 'Red Spiders\' Eggs': 1 } }
  ],
  'Sacred Oil': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 1 }, inputs: { 'Olive Oil': 1 } }
  ],
  'Sanfew Serum': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 65 }, inputs: { 'Mixture - Step 2': 1, 'Nail Beast Nails': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 65 }, inputs: { 'Super Restore': 1, 'Unicorn Horn Dust': 1, 'Snake Weed': 1, 'Nail Beast Nails': 1 } }
  ],
  'Serum 207': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 15 }, inputs: { 'Tarromin': 1, 'Vial of Water': 1, 'Ashes': 1 } },
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 15 }, inputs: { 'Unfinished Potion': 1, 'Tarromin': 1 } }
  ],
  'Serum 208': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 15 }, inputs: { 'Serum 207': 1 } }
  ],
  'Strength Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 12 }, inputs: { 'Tarromin': 1, 'Vial of Water': 1, 'Limpwurt Root': 1 } }
  ],
  'Super Antifire Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 92 }, inputs: { 'Antifire Potion': 1, 'Crushed Superior Dragon Bones': 1 } }
  ],
  'Super Energy': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 52 }, inputs: { 'Avantoe': 1, 'Vial of Water': 1, 'Mort Myre Fungus': 1 } }
  ],
  'Super Fishing Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 62 }, inputs: { 'Vial of Water': 1, 'Pillar Coral': 1, 'Haddock Eye': 1 } }
  ],
  'Superantipoison': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 48 }, inputs: { 'Irit Leaf': 1, 'Vial of Water': 1, 'Unicorn Horn Dust': 1 } }
  ],
  'Surge Potion': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 81 }, inputs: { 'Torstol': 1, 'Vial of Water': 1, 'Demonic Tallow': 1 } }
  ],
  'Zamorak Brew': [
    { type: 'SKILL', name: 'Herblore', regions: ['Any'], skills: { 'Herblore': 78 }, inputs: { 'Torstol': 1, 'Vial of Water': 1, 'Jangerberries': 1 } }
  ],

  // --- LOW-LEVEL HERBS ---
  'Guam Leaf': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: { 'Farming': 9 }, notes: 'Clean a Grimy guam leaf', outputYield: 8 },
    { type: 'PICKPOCKET', name: 'Master Farmer', regions: ['Misthalin', 'Kandarin'], skills: { 'Thieving': 38 }, rarity: 'Common' },
    { type: 'DROP', name: 'Common Monster', regions: ['Any'], notes: 'Low-level humanoids' }
  ],
  'Marrentill': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: { 'Farming': 14 }, notes: 'Clean a Grimy marrentill', outputYield: 8 },
    { type: 'PICKPOCKET', name: 'Master Farmer', regions: ['Misthalin', 'Kandarin'], skills: { 'Thieving': 38 }, rarity: 'Common' },
    { type: 'DROP', name: 'Common Monster', regions: ['Any'] }
  ],
  'Tarromin': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: { 'Farming': 19 }, notes: 'Clean a Grimy tarromin', outputYield: 8 },
    { type: 'PICKPOCKET', name: 'Master Farmer', regions: ['Misthalin', 'Kandarin'], skills: { 'Thieving': 38 }, rarity: 'Uncommon' },
    { type: 'DROP', name: 'Common Monster', regions: ['Any'] }
  ],

  // --- HERBLORE SECONDARIES ---
  'Dragon Scale Dust': [
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: { 'Blue Dragon Scale': 1 }, notes: 'Grind with a Pestle and mortar' }
  ],
  'Garlic': [
    { type: 'SHOP', name: "Wydin's Food Store", regions: ['Asgarnia'], notes: 'Port Sarim' },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Misthalin'], notes: 'Draynor Manor kitchen' }
  ],
  'Desert Goat Horn': [
    { type: 'DROP', name: 'Desert Goat', regions: ['Kharidian Desert'], rarity: 'Common' }
  ],
  'Goat Horn Dust': [
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: { 'Desert Goat Horn': 1 }, notes: 'Grind with a Pestle and mortar' }
  ],
  'Unicorn Horn': [
    { type: 'DROP', name: 'Unicorn', regions: ['Misthalin', 'Kandarin', 'Asgarnia', 'Kourend & Kebos', 'Varlamore', 'The Open Seas', 'Islands & Others'], rarity: 'Always' }
  ],
  'Unicorn Horn Dust': [
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: { 'Unicorn Horn': 1 }, notes: 'Grind with a Pestle and mortar' }
  ],
  'Snake Weed': [
    { type: 'SKILL', name: 'Marshy Jungle Vines', regions: ['Karamja'], quests: ['Jungle Potion'], notes: 'Tai Bwo Wannai jungle' }
  ],
  'Coconut Milk': [
    { type: 'SKILL', name: 'Crush Coconut', regions: ['Any'], inputs: { 'Coconut': 1, 'Vial': 1 }, notes: 'Hammer a coconut, then fill vials' }
  ],
  'Coconut': [
    { type: 'SHOP', name: 'Grand Tree Groceries', regions: ['Kandarin'], notes: 'Tree Gnome Stronghold' },
    { type: 'SKILL', name: 'Palm Tree Patch', regions: ['Any'], skills: { 'Farming': 68 }, outputYield: 6 }
  ],
  'Potato Cactus': [
    { type: 'SKILL', name: 'Cactus Patch', regions: ['Kharidian Desert'], skills: { 'Farming': 64 }, outputYield: 3 },
    { type: 'DROP', name: 'Dust Devil', regions: ['Kharidian Desert', 'Kourend & Kebos'], skills: { 'Slayer': 65 } }
  ],
  'Magic Roots': [
    { type: 'SKILL', name: 'Farming', regions: ['Any'], skills: { 'Farming': 75 }, notes: 'Dig up a Magic tree stump after harvest' }
  ],
  'Yew Roots': [
    { type: 'SKILL', name: 'Farming', regions: ['Any'], skills: { 'Farming': 60 }, notes: 'Dig up a Yew tree stump after harvest' }
  ],
  'Jangerberries': [
    { type: 'SKILL', name: 'Bush Patch', regions: ['Any'], skills: { 'Farming': 48 }, outputYield: 4 },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Islands & Others'], notes: 'Ape Atoll' }
  ],
  "Toad's Legs": [
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Islands & Others'], notes: 'Zanaris' },
    { type: 'DROP', name: 'Giant Frog', regions: ['Misthalin', 'The Open Seas'], notes: 'Lumbridge Swamp Caves' }
  ],
  'Star Flower': [
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Islands & Others'], notes: 'Zanaris' }
  ],
  "Zulrah's Scales": [
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', rarity: 'Always', notes: 'Large quantities', outputYield: 600 }
  ],
  'Crushed Superior Dragon Bones': [
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: { 'Superior Dragon Bones': 1 }, notes: 'Grind with a Pestle and mortar' }
  ],
  'Crystal Shard': [
    { type: 'MINIGAME', name: 'The Gauntlet', regions: ['Tirannwn'], unlockId: 'The Gauntlet' },
    { type: 'SKILL', name: 'Prifddinas Activities', regions: ['Tirannwn'], quests: ['Song of the Elves'], notes: 'Crystal Maths, mining, etc.' }
  ],
  'Crystal Dust': [
    { type: 'SKILL', name: 'Crush Crystal Shard', regions: ['Tirannwn'], inputs: { 'Crystal Shard': 1 }, notes: 'Grind with a Pestle and mortar' }
  ],
  'Lava Scale': [
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath', rarity: 'Common' }
  ],
  'Lava Scale Shard': [
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: { 'Lava Scale': 1 }, notes: 'Grind with a Pestle and mortar', outputYield: 4 }
  ],
  'Ashes': [
    { type: 'DROP', name: 'Imp', regions: ['Any'], rarity: 'Always' },
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Any'], notes: 'Various fires / locations' }
  ],
  'Vial': [
    { type: 'SKILL', name: 'Glassblowing', regions: ['Any'], skills: { 'Crafting': 33 }, inputs: { 'Molten Glass': 1 } },
    { type: 'SHOP', name: 'Herblore Shop', regions: ['Asgarnia', 'Kandarin', 'Misthalin'], notes: 'Sold empty in packs' }
  ],

  // --- BOSS & RAID UNIQUE INTERMEDIATES ---
  'Bludgeon Axon': [
    { type: 'DROP', name: 'Abyssal Sire', regions: ['Wilderness'], unlockId: 'Abyssal Sire', rarity: '1/258' }
  ],
  'Bludgeon Claw': [
    { type: 'DROP', name: 'Abyssal Sire', regions: ['Wilderness'], unlockId: 'Abyssal Sire', rarity: '1/258' }
  ],
  'Bludgeon Spine': [
    { type: 'DROP', name: 'Abyssal Sire', regions: ['Wilderness'], unlockId: 'Abyssal Sire', rarity: '1/258' }
  ],
  'Godsword Shard 1': [
    { type: 'DROP', name: 'General Graardor', regions: ['Fremennik'], unlockId: 'General Graardor' },
    { type: 'DROP', name: 'Commander Zilyana', regions: ['Fremennik'], unlockId: 'Commander Zilyana' },
    { type: 'DROP', name: "Kree'arra", regions: ['Fremennik'], unlockId: "Kree'arra" },
    { type: 'DROP', name: "K'ril Tsutsaroth", regions: ['Fremennik'], unlockId: "K'ril Tsutsaroth" },
    { type: 'DROP', name: 'Nex', regions: ['Fremennik'], unlockId: 'Nex' }
  ],
  'Godsword Shard 2': [
    { type: 'DROP', name: 'General Graardor', regions: ['Fremennik'], unlockId: 'General Graardor' },
    { type: 'DROP', name: 'Commander Zilyana', regions: ['Fremennik'], unlockId: 'Commander Zilyana' },
    { type: 'DROP', name: "Kree'arra", regions: ['Fremennik'], unlockId: "Kree'arra" },
    { type: 'DROP', name: "K'ril Tsutsaroth", regions: ['Fremennik'], unlockId: "K'ril Tsutsaroth" },
    { type: 'DROP', name: 'Nex', regions: ['Fremennik'], unlockId: 'Nex' }
  ],
  'Godsword Shard 3': [
    { type: 'DROP', name: 'General Graardor', regions: ['Fremennik'], unlockId: 'General Graardor' },
    { type: 'DROP', name: 'Commander Zilyana', regions: ['Fremennik'], unlockId: 'Commander Zilyana' },
    { type: 'DROP', name: "Kree'arra", regions: ['Fremennik'], unlockId: "Kree'arra" },
    { type: 'DROP', name: "K'ril Tsutsaroth", regions: ['Fremennik'], unlockId: "K'ril Tsutsaroth" },
    { type: 'DROP', name: 'Nex', regions: ['Fremennik'], unlockId: 'Nex' }
  ],
  "Executioner's Axe Head": [
    { type: 'DROP', name: 'Vardorvis', regions: ['Varlamore', 'Kourend & Kebos'], unlockId: 'Vardorvis', rarity: '1/96' }
  ],
  'Eye of the Duke': [
    { type: 'DROP', name: 'Duke Sucellus', regions: ['Fremennik'], unlockId: 'Duke Sucellus', rarity: '1/96' }
  ],
  'Leviathan Lure': [
    { type: 'DROP', name: 'The Leviathan', regions: ['Morytania'], unlockId: 'The Leviathan', rarity: '1/96' }
  ],
  "Siren's Staff": [
    { type: 'DROP', name: 'The Whisperer', regions: ['Fremennik'], unlockId: 'The Whisperer', rarity: '1/96' }
  ],
  'Araxyte Venom Sack': [
    { type: 'DROP', name: 'Araxxor', regions: ['Morytania'], unlockId: 'Araxxor' }
  ],
  'Ancient Essence': [
    { type: 'DROP', name: 'Duke Sucellus', regions: ['Fremennik'], unlockId: 'Duke Sucellus', notes: 'DT2 awakened bosses (any)' },
    { type: 'DROP', name: 'The Leviathan', regions: ['Morytania'], unlockId: 'The Leviathan' },
    { type: 'DROP', name: 'The Whisperer', regions: ['Fremennik'], unlockId: 'The Whisperer' },
    { type: 'DROP', name: 'Vardorvis', regions: ['Varlamore', 'Kourend & Kebos'], unlockId: 'Vardorvis' }
  ],
  'Ancient Shard': [
    { type: 'DROP', name: 'Catacombs of Kourend Monsters', regions: ['Kourend & Kebos'], rarity: 'Common' }
  ],
  'Vial of Blood': [
    { type: 'DROP', name: 'Vyrewatch Sentinel', regions: ['Morytania'], quests: ['Sins of the Father'], rarity: 'Common' }
  ],
  'Nail Beast Nails': [
    { type: 'MINIGAME', name: 'Temple Trekking', regions: ['Morytania'], unlockId: 'Temple Trekking', rarity: 'Common' }
  ],
  'Nihil Dust': [
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: { 'Nihil Shard': 1 }, notes: 'Grind with a Pestle and mortar' }
  ],
  'Nihil Shard': [
    { type: 'DROP', name: 'Nex', regions: ['Fremennik'], unlockId: 'Nex' },
    { type: 'DROP', name: 'Tombs of Amascut', regions: ['Kharidian Desert'], unlockId: 'Tombs of Amascut' }
  ],
  'Helm of Neitiznot': [
    { type: 'QUEST', name: 'The Fremennik Isles', regions: ['Fremennik'], notes: 'Quest Reward' }
  ],
  'Infinity Boots': [
    { type: 'MINIGAME', name: 'Mage Training Arena', regions: ['Kharidian Desert'], unlockId: 'Mage Training Arena', notes: 'Reward Shop' }
  ],
  'Broad Arrowheads': [
    { type: 'MERCHANT', name: 'Slayer Master', regions: ['Any'], notes: 'Requires Broader Fletching unlock (300 Slayer points)' }
  ],
  'Dragon Axe': [
    { type: 'DROP', name: 'Dagannoth Kings', regions: ['Fremennik'], unlockId: 'Dagannoth Kings', rarity: '1/128' },
    { type: 'MINIGAME', name: 'Volcanic Mine', regions: ['Islands & Others'], unlockId: 'Volcanic Mine', notes: 'Broken from Ore Pack' }
  ],
  'Dragon Harpoon': [
    { type: 'DROP', name: 'Wyrm', regions: ['Kourend & Kebos'], skills: { 'Slayer': 62 }, rarity: '1/5000' },
    { type: 'MINIGAME', name: 'Tempoross', regions: ['Kharidian Desert'], unlockId: 'Tempoross' }
  ],
  'Zamorakian Hasta': [
    { type: 'SKILL', name: 'Otto Godblessed', regions: ['Kandarin'], inputs: { 'Zamorakian Spear': 1, 'Coins': 300000 }, notes: "Otto's Grotto conversion" }
  ],
  'Zamorakian Spear': [
    { type: 'DROP', name: "K'ril Tsutsaroth", regions: ['Fremennik'], unlockId: "K'ril Tsutsaroth", rarity: '1/127' }
  ],

  // --- SMITHING / FLETCHING INTERMEDIATES ---
  'Adamantite Nails': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: { 'Smithing': 74 }, inputs: { 'Adamantite Bar': 1 }, outputYield: 15 }
  ],
  'Silver Bar': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Smithing': 20 }, inputs: { 'Silver Ore': 1 } },
    { type: 'SKILL', name: 'Blast Furnace', regions: ['Fremennik'], skills: { 'Smithing': 20 }, inputs: { 'Silver Ore': 1 }, unlockId: 'Blast Furnace' }
  ],
  'Sinew': [
    { type: 'SKILL', name: 'Cooking', regions: ['Any'], inputs: { 'Cowhide': 1 }, notes: 'Use cowhide on a range' }
  ],
  'Oak Shield': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 27 }, inputs: { 'Oak Logs': 2 } }
  ],
  'Maple Shield': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 62 }, inputs: { 'Maple Logs': 2 } }
  ],
  'Yew Shield': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 77 }, inputs: { 'Yew Logs': 2 } }
  ],
  'Magic Shield': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 87 }, inputs: { 'Magic Logs': 2 } }
  ],
  'Redwood Shield': [
    { type: 'SKILL', name: 'Fletching', regions: ['Any'], skills: { 'Fletching': 92 }, inputs: { 'Redwood Logs': 2 } }
  ],

  // --- JEWELLERY (ONYX / ZENYTE / DRAGON NECKLACE / JADE) ---
  'Onyx Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 67 }, inputs: { 'Gold Bar': 1, 'Onyx': 1, 'Ring Mould': 0 } }
  ],
  'Onyx Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 82 }, inputs: { 'Gold Bar': 1, 'Onyx': 1, 'Necklace Mould': 0 } }
  ],
  'Onyx Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 84 }, inputs: { 'Gold Bar': 1, 'Onyx': 1, 'Bracelet Mould': 0 } }
  ],
  'Onyx Amulet (u)': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 90 }, inputs: { 'Gold Bar': 1, 'Onyx': 1, 'Amulet Mould': 0 } }
  ],
  'Onyx': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 67 }, inputs: { 'Uncut Onyx': 1, 'Chisel': 0 } }
  ],
  'Zenyte Ring': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 89 }, inputs: { 'Gold Bar': 1, 'Zenyte': 1, 'Ring Mould': 0 } }
  ],
  'Zenyte Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 92 }, inputs: { 'Gold Bar': 1, 'Zenyte': 1, 'Necklace Mould': 0 } }
  ],
  'Zenyte Bracelet': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 95 }, inputs: { 'Gold Bar': 1, 'Zenyte': 1, 'Bracelet Mould': 0 } }
  ],
  'Dragon Necklace': [
    { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { 'Crafting': 72 }, inputs: { 'Gold Bar': 1, 'Dragonstone': 1, 'Necklace Mould': 0 } }
  ],
  'Jade': [
    { type: 'SKILL', name: 'Crafting', regions: ['Any'], skills: { 'Crafting': 13 }, inputs: { 'Uncut Jade': 1, 'Chisel': 0 } }
  ],
  'Uncut Jade': [
    { type: 'SKILL', name: 'Mining Rocks', regions: ['Karamja', 'Fremennik'], skills: { 'Mining': 40 }, notes: 'Gem rocks (Shilo / Lunar Isle)' }
  ],
  'Amulet Mould': [
    { type: 'SHOP', name: 'Crafting Shop', regions: ['Asgarnia', 'Kharidian Desert'], notes: 'Falador / Al Kharid' }
  ],
  'Ring Mould': [
    { type: 'SHOP', name: 'Crafting Shop', regions: ['Asgarnia', 'Kharidian Desert'], notes: 'Falador / Al Kharid' }
  ],
  'Necklace Mould': [
    { type: 'SHOP', name: 'Crafting Shop', regions: ['Asgarnia', 'Kharidian Desert'], notes: 'Falador / Al Kharid' }
  ],
  'Bracelet Mould': [
    { type: 'SHOP', name: 'Crafting Shop', regions: ['Asgarnia', 'Kharidian Desert'], notes: 'Falador / Al Kharid' }
  ],

  // --- ADDITIONAL SECONDARIES ---
  'Kebbit Teeth': [
    { type: 'SKILL', name: 'Hunter', regions: ['Kandarin'], skills: { 'Hunter': 51 }, notes: 'Sabre-toothed kebbit (Rellekka Hunter area)' }
  ],
  'Kebbit Teeth Dust': [
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: { 'Kebbit Teeth': 1 }, notes: 'Grind with a Pestle and mortar' }
  ],
  'Gorak Claw': [
    { type: 'DROP', name: 'Gorak', regions: ['Islands & Others'], notes: 'Zanaris / Gorak Plane' }
  ],
  'Gorak Claw Powder': [
    { type: 'SKILL', name: 'Grinding', regions: ['Any'], inputs: { 'Gorak Claw': 1 }, notes: 'Grind with a Pestle and mortar' }
  ],
  'Lily of the Sands': [
    { type: 'SKILL', name: 'Civitas Garden', regions: ['Varlamore'], skills: { 'Farming': 73 }, notes: 'Civitas illa Fortis special patch' }
  ],
  'Olive Oil': [
    { type: 'SKILL', name: 'Make Olive Oil', regions: ['Morytania'], skills: { 'Cooking': 32 }, inputs: { 'Olive': 1, 'Empty Vial': 1 }, quests: ["Shades of Mort'ton"] }
  ],
  'Olive': [
    { type: 'SPAWN', name: 'Ground Spawn', regions: ['Morytania'], notes: "Mort'ton" }
  ],
  'Tree Roots': [
    { type: 'SKILL', name: 'Farming', regions: ['Any'], skills: { 'Farming': 15 }, notes: 'Dig up any tree stump after harvest' }
  ],
  "Rogue's Purse": [
    { type: 'SKILL', name: 'Picking', regions: ['Morytania'], skills: { 'Farming': 4 }, quests: ['Nature Spirit'], notes: "Mort Myre Swamp mushrooms" }
  ],

  // --- MASTERING MIXOLOGY HERBS / INGREDIENTS ---
  // The MM minigame in Morytania produces its own herb line + a "water-filled
  // gourd vial" used in every MM-only potion. Each is gated on the minigame
  // unlock so locked players' breakdowns show MM as the prereq.
  'Noxifer': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology', notes: 'Aga-paste herb' }
  ],
  'Golpar': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology', notes: 'Mox-paste herb' }
  ],
  'Buchu Leaf': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology', notes: 'Lye-paste herb' }
  ],
  'Cicely': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology' }
  ],
  'Stinkhorn Mushroom': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology' }
  ],
  'Endarkened Juice': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology' }
  ],
  'Aldarium': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology', notes: 'Crafted intermediate' }
  ],
  'Huasca': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology' }
  ],
  'Water-filled Gourd Vial': [
    { type: 'MINIGAME', name: 'Mastering Mixology', regions: ['Morytania'], unlockId: 'Mastering Mixology' }
  ],

  // --- MASTERING MIXOLOGY POTIONS ---
  // Each potion has both the MM minigame source (with the unlock gate) and
  // its real Herblore level so the existing skill check still applies.
  // Mixing happens at the Lab in Morytania.
  'Elder Potion': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 59 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Stinkhorn Mushroom': 1 } }
  ],
  'Elder (+)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 70 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Stinkhorn Mushroom': 1 } }
  ],
  'Elder (-)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 47 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Stinkhorn Mushroom': 1 } }
  ],
  'Kodai Potion': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 59 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Endarkened Juice': 1 } }
  ],
  'Kodai (+)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 70 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Endarkened Juice': 1 } }
  ],
  'Kodai (-)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 47 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Endarkened Juice': 1 } }
  ],
  'Twisted Potion': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 59 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Cicely': 1 } }
  ],
  'Twisted (+)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 70 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Cicely': 1 } }
  ],
  'Twisted (-)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 47 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Golpar': 1, 'Cicely': 1 } }
  ],
  'Prayer Enhance': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 65 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Cicely': 1 } }
  ],
  'Prayer Enhance (+)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 78 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Cicely': 1 } }
  ],
  'Prayer Enhance (-)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 52 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Cicely': 1 } }
  ],
  'Revitalisation Potion': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 65 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Stinkhorn Mushroom': 1 } }
  ],
  'Revitalisation (+)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 78 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Stinkhorn Mushroom': 1 } }
  ],
  'Revitalisation (-)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 52 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Stinkhorn Mushroom': 1 } }
  ],
  "Xeric's Aid": [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 65 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Endarkened Juice': 1 } }
  ],
  "Xeric's Aid (+)": [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 78 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Endarkened Juice': 1 } }
  ],
  "Xeric's Aid (-)": [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 52 }, unlockId: 'Mastering Mixology', inputs: { 'Water-filled Gourd Vial': 1, 'Buchu Leaf': 1, 'Endarkened Juice': 1 } }
  ],
  'Overload (+)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 90 }, unlockId: 'Mastering Mixology', inputs: { 'Noxifer': 1, 'Elder (+)': 1, 'Twisted (+)': 1, 'Kodai (+)': 1 } }
  ],
  'Overload (-)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 60 }, unlockId: 'Mastering Mixology', inputs: { 'Noxifer': 1, 'Elder (-)': 1, 'Twisted (-)': 1, 'Kodai (-)': 1 } }
  ],
  'Overload (Chambers of Xeric)': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 75 }, unlockId: 'Mastering Mixology', inputs: { 'Noxifer': 1, 'Elder Potion': 1, 'Twisted Potion': 1, 'Kodai Potion': 1 } }
  ],
  'Goading Potion': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 54 }, unlockId: 'Mastering Mixology', inputs: { 'Harralander': 1, 'Vial of Water': 1, 'Aldarium': 1 } }
  ],
  'Prayer Regeneration Potion': [
    { type: 'SKILL', name: 'Mastering Mixology', regions: ['Morytania'], skills: { 'Herblore': 58 }, unlockId: 'Mastering Mixology', inputs: { 'Huasca': 1, 'Vial of Water': 1, 'Aldarium': 1 } }
  ],
};

// Merge auto-generated SHOP/DROP sources from the OSRS Wiki (see
// scripts/buildSourceEnrichment.ts) into the curated map above.
for (const [item, extra] of Object.entries(ENRICHED_SOURCES)) {
  const target = RESOURCE_MAP[item];
  if (target) target.push(...extra);
}

// --- CATEGORY GROUPING -------------------------------------------------------
// Explicit mapping of items to their browsing category. Mirrors the comment
// sections within RESOURCE_MAP above. Kept as an explicit list (rather than
// parsed from comments) so the category browser has a stable, ordered source.
export const RESOURCE_CATEGORIES: Record<string, string[]> = {
  'Herbs': [
    'Guam Leaf', 'Marrentill', 'Tarromin', 'Harralander', 'Ranarr Weed',
    'Toadflax', 'Irit Leaf', 'Avantoe', 'Kwuarm', 'Snapdragon', 'Cadantine',
    'Lantadyme', 'Dwarf Weed', 'Torstol',
  ],
  'Potions': [
    'Prayer Potion', 'Super Attack', 'Super Strength', 'Super Defence',
    'Super Restore', 'Stamina Potion', 'Ranging Potion', 'Saradomin Brew',
    'Super Combat Potion', 'Anti-venom', 'Energy Potion', 'Super Energy(4)',
    'Agility Potion',
    'Ancient Brew',
    'Anti-poison Supermix',
    'Anti-venom+',
    'Antidote+',
    'Antidote++',
    'Antifire Potion',
    'Antipoison',
    'Attack Potion',
    'Bastion Potion',
    'Battlemage Potion',
    'Blighted Overload',
    'Combat Potion',
    'Compost Potion',
    'Defence Potion',
    'Divine Bastion Potion',
    'Divine Battlemage Potion',
    'Divine Magic Potion',
    'Divine Ranging Potion',
    'Divine Super Attack Potion',
    'Divine Super Combat Potion',
    'Divine Super Defence Potion',
    'Divine Super Strength Potion',
    'Egniol Potion',
    'Extended Anti-venom+',
    'Extended Antifire',
    'Extended Stamina Potion',
    'Extended Super Antifire',
    'Extreme Energy Potion',
    'Fishing Potion',
    'Forgotten Brew',
    'Goblin Potion',
    'Guthix Balance',
    'Guthix Rest',
    'Haemostatic Dressing',
    'Hunter Potion',
    'Magic Essence',
    'Magic Potion',
    'Menaphite Remedy',
    'Relicym\'s Balm',
    'Restore Potion',
    'Sacred Oil',
    'Sanfew Serum',
    'Serum 207',
    'Serum 208',
    'Strength Potion',
    'Super Antifire Potion',
    'Super Energy',
    'Super Fishing Potion',
    'Superantipoison',
    'Surge Potion',
    'Zamorak Brew',
  ],
  'Secondaries': [
    'Snape Grass', "Red Spiders' Eggs", 'Mort Myre Fungus', 'Blue Dragon Scale',
    'Wine of Zamorak', 'Limpwurt Root', 'White Berries', 'Crushed Nest',
    'Eye of Newt', 'Vial of Water', 'Vial', 'Amylase Crystal', 'Chocolate Dust',
    'Chocolate Bar', 'Dragon Scale Dust', 'Garlic', 'Desert Goat Horn',
    'Goat Horn Dust', 'Unicorn Horn', 'Unicorn Horn Dust', 'Snake Weed',
    'Coconut Milk', 'Coconut', 'Potato Cactus', 'Magic Roots', 'Yew Roots',
    'Jangerberries', "Toad's Legs", 'Star Flower', "Zulrah's Scales",
    'Crushed Superior Dragon Bones', 'Crystal Shard', 'Crystal Dust',
    'Lava Scale', 'Lava Scale Shard', 'Ashes',
    'Kebbit Teeth', 'Kebbit Teeth Dust', 'Gorak Claw', 'Gorak Claw Powder',
    'Lily of the Sands', 'Olive Oil', 'Olive', 'Tree Roots', "Rogue's Purse",
  ],
  'Logs': [
    'Logs', 'Oak Logs', 'Willow Logs', 'Teak Logs', 'Maple Logs',
    'Mahogany Logs', 'Yew Logs', 'Magic Logs', 'Redwood Logs',
  ],
  'Construction': ['Oak Plank', 'Teak Plank', 'Mahogany Plank'],
  'Crafting & Processing': [
    'Bucket of Sand', 'Soda Ash', 'Giant Seaweed', 'Flax', 'Molten Glass',
    "Black D'hide Body", 'Black Dragon Leather', 'Black Dragonhide',
    'Red Dragonhide', 'Blue Dragonhide', 'Green Dragonhide', 'Uncut Dragonstone',
  ],
  'Mining & Ores': [
    'Copper Ore', 'Tin Ore', 'Clay', 'Rune Essence', 'Blurite Ore', 'Limestone',
    'Barronite Shards', 'Iron Ore', 'Silver Ore', 'Volcanic Ash', 'Coal',
    'Sandstone', 'Dense Essence Block', 'Gem Rock', 'Gold Ore',
    'Calcified Deposit', 'Volcanic Sulphur', 'Granite', 'Mithril Ore',
    'Daeyalt Essence', 'Lovakite Ore', 'Adamantite Ore', 'Runite Ore',
    'Amethyst', 'Pure Essence',
  ],
  'Pickaxes': [
    'Iron Pickaxe', 'Steel Pickaxe', 'Black Pickaxe', 'Mithril Pickaxe',
    'Adamant Pickaxe', 'Rune Pickaxe', 'Dragon Pickaxe', 'Crystal Pickaxe',
    'Infernal Pickaxe',
  ],
  'Bars & Smithing': [
    'Bronze Bar', 'Iron Bar', 'Steel Bar', 'Gold Bar', 'Mithril Bar',
    'Adamantite Bar', 'Rune Bar', 'Blurite Bar', 'Elemental Bar',
    'Elemental Ore', 'Lovakite Bar', 'Silver Bar', 'Cannonball', 'Hammer',
    'Ammo Mould', 'Bar Mould', 'Goldsmith Gauntlets', 'Ice Gloves',
    'Smithing Catalyst', 'Imcando Hammer', 'Adamantite Nails', 'Sinew',
  ],
  'Fishing & Food': [
    'Raw Shrimps', 'Raw Sardine', 'Raw Herring', 'Raw Anchovies', 'Raw Trout',
    'Raw Pike', 'Raw Slimy Eel', 'Raw Salmon', 'Raw Tuna', 'Raw Cave Eel',
    'Raw Lobster', 'Raw Bass', 'Raw Swordfish', 'Raw Lava Eel', 'Raw Monkfish',
    'Raw Karambwan', 'Raw Shark', 'Raw Sea Turtle', 'Infernal Eel',
    'Raw Manta Ray', 'Minnow', 'Raw Anglerfish', 'Raw Dark Crab', 'Sacred Eel',
  ],
  'Fishing Supplies': [
    'Small Fishing Net', 'Big Fishing Net', 'Fishing Rod', 'Fly Fishing Rod',
    'Harpoon', 'Lobster Pot', 'Karambwan Vessel', 'Oily Fishing Rod',
    'Barbarian Rod', 'Pearl Fishing Rod', 'Fishing Bait', 'Feather',
    'Sandworms', 'Dark Fishing Bait', 'Raw Karambwanji',
  ],
  'Runes': [
    'Air Rune', 'Water Rune', 'Earth Rune', 'Fire Rune', 'Mind Rune',
    'Chaos Rune', 'Nature Rune', 'Law Rune', 'Cosmic Rune', 'Blood Rune',
    'Soul Rune', 'Death Rune', 'Astral Rune',
  ],
  'Gear & Bones': [
    'Dragon Bones', 'Wyvern Bones', 'Abyssal Whip', 'Dark Bow', 'Black Mask',
    'Trident of the Seas', 'Occult Necklace', 'Granite Maul',
    'Leaf-Bladed Sword', 'Leaf-Bladed Battleaxe', 'Dragon Boots',
    'Rune Scimitar', 'Dragon Scimitar', 'Rune Crossbow', 'Runite Limbs',
    'Yew Stock', 'Crossbow String', 'Anti-Dragon Shield', 'Barrows Gloves',
    'Climbing Boots', 'Amulet of Glory', 'Dragonstone Amulet', 'Dragonstone',
    'Amulet of Power', 'Diamond Amulet', 'Diamond', 'Uncut Diamond',
    'Zenyte Shard', 'Uncut Zenyte', 'Uncut Onyx', 'Zenyte Amulet', 'Zenyte',
    'Amulet of Torture', 'Necklace of Anguish', 'Tormented Bracelet',
    'Elysian Spirit Shield', 'Elysian Sigil', 'Blessed Spirit Shield',
    'Spirit Shield', 'Holy Elixir', 'Godsword Blade', 'Armadyl Godsword',
    'Armadyl Hilt', 'Bandos Godsword', 'Bandos Hilt', 'Saradomin Godsword',
    'Saradomin Hilt', 'Zamorak Godsword', 'Zamorak Hilt',
    'Oak Shield', 'Maple Shield', 'Yew Shield', 'Magic Shield', 'Redwood Shield',
  ],
  'Raids & Endgame': [
    'Twisted Bow', 'Kodai Wand', 'Elder Maul', 'Dragon Claws',
    'Ancestral Robe Top', 'Ancestral Robe Bottom', 'Ancestral Hat',
    'Scythe of Vitur', 'Ghrazi Rapier', 'Sanguinesti Staff',
    'Justiciar Faceguard', 'Justiciar Chestguard', 'Justiciar Legguards',
    'Avernic Defender Hilt', "Tumeken's Shadow", "Osmumten's Fang",
    'Masori Body', 'Masori Chaps', 'Masori Mask', "Elidinis' Ward",
    'Lightbearer', 'Zaryte Crossbow', 'Torva Full Helm', 'Torva Platebody',
    'Torva Platelegs', "Inquisitor's Mace", "Inquisitor's Great Helm",
    "Inquisitor's Hauberk", "Inquisitor's Plateskirt", 'Nightmare Staff',
    'Soulreaper Axe', 'Virtus Mask', 'Virtus Robe Top', 'Virtus Robe Bottom',
    'Voidwaker', 'Voidwaker Blade', 'Voidwaker Hilt', 'Voidwaker Gem',
    'Blade of Saeldor', 'Bow of Faerdhinen', 'Crystal Armour Seed',
  ],
  'Slayer & Boss Uniques': [
    'Abyssal Bludgeon', 'Abyssal Dagger', 'Primordial Boots', 'Pegasian Boots',
    'Eternal Boots', 'Primordial Crystal', 'Pegasian Crystal',
    'Eternal Crystal', 'Ferocious Gloves', 'Hydra Leather', "Hydra's Claw",
    'Dragon Hunter Lance', 'Neitiznot Faceguard', 'Basilisk Jaw',
    'Dragonfire Shield', 'Dragonfire Ward', 'Draconic Visage',
    'Skeletal Visage', 'Toxic Blowpipe', 'Trident of the Swamp',
    'Serpentine Helm', 'Magic Fang', 'Tanzanite Fang', 'Serpentine Visage',
    'Bludgeon Axon', 'Bludgeon Claw', 'Bludgeon Spine',
    'Godsword Shard 1', 'Godsword Shard 2', 'Godsword Shard 3',
    "Executioner's Axe Head", 'Eye of the Duke', 'Leviathan Lure',
    "Siren's Staff", 'Araxyte Venom Sack', 'Ancient Essence', 'Ancient Shard',
    'Vial of Blood', 'Nail Beast Nails', 'Nihil Dust', 'Nihil Shard',
    'Helm of Neitiznot', 'Zamorakian Hasta', 'Zamorakian Spear',
  ],
  'Minigame & Skilling Uniques': [
    'Void Knight Top', 'Void Knight Robe', 'Void Knight Gloves',
    'Void Knight Helm', 'Fighter Torso', 'Rune Pouch', 'Looting Bag',
    'Herb Sack', 'Seed Box', 'Gem Bag', 'Coal Bag', 'Fish Barrel',
    'Tackle Box', 'Log Basket', 'Bottomless Compost Bucket', 'Crystal Axe',
    'Crystal Harpoon', 'Infernal Axe', 'Infernal Harpoon', 'Smouldering Stone',
    'Crystal Tool Seed', 'Infinity Boots',
  ],
  'Quest Items': [
    'Silverlight', 'Darklight', 'Arclight', 'Wolfbane', 'Excalibur',
    'Ancient Mace', 'Barrelchest Anchor', 'Keris Partisan',
  ],
  'Gems': [
    'Uncut Sapphire', 'Uncut Emerald', 'Uncut Ruby', 'Sapphire', 'Emerald',
    'Ruby', 'Opal', 'Uncut Opal', 'Red Topaz', 'Uncut Red Topaz',
    'Jade', 'Uncut Jade',
  ],
  'Cooked Food': [
    'Shrimps', 'Trout', 'Salmon', 'Lobster', 'Swordfish', 'Monkfish', 'Shark',
    'Cooked Karambwan', 'Anglerfish', 'Manta Ray',
  ],
  'Bones': [
    'Bones', 'Big Bones', 'Babydragon Bones', 'Lava Dragon Bones',
    'Superior Dragon Bones', 'Hydra Bones',
  ],
  'Tanning & Textiles': [
    'Cowhide', 'Leather', 'Hard Leather', 'Green Dragon Leather',
    'Blue Dragon Leather', 'Red Dragon Leather', 'Wool', 'Ball of Wool',
    'Thread', 'Needle',
  ],
  'Tools & Containers': [
    'Chisel', 'Knife', 'Spade', 'Pot', 'Jug', 'Bucket', 'Empty Vial',
    'Dragon Axe', 'Dragon Harpoon', 'Amulet Mould', 'Ring Mould',
    'Necklace Mould', 'Bracelet Mould',
  ],
  'Seeds': [
    'Ranarr Seed', 'Snapdragon Seed', 'Torstol Seed', 'Yew Seed', 'Magic Seed',
    'Bird Nest',
  ],
  'Ammunition': [
    'Arrow Shaft', 'Headless Arrow', 'Bronze Arrow', 'Steel Arrow',
    'Rune Arrow', 'Bronze Arrowtips', 'Steel Arrowtips', 'Rune Arrowtips',
    'Broad Arrows', 'Broad Arrowheads', 'Amethyst Arrow', 'Amethyst Arrowtips',
  ],
  'Treasure Trail Rewards': [
    'Ranger Boots', 'Robin Hood Hat', 'Holy Sandals',
  ],
  'Mastering Mixology': [
    'Noxifer', 'Golpar', 'Buchu Leaf', 'Cicely', 'Stinkhorn Mushroom',
    'Endarkened Juice', 'Aldarium', 'Huasca', 'Water-filled Gourd Vial',
    'Elder Potion', 'Elder (+)', 'Elder (-)',
    'Kodai Potion', 'Kodai (+)', 'Kodai (-)',
    'Twisted Potion', 'Twisted (+)', 'Twisted (-)',
    'Prayer Enhance', 'Prayer Enhance (+)', 'Prayer Enhance (-)',
    'Revitalisation Potion', 'Revitalisation (+)', 'Revitalisation (-)',
    "Xeric's Aid", "Xeric's Aid (+)", "Xeric's Aid (-)",
    'Overload (+)', 'Overload (-)', 'Overload (Chambers of Xeric)',
    'Goading Potion', 'Prayer Regeneration Potion',
  ],
  'Adamant Smithing': [
    'Adamant 2h Sword',
    'Adamant Arrowtips',
    'Adamant Axe',
    'Adamant Battleaxe',
    'Adamant Bolts(unf)',
    'Adamant Chainbody',
    'Adamant Claws',
    'Adamant Dagger',
    'Adamant Dart Tip',
    'Adamant Full Helm',
    'Adamant Javelin Tips',
    'Adamant Keel Parts',
    'Adamant Kiteshield',
    'Adamant Knife',
    'Adamant Longsword',
    'Adamant Mace',
    'Adamant Med Helm',
    'Adamant Platebody',
    'Adamant Platelegs',
    'Adamant Plateskirt',
    'Adamant Scimitar',
    'Adamant Sq Shield',
    'Adamant Sword',
    'Adamant Warhammer',
  ],
  'Bronze Smithing': [
    'Bronze 2h Sword',
    'Bronze Axe',
    'Bronze Battleaxe',
    'Bronze Bolts (unf)',
    'Bronze Chainbody',
    'Bronze Claws',
    'Bronze Dagger',
    'Bronze Dart Tip',
    'Bronze Full Helm',
    'Bronze Javelin Tips',
    'Bronze Keel Parts',
    'Bronze Kiteshield',
    'Bronze Knife',
    'Bronze Limbs',
    'Bronze Longsword',
    'Bronze Mace',
    'Bronze Med Helm',
    'Bronze Nails',
    'Bronze Platebody',
    'Bronze Platelegs',
    'Bronze Plateskirt',
    'Bronze Scimitar',
    'Bronze Sq Shield',
    'Bronze Sword',
    'Bronze Warhammer',
    'Bronze Wire',
  ],
  'D\'hide Armour': [
    'Black D\'hide Chaps',
    'Black D\'hide Shield',
    'Black D\'hide Vambraces',
    'Blue D\'hide Body',
    'Blue D\'hide Chaps',
    'Blue D\'hide Shield',
    'Blue D\'hide Vambraces',
    'Green D\'hide Body',
    'Green D\'hide Chaps',
    'Green D\'hide Shield',
    'Green D\'hide Vambraces',
    'Red D\'hide Body',
    'Red D\'hide Chaps',
    'Red D\'hide Shield',
    'Red D\'hide Vambraces',
  ],
  'Iron Smithing': [
    'Iron 2h Sword',
    'Iron Arrowtips',
    'Iron Axe',
    'Iron Battleaxe',
    'Iron Bolts (unf)',
    'Iron Chainbody',
    'Iron Claws',
    'Iron Dagger',
    'Iron Dart Tip',
    'Iron Full Helm',
    'Iron Javelin Tips',
    'Iron Keel Parts',
    'Iron Kiteshield',
    'Iron Knife',
    'Iron Limbs',
    'Iron Longsword',
    'Iron Mace',
    'Iron Med Helm',
    'Iron Nails',
    'Iron Platebody',
    'Iron Platelegs',
    'Iron Plateskirt',
    'Iron Scimitar',
    'Iron Sheet',
    'Iron Spit',
    'Iron Sq Shield',
    'Iron Sword',
    'Iron Warhammer',
  ],
  'Jewellery': [
    'Amulet of Bounty',
    'Amulet of Chemistry',
    'Amulet of Defence',
    'Amulet of Fury',
    'Amulet of Magic',
    'Amulet of Nature',
    'Amulet of Strength',
    'Berserker Necklace',
    'Binding Necklace',
    'Bracelet of Clay',
    'Bracelet of Slaughter',
    'Combat Bracelet',
    'Diamond Amulet (u)',
    'Diamond Bracelet',
    'Diamond Necklace',
    'Diamond Ring',
    'Dodgy Necklace',
    'Dragonstone Amulet (u)',
    'Dragonstone Bracelet',
    'Dragonstone Ring',
    'Efaritay\'s Aid',
    'Emerald Amulet',
    'Emerald Amulet (u)',
    'Emerald Bracelet',
    'Emerald Necklace',
    'Emerald Ring',
    'Expeditious Bracelet',
    'Flamtaer Bracelet',
    'Gold Amulet',
    'Gold Amulet (u)',
    'Gold Bracelet',
    'Gold Necklace',
    'Gold Ring',
    'Inoculation Bracelet',
    'Jade Amulet',
    'Jade Amulet (u)',
    'Jade Bracelet',
    'Jade Necklace',
    'Jade Ring',
    'Necklace of Faith',
    'Onyx Amulet',
    'Opal Amulet',
    'Opal Amulet (u)',
    'Opal Bracelet',
    'Opal Necklace',
    'Opal Ring',
    'Phoenix Necklace',
    'Regen Bracelet',
    'Ring of Forging',
    'Ring of Life',
    'Ring of Pursuit',
    'Ring of Recoil',
    'Ring of Stone',
    'Ring of Suffering',
    'Ring of Wealth',
    'Ruby Amulet',
    'Ruby Amulet (u)',
    'Ruby Bracelet',
    'Ruby Necklace',
    'Ruby Ring',
    'Sapphire Amulet',
    'Sapphire Amulet (u)',
    'Sapphire Bracelet',
    'Sapphire Necklace',
    'Sapphire Ring',
    'Skills Necklace',
    'Topaz Amulet',
    'Topaz Amulet (u)',
    'Topaz Bracelet',
    'Topaz Necklace',
    'Topaz Ring',
    'Onyx', 'Onyx Ring', 'Onyx Necklace', 'Onyx Bracelet', 'Onyx Amulet (u)',
    'Zenyte Ring', 'Zenyte Necklace', 'Zenyte Bracelet', 'Dragon Necklace',
  ],
  'Leather Armour': [
    'Coif',
    'Hard Leather Shield',
    'Hardleather Body',
    'Leather Body',
    'Leather Boots',
    'Leather Chaps',
    'Leather Cowl',
    'Leather Gloves',
    'Leather Vambraces',
    'Studded Body',
    'Studded Chaps',
  ],
  'Mithril Smithing': [
    'Mithril 2h Sword',
    'Mithril Arrowtips',
    'Mithril Axe',
    'Mithril Battleaxe',
    'Mithril Bolts (unf)',
    'Mithril Chainbody',
    'Mithril Claws',
    'Mithril Dagger',
    'Mithril Dart Tip',
    'Mithril Full Helm',
    'Mithril Javelin Tips',
    'Mithril Keel Parts',
    'Mithril Kiteshield',
    'Mithril Knife',
    'Mithril Limbs',
    'Mithril Longsword',
    'Mithril Mace',
    'Mithril Med Helm',
    'Mithril Nails',
    'Mithril Platebody',
    'Mithril Platelegs',
    'Mithril Plateskirt',
    'Mithril Scimitar',
    'Mithril Sq Shield',
    'Mithril Sword',
    'Mithril Warhammer',
  ],
  'Rune Smithing': [
    'Rune 2h Sword',
    'Rune Axe',
    'Rune Battleaxe',
    'Rune Chainbody',
    'Rune Claws',
    'Rune Dagger',
    'Rune Dart Tip',
    'Rune Full Helm',
    'Rune Javelin Tips',
    'Rune Keel Parts',
    'Rune Kiteshield',
    'Rune Knife',
    'Rune Longsword',
    'Rune Mace',
    'Rune Med Helm',
    'Rune Nails',
    'Rune Platebody',
    'Rune Platelegs',
    'Rune Plateskirt',
    'Rune Sq Shield',
    'Rune Sword',
    'Rune Warhammer',
  ],
  'Steel Smithing': [
    'Steel 2h Sword',
    'Steel Axe',
    'Steel Battleaxe',
    'Steel Bolts (unf)',
    'Steel Chainbody',
    'Steel Claws',
    'Steel Dagger',
    'Steel Dart Tip',
    'Steel Full Helm',
    'Steel Javelin Tips',
    'Steel Keel Parts',
    'Steel Kiteshield',
    'Steel Knife',
    'Steel Limbs',
    'Steel Longsword',
    'Steel Mace',
    'Steel Med Helm',
    'Steel Nails',
    'Steel Platebody',
    'Steel Platelegs',
    'Steel Plateskirt',
    'Steel Scimitar',
    'Steel Sq Shield',
    'Steel Studs',
    'Steel Sword',
    'Steel Warhammer',
  ],
};

// Reverse lookup: item name -> category name.
export const ITEM_CATEGORY: Record<string, string> = Object.entries(
  RESOURCE_CATEGORIES,
).reduce((acc, [category, items]) => {
  for (const item of items) acc[item] = category;
  return acc;
}, {} as Record<string, string>);
