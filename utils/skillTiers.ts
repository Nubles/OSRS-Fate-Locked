/**
 * Skill tier ↔ level model — the single source of truth.
 *
 * Cap model: unlocking tier N grants the right to use content requiring levels
 * 1 … N×10. So a level-60 activity (e.g. yew trees) needs tier 6, and a player
 * with 99 Woodcutting but only tier 3 unlocked still can't cut yews.
 *
 *   tier 1 → levels 1–10      tier 6 → levels 51–60 (cumulative 1–60)
 *   tier 7 → levels 61–70     tier 10 → levels 91–99
 *
 * Both the resource gate (utils/chunkResources) and the progression UI
 * (SkillDetailModal) read from here, so they can never drift apart again.
 */

/** The lowest tier that unlocks the right to use a level-`level` activity. */
export const tierForLevel = (level: number): number =>
  level > 90 ? 10 : Math.max(1, Math.ceil(level / 10));

/** The new level band a tier opens up (cumulative access is 1 → max). */
export const tierBand = (tier: number): { min: number; max: number; label: string } => {
  const min = (tier - 1) * 10 + 1;
  const max = tier >= 10 ? 99 : tier * 10;
  return { min, max, label: `${min}-${max}` };
};
