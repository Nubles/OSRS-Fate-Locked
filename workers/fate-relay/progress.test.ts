import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import worker from './worker.js';
import {
  LINK_CODE_TTL_SECONDS,
  PROGRESS_TTL_SECONDS,
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

  async put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }) {
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
    const again = await publish(env, snapshot());
    expect(again.status).toBe(429);
    expect(Number(again.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('has no public read: a GET of a snapshot is refused', async () => {
    await publish(env, snapshot());
    expect((await call(env, `/p/${RUN}`)).status).toBe(405);
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

    it('sends nothing for an unlinked run, without an events URL, or after /unlink', async () => {
      await linkRun();
      await republish(snapshot());
      expect(sent).toHaveLength(0);

      (env as Record<string, unknown>).DISCORD_EVENTS_URL = EVENTS_URL;
      await bot(env, 'DELETE');
      expect(kv.records.has(`ld:${RUN}`)).toBe(false);
      vi.restoreAllMocks();
      await republish(snapshot());
      expect(sent).toHaveLength(0);
    });

    it('still accepts the publish when the bot cannot be reached', async () => {
      (env as Record<string, unknown>).DISCORD_EVENTS_URL = EVENTS_URL;
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await linkRun();
      expect((await republish(snapshot())).status).toBe(200);
    });

    it('gives a link made before the reverse index its pointer when the bot reads it', async () => {
      await publish(env, snapshot());
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
