import { describe, expect, it } from 'vitest';
import { EQUIP_TIER_COLORS, EQUIP_TIER_TEXT_COLORS } from './equipTiers';
import { EQUIPMENT_TIER_MAX } from '../config/rules';

const hue = (cls: string): string => cls.split(' ')[0].replace(/^(bg|text)-/, '').replace(/-\d+$/, '');

describe('equipment tier colours', () => {
  it('give the Codex tier names the same hue as the gear badges, tier by tier', () => {
    expect(EQUIP_TIER_TEXT_COLORS).toHaveLength(EQUIPMENT_TIER_MAX);
    expect(EQUIP_TIER_TEXT_COLORS.map(hue)).toEqual(EQUIP_TIER_COLORS.map(hue));
  });
});
