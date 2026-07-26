import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import {
  buildKeyEconomyEvidence,
  stageForCompletion,
  type KeyEconomyEvidenceInput,
} from './keyEconomyEvidence';

let eventNumber = 0;
const roll = (overrides: Partial<LogEntry> = {}): LogEntry => {
  eventNumber += 1;
  const won = overrides.result === 'SUCCESS';

  return {
    id: `event-${eventNumber}`,
    timestamp: 1_700_000_001_000 + eventNumber,
    type: won ? 'ROLL_SUCCESS' : 'ROLL_FAIL',
    source: 'Quest (Novice)',
    result: won ? 'SUCCESS' : 'FAIL',
    threshold: 50,
    message: '',
    ...overrides,
  };
};

const validInput: KeyEconomyEvidenceInput = {
  reportId: 'anonymous-report',
  gameMode: 'vanilla',
  stage: 'early',
  observedHours: 12,
  appVersion: 'test-build',
};

describe('stageForCompletion', () => {
  it.each([
    [0, 'early'],
    [24, 'early'],
    [25, 'mid'],
    [74, 'mid'],
    [75, 'late'],
    [100, 'late'],
  ])('classifies %s%% as %s', (percent, stage) => {
    expect(stageForCompletion(percent)).toBe(stage);
  });

  it.each([-1, 101, Number.NaN])('rejects invalid completion %s', percent => {
    expect(() => stageForCompletion(percent)).toThrow(/completion/i);
  });
});

describe('buildKeyEconomyEvidence', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid observed hours %s',
    observedHours => {
      expect(() => buildKeyEconomyEvidence([], {
        ...validInput,
        observedHours,
      })).toThrow(/observedHours/i);
    },
  );

  it('exports only privacy-safe aggregate outcomes', () => {
    const history: LogEntry[] = [
      roll({
        id: 'private-event-id',
        timestamp: 1_700_000_000_000,
        source: 'Boss (Mid)',
        threshold: 20,
        result: 'FAIL',
        meta: {
          fatePointsEarned: 4,
          linkedAccount: 'Sensitive Name',
          relayToken: 'secret-token',
        },
      }),
      roll({
        id: 'second-private-event-id',
        timestamp: 1_700_000_000_999,
        source: 'Boss (Mid)',
        threshold: 20,
        result: 'SUCCESS',
      }),
      roll({
        source: 'Quest (Novice)',
        threshold: 50,
        result: 'FAIL',
      }),
    ];

    const report = buildKeyEconomyEvidence(history, validInput);

    expect(report.totals).toMatchObject({
      attempts: 3,
      successes: 1,
      fatePoints: 5,
      drought: { longestFailures: 1, activeFailures: 1 },
    });
    expect(report.totals.expectedSuccesses).toBeCloseTo(0.9);

    const boss = report.sources.find(({ source }) => source === 'Boss (Mid)')!;
    expect(boss).toMatchObject({
      source: 'Boss (Mid)',
      category: 'Boss',
      attempts: 2,
      successes: 1,
      fatePoints: 4,
      drought: { longestFailures: 1, activeFailures: 0 },
    });
    expect(boss.expectedSuccesses).toBeCloseTo(0.4);

    const serialized = JSON.stringify(report);
    for (const forbidden of [
      'private-event-id',
      '1700000000000',
      'Sensitive Name',
      'secret-token',
      'timestamp',
      'history',
      'linkedAccount',
      'relayToken',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('infers Fate Points for historical rolls without metadata', () => {
    expect(buildKeyEconomyEvidence([
      roll({ type: 'ROLL_FAIL', result: 'FAIL', meta: undefined }),
      roll({ type: 'PITY', result: 'SUCCESS', meta: undefined }),
    ], validInput).totals.fatePoints).toBe(2);
  });

  it('sorts drought sequences by timestamp and exported sources by source', () => {
    const report = buildKeyEconomyEvidence([
      roll({ source: 'Quest (Novice)', timestamp: 3, result: 'FAIL' }),
      roll({ source: 'Boss (Mid)', timestamp: 1, result: 'FAIL' }),
      roll({ source: 'Boss (Mid)', timestamp: 2, result: 'SUCCESS' }),
    ], validInput);

    expect(report.totals.drought).toEqual({
      longestFailures: 1,
      activeFailures: 1,
    });
    expect(report.sources.map(({ source }) => source)).toEqual([
      'Boss (Mid)',
      'Quest (Novice)',
    ]);
  });
});
