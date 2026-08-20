import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import {
  buildFateAnalytics,
  defaultFateAnalyticsQuery,
  rollCategory,
} from './fateAnalytics';

let fixtureId = 0;
const entry = (over: Partial<LogEntry>): LogEntry => ({
  id: String(over.id ?? ++fixtureId),
  timestamp: over.timestamp ?? 1,
  type: over.type ?? 'ROLL_FAIL',
  message: over.message ?? '',
  result: over.result ?? 'FAIL',
  source: over.source ?? 'Quest (Novice)',
  rollValue: over.rollValue ?? 80,
  threshold: over.threshold ?? 20,
  meta: over.meta,
});

const allQuery = (now = 1) => defaultFateAnalyticsQuery(now);

const exactRoll = (
  id: string,
  timestamp: number,
  type: Extract<LogEntry['type'], 'ROLL_SUCCESS' | 'ROLL_FAIL' | 'ROLL_OMNI' | 'PITY'>,
  successProbability: number,
  meta: Partial<NonNullable<LogEntry['meta']>> = {},
): LogEntry => entry({
  id,
  timestamp,
  type,
  result: type === 'ROLL_FAIL' ? 'FAIL' : 'SUCCESS',
  rollValue: type === 'ROLL_FAIL' || type === 'PITY' ? 80 : 10,
  threshold: 20,
  meta: {
    successProbability,
    luckApplied: false,
    drawResolution: 1000,
    standardKeysAwarded: 0,
    rewardKind: 'none',
    ...meta,
  },
});

const legacyRoll = (
  id: string,
  timestamp: number,
  type: Extract<LogEntry['type'], 'ROLL_SUCCESS' | 'ROLL_FAIL'>,
  threshold: number,
): LogEntry => entry({
  id,
  timestamp,
  type,
  result: type === 'ROLL_SUCCESS' ? 'SUCCESS' : 'FAIL',
  rollValue: type === 'ROLL_SUCCESS' ? Math.min(10, threshold) : Math.max(80, threshold + 1),
  threshold,
});

