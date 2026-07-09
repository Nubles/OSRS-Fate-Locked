import { describe, it, expect } from 'vitest';
import { drawFloat, drawDice, drawPick, weeklySeed, randomSeed, normalizeSeed } from './seededRng';

describe('drawFloat determinism', () => {
  it('same inputs → same output', () => {
    expect(drawFloat('FATE-2026-W28', 'abc123', 'roll', 0))
      .toBe(drawFloat('FATE-2026-W28', 'abc123', 'roll', 0));
  });

  it('any input change → different output', () => {
    const base = drawFloat('S', 'ctx', 'roll', 0);
    expect(drawFloat('S2', 'ctx', 'roll', 0)).not.toBe(base);
    expect(drawFloat('S', 'ctx2', 'roll', 0)).not.toBe(base);
    expect(drawFloat('S', 'ctx', 'gacha', 0)).not.toBe(base);
    expect(drawFloat('S', 'ctx', 'roll', 1)).not.toBe(base);
  });

  it('stays in [0,1) and looks uniform-ish', () => {
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const v = drawFloat('seed', `ctx${i}`, 'p');
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeGreaterThan(0.45);
    expect(sum / n).toBeLessThan(0.55);
  });
});

describe('drawDice / drawPick', () => {
  it('dice covers [1,max] and is deterministic', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = drawDice('s', `c${i}`, 'roll', 0, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
    expect(drawDice('s', 'c', 'roll')).toBe(drawDice('s', 'c', 'roll'));
  });

  it('pick returns a pool member (undefined on empty)', () => {
    const pool = ['a', 'b', 'c'];
    expect(pool).toContain(drawPick(pool, 's', 'c', 'gacha'));
    expect(drawPick([], 's', 'c', 'gacha')).toBeUndefined();
  });
});

describe('seed helpers', () => {
  it('weeklySeed formats as FATE-YYYY-WNN and is stable within a week', () => {
    expect(weeklySeed(new Date('2026-07-09'))).toMatch(/^FATE-2026-W\d{2}$/);
    expect(weeklySeed(new Date('2026-07-06'))).toBe(weeklySeed(new Date('2026-07-12'))); // Mon–Sun same ISO week
    expect(weeklySeed(new Date('2026-07-05'))).not.toBe(weeklySeed(new Date('2026-07-06')));
  });

  it('weeklySeed handles ISO year boundaries', () => {
    expect(weeklySeed(new Date('2027-01-01'))).toBe('FATE-2026-W53'); // Jan 1 2027 is a Friday of ISO week 53/2026
  });

  it('randomSeed shape and normalizeSeed canonicalization', () => {
    expect(randomSeed()).toMatch(/^FATE-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(normalizeSeed('  hello world  ')).toBe('HELLO WORLD');
    expect(normalizeSeed('x'.repeat(100)).length).toBe(64);
  });
});
