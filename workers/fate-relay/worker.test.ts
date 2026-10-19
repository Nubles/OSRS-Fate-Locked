import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import { MAX_BACKUP_BYTES } from './protocol.js';
import { resetErrorDedupe } from './errors.js';
import { resetBadgeCache } from './badges.js';

class MemoryKv {
  records = new Map<string, string>();
  ttls = new Map<string, number | undefined>();
  metadata = new Map<string, unknown>();
  puts: string[] = [];
  failNextPut = false;

  async get(key: string, options?: { type?: string }) {
    const value = this.records.get(key);
    if (value === undefined) return null;
    if (options?.type === 'arrayBuffer') return new TextEncoder().encode(value).buffer;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async getWithMetadata(key: string, options?: { type?: string }) {
    const value = this.records.get(key);
    if (value === undefined) return { value: null, metadata: null };
    return {
      value: options?.type === 'stream' ? new Response(value).body : value,
      metadata: this.metadata.get(key) ?? null,
    };
  }

  async put(key: string, value: string | Uint8Array | ArrayBuffer, options?: { expirationTtl?: number; metadata?: unknown }) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('simulated put failure');
    }
    this.records.set(key, typeof value === 'string' ? value : new TextDecoder().decode(value));
    this.ttls.set(key, options?.expirationTtl);
    if (options?.metadata !== undefined) this.metadata.set(key, options.metadata);
    this.puts.push(key);
  }

  async delete(key: string) {
    this.records.delete(key);
    this.metadata.delete(key);
  }

  lists = 0;

  /** KV list(): keys in name order with their metadata, a page at a time. */
  async list({ prefix = '', limit = 1000, cursor }: { prefix?: string; limit?: number; cursor?: string } = {}) {
    this.lists += 1;
    const names = [...this.records.keys()].filter(name => name.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = names.slice(start, start + limit);
    const complete = start + limit >= names.length;
    return {
      keys: page.map(name => ({ name, metadata: this.metadata.get(name) })),
      list_complete: complete,
      ...(complete ? {} : { cursor: String(start + limit) }),
    };
  }
}

const sha256Hex = async (value: string) => [...new Uint8Array(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
)].map(byte => byte.toString(16).padStart(2, '0')).join('');

const CODE = '0123456789abcdef0123456789abcdef';
/** A profile as the app publishes it: "FLGZ:" and base64 gzip (which always starts H4sI). */
const flgz = (label: string) => `FLGZ:${btoa(String.fromCharCode(0x1f, 0x8b, 0x08) + label)}`;

/** A KV that fails the test if anything reads or writes it. */
const untouchableKv = () => {
  const touch = () => {
    throw new Error('the relay touched KV');
  };
  return { get: touch, getWithMetadata: touch, put: touch, delete: touch, list: touch };
};

