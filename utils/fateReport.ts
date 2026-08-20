/**
 * Fate Report — compatibility view over the shared Fate Analytics result.
 *
 * The analytics engine owns normalization and all derived figures. This module
 * only translates that immutable result into the legacy report shape used by
 * the existing Fate Report UI.
 */

import type { LogEntry } from '../types';
import {
  buildFateAnalytics,
  defaultFateAnalyticsQuery,
  type AnalyticsAggregate,
  type AnalyticsNotableRoll,
  type FateAnalyticsQuery,
  type FateAnalyticsResult,
} from './fateAnalytics';

export interface CategoryLuck {
  category: string;
  totalAttempts: number;
  genuineWins: number;
  /** Scoreable attempt cohort used for expected wins and delta. */
  rolls: number;
  expected: number;
  /** Genuine wins within the scoreable cohort. */
  actual: number;
  /** actual − expected (keys gained above/below expectation). */
  delta: number;
  probabilityCoverage: number;
  sampleLabel: AnalyticsAggregate['sampleLabel'];
}

export interface NotableRoll {
  source: string;
  threshold: number;
  timestamp: number;
}

export interface FateReport {
  totalAttempts: number;
  genuineWins: number;
  /** Scoreable attempt cohort used for expected wins and delta. */
  rolls: number;
  expected: number;
  /** Genuine wins within the scoreable cohort. */
  actual: number;
  delta: number;
  /** Standard deviations from expectation; + is lucky. */
  zScore: number | null;
  verdict: string | null;
  /** Success against the longest odds. */
  luckiest: NotableRoll | null;
  /** Failure against the shortest odds. */
  cruelest: NotableRoll | null;
  longestDrought: number;
  longestHotStreak: number;
  categories: CategoryLuck[];
}

const toReportRoll = (roll: AnalyticsNotableRoll | null): NotableRoll | null => roll === null
  ? null
  : { source: roll.source, threshold: roll.probability * 100, timestamp: roll.timestamp };

const toCategoryLuck = (category: AnalyticsAggregate): CategoryLuck => ({
  category: category.label,
  totalAttempts: category.attempts,
  genuineWins: category.genuineWins,
  rolls: category.scoreableAttempts,
  expected: category.expectedWins,
  actual: category.scoreableWins,
  delta: category.delta,
  probabilityCoverage: category.probabilityCoverage,
  sampleLabel: category.sampleLabel,
});

export function fateReportFromAnalytics(analytics: FateAnalyticsResult): FateReport | null {
  if (analytics.summary.attempts === 0) return null;
  return {
    totalAttempts: analytics.summary.attempts,
    genuineWins: analytics.summary.genuineWins,
    rolls: analytics.summary.scoreableAttempts,
    expected: analytics.summary.expectedWins,
    actual: analytics.summary.scoreableWins,
    delta: analytics.summary.delta,
    zScore: analytics.summary.zScore,
    verdict: analytics.summary.verdict,
    luckiest: toReportRoll(analytics.notables.luckiestSuccess),
    cruelest: toReportRoll(analytics.notables.cruelestMiss),
    longestDrought: analytics.summary.longestDrought,
    longestHotStreak: analytics.summary.longestHotStreak,
    categories: analytics.categories.map(toCategoryLuck),
  };
}

export function buildFateReport(
  history: LogEntry[],
  query: FateAnalyticsQuery = defaultFateAnalyticsQuery(Date.now()),
): FateReport | null {
  return fateReportFromAnalytics(buildFateAnalytics(history, query));
}

export { rollCategory } from './fateAnalytics';
