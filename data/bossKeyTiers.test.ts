import { describe, it, expect } from 'vitest';
import { BOSSES_LIST } from './items';
import { BOSS_TIERS, TIER_SOURCE, bossTier } from './bossKeyTiers';
import { DROP_RATES } from '../config/rules';

describe('boss key tiers', () => {
  it('registers The Mad Angel as a mid-tier boss', () => {
    expect(BOSSES_LIST).toContain('The Mad Angel');
    expect(BOSS_TIERS['The Mad Angel']).toBe('mid');
  });

  it('classifies every boss in BOSSES_LIST', () => {
    const missing = BOSSES_LIST.filter(b => !BOSS_TIERS[b]);
    expect(missing, 'bosses with no key tier').toEqual([]);
  });

  it('has no tier entry for a non-existent boss', () => {
    const bossSet = new Set(BOSSES_LIST);
    const extra = Object.keys(BOSS_TIERS).filter(b => !bossSet.has(b));
    expect(extra, 'tier entries not in BOSSES_LIST').toEqual([]);
  });

  it('every tier maps to a DropSource with a real rate', () => {
    for (const t of ['low', 'mid', 'high', 'raid'] as const) {
      expect(DROP_RATES[TIER_SOURCE[t]], `rate for ${t}`).toBeGreaterThan(0);
    }
  });

  it('rate increases with tier (low < mid < high < raid)', () => {
    const r = (t: 'low' | 'mid' | 'high' | 'raid') => DROP_RATES[TIER_SOURCE[t]];
    expect(r('low')).toBeLessThan(r('mid'));
    expect(r('mid')).toBeLessThan(r('high'));
    expect(r('high')).toBeLessThan(r('raid'));
    expect(bossTier('Chambers of Xeric')).toBe('raid');
  });
});
