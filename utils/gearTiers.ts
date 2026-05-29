/**
 * Derives an "estimated tier" (1..EQUIPMENT_TIER_MAX) for every real item, per
 * slot, so real gear can be gated by the fate-lock tier the player has unlocked.
 *
 * There's no canonical item→tier map in OSRS, so we compute a transparent power
 * score from each item's bonuses and split each slot's items into equal-sized
 * quantile buckets. This is automatic (no manual data), monotonic (a stronger
 * item never lands in a lower tier than a weaker one in the same slot), and the
 * weights live here so the mapping can be retuned without touching the UI.
 *
 * Pure + tested.
 */

import { GearBonuses } from './gearStats';
import { EQUIPMENT_TIER_MAX } from '../config/rules';

/** Single scalar "power" for an item, from its bonuses. Higher = stronger. */
export const powerScore = (b: GearBonuses): number => {
  const offence =
    Math.max(b.stab, b.slash, b.crush, b.ranged, b.magic) +
    Math.max(b.meleeStr, 0) +
    Math.max(b.rangedStr, 0) +
    8 * Math.max(b.magicStr, 0);
  const defence =
    b.defStab + b.defSlash + b.defCrush + b.defMagic + b.defRanged +
    2 * Math.max(b.prayer, 0);
  return offence + 0.6 * Math.max(0, defence);
};

/**
 * Assign tiers 1..EQUIPMENT_TIER_MAX to a slot's items by quantile of score.
 * Returns a Map of item id → tier. Ties are broken by sorted position, so the
 * result is always monotonic in score. With fewer items than tiers the upper
 * tiers simply go unused.
 */
export const assignTiersForSlot = (
  items: { id: number; score: number }[],
  tierMax: number = EQUIPMENT_TIER_MAX,
): Map<number, number> => {
  const out = new Map<number, number>();
  const n = items.length;
  if (n === 0) return out;
  const sorted = [...items].sort((a, b) => a.score - b.score);
  sorted.forEach((item, i) => {
    // rank fraction in [0,1) → tier in 1..tierMax
    const tier = Math.min(tierMax, Math.floor((i / n) * tierMax) + 1);
    out.set(item.id, tier);
  });
  return out;
};
