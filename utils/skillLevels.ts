import type { UnlockState } from '../types';
import { SKILLS_LIST, EQUIPMENT_SLOTS } from '../data/items';

/** Attained account levels are independent of permission to use methods. */
export const actualSkillLevel = (
  unlocks: Pick<UnlockState, 'levels'>, skill: string,
  fallback = skill === 'Hitpoints' ? 10 : 1,
): number => {
  if (!SKILLS_LIST.includes(skill)) return 0;
  const level = unlocks.levels?.[skill] ?? fallback;
  return Number.isInteger(level) ? Math.max(fallback, Math.min(99, level)) : 0;
};

const validTier = (tier: number | undefined): number =>
  Number.isInteger(tier) && tier! >= 0 && tier! <= 10 ? tier! : 0;

export const unlockedMethodTier = (unlocks: Pick<UnlockState, 'skills'>, skill: string): number =>
  SKILLS_LIST.includes(skill) ? validTier(unlocks.skills?.[skill]) : 0;

export const unlockedEquipmentTier = (unlocks: Pick<UnlockState, 'equipment'>, slot: string): number =>
  EQUIPMENT_SLOTS.includes(slot) ? validTier(unlocks.equipment?.[slot]) : 0;

/** Use only for a method's level requirement, never an account-level gate. */
export const usableMethodLevel = (
  unlocks: Pick<UnlockState, 'skills' | 'levels'>, skill: string, fallback = 1,
): number => Math.min(actualSkillLevel(unlocks, skill, fallback), unlockedMethodTier(unlocks, skill) * 10);