describe('buildFateAnalytics', () => {
  it('treats pity as a failed RNG attempt and separate intervention', () => {
    const result = buildFateAnalytics([
      entry({ type: 'PITY', result: 'SUCCESS', rollValue: 80, threshold: 20 }),
    ], defaultFateAnalyticsQuery(1));

    expect(result.summary).toMatchObject({
      attempts: 1,
      genuineWins: 0,
      pityInterventions: 1,
      currentDrought: 1,
      longestDrought: 1,
      longestHotStreak: 0,
    });
    expect(result.outcomeComposition).toContainEqual({ outcome: 'pity', count: 1 });
  });

  it('uses exact Luck probability without counting Greed twice', () => {
    const result = buildFateAnalytics([
      entry({
        type: 'ROLL_SUCCESS',
        result: 'SUCCESS',
        rollValue: 10,
        threshold: 20,
        meta: {
          successProbability: 0.36,
          luckApplied: true,
          drawResolution: 1000,
          standardKeysAwarded: 2,
          rewardKind: 'greed',
        },
      }),
    ], defaultFateAnalyticsQuery(1));

    expect(result.summary.genuineWins).toBe(1);
    expect(result.summary.expectedWins).toBeCloseTo(0.36);
    expect(result.summary.confirmedStandardKeys).toBe(2);
  });

  it('treats out-of-range, fractional, and outcome-mismatched reward metadata as unverified', () => {
    const result = buildFateAnalytics([
      exactRoll('valid-normal', 1, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('valid-greed', 2, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 2, rewardKind: 'greed' }),
      exactRoll('too-many', 3, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 3, rewardKind: 'normal' }),
      exactRoll('fractional', 4, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1.5, rewardKind: 'normal' }),
      exactRoll('normal-as-pity', 5, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'pity' }),
      exactRoll('pity-as-normal', 6, 'PITY', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('omni-as-greed', 7, 'ROLL_OMNI', 0.2, { standardKeysAwarded: 2, rewardKind: 'greed' }),
    ], allQuery());

    expect(result.summary.confirmedStandardKeys).toBe(3);
    expect(result.coverage).toMatchObject({ exactRewardEvents: 2, unverifiedRewardEvents: 5 });
    expect(result.keyAcquisition[0]).toMatchObject({
      normalStandard: 1,
      greedStandard: 2,
      pityStandard: 0,
      omniStandard: 0,
      unverifiedRewardEvents: 5,
    });
  });

  it('tracks Omni rewards independently from standard keys', () => {
    const result = buildFateAnalytics([
      entry({
        type: 'ROLL_OMNI',
        result: 'SUCCESS',
        meta: {
          successProbability: 1,
          luckApplied: false,
          drawResolution: 1000,
          standardKeysAwarded: 0,
          rewardKind: 'omni',
        },
      }),
    ], allQuery());

    expect(result.summary).toMatchObject({
      genuineWins: 1,
      omniKeysAwarded: 1,
      confirmedStandardKeys: 0,
    });
    expect(result.outcomeComposition).toContainEqual({ outcome: 'omni-win', count: 1 });
  });

  it('does not invent a z-score or verdict when variance is zero', () => {
    const result = buildFateAnalytics([
      entry({
        type: 'ROLL_SUCCESS',
        result: 'SUCCESS',
        rollValue: 1,
        threshold: 100,
        meta: { successProbability: 1, luckApplied: false, drawResolution: 1000, standardKeysAwarded: 1, rewardKind: 'normal' },
      }),
    ], allQuery());

    expect(result.summary.zScore).toBeNull();
    expect(result.summary.verdict).toBeNull();
  });

  it('uses stable history order for timestamp ties when deriving streaks', () => {
    const result = buildFateAnalytics([
      entry({ id: 'first', timestamp: 10, type: 'ROLL_FAIL' }),
      entry({ id: 'second', timestamp: 10, type: 'ROLL_SUCCESS', result: 'SUCCESS', rollValue: 10 }),
      entry({ id: 'third', timestamp: 10, type: 'ROLL_SUCCESS', result: 'SUCCESS', rollValue: 10 }),
    ], allQuery());

    expect(result.timeline.map((point) => point.outcome)).toEqual(['miss', 'normal-win', 'normal-win']);
    expect(result.summary).toMatchObject({ currentDrought: 0, longestDrought: 1, longestHotStreak: 2 });
  });

  it('marks malformed exact metadata unscoreable instead of falling back to threshold', () => {
    const result = buildFateAnalytics([
      entry({ type: 'ROLL_SUCCESS', result: 'SUCCESS', threshold: 50, meta: { successProbability: Number.NaN } }),
    ], allQuery());

    expect(result.coverage).toMatchObject({ unscoreableProbabilities: 1, exactProbabilities: 0, legacyEstimates: 0 });
    expect(result.summary).toMatchObject({ scoreableAttempts: 0, scoreableWins: 0, expectedWins: 0, delta: 0 });
  });

  it('labels missing sources as unknown and counts them diagnostically', () => {
    const result = buildFateAnalytics([{ ...entry({}), source: undefined }], allQuery());

    expect(result.coverage.unknownSources).toBe(1);
    expect(result.sources).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Unknown source', attempts: 1 })]));
  });

  it('exports the established category grouping semantics', () => {
    expect(rollCategory('Quest (Novice)')).toBe('Quest');
    expect(rollCategory('Col. Log: Vorki')).toBe('Collection Log');
  });

  it('keeps source and category availability from the date range before applying scope', () => {
    const now = new Date(2025, 0, 30, 12).getTime();
    const firstIncludedDay = new Date(2025, 0, 1, 0).getTime();
    const result = buildFateAnalytics([
      entry({ source: 'Expired source', timestamp: firstIncludedDay - 1 }),
      entry({ source: 'Quest (Novice)', timestamp: firstIncludedDay }),
      entry({ source: 'Slayer (Beginner)', timestamp: firstIncludedDay + 1 }),
    ], { ...allQuery(now), range: 'last-30-days', scope: { kind: 'source', value: 'Quest (Novice)' } });

    expect(result.availableSources).toEqual(['Quest (Novice)', 'Slayer (Beginner)']);
    expect(result.availableCategories).toEqual(['Quest', 'Slayer']);
    expect(result.summary.attempts).toBe(1);
  });

  it('retains outcomes but excludes legacy and unscoreable probabilities in Exact-only mode', () => {
    const result = buildFateAnalytics([
      entry({ type: 'ROLL_SUCCESS', result: 'SUCCESS', threshold: 50 }),
      entry({ type: 'ROLL_SUCCESS', result: 'SUCCESS', threshold: 50, meta: { successProbability: Number.NaN } }),
      entry({ type: 'ROLL_FAIL', threshold: 25, meta: { successProbability: 0.25 } }),
    ], { ...allQuery(), includeLegacyEstimates: false });

    expect(result.summary).toMatchObject({ attempts: 3, genuineWins: 2, scoreableAttempts: 1, scoreableWins: 0, expectedWins: 0.25, delta: -0.25 });
    expect(result.coverage).toMatchObject({ exactProbabilities: 1, legacyEstimates: 1, unscoreableProbabilities: 1 });
  });

  it('uses only the exact scoreable cohort for Exact-only derived datasets', () => {
    const result = buildFateAnalytics([
      entry({
        source: 'Exact', timestamp: 1, type: 'ROLL_FAIL', rollValue: 80, threshold: 20,
        meta: { successProbability: 0.25, luckApplied: false, drawResolution: 1000, standardKeysAwarded: 0, rewardKind: 'none' },
      }),
      entry({ source: 'Legacy', timestamp: 2, type: 'ROLL_SUCCESS', result: 'SUCCESS', rollValue: 10, threshold: 50 }),
      entry({ source: 'Malformed', timestamp: 3, type: 'ROLL_SUCCESS', result: 'SUCCESS', rollValue: 10, threshold: 50, meta: { successProbability: Number.NaN } }),
    ], { ...allQuery(), includeLegacyEstimates: false });

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0]).toMatchObject({ index: 0, timestamp: 1, outcome: 'miss', expected: 0.25, actual: 0 });
    expect(result.calibration).toEqual([
      { range: '20–30%', attempts: 1, meanPredictedRate: 25, actualRate: 0 },
    ]);
    expect(result.notables).toMatchObject({
      luckiestSuccess: null,
      cruelestMiss: { source: 'Exact', probability: 0.25, timestamp: 1 },
    });
  });

  it('builds histogram expectation from each exact draw model, not observed bucket probabilities', () => {
    const result = buildFateAnalytics([
      entry({
        timestamp: 1, type: 'ROLL_FAIL', rollValue: 80, threshold: 20,
        meta: { successProbability: 0.2, luckApplied: false, drawResolution: 1000, standardKeysAwarded: 0, rewardKind: 'none' },
      }),
      entry({
        timestamp: 2, type: 'ROLL_FAIL', rollValue: 80, threshold: 20,
        meta: { successProbability: 0.36, luckApplied: true, drawResolution: 10000, standardKeysAwarded: 0, rewardKind: 'none' },
      }),
      entry({ timestamp: 3, type: 'ROLL_FAIL', rollValue: 80, threshold: 20 }),
    ], allQuery());

    expect(result.histogram[0]).toMatchObject({ observed: 0, expectedCoverage: 2 });
    expect(result.histogram[0].expected).toBeCloseTo(0.1475);
    expect(result.histogram[1].expected).toBeCloseTo(0.1425);
    expect(result.histogram.reduce((sum, bucket) => sum + (bucket.expected ?? 0), 0)).toBeCloseTo(2);
  });

  it('uses local calendar day arithmetic for the last 30 days over a DST transition', () => {
    const now = new Date(2024, 3, 29, 12).getTime();
    const boundary = new Date(2024, 2, 31, 0).getTime();
    const result = buildFateAnalytics([
      entry({ id: 'before', timestamp: boundary - 1 }),
      entry({ id: 'boundary', timestamp: boundary }),
    ], { ...allQuery(now), range: 'last-30-days' });

    expect(result.summary.attempts).toBe(1);
    expect(result.timeline[0].timestamp).toBe(boundary);
  });

  it('uses the documented sample-label boundaries', () => {
    const results = [9, 10, 29, 30].map((count) => buildFateAnalytics(
      Array.from({ length: count }, (_, index) => entry({ id: `${count}-${index}`, source: `Source ${count}`, threshold: 50 })),
      allQuery(),
    ));

    expect(results.map((result) => result.sources[0].sampleLabel)).toEqual([
      'Limited sample', 'Developing sample', 'Developing sample', 'Established sample',
    ]);
  });

  it('labels aggregate samples by scoreable attempts rather than total attempts', () => {
    const result = buildFateAnalytics([
      ...Array.from({ length: 9 }, (_, index) => legacyRoll(`scoreable-${index}`, index + 1, 'ROLL_FAIL', 20)),
      entry({ id: 'unscoreable', timestamp: 10, source: 'Quest (Novice)', threshold: Number.NaN }),
    ], allQuery());

    expect(result.sources[0]).toMatchObject({
      attempts: 10,
      scoreableAttempts: 9,
      sampleLabel: 'Limited sample',
    });
  });

  it('keeps an unscoreable genuine win out of scoreable wins and delta', () => {
    const result = buildFateAnalytics([
      entry({ type: 'ROLL_SUCCESS', result: 'SUCCESS', threshold: undefined, meta: { successProbability: -1 } }),
      entry({ type: 'ROLL_FAIL', threshold: 50 }),
    ], allQuery());

    expect(result.summary).toMatchObject({ genuineWins: 1, scoreableWins: 0, expectedWins: 0.5, delta: -0.5 });
  });

  it('builds calibration bins from genuine outcomes and predicted probability', () => {
    const result = buildFateAnalytics([
      exactRoll('a', 1, 'ROLL_SUCCESS', 0.15),
      exactRoll('b', 2, 'ROLL_FAIL', 0.15),
      exactRoll('c', 3, 'ROLL_SUCCESS', 0.65),
    ], defaultFateAnalyticsQuery(3));

    expect(result.calibration).toEqual([
      { range: '10–20%', attempts: 2, meanPredictedRate: 15, actualRate: 50 },
      { range: '60–70%', attempts: 1, meanPredictedRate: 65, actualRate: 100 },
    ]);
  });

  it('uses known draw models for histogram expectation and excludes legacy models', () => {
    const result = buildFateAnalytics([
      exactRoll('single', 1, 'ROLL_FAIL', 0.2, { luckApplied: false, drawResolution: 1000 }),
      exactRoll('luck', 2, 'ROLL_FAIL', 0.36, { luckApplied: true, drawResolution: 1000 }),
      legacyRoll('legacy', 3, 'ROLL_FAIL', 20),
    ], defaultFateAnalyticsQuery(3));

    expect(result.histogram[0].expectedCoverage).toBe(2);
    expect(result.histogram.reduce((sum, bucket) => sum + (bucket.expected ?? 0), 0)).toBeCloseTo(2);
  });

  it('clamps cumulative expected bounds to the possible scoreable-attempt range', () => {
    const result = buildFateAnalytics([
      exactRoll('quarter', 1, 'ROLL_FAIL', 0.25),
      exactRoll('half', 2, 'ROLL_SUCCESS', 0.5),
    ], allQuery());

    expect(result.timeline[0]).toMatchObject({ expected: 0.25, actual: 0, delta: -0.25 });
    expect(result.timeline[0].lower).toBe(0);
    expect(result.timeline[0].upper).toBe(1);
    expect(result.timeline[1].lower).toBe(0);
    expect(result.timeline[1].upper).toBe(2);
  });

  it('keeps pity interventions separate from misses in streak segments', () => {
    const result = buildFateAnalytics([
      exactRoll('miss-1', 1, 'ROLL_FAIL', 0.2),
      exactRoll('pity-1', 2, 'PITY', 0.2, { standardKeysAwarded: 1, rewardKind: 'pity' }),
      exactRoll('pity-2', 3, 'PITY', 0.2, { standardKeysAwarded: 1, rewardKind: 'pity' }),
      exactRoll('win', 4, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('miss-2', 5, 'ROLL_FAIL', 0.2),
    ], allQuery());

    expect(result.streaks).toEqual([
      { startIndex: 0, endIndex: 0, outcome: 'miss', length: 1 },
      { startIndex: 1, endIndex: 2, outcome: 'pity', length: 2 },
      { startIndex: 3, endIndex: 3, outcome: 'win', length: 1 },
      { startIndex: 4, endIndex: 4, outcome: 'miss', length: 1 },
    ]);
  });

  it('groups exact rewards by local day and keeps Standard and Omni currencies separate', () => {
    const firstDay = new Date(2025, 4, 6, 9).getTime();
    const secondDay = new Date(2025, 4, 7, 9).getTime();
    const result = buildFateAnalytics([
      exactRoll('normal', firstDay, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('greed', firstDay + 1, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 2, rewardKind: 'greed' }),
      exactRoll('pity', firstDay + 2, 'PITY', 0.2, { standardKeysAwarded: 1, rewardKind: 'pity' }),
      exactRoll('omni', firstDay + 3, 'ROLL_OMNI', 0.2, { standardKeysAwarded: 1, rewardKind: 'omni' }),
      exactRoll('next', secondDay, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 2, rewardKind: 'normal' }),
    ], allQuery());

    expect(result.keyAcquisition).toEqual([
      {
        date: '2025-05-06', normalStandard: 1, greedStandard: 2, pityStandard: 1,
        omniStandard: 1, omniKeys: 1, unverifiedRewardEvents: 0,
      },
      {
        date: '2025-05-07', normalStandard: 2, greedStandard: 0, pityStandard: 0,
        omniStandard: 0, omniKeys: 0, unverifiedRewardEvents: 0,
      },
    ]);
    expect(result.summary).toMatchObject({ confirmedStandardKeys: 7, omniKeysAwarded: 1 });
  });

  it('derives confirmed Standard Keys from the four awarded reward series only', () => {
    const timestamp = new Date(2025, 4, 6, 9).getTime();
    const result = buildFateAnalytics([
      exactRoll('normal', timestamp, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('none', timestamp + 1, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 9, rewardKind: 'none' }),
    ], allQuery());

    expect(result.keyAcquisition[0]).toMatchObject({
      normalStandard: 1, greedStandard: 0, pityStandard: 0, omniStandard: 0,
    });
    expect(result.summary.confirmedStandardKeys).toBe(1);
    expect(result.sources[0].confirmedStandardKeys).toBe(1);
  });

  it('excludes invalid timestamps from reward and activity day datasets', () => {
    const validTimestamp = new Date(2025, 4, 6, 9).getTime();
    const result = buildFateAnalytics([
      exactRoll('valid', validTimestamp, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('invalid', Number.NaN, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 2, rewardKind: 'normal' }),
    ], allQuery());

    expect(result.activityDays).toEqual([{ date: '2025-05-06', attempts: 1 }]);
    expect(result.keyAcquisition).toEqual([expect.objectContaining({ date: '2025-05-06', normalStandard: 1 })]);
    expect(result.coverage.invalidTimestamps).toBe(1);
  });

  it('rejects finite numbers outside the JavaScript Date range from dated datasets and notables', () => {
    const validTimestamp = new Date(2025, 4, 6, 9).getTime();
    const result = buildFateAnalytics([
      exactRoll('invalid-win', Number.MAX_SAFE_INTEGER, 'ROLL_SUCCESS', 0.05, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('invalid-miss', Number.MAX_SAFE_INTEGER - 1, 'ROLL_FAIL', 0.95),
      exactRoll('valid-win', validTimestamp, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('valid-miss', validTimestamp + 1, 'ROLL_FAIL', 0.4),
    ].map((roll, index) => ({ ...roll, source: ['Invalid win', 'Invalid miss', 'Valid win', 'Valid miss'][index] })), allQuery());

    expect(result.coverage.invalidTimestamps).toBe(2);
    expect(result.activityDays).toEqual([{ date: '2025-05-06', attempts: 2 }]);
    expect(result.keyAcquisition).toEqual([expect.objectContaining({ date: '2025-05-06', normalStandard: 1 })]);
    expect(result.notables.luckiestSuccess?.source).toBe('Valid win');
    expect(result.notables.cruelestMiss?.source).toBe('Valid miss');
  });

  it('breaks most-active-day ties by the first day encountered', () => {
    const firstDay = new Date(2025, 4, 6, 9).getTime();
    const secondDay = new Date(2025, 4, 7, 9).getTime();
    const result = buildFateAnalytics([
      exactRoll('second-a', secondDay, 'ROLL_FAIL', 0.2),
      exactRoll('first-a', firstDay, 'ROLL_FAIL', 0.2),
      exactRoll('second-b', secondDay + 1, 'ROLL_FAIL', 0.2),
      exactRoll('first-b', firstDay + 1, 'ROLL_FAIL', 0.2),
    ], allQuery());

    expect(result.notables.mostActiveDay).toEqual({ date: '2025-05-06', attempts: 2 });
  });

  it('breaks luckiest and cruellest ties by stable source order', () => {
    const result = buildFateAnalytics([
      exactRoll('lucky-first', 1, 'ROLL_SUCCESS', 0.1, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('lucky-second', 1, 'ROLL_SUCCESS', 0.1, { standardKeysAwarded: 1, rewardKind: 'normal' }),
      exactRoll('cruel-first', 2, 'ROLL_FAIL', 0.9),
      exactRoll('cruel-second', 2, 'ROLL_FAIL', 0.9),
    ].map((roll, index) => ({ ...roll, source: ['Lucky first', 'Lucky second', 'Cruel first', 'Cruel second'][index] })), allQuery());

    expect(result.notables.luckiestSuccess?.source).toBe('Lucky first');
    expect(result.notables.cruelestMiss?.source).toBe('Cruel first');
  });

  it('breaks most-productive-source ties by first appearance', () => {
    const result = buildFateAnalytics([
      { ...exactRoll('zebra', 1, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }), source: 'Zebra' },
      { ...exactRoll('alpha', 1, 'ROLL_SUCCESS', 0.2, { standardKeysAwarded: 1, rewardKind: 'normal' }), source: 'Alpha' },
    ], allQuery());

    expect(result.notables.mostProductiveSource).toBe('Zebra');
  });

  it('constructs a large single aggregate group with linear array iteration growth', () => {
    const countedIterations = (count: number): number => {
      const fixture = Array.from({ length: count }, (_, index) => ({
        ...exactRoll(`large-${count}-${index}`, index + 1, 'ROLL_FAIL', 0.2),
        source: 'One large source',
      }));
      const originalIterator = Array.prototype[Symbol.iterator];
      let yieldedNormalizedRolls = 0;
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        writable: true,
        value: function iterator(this: unknown[]) {
          const delegate = originalIterator.call(this);
          const countsNormalizedRolls = this.length > 0
            && typeof this[0] === 'object'
            && this[0] !== null
            && 'probabilityQuality' in this[0];
          return {
            next() {
              const step = delegate.next();
              if (countsNormalizedRolls && !step.done) yieldedNormalizedRolls += 1;
              return step;
            },
            [Symbol.iterator]() { return this; },
          };
        },
      });
      try {
        buildFateAnalytics(fixture, allQuery(count));
      } finally {
        Object.defineProperty(Array.prototype, Symbol.iterator, {
          configurable: true,
          writable: true,
          value: originalIterator,
        });
      }
      return yieldedNormalizedRolls;
    };

    const small = countedIterations(200);
    const large = countedIterations(400);

    expect(large).toBeLessThan(small * 2.5);
  });
});
