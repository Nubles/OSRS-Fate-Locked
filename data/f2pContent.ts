/**
 * What a Free-to-play run can unlock (October 2026). Every entry is free-to-play
 * on the OSRS Wiki: the Free-to-play, Bank, Bank deposit box and Shop pages,
 * and each location's own infobox (Members: No). Members content on F2P land
 * (Rogues' Castle, the Chaos Altar, the Crafting Guild bank, Scurrius) is left
 * out. A table with no free-to-play entries (Arcana, Player-owned house,
 * Storage, Farming, Slayer unlocks) is not rolled at all.
 *
 * Each list only holds names that already exist in data/items.ts or
 * data/banks.ts; data/f2pContent.test.ts checks that.
 */
import { TableType } from '../types';

/** The 15 skills free-to-play worlds can train. */
export const F2P_SKILLS = [
  'Attack', 'Hitpoints', 'Mining', 'Strength', 'Smithing', 'Defence', 'Fishing',
  'Ranged', 'Cooking', 'Prayer', 'Crafting', 'Firemaking', 'Magic', 'Woodcutting', 'Runecraft',
] as const;

/** Rune is the best gear free-to-play worlds offer (equipment tier 5). */
export const F2P_EQUIPMENT_TIER_MAX = 5;

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
    'Mining Shops', 'Silk Shops', 'Magic Shops', 'Jewellery Shops', 'Tanners', 'Lost Property',
    'Reward Shops',
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
