import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import { MAX_CLAN_ENTRIES, clanFeed, forgetClanFeed } from './clan.js';

const SECRET = 's'.repeat(40);
const EVENTS_URL = 'https://bot.test/api/progress-events';

const call = (env: unknown, path: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://relay.test${path}`, init), env as never);

const entry = (overrides: Record<string, unknown> = {}) => ({
  name: 'Whim',
  mode: 'Vanilla',
  items: ['Unlocked Desert Battlefield'],
  at: 1_790_000_000_000,
  ...overrides,
});

describe('clan feed entries', () => {
  it('keeps only the known fields, newest first, and at most the cap', () => {
    const feed = clanFeed({
      entries: [
        { ...entry({ at: 1 }), discordId: '123456789012345678', url: 'https://discord.com/x' },
        entry({ at: 3, more: 4 }),
        ...Array.from({ length: 40 }, (_, index) => entry({ at: 100 + index })),
      ],
    });
    expect(feed).toHaveLength(MAX_CLAN_ENTRIES);
    expect(feed![0].at).toBe(139);
    expect(JSON.stringify(feed)).not.toContain('discord');
    expect(clanFeed({ entries: [entry({ at: 3, more: 4 }), entry({ at: 1, discordId: 'x' })] }))
      .toEqual([entry({ at: 3, more: 4 }), entry({ at: 1 })]);
  });

  it('skips a malformed entry and refuses an answer that is not a feed', () => {
    expect(clanFeed({ entries: [entry({ name: '' }), entry({ items: [] }), entry({ at: 'now' }), entry()] }))
      .toEqual([entry()]);
    expect(clanFeed({ entries: [entry({ items: Array(9).fill('Unlocked Varrock') })] })![0].items).toHaveLength(5);
    expect(clanFeed({})).toBeNull();
    expect(clanFeed(null)).toBeNull();
  });
});

describe('Fate relay clan feed', () => {
  let asked: { url: string; init: RequestInit }[];
  let answer: () => Response;

  beforeEach(() => {
    forgetClanFeed();
    asked = [];
    answer = () => Response.json({ entries: [entry({ discordId: '123456789012345678' })] });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      asked.push({ url, init });
      return answer();
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the bot with its secret on the events origin and passes on the cleaned entries', async () => {
    const env = { RELAY: {}, PROGRESS_BOT_SECRET: SECRET, DISCORD_EVENTS_URL: EVENTS_URL };
    const response = await call(env, '/clan', { headers: { Origin: 'https://nubles.github.io' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({ entries: [entry()] });
    expect(asked).toHaveLength(1);
    expect(asked[0].url).toBe('https://bot.test/api/clan-feed');
    expect((asked[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
  });

  it('asks the bot at most once a minute, answering from memory in between', async () => {
    const env = { RELAY: {}, PROGRESS_BOT_SECRET: SECRET, DISCORD_EVENTS_URL: EVENTS_URL };
    expect((await call(env, '/clan')).status).toBe(200);
    expect(await (await call(env, '/clan')).json()).toEqual({ entries: [entry()] });
    expect(asked).toHaveLength(1);
  });

  it('never touches KV', async () => {
    const touch = () => { throw new Error('the relay touched KV'); };
    const env = { RELAY: { get: touch, getWithMetadata: touch, put: touch, delete: touch }, PROGRESS_BOT_SECRET: SECRET, DISCORD_EVENTS_URL: EVENTS_URL };
    expect((await call(env, '/clan')).status).toBe(200);
  });

  it('answers 503 when the bot is not set up, 502 when it fails, and 405 to anything but GET', async () => {
    expect((await call({ RELAY: {} }, '/clan')).status).toBe(503);
    expect((await call({ RELAY: {}, PROGRESS_BOT_SECRET: SECRET, DISCORD_EVENTS_URL: 'http://bot.test/x' }, '/clan')).status).toBe(503);
    expect(asked).toEqual([]);

    const env = { RELAY: {}, PROGRESS_BOT_SECRET: SECRET, DISCORD_EVENTS_URL: EVENTS_URL };
    answer = () => new Response('nope', { status: 500 });
    expect((await call(env, '/clan')).status).toBe(502);
    answer = () => { throw new Error('offline'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call(env, '/clan')).status).toBe(502);
    expect((await call(env, '/clan', { method: 'POST' })).status).toBe(405);
  });
});
