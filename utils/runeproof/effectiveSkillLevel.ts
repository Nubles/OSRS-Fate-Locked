import type { RuneProofRunSnapshot } from '../../types';

export function effectiveSkillLevel(
  snapshot: RuneProofRunSnapshot,
  skill: string,
): number {
  const observed = snapshot.currentLevels[skill] ?? 0;
  const tier = snapshot.skillCaps[skill] ?? 0;
  if (!Number.isFinite(observed) || !Number.isFinite(tier)) return 0;
  const cap = tier >= 10 ? 99 : Math.max(0, tier) * 10;
  return Math.min(Math.max(0, observed), cap);
}