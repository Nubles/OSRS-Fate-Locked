import { describe, expect, it } from 'vitest';
import { buildRollDistribution } from './rollDistribution';

describe('buildRollDistribution', () => {
  it('places decimal boundaries into the correct five-point buckets', () => {
    const buckets = buildRollDistribution([
      { rollValue: 0.1 },
      { rollValue: 5.0 },
      { rollValue: 5.1 },
      { rollValue: 100.0 },
    ]);
    expect(buckets[0]).toMatchObject({ range: '0.1–5.0', count: 2 });
    expect(buckets[1]).toMatchObject({ range: '5.1–10.0', count: 1 });
    expect(buckets[19]).toMatchObject({ range: '95.1–100.0', count: 1 });
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
