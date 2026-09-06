/**
 * Runtime self-update for the Collection Log.
 *
 * The bundled data/collectionLogData.ts is a snapshot of the wiki log at build
 * time. This service fetches the wiki's authoritative source live and merges any
 * NEWLY-tracked items into the in-memory log — so when Jagex adds a drop and the
 * wiki records it, it appears in the app with NO redeploy. It is deliberately:
 *
 *   • additive only — never renames or deletes existing slots (those stay under
 *     the reviewed build-time data + `npm run clog:sync`); it only APPENDS items
 *     the bundle doesn't have yet, onto pages that already exist.
 *   • fail-safe — any network/parse error leaves the bundled data untouched.
 *   • lazy + cached — fetched once when the log is first opened, cached in
 *     localStorage (works offline afterwards), re-checked after the TTL.
 *
 * Brand-new *pages* (e.g. a new boss) are detected and exposed via `newSources`
 * for a heads-up, but NOT auto-added: a boss also needs a model, drop-rate, key
 * cost and gacha tier, which are human-curated (see CONTENT_SYNC.md).
 *
 * Mirrors the fetch/cache pattern of services/GearService.ts.
 */
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import { createClogIdAllocator } from '../utils/clogIdAllocation.mjs';
import { CLOG_ID_MIGRATIONS } from '../utils/clogIdMigrations';

const API = 'https://oldschool.runescape.wiki/api.php';
const DATA_TITLE = 'Module:Collection_log/data.json';
const LUA_TITLE = 'Module:Collection_log'; // holds the display-override table
// v2: v1 compared raw data.json names against the app's override-rendered names
// and cached spurious duplicate additions — bumped to discard that stale cache.
const CACHE_KEY = 'fate_clog_sync_v2';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

// App page-name (normalised) -> wiki page name, only where they differ.
const PAGE_ALIAS: Record<string, string> = {
  'mage training arena': 'Magic Training Arena',
};

interface WikiItem { id: number; name: string; tabs: string[]; }
interface Addition { tab: string; page: string; id: number; name: string; }
export interface NewSource { name: string; itemCount: number; }
interface SyncResult { additions: Addition[]; newSources: NewSource[]; }
type LogData = typeof COLLECTION_LOG_DATA;

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Pure diff: given the wiki's flat item list and the app's log data, return the
 * items to APPEND to existing pages (with freshly-minted, collision-free IDs)
 * and any brand-new wiki pages the app doesn't have. Exported for testing.
 *
 * `overrides` maps a wiki item id -> the display name the wiki actually RENDERS
 * (its Module:Collection_log override table). The bundled data already uses
 * those rendered names, so applying them here is essential: comparing the raw
 * data.json name ("Chompy bird hat") against the app's rendered name ("Chompy
 * bird hat (ogre bowman)") would otherwise treat it as new and add a duplicate.
 */
export function computeSync(wiki: WikiItem[], data: LogData, overrides: Record<number, string> = {}): SyncResult {
  // wiki page name -> ordered item names (rendered with overrides, as the app stores them)
  const wikiPages = new Map<string, string[]>();
  for (const it of wiki) {
    const name = overrides[it.id] !== undefined ? overrides[it.id] : it.name;
    for (const pg of it.tabs) {
      if (!wikiPages.has(pg)) wikiPages.set(pg, []);
      wikiPages.get(pg)!.push(name);
    }
  }

  // index app pages by normalised display name -> { tab, pageObj }
  const appByNorm = new Map<string, { tab: string; page: { name: string; items: { id: number; name: string }[] } }>();
  for (const [tab, tabData] of Object.entries(data))
    for (const page of Object.values(tabData.pages))
      appByNorm.set(norm(page.name), { tab, page });

  const additions: Addition[] = [];
  const newSources: NewSource[] = [];
  const allocatePage = createClogIdAllocator(Object.values(data).flatMap(tab =>
    Object.values(tab.pages).flatMap(page => page.items.map(item => item.id))));

  for (const [wikiName, items] of wikiPages) {
    const aliasTarget = Object.entries(PAGE_ALIAS).find(([, w]) => w === wikiName)?.[0];
    const match = appByNorm.get(norm(wikiName)) ?? (aliasTarget ? appByNorm.get(aliasTarget) : undefined);
    if (!match || match.page.items.length === 0) {
      if (!match) newSources.push({ name: wikiName, itemCount: items.length });
      continue;
    }
    const have = new Set(match.page.items.map(i => norm(i.name)));
    const mint = allocatePage(match.page.items.map(i => i.id));
    for (const name of items) {
      if (have.has(norm(name))) continue;
      have.add(norm(name));
      additions.push({ tab: match.tab, page: match.page.name, id: mint(), name });
    }
  }
  return { additions, newSources };
}

