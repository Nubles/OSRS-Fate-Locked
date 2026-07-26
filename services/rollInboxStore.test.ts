import { describe, expect, it } from 'vitest';
import type { FateEventEnvelope } from './fateEventProtocol';
import { createRollInboxStore } from './rollInboxStore';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const event = (eventId: string): FateEventEnvelope => ({
  protocolVersion: 1,
  eventId,
  runId: 'run-1',
  account: 'Nubles',
  runRevision: 1,
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
  evidence: {},
});

describe('Roll Inbox store', () => {
  it('does not resurrect a completed event after reload or redelivery', () => {
    const storage = new MemoryStorage();
    const store = createRollInboxStore(storage, 'run-1');
    store.ingest([event('evt-1')]);
    store.transition('evt-1', 'COMPLETED');

    const restarted = createRollInboxStore(storage, 'run-1');
    restarted.ingest([event('evt-1')]);

    expect(restarted.list()[0].state).toBe('COMPLETED');
  });

  it('sorts occurrences deterministically and notifies subscribers', () => {
    const storage = new MemoryStorage();
    const store = createRollInboxStore(storage, 'run-1');
    let notifications = 0;
    store.subscribe(() => { notifications += 1; });
    store.ingest([
      { ...event('evt-2'), occurredAt: 20, sessionSequence: 2 },
      { ...event('evt-1'), occurredAt: 10, sessionSequence: 1 },
    ]);

    expect(store.list().map(row => row.event.eventId)).toEqual(['evt-1', 'evt-2']);
    expect(notifications).toBe(1);
  });
});
