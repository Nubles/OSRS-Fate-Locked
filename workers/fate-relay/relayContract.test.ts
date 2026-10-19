/**
 * The relay's side of its contract with the RuneLite plugin: every reply
 * contracts/relay/relay-get.json says the worker gives, it gives. The plugin
 * copies the same file and checks it reads each reply, including the ones a
 * proxy or the network can hand it instead, as the case's outcome.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import { resetBadgeCache } from './badges.js';
import relayGet from '../../contracts/relay/relay-get.json';

/** A published profile, or the tombstone the owner's Disconnect leaves. */
type StoredRecord = { version: number; payload: string } | { gone: true; version: number };

interface RelayCase {
  name: string;
  from: 'worker' | 'network' | 'transport';
  held: string | null;
  stored?: StoredRecord | 'fails' | null;
  request?: { ifNoneMatch: string | null };
  response?: { status: number; headers: Record<string, string>; body: string | null };
  transport?: string;
  outcome: string;
}

interface RelayFixture {
  schema: number;
  outcomes: Record<string, string>;
  code: string;
  cases: RelayCase[];
}

const fixture = relayGet as unknown as RelayFixture;

/**
 * Holds one stored record, a profile or a tombstone, each with the owner's
 * write token as the worker keeps it; or fails every read like a KV outage.
 * A GET never writes.
 */
class FixtureKv {
  constructor(
    private readonly key: string,
    private readonly stored: RelayCase['stored'],
  ) {}

  async get(key: string, options?: { type?: string }) {
    if (this.stored === 'fails') throw new Error('simulated KV outage');
    if (key !== this.key || !this.stored) return null;
    const record: StoredRecord & { token: string } = { ...this.stored, token: 'owner-token' };
    const value = JSON.stringify(record);
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async put(): Promise<void> {
    throw new Error('a GET must not write');
  }
}

describe('relay GET contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const workerCases = fixture.cases.filter((relayCase) => relayCase.from === 'worker');

  it('names an outcome for every case and uses every outcome', () => {
    const used = new Set(fixture.cases.map((relayCase) => relayCase.outcome));
    for (const relayCase of fixture.cases) {
      expect(fixture.outcomes[relayCase.outcome], relayCase.name).toBeDefined();
    }
    expect([...used].sort()).toEqual(Object.keys(fixture.outcomes).sort());
    expect(workerCases.length).toBeGreaterThan(0);
  });

  for (const relayCase of workerCases) {
    it(`gives ${relayCase.name}`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const env = { RELAY: new FixtureKv(`r:${fixture.code}`, relayCase.stored) };
      const ifNoneMatch = relayCase.request?.ifNoneMatch;
      const response = await worker.fetch(new Request(`https://relay.test/r/${fixture.code}`, {
        headers: ifNoneMatch == null ? {} : { 'If-None-Match': ifNoneMatch },
      }), env);

      const expected = relayCase.response!;
      expect(response.status).toBe(expected.status);
      for (const [name, value] of Object.entries(expected.headers)) {
        expect(response.headers.get(name), name).toBe(value);
      }
      const body = response.status === 304 ? null : await response.text();
      // The owner's write token never leaves the relay.
      expect(body ?? '').not.toContain('owner-token');
      expect(body).toBe(expected.body);
    });
  }
});

/** A KV that keeps what it is given, with metadata and list(), as the routes below use it. */
class ContractKv {
  values = new Map<string, string>();
  metadata = new Map<string, unknown>();

  async get(key: string, options?: { type?: string }) {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async put(key: string, value: string, options?: { metadata?: unknown }) {
    this.values.set(key, value);
    if (options?.metadata !== undefined) this.metadata.set(key, options.metadata);
  }

  async delete(key: string) {
    this.values.delete(key);
    this.metadata.delete(key);
  }

  async list({ prefix = '' }: { prefix?: string } = {}) {
    const keys = [...this.values.keys()].filter(name => name.startsWith(prefix)).sort()
      .map(name => ({ name, metadata: this.metadata.get(name) }));
    return { keys, list_complete: true };
  }
}

/**
 * The replies the plugin's Send to tracker and badges, and the tracker's
 * Roll Inbox, are built against, exactly as this round's contract states
 * them: routes, statuses, bodies and headers.
 */
describe('relay contract for Send to tracker and badges', () => {
  const code = fixture.code;
  let env: { RELAY: ContractKv };
  const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    worker.fetch(new Request(`https://fate-relay.test${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), env);
  const reply = async (response: Response) => ({ status: response.status, body: await response.text() });
  const event = { eventId: 'evt-1', occurredAt: Date.now() - 60_000, eventType: 'QUEST', canonicalLabel: 'Cook’s Assistant' };

  beforeEach(() => {
    resetBadgeCache();
    env = { RELAY: new ContractKv() };
  });

  afterEach(() => {
    resetBadgeCache();
  });

  it('answers a code with no profile 404 {"error":"no profile"}', async () => {
    expect(await reply(await call('POST', `/r/${code}/inbox`, { format: 'fate-locked-runelite-events', events: [event] })))
      .toEqual({ status: 404, body: '{"error":"no profile"}' });
    expect(await reply(await call('POST', `/r/${code}/badge`, { name: 'Player One', tier: 2 })))
      .toEqual({ status: 404, body: '{"error":"no profile"}' });
  });

  it('holds a send for the tracker, which reads it with its token and empties it', async () => {
    const { token } = await (await call('POST', `/r/${code}`, { payload: '{"version":4}' })).json();
    const auth = { Authorization: `Bearer ${token}` };

    expect(await reply(await call('POST', `/r/${code}/inbox`, { format: 'fate-locked-runelite-events', events: [event] })))
      .toEqual({ status: 200, body: '{"accepted":1,"held":1}' });

    const read = await call('GET', `/r/${code}/inbox`, undefined, auth);
    expect(read.headers.get('Cache-Control')).toBe('no-store');
    expect(await reply(read)).toEqual({
      status: 200,
      body: JSON.stringify({ format: 'fate-locked-runelite-events', events: [event] }),
    });
    expect((await call('GET', `/r/${code}/inbox`, undefined, { Authorization: 'Bearer not-the-owner' })).status).toBe(403);

    expect(await reply(await call('POST', `/r/${code}/inbox/ack`, { ids: ['evt-1'] }, auth)))
      .toEqual({ status: 200, body: '{"held":0}' });
    expect(await reply(await call('GET', `/r/${code}/inbox`, undefined, auth)))
      .toEqual({ status: 200, body: '{"format":"fate-locked-runelite-events","events":[]}' });
  });

  it('lists a badge publicly until it is removed', async () => {
    await call('POST', `/r/${code}`, { payload: '{"version":4}' });
    expect(await reply(await call('POST', `/r/${code}/badge`, { name: 'Player One', tier: 2 })))
      .toEqual({ status: 200, body: '{"ok":true}' });

    const listed = await call('GET', '/badges');
    expect(listed.headers.get('Cache-Control')).toBe('public, max-age=600');
    const etag = listed.headers.get('ETag');
    expect(etag).toBeTruthy();
    expect(await reply(listed)).toEqual({ status: 200, body: '{"badges":[{"n":"Player One","t":2}]}' });
    expect((await call('GET', '/badges', undefined, { 'If-None-Match': etag! })).status).toBe(304);

    expect(await reply(await call('DELETE', `/r/${code}/badge`)))
      .toEqual({ status: 200, body: '{"deleted":true}' });
    resetBadgeCache(); // a new isolate, or 10 minutes later
    expect(await reply(await call('GET', '/badges'))).toEqual({ status: 200, body: '{"badges":[]}' });
  });
});
