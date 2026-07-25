import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import { narrate } from './timelapseNarration';

const rollSuccess = (
  over: Partial<LogEntry> = {},
): LogEntry => ({
  id: 'roll',
  timestamp: 1,
  type: 'ROLL_SUCCESS',
  source: 'Attack Level 41',
  message: 'Key Found!',
  ...over,
});

describe('timelapse roll narration', () => {
  it('formats decimal roll values and thresholds with the shared precision', () => {
    expect(narrate(rollSuccess({ rollValue: 42.1, threshold: 8.2 })))
      .toBe('Attack Level 41 yields a key. 42.1 vs 8.2%.');
  });

  it('keeps one decimal place for integer roll values and thresholds', () => {
    expect(narrate(rollSuccess({ rollValue: 42, threshold: 8 })))
      .toBe('Attack Level 41 yields a key. 42.0 vs 8.0%.');
  });

  it('preserves question marks for legacy missing roll fields', () => {
    expect(narrate(rollSuccess()))
      .toBe('Attack Level 41 yields a key. ? vs ?.');
  });
});
