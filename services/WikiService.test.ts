// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CACHE_KEY = 'fate_uim_wiki_cache_v3';
const DAY = 24 * 60 * 60 * 1000;

const imageResponse = (title: string, source: string) => new Response(JSON.stringify({
  query: { pages: { 1: { title, thumbnail: { source } } } },
}), { status: 200, headers: { 'content-type': 'application/json' } });

describe('WikiService cache', () => {
  const storage = new Map<string, string>();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    });
    fetchMock = vi.fn(async () => imageResponse('New_item', 'https://img.test/new.png'));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps each entry\'s own timestamp so cached "no image" results expire', async () => {
    const start = Date.now();
    const cachedAt = start - 6 * DAY;
    storage.set(CACHE_KEY, JSON.stringify({
      Old_item: { url: null, timestamp: cachedAt },
    }));

    const { wikiService } = await import('./WikiService');
    // Served from the six-day-old negative cache entry without a request.
    expect(await wikiService.fetchImage('Old item')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    // A later lookup saves the cache; the old entry keeps its own age.
    expect(await wikiService.fetchImage('New item')).toBe('https://img.test/new.png');
    const saved = JSON.parse(storage.get(CACHE_KEY)!);
    expect(saved.Old_item).toEqual({ url: null, timestamp: cachedAt });
    expect(saved.New_item.url).toBe('https://img.test/new.png');
    expect(saved.New_item.timestamp).toBeGreaterThanOrEqual(start);

    // Two days on, the negative entry is past the 7-day TTL and is looked up again.
    vi.spyOn(Date, 'now').mockReturnValue(start + 2 * DAY);
    vi.resetModules();
    fetchMock.mockClear();
    fetchMock.mockImplementation(async () => imageResponse('Old_item', 'https://img.test/old.png'));
    const { wikiService: reloaded } = await import('./WikiService');
    expect(await reloaded.fetchImage('Old item')).toBe('https://img.test/old.png');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
