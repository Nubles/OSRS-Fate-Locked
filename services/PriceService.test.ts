// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MAPPING_KEY = 'fate_osrs_mapping_v1';
const PRICES_KEY = 'fate_osrs_prices_v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const loadService = async () => {
  vi.resetModules();
  return (await import('./PriceService')).priceService;
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PriceService', () => {
  it('does not cache an error response as the price table', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/mapping')
      ? jsonResponse([{ id: 4151, name: 'Abyssal whip' }])
      : jsonResponse({ error: 'rate limited' }, 429)));
    const service = await loadService();

    await service.init();

    expect(service.getPrice('Abyssal whip')).toBe(0);
    expect(localStorage.getItem(PRICES_KEY)).toBeNull();
  });

  it('recovers from corrupt caches instead of rejecting initialisation', async () => {
    localStorage.setItem(MAPPING_KEY, '{not json');
    localStorage.setItem(PRICES_KEY, JSON.stringify({ timestamp: Date.now() }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/mapping')
      ? jsonResponse([{ id: 4151, name: 'Abyssal whip' }])
      : jsonResponse({ data: { 4151: { high: 1_500_000, highTime: 1, low: 1_400_000, lowTime: 1 } } })));
    const service = await loadService();

    await expect(service.init()).resolves.toBeUndefined();

    expect(service.getPrice('Abyssal whip')).toBe(1_500_000);
  });
});

const MAPPING_V2_KEY = 'fate_osrs_mapping_v2';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const WHIP_PRICES = { data: { 4151: { high: 1_500_000, highTime: 1, low: 1_400_000, lowTime: 1 }, 1277: { high: 40, highTime: 1, low: 30, lowTime: 1 } } };
const NEW_MAPPING = [{ id: 4151, name: 'Abyssal whip' }, { id: 1277, name: 'Bronze shortsword' }];

const mappingCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/mapping')).length;

describe('PriceService mapping cache', () => {
  it('loads a mapping stored before it had a timestamp, then refreshes it', async () => {
    localStorage.setItem(MAPPING_KEY, JSON.stringify({ 'abyssal whip': 4151 }));
    const fetchMock = vi.fn(async (url: string) => url.endsWith('/mapping')
      ? jsonResponse(NEW_MAPPING)
      : jsonResponse(WHIP_PRICES));
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadService();

    await service.init();

    expect(mappingCalls(fetchMock)).toBe(1);
    expect(service.getPrice('Bronze shortsword')).toBe(40);
    expect(service.getPrice('Abyssal whip')).toBe(1_500_000);
    const stored = JSON.parse(localStorage.getItem(MAPPING_V2_KEY) ?? 'null');
    expect(typeof stored?.timestamp).toBe('number');
    expect(stored?.data?.['bronze shortsword']).toBe(1277);
  });

  it('keeps pricing from the old mapping when the refresh fails', async () => {
    localStorage.setItem(MAPPING_KEY, JSON.stringify({ 'abyssal whip': 4151 }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/mapping')
      ? jsonResponse({ error: 'down' }, 503)
      : jsonResponse(WHIP_PRICES)));
    const service = await loadService();

    await service.init();

    expect(service.getPrice('Abyssal whip')).toBe(1_500_000);
    expect(localStorage.getItem(MAPPING_KEY)).not.toBeNull();
  });

  it('does not fetch the mapping again while the stored copy is fresh', async () => {
    localStorage.setItem(MAPPING_V2_KEY, JSON.stringify({ timestamp: Date.now() - 1000, data: { 'abyssal whip': 4151 } }));
    const fetchMock = vi.fn(async (url: string) => url.endsWith('/mapping')
      ? jsonResponse(NEW_MAPPING)
      : jsonResponse(WHIP_PRICES));
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadService();

    await service.init();
    await service.init();

    expect(mappingCalls(fetchMock)).toBe(0);
    expect(service.getPrice('Abyssal whip')).toBe(1_500_000);
  });

  it('refreshes a stored mapping older than a week, keeping it if the fetch fails', async () => {
    localStorage.setItem(MAPPING_V2_KEY, JSON.stringify({ timestamp: Date.now() - WEEK - 1000, data: { 'abyssal whip': 4151 } }));
    const failing = vi.fn(async (url: string) => url.endsWith('/mapping')
      ? Promise.reject(new Error('offline'))
      : jsonResponse(WHIP_PRICES));
    vi.stubGlobal('fetch', failing);
    let service = await loadService();
    await service.init();
    expect(mappingCalls(failing)).toBe(1);
    expect(service.getPrice('Abyssal whip')).toBe(1_500_000);
    expect(service.getPrice('Bronze shortsword')).toBe(0);

    const working = vi.fn(async (url: string) => url.endsWith('/mapping')
      ? jsonResponse(NEW_MAPPING)
      : jsonResponse(WHIP_PRICES));
    vi.stubGlobal('fetch', working);
    service = await loadService();
    await service.init();
    expect(mappingCalls(working)).toBe(1);
    expect(service.getPrice('Bronze shortsword')).toBe(40);
  });
});
