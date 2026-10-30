import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import { dryRunEnds } from './dryRun';

const roll = (id: string, type: LogEntry['type']): LogEntry => ({ id, type, message: type, timestamp: 0 });
const misses = (n: number, from = 0) => Array.from({ length: n }, (_, i) => roll(`m${from + i}`, 'ROLL_FAIL'));

describe('dryRunEnds', () => {
  it('marks the Key that ends a long run of misses with the rolls it took', () => {
    const history = [...misses(40), roll('key', 'ROLL_SUCCESS')];
    expect(dryRunEnds(history, 25).get('key')).toBe(41);
  });

  it('ignores short runs, and other entries neither break nor extend a run', () => {
    const history = [
      ...misses(10), roll('short', 'ROLL_SUCCESS'),
      ...misses(15, 10), roll('u', 'UNLOCK'), ...misses(15, 25), roll('pity', 'PITY'),
    ];
    const ends = dryRunEnds(history, 25);
    expect(ends.has('short')).toBe(false);
    expect(ends.get('pity')).toBe(31);
  });
});
