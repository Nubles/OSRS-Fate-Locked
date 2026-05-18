
const MAPPING_API = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const PRICES_API = 'https://prices.runescape.wiki/api/v1/osrs/latest';
const CACHE_KEY_MAPPING = 'fate_osrs_mapping_v1';
const CACHE_KEY_PRICES = 'fate_osrs_prices_v1';
const PRICE_TTL = 1000 * 60 * 60; // 1 Hour

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
      // 1. Load Mapping (Persistent, update rarely)
      const cachedMapping = localStorage.getItem(CACHE_KEY_MAPPING);
      if (cachedMapping) {
        this.nameToId = JSON.parse(cachedMapping);
      } else {
        try {
          const res = await fetch(MAPPING_API, { headers: { 'User-Agent': 'FateLockedUIM/1.0' } });
          const data: PriceMapping[] = await res.json();
          data.forEach(item => {
            this.nameToId[item.name.toLowerCase()] = item.id;
          });
          localStorage.setItem(CACHE_KEY_MAPPING, JSON.stringify(this.nameToId));
        } catch (e) {
          console.warn('Failed to load price mapping', e);
        }
      }

      // 2. Load Prices (Volatile, cache for TTL)
      await this.refreshPrices();
      this.initialized = true;
    } catch (e) {
      // Reset so next call can retry
      this.initializationPromise = null;
      throw e;
    }
  }

  async refreshPrices() {
    const cachedPrices = localStorage.getItem(CACHE_KEY_PRICES);
    const now = Date.now();

    if (cachedPrices) {
      const { timestamp, data } = JSON.parse(cachedPrices);
      if (now - timestamp < PRICE_TTL) {
        this.prices = data;
        return;
      }
    }

    try {
      const res = await fetch(PRICES_API, { headers: { 'User-Agent': 'FateLockedUIM/1.0' } });
      const json = await res.json();
      this.prices = json.data;
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
