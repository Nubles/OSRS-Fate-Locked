import { describe, expect, it } from 'vitest';
import { dpsCombatOptions, weaponCombatOptions } from './weaponCombat';
import { STANCES } from './dps';

describe('reviewed weapon attacks', () => {
  it('keeps defensive crush available on bladed staves without inventing aggressive crush', () => {
    expect(weaponCombatOptions('Bladed Staff').filter(option => option.attackType === 'crush'))
      .toEqual([{ style: 'melee', attackType: 'crush', stanceId: 'defensive' }]);
  });
  it('keeps unarmed explicit and does not turn missing metadata into fists', () => {
    expect(weaponCombatOptions('Unarmed').every(option => option.attackType === 'crush')).toBe(true);
    expect(weaponCombatOptions(undefined)).toEqual([]);
    expect(weaponCombatOptions('Unreviewed category')).toEqual([]);
  });
  it('supports the upstream lowercase blunt category without treating it as unknown', () => {
    expect(weaponCombatOptions('blunt')).toEqual(weaponCombatOptions('Blunt'));
  });
  it('uses legal numeric stance bonuses for every reviewed category', () => {
    for (const category of ['Whip', 'Spear', 'Bow', 'Staff', 'Powered Staff', 'Salamander', 'Bladed Staff', 'Partisan', 'Multi-Melee']) {
      for (const option of dpsCombatOptions(category)) {
        expect(STANCES[option.style].some(stance => stance.id === option.stanceId)).toBe(true);
      }
    }
  });
  it('uses normal spell speed rather than borrowing a rapid weapon attack speed', () => {
    expect(dpsCombatOptions('Thrown').find(option => option.style === 'magic'))
      .toMatchObject({ stanceId: 'standard', speedTicks: 5 });
  });
});
