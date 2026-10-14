import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import { formatRate, keySourceGroup, summarizeKeyHistory } from './keyHistorySummary';

let n = 0;
const roll = (type: LogEntry['type'], source: string, threshold?: number, meta?: Record<string, unknown>): LogEntry => ({
  id: `e${++n}`, timestamp: 1_700_000_000_000 + n, type, source, message: type, threshold, rollValue: threshold, meta,
});

describe('keySourceGroup', () => {
  it('groups the source names the rolls write', () => {
    expect(keySourceGroup('Slayer (Turael/Spria)')).toBe('Slayer');
    expect(keySourceGroup('Clue Scroll (Beginner)')).toBe('Clues');
    expect(keySourceGroup('Boss (Low)')).toBe('Bosses');
    expect(keySourceGroup('Raid')).toBe('Bosses');
    expect(keySourceGroup('Activity (Minigame)')).toBe('Activities');
    expect(keySourceGroup('Quest (Novice)')).toBe('Quests');
    expect(keySourceGroup('Diary (Easy)')).toBe('Diaries');
    expect(keySourceGroup('Combat Achievement (Medium)')).toBe('Combat Achievements');
    expect(keySourceGroup('Col. Log: Purple sweets')).toBe('Collection log');
    expect(keySourceGroup('Woodcutting Level 15')).toBe('Levels');
    expect(keySourceGroup('Level Up')).toBe('Levels');
    expect(keySourceGroup('Pet Drop')).toBe('Pets');
    expect(keySourceGroup('Something new')).toBe('Other');
    expect(keySourceGroup(undefined)).toBe('Other');
  });
});

describe('summarizeKeyHistory', () => {
  it('tallies rolls and Keys per group in display order, ignoring non-roll entries', () => {
    const history: LogEntry[] = [
      { id: 'u', timestamp: 1, type: 'UNLOCK', message: 'Unlocked X' },
      roll('ROLL_FAIL', 'Quest (Novice)', 30),
      roll('ROLL_SUCCESS', 'Quest (Novice)', 30),
      roll('ROLL_FAIL', 'Slayer (Mazchna)', 10),
      { id: 'a', timestamp: 2, type: 'ALTAR', message: 'Ritual' },
    ];
    const s = summarizeKeyHistory(history);
    expect(s.rows).toEqual([
      { group: 'Slayer', rolls: 1, keys: 0, rate: 0 },
      { group: 'Quests', rolls: 2, keys: 1, rate: 0.5 },
    ]);
    expect(s.rolls).toBe(3);
    expect(s.keys).toBe(1);
  });

  it('measures dry streaks; a pity Key ends one', () => {
    const history = [
      roll('ROLL_FAIL', 'Diary (Easy)', 10),
      roll('ROLL_FAIL', 'Diary (Easy)', 10),
      roll('ROLL_FAIL', 'Diary (Easy)', 10),
      roll('PITY', 'Diary (Easy)', 10),
      roll('ROLL_FAIL', 'Diary (Easy)', 10),
      roll('ROLL_SUCCESS', 'Diary (Easy)', 10),
      roll('ROLL_FAIL', 'Diary (Easy)', 10),
      roll('ROLL_FAIL', 'Diary (Easy)', 10),
    ];
    const s = summarizeKeyHistory(history);
    expect(s.longestDry).toBe(3);
    expect(s.currentDry).toBe(2);
    expect(s.keys).toBe(2);
    expect(s.latestKey?.id).toBe(history[5].id);
  });

  it('picks the won roll with the smallest chance as the luckiest, never a pity Key', () => {
    const lowPity = roll('PITY', 'Clue Scroll (Easy)', 1);
    const rare = roll('ROLL_SUCCESS', 'Boss (High)', 4);
    const exact = roll('ROLL_OMNI', 'Raid', 50, { successProbability: 0.02 });
    const s = summarizeKeyHistory([roll('ROLL_SUCCESS', 'Quest (Novice)', 30), lowPity, rare, exact, roll('ROLL_FAIL', 'Raid', 0.5)]);
    expect(s.luckiest?.entry.id).toBe(exact.id);
    expect(s.luckiest?.chance).toBeCloseTo(2);
    expect(s.latestKey?.id).toBe(exact.id);
  });

  it('is empty for a run with no rolls', () => {
    expect(summarizeKeyHistory([])).toEqual({ rows: [], rolls: 0, keys: 0, longestDry: 0, currentDry: 0, luckiest: null, latestKey: null });
  });
});

describe('formatRate', () => {
  it('rounds to whole percents from 10% and one decimal below', () => {
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(0.15)).toBe('15%');
    expect(formatRate(1 / 12)).toBe('8.3%');
    expect(formatRate(0.05)).toBe('5%');
  });
});
