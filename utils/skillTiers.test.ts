import { describe, it, expect } from 'vitest';
import { tierForLevel, tierBand } from './skillTiers';

describe('tierForLevel (cap model)', () => {
  it('maps a level to the lowest tier that reaches it', () => {
    expect(tierForLevel(1)).toBe(1);
    expect(tierForLevel(10)).toBe(1);   // tier 1 = up to 10
    expect(tierForLevel(11)).toBe(2);
    expect(tierForLevel(60)).toBe(6);   // yews → tier 6
    expect(tierForLevel(61)).toBe(7);
    expect(tierForLevel(90)).toBe(9);
    expect(tierForLevel(91)).toBe(10);
    expect(tierForLevel(99)).toBe(10);
  });
});

describe('tierBand', () => {
  it('labels the new band a tier opens (cumulative cap)', () => {
    expect(tierBand(1)).toMatchObject({ min: 1, max: 10, label: '1-10' });
    expect(tierBand(6)).toMatchObject({ min: 51, max: 60, label: '51-60' });
    expect(tierBand(7)).toMatchObject({ min: 61, max: 70, label: '61-70' });
    expect(tierBand(10)).toMatchObject({ min: 91, max: 99, label: '91-99' });
  });

  it('a level falls inside its own tier band', () => {
    for (const lvl of [1, 10, 11, 60, 61, 99]) {
      const t = tierForLevel(lvl);
      const { min, max } = tierBand(t);
      expect(lvl >= min && lvl <= max, `level ${lvl} in tier ${t} band`).toBe(true);
    }
  });
});
