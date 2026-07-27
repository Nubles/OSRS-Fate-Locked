const KEY_ROLL_UNITS = 1000;
const EXACT_KEY_ROLL_UNITS = 10_000;
const UNITS_PER_PERCENT = 10;
const EXACT_UNITS_PER_PERCENT = 100;

export interface KeyRollInput {
  primaryFloat: number;
  advantageFloat: number;
  baseThreshold: number;
  successBonus: number;
  luck: boolean;
}

export interface KeyRollResolution {
  roll: number;
  baseThreshold: number;
  effectiveThreshold: number;
  success: boolean;
}

export interface ExactKeyRollResolution {
  roll: number;
  success: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundToTenth = (value: number): number =>
  Math.round(value * UNITS_PER_PERCENT) / UNITS_PER_PERCENT;

const normalizedFloat = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1 - Number.EPSILON);
};

const rollFromFloat = (value: number): number =>
  (Math.floor(normalizedFloat(value) * KEY_ROLL_UNITS) + 1) / UNITS_PER_PERCENT;

const exactRollFromFloat = (value: number): number =>
  (Math.floor(normalizedFloat(value) * EXACT_KEY_ROLL_UNITS) + 1) / EXACT_UNITS_PER_PERCENT;

const decimalPlaces = (value: number): number =>
  Math.round(value * EXACT_UNITS_PER_PERCENT) % UNITS_PER_PERCENT === 0 ? 1 : 2;

export const normalizePercent = (value: number): number =>
  Math.round(clamp(Number.isFinite(value) ? value : 0, 0, 100) * EXACT_UNITS_PER_PERCENT)
  / EXACT_UNITS_PER_PERCENT;

export const skillLevelKeyChance = (level: number): number => {
  const finiteLevel = Number.isFinite(level) ? Math.trunc(level) : 1;
  return clamp(finiteLevel, 1, 99) / 5;
};

export const formatKeyPercent = (percent: number): string =>
  `${percent.toFixed(decimalPlaces(percent))}%`;

export const formatKeyRollValue = (roll: number): string =>
  roll.toFixed(decimalPlaces(roll));

/** Standard level and mode-aware roll resolution (one decimal place). */
export function resolveKeyRoll(input: KeyRollInput): KeyRollResolution;
/** Exact two-decimal resolution for contextual Vanilla boss and clue rolls. */
export function resolveKeyRoll(randomFloat: number, thresholdPercent: number): ExactKeyRollResolution;
export function resolveKeyRoll(
  inputOrRandomFloat: KeyRollInput | number,
  thresholdPercent?: number,
): KeyRollResolution | ExactKeyRollResolution {
  if (typeof inputOrRandomFloat === 'number') {
    const roll = exactRollFromFloat(inputOrRandomFloat);
    return { roll, success: roll <= normalizePercent(thresholdPercent ?? 0) };
  }

  const input = inputOrRandomFloat;
  const baseThreshold = roundToTenth(clamp(input.baseThreshold, 0, 100));
  const effectiveThreshold = roundToTenth(
    clamp(baseThreshold + input.successBonus, 0, 100),
  );
  const primaryRoll = rollFromFloat(input.primaryFloat);
  const advantageRoll = rollFromFloat(input.advantageFloat);
  const roll = input.luck ? Math.min(primaryRoll, advantageRoll) : primaryRoll;

  return {
    roll,
    baseThreshold,
    effectiveThreshold,
    success: roll <= effectiveThreshold,
  };
}