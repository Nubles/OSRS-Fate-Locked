import { BOSS_TIERS, bossTier, type BossTier } from '../data/bossKeyTiers';
import { BOSSES_LIST } from '../data/items';

export const BRUTUS_BOSS_NAME = 'Brutus' as const;

export type VanillaBossClass = BossTier | 'brutus';

export type KeyRollContext =
  | { kind: 'boss'; bossName: string; bossClass: VanillaBossClass }
  | { kind: 'clue'; clueTier: string };

export const VANILLA_BOSS_KEY_RATES: Readonly<Record<VanillaBossClass, readonly number[]>> = {
  brutus: [10],
  low: [15],
  mid: [30, 15],
  high: [50, 25],
  raid: [65, 32.5, 16.25],
};

export const CLUE_ONBOARDING_MINIMUMS = [25, 15, 10] as const;

export const vanillaBossKeySchedule = (bossName: string): readonly number[] => {
  if (bossName === BRUTUS_BOSS_NAME) return VANILLA_BOSS_KEY_RATES.brutus;

  if (!Object.prototype.hasOwnProperty.call(BOSS_TIERS, bossName)) {
    throw new Error(`Missing boss key tier for "${bossName}".`);
  }

  return VANILLA_BOSS_KEY_RATES[bossTier(bossName)];
};

export const vanillaBossKeyStage = (bossName: string, rawAwarded: number) => {
  const rates = vanillaBossKeySchedule(bossName);
  const awarded = Math.min(rates.length, Math.max(0, Math.floor(rawAwarded || 0)));
  return {
    rates,
    awarded,
    cap: rates.length,
    remaining: rates.length - awarded,
    currentRate: rates[awarded] ?? null,
    nextRate: rates[awarded + 1] ?? null,
    capped: awarded >= rates.length,
  };
};

export const clueOnboardingMinimum = (awarded: number): number =>
  CLUE_ONBOARDING_MINIMUMS[Math.max(0, Math.floor(awarded || 0))] ?? 0;

export const effectiveVanillaClueRate = (baseRate: number, awarded: number): number =>
  Math.max(baseRate, clueOnboardingMinimum(awarded));

export const VANILLA_BOSS_STANDARD_KEY_TOTAL =
  1 + BOSSES_LIST.reduce((sum, name) => sum + vanillaBossKeySchedule(name).length, 0);
