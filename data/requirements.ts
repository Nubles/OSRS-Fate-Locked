import { TableType } from '../types';
import type { QuestProgressRequirement } from './questProgress';
import { QUEST_DATA } from './questData';
import { enforcedQuestAreas } from '../utils/questGeographyDisplay';

export interface ContentAlternativeRequirement {
  label: string;
  routes: Array<{
    label: string;
    blockers: Array<{ kind: string; label: string }>;
  }>;
}

export interface ContentRequirement {
  id: string;
  category: TableType;
  regions: string[];
  skills: Record<string, number>;
  questPoints?: number;
  quests?: string[];     // Specific quest prerequisites — must match QUEST_DATA entries.
  diaries?: string[];    // Specific Achievement Diary tier IDs — must match DIARY_DATA entries.
  description?: string;
  items?: string[];      // Optional specific item requirements
  manualRequirements?: string[];
  /** A quest that must be started: a check until the quest is completed, which proves it (data/questProgress.ts). */
  questProgress?: QuestProgressRequirement[];
  alternatives?: ContentAlternativeRequirement[]; // One complete route is sufficient.
  accessRoutes?: Array<{ label: string; skills?: Record<string, number>; diaries?: string[] }>;
  /** Borrow this activity's readiness (data/activityRequirements.ts) when the id is another unlock. */
  activity?: string;
  /**
   * A Key this entry needs besides its id's own: any one of these names, each
   * looked up in the keyed table that rolls it (fairy rows need 'Fairy Rings').
   */
  needsKey?: string[];
}

// Wiki 'Karuulm Slayer Dungeon': past the entrance chamber the floor burns without these boots.
const KARUULM_HEAT = 'Wear boots of stone, boots of brimstone or granite boots past the Karuulm Slayer Dungeon entrance (not needed with the Kourend & Kebos Elite reward)';
// Wiki 'Wyrm': wyrms also live in the Wyrmscraig Cavern, which needs no boots.
const KARUULM_HEAT_OR_WYRMSCRAIG = KARUULM_HEAT + ', or fight wyrms in the Wyrmscraig Cavern partway through Fallen From Grace';
// Wiki 'God Wars Dungeon': partial Troll Stronghold or the full Easy Combat Achievements tier.
const GOD_WARS_ENTRY = 'God Wars Dungeon access through Troll Stronghold progress (defeated Dad) or the Easy Combat Achievement hilt teleport; the Wilderness God Wars Dungeon needs neither';
// Wiki 'Fairy ring': Fairytale I completed, Fairytale II only started (same wording as the 'Fairy Rings' activity).
export const FAIRY_RING_ACCESS = 'Reached fairy ring access during Fairytale II - Cure a Queen (full completion is not required)';
const FAIRY_RING_PROGRESS: QuestProgressRequirement = { quest: 'Fairytale II - Cure a Queen', label: FAIRY_RING_ACCESS };
// The Fremennik Isles started: Mord and Maria Gunnars ferry you to Jatizso and Neitiznot.
const FREMENNIK_ISLES_STARTED: QuestProgressRequirement = { quest: 'The Fremennik Isles', label: 'Confirm you have started The Fremennik Isles' };
// Wiki 'Smoke devil': a facemask or Slayer helmet is needed to kill them; the gas mask also works.
const SMOKE_DEVIL_FACE = 'Wear a facemask, gas mask or Slayer helmet.';

