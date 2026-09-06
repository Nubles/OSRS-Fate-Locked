import { describe, expect, it } from 'vitest';
import { actualSkillLevel, unlockedMethodTier, unlockedEquipmentTier } from './skillLevels';
import { EQUIPMENT_SLOTS } from '../data/items';

describe('invalid recorded levels and tiers', () => {
  it('does not treat an unknown skill as an attained level', () => {
    expect(actualSkillLevel({ levels: { Invented: 99 } }, 'Invented')).toBe(0);
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5])('does not accept invalid level %s', level => {
    expect(actualSkillLevel({ levels: { Defence: level } }, 'Defence')).toBe(0);
  });
  it.each([-1, 1.5, 11, Number.POSITIVE_INFINITY])('does not grant method or equipment access for tier %s', tier => {
    expect(unlockedMethodTier({ skills: { Defence: tier } }, 'Defence')).toBe(0);
    const slot = EQUIPMENT_SLOTS[0];
    expect(unlockedEquipmentTier({ equipment: { [slot]: tier } }, slot)).toBe(0);
  });
});
