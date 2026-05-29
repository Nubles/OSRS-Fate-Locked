import { describe, it, expect } from 'vitest';
import { keysToTarget, keyVelocity, forecastTarget } from './fateForecast';
import { LogEntry } from '../types';

const ev = (type: string, dayOffset: number): LogEntry => ({
  id: type + dayOffset,
  timestamp: dayOffset * 86_400_000,
  type: type as any,
  message: '',
});

describe('fate forecast', () => {
  it('keysToTarget is a discrete uniform on 1..R', () => {
    const f = keysToTarget(10);
    expect(f.remaining).toBe(10);
    expect(f.expected).toBe(5.5);
    expect(f.p50).toBe(5);
    expect(f.p10).toBe(1);
    expect(f.p90).toBe(9);
  });

  it('collapses to 1 when only the target is left', () => {
    const f = keysToTarget(1);
    expect(f).toMatchObject({ remaining: 1, p10: 1, p50: 1, p90: 1, expected: 1 });
  });

  it('clamps junk input', () => {
    expect(keysToTarget(0).remaining).toBe(1);
    expect(keysToTarget(-5).p50).toBe(1);
  });

  it('needs ≥2 timed key events for a velocity', () => {
    expect(keyVelocity([]).ok).toBe(false);
    expect(keyVelocity([ev('ROLL_SUCCESS', 0)]).ok).toBe(false);
    // non-key events don't count
    expect(keyVelocity([ev('UNLOCK', 0), ev('UNLOCK', 5)]).ok).toBe(false);
  });

  it('computes keys/day over the sample span', () => {
    // 11 key events spread over 10 days → ~1.1 keys/day
    const hist = Array.from({ length: 11 }, (_, i) => ev('ROLL_SUCCESS', i));
    const v = keyVelocity(hist);
    expect(v.ok).toBe(true);
    expect(v.spanDays).toBe(10);
    expect(v.keysPerDay).toBeCloseTo(1.1, 5);
  });

  it('forecast subtracts keys in hand and converts to days', () => {
    const hist = Array.from({ length: 11 }, (_, i) => ev('ROLL_SUCCESS', i)); // 1.1 keys/day
    const v = keyVelocity(hist);
    const f = forecastTarget(10, 3, v); // R=10 (p50=5), hold 3 keys
    expect(f.keysToEarn.p50).toBe(2); // 5 - 3
    expect(f.days!.p50).toBeCloseTo(2 / 1.1, 5);
  });

  it('returns null days when pace is unknown', () => {
    const f = forecastTarget(8, 0, { ok: false, keysPerDay: 0, spanDays: 0, keysObserved: 0 });
    expect(f.days).toBeNull();
    expect(f.keysToEarn.p50).toBe(keysToTarget(8).p50);
  });
});
