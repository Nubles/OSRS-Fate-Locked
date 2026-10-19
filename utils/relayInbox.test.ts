import { describe, expect, it } from 'vitest';
import {
  RELAY_INBOX_MIN_GAP_MS,
  RELAY_INBOX_POLL_MS,
  relayInboxEarliestAt,
  relayInboxIds,
  relayInboxNextAt,
} from './relayInbox';

describe('when the tracker asks the relay for what RuneLite sent', () => {
  it('asks at once the first time, then never twice in 10 seconds', () => {
    expect(relayInboxEarliestAt(null, 0)).toBe(0);
    expect(relayInboxEarliestAt(1_000_000, 0)).toBe(1_000_000 + RELAY_INBOX_MIN_GAP_MS);
    expect(RELAY_INBOX_MIN_GAP_MS).toBe(10_000);
  });

  it('asks every minute while things work', () => {
    expect(relayInboxNextAt(1_000_000, 0)).toBe(1_000_000 + RELAY_INBOX_POLL_MS);
    expect(RELAY_INBOX_POLL_MS).toBe(60_000);
  });

  it('backs off after failures as a failed publish does: 15 s, 1 min, then every 5 min', () => {
    for (const [failures, delay] of [[1, 15_000], [2, 60_000], [3, 300_000], [9, 300_000]]) {
      expect(relayInboxNextAt(0, failures)).toBe(delay);
      // Showing the tab again doesn't cut the backoff short.
      expect(relayInboxEarliestAt(0, failures)).toBe(delay);
    }
  });
});

describe('relayInboxIds', () => {
  const inbox = (events: unknown) => JSON.stringify({ format: 'fate-locked-runelite-events', events });

  it('names every event the relay sent, readable or not, once each', () => {
    expect(relayInboxIds(inbox([
      { eventId: 'a', protocolVersion: 1 },
      { eventId: 'b', occurredAt: 0 },
      { eventId: 'a' },
      { id: 'c' },
    ]))).toEqual(['a', 'b', 'c']);
  });

  it('reads eventId before id, as the relay does', () => {
    expect(relayInboxIds(inbox([{ eventId: 'real', id: 'other' }]))).toEqual(['real']);
    expect(relayInboxIds(inbox([{ eventId: 7, id: 'other' }]))).toEqual([]);
  });

  it('leaves out ids the relay would refuse, and stops at 250', () => {
    expect(relayInboxIds(inbox([{ eventId: '' }, { eventId: 'x'.repeat(129) }, 'e1', null, [1], { eventId: 'x'.repeat(128) }])))
      .toEqual(['x'.repeat(128)]);
    expect(relayInboxIds(inbox(Array.from({ length: 300 }, (_, index) => ({ eventId: `e${index}` }))))).toHaveLength(250);
  });

  it('names nothing for a reply that is not an inbox', () => {
    expect(relayInboxIds('not json')).toEqual([]);
    expect(relayInboxIds('null')).toEqual([]);
    expect(relayInboxIds('{"events":{}}')).toEqual([]);
  });
});
