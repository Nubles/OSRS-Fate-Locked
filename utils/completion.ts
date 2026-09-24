/**
 * Shared run-completion metric — the single yardstick both you and a Rival Ghost
 * are measured against. Mirrors the Dashboard header's completion %: every
 * unlock (skill tier, equipment tier, region, boss, …) is one point out of a
 * fixed denominator.
 */

import {
  SKILLS_LIST, REGIONS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX,
  MOBILITY_LIST, ARCANA_LIST, ROLLABLE_POH_ITEMS, MERCHANTS_LIST, MINIGAMES_LIST,
  BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST,
  SLAYER_UNLOCKS_LIST,
} from '../constants';
import { ALL_CHUNK_KEYS, CHUNKED_START_KEY } from './chunkAdjacency';
import { bankLocksActive } from './reachability';
import { unlockableAreas } from './freeAreas';
import type { GameModeRules } from '../config/gameModes';
import { UnlockState } from '../types';
import { BANK_IDS } from '../data/banks';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';

/** Total unlock points available for 100% completion. */
export const COMPLETION_DENOMINATOR =
  SKILLS_LIST.length * 10 +
  REGIONS_LIST.length +
  EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX +
  MOBILITY_LIST.length + ARCANA_LIST.length + ROLLABLE_POH_ITEMS.length +
  MERCHANTS_LIST.length + MINIGAMES_LIST.length + BOSSES_LIST.length +
  STORAGE_LIST.length + GUILDS_LIST.length + FARMING_PATCH_LIST.length +
  SLAYER_UNLOCKS_LIST.length +
  // Each bank/deposit box is its own unlock (locked in every built-in mode).
  // (A Custom banks-off run — no longer selectable — would cap just under 100%.)
  BANK_IDS.length;

export const completionDenominator = (mode?: string, custom?: GameModeRules): number =>
  COMPLETION_DENOMINATOR - REGIONS_LIST.length
  // Chunked counts chunks; other modes count every area they must unlock.
  + (mode === 'chunked' ? ALL_CHUNK_KEYS.length - 1 : unlockableAreas(mode, custom).length)
  - (bankLocksActive(mode, custom) ? 0 : BANK_IDS.length);

const sum = (o: Record<string, number> | undefined) =>
  o ? Object.values(o).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) : 0;
const len = (a: unknown[] | undefined) => (Array.isArray(a) ? a.length : 0);

/** Unlock points the player has accrued. */
export const playerUnlockPoints = (u: UnlockState, mode?: string, custom?: GameModeRules): number =>
  sum(u.skills) + sum(u.equipment) +
  (mode === 'chunked' ? [...new Set(u.chunks ?? [])].filter(k => k !== CHUNKED_START_KEY && ALL_CHUNK_KEYS.includes(k)).length : visibleAreaUnlocks(u.regions).length) + len(u.mobility) + len(u.arcana) + ROLLABLE_POH_ITEMS.filter(item => u.housing?.includes(item)).length +
  len(u.merchants) + len(u.minigames) + len(u.bosses) + len(u.storage) +
  len(u.guilds) + len(u.farming) + len(u.slayerUnlocks) + (bankLocksActive(mode, custom) ? len(u.banks) : 0);

/** Overall completion percentage (0–100, rounded). */
export const completionPercent = (u: UnlockState, mode?: string, custom?: GameModeRules): number => {
  const points = playerUnlockPoints(u, mode, custom);
  const total = completionDenominator(mode, custom);
  // Do not award complete-run achievements while any unlock points remain.
  return points >= total ? 100 : Math.max(0, Math.min(99, Math.round(points / total * 100)));
};
