import { BOSS_TIERS, bossTier, type BossTier } from '../data/bossKeyTiers';
import { BOSSES_LIST, MINIGAMES_LIST } from '../data/items';
import { MINIGAME_TIERS, minigameTier, type MinigameTier } from '../data/minigameKeyTiers';

export const BRUTUS_BOSS_NAME = 'Brutus' as const;

export type VanillaBossClass = BossTier | 'brutus';

export type KeyRollContext =
  | { kind: 'boss'; bossName: string; bossClass: VanillaBossClass }
  | { kind: 'clue'; clueTier: string }
  | { kind: 'minigame'; minigameName: string; minigameTier: MinigameTier };

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

const keyReserveStage = (rates: readonly number[], rawAwarded: number) => {
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

export type KeyReserveStage = ReturnType<typeof keyReserveStage>;

export const vanillaBossKeyStage = (bossName: string, rawAwarded: number): KeyReserveStage =>
  keyReserveStage(vanillaBossKeySchedule(bossName), rawAwarded);

/**
 * The bosses and raids that have given every Standard Key they hold (Brutus
 * his one), so in Vanilla their kills don't roll again this run. A name the
 * app doesn't know is left out.
 */
export const vanillaSpentBosses = (awarded: Readonly<Record<string, number>> | undefined): string[] =>
  Object.entries(awarded ?? {})
    .filter(([name, count]) => (name === BRUTUS_BOSS_NAME || Object.prototype.hasOwnProperty.call(BOSS_TIERS, name))
      && vanillaBossKeyStage(name, count).capped)
    .map(([name]) => name)
    .sort((left, right) => left.localeCompare(right));

export const clueOnboardingMinimum = (awarded: number): number =>
  CLUE_ONBOARDING_MINIMUMS[Math.max(0, Math.floor(awarded || 0))] ?? 0;

export const effectiveVanillaClueRate = (baseRate: number, awarded: number): number =>
  Math.max(baseRate, clueOnboardingMinimum(awarded));

export const VANILLA_BOSS_STANDARD_KEY_TOTAL =
  1 + BOSSES_LIST.reduce((sum, name) => sum + vanillaBossKeySchedule(name).length, 0);

// ── Minigames ───────────────────────────────────────────────────────────────
// In Vanilla each unlocked minigame holds a few Standard Keys at falling odds,
// like a boss, sized by how long one finished run takes (data/minigameKeyTiers).
export const VANILLA_MINIGAME_KEY_RATES: Readonly<Record<MinigameTier, readonly number[]>> = {
  quick: [10],
  standard: [20, 10],
  long: [30, 15],
};

export const isKnownVanillaMinigame = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(MINIGAME_TIERS, name);

export const vanillaMinigameKeySchedule = (name: string): readonly number[] => {
  if (!isKnownVanillaMinigame(name)) {
    throw new Error(`Missing minigame key tier for "${name}".`);
  }
  return VANILLA_MINIGAME_KEY_RATES[minigameTier(name)];
};

export const vanillaMinigameKeyStage = (name: string, rawAwarded: number): KeyReserveStage =>
  keyReserveStage(vanillaMinigameKeySchedule(name), rawAwarded);

export const VANILLA_MINIGAME_STANDARD_KEY_TOTAL =
  MINIGAMES_LIST.reduce((sum, name) => sum + vanillaMinigameKeySchedule(name).length, 0);

/** Drops unknown names and bad counts, and clamps each count to its minigame's reserve. */
export const normalizeMinigameStandardKeysAwarded = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const normalized: Record<string, number> = {};
  for (const [name, awarded] of Object.entries(value)) {
    if (
      !isKnownVanillaMinigame(name)
      || typeof awarded !== 'number'
      || !Number.isInteger(awarded)
      || awarded <= 0
    ) continue;
    normalized[name] = Math.min(awarded, vanillaMinigameKeySchedule(name).length);
  }
  return normalized;
};
