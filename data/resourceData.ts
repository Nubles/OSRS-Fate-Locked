
import { DropSource, TableType } from '../types';

export type SourceType = 'DROP' | 'SHOP' | 'SPAWN' | 'SKILL' | 'MINIGAME' | 'MERCHANT' | 'QUEST';

export interface ResourceSource {
  type: SourceType;
  name: string; // e.g. "Chaos Druid", "Farming Patch", "General Store"
  regions: string[]; // List of regions where this specific source exists
  skills?: Record<string, number>; // Specific levels required to access/kill
  quests?: string[];
  unlockId?: string; // Specific unlock ID from TableType (e.g. 'Farming Guild')
  notes?: string; // e.g. "Edgeville Dungeon"
  inputs?: Record<string, number>; // Ingredients -> Quantity
  outputYield?: number; // How many items are produced per operation (default 1)
}

export const RESOURCE_MAP: Record<string, ResourceSource[]> = {
  // --- HERBS ---
  'Ranarr Weed': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Misthalin', 'Kandarin', 'Morytania', 'Kourend & Kebos', 'Tirannwn', 'Fremennik', 'Varlamore'], skills: { 'Farming': 32 }, notes: 'Requires Seeds', outputYield: 8 }, 
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin', 'Wilderness'], notes: 'Edgeville Dungeon / Yanille / Wildy' },
    { type: 'DROP', name: 'Aberrant Spectre', regions: ['Morytania', 'Kandarin', 'Kourend & Kebos'], skills: { 'Slayer': 60 }, notes: 'Slayer Tower / Catacombs' },
    { type: 'DROP', name: 'Flesh Crawler', regions: ['Misthalin'], notes: 'Stronghold of Security' },
    { type: 'MINIGAME', name: 'Sinister Chest', regions: ['Kandarin'], skills: {'Agility': 40}, unlockId: 'Sinister Chest', notes: 'Requires Sinister Key' }
  ],
  'Snapdragon': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Misthalin', 'Kandarin', 'Morytania', 'Kourend & Kebos', 'Tirannwn', 'Fremennik', 'Varlamore'], skills: { 'Farming': 62 }, notes: 'Requires Seeds', outputYield: 8 },
    { type: 'DROP', name: 'Nechryael', regions: ['Morytania', 'Kourend & Kebos'], skills: { 'Slayer': 80 } },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah', notes: 'Boss Drop' },
    { type: 'DROP', name: 'Hydra', regions: ['Kourend & Kebos'], skills: {'Slayer': 95}, notes: 'Karuulm Dungeon' }
  ],
  'Torstol': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Misthalin', 'Kandarin', 'Morytania', 'Kourend & Kebos', 'Tirannwn', 'Fremennik', 'Varlamore'], skills: { 'Farming': 85 }, notes: 'Requires Seeds', outputYield: 8 },
    { type: 'MINIGAME', name: 'Sinister Chest', regions: ['Kandarin'], skills: {'Agility': 40}, unlockId: 'Sinister Chest', notes: 'Guaranteed Drop' },
    { type: 'DROP', name: 'Commander Zilyana', regions: ['Asgarnia'], unlockId: 'Commander Zilyana' },
    { type: 'DROP', name: 'Thermonuclear Smoke Devil', regions: ['Kandarin'], skills: {'Slayer': 93}, unlockId: 'Thermonuclear Smoke Devil' }
  ],
  'Irit Leaf': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 44}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin'] },
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
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin'] },
    { type: 'DROP', name: 'Turoth', regions: ['Fremennik'], skills: {'Slayer': 55} }
  ],
  'Lantadyme': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 73}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Zulrah', regions: ['Tirannwn'], unlockId: 'Zulrah' },
    { type: 'DROP', name: 'Steel Dragon', regions: ['Karamja', 'Kourend & Kebos'] }
  ],
  'Harralander': [
    { type: 'SKILL', name: 'Herb Patch', regions: ['Any'], skills: {'Farming': 26}, notes: 'Seed required', outputYield: 8 },
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin'] }
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
    { type: 'DROP', name: 'Demonic Gorilla', regions: ['Kandarin'], skills: {'Slayer': 69}, quests: ['Monkey Madness II'] }
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
    { type: 'DROP', name: 'Spidine', regions: ['Kandarin'], unlockId: 'Tower of Life (Spidines)', notes: 'Tower of Life (Fastest)', outputYield: 3 },
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
    { type: 'DROP', name: 'Hill Giant', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Wilderness'], notes: 'Common drop' }
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
    { type: 'DROP', name: 'Chaos Druid', regions: ['Misthalin', 'Kandarin'] }
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
    { type: 'MINIGAME', name: 'Kingdom of Miscellania', regions: ['Fremennik'], unlockId: 'Managing Miscellania' }
  ],
  'Mahogany Logs': [
    { type: 'SKILL', name: 'Woodcutting', regions: ['Karamja', 'Islands & Others', 'Kourend & Kebos'], skills: {'Woodcutting': 50} },
    { type: 'SKILL', name: 'Hardwood Patch', regions: ['Islands & Others'], skills: {'Farming': 55}, outputYield: 20 },
    { type: 'MINIGAME', name: 'Kingdom of Miscellania', regions: ['Fremennik'], unlockId: 'Managing Miscellania' }
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
    { type: 'DROP', name: 'Black Dragon', regions: ['Asgarnia'], notes: 'Taverley Dungeon' },
    { type: 'DROP', name: 'Black Dragon', regions: ['Kandarin'], quests: ['Dragon Slayer II'], notes: 'Myths\' Guild' },
    { type: 'DROP', name: 'KBD', regions: ['Wilderness'], unlockId: 'King Black Dragon' },
    { type: 'DROP', name: 'Brutal Black Dragon', regions: ['Kourend & Kebos'], skills: {'Slayer': 77}, notes: 'Catacombs' },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath' }
  ],
  'Red Dragonhide': [
    { type: 'DROP', name: 'Red Dragon', regions: ['Karamja'], notes: 'Brimhaven Dungeon' },
    { type: 'DROP', name: 'Red Dragon', regions: ['Kourend & Kebos'], notes: 'Forthos Dungeon' },
    { type: 'DROP', name: 'Brutal Red Dragon', regions: ['Kourend & Kebos'], skills: {'Slayer': 57} }
  ],
  'Blue Dragonhide': [
    { type: 'DROP', name: 'Blue Dragon', regions: ['Asgarnia'], notes: 'Taverley Dungeon / Heroes Guild' },
    { type: 'DROP', name: 'Blue Dragon', regions: ['Kandarin'], notes: 'Ogre Enclave / Myths Guild' },
    { type: 'DROP', name: 'Vorkath', regions: ['Fremennik'], unlockId: 'Vorkath', notes: 'Guaranteed 2x' }
  ],
  'Green Dragonhide': [
    { type: 'DROP', name: 'Green Dragon', regions: ['Wilderness'], notes: 'Revs/Graveyard/East Wildy' },
    { type: 'DROP', name: 'Green Dragon', regions: ['Kandarin'], quests: ['Dragon Slayer II'], notes: 'Myths Guild' },
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
    { type: 'MINIGAME', name: 'Kingdom of Miscellania', regions: ['Fremennik'], unlockId: 'Managing Miscellania', notes: 'Passive Gathering', outputYield: 400 },
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
  'Calcified Shards': [
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
    { type: 'DROP', name: 'Aviansie', regions: ['Asgarnia'], skills: {'Agility': 70}, notes: 'Noted (Fremennik Hard)' },
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
    { type: 'DROP', name: 'Spiritual Mage', regions: ['Asgarnia', 'Wilderness'], skills: {'Slayer': 83} },
    { type: 'MINIGAME', name: 'Zalcano', regions: ['Tirannwn'], unlockId: 'Zalcano', outputYield: 15 }
  ],
  'Mithril Bar': [
    { type: 'SKILL', name: 'Blast Furnace', regions: ['Fremennik'], skills: {'Smithing': 50}, inputs: {'Mithril Ore': 1, 'Coal': 2}, notes: 'Requires 2 Coal at BF' },
    { type: 'DROP', name: 'Mithril Dragon', regions: ['Kandarin'], notes: 'Ancient Cavern' },
    { type: 'DROP', name: 'Gargoyle', regions: ['Morytania'], skills: {'Slayer': 75} }
  ],
  'Adamantite Bar': [
    { type: 'SKILL', name: 'Blast Furnace', regions: ['Fremennik'], skills: {'Smithing': 70}, inputs: {'Adamantite Ore': 1, 'Coal': 3}, notes: 'Requires 3 Coal at BF' },
    { type: 'DROP', name: 'Aviansie', regions: ['Asgarnia'], skills: {'Agility': 70} },
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
    { type: 'DROP', name: 'Zombie', regions: ['Wilderness'] }
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
    { type: 'DROP', name: 'Moss Giant', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Karamja', 'Wilderness', 'Kourend & Kebos'] },
    { type: 'SHOP', name: 'Mage Arena Shop', regions: ['Wilderness'], notes: 'Lundail' },
    { type: 'SHOP', name: 'Magic Guild Store', regions: ['Kandarin'], skills: {'Magic': 66} },
    { type: 'DROP', name: 'Kurask', regions: ['Fremennik', 'Tirannwn'], skills: {'Slayer': 70} },
    { type: 'DROP', name: 'Basilisk', regions: ['Fremennik'], skills: {'Slayer': 40} }
  ],
  'Law Rune': [
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Asgarnia'], skills: { 'Runecraft': 54 }, notes: 'Entrana (No weapons allowed)' },
    { type: 'SHOP', name: 'Mage Arena Shop', regions: ['Wilderness'], notes: 'Lundail' },
    { type: 'DROP', name: 'Hill Giant', regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Kourend & Kebos', 'Wilderness'] },
    { type: 'DROP', name: 'Cockatrice', regions: ['Fremennik'], skills: {'Slayer': 25} }
  ],
  'Cosmic Rune': [
    { type: 'SKILL', name: 'Runecraft Altar', regions: ['Misthalin'], skills: { 'Runecraft': 27 }, notes: 'Zanaris (Lost City)' },
    { type: 'SHOP', name: 'Mage Arena Shop', regions: ['Wilderness'], notes: 'Lundail' },
    { type: 'SHOP', name: 'Ali\'s Discount Wares', regions: ['Kharidian Desert'], quests: ['The Feud'], notes: 'Pollnivneach' }
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
    { type: 'DROP', name: 'Spiritual Mage', regions: ['Asgarnia', 'Wilderness'], skills: {'Slayer': 83} },
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
    { type: 'DROP', name: 'Green Dragon', regions: ['Kandarin'], quests: ['Dragon Slayer II'], notes: 'Myths\' Guild' },
    { type: 'DROP', name: 'Blue Dragon', regions: ['Asgarnia'], notes: 'Taverley Dungeon / Heroes Guild' },
    { type: 'DROP', name: 'Blue Dragon', regions: ['Kandarin'], notes: 'Ogre Enclave' },
    { type: 'DROP', name: 'Red Dragon', regions: ['Karamja'], notes: 'Brimhaven Dungeon' },
    { type: 'DROP', name: 'Red Dragon', regions: ['Kourend & Kebos'], notes: 'Forthos Dungeon' },
    { type: 'DROP', name: 'Black Dragon', regions: ['Asgarnia'], notes: 'Taverley Dungeon' },
    { type: 'DROP', name: 'Black Dragon', regions: ['Kandarin'], quests: ['Dragon Slayer II'], notes: 'Myths\' Guild' },
    { type: 'DROP', name: 'Black Dragon', regions: ['Kourend & Kebos'], notes: 'Catacombs' },
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
    { type: 'DROP', name: 'Spiritual Mage', regions: ['Asgarnia', 'Wilderness'], skills: {'Slayer': 83}, notes: 'God Wars Dungeon' }
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
    { type: 'DROP', name: 'Aviansie', regions: ['Asgarnia'], skills: {'Agility': 70} }
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
    { type: 'DROP', name: 'Demonic Gorilla', regions: ['Kandarin'], skills: {'Slayer': 69}, quests: ['Monkey Madness II'], notes: '1/300 Drop' }
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
    { type: 'DROP', name: 'Kree\'arra', regions: ['Asgarnia'], unlockId: 'Kree\'arra' }
  ],
  'Bandos Godsword': [
    { type: 'SKILL', name: 'Assembly', regions: ['Any'], inputs: {'Godsword Blade': 1, 'Bandos Hilt': 1} }
  ],
  'Bandos Hilt': [
    { type: 'DROP', name: 'General Graardor', regions: ['Asgarnia'], unlockId: 'General Graardor' }
  ],
  'Saradomin Godsword': [
    { type: 'SKILL', name: 'Assembly', regions: ['Any'], inputs: {'Godsword Blade': 1, 'Saradomin Hilt': 1} }
  ],
  'Saradomin Hilt': [
    { type: 'DROP', name: 'Commander Zilyana', regions: ['Asgarnia'], unlockId: 'Commander Zilyana' }
  ],
  'Zamorak Godsword': [
    { type: 'SKILL', name: 'Assembly', regions: ['Any'], inputs: {'Godsword Blade': 1, 'Zamorak Hilt': 1} }
  ],
  'Zamorak Hilt': [
    { type: 'DROP', name: 'K\'ril Tsutsaroth', regions: ['Asgarnia'], unlockId: 'K\'ril Tsutsaroth' }
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
    { type: 'DROP', name: 'Chambers of Xeric', regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' },
    { type: 'DROP', name: 'Tormented Demon', regions: ['Misthalin'], quests: ['While Guthix Sleeps'] }
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
    { type: 'DROP', name: 'Nex', regions: ['Asgarnia'], unlockId: 'Nex' }
  ],
  'Torva Full Helm': [
    { type: 'DROP', name: 'Nex', regions: ['Asgarnia'], unlockId: 'Nex' }
  ],
  'Torva Platebody': [
    { type: 'DROP', name: 'Nex', regions: ['Asgarnia'], unlockId: 'Nex' }
  ],
  'Torva Platelegs': [
    { type: 'DROP', name: 'Nex', regions: ['Asgarnia'], unlockId: 'Nex' }
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
    { type: 'DROP', name: 'Duke Sucellus', regions: ['Kourend & Kebos'], unlockId: 'Duke Sucellus' },
    { type: 'DROP', name: 'The Leviathan', regions: ['Kourend & Kebos'], unlockId: 'The Leviathan' },
    { type: 'DROP', name: 'The Whisperer', regions: ['Kourend & Kebos'], unlockId: 'The Whisperer' },
    { type: 'DROP', name: 'Vardorvis', regions: ['Kourend & Kebos'], unlockId: 'Vardorvis' }
  ],
  'Virtus Robe Top': [
    { type: 'DROP', name: 'Duke Sucellus', regions: ['Kourend & Kebos'], unlockId: 'Duke Sucellus' },
    { type: 'DROP', name: 'The Leviathan', regions: ['Kourend & Kebos'], unlockId: 'The Leviathan' },
    { type: 'DROP', name: 'The Whisperer', regions: ['Kourend & Kebos'], unlockId: 'The Whisperer' },
    { type: 'DROP', name: 'Vardorvis', regions: ['Kourend & Kebos'], unlockId: 'Vardorvis' }
  ],
  'Virtus Robe Bottom': [
    { type: 'DROP', name: 'Duke Sucellus', regions: ['Kourend & Kebos'], unlockId: 'Duke Sucellus' },
    { type: 'DROP', name: 'The Leviathan', regions: ['Kourend & Kebos'], unlockId: 'The Leviathan' },
    { type: 'DROP', name: 'The Whisperer', regions: ['Kourend & Kebos'], unlockId: 'The Whisperer' },
    { type: 'DROP', name: 'Vardorvis', regions: ['Kourend & Kebos'], unlockId: 'Vardorvis' }
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
    { type: 'DROP', name: 'Abyssal Sire', regions: ['Kourend & Kebos'], unlockId: 'Abyssal Sire' }
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
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: {'Smithing': 90}, inputs: {'Draconic Visage': 1, 'Anti-dragon Shield': 1}, notes: 'Or pay Oziach 1.25m' }
  ],
  'Dragonfire Ward': [
    { type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: {'Smithing': 90}, inputs: {'Skeletal Visage': 1, 'Anti-dragon Shield': 1}, notes: 'Or pay Oziach 1.25m' }
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
  ]
};
