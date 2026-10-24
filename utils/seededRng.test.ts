import { describe, it, expect } from 'vitest';
import { drawFloat, drawDice, weeklySeed, randomSeed, normalizeSeed, legacyRunSalt, runDrawFloat, runDrawSource, seededContext } from './seededRng';
import type { LogEntry } from '../types';

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

describe('drawDice', () => {
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

// An old seeded save's history, as saved before runs had salts.
const OLD_SEEDED_HISTORY = [
  { id: 'e1', timestamp: 1752000000000, type: 'ROLL_FAIL', message: 'Rolled for a Key', hash: '9f1c2a7b', prevHash: 'GENESIS' },
  { id: 'e2', timestamp: 1752000060000, type: 'UNLOCK', message: 'Unlocked Attack', meta: { item: 'Attack', category: 'Skills', cost: 1 }, hash: '4d0e8c11', prevHash: '9f1c2a7b' },
] as unknown as LogEntry[];

describe('a run draws from its seed, or else its hidden salt (critique GP-4)', () => {
  // Numbers taken from main before salts existed: a seeded run's stream must not move.
  it.each([
    [undefined, 'roll', 0, 0.764468627050519],
    [undefined, 'roll', 1, 0.12908822251483798],
    [undefined, 'gacha', 0, 0.7847057357430458],
    [undefined, 'levelup', 1, 0.5418581953272223],
    [2, 'roll', 0, 0.8309968309476972],
    [2, 'gacha', 1, 0.6621690322645009],
    [2, 'levelup', 0, 0.0009004829917103052],
  ] as const)('replays an old seeded save (rngVersion %s) bit for bit: %s #%i', (rngVersion, purpose, index, expected) => {
    const state = { history: OLD_SEEDED_HISTORY, rngVersion, rngSeed: 'FATE-2026-W30' };
    expect(runDrawFloat(state, purpose, index)).toBe(expected);
    // A salt never touches a seeded run.
    expect(runDrawFloat({ ...state, rngSalt: 'any-salt' }, purpose, index)).toBe(expected);
  });

  it('draws an unseeded run from its salt over the semantic chain, so ids and times do not matter', () => {
    const restored = { history: OLD_SEEDED_HISTORY, rngSalt: 'run-salt' };
    const sameActionsLater = {
      history: OLD_SEEDED_HISTORY.map((entry, i) => ({ ...entry, id: `other-${i}`, timestamp: entry.timestamp + 86_400_000, hash: `h${i}` })),
      rngSalt: 'run-salt',
    };
    expect(runDrawFloat(restored, 'gacha')).toBe(runDrawFloat(sameActionsLater, 'gacha'));
    expect(runDrawSource(restored)).toEqual({
      seed: 'salt:run-salt',
      context: seededContext({ history: OLD_SEEDED_HISTORY, rngVersion: 2 }),
    });
    expect(runDrawFloat({ ...restored, rngSalt: 'another-run' }, 'gacha')).not.toBe(runDrawFloat(restored, 'gacha'));
    // A different action before the draw is a different context.
    expect(runDrawFloat({ ...restored, history: OLD_SEEDED_HISTORY.slice(0, 1) }, 'gacha')).not.toBe(runDrawFloat(restored, 'gacha'));
  });

  it('keeps salted and seeded streams apart, and leaves a state with neither to the caller', () => {
    // Seeds are upper-cased; the salt stream's prefix is lower case.
    expect(runDrawSource({ history: [], rngSalt: 'x' })?.seed).toBe('salt:x');
    expect(normalizeSeed('salt:x')).not.toBe('salt:x');
    expect(runDrawFloat({ history: [] }, 'roll')).toBeNull();
  });

  it('gives a run saved before salts the same fixed-length salt from its first entry, every time', () => {
    const salt = legacyRunSalt(OLD_SEEDED_HISTORY);
    expect(salt).toMatch(/^legacy-[0-9a-f]{32}$/);
    expect(legacyRunSalt(OLD_SEEDED_HISTORY.map(entry => ({ ...entry })))).toBe(salt);
    expect(legacyRunSalt([{ ...OLD_SEEDED_HISTORY[0], id: 'x'.repeat(512) }])).toMatch(/^legacy-[0-9a-f]{32}$/);
    expect(legacyRunSalt([{ ...OLD_SEEDED_HISTORY[0], id: 'other' }])).not.toBe(salt);
    expect(legacyRunSalt([])).toBeNull();
  });
});
