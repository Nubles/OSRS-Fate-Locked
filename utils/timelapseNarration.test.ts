import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import { detectMilestones, narrate } from './timelapseNarration';

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

describe('timelapse milestones', () => {
  it('labels start-area milestone Keys without naming a retired mode', () => {
    // Chunked's start-chunk Keys use the XTREME_MILESTONE entry type too.
    const milestones = detectMilestones([
      { id: 'start', timestamp: 1, type: 'LEVEL_UP', message: 'Attack level 2' },
      { id: 'chunk-key', timestamp: 2, type: 'XTREME_MILESTONE', message: 'Chunked milestone: Total Level 50 gives a guaranteed Key.' },
    ]);
    expect(milestones.find(m => m.index === 1)?.label).toBe('Start-area milestone Key');
    expect(milestones.map(m => m.label).join(' ')).not.toContain('Xtreme');
  });
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
