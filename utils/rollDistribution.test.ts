import { describe, expect, it } from 'vitest';
import { ROLL_BUCKETS } from './rollDistribution';

describe('ROLL_BUCKETS', () => {
  it('labels decimal five-point buckets from 0.01 to 100.00', () => {
    expect(ROLL_BUCKETS[0].range).toBe('0.01–5.00');
    expect(ROLL_BUCKETS[19].range).toBe('95.01–100.00');
  });
});
