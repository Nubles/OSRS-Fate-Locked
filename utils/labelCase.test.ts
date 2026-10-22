import { describe, expect, it } from 'vitest';
import { sentenceCaseLabel } from './labelCase';

describe('sentenceCaseLabel', () => {
  it('lowers Title-cased words after the first', () => {
    expect(sentenceCaseLabel('Shops & Wares')).toBe('Shops & wares');
    expect(sentenceCaseLabel('Unlock next methods tier')).toBe('Unlock next methods tier');
    expect(sentenceCaseLabel('Travel Networks')).toBe('Travel networks');
  });

  it('keeps acronyms', () => {
    expect(sentenceCaseLabel('POH Facilities')).toBe('POH facilities');
    expect(sentenceCaseLabel('Bonus XP Rewards')).toBe('Bonus XP rewards');
  });

  it('keeps sentences that are already in sentence case', () => {
    expect(sentenceCaseLabel('Spellbooks, prayers, and special combat systems.')).toBe('Spellbooks, prayers, and special combat systems.');
  });
});
