import { describe, expect, it } from 'vitest';
import { resolveKeyRoll } from './keyRoll';

describe('resolveKeyRoll', () => {
  it('keeps exact 32.5% and 16.25% boundaries', () => {
    expect(resolveKeyRoll(0.3249, 32.5)).toEqual({ roll: 32.5, success: true });
    expect(resolveKeyRoll(0.325, 32.5)).toEqual({ roll: 32.51, success: false });
    expect(resolveKeyRoll(0.1624, 16.25)).toEqual({ roll: 16.25, success: true });
    expect(resolveKeyRoll(0.1625, 16.25)).toEqual({ roll: 16.26, success: false });
  });

  it('preserves whole-number probability boundaries', () => {
    expect(resolveKeyRoll(0.2499, 25)).toEqual({ roll: 25, success: true });
    expect(resolveKeyRoll(0.25, 25)).toEqual({ roll: 25.01, success: false });
  });

  it('clamps malformed inputs', () => {
    expect(resolveKeyRoll(-1, -4)).toEqual({ roll: 0.01, success: false });
    expect(resolveKeyRoll(4, 140)).toEqual({ roll: 100, success: true });
  });
});