describe('Fate relay profile requests', () => {
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

  it('keeps a published profile for 30 days after the last publish', async () => {
    const response = await post(`/r/${CODE}`, { payload: flgz('v1') });
    expect(response.status).toBe(200);
    expect(kv.ttls.get(`r:${CODE}`)).toBe(30 * 86_400);
    const { token } = await response.json();
    await post(`/r/${CODE}`, { token, payload: flgz('v2') });
    expect(kv.ttls.get(`r:${CODE}`)).toBe(30 * 86_400);
  });

  it('accepts a profile as plain JSON, the fallback for a browser that cannot compress', async () => {
    const response = await post(`/r/${CODE}`, { payload: '{"version":4,"chunks":{}}' });
    expect(response.status).toBe(200);
  });

  it.each([
    ['a word', 'hello'],
    ['FLGZ: without gzip', `FLGZ:${btoa('not gzip at all')}`],
    ['FLGZ: with characters outside base64', 'FLGZ:H4sI@@@@'],
    ['FLGZ: of a length base64 never has', 'FLGZ:H4sIA'],
    ['a JSON array', '[1,2,3]'],
    ['broken JSON', '{"version":'],
    ['a number', 42],
  ])('refuses %s as a profile, before touching KV', async (_kind, payload) => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await post(`/r/${CODE}`, { payload })).status).toBe(400);
  });

  it('refuses a body that is not an object, or a token that is not one', async () => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await post(`/r/${CODE}`, [flgz('v1')])).status).toBe(400);
    expect((await post(`/r/${CODE}`, null)).status).toBe(400);
    expect((await post(`/r/${CODE}`, { token: { nested: true }, payload: flgz('v1') })).status).toBe(400);
    expect((await post(`/r/${CODE}`, { token: 'x'.repeat(200), payload: flgz('v1') })).status).toBe(400);
    expect((await post(`/r/${CODE}`, { token: 'has spaces', gone: true })).status).toBe(400);
  });

  it('refuses a request that is too large', async () => {
    expect((await post(`/r/${CODE}`, {
      payload: flgz('v1'),
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
    const response = await request(`/r/${CODE}`, {
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
    const response = await request(`/r/${CODE}`, {
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
    expect((await post(`/r/${CODE}`, { payload: flgz('v1') })).status).toBe(503);
    const retry = await post(`/r/${CODE}`, { payload: flgz('v1') });
    expect(retry.status).toBe(200);
  });

  it('answers a KV failure with a 503 that carries the CORS headers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    kv.get = async () => {
      throw new Error('simulated get failure');
    };
    const response = await request(`/r/${CODE}`, { headers: { Origin: 'https://app.example.test' } });

    expect(response.status).toBe(503);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('ETag, X-Backup-Updated-At');
  });

  it('lets browsers cache preflights', async () => {
    const preflight = await request(`/r/${CODE}`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.test', 'Access-Control-Request-Method': 'POST' },
    });

    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(preflight.headers.get('Access-Control-Max-Age')).toBe('86400');
  });
});

describe('Fate relay route ids', () => {
  const env = { RELAY: untouchableKv() };
  const call = (method: string, path: string) => worker.fetch(new Request(`https://relay.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${'T'.repeat(43)}` },
    ...(method === 'POST' ? { body: JSON.stringify({ payload: flgz('v1') }) } : {}),
  }), env);

  it.each([
    ['a short code', '/r/ABCD'],
    ['an upper-case code', `/r/${CODE.toUpperCase()}`],
    ['a code with dashes', '/r/01234567-89ab-cdef-0123-456789abcdef'],
    ['a 33-digit code', `/r/${CODE}0`],
    ['an empty code', '/r/'],
    ['a short backup id', '/b/too-short'],
    ['a backup id with a last symbol base64url never ends 32 bytes on', `/b/${'A'.repeat(42)}B`],
    ['a backup id of the wrong length', `/b/${'A'.repeat(44)}`],
    ['a previous copy of a bad backup id', '/b/too-short/previous'],
    ['a short run id', '/p/short'],
    ['a run id with a last symbol base64url never ends 16 bytes on', `/p/${'A'.repeat(21)}B`],
    ['a link code for a bad run id', '/p/short/link-code'],
    ['a Discord id that is not a snowflake', '/l/not-a-user'],
  ])('answers 400 to %s, before touching KV', async (_kind, path) => {
    for (const method of ['GET', 'POST', 'DELETE']) {
      expect((await call(method, path)).status, `${method} ${path}`).toBe(400);
    }
  });

  it.each(['/state', '/events', '/acks', '/suggest'])(
    'no longer has the legacy %s resource',
    async (resource) => {
      for (const method of ['GET', 'POST']) {
        expect((await call(method, `/r/${CODE}${resource}`)).status).toBe(404);
      }
    },
  );

  it('answers 404 to a path it does not know', async () => {
    expect((await call('GET', '/')).status).toBe(404);
    expect((await call('POST', '/x/1')).status).toBe(404);
  });
});

/** A rate limiter binding that allows `limit` calls per key, recording each key it sees. */
class FakeLimiter {
  keys: string[] = [];
  constructor(private readonly limit_: number) {}
  async limit({ key }: { key: string }) {
    this.keys.push(key);
    return { success: this.keys.filter(seen => seen === key).length <= this.limit_ };
  }
}

describe('Fate relay rate limits', () => {
  const backupId = 'Bk'.repeat(21) + 'A';
  const backupToken = 'Tk'.repeat(21) + 'B';
  const envelope = 'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(64);
  const runId = 'R'.repeat(21) + 'A';

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fetchAs = (env: unknown, ip: string, path: string, init: RequestInit = {}) =>
    worker.fetch(new Request(`https://relay.test${path}`, {
      ...init,
      headers: { 'CF-Connecting-IP': ip, Origin: 'https://app.example.test', ...(init.headers as Record<string, string>) },
    }), env);
  const publishAs = (env: unknown, ip: string, body: unknown, code = CODE) => fetchAs(env, ip, `/r/${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  it('limits nothing when the bindings are absent', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const env = { RELAY: new MemoryKv() };
    const { token } = await (await publishAs(env, '203.0.113.1', { payload: flgz('v0') })).json();
    for (let index = 1; index <= 60; index += 1) {
      expect((await publishAs(env, '203.0.113.1', { token, payload: flgz(`v${index}`) })).status).toBe(200);
    }
    for (let index = 0; index < 10; index += 1) {
      const code = index.toString(16).repeat(32);
      expect((await publishAs(env, '203.0.113.1', { payload: flgz('claim') }, code)).status).toBe(200);
    }
  });

  it('answers 429 with Retry-After and CORS past the write limit, before touching KV, per IP', async () => {
    const kv = new MemoryKv();
    const env = { RELAY: kv, RELAY_WRITE_LIMITER: new FakeLimiter(2) };
    const { token } = await (await publishAs(env, '203.0.113.1', { payload: flgz('v1') })).json();
    expect((await publishAs(env, '203.0.113.1', { token, payload: flgz('v2') })).status).toBe(200);
    const puts = kv.puts.length;

    const refused = await publishAs(env, '203.0.113.1', { token, payload: flgz('v3') });
    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toBe('60');
    expect(refused.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(kv.puts.length).toBe(puts);

    // Another IP has its own count, and reads are never limited.
    expect((await publishAs(env, '198.51.100.7', { token, payload: flgz('v3') })).status).toBe(200);
    for (let index = 0; index < 5; index += 1) {
      expect((await fetchAs(env, '203.0.113.1', `/r/${CODE}`)).status).toBe(200);
    }
    expect(env.RELAY_WRITE_LIMITER.keys).toEqual([
      'write:203.0.113.1', 'write:203.0.113.1', 'write:203.0.113.1', 'write:198.51.100.7',
    ]);
  });

  it('counts backup and shared-progress writes, deletes included, toward the write limit', async () => {
    const env = { RELAY: untouchableKv(), RELAY_WRITE_LIMITER: new FakeLimiter(0) };
    const auth = { Authorization: `Bearer ${backupToken}` };
    expect((await fetchAs(env, '203.0.113.1', `/b/${backupId}`, {
      method: 'POST', headers: { ...auth, 'X-Backup-Writer': 'Wr'.repeat(11) }, body: envelope,
    })).status).toBe(429);
    expect((await fetchAs(env, '203.0.113.1', `/b/${backupId}`, { method: 'DELETE', headers: auth })).status).toBe(429);
    expect((await fetchAs(env, '203.0.113.1', `/p/${runId}`, { method: 'POST', headers: auth, body: '{}' })).status).toBe(429);
    expect((await fetchAs(env, '203.0.113.1', `/p/${runId}/link-code`, { method: 'POST', headers: auth })).status).toBe(429);
  });

  it('limits only the writes that create a record by the claim limit', async () => {
    const kv = new MemoryKv();
    const env = { RELAY: kv, RELAY_CLAIM_LIMITER: new FakeLimiter(1) };
    const { token } = await (await publishAs(env, '203.0.113.1', { payload: flgz('v1') })).json();
    // The owner's later publishes and Disconnect are not claims.
    expect((await publishAs(env, '203.0.113.1', { token, payload: flgz('v2') })).status).toBe(200);
    expect((await publishAs(env, '203.0.113.1', { token, gone: true })).status).toBe(200);
    expect(env.RELAY_CLAIM_LIMITER.keys).toEqual(['claim:203.0.113.1']);

    const otherCode = 'f'.repeat(32);
    const refused = await publishAs(env, '203.0.113.1', { payload: flgz('v1') }, otherCode);
    expect(refused.status).toBe(429);
    expect(kv.records.has(`r:${otherCode}`)).toBe(false);
    expect(kv.records.has(`own:r:${otherCode}`)).toBe(false);
  });

  it('limits new backups and new shared runs by the claim limit, but not their later uploads', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12));
    const kv = new MemoryKv();
    const env = { RELAY: kv, RELAY_CLAIM_LIMITER: new FakeLimiter(1) };
    const upload = (id: string) => fetchAs(env, '203.0.113.1', `/b/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${backupToken}`, 'X-Backup-Writer': 'Wr'.repeat(11) },
      body: envelope,
    });
    expect((await upload(backupId)).status).toBe(200);
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12, 5));
    expect((await upload(backupId)).status).toBe(200);
    expect((await upload('Zz'.repeat(21) + 'A')).status).toBe(429);
    expect(env.RELAY_CLAIM_LIMITER.keys).toHaveLength(2);
  });

  it('never limits the Discord bot, which has its own secret', async () => {
    const env = {
      RELAY: new MemoryKv(),
      PROGRESS_BOT_SECRET: 's'.repeat(40),
      RELAY_WRITE_LIMITER: new FakeLimiter(0),
      RELAY_CLAIM_LIMITER: new FakeLimiter(0),
    };
    const response = await fetchAs(env, '203.0.113.1', '/l/123456789012345678', {
      method: 'DELETE', headers: { Authorization: `Bearer ${'s'.repeat(40)}` },
    });
    expect(response.status).toBe(200);
    expect(env.RELAY_WRITE_LIMITER.keys).toEqual([]);
  });

  it('lets requests through when a limiter fails', async () => {
    const env = {
      RELAY: new MemoryKv(),
      RELAY_WRITE_LIMITER: { limit: async () => { throw new Error('limiter outage'); } },
      RELAY_CLAIM_LIMITER: { limit: async () => { throw new Error('limiter outage'); } },
    };
    expect((await publishAs(env, '203.0.113.1', { payload: flgz('v1') })).status).toBe(200);
  });
});

describe('Fate relay online backups', () => {
  let kv: MemoryKv;
  let env: { RELAY: MemoryKv };
  const id = 'Bk'.repeat(21) + 'A';
  const token = 'Tk'.repeat(21) + 'B';
  const other = 'Ot'.repeat(21) + 'C';
  const envelope = 'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(64);
  const thisBrowser = 'Wr'.repeat(11);
  const otherBrowser = 'Ow'.repeat(11);

  beforeEach(() => {
    kv = new MemoryKv();
    env = { RELAY: kv };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const request = (path: string, init?: RequestInit) =>
    worker.fetch(new Request(`https://relay.test${path}`, init), env);
  const upload = (body: string, bearer: string | null = token, writer: string | null = thisBrowser) =>
    request(`/b/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(writer ? { 'X-Backup-Writer': writer } : {}),
      },
      body,
    });
  const remove = (bearer: string | null = token) =>
    request(`/b/${id}`, { method: 'DELETE', headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });

  it('stores a backup under its id and hands it back with its upload time, for 90 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12));
    const saved = await upload(envelope);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ updatedAt: Date.UTC(2026, 9, 2, 12) });
    expect(kv.ttls.get(`b:${id}`)).toBe(90 * 86400);

    const fetched = await request(`/b/${id}`);
    expect(fetched.status).toBe(200);
    expect(await fetched.text()).toBe(envelope);
    expect(fetched.headers.get('X-Backup-Updated-At')).toBe(String(Date.UTC(2026, 9, 2, 12)));
  });

  it('keeps only a hash of the write token, never the token', async () => {
    await upload(envelope);
    expect(kv.metadata.get(`b:${id}`)).toEqual({
      writeHash: await sha256Hex(token),
      updatedAt: expect.any(Number),
      writer: thisBrowser,
      rotatedAt: expect.any(Number),
    });
    expect([...kv.records.values()].join('')).not.toContain(token);
  });

  it('answers 404 for a backup nobody has uploaded, and 400 for a malformed id', async () => {
    expect((await request(`/b/${id}`)).status).toBe(404);
    expect((await request('/b/too-short')).status).toBe(400);
  });

  it('refuses an upload or a delete without the token that claimed the id', async () => {
    await upload(envelope);
    expect((await upload(envelope, other)).status).toBe(403);
    expect((await upload(envelope, null)).status).toBe(403);
    expect((await remove(other)).status).toBe(403);
    expect(await (await request(`/b/${id}`)).text()).toBe(envelope);
  });

  it('lets the owner delete the backup, with its previous copy', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12));
    await upload(envelope);
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12, 1));
    await upload(envelope.replace('c', 'd'), token, otherBrowser);
    const deleted = await remove();
    expect(await deleted.json()).toEqual({ deleted: true });
    expect((await request(`/b/${id}`)).status).toBe(404);
    expect((await request(`/b/${id}/previous`)).status).toBe(404);
    expect(kv.records.size).toBe(0);
  });

  it('keeps the copy another browser wrote as the previous copy', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12));
    await upload(envelope);
    vi.setSystemTime(Date.UTC(2026, 9, 3, 12));
    await upload(envelope.replace('c', 'd'), token, otherBrowser);

    const latest = await request(`/b/${id}`);
    expect(await latest.text()).toBe(envelope.replace('c', 'd'));
    expect(latest.headers.get('X-Backup-Updated-At')).toBe(String(Date.UTC(2026, 9, 3, 12)));
    const previous = await request(`/b/${id}/previous`);
    expect(await previous.text()).toBe(envelope);
    expect(previous.headers.get('X-Backup-Updated-At')).toBe(String(Date.UTC(2026, 9, 2, 12)));
    expect(kv.ttls.get(`b:${id}:previous`)).toBe(90 * 86400);
  });

  it('replaces only its own copy when the same browser backs up again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12));
    await upload(envelope);
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12, 1));
    await upload(envelope.replace('c', 'd'), token, otherBrowser);
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12, 2));
    await upload(envelope.replace('c', 'e'), token, otherBrowser);

    expect(await (await request(`/b/${id}`)).text()).toBe(envelope.replace('c', 'e'));
    expect(await (await request(`/b/${id}/previous`)).text()).toBe(envelope);
    expect(kv.puts.filter(key => key === `b:${id}:previous`)).toHaveLength(1);
  });

  it('refuses an upload that names no browser, and any write to the previous copy', async () => {
    expect((await upload(envelope, token, null)).status).toBe(400);
    expect((await upload(envelope, token, 'short')).status).toBe(400);
    const direct = await request(`/b/${id}/previous`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Backup-Writer': thisBrowser },
      body: envelope,
    });
    expect(direct.status).toBe(405);
    expect(kv.records.size).toBe(0);
  });

  it('takes a new upload at most once a minute', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12));
    await upload(envelope);
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12, 0, 30));
    const early = await upload(envelope.replace('c', 'd'));
    expect(early.status).toBe(429);
    expect(early.headers.get('Retry-After')).toBe('30');
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12, 1));
    expect((await upload(envelope.replace('c', 'd'))).status).toBe(200);
  });

  it('refuses an oversized backup and one that is not an encrypted backup', async () => {
    const huge = 'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(MAX_BACKUP_BYTES);
    expect((await upload(huge)).status).toBe(413);
    for (const body of [
      '{"payload":"plain"}',
      'FLBK1.',
      'FLBK1.' + 'c'.repeat(64),
      'FLBK2.' + 'i'.repeat(16) + '.' + 'c'.repeat(64),
      'FLBK1.' + 'i'.repeat(15) + '.' + 'c'.repeat(64),
      'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(20),
      'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(63) + '=',
      'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(32) + '.' + 'c'.repeat(31),
      'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(65),
      'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(32) + '<script>' + 'c'.repeat(24),
    ]) {
      expect((await upload(body)).status, body.slice(0, 40)).toBe(400);
    }
    expect(kv.records.size).toBe(0);
  });

  it('accepts the largest backup an encrypted sync code can make', async () => {
    const largest = 'FLBK1.' + 'i'.repeat(16) + '.' + 'c'.repeat(MAX_BACKUP_BYTES - 23);
    expect(largest.length).toBe(MAX_BACKUP_BYTES);
    expect((await upload(largest)).status).toBe(200);
  });

  it('checks an upload before looking anything up', async () => {
    env.RELAY = untouchableKv() as unknown as MemoryKv;
    expect((await upload('FLBK1.' + 'c'.repeat(64))).status).toBe(400);
    expect((await upload(envelope, token, 'short')).status).toBe(400);
  });

  describe('when the same browser backs up again', () => {
    const DAY = 86_400_000;
    const at = (hours: number) => Date.UTC(2026, 9, 2, 12) + hours * 3_600_000;
    const copy = (label: string) => 'FLBK1.' + 'i'.repeat(16) + '.' + label.repeat(64);
    const previousCopy = async () => {
      const response = await request(`/b/${id}/previous`);
      return response.status === 200 ? response.text() : null;
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('replaces only the newest copy within a day of its first upload, one KV write each', async () => {
      vi.setSystemTime(at(0));
      await upload(copy('a'));
      for (const [hour, label] of [[1, 'b'], [6, 'c'], [23, 'd']] as const) {
        vi.setSystemTime(at(hour));
        kv.puts.length = 0;
        expect((await upload(copy(label))).status).toBe(200);
        expect(kv.puts).toEqual([`b:${id}`]);
      }
      expect(await previousCopy()).toBeNull();
      expect(await (await request(`/b/${id}`)).text()).toBe(copy('d'));
    });

    it('keeps the copy it replaces as the previous copy once a day', async () => {
      vi.setSystemTime(at(0));
      await upload(copy('a'));
      vi.setSystemTime(at(20));
      await upload(copy('b'));
      vi.setSystemTime(at(24));
      kv.puts.length = 0;
      await upload(copy('c'));
      expect(kv.puts).toEqual([`b:${id}:previous`, `b:${id}`]);
      expect(await previousCopy()).toBe(copy('b'));
      const previous = await request(`/b/${id}/previous`);
      expect(previous.headers.get('X-Backup-Updated-At')).toBe(String(at(20)));

      // Within the next day the previous copy stays.
      vi.setSystemTime(at(30));
      await upload(copy('d'));
      vi.setSystemTime(at(47));
      await upload(copy('e'));
      expect(await previousCopy()).toBe(copy('b'));
      vi.setSystemTime(at(48));
      await upload(copy('f'));
      expect(await previousCopy()).toBe(copy('e'));
    });

    it("can't replace the copy from a day before with a bad upload", async () => {
      vi.setSystemTime(at(0));
      await upload(copy('a'));
      vi.setSystemTime(at(25));
      await upload(copy('g')); // the last good copy, kept as previous by the next upload
      vi.setSystemTime(at(50));
      await upload(copy('x')); // a damaged run: rotates, so the good copy is kept
      expect(await previousCopy()).toBe(copy('g'));
      for (let minutes = 1; minutes <= 30; minutes += 1) {
        vi.setSystemTime(at(50) + minutes * 60_000);
        await upload(copy('x'));
      }
      expect(await previousCopy()).toBe(copy('g'));
      vi.setSystemTime(at(50) + DAY - 60_000);
      await upload(copy('x'));
      expect(await previousCopy()).toBe(copy('g'));
    });

    it('rotates a copy stored before rotations were recorded on its next upload', async () => {
      vi.setSystemTime(at(0));
      kv.records.set(`b:${id}`, copy('o'));
      kv.metadata.set(`b:${id}`, { writeHash: await sha256Hex(token), updatedAt: at(-1), writer: thisBrowser });
      await upload(copy('n'));
      expect(await previousCopy()).toBe(copy('o'));
      expect(kv.metadata.get(`b:${id}`)).toMatchObject({ rotatedAt: at(0) });
      vi.setSystemTime(at(1));
      kv.puts.length = 0;
      await upload(copy('m'));
      expect(kv.puts).toEqual([`b:${id}`]);
    });
  });

  it('lets browsers send the token header and delete in a cached preflight', async () => {
    const preflight = await request(`/b/${id}`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.test', 'Access-Control-Request-Method': 'DELETE' },
    });
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('X-Backup-Writer');
    expect(preflight.headers.get('Access-Control-Expose-Headers')).toContain('X-Backup-Updated-At');
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

  it('keeps a code claimed after its 30-day data record expires', async () => {
    const { token } = await (await publish({ payload: flgz('owner v1') })).json();
    kv.records.delete(`r:${CODE}`); // the data record's TTL ran out

    expect((await publish({ payload: flgz('forged') })).status).toBe(403);
    expect((await publish({ token: 'guess', payload: flgz('forged') })).status).toBe(403);
    expect((await publish({ token, payload: flgz('owner v2') })).status).toBe(200);
    expect((await (await read()).json()).payload).toBe(flgz('owner v2'));
  });

  it('stores only a hash of the write token, kept for 90 days', async () => {
    const { token } = await (await publish({ payload: flgz('v1') })).json();
    const owner = kv.records.get(`own:r:${CODE}`)!;

    expect(owner).not.toContain(token);
    expect(owner.startsWith(`${await sha256Hex(token)}:`)).toBe(true);
    expect(kv.ttls.get(`own:r:${CODE}`)).toBe(90 * 86_400);
    expect(kv.ttls.get(`r:${CODE}`)).toBe(30 * 86_400);
  });

  it('adopts a code published before owner records existed', async () => {
    kv.records.set(`r:${CODE}`, JSON.stringify({ version: 3, payload: flgz('old'), token: 'legacy-token' }));

    expect((await publish({ token: 'someone-else', payload: flgz('forged') })).status).toBe(403);
    expect((await publish({ token: 'legacy-token', payload: flgz('new') })).status).toBe(200);
    expect(kv.records.get(`own:r:${CODE}`)?.startsWith(`${await sha256Hex('legacy-token')}:`)).toBe(true);
  });

  it('refreshes the owner record at most once a day', async () => {
    const { token } = await (await publish({ payload: flgz('v1') })).json();
    await publish({ token, payload: flgz('v2') });
    await publish({ token, payload: flgz('v3') });
    expect(kv.puts.filter(key => key === `own:r:${CODE}`)).toHaveLength(1);

    const [hash] = kv.records.get(`own:r:${CODE}`)!.split(':');
    kv.records.set(`own:r:${CODE}`, `${hash}:${Date.now() - 2 * 86_400_000}`);
    await publish({ token, payload: flgz('v4') });
    expect(kv.puts.filter(key => key === `own:r:${CODE}`)).toHaveLength(2);
  });

  it('still returns the new token when recording the owner fails', async () => {
    const put = kv.put.bind(kv);
    kv.put = async (key, value, options) => {
      if (key.startsWith('own:')) throw new Error('owner write failed');
      return put(key, value, options);
    };
    const response = await publish({ payload: flgz('v1') });

    expect(response.status).toBe(200);
    const { token } = await response.json();
    expect((await publish({ token, payload: flgz('v2') })).status).toBe(200);
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
    const { token } = await (await post(`/r/${CODE}`, { payload: flgz('v1') })).json();
    await post(`/r/${CODE}`, { token, payload: flgz('v2') });
    const held = await get(`/r/${CODE}`);
    const heldEtag = held.headers.get('ETag')!;
    expect(heldEtag).toBe(String((await held.json()).version));

    vi.setSystemTime(Date.now() + 30 * DAY_MS + 1_000);
    kv.records.delete(`r:${CODE}`); // the 30-day profile record expired
    await post(`/r/${CODE}`, { token, payload: flgz('v3') });
    await post(`/r/${CODE}`, { token, payload: flgz('v4') });

    const body = await expectImportable(await get(`/r/${CODE}`, heldEtag), Number(heldEtag));
    expect(body.payload).toBe(flgz('v4'));
  });

  it('outranks the counter versions clients hold from before this rule', async () => {
    // A client can hold a large counter version for a code whose record then
    // expired; the first publish afterwards must still read as newer.
    const { token } = await (await post(`/r/${CODE}`, { payload: flgz('v1') })).json();
    kv.records.delete(`r:${CODE}`);
    await post(`/r/${CODE}`, { token, payload: flgz('v2') });

    await expectImportable(await get(`/r/${CODE}`, '1000000'), 1_000_000);
  });

  it('keeps versions distinct for writes within the same second', async () => {
    const { token, version: first } = await (await post(`/r/${CODE}`, { payload: flgz('v1') })).json();
    const { version: second } = await (await post(`/r/${CODE}`, { token, payload: flgz('v2') })).json();

    expect(second).toBeGreaterThan(first);
    await expectImportable(await get(`/r/${CODE}`, String(first)), first);
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
  const PAYLOAD = flgz('rules linked to Nubles');

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

    expect((await post(PROFILE, { payload: flgz('forged') })).status).toBe(403);
    const republished = await post(PROFILE, { token, payload: flgz('rules again') });
    expect(republished.status).toBe(200);
    const { version } = await republished.json();
    expect(version).toBeGreaterThan(gone);
    expect(kv.ttls.get(`r:${CODE}`)).toBe(30 * 86_400);
    const response = await get(PROFILE);
    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe(String(version));
    expect(await response.json()).toEqual({ version, payload: flgz('rules again') });
  });
});

describe('Fate relay error reports', () => {
  const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abcDEF_ghi-JKL';
  const report = (overrides: Record<string, unknown> = {}) => ({
    build: 'abc1234',
    kind: 'error',
    message: 'TypeError: x is undefined',
    stack: 'TypeError: x is undefined\n    at roll (index-abc.js:1:234)',
    path: '/OSRS-Fate-Locked/#map',
    ...overrides,
  });
  let waited: Promise<unknown>[];
  let ctx: { waitUntil: (work: Promise<unknown>) => void };
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetErrorDedupe();
    waited = [];
    ctx = { waitUntil: work => { waited.push(work); } };
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const send = async (env: Record<string, unknown>, body: unknown, init: RequestInit = {}) => {
    const response = await worker.fetch(new Request('https://relay.test/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.test', 'CF-Connecting-IP': '203.0.113.9' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...init,
    }), { RELAY: untouchableKv(), ...env }, ctx);
    await Promise.all(waited);
    return response;
  };
  const posted = () => fetchMock.mock.calls.map(([url, init]) => ({ url, body: JSON.parse((init as RequestInit).body as string) }));

  it('answers 204 with CORS at once and forwards the report after the response, without KV', async () => {
    const response = await send({ ERROR_WEBHOOK_URL: WEBHOOK }, report());
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(waited).toHaveLength(1);
    expect(posted()).toEqual([{
      url: WEBHOOK,
      body: {
        content: expect.stringContaining('TypeError: x is undefined'),
        allowed_mentions: { parse: [] },
        flags: 4,
      },
    }]);
    const { content } = posted()[0].body;
    expect(content.split('\n')[0]).toBe('Fate Locked error · build abc1234 · /OSRS-Fate-Locked/#map');
    expect(content).toContain('at roll (index-abc.js:1:234)');
    expect(content.length).toBeLessThanOrEqual(2000);
  });

  it('lets a browser preflight it', async () => {
    const preflight = await worker.fetch(new Request('https://relay.test/e', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.test', 'Access-Control-Request-Method': 'POST' },
    }), { RELAY: untouchableKv() }, ctx);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });

  it('reads a beacon sent as text/plain', async () => {
    await send({ ERROR_WEBHOOK_URL: WEBHOOK }, JSON.stringify(report()), {
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards the same message from the same build once in 10 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 13, 12));
    const env = { ERROR_WEBHOOK_URL: WEBHOOK };
    await send(env, report());
    await send(env, report({ stack: 'a different stack', path: '/elsewhere' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await send(env, report({ build: 'def5678' }));
    await send(env, report({ message: 'RangeError: too deep' }));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    vi.setSystemTime(Date.UTC(2026, 9, 13, 12, 10, 1));
    await send(env, report());
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('only logs a report when no webhook is set, or the secret is not a Discord webhook', async () => {
    expect((await send({}, report())).status).toBe(204);
    expect((await send({ ERROR_WEBHOOK_URL: 'https://evil.example/hook' }, report({ build: 'b2' }))).status).toBe(204);
    expect((await send({ ERROR_WEBHOOK_URL: 'http://discord.com/api/webhooks/1/x' }, report({ build: 'b3' }))).status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(3);
    expect(String(consoleError.mock.calls[0][1])).toContain('TypeError: x is undefined');
  });

  it('answers 204 and forwards nothing for a body that is not a report', async () => {
    const env = { ERROR_WEBHOOK_URL: WEBHOOK };
    for (const body of ['not json', '[1,2]', 'null', '{}', JSON.stringify({ message: 42 })]) {
      expect((await send(env, body)).status).toBe(204);
    }
    expect((await send(env, report({ message: 'x'.repeat(9 * 1024) }))).status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the message short, literal and unable to ping anyone', async () => {
    await send({ ERROR_WEBHOOK_URL: WEBHOOK }, report({
      message: '@everyone ```escape``` \u0007bell',
      stack: 'line\n'.repeat(1000),
      kind: 'unhandledrejection',
    }));
    const { content, allowed_mentions } = posted()[0].body;
    expect(allowed_mentions).toEqual({ parse: [] });
    expect(content.length).toBeLessThanOrEqual(2000);
    expect(content.match(/```/g)).toHaveLength(2);
    expect(content).not.toContain('\u0007');
    expect(content.startsWith('Fate Locked unhandledrejection · build abc1234')).toBe(true);
  });

  it('answers 204 but forwards nothing past the per-IP limit', async () => {
    const limiter = new FakeLimiter(1);
    const env = { ERROR_WEBHOOK_URL: WEBHOOK, RELAY_ERROR_LIMITER: limiter };
    expect((await send(env, report())).status).toBe(204);
    expect((await send(env, report({ message: 'another' }))).status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(limiter.keys).toEqual(['error:203.0.113.9', 'error:203.0.113.9']);
  });

  it('never fails the response when the webhook does', async () => {
    fetchMock.mockRejectedValueOnce(new Error('discord down'));
    expect((await send({ ERROR_WEBHOOK_URL: WEBHOOK }, report())).status).toBe(204);
  });

  it('takes only POST', async () => {
    const response = await worker.fetch(new Request('https://relay.test/e'), { RELAY: untouchableKv() }, ctx);
    expect(response.status).toBe(405);
  });
});

