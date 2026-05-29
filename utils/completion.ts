/**
 * Shared run-completion metric — the single yardstick both you and a Rival Ghost
 * are measured against. Mirrors the Dashboard header's completion %: every
 * unlock (skill tier, equipment tier, region, boss, …) is one point out of a
 * fixed denominator.
 */

import {
  SKILLS_LIST, REGIONS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX,
  MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST,
  BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST,
} from '../constants';
import { UnlockState } from '../types';

/** Total unlock points available for 100% completion. */
export const COMPLETION_DENOMINATOR =
  SKILLS_LIST.length * 10 +
  REGIONS_LIST.length +
  EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX +
  MOBILITY_LIST.length + ARCANA_LIST.length + POH_LIST.length +
  MERCHANTS_LIST.length + MINIGAMES_LIST.length + BOSSES_LIST.length +
  STORAGE_LIST.length + GUILDS_LIST.length + FARMING_PATCH_LIST.length;

const sum = (o: Record<string, number> | undefined) =>
  o ? Object.values(o).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) : 0;
const len = (a: unknown[] | undefined) => (Array.isArray(a) ? a.length : 0);

/** Unlock points the player has accrued. */
export const playerUnlockPoints = (u: UnlockState): number =>
  sum(u.skills) + sum(u.equipment) +
  len(u.regions) + len(u.mobility) + len(u.arcana) + len(u.housing) +
  len(u.merchants) + len(u.minigames) + len(u.bosses) + len(u.storage) +
  len(u.guilds) + len(u.farming);

/** Overall completion percentage (0–100, rounded). */
export const completionPercent = (u: UnlockState): number =>
  Math.round((playerUnlockPoints(u) / COMPLETION_DENOMINATOR) * 100);
