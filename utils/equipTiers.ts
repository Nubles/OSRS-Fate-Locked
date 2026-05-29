/**
 * Shared palette for equipment tiers (1..9 = EQUIPMENT_TIER_MAX). A stone→gold
 * ramp that mirrors the skill-tier palette so slot badges, breakdown bars, and
 * legends read consistently across the app. Index 0 = Tier 1.
 */
export const EQUIP_TIER_COLORS = [
  'bg-stone-600',   // T1
  'bg-orange-900',  // T2
  'bg-slate-500',   // T3
  'bg-slate-300',   // T4
  'bg-emerald-700', // T5
  'bg-cyan-600',    // T6
  'bg-red-700',     // T7
  'bg-purple-600',  // T8
  'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.7)]', // T9 (max)
];

export const equipTierColor = (tier: number): string =>
  EQUIP_TIER_COLORS[Math.min(Math.max(tier - 1, 0), EQUIP_TIER_COLORS.length - 1)];
