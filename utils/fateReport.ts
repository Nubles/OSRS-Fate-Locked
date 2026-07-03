/**
 * Fate Report — "how lucky has this run actually been?"
 *
 * Every roll in the history carries its success threshold, so the run's
 * expected number of successes is just Σ(threshold/100) and the observed
 * deviation can be scored properly (binomial z-score via Σ p(1-p)) instead
 * of a naive win-rate comparison. Pure function — safe inside useMemo.
 */

import { LogEntry } from '../types';
import { isRollEntry } from './logEntry';

export interface CategoryLuck {
  category: string;
  rolls: number;
  expected: number;
  actual: number;
  /** actual − expected (keys gained above/below expectation). */
  delta: number;
}

export interface NotableRoll {
  source: string;
  threshold: number;
  timestamp: number;
}

export interface FateReport {
  rolls: number;
  expected: number;
  actual: number;
  delta: number;
  /** Standard deviations from expectation; + is lucky. */
  zScore: number;
  verdict: string;
  /** Success against the longest odds. */
  luckiest: NotableRoll | null;
  /** Failure against the shortest odds. */
  cruelest: NotableRoll | null;
  longestDrought: number;
  longestHotStreak: number;
  categories: CategoryLuck[];
}

/** "Quest (Novice)" → "Quest"; "Col. Log: Vorki" → "Collection Log"; else as-is. */
export const rollCategory = (source: string): string => {
  if (source.toLowerCase().startsWith('col. log:')) return 'Collection Log';
  const paren = source.indexOf(' (');
  return paren > 0 ? source.slice(0, paren) : source;
};

const verdictFor = (z: number): string => {
  if (z >= 2) return 'Blessed by Fate';
  if (z >= 1) return 'Running hot';
  if (z > -1) return 'Fate is fair';
  if (z > -2) return 'Running cold';
  return 'Forsaken by Fate';
};

/** Null when the history has no scoreable rolls (threshold missing/zero). */
export function buildFateReport(history: LogEntry[]): FateReport | null {
  const rolls = history
    .filter((h) => isRollEntry(h) && typeof h.threshold === 'number' && h.threshold > 0 && h.source)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (rolls.length === 0) return null;

  let expected = 0;
  let variance = 0;
  let actual = 0;
  let luckiest: NotableRoll | null = null;
  let cruelest: NotableRoll | null = null;
  let drought = 0, longestDrought = 0;
  let streak = 0, longestHotStreak = 0;
  const byCategory = new Map<string, CategoryLuck>();

  for (const r of rolls) {
    const p = Math.min(r.threshold!, 100) / 100;
    const won = r.result === 'SUCCESS';
    expected += p;
    variance += p * (1 - p);
    if (won) actual++;

    if (won) {
      streak++; longestHotStreak = Math.max(longestHotStreak, streak);
      drought = 0;
      if (!luckiest || r.threshold! < luckiest.threshold) {
        luckiest = { source: r.source!, threshold: r.threshold!, timestamp: r.timestamp };
      }
    } else {
      drought++; longestDrought = Math.max(longestDrought, drought);
      streak = 0;
      if (!cruelest || r.threshold! > cruelest.threshold) {
        cruelest = { source: r.source!, threshold: r.threshold!, timestamp: r.timestamp };
      }
    }

    const cat = rollCategory(r.source!);
    const entry = byCategory.get(cat) ?? { category: cat, rolls: 0, expected: 0, actual: 0, delta: 0 };
    entry.rolls++;
    entry.expected += p;
    if (won) entry.actual++;
    byCategory.set(cat, entry);
  }

  const delta = actual - expected;
  // With one near-certain roll variance can be ~0 — clamp so z stays finite.
  const zScore = delta / Math.max(Math.sqrt(variance), 0.5);

  const categories = [...byCategory.values()]
    .map((c) => ({ ...c, delta: c.actual - c.expected }))
    .sort((a, b) => b.rolls - a.rolls);

  return {
    rolls: rolls.length,
    expected,
    actual,
    delta,
    zScore,
    verdict: verdictFor(zScore),
    luckiest,
    cruelest,
    longestDrought,
    longestHotStreak,
    categories,
  };
}