class CollectionLogSyncService {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  public ready = false;
  public error: string | null = null;
  public addedCount = 0;
  public newSources: NewSource[] = [];

  /** Subscribe to "data changed" (after a sync applied additions). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { this.listeners.forEach(fn => fn()); }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.perform();
    return this.initPromise;
  }

  private async perform() {
    try {
      this.error = null;
      const cached = this.loadCache();
      let result = cached;
      if (!result) {
        // Both sources are required: without the overrides we'd mis-read raw
        // names as new and add duplicates, so a failure here aborts the sync.
        const [items, overrides] = await Promise.all([this.fetchData(), this.fetchOverrides()]);
        result = computeSync(items, COLLECTION_LOG_DATA, overrides);
      }
      this.apply(result);
      if (!cached) this.saveCache(result);
      this.initialized = true;
      this.ready = true;
      if (this.addedCount > 0 || this.newSources.length > 0) this.emit();
    } catch (e) {
      console.warn('CollectionLogSync failed (using bundled data)', e);
      this.error = 'Could not check the wiki for new collection-log items.';
      this.initPromise = null; // allow retry later
      this.ready = false;
      // Non-fatal: the app keeps working on the bundled snapshot.
    }
  }

  /** Fetch the raw text content of a wiki page via the CORS-enabled API. */
  private async fetchPageContent(title: string): Promise<string> {
    const url = `${API}?action=query&prop=revisions&titles=${encodeURIComponent(title)}` +
      `&rvslots=main&rvprop=content&format=json&origin=*`;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'Api-User-Agent': 'FateLockedUIM/1.0 (clog runtime sync)' } });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const page: any = Object.values(json.query.pages)[0];
        return page.revisions[0].slots.main['*'];
      } catch (e) { lastErr = e; }
    }
    throw lastErr ?? new Error('fetch failed');
  }

  private async fetchData(): Promise<WikiItem[]> {
    const data = JSON.parse(await this.fetchPageContent(DATA_TITLE));
    if (!Array.isArray(data)) throw new Error('unexpected data.json shape');
    return data as WikiItem[];
  }

  /** Parse the wiki's `overrides = { [id] = { name = "..." } }` table. */
  private async fetchOverrides(): Promise<Record<number, string>> {
    const lua = await this.fetchPageContent(LUA_TITLE);
    const out: Record<number, string> = {};
    const re = /\[(\d+)\]\s*=\s*\{[^}]*name\s*=\s*"((?:[^"\\]|\\.)*)"[^}]*\}/g;
    let m;
    while ((m = re.exec(lua)) !== null) out[Number(m[1])] = m[2].replace(/\\"/g, '"');
    if (Object.keys(out).length === 0) throw new Error('no overrides parsed');
    return out;
  }

  /** Mutate COLLECTION_LOG_DATA in place (idempotent: skips items already present). */
  private apply({ additions, newSources }: SyncResult) {
    let applied = 0;
    for (const a of additions) {
      const tab = COLLECTION_LOG_DATA[a.tab];
      const page = tab && Object.values(tab.pages).find(p => p.name === a.page);
      if (!page) continue;
      if (page.items.some(i => i.id === a.id || norm(i.name) === norm(a.name))) continue;
      page.items.push({ id: a.id, name: a.name });
      applied++;
    }
    this.addedCount = applied;
    this.newSources = newSources;
  }

  private loadCache(): SyncResult | null {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (!saved) return null;
      const { timestamp, data } = JSON.parse(saved);
      if (Date.now() - timestamp > CACHE_TTL || !data || !Array.isArray(data.additions)) return null;
      // Older clients may have allocated a now-retired ID, or a newer bundle
      // may own the cached ID under a different name. Recompute instead of
      // attaching a cached drop to another item's saved progress.
      const liveItems = Object.values(COLLECTION_LOG_DATA).flatMap(tab => Object.values(tab.pages).flatMap(page => page.items));
      if (data.additions.some((addition: Addition) => !Number.isSafeInteger(addition.id)
        || Object.hasOwn(CLOG_ID_MIGRATIONS, addition.id)
        || liveItems.some(item => item.id === addition.id && norm(item.name) !== norm(addition.name)))) return null;
      return data as SyncResult;
    } catch { return null; }
  }

  private saveCache(data: SyncResult) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })); } catch { /* quota: keep in memory */ }
  }
}

export const collectionLogSync = new CollectionLogSyncService();
