import { describe, expect, it } from 'vitest';
import { CA_DATA } from '../data/caData';
import {
  CA_TASK_POINTS,
  CA_TIER_ORDER,
  caTierCompletionDecision,
  completedCAPoints,
  earnedCATiers,
  newlyEarnedCATiers,
} from './caProgress';

describe('Combat Achievement point progress', () => {
  it('adds points across mixed tiers', () => {
    const tasks = [
      { id: 'e', tierId: 'Easy' },
      { id: 'm', tierId: 'Medium' },
      { id: 'g', tierId: 'Grandmaster' },
    ];
    expect(completedCAPoints(['e', 'm', 'g'], tasks)).toBe(9);
  });

  it('does not double-count duplicate or unknown completion ids', () => {
    const tasks = [
      { id: 'e', tierId: 'Easy' },
      { id: 'm', tierId: 'Medium' },
    ];
    expect(completedCAPoints(['e', 'e', 'unknown'], tasks)).toBe(1);
  });

  it('uses the official tier order, point values, and cumulative thresholds', () => {
    expect(CA_TIER_ORDER).toEqual([
      'Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster',
    ]);
    expect(CA_TASK_POINTS).toEqual({
      Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6,
    });
    expect(CA_TIER_ORDER.map(tier => CA_DATA[tier].pointsRequired)).toEqual([
      41, 161, 419, 1075, 1940, 2672,
    ]);
  });

  it('keeps stored historical tiers while adding newly qualified tiers', () => {
    expect(earnedCATiers(161, ['Master'])).toEqual([
      'Easy', 'Medium', 'Master',
    ]);
    expect(newlyEarnedCATiers(161, ['Easy'])).toEqual(['Medium']);
  });

  it('qualifies manual tier completion from cumulative points only', () => {
    expect(caTierCompletionDecision('Medium', 160, [])).toEqual({
      ok: false,
      reason: 'Requires 161 Combat Achievement points',
    });
    expect(caTierCompletionDecision('Medium', 161, [])).toEqual({ ok: true });
    expect(caTierCompletionDecision('Medium', 161, ['Medium'])).toEqual({
      ok: false,
      reason: 'Already completed',
    });
  });
});
