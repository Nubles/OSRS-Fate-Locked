/**
 * What a Free-to-play run can unlock (October 2026). Every entry is free-to-play
 * on the OSRS Wiki: the Free-to-play, Bank, Bank deposit box and Shop pages,
 * and each location's own infobox (Members: No). Members content on F2P land
 * (Rogues' Castle, the Chaos Altar, the Crafting Guild bank, Scurrius) is left
 * out (the Chaos Altar hut is free to visit, but its altar only works for
 * members). A table with no free-to-play entries (Arcana, Player-owned house,
 * Storage, Farming, Slayer unlocks) is not rolled at all.
 *
 * Each list only holds names that already exist in data/items.ts or
 * data/banks.ts; utils/f2pMode.test.ts checks that.
 */
import { TableType } from '../types';

/** The 15 skills free-to-play worlds can train. */
export const F2P_SKILLS = [
  'Attack', 'Hitpoints', 'Mining', 'Strength', 'Smithing', 'Defence', 'Fishing',
  'Ranged', 'Cooking', 'Prayer', 'Crafting', 'Firemaking', 'Magic', 'Woodcutting', 'Runecraft',
] as const;

/** Rune is the best gear free-to-play worlds offer (equipment tier 5). */
export const F2P_EQUIPMENT_TIER_MAX = 5;

/**
 * The best free-to-play tier in each slot (utils/gearTiers.ts tiers): rune
 * where rune exists, green d'hide vambraces (4), gold decorative boots (4),
 * amulet of power (3), and only stat-less capes and rings (1).
 */
export const F2P_EQUIPMENT_TIER_CAPS: Readonly<Record<string, number>> = {
  Head: 5, Cape: 1, Neck: 3, Ammo: 5, Weapon: 5, Body: 5, Shield: 5, Legs: 5, Gloves: 4, Boots: 4, Ring: 1,
};

/** The highest tier a Free-to-play run can unlock in this equipment slot. */
export const f2pEquipmentTierCap = (slot: string): number => F2P_EQUIPMENT_TIER_CAPS[slot] ?? F2P_EQUIPMENT_TIER_MAX;

/** Free from the start: the free-to-play half of Misthalin. */
export const F2P_START_AREAS = [
  'Lumbridge', 'Varrock', 'Draynor Village', "Wizards' Tower", 'Edgeville', 'Barbarian Village',
] as const;

/** Rolled from the Areas table. */
export const F2P_AREAS = [
  // Asgarnia
  'Falador', 'Port Sarim', 'Rimmington', 'Crafting Guild', 'Dwarven Mine', 'Asgarnian Ice Dungeon',
  'Goblin Village', 'Mudskipper Point',
  // Kandarin: reached by the Castle Wars minigame teleport and the Corsair Cove ship.
  'Corsair Cove', 'Castle Wars',
  // Karamja
  'Musa Point', 'Crandor',
  // Kharidian Desert: the desert past Shantay Pass is members only.
  'Al Kharid', 'Duel Arena / PvP Arena', 'Shantay Pass',
  // Wilderness, west of the members fence.
  'Ferox Enclave', 'Chaos Temple', 'Lava Maze', 'Wilderness Bandit Camp', "Dark Warriors' Fortress",
  'Graveyard of Shadows', 'Forgotten Cemetery', 'Fountain of Rune',
] as const;

/** Bank and deposit box ids (data/banks.ts) that work on free-to-play worlds. */
export const F2P_BANK_IDS = [
  '12850', // Lumbridge Castle
  '12853', // Varrock Center/Square (east bank)
  '12597', // West Varrock
  '12598', // Grand Exchange
  '12342', // Edgeville
  '12338', // South Draynor
  '12084', // East Falador
  '11828', // West Falador
  '11572', // Falador west deposit box
  '12082', // Port Sarim deposit boxes
  '13105', // Al Kharid Palace
  '13104', // Shantay Pass
  '10284', // Corsair Cove
  '9776', // Castle Wars Lobby
  '12344', // West Ferox Enclave
  '11830', // Ruins of Camdozaal
  '13363', // Emir's Arena bank chest (banks.ts names the chunk after the Mage Training Arena)
] as const;

