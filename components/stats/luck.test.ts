import { describe, expect, it } from 'vitest';
import { buildFateAnalytics, defaultFateAnalyticsQuery, type AnalyticsSummary } from '../../utils/fateAnalytics';
import type { LogEntry } from '../../types';
import { luckPercentile, luckSentence, normalCdf, percentileSentence, selectionDateRange, shareableSummary, verdictTone } from './luck';

const summary = (overrides: Partial<AnalyticsSummary>): AnalyticsSummary => ({
  attempts: 320, genuineWins: 80, scoreableAttempts: 320, scoreableWins: 80, expectedWins: 72.15,
  variance: 45.9, delta: 7.86, zScore: 1.16, verdict: 'Running hot', pityInterventions: 0,
  omniKeysAwarded: 3, confirmedStandardKeys: 80, rewardEvents: 80, actualRate: 0.25,
  expectedRate: 0.2255, currentDrought: 0, longestDrought: 16, longestHotStreak: 5,
  ...overrides,
});

describe('luck wording', () => {
  it('matches the standard normal distribution', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-1.96)).toBeCloseTo(0.024998, 5);
    expect(normalCdf(3)).toBeCloseTo(0.99865, 5);
  });

  it('never claims certainty in a percentile', () => {
    expect(luckPercentile(1.16)).toBe(88);
    expect(luckPercentile(9)).toBe(99);
    expect(luckPercentile(-9)).toBe(1);
    expect(percentileSentence(1.16)).toBe('Luckier than about 88% of runs with the same odds.');
    expect(percentileSentence(-1.16)).toBe('Unluckier than about 88% of runs with the same odds.');
  });

  it('says how far ahead or behind the odds a run is, from the scoreable rolls only', () => {
    expect(luckSentence(summary({}))).toBe('You won 80 of your 320 rolls. Fate expected about 72.2, so you are 7.9 wins ahead.');
    expect(luckSentence(summary({ scoreableAttempts: 300, scoreableWins: 70, expectedWins: 72, delta: -2 })))
      .toBe('You won 70 of 300 rolls with known odds. Fate expected about 72.0, so you are 2.0 wins behind.');
    expect(luckSentence(summary({ scoreableWins: 72, expectedWins: 72.02, delta: -0.02 })))
      .toBe('You won 72 of your 320 rolls. Fate expected about 72.0, so you are right on expectation.');
    expect(luckSentence(summary({ scoreableAttempts: 0, scoreableWins: 0, expectedWins: 0, delta: 0 })))
      .toBe("None of your 320 rolls have known odds, so Fate can't judge them yet.");
  });

  it('has a tone for every verdict and for no verdict', () => {
    for (const verdict of ['Building sample', 'Blessed by Fate', 'Running hot', 'Fate is fair', 'Running cold', 'Forsaken by Fate', null] as const) {
      expect(verdictTone(verdict).title.length).toBeGreaterThan(0);
    }
    expect(verdictTone(null).title).toBe('No verdict yet');
  });

  it('builds the date range and the shareable summary from the selection', () => {
    const day = (date: string, id: string, success: boolean): LogEntry => ({
      id, timestamp: new Date(`${date}T12:00:00`).getTime(), type: success ? 'ROLL_SUCCESS' : 'ROLL_FAIL',
      result: success ? 'SUCCESS' : 'FAIL', source: 'Quest (Novice)', threshold: 25, rollValue: success ? 10 : 90,
      message: 'fixture', meta: { successProbability: 0.25, standardKeysAwarded: success ? 1 : 0, rewardKind: success ? 'normal' : 'none', drawResolution: 1000, luckApplied: false },
    });
    const analytics = buildFateAnalytics([day('2026-05-29', 'a', true), day('2026-08-27', 'b', false)], defaultFateAnalyticsQuery(new Date('2026-08-28T12:00:00').getTime()));

    expect(selectionDateRange(analytics)).toBe('29 May – 27 Aug 2026');
    const shared = shareableSummary(analytics);
    expect(shared).toContain('Fate Locked luck report: Building a sample');
    expect(shared).toContain('1 win from 2 rolls, 0.5 expected (+0.5).');
    expect(shared).not.toContain('Luckier than');
  });
});
