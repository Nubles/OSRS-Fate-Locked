/**
 * Shared run-completion metric — the single yardstick both you and a Rival Ghost
 * are measured against. Mirrors the Dashboard header's completion %: every
 * unlock (skill tier, equipment tier, region, boss, …) is one point out of a
 * fixed denominator.
 */

import {
  SKILLS_LIST, REGIONS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX,
  MOBILITY_LIST, ARCANA_LIST, ROLLABLE_POH_ITEMS, MERCHANTS_LIST, MINIGAMES_LIST,
  BOSSES_LIST, ROLLABLE_STORAGE_ITEMS, GUILDS_LIST, FARMING_PATCH_LIST,
  SLAYER_UNLOCKS_LIST,
} from '../constants';
import { ALL_CHUNK_KEYS, CHUNKED_START_KEY } from './chunkAdjacency';
import { bankLocksActive } from './reachability';
import { unlockableAreas } from './freeAreas';
import type { GameModeRules } from '../config/gameModes';
import { UnlockState } from '../types';
import { BANK_IDS } from '../data/banks';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';
import { isF2PMode } from '../config/gameModes';
import { TableType } from '../types';
import { F2P_SKILLS, F2P_TABLE_ITEMS, f2pEquipmentTierCap } from '../data/f2pContent';

/** Total unlock points available for 100% completion. */
export const COMPLETION_DENOMINATOR =
  SKILLS_LIST.length * 10 +
  REGIONS_LIST.length +
  EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX +
  MOBILITY_LIST.length + ARCANA_LIST.length + ROLLABLE_POH_ITEMS.length +
  MERCHANTS_LIST.length + MINIGAMES_LIST.length + BOSSES_LIST.length +
  ROLLABLE_STORAGE_ITEMS.length + GUILDS_LIST.length + FARMING_PATCH_LIST.length +
  SLAYER_UNLOCKS_LIST.length +
  // Each bank/deposit box is its own unlock (locked in every built-in mode).
  // (A Custom banks-off run — no longer selectable — would cap just under 100%.)
  BANK_IDS.length;

// Free-to-play counts only free-to-play content: its skills, gear up to rune
// and each table's free-to-play entries.
const F2P_LIST_TABLES = [
  TableType.REGIONS, TableType.MOBILITY, TableType.MERCHANTS, TableType.MINIGAMES,
  TableType.BOSSES, TableType.GUILDS, TableType.BANKS,
] as const;
const F2P_UNLOCK_KEY = {
  [TableType.REGIONS]: 'regions', [TableType.MOBILITY]: 'mobility', [TableType.MERCHANTS]: 'merchants',
  [TableType.MINIGAMES]: 'minigames', [TableType.BOSSES]: 'bosses', [TableType.GUILDS]: 'guilds', [TableType.BANKS]: 'banks',
} as const;

const f2pDenominator = (mode?: string, custom?: GameModeRules): number =>
  F2P_SKILLS.length * 10 + EQUIPMENT_SLOTS.reduce((total, slot) => total + f2pEquipmentTierCap(slot), 0)
  + F2P_LIST_TABLES.reduce((total, table) =>
    total + (table === TableType.BANKS && !bankLocksActive(mode, custom) ? 0 : F2P_TABLE_ITEMS[table]!.length), 0);

const f2pPoints = (u: UnlockState, mode?: string, custom?: GameModeRules): number =>
  F2P_SKILLS.reduce((total, skill) => total + (u.skills[skill] ?? 0), 0)
  + EQUIPMENT_SLOTS.reduce((total, slot) => total + Math.min(f2pEquipmentTierCap(slot), u.equipment[slot] ?? 0), 0)
  + F2P_LIST_TABLES.reduce((total, table) => {
    if (table === TableType.BANKS && !bankLocksActive(mode, custom)) return total;
    const owned = new Set<string>(u[F2P_UNLOCK_KEY[table]] ?? []);
    return total + F2P_TABLE_ITEMS[table]!.filter(item => owned.has(item)).length;
  }, 0);

export const completionDenominator = (mode?: string, custom?: GameModeRules): number =>
  isF2PMode(mode) ? f2pDenominator(mode, custom) :
  COMPLETION_DENOMINATOR - REGIONS_LIST.length
  // Chunked counts chunks; other modes count every area they must unlock.
  + (mode === 'chunked' ? ALL_CHUNK_KEYS.length - 1 : unlockableAreas(mode, custom).length)
  - (bankLocksActive(mode, custom) ? 0 : BANK_IDS.length);

const sum = (o: Record<string, number> | undefined) =>
  o ? Object.values(o).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) : 0;
const len = (a: unknown[] | undefined) => (Array.isArray(a) ? a.length : 0);

/** Unlock points the player has accrued. */
export const playerUnlockPoints = (u: UnlockState, mode?: string, custom?: GameModeRules): number =>
  isF2PMode(mode) ? f2pPoints(u, mode, custom) :
  sum(u.skills) + sum(u.equipment) +
  (mode === 'chunked' ? [...new Set(u.chunks ?? [])].filter(k => k !== CHUNKED_START_KEY && ALL_CHUNK_KEYS.includes(k)).length : visibleAreaUnlocks(u.regions).length) + len(u.mobility) + len(u.arcana) + ROLLABLE_POH_ITEMS.filter(item => u.housing?.includes(item)).length +
  len(u.merchants) + len(u.minigames) + len(u.bosses) + ROLLABLE_STORAGE_ITEMS.filter(item => u.storage?.includes(item)).length +
  len(u.guilds) + len(u.farming) + len(u.slayerUnlocks) + (bankLocksActive(mode, custom) ? len(u.banks) : 0);

/** Overall completion percentage (0–100, rounded). */
export const completionPercent = (u: UnlockState, mode?: string, custom?: GameModeRules): number => {
  const points = playerUnlockPoints(u, mode, custom);
  const total = completionDenominator(mode, custom);
  // Do not award complete-run achievements while any unlock points remain.
  return points >= total ? 100 : Math.max(0, Math.min(99, Math.round(points / total * 100)));
};
