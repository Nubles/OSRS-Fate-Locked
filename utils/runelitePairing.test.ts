import { describe, expect, it } from 'vitest';
import {
  RUNELITE_PAIR_CODE_PATTERN,
  RUNELITE_PAIR_HASH_PREFIX,
  RUNELITE_PAIRING_SUCCESS_COPY,
  isRunelitePairCode,
  parseRunelitePairFragment,
} from './runelitePairing';

describe('RuneLite pairing fragments', () => {
  const code = '0123456789abcdef0123456789abcdef';

  it('exposes the strict protocol constants and success copy', () => {
    expect(RUNELITE_PAIR_HASH_PREFIX).toBe('#runelite-pair=');
    expect(RUNELITE_PAIR_CODE_PATTERN.test(code)).toBe(true);
    expect(RUNELITE_PAIRING_SUCCESS_COPY).toBe(
      'Profile sent. Return to RuneLite; its Fate Locked panel will show Connected after the first valid import.',
    );
  });

  it('accepts only lowercase 32-character hexadecimal codes', () => {
    expect(isRunelitePairCode(code)).toBe(true);
    expect(isRunelitePairCode(code.toUpperCase())).toBe(false);
    expect(isRunelitePairCode('ABCD1234')).toBe(false);
  });

  it('parses only a complete RuneLite pairing fragment', () => {
    expect(parseRunelitePairFragment(`${RUNELITE_PAIR_HASH_PREFIX}${code}`))
      .toBe(code);
    expect(parseRunelitePairFragment('#runelite-pair=ABCD1234')).toBeNull();
    expect(parseRunelitePairFragment(
      '#runelite-pair=0123456789ABCDEF0123456789ABCDEF',
    )).toBeNull();
    expect(parseRunelitePairFragment('#sync=ABCD1234')).toBeNull();
    expect(parseRunelitePairFragment('#/overlay')).toBeNull();
  });
});
