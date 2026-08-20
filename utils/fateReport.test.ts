import { describe, it, expect } from 'vitest';
import { buildFateAnalytics, defaultFateAnalyticsQuery } from './fateAnalytics';
import { buildFateReport, fateReportFromAnalytics, rollCategory } from './fateReport';
import { LogEntry } from '../types';

let id = 0;
const roll = (
  source: string,
  threshold: number,
  won: boolean,
  ts = ++id,
): LogEntry => ({
  id: String(id),
  timestamp: ts,
  type: won ? 'ROLL_SUCCESS' : 'ROLL_FAIL',
  source,
  result: won ? 'SUCCESS' : 'FAIL',
  threshold,
  message: '',
});

describe('rollCategory', () => {
  it('strips the tier parenthetical and groups collection log rolls', () => {
    expect(rollCategory('Quest (Novice)')).toBe('Quest');
    expect(rollCategory('Combat Achievement (Master)')).toBe('Combat Achievement');
    expect(rollCategory('Col. Log: Vorki')).toBe('Collection Log');
    expect(rollCategory('Turael')).toBe('Turael');
  });
});

describe('buildFateReport', () => {
  it('returns null with no roll attempts', () => {
    expect(buildFateReport([])).toBeNull();
    expect(buildFateReport([{ id: '1', timestamp: 1, type: 'UNLOCK', message: '' } as LogEntry])).toBeNull();
  });

  it('computes expected successes and delta from thresholds', () => {
    // Four 50% rolls, all won: expected 2, actual 4, delta +2.
    const report = buildFateReport([
      roll('Boss (Mid)', 50, true), roll('Boss (Mid)', 50, true),
      roll('Boss (Mid)', 50, true), roll('Boss (Mid)', 50, true),
    ])!;
    expect(report.totalAttempts).toBe(4);
    expect(report.genuineWins).toBe(4);
    expect(report.rolls).toBe(4);
    expect(report.expected).toBeCloseTo(2);
    expect(report.actual).toBe(4);
    expect(report.delta).toBeCloseTo(2);
    // variance = 4 × 0.25 = 1 → z = 2, but the sample is still limited.
    expect(report.zScore).toBeCloseTo(2);
    expect(report.verdict).toBe('Building sample');
  });

  it('tracks streaks, droughts, and the notable rolls', () => {
    const report = buildFateReport([
      roll('Slayer (Beginner)', 5, true),   // luckiest: 5% success
      roll('Quest (Novice)', 80, false),    // cruelest so far
      roll('Quest (Master)', 90, false),    // cruelest: 90% fail
      roll('Boss (Mid)', 50, false),
      roll('Boss (Mid)', 50, true),
      roll('Boss (Mid)', 50, true),
    ])!;
    expect(report.luckiest).toMatchObject({ source: 'Slayer (Beginner)', threshold: 5 });
    expect(report.cruelest).toMatchObject({ source: 'Quest (Master)', threshold: 90 });
    expect(report.longestDrought).toBe(3);
    expect(report.longestHotStreak).toBe(2);
  });

  it('breaks luck down per category, ordered by roll count', () => {
    const report = buildFateReport([
      roll('Quest (Novice)', 50, true),
      roll('Quest (Master)', 50, true),
      roll('Quest (Novice)', 50, false),
      roll('Col. Log: Vorki', 10, true),
    ])!;
    expect(report.categories[0]).toMatchObject({
      category: 'Quest',
      totalAttempts: 3,
      genuineWins: 2,
      rolls: 3,
      actual: 2,
      probabilityCoverage: 1,
      sampleLabel: 'Limited sample',
    });
    expect(report.categories[0].expected).toBeCloseTo(1.5);
    expect(report.categories[0].delta).toBeCloseTo(0.5);
    expect(report.categories[1]).toMatchObject({ category: 'Collection Log', rolls: 1, actual: 1 });
    expect(report.categories[1].delta).toBeCloseTo(0.9);
  });

  it('returns null z-score and verdict when scoreable variance is zero', () => {
    const report = buildFateReport([roll('Quest (Novice)', 100, true)])!;
    expect(report.zScore).toBeNull();
    expect(report.verdict).toBeNull();
  });

  it('treats pity success text as a failed RNG attempt in the report', () => {
    const pity = {
      ...roll('Quest (Novice)', 20, true),
      type: 'PITY' as const,
      result: 'SUCCESS' as const,
      rollValue: 80,
    };

    const report = buildFateReport([pity])!;

    expect(report).toMatchObject({ actual: 0, longestDrought: 1, luckiest: null });
  });

  it('counts an unscoreable genuine win only in the authoritative cohort', () => {
    const unscoreable = {
      ...roll('Quest (Novice)', 20, true),
      threshold: undefined,
      meta: { successProbability: Number.NaN },
    };

    const report = buildFateReport([unscoreable])!;

    expect(report).toMatchObject({
      totalAttempts: 1,
      genuineWins: 1,
      rolls: 0,
      expected: 0,
      actual: 0,
      delta: 0,
      zScore: null,
      verdict: null,
    });
    expect(report.categories[0]).toMatchObject({
      category: 'Quest', totalAttempts: 1, genuineWins: 1, rolls: 0, actual: 0, probabilityCoverage: 0,
    });
  });

  it('adapts an existing analytics result with exact summary parity', () => {
    const history = [
      roll('Quest (Novice)', 25, false),
      {
        ...roll('Boss (Mid)', 20, true),
        meta: {
          successProbability: 0.36,
          luckApplied: true,
          drawResolution: 1000,
          standardKeysAwarded: 2,
          rewardKind: 'greed',
        },
      },
    ];
    const query = defaultFateAnalyticsQuery(10);
    const analytics = buildFateAnalytics(history, query);
    const adapted = fateReportFromAnalytics(analytics)!;

    expect(adapted).toEqual(buildFateReport(history, query));
    expect(adapted).toMatchObject({
      totalAttempts: analytics.summary.attempts,
      genuineWins: analytics.summary.genuineWins,
      rolls: analytics.summary.scoreableAttempts,
      expected: analytics.summary.expectedWins,
      actual: analytics.summary.scoreableWins,
      delta: analytics.summary.delta,
      zScore: analytics.summary.zScore,
      verdict: analytics.summary.verdict,
    });
  });
});