/** Each table's free-to-play entries. Skills, equipment and areas use the lists above. */
export const F2P_TABLE_ITEMS: Partial<Record<TableType, readonly string[]>> = {
  [TableType.SKILLS]: F2P_SKILLS,
  [TableType.REGIONS]: F2P_AREAS,
  [TableType.MOBILITY]: ['Canoes', 'Minigame Teleports'],
  [TableType.ARCANA]: [],
  [TableType.POH]: [],
  [TableType.MERCHANTS]: [
    'General Stores', 'Bars & Inns', 'Food Shops', 'Kebab Sellers', 'Wine Traders',
    'Archery Shops', 'Axe Shops', 'Mace Shops', 'Scimitar Shops', 'Staff Shops', 'Sword Shops',
    'Chainbody Shops', 'Clothes Shops', 'Helmet Shops', 'Platebody Shops', 'Platelegs Shops',
    'Plateskirt Shops', 'Shield Shops', 'Crafting Shops', 'Dye Shops', 'Fishing Shops', 'Gem Shops',
    'Mining Shops', 'Silk Shops', 'Magic Shops', 'Herblore Shops', 'Tanners', 'Reward Shops',
  ],
  [TableType.MINIGAMES]: ['Castle Wars', 'Clan Wars', "Emir's Arena", 'Last Man Standing', 'Shooting Stars', 'Forestry'],
  [TableType.BOSSES]: ['Obor', 'Bryophyta'],
  [TableType.STORAGE]: [],
  [TableType.GUILDS]: ["Champions' Guild", "Cooks' Guild", 'Crafting Guild', 'Mining Guild'],
  [TableType.FARMING_LAYERS]: [],
  [TableType.SLAYER_UNLOCKS]: [],
  [TableType.BANKS]: F2P_BANK_IDS,
};

const F2P_SETS = new Map<TableType, ReadonlySet<string>>(
  Object.entries(F2P_TABLE_ITEMS).map(([table, items]) => [table as TableType, new Set(items)]),
);

/** Whether a free-to-play run can unlock this entry (equipment slots are all free-to-play). */
export const isF2PEntry = (table: TableType, item: string): boolean => {
  const set = F2P_SETS.get(table);
  return set === undefined || set.has(item);
};

/**
 * The 18 Combat Achievement tasks free-to-play worlds can complete (OSRS Wiki,
 * Combat Achievements/Free-to-play): Obor, Bryophyta (not A Slow Death), the
 * Greater Demon tasks and Brutus (not the Elite speed task). 27 points in all,
 * so no Combat Achievement tier can be finished on free-to-play worlds.
 */
export const F2P_CA_TASK_IDS = [
  'ca_129', 'ca_130', 'ca_131', 'ca_132', 'ca_133', 'ca_134',
  'ca_35', 'ca_36', 'ca_37', 'ca_38', 'ca_39', 'ca_41',
  'ca_120', 'ca_121',
  'ca_632', 'ca_633', 'ca_635', 'ca_636',
] as const;

/** Every pet is members only, so a Free-to-play run claims none. */
export const F2P_PET_IDS: readonly number[] = [];

/**
 * Collection log pages a free-to-play world can fill. Castle Wars only gives
 * free-to-play players the red, white and gold melee pieces, hoods, cloaks
 * and banners (ids 404001-404030); its magic and ranged pieces and halos are
 * members only. Pages the wiki doesn't confirm (Random Events, Camdozaal) are
 * left out.
 */
export const F2P_COLLECTION_LOG_PAGES = ['Obor', 'Bryophyta', 'Brutus', 'Beginner Treasure Trails', 'Castle Wars'] as const;

/**
 * Collection log item ids are the page's number times 1000 plus the item's
 * place (data/collectionLogData.ts), so a page's items share one block.
 * utils/f2pMode.test.ts checks these blocks against the pages.
 */
export const F2P_COLLECTION_LOG_BLOCKS: Readonly<Record<(typeof F2P_COLLECTION_LOG_PAGES)[number], number>> = {
  Obor: 136, Bryophyta: 106, Brutus: 155, 'Beginner Treasure Trails': 301, 'Castle Wars': 404,
};
const F2P_LOG_BLOCK_SET = new Set(Object.values(F2P_COLLECTION_LOG_BLOCKS));
const F2P_CASTLE_WARS_LAST_ITEM = 404030;

/** Whether a Free-to-play run can log this collection log item. */
export const isF2PCollectionLogItemId = (itemId: number): boolean => {
  const block = Math.floor(itemId / 1000);
  return F2P_LOG_BLOCK_SET.has(block) && (block !== F2P_COLLECTION_LOG_BLOCKS['Castle Wars'] || itemId <= F2P_CASTLE_WARS_LAST_ITEM);
};
