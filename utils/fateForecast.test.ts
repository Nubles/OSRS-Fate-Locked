import { describe, it, expect } from 'vitest';
import { chanceWithin, keysToTarget, keyVelocity, forecastTarget, rangeShare } from './fateForecast';
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

  it('gives the real chance of the median and of the p10–p90 range shown', () => {
    // R = 10: p10 = 1, p50 = 5, p90 = 9. No value is most likely; each is 1 in 10.
    const ten = keysToTarget(10);
    expect(chanceWithin(ten, ten.p50)).toBe(0.5);
    expect(rangeShare(ten)).toBe(0.9);
    // Five or fewer left: the range covers every outcome.
    expect(rangeShare(keysToTarget(5))).toBe(1);
    // 68 left: 7 to 62 Keys is 56 of the 68 outcomes, about 82%, not 80%.
    expect(rangeShare(keysToTarget(68))).toBeCloseTo(56 / 68, 10);
    // An odd count: the median covers a little more than half.
    expect(chanceWithin(keysToTarget(5), keysToTarget(5).p50)).toBe(0.6);
    expect(chanceWithin(ten, 25)).toBe(1);
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
    // 11 daily key events: 10 keys earned after the first, over 10 days.
    const hist = Array.from({ length: 11 }, (_, i) => ev('ROLL_SUCCESS', i));
    const v = keyVelocity(hist);
    expect(v.ok).toBe(true);
    expect(v.spanDays).toBe(10);
    expect(v.keysObserved).toBe(11);
    expect(v.keysPerDay).toBeCloseTo(1, 5);
  });

  it('counts the gaps between key events, not the events', () => {
    // Two keys a day apart are one key a day, not two.
    expect(keyVelocity([ev('ROLL_SUCCESS', 0), ev('PITY', 1)]).keysPerDay).toBeCloseTo(1, 5);
    // A key with no timestamp can't mark the span.
    const untimed = { ...ev('ROLL_OMNI', 0), timestamp: undefined } as unknown as LogEntry;
    expect(keyVelocity([ev('ROLL_SUCCESS', 0), untimed, ev('ROLL_SUCCESS', 2)]).keysPerDay).toBeCloseTo(0.5, 5);
    // One key alone has no pace.
    expect(keyVelocity([ev('ROLL_SUCCESS', 3)])).toMatchObject({ ok: false, keysPerDay: 0, keysObserved: 1 });
  });

  it('forecast subtracts keys in hand and converts to days', () => {
    const hist = Array.from({ length: 11 }, (_, i) => ev('ROLL_SUCCESS', i)); // 1 key/day
    const v = keyVelocity(hist);
    const f = forecastTarget(10, 3, v); // R=10 (p50=5), hold 3 keys
    expect(f.keysToEarn.p50).toBe(2); // 5 - 3
    expect(f.days!.p50).toBeCloseTo(2, 5);
  });

  it('returns null days when pace is unknown', () => {
    const f = forecastTarget(8, 0, { ok: false, keysPerDay: 0, spanDays: 0, keysObserved: 0 });
    expect(f.days).toBeNull();
    expect(f.keysToEarn.p50).toBe(keysToTarget(8).p50);
  });
});
