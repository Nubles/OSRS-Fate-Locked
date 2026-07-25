import { describe, expect, it } from 'vitest';
import { LogEntry } from '../types';
import * as statsModalModule from './StatsModal';

describe('StatsModal roll calculations', () => {
  it('includes a sub-1.0 roll in Stats without leaving the first bucket', () => {
    const buildStats = (
      statsModalModule as Record<string, unknown>
    ).buildStats as (history: LogEntry[]) => {
      totalRolls: number;
      expectedSuccesses: number;
      buckets: Array<{ count: number }>;
    };
    expect(buildStats).toBeTypeOf('function');

    const history: LogEntry[] = [{
      id: 'sub-one-roll',
      timestamp: 1,
      type: 'ROLL_FAIL',
      message: 'No Key.',
      result: 'FAIL',
      source: 'Attack level 2',
      rollValue: 0.4,
      baseThreshold: 0.4,
      threshold: 0.4,
    }];

    const stats = buildStats(history);
    expect(stats.totalRolls).toBe(1);
    expect(stats.expectedSuccesses).toBe(0.004);
    expect(stats.buckets[0].count).toBe(1);
    expect(stats.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
  });
});