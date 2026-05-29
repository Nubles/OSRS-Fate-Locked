import { describe, it, expect } from 'vitest';
import {
  RIVAL_PERSONAS, makeSimRival, makeFriendRival, simulatedRivalKeys,
  rivalCompletion, rivalDaysTo, rivalHeadlines, standing,
} from './rival';
import { RivalState } from '../types';

const DAY = 86_400_000;
const sim = (over: Partial<RivalState> = {}): RivalState => ({
  mode: 'sim', personaId: 'steady', name: 'Sam', emoji: '🧭',
  keysPerDay: 10, seed: 42, startedAt: 0, ...over,
});

describe('rival ghost', () => {
  it('personas all have a positive tempo', () => {
    expect(RIVAL_PERSONAS.length).toBeGreaterThan(0);
    expect(RIVAL_PERSONAS.every((p) => p.keysPerDay > 0)).toBe(true);
  });

  it('simulated keys start at 0 and grow monotonically with time', () => {
    const r = sim();
    expect(simulatedRivalKeys(r, 0)).toBe(0);
    const a = simulatedRivalKeys(r, 5 * DAY);
    const b = simulatedRivalKeys(r, 10 * DAY);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    // ~10 keys/day over 10 days ≈ 100 keys (±20% jitter band)
    expect(b).toBeGreaterThan(80);
    expect(b).toBeLessThan(120);
  });

  it('completion is 0 at start and clamped to 100', () => {
    const r = sim({ keysPerDay: 100000 });
    expect(rivalCompletion(r, 0)).toBe(0);
    expect(rivalCompletion(r, 9999 * DAY)).toBe(100);
  });

  it('is deterministic given the same seed/time', () => {
    expect(simulatedRivalKeys(sim(), 7 * DAY)).toBe(simulatedRivalKeys(sim(), 7 * DAY));
    expect(simulatedRivalKeys(sim({ seed: 7 }), 7 * DAY)).not.toBe(simulatedRivalKeys(sim({ seed: 8 }), 7 * DAY));
  });

  it('friend rivals are a static snapshot', () => {
    const f = makeFriendRival('Bob', 37.6);
    expect(f.mode).toBe('friend');
    expect(rivalCompletion(f, 0)).toBe(38);
    expect(rivalCompletion(f, 9999 * DAY)).toBe(38); // never advances
    expect(rivalDaysTo(f, 0, 100)).toBeNull();
  });

  it('headlines grow with completion and are seeded', () => {
    const r = sim();
    expect(rivalHeadlines(r, 0).length).toBe(0);
    const few = rivalHeadlines(r, 10).length;
    const more = rivalHeadlines(r, 50).length;
    expect(more).toBeGreaterThan(few);
    // same seed → same first headline
    expect(rivalHeadlines(sim({ seed: 99 }), 100)[0]).toEqual(rivalHeadlines(sim({ seed: 99 }), 100)[0]);
  });

  it('standing reports the leader and lead', () => {
    expect(standing(50, 40)).toMatchObject({ lead: 10, leader: 'you' });
    expect(standing(30, 45)).toMatchObject({ lead: -15, leader: 'rival' });
    expect(standing(20, 20).leader).toBe('tie');
  });

  it('makeSimRival uses the persona tempo (or a custom override)', () => {
    expect(makeSimRival('sweat').keysPerDay).toBe(RIVAL_PERSONAS.find((p) => p.id === 'sweat')!.keysPerDay);
    expect(makeSimRival('casual', 99).keysPerDay).toBe(99);
  });
});