/** An event as RuneLite's Copy for tracker and Send to tracker send it. */
const NOW = Date.UTC(2026, 9, 19, 12);
const MINUTE = 60_000;
const DAY = 86_400_000;
const runeliteEvent = (eventId: string, minutesAgo = 1, extra: Record<string, unknown> = {}) => ({
  protocolVersion: 1,
  eventId,
  runId: 'run-1',
  account: 'Player One',
  runRevision: 3,
  eventType: 'QUEST',
  canonicalLabel: 'Cook’s Assistant',
  occurredAt: NOW - minutesAgo * MINUTE,
  sessionSequence: 1,
  bundleVersion: 4,
  rulesVersion: '1',
  contentVersion: 1,
  detectorId: 'quest-state-v1',
  detectorVersion: 1,
  confidence: 'EXACT',
  evidence: {},
  ...extra,
});
const copyOf = (events: unknown[]) => ({ format: 'fate-locked-runelite-events', events });

describe('Fate relay Send to tracker inbox', () => {
  let kv: MemoryKv;
  let env: Record<string, unknown> & { RELAY: MemoryKv };
  let token: string;
  const INBOX = `/r/${CODE}/inbox`;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    kv = new MemoryKv();
    env = { RELAY: kv };
    ({ token } = await (await call('POST', `/r/${CODE}`, { body: { payload: flgz('rules') } })).json());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function call(method: string, path: string, { body, bearer, raw }: { body?: unknown; bearer?: string | null; raw?: string } = {}) {
    return worker.fetch(new Request(`https://relay.test${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      ...(raw !== undefined ? { body: raw } : body !== undefined ? { body: JSON.stringify(body) } : {}),
    }), env);
  }
  const send = (events: unknown[], code = CODE) => call('POST', `/r/${code}/inbox`, { body: copyOf(events) });
  const take = (bearer: string | null = token) => call('GET', INBOX, { bearer });
  const ack = (ids: unknown, bearer: string | null = token) => call('POST', `${INBOX}/ack`, { body: { ids }, bearer });
  const heldIds = async () => (await (await take()).json()).events.map((event: { eventId: string }) => event.eventId);

  it('holds what RuneLite sends for 30 days, for the tracker to read with its token', async () => {
    const response = await send([runeliteEvent('e1'), runeliteEvent('e2', 2)]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: 2, held: 2 });
    expect(kv.ttls.get(`ri:${CODE}`)).toBe(30 * 86_400);

    const read = await take();
    expect(read.status).toBe(200);
    expect(read.headers.get('Content-Type')).toBe('application/json');
    expect(read.headers.get('Cache-Control')).toBe('no-store');
    // Exactly what a paste reads, oldest first, every field as RuneLite sent it.
    expect(await read.json()).toEqual(copyOf([runeliteEvent('e2', 2), runeliteEvent('e1')]));
  });

  it('answers an empty inbox with no events', async () => {
    const read = await take();
    expect(read.status).toBe(200);
    expect(await read.text()).toBe('{"format":"fate-locked-runelite-events","events":[]}');
  });

  it('passes fields it does not check through untouched', async () => {
    const odd = runeliteEvent('e1', 1, { evidence: { nested: 'x', n: 1.5 }, futureField: [1, { a: null }] });
    await send([odd]);
    expect((await (await take()).json()).events).toEqual([odd]);
  });

  it('merges by id, a re-sent id replacing the held copy', async () => {
    await send([runeliteEvent('e1'), runeliteEvent('e2', 5)]);
    const again = await send([runeliteEvent('e1', 1, { canonicalLabel: 'Corrected' }), runeliteEvent('e3', 3)]);
    expect(await again.json()).toEqual({ accepted: 2, held: 3 });
    const { events } = await (await take()).json();
    expect(events.map((event: { eventId: string }) => event.eventId)).toEqual(['e2', 'e3', 'e1']);
    expect(events[2].canonicalLabel).toBe('Corrected');
  });

  it('keeps the newest 250 by when they happened, and counts only the events it stored', async () => {
    const newer = Array.from({ length: 250 }, (_, index) => runeliteEvent(`new-${index}`, index + 1));
    for (let from = 0; from < 250; from += 100) await send(newer.slice(from, from + 100));
    const older = await send([runeliteEvent('old-1', 600), runeliteEvent('old-2', 700)]);
    expect(await older.json()).toEqual({ accepted: 0, held: 250 });
    const mixed = await send([runeliteEvent('newest', 0), runeliteEvent('old-3', 800)]);
    expect(await mixed.json()).toEqual({ accepted: 1, held: 250 });
    const ids = await heldIds();
    expect(ids).toHaveLength(250);
    expect(ids).toContain('newest');
    expect(ids).not.toContain('new-249');
    expect(ids.some((id: string) => id.startsWith('old-'))).toBe(false);
  });

  it('never holds an event too large for the tracker to read', async () => {
    const huge = runeliteEvent('huge', 1, { evidence: { note: 'x'.repeat(9 * 1024) } });
    const response = await send([huge, runeliteEvent('fine')]);
    expect(await response.json()).toEqual({ accepted: 1, held: 1 });
    expect(await heldIds()).toEqual(['fine']);
  });

  it('drops held events once they are older than the tracker takes', async () => {
    await send([runeliteEvent('stale', 60)]);
    vi.setSystemTime(NOW + 30 * DAY);
    const response = await send([runeliteEvent('fresh', -30 * 24 * 60)]);
    expect(await response.json()).toEqual({ accepted: 1, held: 1 });
  });

  it('reads an event id named id when an event has no eventId', async () => {
    const { eventId: _dropped, ...rest } = runeliteEvent('ignored');
    const response = await send([{ ...rest, id: 'by-id' }]);
    expect(await response.json()).toEqual({ accepted: 1, held: 1 });
    expect(await (await ack(['by-id'])).json()).toEqual({ held: 0 });
  });

  it.each([
    ['another format', { format: 'something-else', events: [runeliteEvent('e1')] }],
    ['no events', copyOf([])],
    ['101 events', copyOf(Array.from({ length: 101 }, (_, index) => runeliteEvent(`e${index}`)))],
    ['events that are not a list', { format: 'fate-locked-runelite-events', events: { e1: runeliteEvent('e1') } }],
    ['an event that is not an object', copyOf(['e1'])],
    ['an event with no id', copyOf([{ occurredAt: NOW }])],
    ['an empty id', copyOf([runeliteEvent('')])],
    ['an id of 129 characters', copyOf([runeliteEvent('x'.repeat(129))])],
    ['an id that is not a string', copyOf([runeliteEvent(42 as unknown as string)])],
    ['an event over 30 days old', copyOf([runeliteEvent('e1', 30 * 24 * 60 + 1)])],
    ['an event over 10 minutes ahead', copyOf([runeliteEvent('e1', -11)])],
    ['a time that is not whole ms', copyOf([runeliteEvent('e1', 1, { occurredAt: NOW + 0.5 })])],
    ['a time as text', copyOf([runeliteEvent('e1', 1, { occurredAt: String(NOW) })])],
    ['one bad event among good ones', copyOf([runeliteEvent('e1'), runeliteEvent('e2', 1, { occurredAt: null })])],
    ['a list instead of an object', [runeliteEvent('e1')]],
  ])('refuses %s, before touching KV', async (_kind, body) => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await call('POST', INBOX, { body })).status).toBe(400);
  });

  it('accepts an id of 128 characters and an event 10 minutes ahead', async () => {
    const response = await send([runeliteEvent('x'.repeat(128), -10)]);
    expect(response.status).toBe(200);
  });

  it('refuses broken JSON and a body over 64 KiB, before touching KV', async () => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await call('POST', INBOX, { raw: '{"format":' })).status).toBe(400);
    const padded = { ...copyOf([runeliteEvent('e1')]), padding: 'x'.repeat(64 * 1024) };
    expect((await call('POST', INBOX, { body: padded })).status).toBe(413);
  });

  it('answers 404 {"error":"no profile"} for a code with no profile, or one marked gone', async () => {
    const other = 'f'.repeat(32);
    const missing = await send([runeliteEvent('e1')], other);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'no profile' });
    expect(kv.records.has(`ri:${other}`)).toBe(false);

    await send([runeliteEvent('e1')]);
    expect((await call('POST', `/r/${CODE}`, { body: { token, gone: true } })).status).toBe(200);
    for (const response of [await send([runeliteEvent('e2')]), await take(), await ack(['e1'])]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'no profile' });
    }
  });

  it('lets only the code’s write token read or empty the inbox', async () => {
    await send([runeliteEvent('e1')]);
    for (const bearer of [null, 'someone-else', 'has spaces', 'x'.repeat(129)]) {
      expect((await take(bearer)).status, String(bearer)).toBe(403);
      expect((await ack(['e1'], bearer)).status, String(bearer)).toBe(403);
    }
    const plainAuth = await worker.fetch(new Request(`https://relay.test${INBOX}`, { headers: { Authorization: token } }), env);
    expect(plainAuth.status).toBe(403);
    expect(await heldIds()).toEqual(['e1']);
  });

  it('checks a missing or malformed token before touching KV', async () => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await take(null)).status).toBe(403);
    expect((await ack(['e1'], null)).status).toBe(403);
  });

  it('reads a code published before owner records with the token its record holds', async () => {
    kv.records.delete(`own:r:${CODE}`);
    kv.records.set(`r:${CODE}`, JSON.stringify({ version: 3, payload: flgz('old'), token: 'legacy-token' }));
    await send([runeliteEvent('e1')]);
    expect((await take('legacy-token')).status).toBe(200);
    expect((await take(token)).status).toBe(403);
  });

  it('empties what the tracker took, and removes the record once nothing waits', async () => {
    await send([runeliteEvent('e1'), runeliteEvent('e2', 2), runeliteEvent('e3', 3)]);
    const partial = await ack(['e1', 'e3', 'never-sent']);
    expect(partial.status).toBe(200);
    expect(await partial.json()).toEqual({ held: 1 });
    expect(await heldIds()).toEqual(['e2']);

    expect(await (await ack(['e2'])).json()).toEqual({ held: 0 });
    expect(kv.records.has(`ri:${CODE}`)).toBe(false);
    expect(await (await ack(['e2'])).json()).toEqual({ held: 0 });
  });

  it('writes nothing when an acknowledgement names nothing held', async () => {
    await send([runeliteEvent('e1')]);
    kv.puts.length = 0;
    expect(await (await ack(['other'])).json()).toEqual({ held: 1 });
    expect(await (await ack([])).json()).toEqual({ held: 1 });
    expect(kv.puts).toEqual([]);
  });

  it.each([
    ['ids that are not a list', { ids: 'e1' }],
    ['no ids', {}],
    ['251 ids', { ids: Array.from({ length: 251 }, (_, index) => `e${index}`) }],
    ['an empty id', { ids: [''] }],
    ['an id of 129 characters', { ids: ['x'.repeat(129)] }],
    ['an id that is not a string', { ids: [7] }],
  ])('refuses an acknowledgement with %s, before touching KV', async (_kind, body) => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await call('POST', `${INBOX}/ack`, { body, bearer: token })).status).toBe(400);
  });

  it('accepts an acknowledgement of 250 ids', async () => {
    const ids = Array.from({ length: 250 }, (_, index) => `${'x'.repeat(120)}-${index}`);
    expect((await ack(ids)).status).toBe(200);
  });

  it('takes only the methods each route has', async () => {
    for (const [method, path] of [['DELETE', INBOX], ['PUT', INBOX], ['GET', `${INBOX}/ack`], ['DELETE', `${INBOX}/ack`]]) {
      expect((await call(method, path, { bearer: token })).status, `${method} ${path}`).toBe(405);
    }
  });

  it('answers 400 to a malformed code and 404 to an unknown inbox path, before touching KV', async () => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await call('POST', '/r/ABCD/inbox', { body: copyOf([runeliteEvent('e1')]) })).status).toBe(400);
    expect((await call('GET', `/r/${CODE.toUpperCase()}/inbox`, { bearer: token })).status).toBe(400);
    expect((await call('POST', '/r/ABCD/inbox/ack', { body: { ids: [] }, bearer: token })).status).toBe(400);
    expect((await call('GET', `${INBOX}/other`)).status).toBe(404);
    expect((await call('GET', `${INBOX}/`)).status).toBe(404);
  });

  it('counts sends and acknowledgements toward the write limit, before touching KV, but not reads', async () => {
    env = { RELAY: kv, RELAY_WRITE_LIMITER: new FakeLimiter(0) };
    const putsBefore = kv.puts.length;
    const sent = await send([runeliteEvent('e1')]);
    expect(sent.status).toBe(429);
    expect(sent.headers.get('Retry-After')).toBe('60');
    expect((await ack(['e1'])).status).toBe(429);
    expect(kv.puts.length).toBe(putsBefore);
    expect((await take()).status).toBe(200);
  });
});

