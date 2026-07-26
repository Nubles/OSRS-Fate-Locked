const ROLL_UNITS = 10_000;
const UNITS_PER_PERCENT = 100;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const normalizePercent = (value: number): number =>
  Math.round(clamp(Number.isFinite(value) ? value : 0, 0, 100) * 100) / 100;

export const resolveKeyRoll = (
  randomFloat: number,
  thresholdPercent: number,
): { roll: number; success: boolean } => {
  const normalizedFloat = clamp(
    Number.isFinite(randomFloat) ? randomFloat : 0,
    0,
    1 - Number.EPSILON,
  );
  const units = Math.floor(normalizedFloat * ROLL_UNITS) + 1;
  const roll = units / UNITS_PER_PERCENT;
  return { roll, success: roll <= normalizePercent(thresholdPercent) };
};
