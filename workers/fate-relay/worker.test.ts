import { beforeEach, describe, expect, it } from 'vitest';
import worker from './worker.js';

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

const event = (eventId: string) => ({
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
});
