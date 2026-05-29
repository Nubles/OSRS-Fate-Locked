/**
 * Fate Forecast — projects how long Fate will likely take to hand you a
 * specific unlock.
 *
 * The gacha unlocks a uniformly-random *locked* item from a chosen table
 * (GachaSection: validPool[floor(rand*len)]). So if a table has R locked items
 * and you keep spending keys on it, the target appears at a uniformly random
 * position in 1..R — i.e. the number of spends needed is a discrete uniform on
 * {1..R}. That gives an exact, assumption-light distribution (no Monte-Carlo
 * needed for a single target). We then convert keys → time using the player's
 * observed key-earning pace from history.
 *
 * Pure + side-effect free.
 */

import { LogEntry } from '../types';

const MS_PER_DAY = 86_400_000;

/** Distribution of additional key-spends on a table to reveal one target. */
export interface KeysForecast {
  /** Locked items in the table (R). */
  remaining: number;
  expected: number; // mean spends = (R+1)/2
  p10: number;
  p50: number;
  p90: number;
}

/** Discrete uniform on {1..R}: P(N<=k)=k/R, so the p-quantile is ceil(p*R). */
export const keysToTarget = (remaining: number): KeysForecast => {
  const R = Math.max(1, Math.floor(remaining));
  const q = (p: number) => Math.min(R, Math.max(1, Math.ceil(p * R)));
  return { remaining: R, expected: (R + 1) / 2, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
};

export interface Velocity {
  /** True when there's enough history to estimate a pace. */
  ok: boolean;
  keysPerDay: number;
  /** Calendar days the sample spans. */
  spanDays: number;
  /** Key-granting events observed. */
  keysObserved: number;
}

const KEY_EVENT_TYPES = new Set(['ROLL_SUCCESS', 'ROLL_OMNI', 'PITY']);

/**
 * Estimate keys earned per calendar day from history. Each key-granting roll
 * counts as ~1 key (greed-doubling is rare enough to ignore for a forecast).
 */
export const keyVelocity = (history: LogEntry[]): Velocity => {
  const events = history.filter((e) => KEY_EVENT_TYPES.has(e.type));
  if (events.length < 2) return { ok: false, keysPerDay: 0, spanDays: 0, keysObserved: events.length };
  const ts = events.map((e) => e.timestamp).filter((t): t is number => typeof t === 'number');
  if (ts.length < 2) return { ok: false, keysPerDay: 0, spanDays: 0, keysObserved: events.length };
  const spanDays = (Math.max(...ts) - Math.min(...ts)) / MS_PER_DAY;
  if (spanDays < 1 / 24) return { ok: false, keysPerDay: 0, spanDays, keysObserved: events.length }; // < 1h
  return { ok: true, keysPerDay: events.length / spanDays, spanDays, keysObserved: events.length };
};

export interface TimeForecast {
  keys: KeysForecast;
  /** Keys you still need to EARN (after spending what you hold now). */
  keysToEarn: { p10: number; p50: number; p90: number };
  /** Days to reach the target at the observed pace; null when pace is unknown. */
  days: { p10: number; p50: number; p90: number } | null;
}

/**
 * Compose the keys distribution with current keys-in-hand and earning pace.
 * `keysAvailable` is spent first, so it reduces what must still be earned.
 */
export const forecastTarget = (
  remaining: number,
  keysAvailable: number,
  velocity: Velocity,
): TimeForecast => {
  const keys = keysToTarget(remaining);
  const sub = (n: number) => Math.max(0, n - Math.max(0, keysAvailable));
  const keysToEarn = { p10: sub(keys.p10), p50: sub(keys.p50), p90: sub(keys.p90) };
  const days = velocity.ok && velocity.keysPerDay > 0
    ? {
        p10: keysToEarn.p10 / velocity.keysPerDay,
        p50: keysToEarn.p50 / velocity.keysPerDay,
        p90: keysToEarn.p90 / velocity.keysPerDay,
      }
    : null;
  return { keys, keysToEarn, days };
};
