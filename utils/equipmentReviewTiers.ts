/**
 * Reviewed-tier lookup for gear the material ladder can't name. Loaded lazily
 * with data/equipmentReview.ts (services/GearService.ts) so neither sits in
 * the entry chunk.
 */
import { EQUIPMENT_TIER_MAX } from '../config/rules';
import { EQUIPMENT_REVIEW } from '../data/equipmentReview';
import { canonicalTierFromName, type EquipmentReview, type WieldLevels } from './gearTiers';

const bandOf = (level: number, steps: number[]): number =>
  1 + steps.filter(step => level >= step).length;
// Each step is the wield level of the Codex material that opens the next tier:
// steel 5, mithril 20, adamant 30, rune 40, dragon 60, Barrows 70, godswords 75.
const MELEE_STEPS = [5, 20, 30, 40, 60, 70, 75];
// Ranged/magic armour: studded 20, snakeskin 30, green d'hide/mystic 40,
// blue d'hide 50, red d'hide 60, black d'hide/Ahrim's 70.
const ARMOUR_STEPS = [20, 30, 40, 50, 60, 70, 75];
// Crossbows keep their metal: steel 31, mithril 36, adamant 46, rune 61, dragon 64.
const CROSSBOW_STEPS = [31, 36, 46, 61, 64, 70, 75];

/**
 * An item with no material word sits with the material that needs the same
 * wield level, so a level-50 Attack weapon sits with rune at T5.
 */
export const requirementTier = (levels: WieldLevels, slot: string, category?: string): number => {
  const level = Math.max(0, ...Object.values(levels).map(value => value ?? 0));
  const isArmour = slot !== 'Weapon' && slot !== 'Ammo';
  const steps = slot === 'Weapon' && category === 'Crossbow' ? CROSSBOW_STEPS
    : isArmour && ((levels.ranged ?? 0) > 0 || (levels.magic ?? 0) > 0) ? ARMOUR_STEPS
    : MELEE_STEPS;
  return Math.min(EQUIPMENT_TIER_MAX, bandOf(level, steps));
};

/**
 * The reviewed Fate tier for an item, or null when it still needs review:
 * the Codex ladder and named rules first, then reviewed placements, then the
 * item's wield level.
 */
export const reviewedTier = (
  item: { name: string; slot: string; category?: string },
  review: EquipmentReview | null = EQUIPMENT_REVIEW,
): number | null => {
  const canonical = canonicalTierFromName(item.name);
  if (canonical != null || !review) return canonical;
  const key = item.name.toLowerCase();
  if (Object.hasOwn(review.placed, key)) return review.placed[key];
  const levels = Object.hasOwn(review.wieldLevels, key) ? review.wieldLevels[key] : undefined;
  return levels ? requirementTier(levels, item.slot, item.category) : null;
};
