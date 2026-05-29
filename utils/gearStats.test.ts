import { describe, it, expect } from 'vitest';
import { sumBonuses, hasNoBonuses, ZERO_BONUSES, GearItem, GearBonuses } from './gearStats';

const bonuses = (over: Partial<GearBonuses>): GearBonuses => ({ ...ZERO_BONUSES, ...over });
const item = (id: number, over: Partial<GearBonuses>): GearItem => ({
  id, name: `item${id}`, slot: 'Weapon', imageFile: 'x.png', speed: 4, twoHanded: false,
  bonuses: bonuses(over),
});

describe('gear stats', () => {
  it('an empty loadout sums to all zero', () => {
    expect(sumBonuses([])).toEqual(ZERO_BONUSES);
  });

  it('sums bonuses field-by-field', () => {
    const total = sumBonuses([
      item(1, { slash: 80, meleeStr: 82 }),
      item(2, { slash: 5, defSlash: 100, prayer: 3 }),
    ]);
    expect(total.slash).toBe(85);
    expect(total.meleeStr).toBe(82);
    expect(total.defSlash).toBe(100);
    expect(total.prayer).toBe(3);
    expect(total.ranged).toBe(0);
  });

  it('detects cosmetics with no bonuses', () => {
    expect(hasNoBonuses(ZERO_BONUSES)).toBe(true);
    expect(hasNoBonuses(bonuses({ prayer: 1 }))).toBe(false);
    expect(hasNoBonuses(bonuses({ defMagic: -5 }))).toBe(false);
  });
});
