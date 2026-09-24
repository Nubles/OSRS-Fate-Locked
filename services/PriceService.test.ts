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
