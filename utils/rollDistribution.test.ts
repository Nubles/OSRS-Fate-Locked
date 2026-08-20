import { describe, expect, it } from 'vitest';
import { buildRollDistribution, ROLL_BUCKETS } from './rollDistribution';

describe('buildRollDistribution', () => {
  it('places decimal boundaries into the correct five-point buckets', () => {
    const buckets = buildRollDistribution([
      { rollValue: 0.01 },
      { rollValue: 5.0 },
      { rollValue: 5.01 },
      { rollValue: 100.0 },
    ]);
    expect(ROLL_BUCKETS[0].range).toBe('0.01–5.00');
    expect(ROLL_BUCKETS[19].range).toBe('95.01–100.00');
    expect(buckets[0]).toMatchObject({ range: '0.01–5.00', count: 2 });
    expect(buckets[1]).toMatchObject({ range: '5.01–10.00', count: 1 });
    expect(buckets[19]).toMatchObject({ range: '95.01–100.00', count: 1 });
  });

  it('accepts legacy integers and ignores missing values', () => {
    const buckets = buildRollDistribution([
      { rollValue: 1 },
      { rollValue: 42 },
      {},
    ]);
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
  });
});
