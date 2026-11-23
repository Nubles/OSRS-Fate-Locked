import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import worker from './worker.js';
import {
  FEED_POSTS_PER_HOUR,
  FEED_WINDOW_MS,
  LINK_CODE_TTL_SECONDS,
  feedForPublish,
  PROGRESS_OWNER_TTL_SECONDS,
  PROGRESS_TTL_SECONDS,
  PROGRESS_UNCHANGED_REFRESH_MS,
  newLinkCode,
  newUnlocksSince,
  normalizeLinkCode,
  validProgressSnapshot,
} from './progress.js';

class MemoryKv {
  records = new Map<string, string>();
  ttls = new Map<string, number | undefined>();
  metadata = new Map<string, unknown>();

  async get(key: string, options?: { type?: string }) {
    const value = this.records.get(key);
    if (value === undefined) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async getWithMetadata(key: string, options?: { type?: string }) {
    const value = await this.get(key, options);
    return { value, metadata: value === null ? null : this.metadata.get(key) ?? null };
  }

  puts: string[] = [];

  async put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }) {
    this.puts.push(key);
    this.records.set(key, value);
    this.ttls.set(key, options?.expirationTtl);
    if (options?.metadata !== undefined) this.metadata.set(key, options.metadata);
  }

  async delete(key: string) {
    this.records.delete(key);
    this.metadata.delete(key);
  }
}

const RUN = 'AAAAAAAAAAAAAAAAAAAAAA';
const TOKEN = 'T'.repeat(43);
const OTHER_TOKEN = 'U'.repeat(43);
const SECRET = 's'.repeat(40);
const DISCORD_ID = '123456789012345678';

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  v: 1,
  mode: 'Vanilla',
  modeId: 'vanilla',
  areas: { unit: 'areas', unlocked: 34, total: 88 },
  chunks: { unlocked: 120, total: 624 },
  quests: { done: 21, total: 212 },
  diaryTasks: { done: 40, total: 492 },
  ca: { points: 12, tier: 'Easy' },
  recent: [{ text: 'Unlocked Desert Battlefield', at: 1_790_000_000_000 }],
  ...overrides,
});

