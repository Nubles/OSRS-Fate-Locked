import { describe, expect, it } from 'vitest';
import type { FateEventEnvelope } from '../services/fateEventProtocol';
import {
  addRuneliteEvents,
  mergeSentEvents,
  pasteSummary,
  sentSummary,
} from './runelitePaste';

const pasted = (events: number, tooOld = 0, unreadable = 0) => ({
  events: Array.from({ length: events }, () => ({}) as FateEventEnvelope),
  tooOld,
  unreadable,
});

describe('pasteSummary', () => {
  it('says what a paste added and what it left out', () => {
    expect(pasteSummary(pasted(8, 1), 5)).toBe('Added 5. 3 were already here. 1 was too old.');
    expect(pasteSummary(pasted(2, 2, 1), 1)).toBe('Added 1. 1 was already here. 2 were too old. 1 couldn’t be read.');
    expect(pasteSummary(pasted(0, 0, 3), 0)).toBe('Added 0. 3 couldn’t be read.');
  });

  it('names whose events they were', () => {
    expect(pasteSummary(pasted(1), 1, ['Zezima'])).toBe('Added 1 from Zezima.');
    expect(pasteSummary(pasted(2), 2, ['Zezima', 'Nubles'])).toBe('Added 2 from Zezima and Nubles.');
    expect(pasteSummary(pasted(3), 3, ['Zezima', 'Nubles', 'Lynx Titan']))
      .toBe('Added 3 from Zezima, Nubles and Lynx Titan.');
  });
});

describe('addRuneliteEvents', () => {
  const event = (eventId: string, account: string) => ({ eventId, account }) as FateEventEnvelope;
  const store = (added: number) => ({ ingest: (events: FateEventEnvelope[]) => Math.min(added, events.length) });

  it('adds the events and says how many were new', () => {
    const pasted = { events: [event('a', 'Player One'), event('b', 'Player One')], tooOld: 0, unreadable: 0 };
    expect(addRuneliteEvents(store(1), pasted, 'Player One')).toEqual({ added: 1, characters: [] });
  });

  it('names whose events they were for a run linked to no one', () => {
    const pasted = {
      events: [event('a', 'Player One'), event('b', 'Player Two'), event('c', 'Player One')],
      tooOld: 0,
      unreadable: 0,
    };
    expect(addRuneliteEvents(store(3), pasted, undefined)).toEqual({ added: 3, characters: ['Player One', 'Player Two'] });
    expect(addRuneliteEvents(store(3), pasted, null).characters).toEqual(['Player One', 'Player Two']);
  });
});

describe('sentSummary', () => {
  const sent = (added: number, tooOld = 0, unreadable = 0, characters: string[] = []) =>
    ({ added, tooOld, unreadable, characters });

  it('says what Send to tracker added, like a paste', () => {
    expect(sentSummary(sent(3))).toBe('Added 3 from RuneLite.');
    expect(sentSummary(sent(1, 1, 2))).toBe('Added 1 from RuneLite. 1 was too old. 2 couldn’t be read.');
    expect(sentSummary(sent(0, 2))).toBe('Added 0 from RuneLite. 2 were too old.');
  });

  it('names whose events they were for a run linked to no one', () => {
    expect(sentSummary(sent(2, 0, 0, ['Player One']))).toBe('Added 2 from RuneLite (Player One).');
    expect(sentSummary(sent(4, 0, 0, ['Player One', 'Player Two'])))
      .toBe('Added 4 from RuneLite (Player One and Player Two).');
  });

  it('tells two arrivals the player hasn’t seen yet as one', () => {
    expect(mergeSentEvents(sent(2, 1, 0, ['Player One']), sent(3, 0, 1, ['Player Two', 'Player One'])))
      .toEqual(sent(5, 1, 1, ['Player One', 'Player Two']));
  });
});
