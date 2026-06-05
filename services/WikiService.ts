
import { WIKI_OVERRIDES } from '../constants';

interface WikiCacheEntry {
  url: string | null;
  timestamp: number;
}

// Bump the version when image resolution logic changes so stale negative
// (null) cache entries from older logic are discarded.
const CACHE_KEY = 'fate_uim_wiki_cache_v3';
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

  /**
   * OSRS Wiki item articles use sentence case ("Barronite shards"), but the
   * app stores many names in title case ("Barronite Shards"). This produces
   * the sentence-cased variant so we can fall back to it when the title-cased
   * page doesn't exist. Proper-noun pages (e.g. "King_Black_Dragon") are tried
   * first, so this never overrides a working title-cased lookup.
   */
  private sentenceCaseVariant(term: string): string {
    if (!term) return term;
    return term.charAt(0) + term.slice(1).toLowerCase();
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

    // Chunk into batches of 25 requested names. Each name may add a
    // sentence-cased variant, so the query stays within the 50-title API limit.
    const CHUNK_SIZE = 25;
    for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
      const chunk = queue.slice(i, i + CHUNK_SIZE);
      await this.fetchBatch(chunk);
    }
  }

  private async fetchBatch(titles: string[]) {
    // Query each requested title plus its sentence-cased variant so that
    // title-cased app names still resolve to sentence-cased wiki articles.
    const queryTitles = new Set<string>();
    for (const t of titles) {
      queryTitles.add(t);
      queryTitles.add(this.sentenceCaseVariant(t));
    }

    const params = new URLSearchParams({
      action: 'query',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '300',
      titles: Array.from(queryTitles).join('|'),
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

      // Follow normalization + redirects for a given title to its image URL.
      const resolveTitle = (title: string): string | null => {
        let finalTitle = title;
        const norm = normalized.find((n: any) => n.from === finalTitle);
        if (norm) finalTitle = norm.to;
        const red = redirects.find((r: any) => r.from === finalTitle);
        if (red) finalTitle = red.to;
        return urlMap[finalTitle] || null;
      };

      // Resolve original requested titles, falling back to the sentence-cased
      // variant when the title-cased page has no image.
      const resolved: Record<string, string | null> = {};
      const stillNull: string[] = [];
      titles.forEach(requestedTitle => {
        let url = resolveTitle(requestedTitle);
        if (!url) {
          const variant = this.sentenceCaseVariant(requestedTitle);
          if (variant !== requestedTitle) url = resolveTitle(variant);
        }
        resolved[requestedTitle] = url;
        if (!url) stillNull.push(requestedTitle);
      });

      // Fallback: a handful of item pages have no lead "pageimage" set (e.g.
      // currency/cosmetic pages like the house scarves or the Wintertodt supply
      // crate) but DO have an inventory icon file named after the item. Look
      // those up directly so they show an icon instead of a "?".
      if (stillNull.length) {
        const fileUrls = await this.fetchFileUrls(stillNull);
        for (const t of stillNull) if (fileUrls[t]) resolved[t] = fileUrls[t];
      }

      titles.forEach(t => {
        this.memoryCache.set(t, resolved[t]);
        this.resolvePending(t, resolved[t]);
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

  /**
   * Direct-icon fallback. For normalized item titles whose wiki page had no
   * `pageimage`, ask for the inventory-icon file (item name + ".png") and use
   * its URL. The API treats spaces/underscores in titles as equivalent.
   */
  private async fetchFileUrls(titles: string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    const fileTitles = titles.map(t => `File:${t}.png`);
    const params = new URLSearchParams({
      action: 'query', prop: 'imageinfo', iiprop: 'url',
      titles: fileTitles.join('|'), format: 'json', origin: '*',
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${BASE_API}?${params.toString()}`, {
        signal: controller.signal,
        headers: { 'Api-User-Agent': 'FateLockedUIM/1.0 (https://github.com/Nubles/flitest)' },
      });
      clearTimeout(timeoutId);
      if (!res.ok) return out;
      const data = await res.json();
      const pages = data.query?.pages || {};
      const byFile: Record<string, string> = {};
      Object.values(pages).forEach((p: any) => {
        const url = p.imageinfo?.[0]?.url;
        if (url) byFile[String(p.title).replace(/ /g, '_')] = url;
      });
      for (const t of titles) out[t] = byFile[`File:${t}.png`] || null;
    } catch {
      clearTimeout(timeoutId);
    }
    return out;
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
