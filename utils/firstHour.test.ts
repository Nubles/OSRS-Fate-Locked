// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import type { LogEntry } from '../types';
import {
  EMPTY_RECORD, GRADUATE_AT_HISTORY, firstHourActive, firstHourProgress, firstHourSteps, firstSightRecord,
  markSeen, nextAnnouncement, readFirstHourEnabled, readFirstHourRecord, writeFirstHourEnabled, writeFirstHourRecord,
  type FirstHourInput,
} from './firstHour';

let n = 0;
const entry = (type: LogEntry['type'], meta: Record<string, unknown> = {}): LogEntry =>
  ({ id: `e${++n}`, timestamp: n, type, message: type, meta });
const unlock = () => entry('UNLOCK', { item: 'Head', category: 'Equipment', costType: 'key' });

const base = (over: Partial<FirstHourInput> = {}): FirstHourInput => ({
  history: [], keys: 3, startingKeys: 3, pityThreshold: 50, chunked: false, ...over,
});

describe('firstHourProgress', () => {
  it('starts a fresh run on spending its starting Keys', () => {
    const p = firstHourProgress(base(), EMPTY_RECORD);
    expect(p.current?.id).toBe('spend');
    expect(p.percent).toBe(0);
    expect(p.spent).toBe(0);
  });

  it('counts starting Keys spent and moves on once all are spent', () => {
    expect(firstHourProgress(base({ history: [unlock()], keys: 2 }), EMPTY_RECORD).current?.id).toBe('spend');
    expect(firstHourProgress(base({ history: [unlock()], keys: 2 }), EMPTY_RECORD).spent).toBe(1);
    const p = firstHourProgress(base({ history: [unlock(), unlock(), unlock()], keys: 0 }), EMPTY_RECORD);
    expect(p.current?.id).toBe('journal');
    expect(p.spent).toBe(3);
  });

  it('lets a player who spent some Keys and has none left move on', () => {
    expect(firstHourProgress(base({ history: [unlock()], keys: 0 }), EMPTY_RECORD).done.has('spend')).toBe(true);
  });

  it('reads the look-at steps from the record', () => {
    const history = [unlock(), unlock(), unlock()];
    const p = firstHourProgress(base({ history, keys: 0 }), markSeen(EMPTY_RECORD, 'journal'));
    expect(p.current?.id).toBe('roll');
  });

  it('counts a roll as finding something to do', () => {
    const history = [unlock(), unlock(), unlock(), entry('ROLL_SUCCESS')];
    const p = firstHourProgress(base({ history, keys: 1 }), EMPTY_RECORD);
    expect(p.done.has('journal')).toBe(true);
    expect(p.done.has('roll')).toBe(true);
    expect(p.current?.id).toBe('fate');
  });

  it('marks Fate done on a failed roll or a Pity Key, not on Fate from an achievement', () => {
    for (const history of [[entry('ROLL_FAIL')], [entry('PITY')]]) {
      expect(firstHourProgress(base({ history }), EMPTY_RECORD).done.has('fate')).toBe(true);
    }
    expect(firstHourProgress(base(), EMPTY_RECORD).done.has('fate')).toBe(false);
  });

  it('marks the Altar done by a ritual or by opening it', () => {
    expect(firstHourProgress(base({ history: [entry('ALTAR')] }), EMPTY_RECORD).done.has('altar')).toBe(true);
    expect(firstHourProgress(base(), markSeen(EMPTY_RECORD, 'altar')).done.has('altar')).toBe(true);
  });

  it('finishes when every step is done, the optional one included', () => {
    const history = [unlock(), unlock(), unlock(), entry('ROLL_FAIL'), entry('ALTAR')];
    const before = firstHourProgress(base({ history, keys: 0 }), EMPTY_RECORD);
    expect(before.current?.id).toBe('sync');
    expect(before.current?.optional).toBe(true);
    const after = firstHourProgress(base({ history, keys: 0 }), markSeen(EMPTY_RECORD, 'sync'));
    expect(after.current).toBeNull();
    expect(after.percent).toBe(100);
  });

  it('gives nothing: no step names a reward', () => {
    for (const step of firstHourSteps({ startingKeys: 3, pityThreshold: 50, chunked: false })) {
      expect(`${step.body} ${step.done}`).not.toMatch(/\b(you get|reward|free)\b/i);
    }
  });

  it('words the spend step for Chunked', () => {
    const [spend] = firstHourSteps({ startingKeys: 3, pityThreshold: 50, chunked: true });
    expect(spend.body).toMatch(/Chunks table/);
  });
});

describe('nextAnnouncement', () => {
  it('announces, in step order, each step done since the guide started watching', () => {
    const history = [unlock(), unlock(), unlock(), entry('ROLL_FAIL')];
    const p = firstHourProgress(base({ history, keys: 0 }), markSeen(EMPTY_RECORD, 'journal'));
    const announced = new Set(['spend', 'journal'] as const);
    expect(nextAnnouncement(p.steps, p.done, announced)?.id).toBe('roll');
    expect(nextAnnouncement(p.steps, p.done, new Set([...announced, 'roll']))?.id).toBe('fate');
    expect(nextAnnouncement(p.steps, p.done, new Set([...announced, 'roll', 'fate']))).toBeNull();
  });
});

describe('first sight and activity', () => {
  it('graduates a run that is already well under way', () => {
    const history = Array.from({ length: GRADUATE_AT_HISTORY }, () => entry('ROLL_FAIL'));
    expect(firstSightRecord(history).graduated).toBe(true);
    expect(firstSightRecord(history.slice(1)).graduated).toBeUndefined();
  });

  it('shows only while on, not skipped, graduated or finished', () => {
    expect(firstHourActive(EMPTY_RECORD, true)).toBe(true);
    expect(firstHourActive(EMPTY_RECORD, false)).toBe(false);
    expect(firstHourActive({ seen: [], skipped: true }, true)).toBe(false);
    expect(firstHourActive({ seen: [], graduated: true }, true)).toBe(false);
    expect(firstHourActive({ seen: [], finished: true }, true)).toBe(false);
  });

  it('markSeen keeps the same record when nothing changes', () => {
    const r = markSeen(EMPTY_RECORD, 'altar');
    expect(markSeen(r, 'altar')).toBe(r);
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('is on by default and remembers being turned off', () => {
    expect(readFirstHourEnabled()).toBe(true);
    writeFirstHourEnabled(false);
    expect(readFirstHourEnabled()).toBe(false);
  });

  it('round-trips a record per run and drops unknown steps', () => {
    expect(readFirstHourRecord('run-a')).toBeNull();
    writeFirstHourRecord('run-a', { seen: ['journal'], skipped: true });
    expect(readFirstHourRecord('run-a')).toEqual({ seen: ['journal'], skipped: true });
    expect(readFirstHourRecord('run-b')).toBeNull();
    localStorage.setItem('fate_first_hour_v1:run-c', JSON.stringify({ seen: ['journal', 'bogus'] }));
    expect(readFirstHourRecord('run-c')).toEqual({ seen: ['journal'] });
    localStorage.setItem('fate_first_hour_v1:run-d', '{not json');
    expect(readFirstHourRecord('run-d')).toBeNull();
  });
});
