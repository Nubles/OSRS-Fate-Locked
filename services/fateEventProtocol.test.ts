import { describe, expect, it } from 'vitest';
import { parseEventBatch, parseFateEvent } from './fateEventProtocol';

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

  it('rejects timestamps outside the accepted window', () => {
    expect(parseFateEvent(validEvent({
      occurredAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    }))).toBeNull();
    expect(parseFateEvent(validEvent({
      occurredAt: Date.now() + 6 * 60 * 1000,
    }))).toBeNull();
  });
});
