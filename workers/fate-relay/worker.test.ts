import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import { FATE_EVENT_TYPES } from '../../services/fateEventProtocol';

class MemoryKv {
  records = new Map<string, string>();
  ttls = new Map<string, number | undefined>();
  puts: string[] = [];
  failNextPut = false;

  async get(key: string, options?: { type?: string }) {
    const value = this.records.get(key);
    if (value === undefined) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('simulated put failure');
    }
    this.records.set(key, value);
    this.ttls.set(key, options?.expirationTtl);
    this.puts.push(key);
  }
}

const sha256Hex = async (value: string) => [...new Uint8Array(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
)].map(byte => byte.toString(16).padStart(2, '0')).join('');

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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('refuses a declared oversized upload without reading its body', async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls > 320) controller.close();
        else controller.enqueue(new Uint8Array(64 * 1024));
      },
    });
    const response = await request('/r/ABCD', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(20 * 1024 * 1024) },
      body,
      duplex: 'half',
    } as RequestInit);

    expect(response.status).toBe(413);
    expect(pulls).toBeLessThanOrEqual(1);
  });

  it('stops reading an undeclared stream once it passes the limit', async () => {
    let sent = 0;
    const chunk = new Uint8Array(64 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.byteLength;
        if (sent > 20 * 1024 * 1024) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const response = await request('/r/ABCD', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      duplex: 'half',
    } as RequestInit);

    expect(response.status).toBe(413);
    expect(sent).toBeLessThan(1024 * 1024);
  });

  it('can retry safely after a KV write failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    kv.failNextPut = true;
    expect((await post('/r/ABCD/events', { events: [event('evt-1')] })).status).toBe(503);
    const retry = await post('/r/ABCD/events', { events: [event('evt-1')] });
    expect(await retry.json()).toMatchObject({ accepted: ['evt-1'], duplicates: [] });
  });

  it('answers a KV failure with a 503 that carries the CORS headers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    kv.get = async () => {
      throw new Error('simulated get failure');
    };
    const response = await request('/r/ABCD', { headers: { Origin: 'https://app.example.test' } });

    expect(response.status).toBe(503);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('ETag');
  });

  it('lets browsers cache preflights', async () => {
    const preflight = await request('/r/ABCD', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.test', 'Access-Control-Request-Method': 'POST' },
    });

    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(preflight.headers.get('Access-Control-Max-Age')).toBe('86400');
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
    expect((await post('/r/ABCD/acks', { token: eventToken, acknowledgements })).status).toBe(200);
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

  const ack = (eventId: string) => ({ eventId, state: 'COMPLETED', acknowledgedAt: Date.now() });
  const queued = async (code = 'ABCD') => (await get(`/r/${code}/events`)
    .then(response => response.json())).events.map((item: { eventId: string }) => item.eventId);

  it('does not let an acknowledgement from another token prune the events queue', async () => {
    await post('/r/ABCD/events', { events: [event('evt-1'), event('evt-2')] });
    // Anyone who knows the code can claim the unused /acks resource.
    const claim = await post('/r/ABCD/acks', { acknowledgements: [ack('evt-1')] });
    expect(claim.status).toBe(200);
    const { token } = await claim.json();
    expect((await post('/r/ABCD/acks', { token, acknowledgements: [ack('evt-2')] })).status).toBe(200);

    expect(await queued()).toEqual(['evt-1', 'evt-2']);
  });

  it('prunes acknowledged events for the token that owns the events queue', async () => {
    const { token } = await (await post('/r/ABCD/events', {
      events: [event('evt-1'), event('evt-2')],
    })).json();
    expect(kv.records.get('own:r:ABCD/events')?.startsWith(`${await sha256Hex(token)}:`)).toBe(true);

    expect((await post('/r/ABCD/acks', { token, acknowledgements: [ack('evt-1')] })).status).toBe(200);
    expect(await queued()).toEqual(['evt-2']);
  });

  it('prunes a queue written before owner records only for the token it holds', async () => {
    const legacyQueue = JSON.stringify({
      version: 3, token: 'legacy-events', records: [event('evt-1'), event('evt-2')],
    });
    kv.records.set('r:ABCD/events', legacyQueue);
    kv.records.set('r:WXYZ/events', legacyQueue);

    await post('/r/ABCD/acks', { token: 'someone-else', acknowledgements: [ack('evt-1')] });
    await post('/r/WXYZ/acks', { token: 'legacy-events', acknowledgements: [ack('evt-1')] });

    expect(await queued('ABCD')).toEqual(['evt-1', 'evt-2']);
    expect(await queued('WXYZ')).toEqual(['evt-2']);
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
});

describe('Fate relay code ownership', () => {
  let kv: MemoryKv;
  let env: { RELAY: MemoryKv };
  const CODE = '0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    kv = new MemoryKv();
    env = { RELAY: kv };
  });

  const publish = (body: unknown) => worker.fetch(new Request(`https://relay.test/r/${CODE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), env);
  const read = () => worker.fetch(new Request(`https://relay.test/r/${CODE}`), env);

  it('keeps a code claimed after its 24-hour data record expires', async () => {
    const { token } = await (await publish({ payload: 'owner v1' })).json();
    kv.records.delete(`r:${CODE}`); // the data record's TTL ran out

    expect((await publish({ payload: 'forged' })).status).toBe(403);
    expect((await publish({ token: 'guess', payload: 'forged' })).status).toBe(403);
    expect((await publish({ token, payload: 'owner v2' })).status).toBe(200);
    expect((await (await read()).json()).payload).toBe('owner v2');
  });

  it('stores only a hash of the write token, kept for 90 days', async () => {
    const { token } = await (await publish({ payload: 'v1' })).json();
    const owner = kv.records.get(`own:r:${CODE}`)!;

    expect(owner).not.toContain(token);
    expect(owner.startsWith(`${await sha256Hex(token)}:`)).toBe(true);
    expect(kv.ttls.get(`own:r:${CODE}`)).toBe(90 * 86_400);
    expect(kv.ttls.get(`r:${CODE}`)).toBe(86_400);
  });

  it('adopts a code published before owner records existed', async () => {
    kv.records.set(`r:${CODE}`, JSON.stringify({ version: 3, payload: 'old', token: 'legacy-token' }));

    expect((await publish({ token: 'someone-else', payload: 'forged' })).status).toBe(403);
    expect((await publish({ token: 'legacy-token', payload: 'new' })).status).toBe(200);
    expect(kv.records.get(`own:r:${CODE}`)?.startsWith(`${await sha256Hex('legacy-token')}:`)).toBe(true);
  });

  it('refreshes the owner record at most once a day', async () => {
    const { token } = await (await publish({ payload: 'v1' })).json();
    await publish({ token, payload: 'v2' });
    await publish({ token, payload: 'v3' });
    expect(kv.puts.filter(key => key === `own:r:${CODE}`)).toHaveLength(1);

    const [hash] = kv.records.get(`own:r:${CODE}`)!.split(':');
    kv.records.set(`own:r:${CODE}`, `${hash}:${Date.now() - 2 * 86_400_000}`);
    await publish({ token, payload: 'v4' });
    expect(kv.puts.filter(key => key === `own:r:${CODE}`)).toHaveLength(2);
  });

  it('still returns the new token when recording the owner fails', async () => {
    const put = kv.put.bind(kv);
    kv.put = async (key, value, options) => {
      if (key.startsWith('own:')) throw new Error('owner write failed');
      return put(key, value, options);
    };
    const response = await publish({ payload: 'v1' });

    expect(response.status).toBe(200);
    const { token } = await response.json();
    expect((await publish({ token, payload: 'v2' })).status).toBe(200);
  });
});

describe('Fate relay versions', () => {
  let kv: MemoryKv;
  let env: { RELAY: MemoryKv };
  const CODE = '0123456789abcdef0123456789abcdef';
  const DAY_MS = 86_400_000;

  beforeEach(() => {
    kv = new MemoryKv();
    env = { RELAY: kv };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const post = (path: string, body: unknown) => worker.fetch(new Request(`https://relay.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), env);
  const get = (path: string, etag?: string) => worker.fetch(new Request(
    `https://relay.test${path}`,
    etag ? { headers: { 'If-None-Match': etag } } : undefined,
  ), env);

  /**
   * What RuneLite's TrackerConnectionController imports: an ETag that is a
   * positive decimal Java int, equals the body's version, and is above the
   * version the plugin already holds.
   */
  const expectImportable = async (response: Response, held: number) => {
    expect(response.status).toBe(200);
    const body = await response.json();
    const etag = response.headers.get('ETag');
    expect(etag).toMatch(/^[1-9][0-9]*$/);
    expect(Number(etag)).toBe(body.version);
    expect(body.version).toBeLessThanOrEqual(2_147_483_647);
    expect(body.version).toBeGreaterThan(held);
    return body;
  };

  it('serves a republish after the record expires as new, never 304 for an old ETag', async () => {
    const { token } = await (await post(`/r/${CODE}`, { payload: 'v1' })).json();
    await post(`/r/${CODE}`, { token, payload: 'v2' });
    const held = await get(`/r/${CODE}`);
    const heldEtag = held.headers.get('ETag')!;
    expect(heldEtag).toBe(String((await held.json()).version));

    vi.setSystemTime(Date.now() + DAY_MS + 1_000);
    kv.records.delete(`r:${CODE}`); // the 24-hour profile record expired
    await post(`/r/${CODE}`, { token, payload: 'v3' });
    await post(`/r/${CODE}`, { token, payload: 'v4' });

    const body = await expectImportable(await get(`/r/${CODE}`, heldEtag), Number(heldEtag));
    expect(body.payload).toBe('v4');
  });

  it('outranks the counter versions clients hold from before this rule', async () => {
    // A client can hold a large counter version for a code whose record then
    // expired; the first publish afterwards must still read as newer.
    const { token } = await (await post(`/r/${CODE}`, { payload: 'v1' })).json();
    kv.records.delete(`r:${CODE}`);
    await post(`/r/${CODE}`, { token, payload: 'v2' });

    await expectImportable(await get(`/r/${CODE}`, '1000000'), 1_000_000);
  });

  it('keeps versions distinct for writes within the same second', async () => {
    const { token, version: first } = await (await post(`/r/${CODE}`, { payload: 'v1' })).json();
    const { version: second } = await (await post(`/r/${CODE}`, { token, payload: 'v2' })).json();

    expect(second).toBeGreaterThan(first);
    await expectImportable(await get(`/r/${CODE}`, String(first)), first);
  });

  it.each([
    ['/events', { events: [event('evt-1')] }, { events: [event('evt-2')] }, { events: [event('evt-3')] }],
    ['/acks',
      { acknowledgements: [{ eventId: 'evt-1', state: 'COMPLETED', acknowledgedAt: 1 }] },
      { acknowledgements: [{ eventId: 'evt-2', state: 'COMPLETED', acknowledgedAt: 2 }] },
      { acknowledgements: [{ eventId: 'evt-3', state: 'COMPLETED', acknowledgedAt: 3 }] }],
  ])('keeps %s versions rising after its record expires', async (resource, first, second, third) => {
    const path = `/r/${CODE}${resource}`;
    const { token } = await (await post(path, first)).json();
    await post(path, { token, ...second });
    const heldEtag = (await get(path)).headers.get('ETag')!;

    vi.setSystemTime(Date.now() + 7 * DAY_MS + 1_000);
    kv.records.delete(`r:${CODE}${resource}`); // the seven-day record expired
    await post(path, { token, ...third });

    await expectImportable(await get(path, heldEtag), Number(heldEtag));
  });

  it('versions the events queue an acknowledgement prunes by the same rule', async () => {
    const events = `/r/${CODE}/events`;
    const { token } = await (await post(events, { events: [event('evt-1')] })).json();
    await post(events, { token, events: [event('evt-2')] });
    const heldEtag = (await get(events)).headers.get('ETag')!;

    vi.setSystemTime(Date.now() + 7 * DAY_MS + 1_000);
    kv.records.delete(`r:${CODE}/events`);
    await post(events, { token, events: [event('evt-3')] });
    vi.setSystemTime(Date.now() + 1_000);
    expect((await post(`/r/${CODE}/acks`, {
      token,
      acknowledgements: [{ eventId: 'evt-3', state: 'COMPLETED', acknowledgedAt: Date.now() }],
    })).status).toBe(200);

    const body = await expectImportable(await get(events, heldEtag), Number(heldEtag));
    expect(body.events).toEqual([]);
  });
});

describe('Fate relay conditional GET', () => {
  let env: { RELAY: MemoryKv };
  const CODE = '0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    const kv = new MemoryKv();
    kv.records.set(`r:${CODE}`, JSON.stringify({ version: 41, payload: 'FLGZ:rules-41', token: 'owner-token' }));
    env = { RELAY: kv };
  });

  const get = (ifNoneMatch: string) => worker.fetch(new Request(`https://relay.test/r/${CODE}`, {
    headers: { 'If-None-Match': ifNoneMatch },
  }), env);

  it.each([
    ['bare', '41'],
    ['quoted', '"41"'],
    ['weak', 'W/"41"'],
  ])('answers a %s validator for the stored version with 304 and the bare ETag', async (_kind, validator) => {
    const response = await get(validator);

    expect(response.status).toBe(304);
    expect(response.headers.get('ETag')).toBe('41');
    expect(await response.text()).toBe('');
  });

  it.each([
    ['a quoted validator for another version', '"40"'],
    ['a weak validator for another version', 'W/"40"'],
    ['a list of validators', '"40", "41"'],
    ['a wildcard', '*'],
    ['an unclosed quote', '"41'],
    ['a stray quote', '41"'],
  ])('answers %s in full', async (_kind, validator) => {
    const response = await get(validator);

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe('41');
    expect(await response.json()).toEqual({ version: 41, payload: 'FLGZ:rules-41' });
  });
});

describe('Fate relay codes the owner marked gone', () => {
  let kv: MemoryKv;
  let env: { RELAY: MemoryKv };
  const CODE = '0123456789abcdef0123456789abcdef';
  const PROFILE = `/r/${CODE}`;
  const PAYLOAD = 'FLGZ:rules linked to Nubles';

  beforeEach(() => {
    kv = new MemoryKv();
    env = { RELAY: kv };
  });

  const post = (path: string, body: unknown) => worker.fetch(new Request(`https://relay.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), env);
  const get = (path: string, etag?: string) => worker.fetch(new Request(
    `https://relay.test${path}`,
    etag ? { headers: { 'If-None-Match': etag } } : undefined,
  ), env);
  const publishProfile = async (): Promise<{ token: string; version: number }> =>
    (await post(PROFILE, { payload: PAYLOAD })).json();

  it('replaces the profile with a 90-day tombstone for the owner, without a payload', async () => {
    const { token, version: published } = await publishProfile();
    const response = await post(PROFILE, { token, gone: true });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ version: expect.any(Number), gone: true });
    expect(body.version).toBeGreaterThan(published);
    expect(JSON.parse(kv.records.get(`r:${CODE}`)!)).toEqual({ gone: true, version: body.version, token });
    expect(kv.ttls.get(`r:${CODE}`)).toBe(90 * 86_400);
  });

  it('refreshes an old owner record, as a publish does', async () => {
    const { token } = await publishProfile();
    const [hash] = kv.records.get(`own:r:${CODE}`)!.split(':');
    kv.records.set(`own:r:${CODE}`, `${hash}:${Date.now() - 2 * 86_400_000}`);
    kv.puts.length = 0;

    expect((await post(PROFILE, { token, gone: true })).status).toBe(200);
    expect(kv.puts).toEqual([`r:${CODE}`, `own:r:${CODE}`]);
    expect(kv.records.get(`own:r:${CODE}`)!.startsWith(`${hash}:`)).toBe(true);
    expect(kv.ttls.get(`own:r:${CODE}`)).toBe(90 * 86_400);
  });

  it('refuses a wrong or missing token and keeps serving the profile', async () => {
    await publishProfile();

    expect((await post(PROFILE, { token: 'guess', gone: true })).status).toBe(403);
    expect((await post(PROFILE, { gone: true })).status).toBe(403);
    const response = await get(PROFILE);
    expect(response.status).toBe(200);
    expect((await response.json()).payload).toBe(PAYLOAD);
  });

  it('answers 404 {"gone":true} after, whatever the validator, never the profile', async () => {
    const { token, version: published } = await publishProfile();
    const { version: gone } = await (await post(PROFILE, { token, gone: true })).json();

    for (const etag of [undefined, String(published), String(gone)]) {
      const response = await get(PROFILE, etag);
      expect(response.status, `If-None-Match: ${etag}`).toBe(404);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('ETag')).toBeNull();
      const text = await response.text();
      expect(text).toBe('{"gone":true}');
      expect(text).not.toContain('Nubles');
      expect(text).not.toContain(token);
    }
  });

  it('serves the profile again once the owner publishes after marking it gone', async () => {
    const { token } = await publishProfile();
    const { version: gone } = await (await post(PROFILE, { token, gone: true })).json();

    expect((await post(PROFILE, { payload: 'forged' })).status).toBe(403);
    const republished = await post(PROFILE, { token, payload: 'FLGZ:rules again' });
    expect(republished.status).toBe(200);
    const { version } = await republished.json();
    expect(version).toBeGreaterThan(gone);
    expect(kv.ttls.get(`r:${CODE}`)).toBe(86_400);
    const response = await get(PROFILE);
    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe(String(version));
    expect(await response.json()).toEqual({ version, payload: 'FLGZ:rules again' });
  });

  it.each([
    ['/events', { events: [event('evt-1')] }],
    ['/acks', { acknowledgements: [{ eventId: 'evt-1', state: 'COMPLETED', acknowledgedAt: 1 }] }],
    ['/state', { payload: 'legacy state' }],
    ['/suggest', { payload: 'legacy suggestion' }],
  ])('leaves %s as before: only the profile resource can be marked gone', async (resource, first) => {
    const path = `${PROFILE}${resource}`;
    const { token } = await (await post(path, first)).json();
    const stored = kv.records.get(`r:${CODE}${resource}`);

    expect((await post(path, { token, gone: true })).status).toBe(400);
    expect(kv.records.get(`r:${CODE}${resource}`)).toBe(stored);
    expect((await get(path)).status).toBe(200);
  });
});
