/**
 * Read-only runtime freshness check. New slots wait for a reviewed build-time
 * sync: assigning save IDs from upstream ordering corrupts progress when that
 * ordering changes. Existing bundled identities and legacy cache data survive.
 */
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import type { CollectionLogIdentity } from '../types';

const API = 'https://oldschool.runescape.wiki/api.php';
const DATA_TITLE = 'Module:Collection_log/data.json';
const LUA_TITLE = 'Module:Collection_log'; // holds the display-override table
// v4 caches notifications only. Never delete v1-v3: they may identify saved progress.
const CACHE_KEY = 'fate_clog_sync_v4';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

// App page-name (normalised) -> wiki page name, only where they differ.
const PAGE_ALIAS: Record<string, string> = {
  'mage training arena': 'Magic Training Arena',
};

interface WikiItem { id: number; name: string; tabs: string[]; }
interface Addition { tab: string; page: string; name: string; }
export interface NewSource { name: string; itemCount: number; }
interface SyncResult { additions: Addition[]; newSources: NewSource[]; }
type LogData = typeof COLLECTION_LOG_DATA;

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Pure diff: given the wiki's flat item list and the app's log data, return the
 * new items awaiting reviewed build-time identities
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

  for (const [wikiName, items] of wikiPages) {
    const aliasTarget = Object.entries(PAGE_ALIAS).find(([, w]) => w === wikiName)?.[0];
    const match = appByNorm.get(norm(wikiName)) ?? (aliasTarget ? appByNorm.get(aliasTarget) : undefined);
    if (!match || match.page.items.length === 0) {
      if (!match) newSources.push({ name: wikiName, itemCount: items.length });
      continue;
    }
    const have = new Set(match.page.items.map(i => norm(i.name)));
    for (const name of items) {
      if (have.has(norm(name))) continue;
      // Relocations need a reviewed build-time move, never a second save ID.
      const relocated = [...appByNorm.values()].some(({ page }) => page !== match.page
        && page.items.some(item => norm(item.name) === norm(name))
        && !(wikiPages.get(PAGE_ALIAS[norm(page.name)] ?? page.name) ?? []).some(item => norm(item) === norm(name)));
      if (relocated) continue;
      have.add(norm(name));
      additions.push({ tab: match.tab, page: match.page.name, name });
    }
  }
  return { additions, newSources };
}

/** Isolate ambiguous pre-v4 identities without changing the saved counts. */
export function collectionIdentityReview(
  progress: Record<string, number>,
  legacy: { id: number; name: string; page: string }[],
  data: LogData = COLLECTION_LOG_DATA,
  identity?: CollectionLogIdentity,
  idMigrations: Readonly<Record<number, number>> = {},
): { blockedIds: Set<number>; savedRecords: number } {
  const entries = Object.values(data).flatMap(tab => Object.values(tab.pages).flatMap(page =>
    page.items.map(item => ({ ...item, page: page.name }))));
  const blockedIds = new Set<number>(identity?.quarantinedIds);
  for (const [savedId, count] of Object.entries(progress)) {
    if (count <= 0) continue;
    const id = Number(savedId);
    const current = entries.find(item => item.id === id)
      ?? entries.find(item => item.id === idMigrations[id]);
    // Once reviewed, browser-wide evidence from another run cannot reinterpret
    // new canonical drops. The saved quarantine remains authoritative on import.
    const previous = identity ? [] : legacy.filter(item => item.id === id);
    if (!current || previous.some(item => norm(item.name) !== norm(current.name) || norm(item.page) !== norm(current.page))) {
      blockedIds.add(id);
      // Also suppress a duplicate first-entry reward if the historical item is
      // now bundled under a different identity. Reconciliation needs review.
      for (const old of previous) for (const item of entries) {
        if (norm(item.name) === norm(old.name) && norm(item.page) === norm(old.page)) blockedIds.add(item.id);
      }
    }
  }
  const savedRecords = Object.entries(progress).filter(([id, count]) => count > 0 && blockedIds.has(Number(id))).length;
  return { blockedIds, savedRecords };
}

export const emptyCollectionLogIdentity = (): CollectionLogIdentity => ({ version: 1, quarantinedIds: [] });

/** Snapshot known legacy ambiguity once, without changing or assigning any count. */
export function captureCollectionLogIdentity(progress: Record<string, number>, idMigrations: Readonly<Record<number, number>> = {}): CollectionLogIdentity | undefined {
  try {
    return { version: 1, quarantinedIds: [...collectionIdentityReview(progress, collectionLogSync.legacyMappings(true), COLLECTION_LOG_DATA, undefined, idMigrations).blockedIds].sort((a, b) => a - b) };
  } catch {
    // Unreadable evidence must not permanently certify an empty quarantine.
    return undefined;
  }
}

export class CollectionLogSyncService {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  public ready = false;
  public error: string | null = null;
  public pendingAdditions: Addition[] = [];
  /** Previous runtime mappings are evidence only, never reassigned or applied. */
  legacyMappings(requireReadable = false): { id: number; name: string; page: string }[] {
    const mappings: { id: number; name: string; page: string }[] = [];
    for (const key of ['fate_clog_sync_v1', 'fate_clog_sync_v2', 'fate_clog_sync_v3']) {
      try {
        const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
        for (const item of cached?.data?.additions ?? []) {
          if (Number.isSafeInteger(item.id) && typeof item.name === 'string' && typeof item.page === 'string') mappings.push(item);
        }
      } catch (error) {
        // Preserve malformed historical caches too; never reinterpret them.
        if (requireReadable) throw error;
      }
    }
    return mappings;
  }
  public newSources: NewSource[] = [];

  /** Subscribe to new-content notices. */
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
      if (this.pendingAdditions.length > 0 || this.newSources.length > 0) this.emit();
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

  /** Publish notices, never mutate the canonical collection catalogue. */
  private apply({ additions, newSources }: SyncResult) {
    this.pendingAdditions = additions;
    this.newSources = newSources;
  }

  private loadCache(): SyncResult | null {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (!saved) return null;
      const { timestamp, data } = JSON.parse(saved);
      if (Date.now() - timestamp > CACHE_TTL || !data || !Array.isArray(data.additions) || !Array.isArray(data.newSources)) return null;
      return data as SyncResult;
    } catch { return null; }
  }

  private saveCache(data: SyncResult) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })); } catch { /* quota: keep in memory */ }
  }
}

export const collectionLogSync = new CollectionLogSyncService();

/** Shared guard for manual writes, detected events and their final acceptance. */
export function collectionItemNeedsIdentityReview(progress: Record<string, number>, itemId: number, identity?: CollectionLogIdentity): boolean {
  return collectionIdentityReview(progress, identity ? [] : collectionLogSync.legacyMappings(), COLLECTION_LOG_DATA, identity).blockedIds.has(itemId);
}
