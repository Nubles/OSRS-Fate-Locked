const KEY_ROLL_UNITS = 1000;
const UNITS_PER_PERCENT = 10;

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

export const skillLevelKeyChance = (level: number): number => {
  const finiteLevel = Number.isFinite(level) ? Math.trunc(level) : 1;
  return clamp(finiteLevel, 1, 99) / 5;
};

export const formatKeyPercent = (percent: number): string =>
  `${percent.toFixed(1)}%`;

export const formatKeyRollValue = (roll: number): string =>
  roll.toFixed(1);

export const resolveKeyRoll = (input: KeyRollInput): KeyRollResolution => {
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
};
