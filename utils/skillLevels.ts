import type { UnlockState } from '../types';

/** Attained account levels are independent of permission to use methods. */
export const actualSkillLevel = (
  unlocks: Pick<UnlockState, 'levels'>, skill: string,
  fallback = skill === 'Hitpoints' ? 10 : 1,
): number => {
  const level = unlocks.levels?.[skill] ?? fallback;
  return Number.isFinite(level) ? Math.max(fallback, Math.min(99, level)) : 0;
};

export const unlockedMethodTier = (unlocks: Pick<UnlockState, 'skills'>, skill: string): number =>
  unlocks.skills?.[skill] ?? 0;

export const unlockedEquipmentTier = (unlocks: Pick<UnlockState, 'equipment'>, slot: string): number =>
  unlocks.equipment?.[slot] ?? 0;

/** Use only for a method's level requirement, never an account-level gate. */
export const usableMethodLevel = (
  unlocks: Pick<UnlockState, 'skills' | 'levels'>, skill: string, fallback = 1,
): number => Math.min(actualSkillLevel(unlocks, skill, fallback), unlockedMethodTier(unlocks, skill) * 10);
