import { describe, expect, it } from 'vitest';
import {
  formatKeyPercent,
  formatKeyRollValue,
  resolveKeyRoll,
  skillLevelKeyChance,
} from './keyRoll';

describe('skillLevelKeyChance', () => {
  it('uses exact level / 5 odds', () => {
    expect(skillLevelKeyChance(2)).toBe(0.4);
    expect(skillLevelKeyChance(41)).toBe(8.2);
    expect(skillLevelKeyChance(42)).toBe(8.4);
    expect(skillLevelKeyChance(99)).toBe(19.8);
  });

  it('clamps invalid and out-of-range levels', () => {
    expect(skillLevelKeyChance(0)).toBe(0.2);
    expect(skillLevelKeyChance(100)).toBe(19.8);
    expect(skillLevelKeyChance(Number.NaN)).toBe(0.2);
  });
});

describe('resolveKeyRoll', () => {
  it('honours the exact 8.2% boundary', () => {
    expect(resolveKeyRoll({
      primaryFloat: 0.081,
      advantageFloat: 0.9,
      baseThreshold: 8.2,
      successBonus: 0,
      luck: false,
    })).toMatchObject({ roll: 8.2, baseThreshold: 8.2, effectiveThreshold: 8.2, success: true });

    expect(resolveKeyRoll({
      primaryFloat: 0.082,
      advantageFloat: 0.9,
      baseThreshold: 8.2,
      successBonus: 0,
      luck: false,
    })).toMatchObject({ roll: 8.3, success: false });
  });

  it('preserves integer-rate outcomes from the old d100 rule', () => {
    for (const randomFloat of [0, 0.049, 0.05, 0.1499, 0.15, 0.999]) {
      const oldSuccess = Math.floor(randomFloat * 100) + 1 <= 15;
      const next = resolveKeyRoll({
        primaryFloat: randomFloat,
        advantageFloat: 0.999,
        baseThreshold: 15,
        successBonus: 0,
        luck: false,
      });
      expect(next.success).toBe(oldSuccess);
    }
  });

  it('keeps sub-1% odds exact and adds real mode bonuses', () => {
    expect(resolveKeyRoll({
      primaryFloat: 0,
      advantageFloat: 0.9,
      baseThreshold: 0.4,
      successBonus: 0,
      luck: false,
    }).effectiveThreshold).toBe(0.4);
    expect(resolveKeyRoll({
      primaryFloat: 0,
      advantageFloat: 0.9,
      baseThreshold: 0.4,
      successBonus: 1,
      luck: false,
    }).effectiveThreshold).toBe(1.4);
  });

  it('uses the lower draw under Luck', () => {
    expect(resolveKeyRoll({
      primaryFloat: 0.9,
      advantageFloat: 0.01,
      baseThreshold: 5,
      successBonus: 0,
      luck: true,
    })).toMatchObject({ roll: 1.1, success: true });
  });
});

describe('decimal roll formatting', () => {
  it('always exposes one decimal place', () => {
    expect(formatKeyPercent(8.2)).toBe('8.2%');
    expect(formatKeyPercent(15)).toBe('15.0%');
    expect(formatKeyRollValue(42)).toBe('42.0');
  });
});
