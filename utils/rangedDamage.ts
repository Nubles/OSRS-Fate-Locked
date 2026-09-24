export type RangedDamageType = 'light' | 'standard' | 'heavy';

/** Wiki combat categories; chinchompas use heavy defence for the initial target. */
export function rangedDamageTypeForCategory(category?: string): RangedDamageType | undefined {
  if (category === 'Thrown') return 'light';
  if (category === 'Bow' || category === 'Salamander') return 'standard';
  if (category === 'Crossbow' || category === 'Chinchompas') return 'heavy';
  return undefined;
}

export function rangedDefenceFor(
  monster: { def: { ranged: number }; rangedDefence?: Record<RangedDamageType, number> },
  type: RangedDamageType,
): number {
  return monster.rangedDefence?.[type] ?? monster.def.ranged;
}