const call = (env: unknown, path: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://relay.test${path}`, init), env as never);

const publish = (env: unknown, body: unknown, token = TOKEN) => call(env, `/p/${RUN}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const bot = (env: unknown, method: string, body?: unknown, secret = SECRET) => call(env, `/l/${DISCORD_ID}`, {
  method,
  headers: { Authorization: `Bearer ${secret}` },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe('progress snapshots', () => {
  it('keeps only the known fields', () => {
    expect(validProgressSnapshot({ ...snapshot(), save: 'FLSYNC.g1.x', token: TOKEN })).toEqual(snapshot());
  });

  it('refuses a snapshot with a count out of range or a field of the wrong shape', () => {
    expect(validProgressSnapshot(snapshot({ quests: { done: 300, total: 212 } }))).toBeNull();
    expect(validProgressSnapshot(snapshot({ areas: { unit: 'regions', unlocked: 1, total: 2 } }))).toBeNull();
    expect(validProgressSnapshot(snapshot({ rulesTag: 'anything' }))).toBeNull();
    expect(validProgressSnapshot(snapshot({ recent: Array(6).fill({ text: 'x', at: 1 }) }))).toBeNull();
    expect(validProgressSnapshot(snapshot({ v: 2 }))).toBeNull();
    expect(validProgressSnapshot(snapshot({ rulesTag: 'R-7F3A', account: 'Nubles', startedAt: 1 })))
      .toMatchObject({ rulesTag: 'R-7F3A', account: 'Nubles', startedAt: 1 });
  });

  it('makes link codes from the unambiguous alphabet and reads them back however they were typed', () => {
    const code = newLinkCode(bytes => bytes.map((_, index) => index * 37));
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(normalizeLinkCode(` ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `)).toBe(code);
    expect(normalizeLinkCode('ILOU0000')).toBeNull();
    expect(normalizeLinkCode('ABC')).toBeNull();
  });

  it('finds the unlocks a publish added, oldest first, and none on a first publish', () => {
    const before = snapshot({ recent: [{ text: 'B', at: 20 }, { text: 'A', at: 10 }] });
    const after = snapshot({ recent: [{ text: 'D', at: 40 }, { text: 'C', at: 30 }, { text: 'B', at: 20 }] });
    expect(newUnlocksSince(before, after)).toEqual([{ text: 'C', at: 30 }, { text: 'D', at: 40 }]);
    expect(newUnlocksSince(after, after)).toEqual([]);
    expect(newUnlocksSince(null, after)).toEqual([]);
  });
});

describe('what a publish may post in #live-unlocks', () => {
  const NOW = 1_790_000_000_000;
  const before = snapshot({ recent: [{ text: 'A', at: NOW - 10_000 }] });
  const after = (overrides: Record<string, unknown> = {}) => snapshot({ recent: [{ text: 'B', at: NOW - 1_000 }, { text: 'A', at: NOW - 10_000 }], ...overrides });

  it('posts new unlocks and counts the post in the hour', () => {
    const feed = feedForPublish(null, before, after(), NOW);
    expect(feed.newUnlocks).toEqual([{ text: 'B', at: NOW - 1_000 }]);
    expect(feed.meta).toEqual({ feedWindow: NOW, feedPosts: 1 });
  });

  it(`posts at most ${FEED_POSTS_PER_HOUR} times an hour, then starts a new hour`, () => {
    const full = { writeHash: 'x', feedWindow: NOW - 1_000, feedPosts: FEED_POSTS_PER_HOUR };
    expect(feedForPublish(full, before, after(), NOW)).toMatchObject({ newUnlocks: [], reason: 'rate', meta: { feedPosts: FEED_POSTS_PER_HOUR } });
    const later = NOW - 1_000 + FEED_WINDOW_MS;
    expect(feedForPublish(full, before, after(), later)).toMatchObject({ newUnlocks: [{ text: 'B' }], meta: { feedWindow: later, feedPosts: 1 } });
  });

  it('posts nothing when the area count leaps, or for an unlock dated in the future', () => {
    expect(feedForPublish(null, before, after({ areas: { unit: 'areas', unlocked: 88, total: 88 } }), NOW))
      .toMatchObject({ newUnlocks: [], reason: 'jump' });
    const future = snapshot({ recent: [{ text: 'Later', at: NOW + 60 * 60 * 1000 }, { text: 'A', at: NOW - 10_000 }] });
    expect(feedForPublish(null, before, future, NOW).newUnlocks).toEqual([]);
  });

  it('posts nothing for a first publish, as before', () => {
    expect(feedForPublish(null, null, after(), NOW)).toMatchObject({ newUnlocks: [], meta: { feedPosts: 0 } });
  });
});

describe('Fate relay shared progress', () => {
  let kv: MemoryKv;
  let env: { RELAY: MemoryKv; PROGRESS_BOT_SECRET?: string };

  beforeEach(() => {
    kv = new MemoryKv();
    env = { RELAY: kv, PROGRESS_BOT_SECRET: SECRET };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores a published snapshot for 90 days, claimed by its write token', async () => {
    const response = await publish(env, snapshot());
    expect(response.status).toBe(200);
    expect(JSON.parse(kv.records.get(`p:${RUN}`)!)).toEqual(snapshot());
    expect(kv.ttls.get(`p:${RUN}`)).toBe(PROGRESS_TTL_SECONDS);
    expect(JSON.stringify(kv.metadata.get(`p:${RUN}`))).not.toContain(TOKEN);

    expect((await publish(env, snapshot(), OTHER_TOKEN)).status).toBe(403);
    expect((await call(env, `/p/${RUN}`, { method: 'DELETE', headers: { Authorization: `Bearer ${OTHER_TOKEN}` } })).status).toBe(403);
  });

  it('refuses a publish without a token, a bad snapshot, and a second publish within a minute', async () => {
    expect((await call(env, `/p/${RUN}`, { method: 'POST', body: JSON.stringify(snapshot()) })).status).toBe(403);
    expect((await publish(env, { v: 1 })).status).toBe(400);
    expect((await publish(env, snapshot())).status).toBe(200);
    const again = await publish(env, snapshot({ quests: { done: 22, total: 212 } }));
    expect(again.status).toBe(429);
    expect(Number(again.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('writes nothing for the summary it already holds, until it is a month old', async () => {
    const first = await publish(env, snapshot());
    const { updatedAt } = await first.json() as { updatedAt: number };
    // The first publish claims the run: its summary and its owner record.
    expect(kv.puts).toEqual([`p:${RUN}`, `own:p:${RUN}`]);

    // A reload sends the same summary, within the minute or later: no KV write.
    const same = await publish(env, snapshot());
    expect(same.status).toBe(200);
    expect(await same.json()).toEqual({ updatedAt, unchanged: true });
    vi.spyOn(Date, 'now').mockReturnValue(updatedAt + 10 * 86_400_000);
    expect((await publish(env, snapshot())).status).toBe(200);
    expect(kv.puts).toEqual([`p:${RUN}`, `own:p:${RUN}`]);
    // Another token still can't touch it.
    expect((await publish(env, snapshot(), OTHER_TOKEN)).status).toBe(403);

    // A month on, it is stored again, so it doesn't expire while shared.
    vi.spyOn(Date, 'now').mockReturnValue(updatedAt + PROGRESS_UNCHANGED_REFRESH_MS);
    const refreshed = await publish(env, snapshot());
    expect(await refreshed.json()).toEqual({ updatedAt: updatedAt + PROGRESS_UNCHANGED_REFRESH_MS });
    // The owner record is over a week old, so it is refreshed with it.
    expect(kv.puts).toEqual([`p:${RUN}`, `own:p:${RUN}`, `p:${RUN}`, `own:p:${RUN}`]);
  });

  it('has no public read of a private run: a GET answers 404, the same as a missing run', async () => {
    expect((await call(env, `/p/${RUN}`)).status).toBe(404);
    await publish(env, snapshot());
    const read = await call(env, `/p/${RUN}`);
    expect(read.status).toBe(404);
    expect(await read.text()).not.toContain('Desert Battlefield');
    expect((await call(env, `/p/${RUN}/link-code`)).status).toBe(405);
  });

  it('serves a public Adventurer\'s Log to anyone, with its map, and caches it for a minute', async () => {
    const map = 'A'.repeat(271) + 'B';
    await publish(env, snapshot({ public: true, map }));
    const read = await call(env, `/p/${RUN}`, { headers: { Origin: 'https://elsewhere.test' } });
    expect(read.status).toBe(200);
    expect(read.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(read.headers.get('Cache-Control')).toBe('public, max-age=60');
    const body = await read.json() as { snapshot: Record<string, unknown>; updatedAt: number };
    expect(body.snapshot).toEqual(snapshot({ public: true, map }));
    expect(body.updatedAt).toBeGreaterThan(0);
    // Reads never write.
    expect(kv.puts).toEqual([`p:${RUN}`, `own:p:${RUN}`]);
  });

  it('accepts only a well-formed map and a public flag of true', () => {
    expect(validProgressSnapshot(snapshot({ map: 'A'.repeat(272) }))).toMatchObject({ map: 'A'.repeat(272) });
    expect(validProgressSnapshot(snapshot({ map: 'A'.repeat(100) }))).toBeNull();
    expect(validProgressSnapshot(snapshot({ map: '!'.repeat(272) }))).toBeNull();
    expect(validProgressSnapshot(snapshot({ public: false }))).toBeNull();
    expect(validProgressSnapshot(snapshot({ public: 'yes' }))).toBeNull();
    expect(validProgressSnapshot(snapshot())).not.toHaveProperty('public');
  });

  it('goes private again when a later publish drops the public flag', async () => {
    const first = await publish(env, snapshot({ public: true }));
    const { updatedAt } = await first.json() as { updatedAt: number };
    expect((await call(env, `/p/${RUN}`)).status).toBe(200);
    vi.spyOn(Date, 'now').mockReturnValue(updatedAt + 61_000);
    expect((await publish(env, snapshot())).status).toBe(200);
    expect((await call(env, `/p/${RUN}`)).status).toBe(404);
  });

  it('links a Discord user with a one-time code, then serves that user the run', async () => {
    const noRun = await call(env, `/p/${RUN}/link-code`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(noRun.status).toBe(404);

    await publish(env, snapshot());
    const issued = await call(env, `/p/${RUN}/link-code`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(issued.status).toBe(200);
    const { code } = await issued.json() as { code: string };
    expect(kv.ttls.get(`lc:${code}`)).toBe(LINK_CODE_TTL_SECONDS);

    const claimed = await bot(env, 'POST', { code: code.toLowerCase() });
    expect(claimed.status).toBe(200);
    expect(await claimed.json()).toMatchObject({ linked: true, snapshot: snapshot() });
    expect(kv.records.has(`lc:${code}`)).toBe(false);
    expect((await bot(env, 'POST', { code })).status).toBe(404);

    const read = await bot(env, 'GET');
    expect(await read.json()).toMatchObject({ linked: true, snapshot: { quests: { done: 21 } } });
  });

  it('reports a linked run that stopped sharing, and an unlinked user', async () => {
    await publish(env, snapshot());
    const issued = await call(env, `/p/${RUN}/link-code`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
    await bot(env, 'POST', await issued.json());

    await call(env, `/p/${RUN}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(await (await bot(env, 'GET')).json()).toEqual({ linked: true, snapshot: null });

    await bot(env, 'DELETE');
    const unlinked = await bot(env, 'GET');
    expect(unlinked.status).toBe(404);
    expect(await unlinked.json()).toEqual({ linked: false });
  });

  describe('telling the Discord bot about a linked run', () => {
    const EVENTS_URL = 'https://bot.test/api/progress-events';
    let sent: { url: string; init: RequestInit }[];

    beforeEach(() => {
      sent = [];
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
        sent.push({ url, init });
        return new Response('{}');
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const linkRun = async () => {
      await publish(env, snapshot());
      const issued = await call(env, `/p/${RUN}/link-code`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
      await bot(env, 'POST', await issued.json());
    };

    const republish = async (body: unknown) => {
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
      return publish(env, body);
    };

    it('sends a linked run\'s new unlocks with the bot\'s secret, after the response when it can', async () => {
      (env as Record<string, unknown>).DISCORD_EVENTS_URL = EVENTS_URL;
      await linkRun();
      expect(kv.records.get(`ld:${RUN}`)).toBe(DISCORD_ID);
      expect(sent).toHaveLength(0);

      const next = snapshot({ recent: [{ text: 'Unlocked Lava Maze', at: 1_790_000_100_000 }, ...snapshot().recent] });
      const waits: Promise<unknown>[] = [];
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
      const response = await worker.fetch(new Request(`https://relay.test/p/${RUN}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify(next),
      }), env as never, { waitUntil: (work: Promise<unknown>) => waits.push(work) } as never);
      expect(response.status).toBe(200);
      await Promise.all(waits);

      expect(sent).toHaveLength(1);
      expect(sent[0].url).toBe(EVENTS_URL);
      expect((sent[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
      expect(JSON.parse(sent[0].init.body as string)).toMatchObject({
        discordId: DISCORD_ID,
        snapshot: next,
        newUnlocks: [{ text: 'Unlocked Lava Maze', at: 1_790_000_100_000 }],
      });
    });

    it('still tells the bot about a publish whose area count leapt, but with no unlocks to post', async () => {
      (env as Record<string, unknown>).DISCORD_EVENTS_URL = EVENTS_URL;
      await linkRun();
      const leapt = snapshot({ areas: { unit: 'areas', unlocked: 88, total: 88 }, recent: [{ text: 'Unlocked everything', at: 1_790_000_100_000 }, ...snapshot().recent] });
      expect((await republish(leapt)).status).toBe(200);
      expect(sent).toHaveLength(1);
      expect(JSON.parse(sent[0].init.body as string)).toMatchObject({ snapshot: leapt, newUnlocks: [] });
      expect(kv.metadata.get(`p:${RUN}`)).toMatchObject({ feedPosts: 0 });
    });

    it('sends nothing for an unlinked run, without an events URL, or after /unlink', async () => {
      await linkRun();
      await republish(snapshot({ quests: { done: 22, total: 212 } }));
      expect(sent).toHaveLength(0);

      (env as Record<string, unknown>).DISCORD_EVENTS_URL = EVENTS_URL;
      await bot(env, 'DELETE');
      expect(kv.records.has(`ld:${RUN}`)).toBe(false);
      vi.restoreAllMocks();
      await republish(snapshot({ quests: { done: 23, total: 212 } }));
      expect(sent).toHaveLength(0);
    });

    it('sends nothing for a publish of the summary the relay already holds', async () => {
      (env as Record<string, unknown>).DISCORD_EVENTS_URL = EVENTS_URL;
      await linkRun();
      expect((await republish(snapshot())).status).toBe(200);
      expect(sent).toHaveLength(0);
    });

    it('still accepts the publish when the bot cannot be reached', async () => {
      (env as Record<string, unknown>).DISCORD_EVENTS_URL = EVENTS_URL;
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await linkRun();
      expect((await republish(snapshot({ quests: { done: 22, total: 212 } }))).status).toBe(200);
    });

    it('gives a link made before the reverse index its pointer when the bot reads it', async () => {
      await publish(env, snapshot());
      // Such a link only exists on a run stored before claims and owner records were recorded.
      kv.metadata.set(`p:${RUN}`, { ...kv.metadata.get(`p:${RUN}`) as object, claimedAt: undefined });
      kv.records.delete(`own:p:${RUN}`);
      kv.records.set(`l:${DISCORD_ID}`, RUN);
      await bot(env, 'GET');
      expect(kv.records.get(`ld:${RUN}`)).toBe(DISCORD_ID);
    });
  });

  it('serves Discord links only to the bot, and to nobody when no secret is set', async () => {
    expect((await bot(env, 'GET', undefined, 'x'.repeat(40))).status).toBe(403);
    delete env.PROGRESS_BOT_SECRET;
    expect((await bot(env, 'GET')).status).toBe(403);
  });
});

describe('ownership of a shared-progress id outlives its record', () => {
  const EVENTS_URL = 'https://bot.test/api/progress-events';
  const OTHER_DISCORD_ID = '876543210987654321';
  let kv: MemoryKv;
  let env: Record<string, unknown>;
  let sent: { discordId: string; snapshot: Record<string, unknown> }[];
  let now: number;

  const sha256 = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  const del = (token = TOKEN) => call(env, `/p/${RUN}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  const askCode = (token = TOKEN) => call(env, `/p/${RUN}/link-code`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const linkAs = async (discordId: string) => {
    const issued = await askCode();
    expect(issued.status).toBe(200);
    return call(env, `/l/${discordId}`, { method: 'POST', headers: { Authorization: `Bearer ${SECRET}` }, body: JSON.stringify(await issued.json()) });
  };
  const botRead = (discordId = DISCORD_ID) => call(env, `/l/${discordId}`, { headers: { Authorization: `Bearer ${SECRET}` } });
  const later = (ms = 61_000) => { now += ms; };
  const withUnlock = (text: string, extra: Record<string, unknown> = {}) =>
    snapshot({ recent: [{ text, at: now - 1_000 }, ...snapshot().recent], ...extra });
  /** A run stored before owner records: its write token's hash only in the summary's metadata. */
  const seedOldRecord = async () => {
    kv.records.set(`p:${RUN}`, JSON.stringify(validProgressSnapshot(snapshot())));
    kv.metadata.set(`p:${RUN}`, { writeHash: await sha256(TOKEN), updatedAt: now - 2 * 86_400_000 });
  };
  /** A Discord link as relays before this change stored it: plain values, no metadata. */
  const seedOldLink = (discordId = DISCORD_ID, reverse = true) => {
    kv.records.set(`l:${discordId}`, RUN);
    if (reverse) kv.records.set(`ld:${RUN}`, discordId);
  };

  beforeEach(() => {
    kv = new MemoryKv();
    env = { RELAY: kv, PROGRESS_BOT_SECRET: SECRET, DISCORD_EVENTS_URL: EVENTS_URL };
    sent = [];
    now = 1_790_000_500_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(init.body as string));
      return new Response('{}');
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps a stopped run its owner\'s: another token can\'t take the id or reach its Discord link', async () => {
    expect((await publish(env, snapshot())).status).toBe(200);
    expect((await linkAs(DISCORD_ID)).status).toBe(200);

    const stopped = await del();
    expect(stopped.status).toBe(200);
    expect(await stopped.json()).toEqual({ deleted: true });
    expect(kv.records.has(`p:${RUN}`)).toBe(false);

    later();
    const taken = await publish(env, withUnlock('Unlocked Forged Thing', { account: 'Forged' }), OTHER_TOKEN);
    expect(taken.status).toBe(403);
    expect(await taken.text()).toBe('forbidden');
    expect(kv.records.has(`p:${RUN}`)).toBe(false);
    expect((await askCode(OTHER_TOKEN)).status).toBe(403);
    expect((await del(OTHER_TOKEN)).status).toBe(403);
    expect(sent).toHaveLength(0);
    expect(await (await botRead()).json()).toEqual({ linked: true, snapshot: null });

    // The owner turns sharing back on with the same id and token, and keeps the link.
    later();
    expect((await publish(env, snapshot())).status).toBe(200);
    later();
    expect((await publish(env, withUnlock('Unlocked Lava Maze'))).status).toBe(200);
    expect(sent.map(event => event.discordId)).toEqual([DISCORD_ID, DISCORD_ID]);
    expect(sent[1].snapshot.account).toBeUndefined();
  });

  it('keeps an expired run its owner\'s while the owner record lives, which outlasts the summary', async () => {
    expect((await publish(env, snapshot())).status).toBe(200);
    expect((await linkAs(DISCORD_ID)).status).toBe(200);
    expect(kv.ttls.get(`own:p:${RUN}`)).toBe(PROGRESS_OWNER_TTL_SECONDS);
    expect(PROGRESS_OWNER_TTL_SECONDS).toBeGreaterThan(PROGRESS_TTL_SECONDS);
    // docs/shared-progress.md and docs/online-relay.md say 180 days.
    expect(PROGRESS_OWNER_TTL_SECONDS).toBe(180 * 86400);

    // The summary expires (90 days without a store); the owner record is still there.
    kv.records.delete(`p:${RUN}`);
    kv.metadata.delete(`p:${RUN}`);
    later();
    expect((await publish(env, withUnlock('Unlocked Forged Thing'), OTHER_TOKEN)).status).toBe(403);
    expect(sent).toHaveLength(0);

    expect((await publish(env, snapshot())).status).toBe(200);
    expect(kv.records.get(`ld:${RUN}`)).toBe(DISCORD_ID);
  });

  it('lets the owner of a run stored before owner records keep it, and records the owner on their next request', async () => {
    await seedOldRecord();
    seedOldLink();
    expect((await publish(env, snapshot(), OTHER_TOKEN)).status).toBe(403);

    // The owner's tab reloads: the same summary, accepted as before, and the owner record is made.
    const same = await publish(env, snapshot());
    expect(same.status).toBe(200);
    expect(await same.json()).toEqual({ updatedAt: now - 2 * 86_400_000, unchanged: true });
    expect(kv.puts).toEqual([`own:p:${RUN}`]);

    later();
    expect((await publish(env, withUnlock('Unlocked Lava Maze'))).status).toBe(200);
    expect(sent.map(event => event.discordId)).toEqual([DISCORD_ID]);
    expect((await del()).status).toBe(200);
    later();
    expect((await publish(env, snapshot(), OTHER_TOKEN)).status).toBe(403);
    expect(kv.records.get(`l:${DISCORD_ID}`)).toBe(RUN);
  });

  it('removes a Discord link left on an id nobody holds before a new token claims it', async () => {
    // Stopped or expired before this change: links remain, with no summary and no owner record.
    seedOldLink();
    const claimed = await publish(env, snapshot({ account: 'Someone' }), OTHER_TOKEN);
    expect(claimed.status).toBe(200);
    expect(kv.records.has(`l:${DISCORD_ID}`)).toBe(false);
    expect(kv.records.has(`ld:${RUN}`)).toBe(false);
    later();
    expect((await publish(env, withUnlock('Unlocked Something', { account: 'Someone' }), OTHER_TOKEN)).status).toBe(200);
    expect(sent).toHaveLength(0);
    const read = await botRead();
    expect(read.status).toBe(404);
    expect(await read.json()).toEqual({ linked: false });
  });

  it('never serves a new owner an older link the relay cannot find from the run', async () => {
    // A link made before the reverse index existed: l: only.
    seedOldLink(DISCORD_ID, false);
    expect((await publish(env, snapshot({ account: 'Someone' }), OTHER_TOKEN)).status).toBe(200);
    const read = await botRead();
    expect(read.status).toBe(404);
    expect(await read.json()).toEqual({ linked: false });
    expect(kv.records.has(`ld:${RUN}`)).toBe(false);
    later();
    expect((await publish(env, withUnlock('Unlocked Something'), OTHER_TOKEN)).status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it('drops every link of a run whose summary and owner record both expired, when another token claims it', async () => {
    expect((await publish(env, snapshot())).status).toBe(200);
    expect((await linkAs(OTHER_DISCORD_ID)).status).toBe(200);
    later();
    expect((await linkAs(DISCORD_ID)).status).toBe(200);
    expect(kv.records.get(`ld:${RUN}`)).toBe(DISCORD_ID);

    for (const key of [`p:${RUN}`, `own:p:${RUN}`]) {
      kv.records.delete(key);
      kv.metadata.delete(key);
    }
    later();
    expect((await publish(env, snapshot({ account: 'Someone' }), OTHER_TOKEN)).status).toBe(200);
    later();
    expect((await publish(env, withUnlock('Unlocked Something'), OTHER_TOKEN)).status).toBe(200);
    expect(sent).toHaveLength(0);
    expect((await botRead(DISCORD_ID)).status).toBe(404);
    expect((await botRead(OTHER_DISCORD_ID)).status).toBe(404);

    // The new owner can link their own Discord account as usual.
    expect((await call(env, `/p/${RUN}/link-code`, { method: 'POST', headers: { Authorization: `Bearer ${OTHER_TOKEN}` } })).status).toBe(200);
  });

  it('refreshes the owner record at most weekly: an unchanged publish writes nothing, a changed one only the summary', async () => {
    expect((await publish(env, snapshot())).status).toBe(200);
    expect(kv.puts).toEqual([`p:${RUN}`, `own:p:${RUN}`]);
    kv.puts = [];

    later();
    expect((await publish(env, snapshot())).status).toBe(200);
    expect(kv.puts).toEqual([]);
    expect((await publish(env, withUnlock('Unlocked Lava Maze'))).status).toBe(200);
    expect(kv.puts).toEqual([`p:${RUN}`]);
    kv.puts = [];

    later(8 * 86_400_000);
    expect((await publish(env, snapshot())).status).toBe(200);
    expect(kv.puts).toEqual([`p:${RUN}`, `own:p:${RUN}`]);
    kv.puts = [];
    later(86_400_000);
    expect((await publish(env, snapshot())).status).toBe(200);
    expect(kv.puts).toEqual([]);
  });
});
