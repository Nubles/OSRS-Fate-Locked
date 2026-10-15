import { describe, expect, it } from 'vitest';
import {
  caTaskLockedBoss,
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

  it('keeps stored historical tiers while adding newly qualified tiers', () => {
    expect(earnedCATiers(169, ['Master'])).toEqual([
      'Easy', 'Medium', 'Master',
    ]);
    expect(newlyEarnedCATiers(169, ['Easy'])).toEqual(['Medium']);
  });

  it('qualifies manual tier completion from cumulative points only', () => {
    expect(caTierCompletionDecision('Medium', 160, [])).toEqual({
      ok: false,
      reason: 'Requires 169 Combat Achievement points',
    });
    expect(caTierCompletionDecision('Medium', 169, [])).toEqual({ ok: true });
    expect(caTierCompletionDecision('Medium', 169, ['Medium'])).toEqual({
      ok: false,
      reason: 'Already completed',
    });
  });
});

describe('Combat Achievement boss hint', () => {
  it('names the boss a task is fought at until the run unlocks it, for every boss name the list uses', () => {
    // Owner decision B6 (2 October 2026): a hint only; tasks stay free to log.
    for (const [monster, boss] of [
      ['Leviathan', 'The Leviathan'], ['Whisperer', 'The Whisperer'], ['Royal Titans', 'The Royal Titans'],
      ['Barrows', 'Barrows Brothers'], ['Theatre of Blood: Hard Mode', 'Theatre of Blood'],
      ['Tombs of Amascut: Expert Mode', 'Tombs of Amascut'], ['Chambers of Xeric: Challenge Mode', 'Chambers of Xeric'],
      ['Crystalline Hunllef', 'The Gauntlet'], ['Zulrah', 'Zulrah'],
    ]) {
      expect(caTaskLockedBoss({ monster }, []), monster).toBe(boss);
      expect(caTaskLockedBoss({ monster }, [boss]), monster).toBeUndefined();
    }
    expect(caTaskLockedBoss({ monster: 'Kurask' }, [])).toBeUndefined();
  });
});
