import { describe, expect, it } from 'vitest';
import {
  formatKeyPercent,
  formatKeyRollValue,
  normalizePercent,
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

describe('resolveKeyRoll standard mode-aware rolls', () => {
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

  it('clamps thresholds at both bounds and applies negative bonuses', () => {
    expect(resolveKeyRoll({
      primaryFloat: 0,
      advantageFloat: 0,
      baseThreshold: -2,
      successBonus: -3,
      luck: false,
    })).toMatchObject({ baseThreshold: 0, effectiveThreshold: 0, success: false });

    expect(resolveKeyRoll({
      primaryFloat: 0.02,
      advantageFloat: 0,
      baseThreshold: 5,
      successBonus: -2,
      luck: false,
    })).toMatchObject({ baseThreshold: 5, effectiveThreshold: 3, roll: 2.1, success: true });

    expect(resolveKeyRoll({
      primaryFloat: 0.999,
      advantageFloat: 0,
      baseThreshold: 102,
      successBonus: 3,
      luck: false,
    })).toMatchObject({ baseThreshold: 100, effectiveThreshold: 100, roll: 100, success: true });
  });
});

describe('resolveKeyRoll exact Vanilla contextual rolls', () => {
  it('keeps exact 32.5% and 16.25% boundaries', () => {
    expect(resolveKeyRoll(0.3249, 32.5)).toEqual({ roll: 32.5, success: true });
    expect(resolveKeyRoll(0.325, 32.5)).toEqual({ roll: 32.51, success: false });
    expect(resolveKeyRoll(0.1624, 16.25)).toEqual({ roll: 16.25, success: true });
    expect(resolveKeyRoll(0.1625, 16.25)).toEqual({ roll: 16.26, success: false });
  });

  it('preserves whole-number probability boundaries and clamps malformed inputs', () => {
    expect(resolveKeyRoll(0.2499, 25)).toEqual({ roll: 25, success: true });
    expect(resolveKeyRoll(0.25, 25)).toEqual({ roll: 25.01, success: false });
    expect(resolveKeyRoll(-1, -4)).toEqual({ roll: 0.01, success: false });
    expect(resolveKeyRoll(4, 140)).toEqual({ roll: 100, success: true });
    expect(normalizePercent(16.255)).toBe(16.26);
  });
});

describe('decimal roll formatting', () => {
  it('keeps one decimal place for level rolls and two where the contextual rate needs it', () => {
    expect(formatKeyPercent(8.2)).toBe('8.2%');
    expect(formatKeyPercent(15)).toBe('15.0%');
    expect(formatKeyPercent(16.25)).toBe('16.25%');
    expect(formatKeyRollValue(42)).toBe('42.0');
    expect(formatKeyRollValue(16.25)).toBe('16.25');
  });
});