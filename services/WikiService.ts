
import { WIKI_OVERRIDES } from '../constants';

interface WikiCacheEntry {
  url: string | null;
  timestamp: number;
}

const CACHE_KEY = 'fate_uim_wiki_cache_v2';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 Days
const BASE_API = 'https://oldschool.runescape.wiki/api.php';

class WikiService {
  private memoryCache: Map<string, string | null>;
  private batchQueue: Set<string>;
  private batchTimeout: number | null;
  private pendingResolvers: Map<string, ((url: string | null) => void)[]>;

  constructor() {
    this.memoryCache = new Map();
    this.batchQueue = new Set();
    this.batchTimeout = null;
    this.pendingResolvers = new Map();
    this.loadCache();
  }

  private loadCache() {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        const parsed: Record<string, WikiCacheEntry> = JSON.parse(saved);
        const now = Date.now();
        Object.entries(parsed).forEach(([key, entry]) => {
          if (now - entry.timestamp < CACHE_TTL) {
            this.memoryCache.set(key, entry.url);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load Wiki cache', e);
    }
  }

  private saveCache() {
    try {
      const serializable: Record<string, WikiCacheEntry> = {};
      this.memoryCache.forEach((val, key) => {
        serializable[key] = { url: val, timestamp: Date.now() };
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.warn('Wiki cache quota exceeded', e);
    }
  }

  private normalize(input: string): string {
    if (!input) return '';
    const override = WIKI_OVERRIDES[input];
    if (override) return override;
    // Capitalize first letter, replace spaces with underscores
    let formatted = input.charAt(0).toUpperCase() + input.slice(1);
    return formatted.trim().replace(/ /g, '_');
  }

  public async fetchImage(itemName: string): Promise<string | null> {
    const term = this.normalize(itemName);
    if (!term) return null;

    // Check Cache
    if (this.memoryCache.has(term)) {
      return this.memoryCache.get(term) || null;
    }

    // Queue Request
    return new Promise((resolve) => {
      if (!this.pendingResolvers.has(term)) {
        this.pendingResolvers.set(term, []);
      }
      this.pendingResolvers.get(term)!.push(resolve);

      this.batchQueue.add(term);

      if (!this.batchTimeout) {
        this.batchTimeout = window.setTimeout(() => this.processQueue(), 50);
      }
    });
  }

  private async processQueue() {
    if (this.batchTimeout) clearTimeout(this.batchTimeout);
    this.batchTimeout = null;

    const queue = Array.from(this.batchQueue);
    this.batchQueue.clear();

    if (queue.length === 0) return;

    // Chunk into batches of 50 (MediaWiki API limit for non-bots)
    const CHUNK_SIZE = 50;
    for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
      const chunk = queue.slice(i, i + CHUNK_SIZE);
      await this.fetchBatch(chunk);
    }
  }

  private async fetchBatch(titles: string[]) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '300',
      titles: titles.join('|'),
      format: 'json',
      origin: '*',
      redirects: '1'
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`${BASE_API}?${params.toString()}`, {
        signal: controller.signal,
        headers: { 'Api-User-Agent': 'FateLockedUIM/1.0 (https://github.com/Nubles/flitest)' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      const pages = data.query?.pages || {};
      const redirects = data.query?.redirects || [];
      const normalized = data.query?.normalized || [];

      // Map final titles to URLs
      const urlMap: Record<string, string | null> = {};
      Object.values(pages).forEach((p: any) => {
        urlMap[p.title] = p.thumbnail?.source || null;
      });

      // Resolve original requested titles
      titles.forEach(requestedTitle => {
        let finalTitle = requestedTitle;

        // Check normalization
        const norm = normalized.find((n: any) => n.from === requestedTitle);
        if (norm) finalTitle = norm.to;

        // Check redirects
        const red = redirects.find((r: any) => r.from === finalTitle);
        if (red) finalTitle = red.to;

        const url = urlMap[finalTitle] || null;

        this.memoryCache.set(requestedTitle, url);

        this.resolvePending(requestedTitle, url);
      });

      this.saveCache();

    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('Wiki Batch Error/Timeout', error);
      // Resolve all pending as null so UI falls back immediately.
      // Do not cache network errors, allowing retry on refresh.
      titles.forEach(t => this.resolvePending(t, null));
    }
  }

  /** Resolve and clean up all pending promises for a given title */
  private resolvePending(title: string, url: string | null) {
    const resolvers = this.pendingResolvers.get(title);
    if (resolvers) {
      resolvers.forEach(r => r(url));
      this.pendingResolvers.delete(title);
    }
  }
}

export const wikiService = new WikiService();
