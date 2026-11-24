import { describe, expect, it } from 'vitest';
import evidenceProtocol from '../docs/key-economy-evidence.md?raw';
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

describe('key economy evidence protocol', () => {
  it('publishes the fixed privacy and sample gate', () => {
    const doc = evidenceProtocol;

    for (const phrase of [
      'at least 10 independent runs',
      'at least 500 scoreable attempts',
      'three materially different source categories',
      'median keys/hour',
      'interquartile range',
      'exact timestamps',
      'Nothing is uploaded automatically',
    ]) {
      expect(doc).toContain(phrase);
    }
});
  });

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

  it('excludes malformed thresholds and blank sources from the sample', () => {
    const report = buildKeyEconomyEvidence([
      roll({ threshold: Number.POSITIVE_INFINITY }),
      roll({ threshold: Number.NaN }),
      roll({ source: '   ' }),
      roll({ source: 'Boss (Mid)', threshold: 20 }),
    ], validInput);

    expect(report.totals.attempts).toBe(1);
    expect(report.sources.map(source => source.source)).toEqual(['Boss (Mid)']);
  });
  it('infers Fate Points for historical rolls without metadata', () => {
    expect(buildKeyEconomyEvidence([
      roll({ type: 'ROLL_FAIL', result: 'FAIL', meta: undefined }),
      roll({ type: 'PITY', result: 'SUCCESS', meta: undefined }),
    ], validInput).totals.fatePoints).toBe(2);
  });

  it('totals the exact weighted Fate recorded on failed rolls', () => {
    const report = buildKeyEconomyEvidence([
      roll({ source: 'Boss (Mid)', meta: { fatePointsEarned: 2 } }),
      roll({ source: 'Raid', meta: { fatePointsEarned: 3 } }),
    ], validInput);

    expect(report.totals.fatePoints).toBe(5);
    expect(report.sources.map(({ source, fatePoints }) => ({ source, fatePoints }))).toEqual([
      { source: 'Boss (Mid)', fatePoints: 2 },
      { source: 'Raid', fatePoints: 3 },
    ]);
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

describe('Pity Keys and recorded odds in the evidence', () => {
  it('does not count a Pity Key as a success, and a Pity Key does not end a drought', () => {
    const pity = (): LogEntry => roll({ type: 'PITY', result: 'SUCCESS', message: 'MAX FATE REACHED! Pity Key granted.' });
    const report = buildKeyEconomyEvidence([
      roll(), roll(), roll(), roll(), roll(),
      pity(),
      roll(),
    ], validInput);

    expect(report.schemaVersion).toBe(2);
    expect(report.totals).toMatchObject({
      attempts: 7,
      successes: 0,
      pityKeys: 1,
      drought: { longestFailures: 7, activeFailures: 7 },
    });
    expect(report.sources[0]).toMatchObject({ attempts: 7, successes: 0, pityKeys: 1, drought: { longestFailures: 7, activeFailures: 7 } });
  });

  it('ends a drought on a real win, on a Key and on an Omni-Key', () => {
    const report = buildKeyEconomyEvidence([
      roll(), roll({ result: 'SUCCESS' }), roll(), roll({ type: 'ROLL_OMNI', result: 'SUCCESS' }),
    ], validInput);
    expect(report.totals).toMatchObject({ successes: 2, pityKeys: 0, drought: { longestFailures: 1, activeFailures: 0 } });
  });

  it("takes a roll's expected success from its recorded odds, and from its threshold when there are none", () => {
    const report = buildKeyEconomyEvidence([
      // A Ritual of Clarity roll: two draws at 40%.
      roll({ threshold: 40, meta: { successProbability: 0.64, luckApplied: true } }),
      // An older save's roll with no recorded odds.
      roll({ threshold: 40, meta: undefined }),
      // Recorded odds that cannot be right fall back to the threshold.
      roll({ threshold: 40, meta: { successProbability: 1.5 } }),
      roll({ threshold: 40, meta: { successProbability: Number.NaN } }),
    ], validInput);
    expect(report.totals.expectedSuccesses).toBeCloseTo(0.64 + 0.4 * 3);
  });

  it('counts a win Verac hit through on its own, inside the successes', () => {
    // As the reducer writes one: a roll above its threshold, a Key, the plain
    // threshold as its recorded odds, and the hit-through in its details.
    const veracWin = roll({
      type: 'ROLL_SUCCESS',
      result: 'SUCCESS',
      threshold: 5,
      rollValue: 80,
      message: 'Key Found!',
      details: 'Rolled 80.0 (> 5.0%). Verac hit through the miss.',
      meta: { roll: 80, baseThreshold: 5, threshold: 5, fatePointsEarned: 0, successProbability: 0.05 },
    });
    const veracOmni = roll({
      type: 'ROLL_OMNI',
      result: 'SUCCESS',
      threshold: 4,
      rollValue: 90,
      details: 'Rolled 90.0 (≤ 4.0%), and an Omni-Key came with the Key. Verac hit through the miss.',
      meta: { successProbability: 0.04 },
    });
    // An older save's hit-through, with no analytics in its meta.
    const oldVeracWin = roll({ result: 'SUCCESS', threshold: 10, details: 'Rolled 70.0 (> 10.0%). Verac hit through the miss.' });
    const report = buildKeyEconomyEvidence([
      roll({ threshold: 5 }), veracWin, veracOmni, oldVeracWin, roll({ result: 'SUCCESS', threshold: 50, details: 'Rolled 3.0 (≤ 50.0%).' }),
    ], validInput);

    expect(report.totals).toMatchObject({ attempts: 5, successes: 4, veracHitThroughs: 3, pityKeys: 0 });
    expect(report.sources[0]).toMatchObject({ successes: 4, veracHitThroughs: 3 });
    expect(report.totals.expectedSuccesses).toBeCloseTo(0.05 + 0.05 + 0.04 + 0.1 + 0.5);
    expect(buildKeyEconomyEvidence([roll(), roll({ result: 'SUCCESS' })], validInput).totals.veracHitThroughs).toBe(0);
  });

  it('documents what the counts mean', () => {
    expect(evidenceProtocol).toContain('schema version 2');
    expect(evidenceProtocol).toContain('A Pity Key is not a success');
    expect(evidenceProtocol).toContain("without Verac's 15% hit-through");
    expect(evidenceProtocol).toContain('`veracHitThroughs`');
  });
});
