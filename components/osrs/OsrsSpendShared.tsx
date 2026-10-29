import { TableType } from '../../types';

/** Local OSRS sprites shared by Spend Keys, History and the roll reveal. */
const BASE = import.meta.env.BASE_URL;
export const osrsItem = (file: string): string => `${BASE}osrs-ui/items/${file}`;
export const osrsSkillIcon = (skill: string, small = false): string =>
  `${BASE}osrs-ui/skills/${small ? 'small/' : ''}${skill.toLowerCase()}.png`;

export const KEY_ICON = osrsItem('key.png');
export const OMNI_KEY_ICON = osrsItem('omni_key.png');
export const CHAOS_KEY_ICON = osrsItem('chaos_key.png');
export const VOID_SEAL_ICON = osrsItem('void_seal.png');
/** Reward casket: the Spend Keys tab and the Unlocks filter on the boards. */
export const CASKET_ICON = osrsItem('20546.png');
/** The bank map icon (cache sprite 1453), for the Banks table. */
export const BANK_ICON = `${BASE}osrs-ui/bank_icon.png`;
export const QUEST_ICON = `${import.meta.env.BASE_URL}osrs-ui/quest_point_icon.png`;

/** One item sprite per unlock table, as the World and SpendRoll boards draw them. */
export const TABLE_SPRITE: Partial<Record<TableType, string>> = {
  [TableType.EQUIPMENT]: osrsItem('1127.png'),
  [TableType.SKILLS]: osrsItem('2528.png'),
  [TableType.REGIONS]: osrsItem('1538.png'),
  [TableType.CHUNKS]: osrsItem('1538.png'),
  [TableType.MOBILITY]: osrsItem('1712.png'),
  [TableType.ARCANA]: osrsItem('563.png'),
  [TableType.STORAGE]: osrsItem('12791.png'),
  [TableType.POH]: osrsItem('8013.png'),
  [TableType.MERCHANTS]: osrsItem('1004.png'),
  [TableType.MINIGAMES]: osrsItem('4067.png'),
  [TableType.BOSSES]: osrsItem('21907.png'),
  [TableType.GUILDS]: osrsItem('8851.png'),
  [TableType.FARMING_LAYERS]: osrsItem('5343.png'),
  [TableType.SLAYER_UNLOCKS]: osrsItem('4155.png'),
  [TableType.BANKS]: BANK_ICON,
};
export const tableSprite = (table?: string): string =>
  (table && TABLE_SPRITE[table as TableType]) || CASKET_ICON;

/** Message colours: on the parchment chatbox, and on the dark stone panels. */
export const ON_PARCHMENT = { success: '#005f00', fail: '#7f0000', unlock: '#000080', void: '#6a00a8', level: '#8a4b00', plain: '#000000' };
export const ON_STONE = { success: '#00ff00', fail: '#ff3030', unlock: '#ffff00', void: '#c77dff', level: '#ff981f', plain: '#ffffff' };

/** "#rrggbb" plus alpha as rgba(), for flat beam columns (no gradients). */
export const withAlpha = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
