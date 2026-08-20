import { describe, expect, it } from 'vitest';
import { sortAnalyticsRows, type AnalyticsBreakdownRow } from './StatsModal';

const row = (
  source: string,
  originalIndex: number,
  zScore: number | null,
  confirmedStandardKeys: number | null,
): AnalyticsBreakdownRow => ({
  source,
  originalIndex,
  attempts: 1,
  genuineWins: 0,
  expectedWins: 0,
  delta: 0,
  actualRate: null,
  expectedRate: null,
  pityInterventions: 0,
  confirmedStandardKeys,
  probabilityCoverage: 0,
  sampleLabel: 'Limited sample',
  zScore,
});

describe('StatsModal stable row sorter', () => {
  it('keeps unavailable z-scores after available values in both directions', () => {
    const rows = [
      row('Unavailable', 0, null, null),
      row('High', 1, 2, 3),
      row('Low', 2, -1, 1),
    ];

    expect(sortAnalyticsRows(rows, 'zScore', 'asc').map(item => item.source))
      .toEqual(['Low', 'High', 'Unavailable']);
    expect(sortAnalyticsRows(rows, 'zScore', 'desc').map(item => item.source))
      .toEqual(['High', 'Low', 'Unavailable']);
  });

  it('keeps unavailable rewards last and resolves equal values by original index', () => {
    const rows = [
      row('Unavailable', 0, null, null),
      row('Later', 2, 0, 1),
      row('Earlier', 1, 0, 1),
    ];

    expect(sortAnalyticsRows(rows, 'confirmedStandardKeys', 'asc').map(item => item.source))
      .toEqual(['Earlier', 'Later', 'Unavailable']);
    expect(sortAnalyticsRows(rows, 'confirmedStandardKeys', 'desc').map(item => item.source))
      .toEqual(['Earlier', 'Later', 'Unavailable']);
  });
});
