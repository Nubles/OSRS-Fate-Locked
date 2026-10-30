import { describe, expect, it } from 'vitest';
import { pityHintText } from './pityHint';

describe('pityHintText', () => {
  it('counts the Fate left, and says the next miss pays out once Fate is full', () => {
    expect(pityHintText(1)).toBe('1 Fate Point from a guaranteed Pity Key. Failed rolls count toward it.');
    expect(pityHintText(5)).toMatch(/^5 Fate Points from/);
    expect(pityHintText(0)).toBe('Your Fate is full: your next failed roll gives you a guaranteed Pity Key.');
  });
});
