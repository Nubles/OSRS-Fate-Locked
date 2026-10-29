import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import { awayText, lastSession, SESSION_GAP_MS, WELCOME_BACK_AFTER_MS, welcomeBackText } from './welcomeBack';

const HOUR = 3_600_000;
let n = 0;
const entry = (timestamp: number, type: LogEntry['type'], over: Partial<LogEntry> = {}): LogEntry =>
  ({ id: `e${n++}`, timestamp, type, message: type === 'UNLOCK' ? 'Unlocked Vorkath' : 'x', ...over });

describe('welcome back', () => {
  const t0 = 1_790_000_000_000;
  const history: LogEntry[] = [
    // An older session, more than the session gap before the last one.
    entry(t0, 'ROLL_SUCCESS', { meta: { standardKeysAwarded: 1 } }),
    entry(t0 + 10 * HOUR, 'ROLL_FAIL', { meta: { fatePointsEarned: 2 } }),
    entry(t0 + 10.5 * HOUR, 'ROLL_SUCCESS', { meta: { standardKeysAwarded: 2, fatePointsEarned: 0 } }),
    entry(t0 + 11 * HOUR, 'LEVEL_UP', { meta: { chaosKeysAwarded: 1 } }),
    entry(t0 + 11.2 * HOUR, 'UNLOCK'),
    entry(t0 + 11.3 * HOUR, 'UNLOCK', { message: 'Unlocked Barrows Brothers' }),
    entry(t0 + 11.4 * HOUR, 'PITY'),
  ];
  const last = history[history.length - 1].timestamp;

  it('says nothing until 12 hours have passed', () => {
    expect(lastSession(history, last + WELCOME_BACK_AFTER_MS - 1)).toBeNull();
    expect(lastSession([], last + WELCOME_BACK_AFTER_MS)).toBeNull();
  });

  it('sums the last session only', () => {
    const s = lastSession(history, last + 3 * 24 * HOUR)!;
    expect(s).toMatchObject({ lastId: history[6].id, rolls: 3, keys: 3, chaosKeys: 1, fate: 2, unlocks: ['Vorkath', 'Barrows Brothers'] });
    expect(SESSION_GAP_MS).toBeLessThan(10 * HOUR);
  });

  it('words the note', () => {
    expect(awayText(13 * HOUR)).toBe('13 hours');
    expect(awayText(3 * 24 * HOUR + HOUR)).toBe('3 days');
    const s = lastSession(history, last + 3 * 24 * HOUR)!;
    expect(welcomeBackText(s, 12)).toBe('Welcome back: 3 days away. Last session: 3 rolls, 3 Keys won, 1 Chaos Key won, 2 unlocks (Vorkath and Barrows Brothers). 12 Fate Points from a Pity Key.');
    expect(welcomeBackText({ ...s, rolls: 0, keys: 0, chaosKeys: 0, unlocks: [] })).toBe('Welcome back: 3 days away.');
    expect(welcomeBackText({ ...s, unlocks: ['A', 'B', 'C', 'D', 'E'] }, 0)).toContain('5 unlocks (C, D, E and 2 more)');
  });
});
