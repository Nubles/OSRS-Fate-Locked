import { describe, it, expect } from 'vitest';
import { buildFateReport, rollCategory } from './fateReport';
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
  it('returns null with no scoreable rolls', () => {
    expect(buildFateReport([])).toBeNull();
    expect(buildFateReport([{ id: '1', timestamp: 1, type: 'UNLOCK', message: '' } as LogEntry])).toBeNull();
    // Roll entries without a threshold can't be scored.
    expect(buildFateReport([{ ...roll('Quest (Novice)', 20, true), threshold: undefined }])).toBeNull();
  });

  it('computes expected successes and delta from thresholds', () => {
    // Four 50% rolls, all won: expected 2, actual 4, delta +2.
    const report = buildFateReport([
      roll('Boss (Mid)', 50, true), roll('Boss (Mid)', 50, true),
      roll('Boss (Mid)', 50, true), roll('Boss (Mid)', 50, true),
    ])!;
    expect(report.rolls).toBe(4);
    expect(report.expected).toBeCloseTo(2);
    expect(report.actual).toBe(4);
    expect(report.delta).toBeCloseTo(2);
    // variance = 4 × 0.25 = 1 → z = 2 → top verdict.
    expect(report.zScore).toBeCloseTo(2);
    expect(report.verdict).toBe('Blessed by Fate');
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
    expect(report.categories[0]).toMatchObject({ category: 'Quest', rolls: 3, actual: 2 });
    expect(report.categories[0].expected).toBeCloseTo(1.5);
    expect(report.categories[0].delta).toBeCloseTo(0.5);
    expect(report.categories[1]).toMatchObject({ category: 'Collection Log', rolls: 1, actual: 1 });
    expect(report.categories[1].delta).toBeCloseTo(0.9);
  });

  it('keeps the z-score finite on a single near-certain roll', () => {
    const report = buildFateReport([roll('Quest (Novice)', 100, true)])!;
    expect(Number.isFinite(report.zScore)).toBe(true);
  });
});
