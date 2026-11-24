
const MAPPING_API = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const PRICES_API = 'https://prices.runescape.wiki/api/v1/osrs/latest';
// v1 held the bare name -> id object with no timestamp and was never refreshed,
// so items added or renamed after a player's first visit never got a price.
// v2 is { timestamp, data }. A v1 copy still loads, as a stale fallback.
const CACHE_KEY_MAPPING_LEGACY = 'fate_osrs_mapping_v1';
const CACHE_KEY_MAPPING = 'fate_osrs_mapping_v2';
const CACHE_KEY_PRICES = 'fate_osrs_prices_v1';
const PRICE_TTL = 1000 * 60 * 60; // 1 Hour
const MAPPING_TTL = 1000 * 60 * 60 * 24 * 7; // 1 Week

interface PriceMapping {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  lowalch: number;
  limit: number;
  value: number;
}

interface PriceData {
  high: number;
  highTime: number;
  low: number;
  lowTime: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Disposable cache entry, or null when missing, unreadable or corrupt. */
const readCachedObject = (key: string): Record<string, unknown> | null => {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

class PriceService {
  private nameToId: Record<string, number> = {};
  private prices: Record<number, PriceData> = {};
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  async init() {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.performInit();
    return this.initializationPromise;
  }

  private async performInit() {
    try {
      // 1. Load Mapping (changes rarely: refresh weekly, keep a stale copy as fallback)
      await this.loadMapping();

      // 2. Load Prices (Volatile, cache for TTL)
      await this.refreshPrices();
      this.initialized = true;
    } catch (e) {
      // Reset so next call can retry
      this.initializationPromise = null;
      throw e;
    }
  }

  private async loadMapping() {
    const now = Date.now();
    const cached = readCachedObject(CACHE_KEY_MAPPING);
    if (cached && typeof cached.timestamp === 'number' && isRecord(cached.data)) {
      this.nameToId = cached.data as Record<string, number>;
      if (now - cached.timestamp < MAPPING_TTL) return;
    } else {
      // A mapping stored before the timestamp existed: use it, but refresh it.
      const legacy = readCachedObject(CACHE_KEY_MAPPING_LEGACY);
      if (legacy) this.nameToId = legacy as Record<string, number>;
    }

    try {
      const res = await fetch(MAPPING_API, { headers: { 'User-Agent': 'FateLockedUIM/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error('Unexpected mapping response');
      const fresh: Record<string, number> = {};
      (data as PriceMapping[]).forEach(item => {
        if (typeof item?.name === 'string' && typeof item.id === 'number') {
          fresh[item.name.toLowerCase()] = item.id;
        }
      });
      if (Object.keys(fresh).length === 0) throw new Error('Empty mapping response');
      this.nameToId = fresh;
      try {
        localStorage.setItem(CACHE_KEY_MAPPING, JSON.stringify({ timestamp: now, data: fresh }));
        localStorage.removeItem(CACHE_KEY_MAPPING_LEGACY);
      } catch {
        // Storage full or blocked: the fresh mapping still serves this session.
      }
    } catch (e) {
      // Keep whatever stale copy was loaded above; the next visit retries.
      console.warn('Failed to load price mapping', e);
    }
  }

  async refreshPrices() {
    const cachedPrices = readCachedObject(CACHE_KEY_PRICES);
    const now = Date.now();

    if (
      cachedPrices
      && typeof cachedPrices.timestamp === 'number'
      && isRecord(cachedPrices.data)
      && now - cachedPrices.timestamp < PRICE_TTL
    ) {
      this.prices = cachedPrices.data as Record<number, PriceData>;
      return;
    }

    try {
      const res = await fetch(PRICES_API, { headers: { 'User-Agent': 'FateLockedUIM/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      // An error body must not be cached as "the prices" for the next hour.
      if (!isRecord(json) || !isRecord(json.data)) throw new Error('Unexpected prices response');
      this.prices = json.data as Record<number, PriceData>;
      localStorage.setItem(CACHE_KEY_PRICES, JSON.stringify({ timestamp: now, data: this.prices }));
    } catch (e) {
      console.warn('Failed to fetch prices', e);
    }
  }

  public getPrice(itemName: string): number {
    const id = this.nameToId[itemName.toLowerCase()];
    if (!id) return 0;
    const p = this.prices[id];
    // Use high price (instant buy) as a proxy for "value"
    return p ? (p.high || p.low || 0) : 0;
  }
}

export const priceService = new PriceService();
