import { afterEach, describe, expect, it, vi } from 'vitest';
import { clanFeed as relayClanFeed } from '../workers/fate-relay/clan.js';
import { clanLines, fetchClanFeed, parseClanFeed, resetClanFeedCache } from './clanFeed';

const entry = (overrides: Record<string, unknown> = {}) => ({
  name: 'Whim',
  mode: 'Vanilla',
  items: ['Unlocked Lava Maze (Areas)'],
  at: 1_790_000_000_000,
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetClanFeedCache();
});

describe('the clan feed', () => {
  it('reads what the relay passes on, newest first', () => {
    const relayed = relayClanFeed({ entries: [entry({ at: 1 }), entry({ at: 2, more: 3 })] });
    expect(parseClanFeed({ entries: relayed })).toEqual([entry({ at: 2, more: 3 }), entry({ at: 1 })]);
  });

  it('skips an entry it cannot show and refuses an answer that is not a feed', () => {
    expect(parseClanFeed({ entries: [entry({ name: '' }), entry({ items: [7] }), { nope: true }, entry()] })).toEqual([entry()]);
    expect(parseClanFeed({ entries: 'x' })).toBeNull();
    expect(parseClanFeed(null)).toBeNull();
  });

  it('makes one chat line per unlock, oldest at the top, and says how many a post left out', () => {
    const lines = clanLines([
      entry({ name: 'Mo', items: ['Unlocked Prayer tier 2 · Breakthrough'], at: 3 }),
      entry({ items: ['Unlocked Varrock (Areas)', 'Unlocked Vorkath (Bosses)'], more: 4, at: 2 }),
    ]);
    expect(lines.map(line => `${line.name} ${line.text}`)).toEqual([
      'Whim unlocked Varrock (Areas).',
      'Whim unlocked Vorkath (Bosses), and 4 more.',
      'Mo unlocked Prayer tier 2 · Breakthrough.',
    ]);
    expect(new Set(lines.map(line => line.key)).size).toBe(3);
  });

  it('asks the relay once a minute at most, and gives null when it cannot answer', async () => {
    const fetchMock = vi.fn(async () => Response.json({ entries: [entry()] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchClanFeed('https://relay.test', 1_000)).toEqual([entry()]);
    expect(await fetchClanFeed('https://relay.test', 30_000)).toEqual([entry()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://relay.test/clan');

    fetchMock.mockImplementation(async () => new Response('down', { status: 502 }));
    expect(await fetchClanFeed('https://relay.test', 70_000)).toBeNull();
    fetchMock.mockImplementation(async () => { throw new Error('offline'); });
    expect(await fetchClanFeed('https://relay.test', 140_000)).toBeNull();
  });
});
