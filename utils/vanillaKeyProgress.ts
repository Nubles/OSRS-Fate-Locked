import { BOSSES_LIST } from '../data/items';
import { BRUTUS_BOSS_NAME, vanillaBossKeyStage } from '../config/vanillaKeyEconomy';

const KNOWN_BOSS_NAMES = new Set([...BOSSES_LIST, BRUTUS_BOSS_NAME]);

export const isKnownVanillaBoss = (bossName: string): boolean => KNOWN_BOSS_NAMES.has(bossName);

export const normalizeBossStandardKeysAwarded = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const normalized: Record<string, number> = {};
  for (const [bossName, awarded] of Object.entries(value)) {
    if (
      !KNOWN_BOSS_NAMES.has(bossName)
      || typeof awarded !== 'number'
      || !Number.isFinite(awarded)
      || !Number.isInteger(awarded)
      || awarded <= 0
    ) continue;

    normalized[bossName] = Math.min(awarded, vanillaBossKeyStage(bossName, awarded).cap);
  }

  return normalized;
};

export const normalizeClueStandardKeysAwarded = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
    ? value
    : 0;