describe('Fate relay badges', () => {
  let kv: MemoryKv;
  let env: Record<string, unknown> & { RELAY: MemoryKv };
  let token: string;
  const BADGE = `/r/${CODE}/badge`;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    resetBadgeCache();
    kv = new MemoryKv();
    env = { RELAY: kv };
    ({ token } = await (await call('POST', `/r/${CODE}`, { body: { payload: flgz('rules') } })).json());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetBadgeCache();
  });

  function call(method: string, path: string, { body, headers = {}, ctx }: { body?: unknown; headers?: Record<string, string>; ctx?: unknown } = {}) {
    return worker.fetch(new Request(`https://relay.test${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }), env, ctx);
  }
  const postBadge = (body: unknown, code = CODE) => call('POST', `/r/${code}/badge`, { body });
  const list = async (headers: Record<string, string> = {}) => call('GET', '/badges', { headers });
  /** A badge stored as the relay stores one, for a code of its own. */
  const storeBadge = (index: number, n: string, t: number, at = NOW) => {
    const key = `bd:${index.toString(16).padStart(32, '0')}`;
    kv.records.set(key, '');
    kv.metadata.set(key, { n, t, at });
  };

  it('keeps one badge per code as metadata of an empty record, for 30 days', async () => {
    const response = await postBadge({ name: ' Player One ', tier: 2 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(kv.records.get(`bd:${CODE}`)).toBe('');
    expect(kv.metadata.get(`bd:${CODE}`)).toEqual({ n: 'Player One', t: 2, at: NOW });
    expect(kv.ttls.get(`bd:${CODE}`)).toBe(30 * 86_400);

    vi.setSystemTime(NOW + MINUTE);
    await postBadge({ name: 'Player One', tier: 3 });
    expect(kv.metadata.get(`bd:${CODE}`)).toEqual({ n: 'Player One', t: 3, at: NOW + MINUTE });
  });

  it.each([
    ['tier 0', { name: 'a', tier: 0 }],
    ['tier 4', { name: 'Name_With-12', tier: 4 }],
  ])('accepts %s', async (_kind, body) => {
    expect((await postBadge(body)).status).toBe(200);
  });

  it.each([
    ['a name of 13 characters', { name: 'x'.repeat(13), tier: 1 }],
    ['a blank name', { name: '   ', tier: 1 }],
    ['a name with other symbols', { name: 'Player<One>', tier: 1 }],
    ['a name with a non-breaking space', { name: 'Player One', tier: 1 }],
    ['a name that is not text', { name: 7, tier: 1 }],
    ['tier 5', { name: 'Player', tier: 5 }],
    ['tier -1', { name: 'Player', tier: -1 }],
    ['a fractional tier', { name: 'Player', tier: 1.5 }],
    ['a tier as text', { name: 'Player', tier: '1' }],
    ['no tier', { name: 'Player' }],
    ['a list', ['Player', 1]],
  ])('refuses %s, before touching KV', async (_kind, body) => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await postBadge(body)).status).toBe(400);
  });

  it('refuses a body over 1 KiB before touching KV', async () => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv };
    expect((await postBadge({ name: 'Player', tier: 1, padding: 'x'.repeat(1024) })).status).toBe(413);
  });

  it('answers 404 {"error":"no profile"} for a code with no profile, or one marked gone', async () => {
    const missing = await postBadge({ name: 'Player', tier: 1 }, 'e'.repeat(32));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'no profile' });

    await call('POST', `/r/${CODE}`, { body: { token, gone: true } });
    const gone = await postBadge({ name: 'Player', tier: 1 });
    expect(gone.status).toBe(404);
    expect(kv.records.has(`bd:${CODE}`)).toBe(false);
  });

  it('removes the badge, even once the profile is gone or never was', async () => {
    await postBadge({ name: 'Player', tier: 1 });
    await call('POST', `/r/${CODE}`, { body: { token, gone: true } });
    const removed = await call('DELETE', BADGE);
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ deleted: true });
    expect(kv.records.has(`bd:${CODE}`)).toBe(false);
    expect((await call('DELETE', `/r/${'d'.repeat(32)}/badge`)).status).toBe(200);
  });

  it('counts badge posts and removals toward the write limit, before touching KV', async () => {
    env = { RELAY: untouchableKv() as unknown as MemoryKv, RELAY_WRITE_LIMITER: new FakeLimiter(0) };
    expect((await postBadge({ name: 'Player', tier: 1 })).status).toBe(429);
    expect((await call('DELETE', BADGE)).status).toBe(429);
  });

  it('takes only POST and DELETE for a badge, and only GET for the list', async () => {
    expect((await call('GET', BADGE)).status).toBe(405);
    expect((await call('POST', '/badges', { body: {} })).status).toBe(405);
    expect((await call('GET', '/r/ABCD/badge')).status).toBe(400);
  });

  it('lists every badge by name from metadata alone, cacheable for 10 minutes', async () => {
    storeBadge(1, 'zed', 1);
    storeBadge(2, 'Alpha', 4);
    storeBadge(3, 'mid name', 0);
    kv.get = async () => {
      throw new Error('the list must not read values');
    };
    const response = await list();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=600');
    expect(response.headers.get('ETag')).toMatch(/^"[0-9a-f]{32}"$/);
    expect(await response.text()).toBe('{"badges":[{"n":"Alpha","t":4},{"n":"mid name","t":0},{"n":"zed","t":1}]}');
  });

  it('lists a name once, with its newest badge, and skips metadata that is not a badge', async () => {
    storeBadge(1, 'Player One', 1, NOW - DAY);
    storeBadge(2, 'player_one', 3, NOW);
    storeBadge(3, 'Other', 9);
    kv.records.set('bd:nometa', '');
    const { badges } = await (await list()).json();
    // 'Other' has tier 9, which no badge has.
    expect(badges).toEqual([{ n: 'player_one', t: 3 }]);
  });

  it('follows list pages and stops at 5000 badges', async () => {
    for (let index = 0; index < 5100; index += 1) storeBadge(index, `p${index}`, index % 5);
    const { badges } = await (await list()).json();
    expect(badges).toHaveLength(5000);
    expect(kv.lists).toBe(5);
  });

  it('answers 304 to its ETag, quoted, weak or among others', async () => {
    storeBadge(1, 'Player', 2);
    const etag = (await list()).headers.get('ETag')!;
    for (const validator of [etag, `W/${etag}`, etag.slice(1, -1), `"other", ${etag}`, '*']) {
      const response = await list({ 'If-None-Match': validator });
      expect(response.status, validator).toBe(304);
      expect(response.headers.get('ETag')).toBe(etag);
      expect(await response.text()).toBe('');
    }
    expect((await list({ 'If-None-Match': '"other"' })).status).toBe(200);
  });

  it('builds the list at most every 10 minutes', async () => {
    storeBadge(1, 'Player', 2);
    await list();
    storeBadge(2, 'Newcomer', 1);
    vi.setSystemTime(NOW + 9 * MINUTE);
    expect((await (await list()).json()).badges).toHaveLength(1);
    expect(kv.lists).toBe(1);
    vi.setSystemTime(NOW + 10 * MINUTE);
    expect((await (await list()).json()).badges).toHaveLength(2);
    expect(kv.lists).toBe(2);
  });

  it('shares a built list through the Cache API, after the response', async () => {
    const cached = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (request: Request) => cached.get(request.url)?.clone()),
      put: vi.fn(async (request: Request, response: Response) => { cached.set(request.url, response); }),
    };
    vi.stubGlobal('caches', { default: cache });
    storeBadge(1, 'Player', 2);
    const waited: Promise<unknown>[] = [];
    const ctx = { waitUntil: (work: Promise<unknown>) => { waited.push(work); } };

    const first = await call('GET', '/badges', { ctx });
    await Promise.all(waited);
    expect(cache.put).toHaveBeenCalledTimes(1);
    const [key, stored] = cache.put.mock.calls[0];
    expect(key.url).toBe('https://relay.test/badges');
    expect(stored.headers.get('Cache-Control')).toBe('public, max-age=600');

    // Another isolate in the same location: served from the cache, not KV.
    resetBadgeCache();
    const second = await call('GET', '/badges', { ctx });
    expect(await second.text()).toBe(await first.text());
    expect(second.headers.get('ETag')).toBe(first.headers.get('ETag'));
    expect(kv.lists).toBe(1);

    // A cached list older than 10 minutes is built again.
    resetBadgeCache();
    vi.setSystemTime(NOW + 11 * MINUTE);
    await call('GET', '/badges', { ctx });
    expect(kv.lists).toBe(2);
  });

  it('builds the list when the Cache API fails', async () => {
    vi.stubGlobal('caches', { default: { match: async () => { throw new Error('cache down'); }, put: async () => { throw new Error('cache down'); } } });
    storeBadge(1, 'Player', 2);
    const response = await list();
    expect(response.status).toBe(200);
    expect((await response.json()).badges).toEqual([{ n: 'Player', t: 2 }]);
  });

  it('is never limited, and lets any page read it', async () => {
    env = { RELAY: kv, RELAY_WRITE_LIMITER: new FakeLimiter(0) };
    const response = await list({ Origin: 'https://app.example.test' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(response.headers.get('Vary')).toBe('Origin');
    expect(await response.text()).toBe('{"badges":[]}');
  });
});
