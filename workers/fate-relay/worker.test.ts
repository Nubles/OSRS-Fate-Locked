import { beforeEach, describe, expect, it } from 'vitest';
import worker from './worker.js';
import { FATE_EVENT_TYPES } from '../../services/fateEventProtocol';

class MemoryKv {
  records = new Map<string, string>();
  failNextPut = false;

  async get(key: string, options?: { type?: string }) {
    const value = this.records.get(key);
    if (value === undefined) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async put(key: string, value: string) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('simulated put failure');
    }
    this.records.set(key, value);
  }
}

const event = (eventId: string, overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

describe('Fate relay event resources', () => {
  let kv: MemoryKv;
  let env: { RELAY: MemoryKv };

  beforeEach(() => {
    kv = new MemoryKv();
    env = { RELAY: kv };
  });

  const request = (path: string, init?: RequestInit) =>
    worker.fetch(new Request(`https://relay.test${path}`, init), env);
  const post = (path: string, body: unknown) =>
    request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const get = (path: string) => request(path);

  it('appends once and reports a retry as duplicate', async () => {
    const first = await post('/r/ABCD/events', { events: [event('evt-1')] });
    const firstBody = await first.json();
    const retry = await post('/r/ABCD/events', {
      token: firstBody.token,
      events: [event('evt-1')],
    });

    expect(await retry.json()).toMatchObject({
      accepted: [],
      duplicates: ['evt-1'],
    });
    expect((await get('/r/ABCD/events').then(response => response.json())).events)
      .toHaveLength(1);
  });

  it('isolates tokens and pairing codes', async () => {
    await post('/r/ABCD/events', { events: [event('evt-1')] });
    expect((await post('/r/ABCD/events', {
      token: 'wrong',
      events: [event('evt-2')],
    })).status).toBe(403);
    expect((await get('/r/WXYZ/events')).status).toBe(404);
  });

  it('deduplicates acknowledgements while preserving first-seen order', async () => {
    const first = await post('/r/ABCD/acks', {
      acknowledgements: [
        { eventId: 'evt-2', state: 'DISMISSED', acknowledgedAt: Date.now() },
        { eventId: 'evt-1', state: 'COMPLETED', acknowledgedAt: Date.now() },
      ],
    });
    const token = (await first.json()).token;
    const retry = await post('/r/ABCD/acks', {
      token,
      acknowledgements: [
        { eventId: 'evt-1', state: 'COMPLETED', acknowledgedAt: Date.now() },
      ],
    });

    expect((await retry.json()).duplicates).toEqual(['evt-1']);
    const body = await get('/r/ABCD/acks').then(response => response.json());
    expect(body.acknowledgements.map((ack: { eventId: string }) => ack.eventId))
      .toEqual(['evt-2', 'evt-1']);
  });

  it('rejects invalid and oversized structured requests', async () => {
    expect((await post('/r/ABCD/events', { events: [{ nope: true }] })).status).toBe(400);
    expect((await post('/r/ABCD/events', {
      events: [event('evt-1')],
      padding: 'x'.repeat(256 * 1024),
    })).status).toBe(413);
  });

  it('can retry safely after a KV write failure', async () => {
    kv.failNextPut = true;
    await expect(post('/r/ABCD/events', { events: [event('evt-1')] }))
      .rejects.toThrow('simulated put failure');
    const retry = await post('/r/ABCD/events', { events: [event('evt-1')] });
    expect(await retry.json()).toMatchObject({ accepted: ['evt-1'], duplicates: [] });
  });

  it.each(FATE_EVENT_TYPES)('accepts supported event type %s', async (eventType) => {
    const response = await post('/r/ABCD/events', {
      events: [event(`evt-${eventType}`, { eventType })],
    });

    expect(response.status).toBe(200);
    expect((await response.json()).accepted).toEqual([`evt-${eventType}`]);
  });

  it('preserves a full unacknowledged queue, reports retryable capacity, and accepts new events after ack pruning', async () => {
    const initial = Array.from({ length: 100 }, (_, index) => event(`evt-${index}`));
    const first = await post('/r/ABCD/events', { events: initial });
    const eventToken = (await first.json()).token;

    const full = await post('/r/ABCD/events', {
      token: eventToken,
      events: [event('evt-100')],
    });
    expect(full.status).toBe(429);
    expect(await full.json()).toMatchObject({ capacity: ['evt-100'] });
    expect((await get('/r/ABCD/events').then(response => response.json())).events)
      .toHaveLength(100);

    const acknowledgements = Array.from({ length: 50 }, (_, index) => ({
      eventId: `evt-${index}`,
      state: 'COMPLETED',
      acknowledgedAt: Date.now() + index,
    }));
    expect((await post('/r/ABCD/acks', { acknowledgements })).status).toBe(200);
    expect((await get('/r/ABCD/events').then(response => response.json())).events
      .map((item: { eventId: string }) => item.eventId))
      .toEqual(Array.from({ length: 50 }, (_, index) => `evt-${index + 50}`));

    const refill = Array.from({ length: 50 }, (_, index) => event(`evt-${index + 100}`));
    const retry = await post('/r/ABCD/events', { token: eventToken, events: refill });
    expect(retry.status).toBe(200);
    expect((await retry.json()).accepted).toHaveLength(50);
    expect((await get('/r/ABCD/events').then(response => response.json())).events
      .map((item: { eventId: string }) => item.eventId))
      .toEqual(Array.from({ length: 100 }, (_, index) => `evt-${index + 50}`));
  });

  it('retains the newest 100 server receipts after compaction', async () => {
    const acknowledgement = (index: number) => ({
      eventId: `evt-${index}`,
      state: 'COMPLETED',
      acknowledgedAt: 1_000 + index,
    });
    const first = await post('/r/ABCD/acks', {
      acknowledgements: Array.from({ length: 100 }, (_, index) => acknowledgement(index)),
    });
    const token = (await first.json()).token;
    expect((await post('/r/ABCD/acks', {
      token,
      acknowledgements: Array.from({ length: 5 }, (_, index) => acknowledgement(index + 100)),
    })).status).toBe(200);

    const retained = await get('/r/ABCD/acks').then(response => response.json());
    expect(retained.acknowledgements.map((ack: { eventId: string }) => ack.eventId))
      .toEqual(Array.from({ length: 100 }, (_, index) => `evt-${index + 5}`));

    expect((await post('/r/ABCD/acks', {
      token,
      acknowledgements: Array.from({ length: 5 }, (_, index) => acknowledgement(index)),
    })).status).toBe(200);
    const afterOldRetry = await get('/r/ABCD/acks').then(response => response.json());
    expect(afterOldRetry.acknowledgements.map((ack: { eventId: string }) => ack.eventId))
      .toEqual([
        ...Array.from({ length: 95 }, (_, index) => `evt-${index + 10}`),
        ...Array.from({ length: 5 }, (_, index) => `evt-${index}`),
      ]);
  });

  it('rotates every retried acknowledgement into the observable window after offline compaction', async () => {
    const acknowledgement = (index: number) => ({
      eventId: `evt-${index}`,
      state: 'COMPLETED',
      acknowledgedAt: 1_000 + index,
    });
    const batches = [
      Array.from({ length: 100 }, (_, index) => acknowledgement(index)),
      Array.from({ length: 100 }, (_, index) => acknowledgement(index + 100)),
      Array.from({ length: 5 }, (_, index) => acknowledgement(index + 200)),
    ];
    let token: string | undefined;

    for (const acknowledgements of batches) {
      expect(acknowledgements.length).toBeLessThanOrEqual(100);
      const response = await post('/r/ABCD/acks', { token, acknowledgements });
      token = (await response.json()).token;
    }

    const observable = new Set<string>();
    for (let cycle = 0; cycle < 2; cycle += 1) {
      for (const acknowledgements of batches) {
        const response = await post('/r/ABCD/acks', { token, acknowledgements });
        token = (await response.json()).token;
        const visible = await get('/r/ABCD/acks').then(result => result.json());
        expect(visible.acknowledgements).toHaveLength(100);
        for (const ack of visible.acknowledgements) observable.add(ack.eventId);
      }
    }

    expect(observable.size).toBe(205);
    expect(Array.from({ length: 205 }, (_, index) => `evt-${index}`)
      .every(eventId => observable.has(eventId))).toBe(true);
  });
});
