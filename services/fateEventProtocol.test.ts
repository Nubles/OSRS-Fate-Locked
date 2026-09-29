import { describe, expect, it } from 'vitest';
import { parseEventBatch, parseFateEvent } from './fateEventProtocol';
import { MAX_PASTED_EVENTS, RUNELITE_COPY_FORMAT, parsePastedEvents } from '../utils/runelitePaste';

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 1,
    eventId: 'evt-1',
    runId: 'run-1',
    account: 'Nubles',
    runRevision: 7,
    eventType: 'QUEST',
    canonicalLabel: 'Dragon Slayer',
    occurredAt: Date.now(),
    sessionSequence: 1,
    bundleVersion: 3,
    rulesVersion: '1',
    contentVersion: 1,
    detectorId: 'quest-widget-v1',
    detectorVersion: 1,
    confidence: 'EXACT',
    evidence: { widget: 153 },
    ...overrides,
  };
}

describe('Fate event protocol', () => {
  it('accepts a complete v1 event and rejects oversized evidence', () => {
    expect(parseFateEvent(validEvent())).toMatchObject({
      protocolVersion: 1,
      eventType: 'QUEST',
      canonicalLabel: 'Dragon Slayer',
    });
    expect(parseFateEvent(validEvent({
      evidence: { signature: 'x'.repeat(257) },
    }))).toBeNull();
  });

  it('caps a relay batch at 100 without throwing', () => {
    expect(parseEventBatch({
      events: Array.from({ length: 101 }, (_, index) =>
        validEvent({ eventId: `evt-${index}` })),
    })).toHaveLength(100);
  });

  it('rejects unsupported versions and non-primitive evidence', () => {
    expect(parseFateEvent(validEvent({ protocolVersion: 2 }))).toBeNull();
    expect(parseFateEvent(validEvent({ evidence: { nested: { value: 1 } } }))).toBeNull();
  });

  it('reads what RuneLite copied, up to 250 events, and says what it left out', () => {
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const copy = JSON.stringify({
      format: RUNELITE_COPY_FORMAT,
      events: [
        validEvent({ eventId: 'evt-1', canonicalLabel: null }),
        validEvent({ eventId: 'evt-2', occurredAt: old }),
        validEvent({ eventId: 'evt-3', occurredAt: old, detectorId: 7 }),
        validEvent({ eventId: 'evt-4', detectorId: 7 }),
        validEvent({ eventId: 'evt-5', occurredAt: '1000' }),
        'not an event',
      ],
    });

    const pasted = parsePastedEvents(`\n  ${copy}  \n`);

    expect(pasted?.events.map((event) => event.eventId)).toEqual(['evt-1']);
    expect(pasted?.tooOld).toBe(2);
    expect(pasted?.unreadable).toBe(3);
    expect(MAX_PASTED_EVENTS).toBe(250);
    const many = parsePastedEvents(JSON.stringify({
      format: RUNELITE_COPY_FORMAT,
      events: Array.from({ length: 252 }, (_, index) => validEvent({ eventId: `evt-${index}` })),
    }));
    expect(many?.events).toHaveLength(250);
    expect(many?.unreadable).toBe(2);
  });

  it('reads nothing that is not RuneLite’s copy', () => {
    for (const text of [
      '',
      'Copied 5 events',
      '[]',
      'null',
      '7',
      JSON.stringify({ events: [validEvent()] }),
      JSON.stringify({ format: 'something-else', events: [validEvent()] }),
      JSON.stringify({ format: RUNELITE_COPY_FORMAT, events: validEvent() }),
    ]) {
      expect(parsePastedEvents(text), text).toBeNull();
    }
  });

  it('rejects timestamps outside the accepted window', () => {
    expect(parseFateEvent(validEvent({
      occurredAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    }))).toBeNull();
    expect(parseFateEvent(validEvent({
      occurredAt: Date.now() + 6 * 60 * 1000,
    }))).toBeNull();
  });
});
