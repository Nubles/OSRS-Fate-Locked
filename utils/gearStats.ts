/**
 * Types + bonus summation for real-gear loadouts.
 *
 * `GearItem` is our normalised shape for an equippable OSRS item (built by
 * GearService from the weirdgloop dps-calc dataset). `GearBonuses` mirrors the
 * standard equipment-stats groups shown in the OSRS DPS tool. Pure + tested.
 */

export interface GearBonuses {
  // Attack (offensive)
  stab: number;
  slash: number;
  crush: number;
  magic: number;
  ranged: number;
  // Defence
  defStab: number;
  defSlash: number;
  defCrush: number;
  defMagic: number;
  defRanged: number;
  // Other
  meleeStr: number;
  rangedStr: number;
  magicStr: number; // magic damage %
  prayer: number;
}

export interface GearItem {
  id: number;
  name: string;
  /** One of our 11 EQUIPMENT_SLOTS. */
  slot: string;
  /** OSRS Wiki image filename (spaces → underscores when building the URL). */
  imageFile: string;
  speed: number;
  twoHanded: boolean;
  /** Upstream combat-style category. Missing cached data must not imply capabilities. */
  category?: string;
  bonuses: GearBonuses;
}

export const ZERO_BONUSES: GearBonuses = {
  stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0,
  defStab: 0, defSlash: 0, defCrush: 0, defMagic: 0, defRanged: 0,
  meleeStr: 0, rangedStr: 0, magicStr: 0, prayer: 0,
};

/** True when an item carries no equipment bonuses at all (a pure cosmetic). */
export const hasNoBonuses = (b: GearBonuses): boolean =>
  (Object.keys(ZERO_BONUSES) as (keyof GearBonuses)[]).every((k) => b[k] === 0);

/** Sum the bonuses of a set of equipped items. */
export const sumBonuses = (items: GearItem[]): GearBonuses => {
  const total: GearBonuses = { ...ZERO_BONUSES };
  for (const it of items) {
    (Object.keys(total) as (keyof GearBonuses)[]).forEach((k) => {
      total[k] += it.bonuses[k] || 0;
    });
  }
  return total;
};

/** Display grouping for the stats panel. */
export const BONUS_GROUPS: { label: string; rows: { key: keyof GearBonuses; label: string; pct?: boolean }[] }[] = [
  {
    label: 'Attack bonus',
    rows: [
      { key: 'stab', label: 'Stab' },
      { key: 'slash', label: 'Slash' },
      { key: 'crush', label: 'Crush' },
      { key: 'magic', label: 'Magic' },
      { key: 'ranged', label: 'Ranged' },
    ],
  },
  {
    label: 'Defence bonus',
    rows: [
      { key: 'defStab', label: 'Stab' },
      { key: 'defSlash', label: 'Slash' },
      { key: 'defCrush', label: 'Crush' },
      { key: 'defMagic', label: 'Magic' },
      { key: 'defRanged', label: 'Ranged' },
    ],
  },
  {
    label: 'Other bonus',
    rows: [
      { key: 'meleeStr', label: 'Melee str' },
      { key: 'rangedStr', label: 'Ranged str' },
      { key: 'magicStr', label: 'Magic dmg', pct: true },
      { key: 'prayer', label: 'Prayer' },
    ],
  },
];
