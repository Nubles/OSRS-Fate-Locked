import { describe, expect, it } from 'vitest';
import type { TimelinePoint } from '../../utils/fateAnalytics';
import { buildCalendarGrid, downsampleTimeline } from './chartData';

describe('downsampleTimeline', () => {
  it('downsamples render data without changing endpoints', () => {
    const points = Array.from({ length: 1000 }, (_, index) => ({ index } as TimelinePoint));

    const sampled = downsampleTimeline(points, 400);

    expect(sampled).toHaveLength(400);
    expect(sampled[0]).toBe(points[0]);
    expect(sampled.at(-1)).toBe(points.at(-1));
  });

  it('returns the original render data when it is already within the cap', () => {
    const points = Array.from({ length: 3 }, (_, index) => ({ index } as TimelinePoint));

    expect(downsampleTimeline(points, 3)).toBe(points);
    expect(downsampleTimeline(points, 10)).toBe(points);
  });
});

describe('buildCalendarGrid', () => {
  it('fills missing local calendar days with zero attempts', () => {
    const grid = buildCalendarGrid([
      { date: '2026-08-18', attempts: 2 },
      { date: '2026-08-20', attempts: 1 },
    ], '2026-08-20', 3);

    expect(grid).toEqual([
      { date: '2026-08-18', attempts: 2 },
      { date: '2026-08-19', attempts: 0 },
      { date: '2026-08-20', attempts: 1 },
    ]);
  });

  it('uses calendar-day arithmetic across a daylight-saving boundary', () => {
    expect(buildCalendarGrid([
      { date: '2026-03-28', attempts: 1 },
      { date: '2026-03-30', attempts: 2 },
    ], '2026-03-30', 3)).toEqual([
      { date: '2026-03-28', attempts: 1 },
      { date: '2026-03-29', attempts: 0 },
      { date: '2026-03-30', attempts: 2 },
    ]);
  });
});
