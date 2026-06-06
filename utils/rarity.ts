// Single source of truth for the rarity + category colour language used by the
// loot beams and the Fate Thread tapestry (and available to anything else that
// needs a consistent per-rarity / per-category colour). Keeping it here means
// the new visuals read the same as the rest of the UI.
import { TableType } from '../types';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** OSRS-loot-beam-flavoured rarity palette (raw hex, for gradients + glows). */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#22c55e', // green
  uncommon: '#38bdf8', // blue
  rare: '#a855f7', // purple
  epic: '#fb923c', // orange
  legendary: '#facc15', // gold
};
export const rarityColor = (r: Rarity): string => RARITY_COLOR[r];

const RARITY_RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
export const rarityRank = (r: Rarity): number => RARITY_RANK[r];

/**
 * Per-category accent colour, matching the app's existing dashboard palette so
 * beams / the tapestry stay consistent with the rest of the UI. Keyed by
 * TableType value plus the journal & collection categories.
 */
export const CATEGORY_COLOR: Record<string, string> = {
  [TableType.EQUIPMENT]: '#60a5fa', // blue-400 (Character)
  [TableType.SKILLS]: '#818cf8', // indigo-400
  [TableType.REGIONS]: '#34d399', // emerald-400 (World)
  [TableType.BOSSES]: '#f87171', // red-400
  [TableType.MINIGAMES]: '#22d3ee', // cyan-400
  [TableType.FARMING_LAYERS]: '#4ade80', // green-400
  [TableType.MOBILITY]: '#fbbf24', // amber-400
  [TableType.GUILDS]: '#2dd4bf', // teal-400
  [TableType.ARCANA]: '#a78bfa', // violet-400
  [TableType.POH]: '#fb923c', // orange-400
  [TableType.STORAGE]: '#d97706', // amber-600
  [TableType.MERCHANTS]: '#eab308', // yellow-500
  Quests: '#22d3ee', // cyan (Journal)
  Diaries: '#38bdf8', // blue
  'Combat Achievements': '#f472b6', // pink-400
  'Collection Log': '#d97706', // amber-600
};
export const categoryColor = (cat?: string): string => (cat && CATEGORY_COLOR[cat]) || '#94a3b8';

/** How significant each unlock category feels → drives the loot-beam rarity. */
const CATEGORY_RARITY: Record<string, Rarity> = {
  [TableType.BOSSES]: 'legendary',
  [TableType.REGIONS]: 'epic',
  [TableType.EQUIPMENT]: 'rare',
  [TableType.SKILLS]: 'rare',
  [TableType.MINIGAMES]: 'rare',
  [TableType.GUILDS]: 'rare',
  [TableType.ARCANA]: 'rare',
  [TableType.MOBILITY]: 'uncommon',
  [TableType.POH]: 'uncommon',
  [TableType.STORAGE]: 'uncommon',
  [TableType.FARMING_LAYERS]: 'uncommon',
  [TableType.MERCHANTS]: 'common',
};
export const categoryRarity = (cat?: string): Rarity => (cat && CATEGORY_RARITY[cat]) || 'rare';

/** Map a game `lastEvent` to the loot-beam rarity it should fire (null = no beam). */
export function eventRarity(type: string | undefined, meta?: Record<string, any>): Rarity | null {
  switch (type) {
    case 'ROLL_SUCCESS': return 'common';
    case 'ROLL_PITY':
    case 'PITY': return 'uncommon';
    case 'ROLL_OMNI': return 'legendary';
    case 'LEVEL_UP': return meta?.chaosKeyAwarded ? 'epic' : null;
    case 'UNLOCK': return categoryRarity(meta?.category);
    default: return null; // ROLL_FAIL, ALTAR, etc.
  }
}