export const STRATEGY_DATABASE: Record<string, ContentRequirement> = {
  // ============================================================================
  // GRANDMASTER QUESTS (End-Game Goals)
  // ============================================================================
  'Dragon Slayer II': {
    id: 'Dragon Slayer II',
    category: TableType.QUESTS,
    regions: ['Misthalin', 'Kandarin', 'Fremennik', 'Kourend & Kebos'], // Starts Myths Guild but involves many
    skills: { 
      'Magic': 75, 'Smithing': 70, 'Mining': 68, 'Crafting': 62,
      'Agility': 60, 'Thieving': 60, 'Construction': 50, 'Hitpoints': 50
    },
    quests: ['Legends\' Quest', 'Dream Mentor', 'A Tail of Two Cats', 'Animal Magnetism', 'Ghosts Ahoy', 'Bone Voyage', 'Client of Kourend'],
    description: 'Unlocks Vorkath, Rune Dragons, Myths\' Guild, Ava\'s Assembler.'
  },
  'Song of the Elves': {
    id: 'Song of the Elves',
    category: TableType.QUESTS,
    regions: ['Tirannwn', 'Kandarin'], // Starts in Ardougne/Lletya
    skills: { 
      'Agility': 70, 'Construction': 70, 'Farming': 70, 'Herblore': 70, 
      'Hunter': 70, 'Mining': 70, 'Smithing': 70, 'Woodcutting': 70 
    },
    quests: ['Mourning\'s End Part II'],
    description: 'Unlocks Prifddinas, Zalcano, Gauntlet, Crystal Tools.'
  },
  'Monkey Madness II': {
    id: 'Monkey Madness II',
    category: TableType.QUESTS,
    regions: ['Islands & Others', 'Kandarin'], // Ape Atoll / Gnome Stronghold
    skills: { 
      'Slayer': 69, 'Crafting': 70, 'Hunter': 60, 'Agility': 55, 
      'Thieving': 55, 'Firemaking': 60 
    },
    quests: ['Monkey Madness I', 'Enlightened Journey', 'The Eyes of Glouphrie', 'Troll Stronghold', 'Watchtower', 'RFD: King Awowogei'],
    description: 'Unlocks Demonic Gorillas (Zenytes), Heavy Ballista, Royal Seed Pod.'
  },
  'Desert Treasure II': {
    id: 'Desert Treasure II',
    category: TableType.QUESTS,
    regions: ['Kharidian Desert', 'Asgarnia', 'Fremennik', 'Kourend & Kebos', 'Morytania'], // Global
    skills: { 
      'Magic': 75, 'Firemaking': 75, 'Thieving': 70, 'Herblore': 62, 
      'Runecraft': 60, 'Construction': 60, 'Prayer': 60 
    },
    quests: ['Desert Treasure I', 'Secrets of the North', 'Enakhra\'s Lament', 'Temple of the Eye', 'The Garden of Death', 'Below Ice Mountain'],
    description: 'Unlocks 4 new bosses (Vardorvis, Duke, Whisperer, Leviathan) and Ancient Rings.'
  },
  'While Guthix Sleeps': {
    id: 'While Guthix Sleeps',
    category: TableType.QUESTS,
    regions: ['Misthalin', 'Asgarnia', 'Kandarin'],
    skills: { 
      'Thieving': 72, 'Magic': 65, 'Herblore': 57, 'Agility': 56, 
      'Farming': 65, 'Hunter': 55 
    },
    quests: ['Dream Mentor', 'Legends\' Quest', 'The Path of Glouphrie'],
    description: 'Unlocks Tormented Demons (Burning Claws/Synapse).'
  },

  // ============================================================================
  // MASTER & UNLOCK QUESTS (Mid-Game)
  // ============================================================================
  'Desert Treasure I': {
    id: 'Desert Treasure I',
    category: TableType.QUESTS,
    regions: ['Kharidian Desert', 'Asgarnia', 'Kandarin', 'Misthalin', 'Wilderness'],
    skills: { 'Thieving': 53, 'Firemaking': 50, 'Slayer': 10, 'Magic': 50 },
    quests: ['The Dig Site', 'Temple of Ikov', 'The Tourist Trap', 'Troll Stronghold', 'Priest in Peril', 'Waterfall Quest'],
    description: 'Unlocks Ancient Magicks.'
  },
  'Lunar Diplomacy': {
    id: 'Lunar Diplomacy',
    category: TableType.QUESTS,
    regions: ['Fremennik'], // Lunar Isle
    skills: { 'Crafting': 61, 'Defence': 40, 'Firemaking': 49, 'Magic': 65, 'Mining': 60, 'Woodcutting': 55 },
    quests: ['The Fremennik Trials', 'Lost City', 'Rune Mysteries', 'Shilo Village'],
    description: 'Unlocks Lunar Spellbook.'
  },
  'Recipe for Disaster': {
    id: 'Recipe for Disaster',
    category: TableType.QUESTS,
    regions: ['Misthalin'], // Lumbridge start
    skills: { 'Cooking': 70, 'Agility': 48, 'Mining': 50, 'Fishing': 53, 'Thieving': 53, 'Herblore': 25, 'Magic': 59, 'Smithing': 40, 'Firemaking': 50, 'Ranged': 40, 'Crafting': 40, 'Fletching': 10, 'Slayer': 10, 'Woodcutting': 36 },
    quests: ['Desert Treasure I', 'Horror from the Deep', 'Monkey Madness I', 'Legends\' Quest'], // And many more
    description: 'Unlocks Barrows Gloves.'
  },
  'King\'s Ransom': {
    id: 'King\'s Ransom',
    category: TableType.QUESTS,
    regions: ['Kandarin', 'Asgarnia'], // Camelot / Black Knights
    skills: { 'Magic': 45, 'Defence': 65 },
    quests: ['Black Knights\' Fortress', 'Holy Grail', 'Murder Mystery', 'One Small Favour'],
    description: 'Unlocks Piety and Chivalry prayers.'
  },
  'Sins of the Father': {
    id: 'Sins of the Father',
    category: TableType.QUESTS,
    regions: ['Morytania'], // Darkmeyer
    skills: { 'Woodcutting': 62, 'Fletching': 60, 'Crafting': 56, 'Agility': 52, 'Slayer': 50 },
    quests: ['A Taste of Hope', 'Vampyre Slayer'],
    description: 'Unlocks Darkmeyer, Blisterwood, and Daeyalt Essence.'
  },
  'A Kingdom Divided': {
    id: 'A Kingdom Divided',
    category: TableType.QUESTS,
    regions: ['Kourend & Kebos'],
    skills: { 'Agility': 54, 'Thieving': 52, 'Woodcutting': 52, 'Herblore': 50, 'Mining': 42, 'Crafting': 38, 'Magic': 35 },
    quests: ['The Depths of Despair', 'The Queen of Thieves', 'Tale of the Righteous', 'The Forsaken Tower', 'The Ascent of Arceuus'], // Xeric's questline
    description: 'Unlocks 24 Arceuus spells, including the thralls (the spellbook itself needs no quest).'
  },
  'Beneath Cursed Sands': {
    id: 'Beneath Cursed Sands',
    category: TableType.QUESTS,
    regions: ['Kharidian Desert'],
    skills: { 'Agility': 62, 'Crafting': 55, 'Firemaking': 55 },
    quests: ['Contact!'],
    description: 'Unlocks Tombs of Amascut (ToA) and Keris Partisan.'
  },
  'Dragon Slayer I': {
    id: 'Dragon Slayer I',
    category: TableType.QUESTS,
    regions: ['Misthalin', 'Asgarnia', 'Karamja'],
    skills: {}, // 32 QP
    description: 'Unlocks Rune Platebody, Green D\'hide Body, Anti-Dragon Shield.'
  },
  'Monkey Madness I': {
    id: 'Monkey Madness I',
    category: TableType.QUESTS,
    regions: ['Islands & Others', 'Kandarin'], // Ape Atoll
    skills: {},
    quests: ['The Grand Tree', 'Tree Gnome Village'],
    description: 'Unlocks Dragon Scimitar.'
  },
  'Roving Elves': {
    id: 'Roving Elves',
    category: TableType.QUESTS,
    regions: ['Tirannwn'],
    skills: { 'Agility': 56 },
    quests: ['Regicide', 'Waterfall Quest'],
    description: 'Unlocks Crystal Bow and Shield.'
  },
  'Regicide': {
    id: 'Regicide',
    category: TableType.QUESTS,
    regions: ['Tirannwn', 'Kandarin'],
    skills: { 'Agility': 56, 'Crafting': 10 },
    quests: ['Underground Pass'],
    description: 'Unlocks Dragon Halberd, Zulrah access, Tirannwn access.'
  },
  'Underground Pass': {
    id: 'Underground Pass',
    category: TableType.QUESTS,
    regions: ['Kandarin', 'Tirannwn'], // West Ardougne
    skills: { 'Ranged': 25 },
    quests: ['Biohazard'],
    description: 'Unlocks Iban\'s Staff (Iban Blast).'
  },
  'Cabin Fever': {
    id: 'Cabin Fever',
    category: TableType.QUESTS,
    regions: ['Islands & Others'], // Mos Le'Harmless
    skills: { 'Ranged': 40, 'Smithing': 50, 'Crafting': 45 },
    quests: ['Pirate\'s Treasure', 'Rum Deal'],
    description: 'Unlocks Mos Le\'Harmless and Cave Horrors (Black Mask).'
  },
  'The Fremennik Exiles': {
    id: 'The Fremennik Exiles',
    category: TableType.QUESTS,
    regions: ['Fremennik'],
    skills: { 'Crafting': 65, 'Slayer': 60, 'Smithing': 60, 'Fishing': 60, 'Runecraft': 55 },
    quests: ['The Fremennik Isles', 'Lunar Diplomacy', 'Mountain Daughter', 'Heroes\' Quest'],
    description: 'Unlocks Basilisk Knights (Jaw) and Neitiznot Faceguard.'
  },
  'The Slug Menace': {
    id: 'The Slug Menace',
    category: TableType.QUESTS,
    regions: ['Asgarnia', 'Kandarin'], // Witchaven/Falador
    skills: { 'Crafting': 30, 'Runecraft': 30, 'Slayer': 30, 'Thieving': 30 },
    quests: ['Sea Slug', 'Wanted!'],
    description: 'Unlocks Proselyte Armor.'
  },
  'Animal Magnetism': {
    id: 'Animal Magnetism',
    category: TableType.QUESTS,
    regions: ['Misthalin', 'Morytania'], // Draynor / Manor
    skills: { 'Slayer': 18, 'Crafting': 19, 'Ranged': 30, 'Woodcutting': 35 },
    quests: ['The Restless Ghost', 'Ernest the Chicken', 'Priest in Peril'],
    description: 'Unlocks Ava\'s Accumulator (Ammo saving).'
  },
  'Heroes\' Quest': {
    id: 'Heroes\' Quest',
    category: TableType.QUESTS,
    regions: ['Asgarnia', 'Misthalin', 'Kandarin', 'Karamja'],
    skills: { 'Cooking': 53, 'Fishing': 53, 'Herblore': 25, 'Mining': 50 },
    quests: ['Shield of Arrav', 'Lost City', 'Merlin\'s Crystal', 'Dragon Slayer I', 'Druidic Ritual'],
    description: 'Unlocks Dragon Battleaxe/Mace and Charge Glory.'
  },
  'Throne of Miscellania': {
    id: 'Throne of Miscellania',
    category: TableType.QUESTS,
    regions: ['Fremennik'],
    skills: { 'Woodcutting': 45, 'Farming': 10, 'Mining': 30, 'Fishing': 35 },
    quests: ['The Fremennik Trials', 'Heroes\' Quest'],
    description: 'Unlocks Kingdom Management (Passive resources).'
  },
  'Family Crest': {
    id: 'Family Crest',
    category: TableType.QUESTS,
    regions: ['Asgarnia', 'Kandarin', 'Misthalin', 'Kharidian Desert'],
    skills: { 'Mining': 40, 'Smithing': 40, 'Magic': 59, 'Crafting': 40 },
    description: 'Unlocks Goldsmith Gauntlets (XP boost) and Cooking Gauntlets (Burn rate).'
  },
  'Fairytale II - Cure a Queen': {
    id: 'Fairytale II',
    category: TableType.QUESTS,
    regions: ['Misthalin', 'Islands & Others'], // Zanaris
    skills: { 'Farming': 49, 'Herblore': 57, 'Thieving': 40 },
    quests: ['Fairytale I - Growing Pains', 'Lost City', 'Nature Spirit'],
    description: 'Unlocks Fairy Ring Network (Start quest only required).'
  },
  'Tree Gnome Village': {
    id: 'Tree Gnome Village',
    category: TableType.QUESTS,
    regions: ['Kandarin'],
    skills: {},
    description: 'Unlocks Spirit Tree network.'
  },
  'The Grand Tree': {
    id: 'The Grand Tree',
    category: TableType.QUESTS,
    regions: ['Kandarin'],
    skills: { 'Agility': 25 },
    description: 'Unlocks Gnome Gliders.'
  },
  'Bone Voyage': {
    id: 'Bone Voyage',
    category: TableType.QUESTS,
    regions: ['Misthalin'], // Varrock Museum
    skills: {},
    quests: ['The Dig Site'],
    description: 'Unlocks Fossil Island (Birdhouses/Ammonite Crabs).'
  },
  'Druidic Ritual': {
    id: 'Druidic Ritual',
    category: TableType.QUESTS,
    regions: ['Asgarnia'], // Taverley
    skills: {},
    description: 'Unlocks Herblore skill.'
  },
  'Priest in Peril': {
    id: 'Priest in Peril',
    category: TableType.QUESTS,
    regions: ['Misthalin'], // Paterdomus
    skills: {},
    description: 'Unlocks Morytania access.'
  },
  'Death Plateau': {
    id: 'Death Plateau',
    category: TableType.QUESTS,
    regions: ['Asgarnia'], // Burthorpe
    skills: {},
    description: 'Unlocks Climbing Boots and Trollheim access.'
  },
  'Lost City': {
    id: 'Lost City',
    category: TableType.QUESTS,
    regions: ['Misthalin'], // Lumbridge Swamp
    skills: { 'Woodcutting': 36, 'Crafting': 31 },
    description: 'Unlocks Zanaris and Dragon Longsword/Dagger.'
  },
  'Plague City': {
    id: 'Plague City',
    category: TableType.QUESTS,
    regions: ['Kandarin'], // Ardougne
    skills: {},
    description: 'Unlocks Ardougne Teleport spell.'
  },
  'Eadgar\'s Ruse': {
    id: 'Eadgar\'s Ruse',
    category: TableType.QUESTS,
    regions: ['Asgarnia', 'Kandarin'], // Trollheim
    skills: { 'Herblore': 31 },
    quests: ['Druidic Ritual', 'Troll Stronghold'],
    description: 'Unlocks Trollheim Teleport spell.'
  },
  'Enlightened Journey': {
    id: 'Enlightened Journey',
    category: TableType.QUESTS,
    regions: ['Kandarin', 'Asgarnia', 'Misthalin'], // Entrana
    skills: { 'Firemaking': 20, 'Farming': 30, 'Crafting': 36 },
    description: 'Unlocks Balloon Transport network.'
  },
  'Ghosts Ahoy': {
    id: 'Ghosts Ahoy',
    category: TableType.QUESTS,
    regions: ['Morytania'], // Port Phasmatys
    skills: { 'Agility': 25, 'Cooking': 20 },
    quests: ['Priest in Peril', 'The Restless Ghost'],
    description: 'Unlocks Ectophial (Teleport).'
  },
  'The Heart of Darkness': {
    id: 'The Heart of Darkness', 
    category: TableType.QUESTS,
    regions: ['Cam Torum'],
    skills: { 'Mining': 55, 'Thieving': 48, 'Slayer': 48, 'Agility': 46 },
    quests: ['Twilight\'s Promise', 'Meat and Greet'],
    description: 'Unlocks The Final Dawn prerequisites.'
  },

  // ============================================================================
  // VARLAMORE & NEW CONTENT
  // ============================================================================
  'Wealthy Citizens': {
    id: 'Wealthy Citizens',
    category: TableType.MINIGAMES, // Thieving Activity
    regions: ['Varlamore'], // Civitas illa Fortis
    skills: { 'Thieving': 50 },
    quests: ['Children of the Sun'],
    description: 'Thieving method for House Keys/Valuables.'
  },
  'Calcified Rocks': {
    id: 'Calcified Rocks',
    category: TableType.MINIGAMES, // Mining Activity
    regions: ['Varlamore'], // Cam Torum
    skills: { 'Mining': 41 },
    quests: ['Perilous Moons'], // Partial: Cam Torum opens mid-quest
    description: 'AFK Mining for blessed bone shards and calcified deposits.'
  },
  'Sulphur Naguas': {
    id: 'Sulphur Naguas',
    category: TableType.MINIGAMES, // Combat Activity
    regions: ['Varlamore'], // Neypotzli
    skills: { 'Slayer': 48 }, // Technically no slayer req to kill, but effectively slayer creature? Actually 0 req.
    quests: ['Perilous Moons'],
    description: 'Zero-supply combat training (Free potions).'
  },
  'Hunter Rumours': {
    id: 'Hunter Guild',
    category: TableType.MINIGAMES, // Activity
    regions: ['Varlamore'], // Hunter Guild
    skills: { 'Hunter': 46 },
    description: 'Slayer-style tasks for Hunter. Good loot sacks.'
  },
  'Wyrms': {
    id: 'Wyrms',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Karuulm
    skills: { 'Slayer': 62 },
    manualRequirements: [KARUULM_HEAT_OR_WYRMSCRAIG],
    description: 'Source of Dragon Shortsword/Harpoon.'
  },
  'Drakes': {
    id: 'Drakes',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Karuulm
    skills: { 'Slayer': 84 },
    manualRequirements: [KARUULM_HEAT],
    description: 'Source of Drake\'s Tooth/Claw (Boots).'
  },
  'Hydras': {
    id: 'Hydras',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Karuulm
    skills: { 'Slayer': 95 },
    manualRequirements: [KARUULM_HEAT],
    description: 'Regular Hydras (if boss not available).'
  },

  // ============================================================================
  // WILDERNESS UTILITIES & ZONES
  // ============================================================================
  'Wilderness Resource Area': {
    id: 'Wilderness Resource Area',
    category: TableType.MINIGAMES, // Activity
    regions: ['Wilderness'],
    skills: { 'Mining': 1, 'Fishing': 1, 'Woodcutting': 1 },
    // Wilderness Elite waives the entry fee; it is not required to enter.
    description: 'Dark Crabs, Runite Ore, Magic Logs. Note: Pker Hotspot.'
  },
  'Fountain of Rune': {
    id: 'Fountain of Rune',
    category: TableType.MINIGAMES, // Activity
    regions: ['Wilderness'],
    skills: {},
    description: 'Charge Amulets of Glory and Ring of Wealth (i).'
  },
  'Wilderness God Wars Dungeon': {
    id: 'Wilderness God Wars Dungeon',
    category: TableType.MINIGAMES, // Dungeon
    regions: ['Wilderness'],
    skills: {}, // The entrance is open; the inner shortcut takes 60 Strength or 60 Agility
    accessRoutes: [
      { label: '60 Strength', skills: { Strength: 60 } },
      { label: '60 Agility', skills: { Agility: 60 } },
    ],
    description: 'Source of Ecumenical Keys (Skip GWD kill count).'
  },
  'Ecumenical Keys': {
    id: 'Ecumenical Keys',
    category: TableType.MINIGAMES, // Grind
    regions: ['Wilderness'],
    skills: {}, // Every Wilderness God Wars Dungeon monster can drop one; past the entrance cavern
    accessRoutes: [
      { label: '60 Strength', skills: { Strength: 60 } },
      { label: '60 Agility', skills: { Agility: 60 } },
    ],
    description: 'Farm keys in Wildy GWD to skip boss KC.'
  },
  'Rogues\' Castle': {
    id: 'Rogues\' Castle',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'],
    skills: { 'Thieving': 84 },
    description: 'Best Thieving GP/hr (Rogues Chests) & Hard Clues.'
  },
  'Scorpia\'s Cave': {
    id: 'Scorpia',
    category: TableType.BOSSES,
    regions: ['Wilderness'],
    skills: {},
    description: 'Scorpia boss and Odium/Malediction shards.'
  },
  'Deep Wilderness Dungeon': {
    id: 'Deep Wilderness Dungeon',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'],
    skills: {},
    description: 'Fire Giants, Chaos Dwarves and Wine of Zamorak. Single-way combat.'
  },
  'Ferox Enclave': {
    id: 'Ferox Enclave',
    category: TableType.MINIGAMES, // Hub
    regions: ['Wilderness'], // Or access via Minigame Tele
    skills: {},
    description: 'Safe zone. Restoration pool, bank, LMS.'
  },
  'Chaos Altar (Wilderness)': {
    id: 'Chaos Altar (Wilderness)',
    category: TableType.MINIGAMES, // Activity
    regions: ['Chaos Altar'],
    skills: { 'Prayer': 1 },
    description: 'Chaos Altar. 50% chance to save bones (Best Prayer XP).'
  },
  'Pirate\'s Hideout': {
    id: 'Pirate\'s Hideout',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'],
    skills: { 'Thieving': 39 },
    description: 'Deep Wildy thieving chests. Pick the door lock with a lockpick.'
  },

  // ============================================================================
  // NICHE ITEM GRINDS (Slayer/Mobs)
  // ============================================================================
  'Brine Rats': {
    id: 'Brine Rats',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Rellekka
    skills: { 'Slayer': 47 },
    quests: ['Olaf\'s Quest'],
    description: 'Source of Brine Sabre (Best underwater weapon).'
  },
  'Lizardmen': {
    id: 'Lizardmen',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'],
    skills: {},
    description: 'Source of Xeric\'s Talisman (Teleport).'
  },
  'Sourhogs': {
    id: 'Sourhogs',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // Draynor
    skills: { 'Slayer': 1 },
    quests: ['A Porcine of Interest'],
    description: 'Good early game Nature Rune source.'
  },
  'Ogre Enclave': {
    id: 'Ogre Enclave',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Gu'Tanoth
    skills: {},
    quests: ['Watchtower'],
    description: 'Blue dragons and greater demons. Single-way combat, far from a bank.'
  },
  'Blue Dragons (Taverley)': {
    id: 'Taverley Dungeon Pipe', // Mapped to shortcut for access
    category: TableType.MINIGAMES,
    regions: ['Asgarnia'],
    skills: {}, // The 70 Agility pipe, or a dusty key through the gate
    description: 'Access to Blue Dragons for bones/hides (70 Agility pipe or a dusty key).'
  },
  'Red Dragons (Brimhaven)': {
    id: 'Red Dragons',
    category: TableType.MINIGAMES,
    regions: ['Karamja'], // Brimhaven Dungeon
    skills: {},
    // The 22 Woodcutting vine, or the 56 Agility stepping stones past the 10 Woodcutting entrance vine.
    // Banisoch's trading-stick entrance skips the entrance vine; accessRoutes cannot hold it.
    accessRoutes: [
      { label: '22 Woodcutting', skills: { Woodcutting: 22 } },
      { label: '56 Agility and 10 Woodcutting', skills: { Agility: 56, Woodcutting: 10 } },
    ],
    description: 'Source of Red Dragonhide. Bring an axe and the 875-coin entry fee.'
  },
  'Green Dragons (Wilderness)': {
    id: 'Green Dragons',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'],
    skills: {},
    description: 'Fastest early Dragon Bones.'
  },
  'Spiritual Rangers': {
    id: 'Spiritual Rangers',
    category: TableType.MINIGAMES,
    regions: ['Asgarnia'], // GWD
    skills: { 'Slayer': 63 },
    accessRoutes: [
      { label: '60 Strength', skills: { Strength: 60 } },
      { label: '60 Agility', skills: { Agility: 60 } },
    ],
    manualRequirements: [GOD_WARS_ENTRY],
    description: 'Slayer task monster in the God Wars Dungeon.'
  },
  'Spiritual Warriors': {
    id: 'Spiritual Warriors',
    category: TableType.MINIGAMES,
    regions: ['Asgarnia'], // GWD
    skills: { 'Slayer': 68 },
    accessRoutes: [
      { label: '60 Strength', skills: { Strength: 60 } },
      { label: '60 Agility', skills: { Agility: 60 } },
    ],
    manualRequirements: [GOD_WARS_ENTRY],
    description: 'Source of Alchables in GWD.'
  },
  'Ancient Wyverns': {
    id: 'Ancient Wyverns',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'], // Fossil Island
    skills: { 'Slayer': 82 },
    quests: ['Bone Voyage'],
    description: 'Source of Granite Boots and Visage.'
  },
  'Drake\'s Tooth/Claw': {
    id: 'Drakes',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'],
    skills: { 'Slayer': 84 },
    manualRequirements: [KARUULM_HEAT],
    description: 'Components for BiS mid-level boots.'
  },
  'Hydra Leather': {
    id: 'Alchemical Hydra',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'],
    skills: { 'Slayer': 95 },
    manualRequirements: [KARUULM_HEAT],
    description: 'Component for Ferocious Gloves.'
  },

  // ============================================================================
  // GUILD-SPECIFIC ACTIVITIES
  // ============================================================================
  'Mining Guild (Amethyst)': {
    id: 'Mining Guild',
    category: TableType.GUILDS,
    regions: ['Asgarnia'],
    skills: { 'Mining': 92 }, // Amethyst; the guild door asks 60
    description: 'Access to Amethyst crystals (92 Mining).'
  },
  'Crafting Guild (Tanning)': {
    id: 'Crafting Guild',
    category: TableType.GUILDS,
    regions: ['Asgarnia'],
    skills: { 'Crafting': 40 },
    description: 'Access to Tanner upstairs.'
  },
  'Warriors\' Guild (Cyclopes)': {
    id: 'Warriors\' Guild',
    category: TableType.GUILDS,
    regions: ['Asgarnia'],
    skills: {}, // Entry rule (130 combined, or 99 in either) comes from the guild's activity readiness
    description: 'Grind for Bronze through Dragon Defenders.'
  },
  'Wizards\' Guild (Runes)': {
    id: 'Wizards\' Guild',
    category: TableType.GUILDS,
    regions: ['Kandarin'],
    skills: { 'Magic': 66 },
    description: 'Access to Magic Store (Mystic Robes).'
  },
  'Woodcutting Guild (Shrine)': {
    id: 'Woodcutting Guild',
    category: TableType.GUILDS,
    regions: ['Kourend & Kebos'],
    skills: { 'Woodcutting': 60 },
    description: 'Offer bird\'s eggs for Prayer XP, seed nests and the evil chicken outfit.'
  },
  'Farming Guild (Contracts)': {
    id: 'Farming Guild',
    category: TableType.GUILDS,
    regions: ['Kourend & Kebos'],
    skills: { 'Farming': 45 },
    description: 'Jane\'s Farming Contracts (Best seed source).'
  },
  'Fishing Guild (Shark Fishing)': {
    id: 'Fishing Guild',
    category: TableType.GUILDS,
    regions: ['Kandarin'],
    skills: { 'Fishing': 76 }, // Sharks; the guild door asks 68
    description: 'Harpoon sharks (76 Fishing) at the guild\'s big net and harpoon spots.'
  },
  'Cooking Guild (Range)': {
    id: 'Cooks\' Guild',
    category: TableType.GUILDS,
    regions: ['Misthalin'],
    skills: { 'Cooking': 32 },
    description: 'Access to Range and Flour Mill.'
  },
  'Champions\' Guild (Shop)': {
    id: 'Champions\' Guild',
    category: TableType.GUILDS,
    regions: ['Misthalin'],
    skills: {}, // 32 QP: enforced by its activity requirement
    description: 'Shop sells an adamant platebody and black platelegs.'
  },
  'Ranging Guild (Minigame)': {
    id: 'Archery Competition',
    category: TableType.MINIGAMES,
    needsKey: ['Ranging Guild'],
    regions: ['Kandarin'],
    skills: { 'Ranged': 40 },
    description: 'Archery target minigame for tickets.'
  },

  // ============================================================================
  // IMPLINGS
  // ============================================================================
  'Magpie Implings': {
    id: 'Magpie Implings',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'], // Puro Puro
    skills: { 'Hunter': 65 },
    description: 'Source of Amulet of Power/Mystic.'
  },
  'Ninja Implings': {
    id: 'Ninja Implings',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'], // Puro Puro
    skills: { 'Hunter': 74 },
    description: 'Source of Rune weapon/armor.'
  },
  'Crystal Implings': {
    id: 'Crystal Implings',
    category: TableType.MINIGAMES,
    regions: ['Tirannwn'], // Prifddinas
    skills: { 'Hunter': 80 },
    quests: ['Song of the Elves'],
    description: 'Source of Elven Signet and noted Amulets of Power.'
  },
  'Lucky Implings': {
    id: 'Lucky Implings',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'], // Puro Puro
    skills: { 'Hunter': 89 },
    description: 'Rolls on Clue Scroll drop tables.'
  },

  // ============================================================================
  // AGILITY SHORTCUTS
  // ============================================================================
  'Catacombs of Kourend (North)': {
    id: 'Catacombs Shortcut',
    category: TableType.AGILITY_COURSES,
    regions: ['Kourend & Kebos'],
    skills: { 'Agility': 34 },
    description: 'Crack between the warped jellies and the greater nechryael.'
  },
  'Karuulm Dungeon (Upper)': {
    id: 'Karuulm Dungeon (Upper)',
    category: TableType.AGILITY_COURSES,
    regions: ['Kourend & Kebos'],
    skills: { 'Agility': 88 },
    description: 'Pipe from the entrance chamber to the Alchemical Hydra\'s lair, skipping the hydras.'
  },
  'Karuulm Dungeon (Middle)': {
    id: 'Karuulm Dungeon (Middle)',
    category: TableType.AGILITY_COURSES,
    regions: ['Kourend & Kebos'],
    skills: { 'Agility': 62 },
    description: 'Shortcut to Wyrms/Tasakaal.'
  },
  'Draynor Underwall Tunnel': {
    id: 'Draynor Underwall Tunnel',
    category: TableType.AGILITY_COURSES,
    regions: ['Misthalin'],
    skills: { 'Agility': 42 },
    description: 'Shortcut from Draynor to Port Sarim.'
  },
  'Miscellania Dock Stepping Stone': {
    id: 'Miscellania Dock Stepping Stone',
    category: TableType.AGILITY_COURSES,
    regions: ['Fremennik'],
    skills: { 'Agility': 55 },
    description: 'Shortcut on Miscellania.'
  },
  'Coal Trucks Log Balance (Seers)': {
    id: 'Coal Trucks Log Balance',
    category: TableType.AGILITY_COURSES,
    regions: ['Kandarin'],
    skills: { 'Agility': 20 },
    description: 'Cross the river near Seers.'
  },
  'Eagles\' Peak Shortcut': {
    id: 'Eagles\' Peak Shortcut',
    category: TableType.AGILITY_COURSES,
    regions: ['Kandarin'],
    skills: { 'Agility': 25 },
    description: 'Climb the rocks to the peak.'
  },
  'Observatory Grapple': {
    id: 'Observatory Grapple',
    category: TableType.AGILITY_COURSES,
    regions: ['Kandarin'],
    skills: { 'Agility': 23, 'Strength': 28, 'Ranged': 24 }, // Mith Grapple req
    quests: ['Observatory Quest'],
    description: 'Grapple shortcut to the Observatory.'
  },
  'Yanille Dungeon Monkey Bars': {
    id: 'Yanille Dungeon Monkey Bars',
    category: TableType.AGILITY_COURSES,
    regions: ['Kandarin'],
    skills: { 'Agility': 57 },
    description: 'Under Yanille.'
  },
  'Trollheim Shortcut': {
    id: 'Trollheim Shortcut',
    category: TableType.AGILITY_COURSES,
    regions: ['Asgarnia'], // Trollheim
    skills: { 'Agility': 41 }, // Climb rocks
    quests: ['Death Plateau'],
    description: 'Climb rocks up to Trollheim.'
  },
  'Myreque Hideout Shortcut': {
    id: 'Myreque Hideout Shortcut',
    category: TableType.AGILITY_COURSES,
    regions: ['Morytania'],
    skills: {},
    quests: ['In Search of the Myreque'], // Partial: the cellar opens during the quest
    description: 'Trapdoor behind the pub in Canifis.'
  },
  'Lumbridge Swamp Caves Jump': {
    id: 'Lumbridge Swamp Caves Jump',
    category: TableType.AGILITY_COURSES,
    regions: ['Misthalin'],
    skills: { 'Agility': 1 },
    description: 'Stepping stones to the Chasm of Tears.'
  },

  // ============================================================================
  // PASSIVE EFFECT ITEMS (Diary/Minigame Rewards)
  // ============================================================================
  'Bonecrusher': {
    id: 'Bonecrusher',
    category: TableType.MINIGAMES, // Activity Reward
    regions: ['Morytania'],
    skills: {},
    diaries: ['Morytania Hard'], // Hard
    description: 'Auto-buries bones for Prayer XP. Morytania Hard Diary.'
  },
  'Ash Sanctifier': {
    id: 'Ash Sanctifier',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'],
    skills: { 'Prayer': 4 },
    diaries: ['Kourend Hard'], // Hard
    description: 'Auto-scatters ashes for Prayer XP. Kourend Hard Diary.'
  },
  'Seedicide': {
    id: 'Seedicide',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Tithe Farm
    skills: { 'Farming': 34 },
    description: 'Auto-converts seeds to Farming XP. Tithe Farm.'
  },
  'Soul Bearer': {
    id: 'Soul Bearer',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'],
    skills: { 'Prayer': 1 },
    quests: ['Bear Your Soul'],
    description: 'Banks Ensouled Heads directly.'
  },
  'Holy Wrench': {
    id: 'Holy Wrench',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Rum Deal: Braindeath Island, reached from Port Phasmatys
    skills: { 'Prayer': 47 },
    quests: ['Rum Deal'],
    description: 'Restores extra prayer points from potions.'
  },
  'Ectoplasmator': {
    id: 'Soul Wars',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // Soul Wars
    skills: { 'Prayer': 40 },
    description: 'Prayer XP from spectral creatures. Soul Wars.'
  },
  'Fish Sack': {
    id: 'Fish Sack',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Aerial Fishing
    skills: { 'Fishing': 43, 'Hunter': 35 },
    description: 'Cosmetic back slot (combinable with barrel).'
  },
  'Golden Tench': {
    id: 'Golden Tench',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Aerial Fishing
    skills: { 'Fishing': 43, 'Hunter': 35 },
    description: 'Handheld fish (fun weapon).'
  },

  // ============================================================================
  // HUNTER TRAINING NODES
  // ============================================================================
  'Swamp Lizards': {
    id: 'Swamp Lizards',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Canifis Swamp
    skills: { 'Hunter': 29 },
    description: 'Best early game Hunter training.'
  },
  'Orange Salamanders': {
    id: 'Orange Salamanders',
    category: TableType.MINIGAMES,
    regions: ['Kharidian Desert'], // Uzer
    skills: { 'Hunter': 47 },
    description: 'Mid-level Hunter training.'
  },
  'Red Salamanders': {
    id: 'Red Salamanders',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Ourania Altar
    skills: { 'Hunter': 59 },
    description: 'Excellent XP/hr near Ourania Altar.'
  },
  'Black Salamanders': {
    id: 'Black Salamanders',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'], // Boneyard
    skills: { 'Hunter': 67 },
    description: 'High XP/hr in deep Wilderness.'
  },
  'Carnivorous Chinchompas': {
    id: 'Carnivorous Chinchompas',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Feldip Hills
    skills: { 'Hunter': 63 },
    description: 'Red Chins. Best ranged weapon ammo.'
  },
  'Prickly Kebbits': {
    id: 'Prickly Kebbits',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Piscatoris
    skills: { 'Hunter': 37 },
    description: 'Caught with deadfall traps in Piscatoris.'
  },
  'Sabre-toothed Kebbits': {
    id: 'Sabre-toothed Kebbits',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Rellekka Hunter area
    skills: { 'Hunter': 51 },
    description: 'Deadfall trapping.'
  },
  'Dark Kebbits': {
    id: 'Dark Kebbits',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Falconry
    skills: { 'Hunter': 57 },
    description: 'Falconry. Source of Dark Kebbit Fur.'
  },
  'Spotted Kebbits': {
    id: 'Spotted Kebbits',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Falconry
    skills: { 'Hunter': 43 },
    description: 'Falconry. Source of Spotted Cape (Weight reduction).'
  },
  'Dashing Kebbits': {
    id: 'Dashing Kebbits',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Falconry
    skills: { 'Hunter': 69 },
    description: 'Falconry. Source of Spottier Cape (Best weight reduction).'
  },

  // ============================================================================
  // DIARY & ACHIEVEMENT UTILITIES
  // ============================================================================
  'Ardougne Cloak (Farming)': {
    id: 'Ardougne Cloak',
    category: TableType.MOBILITY,
    regions: ['Kandarin'],
    skills: {},
    diaries: ['Ardougne Medium'], // Medium
    description: 'Teleport to Ardougne Farm (Medium Diary).'
  },
  'Explorer\'s Ring (Alchemy)': {
    id: 'Explorer\'s Ring',
    category: TableType.ARCANA,
    regions: ['Misthalin'],
    skills: {},
    diaries: ['Lumbridge Elite'],
    description: 'Free High Alchemy charges daily.'
  },
  'Morytania Legs (Burgh de Rott)': {
    id: 'Morytania Legs',
    category: TableType.MOBILITY,
    regions: ['Morytania'],
    skills: {},
    diaries: ['Morytania Hard'], // Hard
    description: 'Teleport to Burgh de Rott (Hard Diary).'
  },
  'Morytania Legs (Bone/Rune)': {
    id: 'Morytania Legs Effect',
    category: TableType.MINIGAMES,
    regions: ['Morytania'],
    skills: {},
    diaries: ['Morytania Hard'], // Hard
    description: '50% more runes from Barrows.'
  },
  'Seers\' Headband (Bolts)': {
    id: 'Seers\' Headband Effect',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'],
    skills: { 'Fletching': 1 },
    diaries: ['Kandarin Hard'], // Hard
    description: '10% increased chance of enchanted bolt effects activating.'
  },
  'Fremennik Sea Boots (Notes)': {
    id: 'Fremennik Sea Boots Effect',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'],
    skills: {},
    diaries: ['Fremennik Elite'], // Elite
    description: 'Noted Dagannoth Bones.'
  },
  'Desert Amulet (Nardah)': {
    id: 'Desert Amulet',
    category: TableType.MOBILITY,
    regions: ['Kharidian Desert'],
    skills: {},
    diaries: ['Desert Medium'],
    description: 'One Nardah teleport daily; Elite grants unlimited teleports into the Elidinis shrine.'
  },
  'Kourend Blessing (Mount)': {
    id: 'Rada\'s Blessing',
    category: TableType.MOBILITY,
    regions: ['Kourend & Kebos'],
    skills: {},
    diaries: ['Kourend Hard'], // Hard
    description: 'Teleport to Mount Karuulm (Slayer).'
  },
  'Wilderness Sword (Webs)': {
    id: 'Wilderness Sword',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'],
    skills: {},
    diaries: ['Wilderness Easy'], // Easy
    description: '100% success slashing webs.'
  },
  'Varrock Armor (Mining)': {
    id: 'Varrock Armor',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // The Varrock diary; the extra ore works on any standard rock
    skills: { 'Mining': 1 },
    diaries: ['Varrock Easy'],
    description: 'Chance to mine double ores (up to Amethyst at Elite).'
  },

  // ============================================================================
  // SPECIFIC BANK ACCESS (Region Locked)
  // ============================================================================
  'Crafting Guild Bank': {
    id: 'Crafting Guild',
    category: TableType.GUILDS,
    regions: ['Asgarnia'],
    skills: { 'Crafting': 40 },
    accessRoutes: [
      { label: 'Falador Hard diary', diaries: ['Falador Hard'] },
      { label: 'Crafting 99', skills: { Crafting: 99 } },
    ],
    description: 'Members bank: Falador Hard diary or 99 Crafting. Wear an apron or suitable cape/hood to enter the guild.'
  },
  'Farming Guild Bank': {
    id: 'Farming Guild',
    category: TableType.GUILDS,
    regions: ['Kourend & Kebos'],
    skills: { 'Farming': 45 },
    description: 'Requires 45 Farming to enter guild.'
  },
  'Myths\' Guild Bank': {
    id: 'Myths\' Guild',
    category: TableType.GUILDS,
    regions: ['Kandarin'],
    skills: {},
    quests: ['Dragon Slayer II'],
    description: 'Bank located in the guild.'
  },
  'Etceteria Bank': {
    id: 'Etceteria Bank',
    category: TableType.MERCHANTS,
    regions: ['Fremennik'], // Miscellania
    skills: {},
    quests: ['The Fremennik Trials'],
    description: 'Bank on the islands.'
  },
  'Nardah Bank': {
    id: 'Nardah Bank',
    category: TableType.MERCHANTS,
    regions: ['Kharidian Desert'],
    skills: {},
    description: 'Bank in the deep desert.'
  },
  'Sophanem Bank': {
    id: 'Sophanem Bank',
    category: TableType.MERCHANTS,
    regions: ['Kharidian Desert'],
    skills: {},
    quests: ['Contact!'],
    description: 'Bank in Sophanem.'
  },
  'Shilo Village Bank': {
    id: 'Shilo Village Bank',
    category: TableType.MERCHANTS,
    regions: ['Karamja'],
    skills: {},
    quests: ['Shilo Village'],
    description: 'Bank in Shilo Village.'
  },
  'Lletya Bank': {
    id: 'Lletya Bank',
    category: TableType.MERCHANTS,
    regions: ['Tirannwn'],
    skills: {},
    quests: [],
    manualRequirements: ['Confirm you have started Mourning\'s End Part I'],
    description: 'Bank in the elven village, open once Mourning\'s End Part I is started.'
  },
  'Burgh de Rott Bank': {
    id: 'Burgh de Rott Bank',
    category: TableType.MERCHANTS,
    regions: ['Morytania'],
    skills: {},
    quests: ['Priest in Peril'],
    manualRequirements: ['Confirm you have repaired the Burgh de Rott bank in In Aid of the Myreque'],
    description: 'Bank near Barrows, repaired partway through In Aid of the Myreque.'
  },
  'Ver Sinhaza Bank': {
    id: 'Ver Sinhaza Bank',
    category: TableType.MERCHANTS,
    regions: ['Morytania'],
    skills: {},
    quests: ['Priest in Peril'],
    description: 'Bank near ToB.'
  },
  'Darkmeyer Bank': {
    id: 'Darkmeyer Bank',
    category: TableType.MERCHANTS,
    regions: ['Morytania'],
    skills: {},
    quests: ['Sins of the Father'],
    description: 'Bank in the vampyre capital.'
  },
  'Prifddinas Banks': {
    id: 'Prifddinas Banks',
    category: TableType.MERCHANTS,
    regions: ['Tirannwn'],
    skills: {},
    quests: ['Song of the Elves'],
    description: 'Banks in the Crystal City.'
  },
  'Corsair Cove Bank': {
    id: 'Corsair Cove Bank',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'], // Feldip Hills
    skills: {},
    quests: ['The Corsair Curse'],
    description: 'Bank in the Corsair Cove.'
  },

  // ============================================================================
  // KINGDOM MANAGEMENT & PASSIVE RESOURCES
  // ============================================================================
  'Managing Miscellania': {
    id: 'Managing Miscellania',
    category: TableType.MINIGAMES, // Activity
    regions: ['Fremennik'], // Miscellania
    skills: {},
    quests: ['Throne of Miscellania'],
    description: 'Passive gathering of Herbs, Wood, Coal, or Maples.'
  },
  'Royal Trouble (More Resources)': {
    id: 'Royal Trouble',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'],
    skills: { 'Agility': 40, 'Slayer': 40 },
    quests: ['Royal Trouble'],
    description: 'Increases Miscellania output and worker cap.'
  },
  'Daily Sand (Bert)': {
    id: 'Daily Sand',
    category: TableType.MERCHANTS, // Service
    regions: ['Kandarin'], // Yanille
    skills: { 'Crafting': 49 },
    quests: ['The Hand in the Sand'],
    description: '84 Buckets of Sand daily (Yanille).'
  },
  'Daily Essence (Wizard Cromperty)': {
    id: 'Daily Essence',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'], // Ardougne
    skills: {},
    diaries: ['Ardougne Medium'], // Medium+
    description: 'Free Pure Essence daily.'
  },
  'Daily Dynamite (Thirus)': {
    id: 'Daily Dynamite',
    category: TableType.MERCHANTS,
    regions: ['Kourend & Kebos'], // Lovakengj
    skills: {},
    diaries: ['Kourend Medium'], // Medium+
    description: 'Free Dynamite daily for Blast Mine.'
  },
  'Daily Bowstrings (Kandarin)': {
    id: 'Daily Bowstrings',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'], // Seers
    skills: { 'Fletching': 1 },
    diaries: ['Kandarin Easy'], // Easy+
    description: 'Free Flax to Bowstring conversion.'
  },

  // ============================================================================
  // ITEM IMBUING & UPGRADES
  // ============================================================================
  'Slayer Helmet': {
    id: 'Slayer Helmet',
    category: TableType.MERCHANTS, // Unlock
    regions: ['Islands & Others'], // The black mask drops only from cave horrors on Mos Le'Harmless
    skills: { 'Crafting': 55, 'Slayer': 58, 'Defence': 10 }, // 400 points for Malevolent masquerade; 10 Defence to wear
    quests: ['Cabin Fever'],
    description: 'Combine Black Mask with Earmuffs/Facemask/etc.'
  },
  'Imbued Rings (NMZ)': {
    id: 'Nightmare Zone',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Yanille
    skills: {},
    description: 'Double stats of DK rings via Nightmare Zone.'
  },
  'Imbued Rings (Soul Wars)': {
    id: 'Soul Wars',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // Edgeville Portal
    skills: {},
    description: 'Imbue rings using Zeal Tokens.'
  },
  'Imbued Rings (PvP Arena)': {
    id: 'Emir\'s Arena',
    category: TableType.MINIGAMES,
    regions: ['Kharidian Desert'], // Emir's Arena
    skills: {},
    description: 'Imbue rings using Scroll of Imbuing.'
  },
  'Crystal Tool Seed': {
    id: 'Zalcano',
    category: TableType.MINIGAMES,
    regions: ['Tirannwn'], // Zalcano, in Prifddinas
    skills: {},
    quests: ['Song of the Elves'],
    description: 'Create Crystal Pickaxe/Axe/Harpoon.'
  },
  'Infernal Tools': {
    id: 'Infernal Tools',
    category: TableType.MINIGAMES,
    regions: ['Asgarnia'], // Cerberus in Taverley Dungeon (smouldering stone); the dragon tool has many sources
    skills: { 'Slayer': 91, 'Smithing': 85 }, // The pickaxe; the axe needs 85 Firemaking, the harpoon 85 Cooking and 75 Fishing
    description: 'Create Infernal Pickaxe/Axe/Harpoon.'
  },
  'Rune Defender': {
    id: 'Warriors\' Guild',
    category: TableType.GUILDS,
    regions: ['Asgarnia'], // Warriors Guild
    skills: { 'Attack': 40, 'Defence': 40 }, // To wield
    activity: "Warriors' Guild", // 130 combined Attack and Strength, or 99 in either
    description: 'Accurate off-hand. Warriors Guild.'
  },
  'Ava\'s Accumulator': {
    id: 'Ava\'s Accumulator',
    category: TableType.MERCHANTS,
    regions: ['Misthalin'], // Draynor
    skills: { 'Ranged': 50 },
    quests: ['Animal Magnetism'],
    description: 'Best mid-game ranged cape. Saves ammo.'
  },
  'God Books (Completed)': {
    id: 'God Books',
    category: TableType.MERCHANTS,
    regions: ['Fremennik'], // Lighthouse
    skills: {}, // No level to wield
    quests: ['Horror from the Deep'],
    description: 'Unholy Book (Offense) or Book of Law (Ranged). 50 Prayer to bless symbols.'
  },

  // ============================================================================
  // NICHE SKILLING NODES
  // ============================================================================
  'Karambwanji': {
    id: 'Karambwanji',
    category: TableType.MINIGAMES,
    regions: ['Karamja'], // Tai Bwo Wannai
    skills: { 'Fishing': 5 },
    description: 'Stackable bait/food for cats.'
  },
  'Volcanic Ash': {
    id: 'Volcanic Ash',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'], // Fossil Island
    skills: { 'Mining': 22 },
    quests: ['Bone Voyage'],
    description: 'Required to make Ultracompost.'
  },
  'Redwoods': {
    id: 'Woodcutting Guild',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Woodcutting Guild
    skills: { 'Woodcutting': 90 },
    description: 'Best AFK Woodcutting XP.'
  },
  'Sacred Oil': {
    id: 'Sacred Oil',
    category: TableType.MINIGAMES,
    needsKey: ['Shades of Mort\'ton'],
    regions: ['Morytania'], // Mort'ton
    skills: { 'Firemaking': 5 }, // And combat
    quests: ['Shades of Mort\'ton'],
    description: 'Required for Shades minigame.'
  },
  'Swamp Tar': {
    id: 'Swamp Tar',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // Lumbridge Swamp
    skills: {},
    description: 'Collected for Herb Tar training.'
  },
  'Dark Beasts': {
    id: 'Dark Beasts',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Mourner Tunnels (West Ardougne); the Iorwerth Dungeon in Prifddinas is the other place
    skills: { 'Slayer': 90 },
    quests: ['Mourning\'s End Part II'], // Partial: the new key opens the Mourner Tunnels
    description: 'Source of Dark Bow. Mourner Tunnels, or the Iorwerth Dungeon in Prifddinas.'
  },
  'Smoke Devils': {
    id: 'Smoke Devils',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Smoke Dungeon
    skills: { 'Slayer': 93 },
    manualRequirements: ['Smoke devil Slayer task.', SMOKE_DEVIL_FACE],
    description: 'Best Slayer XP in the game (Barraging).'
  },
  'Shayzien Armor (Tier 5)': {
    id: 'Shayzien Armor',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Shayzien
    skills: { 'Defence': 20 },
    description: 'Reduces the damage of Lizardman shamans\' acid attack.'
  },
  'Mining Gloves': {
    id: 'Mining Guild',
    category: TableType.MERCHANTS,
    regions: ['Asgarnia'], // Mining Guild
    skills: { 'Mining': 60 },
    description: 'Chance to not deplete rocks. Buy with minerals.'
  },
  'Angler\'s Outfit': {
    id: 'Angler\'s Outfit',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Fishing Trawler
    skills: { 'Fishing': 34 }, // To wear
    description: 'Fishing XP boosting set.'
  },
  'Lumberjack Outfit': {
    id: 'Lumberjack Outfit',
    category: TableType.MINIGAMES,
    needsKey: ['Temple Trekking', 'Forestry'],
    regions: ['Morytania'], // Temple Trekking or the Forestry shop
    skills: { 'Woodcutting': 44 }, // To wear
    description: 'Woodcutting XP boosting set. Temple Trekking needs In Aid of the Myreque; the Forestry shop is slower.'
  },
  'Pyromancer Outfit': {
    id: 'Wintertodt',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Wintertodt
    skills: { 'Firemaking': 50 },
    description: 'Firemaking XP boosting set.'
  },
  'Rogues\' Outfit': {
    id: 'Rogues\' Den',
    category: TableType.MINIGAMES,
    regions: ['Asgarnia'], // Rogues Den
    skills: { 'Thieving': 50, 'Agility': 50 },
    description: 'Doubles loot from pickpocketing.'
  },
  'Prospector Kit': {
    id: 'Prospector Kit',
    category: TableType.MINIGAMES,
    regions: ['Asgarnia'], // Motherlode Mine
    skills: { 'Mining': 30 },
    description: 'Mining XP boosting set.'
  },
  'Farmer\'s Outfit': {
    id: 'Tithe Farm',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Tithe Farm
    skills: { 'Farming': 34 },
    description: 'Farming XP boosting set.'
  },
  'Zealot\'s Robes': {
    id: 'Zealot\'s Robes',
    category: TableType.MINIGAMES,
    needsKey: ['Shades of Mort\'ton'],
    regions: ['Morytania'], // Shades of Mort'ton
    skills: { 'Firemaking': 80 }, // Gold keys recommended
    quests: ['Shades of Mort\'ton'],
    description: 'Chance to save bones/ashes.'
  },

  // ============================================================================
  // MONSTER DROPS (Specific useful items)
  // ============================================================================
  'Leaf-Bladed Battleaxe': {
    id: 'Leaf-Bladed Battleaxe',
    category: TableType.MINIGAMES,
    regions: ['Fremennik', 'Tirannwn'], // Kurasks
    skills: { 'Slayer': 70 },
    description: 'Strong crush weapon for mid-game.'
  },
  'Granite Boots': {
    id: 'Granite Boots',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'], // Ancient Wyverns
    skills: { 'Slayer': 66 },
    description: 'Good defense boots, required for Karuulm dungeon.'
  },
  'Boots of Brimstone': {
    id: 'Boots of Brimstone',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Drakes/Wyrms (Component)
    skills: { 'Slayer': 84 }, // Drake's claw drops only from drakes; 44 Slayer and 70 Defence, Magic, Ranged to wear
    manualRequirements: [KARUULM_HEAT],
    description: 'Best hybrid boots.'
  },
  'Devout Boots': {
    id: 'Devout Boots',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Hydra (Drake Tooth)
    skills: { 'Slayer': 84 }, // Drake's tooth drops only from drakes, in the Karuulm Slayer Dungeon
    manualRequirements: [KARUULM_HEAT],
    description: 'Best Prayer bonus boots.'
  },
  'Occult Necklace': {
    id: 'Occult Necklace',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Smoke Devils
    skills: { 'Slayer': 93 },
    manualRequirements: ['Smoke devil Slayer task or Thermonuclear smoke devil boss task.', SMOKE_DEVIL_FACE],
    description: 'Essential Magic damage necklace.'
  },
  'Eternal/Pegasian/Primordial Crystals': {
    id: 'Cerberus',
    category: TableType.MINIGAMES,
    regions: ['Asgarnia'], // Cerberus
    skills: { 'Slayer': 91 },
    description: 'Best-in-slot boots upgrades.'
  },
  'Ancient Shards': {
    id: 'Ancient Shards',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Catacombs
    skills: {},
    description: 'Used to charge Arclight and teleport around Catacombs.'
  },
  'Dark Totem': {
    id: 'Dark Totem',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Catacombs
    skills: {},
    description: 'Access to Skotizo.'
  },
  'Zenyte Shard': {
    id: 'Zenyte Shard',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Demonic Gorillas
    skills: { 'Crafting': 89 }, // To make jewelry (lower with boost)
    quests: ['Monkey Madness II'],
    description: 'BiS Jewelry (Torture, Anguish, Tormented, Suffering).'
  },

  // ============================================================================
  // QUEST-LOCKED WEAPONS & ITEMS
  // ============================================================================
  'Keris Partisan': {
    id: 'Keris Partisan',
    category: TableType.MERCHANTS, // Reward
    regions: ['Kharidian Desert'],
    skills: { 'Agility': 62 }, // Quest reqs involved
    quests: ['Beneath Cursed Sands'],
    description: 'Best-in-slot vs Kalphites/Scarabites (ToA).'
  },
  'Barrelchest Anchor': {
    id: 'Barrelchest Anchor',
    category: TableType.MERCHANTS,
    regions: ['Morytania', 'Islands & Others'], // Mos Le'Harmless
    skills: { 'Prayer': 50, 'Attack': 60, 'Strength': 40 }, // Quest Prayer; 60 Attack, 40 Strength to wield
    quests: ['The Great Brain Robbery'],
    description: 'Heavy crush weapon. Repairs cost coins.'
  },
  'Ancient Mace': {
    id: 'Ancient Mace',
    category: TableType.MERCHANTS,
    regions: ['Misthalin'], // Dorgesh-Kaan
    skills: { 'Prayer': 25, 'Attack': 15 },
    quests: ['Another Slice of H.A.M.'],
    description: 'Special attack restores Prayer points.'
  },
  'Wolfbane': {
    id: 'Wolfbane',
    category: TableType.MERCHANTS,
    regions: ['Morytania'],
    skills: {},
    quests: ['Priest in Peril'],
    description: 'Prevents werewolves from transforming.'
  },
  'Silverlight/Darklight': {
    id: 'Silverlight',
    category: TableType.MERCHANTS,
    regions: ['Misthalin'],
    skills: {},
    quests: ['Demon Slayer', 'Shadow of the Storm'],
    description: 'Demonbane weapon (Upgrade to Arclight later).'
  },
  'Gadderhammer': {
    id: 'Gadderhammer',
    category: TableType.MERCHANTS,
    regions: ['Morytania'],
    skills: {},
    quests: ['In Aid of the Myreque'],
    description: 'Damage multiplier vs Shades.'
  },
  'Crystal Bow': {
    id: 'Crystal Bow',
    category: TableType.MERCHANTS,
    regions: ['Tirannwn'],
    skills: { 'Agility': 50, 'Ranged': 70 },
    quests: ['Roving Elves'],
    description: 'Long range bow, degrades.'
  },
  'Crystal Shield': {
    id: 'Crystal Shield',
    category: TableType.MERCHANTS,
    regions: ['Tirannwn'],
    skills: { 'Agility': 50, 'Defence': 70 },
    quests: ['Roving Elves'],
    description: 'High ranged defence shield.'
  },
  'Excalibur': {
    id: 'Excalibur',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'], // Camelot
    skills: {},
    quests: ['Merlin\'s Crystal'],
    description: 'Special attack boosts Defence.'
  },
  'Salve Amulet (Base)': {
    id: 'Salve Amulet',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Haunted Mine
    skills: {},
    quests: ['Haunted Mine'],
    description: 'Damage boost vs Undead.'
  },

  // ============================================================================
  // WILDERNESS SHOPS (Ironman Meta)
  // ============================================================================
  'Bandit Duty Free': {
    id: 'Bandit Duty Free',
    category: TableType.MERCHANTS,
    regions: ['Wilderness'], // Deep Wildy
    skills: {},
    description: 'Buys items at High Alch value. Sells tools, pots and jugs.'
  },
  'Mage Arena Staff Shop': {
    id: 'Staff Shops',
    category: TableType.MERCHANTS,
    regions: ['Wilderness'], // Mage Arena
    skills: {},
    description: 'Sells God Staves (Guthix/Sara/Zammy).'
  },
  'Lundail\'s Rune Shop': {
    id: 'Magic Shops',
    category: TableType.MERCHANTS,
    regions: ['Wilderness'], // Mage Arena
    skills: {},
    description: 'Sells Cosmic, Nature, Law, Death runes.'
  },
  'Wilderness Food Shop': {
    id: 'Food Shops',
    category: TableType.MERCHANTS,
    regions: ['Wilderness'], // Bandit Camp
    skills: {},
    description: "Tony's Pizza Bases (Bandit Camp) sells pizza bases; tomato and cheese spawn by the stove."
  },
  'Team Cape Seller': {
    id: 'Clothes Shops',
    category: TableType.MERCHANTS,
    regions: ['Wilderness'],
    skills: {},
    description: 'Sells Team Capes (Wilderness).'
  },

  // ============================================================================
  // SPECIALIZED ACCESS & AREAS
  // ============================================================================
  'Private Hunter Area': {
    id: 'Private Hunter Area',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // North of Ardougne
    skills: { 'Hunter': 63 }, // Red Chins
    diaries: ['Western Hard'], // Hard
    description: 'Non-competed Red Chinchompa area.'
  },
  'Red Dragon Isle': {
    id: 'Red Dragon Isle',
    category: TableType.MINIGAMES,
    regions: ['Karamja'], // Brimhaven Dungeon
    skills: { 'Agility': 56, 'Woodcutting': 10 }, // No diary since May 2024; the stones are past the 10 Woodcutting entrance vine
    description: 'Shortcut to Red Dragons in Brimhaven Dungeon.'
  },
  'Mos Le\'Harmless Cave': {
    id: 'Mos Le\'Harmless Cave',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'],
    skills: {},
    quests: ['Cabin Fever'],
    description: 'Cave entry. Bring a light source unless the fire pit is lit, and a witchwood icon for protection. Cave horrors require 58 Slayer to kill.'
  },
  'Champions\' Challenge': {
    id: 'Champions\' Guild',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // Champions Guild
    skills: {},
    questPoints: 32, // Champions' Guild entry
    quests: [], // Plus a champion scroll
    description: 'Defeat champions for the cape.'
  },
  'Chompy Bird Hunting': {
    id: 'Chompy Bird Hunting',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Feldip Hills
    skills: {},
    quests: ['Big Chompy Bird Hunting'],
    description: 'Hunting Chompies for Diary/Hats/Pet.'
  },
  'Rag and Bone Man List': {
    id: 'Rag and Bone Man',
    category: TableType.MINIGAMES,
    regions: [], // Global
    skills: { 'Slayer': 1 },
    quests: ['Rag and Bone Man I', 'Rag and Bone Man II'],
    description: 'Collecting bones for XP.'
  },
  'Zanaris (Lost City)': {
    id: 'Zanaris',
    category: TableType.REGIONS, // Or Mini-region
    regions: ['Misthalin', 'Islands & Others'], // Lumbridge Swamp entrance
    skills: { 'Woodcutting': 36, 'Crafting': 31 },
    quests: ['Lost City'],
    description: 'Access to the Fairy City.'
  },
  'Legend\'s Guild Dungeon': {
    id: 'Legend\'s Guild Dungeon',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'],
    skills: {},
    quests: ['Legends\' Quest'],
    description: 'Shadow Warriors (Shield Left Half).'
  },
  'Warrior Guild Potions': {
    id: 'Herblore Shops',
    category: TableType.MERCHANTS,
    regions: ['Asgarnia'], // Warriors Guild
    skills: {},
    activity: "Warriors' Guild", // 130 combined Attack and Strength, or 99 in either
    description: 'Cheap Attack/Strength potions.'
  },
  'Yanille Magic Shop': {
    id: 'Magic Shops',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'], // Wizards Guild
    skills: { 'Magic': 66 },
    description: 'Mystic Robes and Runes.'
  },
  'Taverley Herblore Shop': {
    id: 'Herblore Shops',
    category: TableType.MERCHANTS,
    regions: ['Asgarnia'],
    skills: {},
    description: 'Water-filled vials and eyes of newt.'
  },
  'Catherby Farming Shop': {
    id: 'Farming Shops',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'],
    skills: {},
    description: 'Compost, plant pots, rakes.'
  },

  // ============================================================================
  // NICHE SLAYER MOBS
  // ============================================================================
  'Cockatrice': {
    id: 'Cockatrice',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Rellekka
    skills: { 'Slayer': 25 },
    items: ['Mirror Shield'],
    description: 'Drop Limpwurt Roots and Medium Clues.'
  },
  'Basilisks': {
    id: 'Basilisks',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Rellekka
    skills: { 'Slayer': 40 },
    items: ['Mirror Shield'],
    description: 'Drop Mystic Hat (light) and Nature runes.'
  },
  'Rockslugs': {
    id: 'Rockslugs',
    category: TableType.MINIGAMES,
    regions: ['Fremennik', 'Misthalin'], // Salt mine / Swamp
    skills: { 'Slayer': 20 },
    items: ['Bag of Salt'],
    description: 'Low level slayer task. Requires Salt.'
  },
  'Desert Lizards': {
    id: 'Desert Lizards',
    category: TableType.MINIGAMES,
    regions: ['Kharidian Desert'],
    skills: { 'Slayer': 22 },
    items: ['Ice Cooler'],
    description: 'Requires Ice Cooler to finish off.'
  },
  'Harpie Bug Swarms': {
    id: 'Harpie Bug Swarms',
    category: TableType.MINIGAMES,
    regions: ['Karamja'], // North-east of Tai Bwo Wannai (Varlamore also has some)
    skills: { 'Slayer': 33, 'Firemaking': 33 },
    items: ['Lit Bug Lantern'],
    description: 'Requires Lit Bug Lantern.'
  },
  'Infernal Mages': {
    id: 'Infernal Mages',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Slayer Tower
    skills: { 'Slayer': 45 },
    description: 'Drop Mystic Boots/Hats (dark).'
  },
  'Bloodveld': {
    id: 'Bloodveld',
    category: TableType.MINIGAMES,
    regions: ['Morytania', 'Kandarin', 'Kourend & Kebos'],
    skills: { 'Slayer': 50 },
    description: 'Great XP task. Mutated variety in Catacombs.'
  },
  'Aberrant Spectres': {
    id: 'Aberrant Spectres',
    category: TableType.MINIGAMES,
    regions: ['Morytania', 'Kandarin', 'Kourend & Kebos'],
    skills: { 'Slayer': 60 },
    items: ['Nose Peg', 'Slayer Helmet'],
    description: 'Drop Seeds and Herbs. Requires Nose Peg.'
  },
  'Turoth': {
    id: 'Turoth',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'],
    skills: { 'Slayer': 55 },
    items: ['Leaf-Bladed Weapon'],
    description: 'Immune to normal damage.'
  },
  'Banshees': {
    id: 'Banshees',
    category: TableType.MINIGAMES,
    regions: ['Morytania'],
    skills: { 'Slayer': 15 },
    items: ['Earmuffs'],
    description: 'Requires Earmuffs.'
  },

  // ============================================================================
  // THIEVING HOTSPOTS (Seeds & Cash)
  // ============================================================================
  'Master Farmers': {
    id: 'Master Farmers',
    category: TableType.MINIGAMES, // Activity
    regions: ['Misthalin'], // Draynor, south of Varrock (also Ardougne, Hosidius, Farming Guild, Varlamore)
    skills: { 'Thieving': 38 },
    description: 'Essential source of Ranarr/Snapdragon seeds.'
  },
  'Ardougne Knight': {
    id: 'Ardougne Knight',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Ardougne Market
    skills: { 'Thieving': 55 },
    description: 'Best mid-high level Thieving XP and GP.'
  },
  'Stone Chests': {
    id: 'Stone Chests',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Molch
    skills: { 'Thieving': 64 },
    // Xeric's Talisman is the teleport item (Mobility unlock), not a quest;
    // dropping the quest gate. Region check still requires Kourend & Kebos.
    description: 'Source of Medium Clues and Xeric\'s Talisman.'
  },
  'Dorgesh-Kaan Chests': {
    id: 'Dorgesh-Kaan Chests',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // Dorgesh-Kaan
    skills: { 'Thieving': 52 },
    quests: ['Death to the Dorgeshuun'],
    description: 'Source of Easy clues. Gems need rich chests (78).'
  },
  'Wall Safes': {
    id: 'Rogues\' Den',
    category: TableType.GUILDS, // lobby safes: the guild Key, as fal_hard_8
    regions: ['Asgarnia'], // Rogues Den
    skills: { 'Thieving': 50 },
    description: 'Source of gems inside Rogues Den.'
  },
  'Fruit Stalls': {
    id: 'Fruit Stalls',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Hosidius
    skills: { 'Thieving': 25 },
    description: 'Easy thieving XP and Strange Fruits (Energy).'
  },
  'Baker\'s Stall': {
    id: 'Baker\'s Stall',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Ardougne
    skills: { 'Thieving': 5 },
    description: 'Early game food source (Cakes/Bread).'
  },
  'Silk Stalls': {
    id: 'Silk Stalls',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Ardougne market (the Al Kharid stall cannot be stolen from)
    skills: { 'Thieving': 20 },
    description: 'Early game GP method (Steal and sell back).'
  },
  'Gem Stall': {
    id: 'Gem Stall',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // East Ardougne (the Al Kharid stall cannot be stolen from)
    skills: { 'Thieving': 75 },
    description: 'Source of gems (Sapphire/Emerald/Ruby).'
  },
  'Vyres (Pickpocket)': {
    id: 'Vyres',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Darkmeyer
    skills: { 'Thieving': 82 },
    quests: ['Sins of the Father'],
    description: 'Source of Blood Shards. Requires Vyre outfit.'
  },
  'Elves (Pickpocket)': {
    id: 'Elves',
    category: TableType.MINIGAMES,
    regions: ['Tirannwn'], // Prifddinas
    skills: { 'Thieving': 85 },
    quests: ['Song of the Elves'],
    description: 'Source of Enhanced Crystal Teleport Seeds.'
  },

  // ============================================================================
  // SKILLING SUPPLY SHOPS (Ironman Meta)
  // ============================================================================
  'Fremennik Fish Shop': {
    id: 'Fishing Shops',
    category: TableType.MERCHANTS,
    regions: ['Fremennik'], // Rellekka
    skills: {},
    description: 'Sells Raw Tuna/Lobster/Swordfish/Shark (Stock varies).'
  },
  'Warrior Guild Food': {
    id: 'Food Shops',
    category: TableType.MERCHANTS,
    regions: ['Asgarnia'], // Burthorpe
    skills: {},
    activity: "Warriors' Guild", // 130 combined Attack and Strength, or 99 in either
    description: 'Buy Potatoes with Cheese and Plain Pizzas.'
  },
  'Grand Tree Groceries': {
    id: 'Food Shops',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'], // Grand Tree
    skills: {},
    description: "Gnome cooking ingredients and a cocktail shaker (spirits are at Funch's Fine Groceries)."
  },
  'Legends\' Guild General': {
    id: 'General Stores',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'],
    skills: {},
    quests: ['Legends\' Quest'],
    description: 'Sells Attack Potions, Vials, Steel Arrows.'
  },
  'Sawmill Operator': {
    id: 'Sawmill Operators',
    category: TableType.MERCHANTS,
    regions: ['Misthalin', 'Kourend & Kebos'], // Varrock, Woodcutting Guild
    skills: {},
    description: 'Convert Logs to Planks. Buy Saws/Cloth/Nails.'
  },
  'Stonemason': {
    id: 'Stonemasons',
    category: TableType.MERCHANTS,
    regions: ['Fremennik'], // Keldagrim
    skills: {},
    description: 'Sells Limestone brick, Marble block, Gold leaf.'
  },
  'Candle Maker': {
    id: 'Candle Shops',
    category: TableType.MERCHANTS,
    regions: ['Kandarin'], // Catherby
    skills: {},
    description: 'Sells Candles.'
  },
  'TzHaar Gem Store': {
    id: 'Gem Shops',
    category: TableType.MERCHANTS,
    regions: ['Karamja'], // Mor Ul Rek
    skills: {},
    description: 'Buy Uncut Gems with Tokkul.'
  },
  'Jatizso Ore Shop': {
    id: 'Mining Shops',
    category: TableType.MERCHANTS,
    regions: ['Fremennik'], // Jatizso
    skills: {},
    quests: ['The Fremennik Trials'], // Mord Gunnars ferries you once The Fremennik Isles is started
    questProgress: [FREMENNIK_ISLES_STARTED],
    description: 'Ores up to adamantite (no runite).'
  },
  'Neitiznot Supplies': {
    id: 'General Stores',
    category: TableType.MERCHANTS,
    regions: ['Fremennik'], // Neitiznot
    skills: {},
    quests: ['The Fremennik Trials'], // Maria Gunnars ferries you once The Fremennik Isles is started
    questProgress: [FREMENNIK_ISLES_STARTED],
    description: 'Thread, needles, knives, hammers, bronze axes and balls of wool.'
  },

  // ============================================================================
  // SPECIFIC COMBAT DROPS & UNLOCKS
  // ============================================================================
  'Obsidian Cape': {
    id: 'Obsidian Cape',
    category: TableType.MERCHANTS, // TzHaar Shop
    regions: ['Karamja'],
    skills: {}, // Tokkul
    description: 'Defensive cape. Buy in Mor Ul Rek.'
  },
  'Obsidian Shield': {
    id: 'Obsidian Shield',
    category: TableType.MERCHANTS, // TzHaar Shop
    regions: ['Karamja'],
    skills: { 'Defence': 60 },
    description: 'Strong defensive shield (TokTz-Ket-Xil).'
  },
  'Granite Body': {
    id: 'Barbarian Assault',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Barbarian Assault
    skills: { 'Defence': 50, 'Strength': 50 },
    description: 'Buy for 95,000 coins after killing the Penance Queen.'
  },
  'Ancient Staff': {
    id: 'Ancient Staff',
    category: TableType.MERCHANTS, // Eblis
    regions: ['Kharidian Desert'],
    skills: { 'Magic': 50, 'Attack': 50 },
    quests: ['Desert Treasure I'],
    description: 'Buyable from Eblis after quest.'
  },
  'Mud Battlestaff': {
    id: 'Dagannoth Kings',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Waterbirth Island (Dagannoth Kings)
    skills: { 'Magic': 30, 'Attack': 30 },
    description: 'Drop from Dagannoth Prime.'
  },
  'Seercull': {
    id: 'Dagannoth Kings',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Waterbirth
    skills: { 'Ranged': 50 },
    description: 'Drop from Dagannoth Supreme.'
  },
  'Warrior Ring': {
    id: 'Dagannoth Kings',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Waterbirth
    skills: {},
    description: 'Slash bonus ring. Dagannoth Rex.'
  },
  'Berserker Ring': {
    id: 'Dagannoth Kings',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Waterbirth
    skills: {},
    description: 'Best Strength ring. Dagannoth Rex.'
  },
  'Archers Ring': {
    id: 'Dagannoth Kings',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Waterbirth
    skills: {},
    description: 'Best Ranged ring. Dagannoth Supreme.'
  },
  'Seers Ring': {
    id: 'Dagannoth Kings',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Waterbirth
    skills: {},
    description: 'Magic accuracy ring. Dagannoth Prime.'
  },
  'Granite Maul': {
    id: 'Granite Maul',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Slayer Tower
    skills: { 'Slayer': 75, 'Attack': 50, 'Strength': 50 },
    description: 'Drop from Gargoyles.'
  },
  'Mystic Robes (Light)': {
    id: 'Mystic Robes (Light)',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Slayer Cave
    skills: { 'Slayer': 40, 'Magic': 40, 'Defence': 20 },
    description: 'Drop from Basilisks/Cockatrice.'
  },
  'Mystic Robes (Dark)': {
    id: 'Mystic Robes (Dark)',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Slayer Tower
    skills: { 'Slayer': 45, 'Magic': 40, 'Defence': 20 },
    description: 'Drop from Infernal Mages.'
  },
  'Mystic Robes (Blue/Shop)': {
    id: 'Wizards\' Guild',
    category: TableType.MERCHANTS, // Wizards Guild
    regions: ['Kandarin'],
    skills: { 'Magic': 66 },
    description: 'Buyable in Wizards Guild.'
  },

  // ============================================================================
  // SKILLING NODES (Specific)
  // ============================================================================
  'Hardwood Grove': {
    id: 'Hardwood Grove',
    category: TableType.MINIGAMES,
    regions: ['Karamja'], // Tai Bwo Wannai
    skills: { 'Woodcutting': 35 },
    description: 'Enclosed area with Teak/Mahogany trees.'
  },
  'Mess Hall': {
    id: 'Mess',
    category: TableType.MINIGAMES, // Activity
    regions: ['Kourend & Kebos'], // Hosidius
    skills: { 'Cooking': 20 },
    description: 'Fast Cooking XP making Pineapple Pizzas/Stews.'
  },
  'Lovakite Ore': {
    id: 'Lovakite Ore',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Lovakengj
    skills: { 'Mining': 65 },
    description: 'Smelted into Lovakite bars.'
  },
  'Volcanic Sulphur': {
    id: 'Volcanic Sulphur',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Lovakengj
    skills: { 'Mining': 42 },
    description: 'Used to make Dynamite.'
  },
  'Myth\'s Guild Green Dragons': {
    id: 'Myth\'s Guild Green Dragons',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Myths Guild
    skills: {},
    quests: ['Dragon Slayer II'],
    description: 'Close proximity to bank Green Dragons.'
  },
  'Myth\'s Guild Blue Dragons': {
    id: 'Myth\'s Guild Blue Dragons',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Myths Guild
    skills: {},
    quests: ['Dragon Slayer II'],
    description: 'Safe spot Blue Dragons.'
  },
  'Farming Guild Spirit Tree': {
    id: 'Farming Guild',
    category: TableType.MOBILITY,
    needsKey: ['Spirit Tree'],
    regions: ['Kourend & Kebos'],
    skills: { 'Farming': 85 }, // Level for high tier
    description: 'High tier wing of Farming Guild.'
  },
  'Port Sarim Spirit Tree': {
    id: 'Port Sarim Spirit Tree',
    category: TableType.MOBILITY,
    needsKey: ['Spirit Tree'],
    regions: ['Asgarnia'], // Port Sarim
    skills: { 'Farming': 83 },
    description: 'Spirit Tree patch.'
  },
  'Etceteria Spirit Tree': {
    id: 'Etceteria Spirit Tree',
    category: TableType.MOBILITY,
    needsKey: ['Spirit Tree'],
    regions: ['Fremennik'], // Etceteria
    skills: { 'Farming': 83 },
    quests: ['The Fremennik Trials'], // Every way to the island
    description: 'Spirit Tree patch.'
  },
  'Brimhaven Spirit Tree': {
    id: 'Brimhaven Spirit Tree',
    category: TableType.MOBILITY,
    needsKey: ['Spirit Tree'],
    regions: ['Karamja'], // Brimhaven
    skills: { 'Farming': 83 },
    description: 'Spirit Tree patch.'
  },
  'Hosidius Spirit Tree': {
    id: 'Hosidius Spirit Tree',
    category: TableType.MOBILITY,
    needsKey: ['Spirit Tree'],
    regions: ['Kourend & Kebos'], // Hosidius
    skills: { 'Farming': 83 },
    description: 'Spirit Tree patch.'
  },

  // ============================================================================
  // LOOT CHESTS & KEY DESTINATIONS
  // ============================================================================
  'Crystal Chest': {
    id: 'Crystal Chest',
    category: TableType.MINIGAMES, // Activity
    regions: ['Asgarnia'], // Taverley
    skills: {},
    description: 'Redeem Crystal Keys for Dragonstones/Rune items.'
  },
  'Brimstone Chest': {
    id: 'Brimstone Chest',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Mount Karuulm
    skills: {},
    description: 'Redeem Brimstone Keys from Konar tasks.'
  },
  'Larran\'s Chest (Big)': {
    id: 'Larran\'s Chest (Big)',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'], // Deep Wildy
    skills: {},
    description: 'Redeem Larran\'s Keys for high value loot.'
  },
  'Muddy Chest': {
    id: 'Muddy Chest',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'], // Lava Maze
    skills: {},
    description: 'Redeem Muddy Keys (Mithril Bar/Law Runes).'
  },
  'Sinister Chest': {
    id: 'Sinister Chest',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Yanille Agility Dungeon
    skills: { 'Agility': 49 }, // The pipe past the 40 ledge
    description: 'Redeem Sinister Keys for high level herbs (Torstol).'
  },
  'Grubby Chest': {
    id: 'Grubby Chest',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'], // Forthos Dungeon
    skills: { 'Thieving': 57 }, // To open
    description: 'Redeem Grubby Keys for food/potions/dragon hide.'
  },
  'Enhanced Crystal Chest': {
    id: 'Enhanced Crystal Chest',
    category: TableType.MINIGAMES,
    regions: ['Tirannwn'], // Prifddinas
    skills: { 'Smithing': 80, 'Crafting': 80 }, // Soft reqs for keys usually
    quests: ['Song of the Elves'],
    description: 'Redeem Enhanced Crystal Keys for Dragonstone armor.'
  },

  // ============================================================================
  // IRONMAN "CHORE" LOCATIONS (Crafting/Mining)
  // ============================================================================
  'Daeyalt Essence Mine': {
    id: 'Daeyalt Essence Mine',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Darkmeyer
    skills: { 'Mining': 60 },
    quests: ['Sins of the Father'],
    description: 'AFK Essence mining (50% extra Runecraft XP).'
  },
  'Sand Pit (Yanille)': {
    id: 'Sand Pit (Yanille)',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'],
    skills: {},
    quests: ['The Hand in the Sand'],
    description: 'Daily sand collection from Bert.'
  },
  'Soda Ash (Charter Ships)': {
    id: 'Charter Ships', // Mapped to Mobility
    category: TableType.MERCHANTS,
    regions: ['Kandarin', 'Karamja', 'Asgarnia'], // Catherby/Port Sarim
    skills: {},
    description: 'Shop stock for Soda Ash/Buckets of Sand (Crafting).'
  },
  'Limestone Mine': {
    id: 'Limestone Mine',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // Silvarea, west of the Salve
    skills: { 'Mining': 10 },
    description: 'Source of Limestone for Temple Trekking/Construction.'
  },
  'Salt Mine (Weiss)': {
    id: 'Salt Mine',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Weiss
    skills: { 'Mining': 72 }, // Every salt and basalt rock
    quests: ['Making Friends with My Arm'],
    description: 'Mine salt for stony basalt teleports/fires.'
  },
  'Gem Rocks (Underground)': {
    id: 'Gem Rocks (Underground)',
    category: TableType.MINIGAMES,
    regions: ['Karamja'], // Shilo Underground
    skills: { 'Mining': 40 },
    diaries: ['Karamja Medium'],
    description: 'Better gem rocks inside Shilo mine.'
  },
  'Essence Mine (Varrock)': {
    id: 'Essence Mine',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // Aubury
    skills: {},
    quests: ['Rune Mysteries'],
    description: 'Teleport to Rune Essence mine.'
  },
  'Fossil Island Phosphate': {
    id: 'Fossil Island Phosphate',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'],
    skills: { 'Mining': 22 },
    quests: ['Bone Voyage'], // Fossil Island
    description: 'Mining Volcanic Ash for Ultracompost.'
  },

  // ============================================================================
  // QUEST-LOCKED DUNGEONS & AREAS
  // ============================================================================
  'Legend\'s Guild Dungeon (Shadow Warriors)': {
    id: 'Legend\'s Guild Dungeon',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'],
    skills: {},
    quests: ['Legends\' Quest'],
    description: 'Source of Shield Left Half.'
  },
  'Heroes\' Guild Dungeon (Blue Dragons)': {
    id: 'Heroes\' Guild',
    category: TableType.MINIGAMES,
    regions: ['Asgarnia'], // Burthorpe
    skills: {},
    quests: ['Heroes\' Quest'],
    description: 'Safe spot Blue Dragons.'
  },
  'Mos Le\'Harmless Cave (Horrors)': {
    id: 'Mos Le\'Harmless Cave',
    category: TableType.MINIGAMES,
    regions: ['Islands & Others'],
    skills: { 'Slayer': 58 }, // Cave horrors
    quests: ['Cabin Fever'],
    description: 'Cave Horrors (Black Mask).'
  },
  'Harmony Island (Herb Patch)': {
    id: 'Harmony Island',
    category: TableType.FARMING_LAYERS,
    needsKey: ['Herb'],
    regions: ['Morytania'],
    skills: { 'Farming': 1 }, // Elite Diary usually
    quests: ['The Great Brain Robbery'], diaries: ['Morytania Elite'], // Elite
    description: 'Disease-free herb patch (Elite Diary).'
  },
  'Sophanem Dungeon': {
    id: 'Sophanem Dungeon',
    category: TableType.MINIGAMES,
    regions: ['Kharidian Desert'],
    skills: { 'Slayer': 1 }, // Locusts/Scarabs
    quests: ['Contact!'],
    description: 'Scarabites slayer task.'
  },
  'Miscellania Dungeon': {
    id: 'Miscellania Dungeon',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'],
    skills: {},
    quests: ['Royal Trouble'],
    description: 'Giant Sea Snake (Medium Clues).'
  },
  'Fisher Realm': {
    id: 'Fisher Realm',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'],
    skills: {},
    quests: ['Holy Grail'],
    description: 'Access to the Magic Whistle area.'
  },
  'Enchanted Valley': {
    id: 'Enchanted Valley',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // BKQ code
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Tree Spirits (Rune Axe farming).'
  },
  'Gorak Plane': {
    id: 'Gorak Plane',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // DIR code
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Goraks (Drop Shield Left Half frequently).'
  },
  'Abyssal Area (Fairy Ring)': {
    id: 'Abyssal Area',
    category: TableType.MINIGAMES,
    regions: ['Misthalin'], // ALR code
    skills: { 'Slayer': 85 }, // Abyssal demons
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Abyssal demons (85 Slayer) and other Abyss creatures.'
  },

  // ============================================================================
  // NICHE SHOPS (Clue Items & Specifics)
  // ============================================================================
  'Nurmof\'s Pickaxe Shop': {
    id: 'Mining Shops',
    category: TableType.MERCHANTS,
    regions: ['Asgarnia'], // Dwarven Mine
    skills: {},
    description: 'Sells up to Rune Pickaxe.'
  },
  'Scavvo\'s Rune Store': {
    id: 'Chainbody Shops',
    category: TableType.MERCHANTS,
    regions: ['Misthalin'], // Champions Guild
    skills: {},
    questPoints: 32,
    description: 'Champions\' Guild access requires 32 Quest Points. Sells rune chainbody, platelegs, plateskirt, weapons, and green d\'hide armour.'
  },
  'Fancy Clothes Store': {
    id: 'Clothes Shops',
    category: TableType.MERCHANTS,
    regions: ['Misthalin'], // Varrock
    skills: {},
    description: 'Fancy boots/gloves/capes for Clue Scrolls.'
  },
  'Gnome Glider Clothing': {
    id: 'Gnome Restaurant',
    category: TableType.MINIGAMES, // Not a shop: tips from two hard-delivery customers
    regions: ['Tree Gnome Stronghold'], // Grand Tree
    skills: { 'Cooking': 29 },
    description: 'Gnome goggles and scarf for Clue Scrolls: a 1/17 tip each from Captain Daerkin or Captain Ninto on Gnome Restaurant hard deliveries.'
  },
  'Shayzien Armourer': {
    id: 'Platebody Shops',
    category: TableType.MERCHANTS,
    regions: ['Kourend & Kebos'], // Shayzien
    skills: {},
    description: "Blair's Armour: bronze to steel chainbodies, platelegs, plateskirts and med helms. Shayzien armour comes from the Combat Ring or Smithing lovakite bars."
  },
  'Mount Karuulm Weapon Shop': {
    id: 'Weapon Shops',
    category: TableType.MERCHANTS,
    regions: ['Kourend & Kebos'],
    skills: {},
    description: 'Spears/Battleaxes/Warhammers.'
  },
  'Dorgesh-Kaan Market': {
    id: 'Food Shops',
    category: TableType.MERCHANTS,
    regions: ['Misthalin'], // Dorgesh-Kaan
    skills: {},
    quests: ['Death to the Dorgeshuun'],
    description: 'Frog-leather armor and localized food.'
  },
  'Pollnivneach Kebab Shop': {
    id: 'Kebab Sellers',
    category: TableType.MERCHANTS,
    regions: ['Kharidian Desert'],
    skills: {},
    description: 'Super Kebabs (The Feud).'
  },

  // ============================================================================
  // HERBLORE SECONDARIES (Gathering Nodes)
  // Essential for Ironman potion production.
  // ============================================================================
  'Tower of Life (Spidines)': {
    id: 'Tower of Life (Spidines)',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Ardougne
    skills: { 'Construction': 10 }, // Creature Creation
    quests: ['Tower of Life'],
    description: 'Fastest Red Spiders\' Eggs (Summon Spidines).'
  },
  'Mort Myre Fungus (Bloom)': {
    id: 'Mort Myre Fungus',
    category: TableType.MINIGAMES,
    regions: ['Morytania'], // Swamp
    skills: { 'Prayer': 1 },
    quests: ['Nature Spirit'],
    description: 'Cast Bloom to harvest Fungus for Super Energies.'
  },
  'Blue Dragon Scales': {
    id: 'Blue Dragon Scales',
    category: TableType.MINIGAMES,
    regions: ['Kandarin', 'Asgarnia'], // Myths Guild or Taverley
    skills: {}, // Taverley: 70 Agility pipe or a dusty key
    description: 'Ground spawns in Taverley Dungeon or Myths Guild.'
  },
  'White Berries (Isle)': {
    id: 'White Berries',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'], // Lava Dragon Isle
    skills: {},
    description: 'Ground spawns in deep Wilderness (Lava Dragon Isle).'
  },
  'Potato Cactus (Kalphite)': {
    id: 'Potato Cactus',
    category: TableType.MINIGAMES,
    regions: ['Kharidian Desert'], // Kalphite Lair
    skills: {},
    description: 'Ground spawns near Kalphite Queen entrance.'
  },
  'Snape Grass (Waterbirth)': {
    id: 'Snape Grass',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'], // Waterbirth Island
    skills: {},
    description: 'Ground spawns on Waterbirth Island.'
  },
  'Amylase Crystals': {
    id: 'Amylase Crystals',
    category: TableType.MERCHANTS, // Grace
    regions: ['Asgarnia'], // Burthorpe
    skills: { 'Agility': 10 },
    description: 'Buy with Marks of Grace (Stamina Potions).'
  },
  'Sand (Sandstorm)': {
    id: 'Sandstorm',
    category: TableType.MINIGAMES,
    regions: ['Kharidian Desert'], // Quarry
    skills: { 'Mining': 35 }, // No quest needed
    description: 'Fastest sand gathering via Sandstone Grinder.'
  },
  'Zogre Bones': {
    id: 'Zogre Bones',
    category: TableType.MINIGAMES,
    regions: ['Kandarin'], // Jiggig
    skills: { 'Ranged': 30 },
    quests: ['Zogre Flesh Eaters'],
    description: 'Prayer bones from Zogres.'
  },
  'Unicorn Horns': {
    id: 'Unicorn Horns',
    category: TableType.MINIGAMES,
    regions: ['Kandarin', 'Misthalin'], // Catherby / Black Knights Fortress
    skills: {},
    description: 'Hunting Unicorns for Anti-poison secondary.'
  },

  // ============================================================================
  // DRAGON TOOL GRINDS
  // Mapping specific bosses/methods to the tools they provide.
  // ============================================================================
  'Dragon Pickaxe (Chaos Ele)': {
    id: 'Chaos Elemental',
    category: TableType.MINIGAMES, // Boss Grind
    regions: ['Wilderness'],
    skills: {},
    description: '1/256 drop from Chaos Elemental (Safe-spottable).'
  },
  'Dragon Pickaxe (Wildy Bosses)': {
    id: 'Dragon Pickaxe (Wildy Bosses)',
    category: TableType.MINIGAMES, // Boss Grind
    needsKey: ['Callisto', 'Venenatis', 'Vet\'ion', 'Artio', 'Calvar\'ion', 'Spindel'],
    regions: ['Wilderness'],
    skills: {},
    description: 'Drop from Callisto, Venenatis, Vet\'ion or their smaller variants.'
  },
  'Dragon Pickaxe (KBD)': {
    id: 'King Black Dragon',
    category: TableType.MINIGAMES, // Boss Grind
    regions: ['Wilderness'],
    skills: {},
    description: '1/1,000 drop from King Black Dragon.'
  },
  'Dragon Pickaxe (KQ)': {
    id: 'Kalphite Queen',
    category: TableType.MINIGAMES, // Boss Grind
    regions: ['Kharidian Desert'],
    skills: {},
    description: '1/400 drop from Kalphite Queen.'
  },
  'Dragon Pickaxe (Volcanic Mine)': {
    id: 'Volcanic Mine',
    category: TableType.MINIGAMES, // Ore Pack
    regions: ['Islands & Others'], // Fossil Island
    skills: { 'Mining': 50 },
    quests: ['Bone Voyage'],
    description: 'Broken pickaxe from Ore Packs (Low chance).'
  },
  'Dragon Axe (Wintertodt)': {
    id: 'Wintertodt',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'],
    skills: { 'Firemaking': 50 },
    description: '1/10,000 from the reward cart.'
  },
  'Dragon Axe (Dagannoth)': {
    id: 'Dagannoth Kings',
    category: TableType.MINIGAMES,
    regions: ['Fremennik'],
    skills: {},
    description: '1/128 from Dagannoth Kings.'
  },
  'Dragon Harpoon (Wyrms)': {
    id: 'Dragon Harpoon (Wyrms)',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos'],
    skills: { 'Slayer': 62 },
    manualRequirements: [KARUULM_HEAT_OR_WYRMSCRAIG],
    description: '1/10,000 from wyrms (1/2,000 on a wyrm task).'
  },
  'Dragon Harpoon (Tempoross)': {
    id: 'Tempoross',
    category: TableType.MINIGAMES,
    regions: ['Kharidian Desert'],
    skills: { 'Fishing': 35 },
    description: '1/8000 from Tempoross reward pool.'
  },

  // ============================================================================
  // SPECIFIC FAIRY RING CODES (Travel Nodes)
  // Treat these as "sub-regions" unlocked by the network + the specific area.
  // ============================================================================
  'Fairy Ring DJR (Chasm)': {
    id: 'Fairy Ring DJR',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Kourend & Kebos'], // Shayzien
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport to Chasm of Fire (Demons).'
  },
  'Fairy Ring BJS (Zulrah)': {
    id: 'Fairy Ring BJS',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Tirannwn'],
    skills: { 'Agility': 76 }, // Shortcut to useful area
    quests: ['Fairytale I - Growing Pains', 'Regicide'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport near Zul-Andra (Requires Agility).'
  },
  'Fairy Ring DKS (Polar)': {
    id: 'Fairy Ring DKS',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Fremennik'], // Hunter area
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport to Snowy Hunter Area (Sabre-toothed Kebbits).'
  },
  'Fairy Ring CIQ (Yanille)': {
    id: 'Fairy Ring CIQ',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Kandarin'],
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport near Yanille (North).'
  },
  'Fairy Ring ALP (Lighthouse)': {
    id: 'Fairy Ring ALP',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Fremennik'], // Lighthouse
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport to Lighthouse/Dagannoths.'
  },
  'Fairy Ring CKS (Canifis)': {
    id: 'Fairy Ring CKS',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Morytania'],
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport to Canifis (Mushroom patch).'
  },
  'Fairy Ring DKP (Karambwan)': {
    id: 'Fairy Ring DKP',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Karamja'],
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport to Karambwan fishing spot.'
  },
  'Fairy Ring BIP (Poly)': {
    id: 'Fairy Ring BIP',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Misthalin'], // Salve River
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport to an island on the River Salve, south-west of Mort Myre.'
  },
  'Fairy Ring CIR (Mount K)': {
    id: 'Fairy Ring CIR',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Kourend & Kebos'],
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport south of Mount Karuulm.'
  },
  'Fairy Ring BLP (TzHaar)': {
    id: 'Fairy Ring BLP',
    category: TableType.MOBILITY,
    needsKey: ['Fairy Rings'],
    regions: ['Karamja'],
    skills: {},
    quests: ['Fairytale I - Growing Pains'],
    questProgress: [FAIRY_RING_PROGRESS],
    description: 'Teleport to TzHaar area (Mor Ul Rek).'
  },

  // ============================================================================
  // JEWELRY TELEPORTS (Granular)
  // ============================================================================
  'Games Necklace (Wintertodt)': {
    id: 'Games Necklace (Wintertodt)',
    category: TableType.MOBILITY,
    needsKey: ['Jewelry Teleports'],
    regions: ['Kourend & Kebos'],
    skills: { 'Crafting': 22 }, // Sapphire necklace
    description: 'Direct teleport to Wintertodt Camp.'
  },
  'Games Necklace (Barb Assault)': {
    id: 'Games Necklace (BA)',
    category: TableType.MOBILITY,
    needsKey: ['Jewelry Teleports'],
    regions: ['Kandarin'],
    skills: { 'Crafting': 22 }, // Sapphire necklace
    description: 'Direct teleport to Barbarian Outpost.'
  },
  'Dueling Ring (Ferox)': {
    id: 'Dueling Ring (Ferox)',
    category: TableType.MOBILITY,
    needsKey: ['Jewelry Teleports'],
    regions: ['Wilderness'],
    skills: { 'Crafting': 27 }, // Emerald
    description: 'Direct teleport to Ferox Enclave (Pool).'
  },
  'Dueling Ring (Castle Wars)': {
    id: 'Dueling Ring (Castle Wars)',
    category: TableType.MOBILITY,
    needsKey: ['Jewelry Teleports'],
    regions: ['Kandarin'],
    skills: { 'Crafting': 27 },
    description: 'Direct teleport to Castle Wars.'
  },
  'Necklace of Passage': {
    id: 'Necklace of Passage',
    category: TableType.MOBILITY,
    needsKey: ['Jewelry Teleports'],
    regions: ['Misthalin', 'Kandarin'], // Wizards Tower / Outpost
    skills: { 'Crafting': 25 }, // Jade necklace
    description: 'Teleport to Wizards Tower or Outpost.'
  },
  'Skills Necklace': {
    id: 'Skills Necklace',
    category: TableType.MOBILITY,
    needsKey: ['Jewelry Teleports'],
    regions: ['Kandarin', 'Asgarnia', 'Kourend & Kebos'], // Fishing/Mining/Woodcutting guilds
    skills: { 'Crafting': 72 }, // Dragonstone
    description: 'Teleport to various Skilling Guilds.'
  },
  'Combat Bracelet': {
    id: 'Combat Bracelet',
    category: TableType.MOBILITY,
    needsKey: ['Jewelry Teleports'],
    regions: ['Asgarnia', 'Misthalin', 'Kandarin'], // Warriors/Champs/Ranging guilds
    skills: { 'Crafting': 74 }, // Dragonstone
    description: 'Teleport to Combat Guilds.'
  },
  'Ring of Wealth (Miscellania)': {
    id: 'Ring of Wealth (Misc)',
    category: TableType.MOBILITY,
    needsKey: ['Jewelry Teleports'],
    regions: ['Fremennik'],
    skills: { 'Crafting': 55 }, // Dragonstone
    quests: ['Throne of Miscellania'],
    description: 'Teleport to Miscellania.'
  },

  // ============================================================================
  // LUNAR & ARCEUUS UTILITY SPELLS
  // These spells drastically change skilling meta.
  // ============================================================================
  'Superglass Make': {
    id: 'Superglass Make',
    category: TableType.ARCANA,
    needsKey: ['Lunar Spellbook'],
    regions: ['Fremennik'], // Lunar Isle access
    skills: { 'Magic': 77 },
    quests: ['Lunar Diplomacy'],
    description: 'Best Crafting XP/Sand processing method in the game.'
  },
  'Tan Leather (Spell)': {
    id: 'Tan Leather',
    category: TableType.ARCANA,
    needsKey: ['Lunar Spellbook'],
    regions: ['Fremennik'],
    skills: { 'Magic': 78 },
    diaries: ['Fremennik Hard'], // Hard (Req for spell)
    description: 'Instant leather tanning for Crafting/Cash.'
  },
  'Magic Imbue': {
    id: 'Magic Imbue',
    category: TableType.ARCANA,
    needsKey: ['Lunar Spellbook'],
    regions: ['Fremennik'],
    skills: { 'Magic': 82 },
    quests: ['Lunar Diplomacy'],
    description: 'Craft combination runes without a talisman.'
  },
  'Spin Flax': {
    id: 'Spin Flax',
    category: TableType.ARCANA,
    needsKey: ['Lunar Spellbook'],
    regions: ['Fremennik'],
    skills: { 'Magic': 76 },
    quests: ['Lunar Diplomacy'],
    description: 'Fastest method to create Bowstrings.'
  },
  'Plank Make': {
    id: 'Plank Make',
    category: TableType.ARCANA,
    needsKey: ['Lunar Spellbook'],
    regions: ['Fremennik'],
    skills: { 'Magic': 86 },
    quests: ['Dream Mentor'],
    description: 'AFK Plank making (Magic + Construction XP).'
  },
  'Resurrect Crops': {
    id: 'Resurrect Crops',
    category: TableType.ARCANA,
    needsKey: ['Arceuus Spellbook'],
    regions: ['Kourend & Kebos'], // Arceuus
    skills: { 'Magic': 78 },
    description: 'Save dead farming patches (Crucial for Ranarrs).'
  },
  'Demonic Offering': {
    id: 'Demonic Offering',
    category: TableType.ARCANA,
    needsKey: ['Arceuus Spellbook'],
    regions: ['Kourend & Kebos'],
    skills: { 'Magic': 84 },
    quests: ['A Kingdom Divided'],
    description: 'Restores Prayer + XP using Demonic Ashes.'
  },
  'Dark Lure': {
    id: 'Dark Lure',
    category: TableType.ARCANA,
    needsKey: ['Arceuus Spellbook'],
    regions: ['Kourend & Kebos'],
    skills: { 'Magic': 50 },
    quests: ['A Kingdom Divided'],
    description: 'Force implings to land.'
  },
  'Degrime (Herbs)': {
    id: 'Degrime',
    category: TableType.ARCANA,
    needsKey: ['Arceuus Spellbook'],
    regions: ['Kourend & Kebos'],
    skills: { 'Magic': 70 },
    quests: ['A Kingdom Divided'],
    description: 'Clean herbs instantly for XP.'
  },

  // ============================================================================
  // END-GAME CRAFTING & SMITHING (Item Assembly)
  // Logic for actually *making* the items once you have the drops.
  // ============================================================================
  'Godsword Assembly': {
    id: 'Godsword Assembly',
    category: TableType.MINIGAMES, // Process
    needsKey: ['General Graardor', 'Commander Zilyana', 'Kree\'arra', 'K\'ril Tsutsaroth'],
    regions: ['Asgarnia'], // God Wars Dungeon or Anvil
    skills: { 'Smithing': 80 },
    description: 'Attach Godsword Hilt to Blade.'
  },
  'Dragonfire Shield (Smithing)': {
    id: 'Dragonfire Shield',
    category: TableType.MERCHANTS, // Oziach
    regions: ['Misthalin'], // Lumbridge Castle: Duke Horacio gives the anti-dragon shield
    skills: { 'Smithing': 90 }, // At any anvil with a hammer; no quest for the recipe itself
    quests: [],
    questProgress: [{ quest: 'Dragon Slayer I', label: 'Confirm you have started Dragon Slayer I (Duke Horacio gives the anti-dragon shield; also needed to wear the shield)' }],
    description: 'Attach a draconic visage to an anti-dragon shield at any anvil (90 Smithing), or pay Oziach 1,250,000 coins after Dragon Slayer I.'
  },
  'Spirit Shield (Making)': {
    id: 'Spirit Shield (Making)',
    category: TableType.MINIGAMES,
    regions: ['Wilderness'], // Corp Cave logic usually? Or anvil
    skills: { 'Prayer': 85 }, // To bless the shield; Abbot Langley attaches the sigil with no level
    description: 'Bless a spirit shield (85 Prayer), then attach the sigil yourself (90 Prayer and 85 Smithing) or pay Abbot Langley 1.5M coins.'
  },
  'Ferocious Gloves': {
    id: 'Alchemical Hydra',
    category: TableType.MINIGAMES,
    regions: ['Kourend & Kebos', 'Islands & Others'], // Hydra leather from Karuulm; Lithkren Vault machinery
    skills: { 'Slayer': 95 }, // Hydra leather drops only from the Alchemical Hydra (95 Slayer, on task)
    quests: ['Dragon Slayer II'],
    manualRequirements: [KARUULM_HEAT],
    description: 'Use Hydra Leather on the Lithkren Vault machinery.'
  },
  'Neitiznot Faceguard': {
    id: 'Neitiznot Faceguard',
    category: TableType.MERCHANTS,
    regions: ['Fremennik'],
    skills: { 'Defence': 70 }, // To wear; made by Olaf the Bard, no skill
    quests: ['The Fremennik Exiles'],
    description: 'Combine Basilisk Jaw with Helm of Neitiznot.'
  },
  'Avernic Defender': {
    id: 'Theatre of Blood',
    category: TableType.MINIGAMES,
    regions: ['Morytania'],
    skills: { 'Attack': 70, 'Defence': 70 },
    description: 'Combine Avernic Defender Hilt (ToB) with Dragon Defender.'
  }
};

// Strategy prose can be curated separately; copied quest gates cannot override
// the canonical journal. Evaluators also use QUEST_DATA for manual/OR gates.
for (const [id, strategy] of Object.entries(STRATEGY_DATABASE)) {
  const quest = QUEST_DATA[id];
  if (!quest) continue;
  STRATEGY_DATABASE[id] = {
    ...strategy, id: quest.id, category: TableType.QUESTS,
    regions: enforcedQuestAreas(quest),
    skills: Object.fromEntries(Object.entries(quest.skills).filter(([skill]) => skill !== 'Quest Points')),
    questPoints: quest.skills['Quest Points'], quests: [...quest.prereqs],
  };
}
