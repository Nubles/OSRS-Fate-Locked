import { describe, expect, it } from 'vitest';
import {
  normalizeBossStandardKeysAwarded,
  normalizeClueStandardKeysAwarded,
} from './vanillaKeyProgress';

describe('Vanilla key progress normalization', () => {
  it('keeps known integers, rejects fractions, and clamps at each cap', () => {
    expect(normalizeBossStandardKeysAwarded({
      Brutus: 9,
      Zulrah: 1,
      'Theatre of Blood': 8,
      Unknown: 2,
      Obor: -4,
      Vardorvis: 1.9,
      Nex: Number.POSITIVE_INFINITY,
      "Phosani's Nightmare": Number.NaN,
      Vorkath: '1',
    })).toEqual({
      Brutus: 1,
      Zulrah: 1,
      'Theatre of Blood': 3,
    });
  });

  it('normalizes the shared clue counter without reducing valid history', () => {
    expect(normalizeClueStandardKeysAwarded(undefined)).toBe(0);
    expect(normalizeClueStandardKeysAwarded(-2)).toBe(0);
    expect(normalizeClueStandardKeysAwarded(4.9)).toBe(0);
    expect(normalizeClueStandardKeysAwarded(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeClueStandardKeysAwarded('4')).toBe(0);
    expect(normalizeClueStandardKeysAwarded(4)).toBe(4);
  });
});
