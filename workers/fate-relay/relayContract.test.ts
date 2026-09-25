/**
 * The relay's side of its contract with the RuneLite plugin: every reply
 * contracts/relay/relay-get.json says the worker gives, it gives. The plugin
 * copies the same file and checks it reads each reply, including the ones a
 * proxy or the network can hand it instead, as the case's outcome.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import relayGet from '../../contracts/relay/relay-get.json';

interface RelayCase {
  name: string;
  from: 'worker' | 'network' | 'transport';
  held: string | null;
  stored?: { version: number; payload: string } | 'fails' | null;
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

/** Holds one stored record, or fails every read like a KV outage. A GET never writes. */
class FixtureKv {
  constructor(
    private readonly key: string,
    private readonly stored: RelayCase['stored'],
  ) {}

  async get(key: string, options?: { type?: string }) {
    if (this.stored === 'fails') throw new Error('simulated KV outage');
    if (key !== this.key || !this.stored) return null;
    const value = JSON.stringify({ ...this.stored, token: 'owner-token' });
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
