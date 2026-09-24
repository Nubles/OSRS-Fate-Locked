/**
 * Loads the release-pinned OSRS Wiki DPS-calculator dataset on demand for the DPS
 * calculator: defence levels/bonuses + HP per monster. Lazy + localStorage
 * cached, mirroring services/GearService.ts.
 */

import { MONSTER_CATALOGUE, MONSTER_CACHE_SOURCE } from '../data/monsterCatalogue';

const CACHE_KEY = 'fate_osrs_monsters_v3';

/**
 * The largest single hit in the wiki's max-hit text, which can list several
 * attacks, ranges ("46-61") and markup ("<div …>*31 (auto)*45 (special)").
 * Hit counts ("17x2", "2 (x3)") are not hits. Text with no number reads as 0.
 */
export const parseMaxHit = (raw: unknown): number => {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  const text = String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/(^|[^a-z])[x×]\s?\d+/gi, '$1 ');
  return Math.max(0, ...(text.match(/\d+/g) ?? []).map(Number));
};

export interface MonsterStats {
  id: number;
  name: string;
  version: string;
  imageFile: string;
  level: number;
  hp: number;
  /** Highest single hit the monster can deal (parsed; 0 if unknown). */
  maxHit: number;
  defLevel: number;
  magicLevel: number;
  /** Defensive bonuses by attack type. */
  def: { stab: number; slash: number; crush: number; magic: number; ranged: number };
  rangedDefence?: Record<'light' | 'standard' | 'heavy', number>;
  size: number;
  attributes: string[];
}

/**
 * Identity of one catalogue row. Several versions of a monster can share an
 * NPC id (Duke Sucellus's post-quest and awakened fights, every Doom delve),
 * and so can differently named rows (the two Nightmare totems), so neither
 * the id nor the id and version alone select one row.
 */
export const monsterKey = (monster: Pick<MonsterStats, 'id' | 'name' | 'version'>): string =>
  `${monster.id}|${monster.name}|${monster.version}`;

interface RawMonster {
  id: number;
  name: string;
  version?: string;
  image?: string;
  level?: number;
  size?: number;
  max_hit?: string | number;
  skills?: { def?: number; hp?: number; magic?: number };
  defensive?: { stab?: number; slash?: number; crush?: number; magic?: number; ranged?: number; light?: number; standard?: number; heavy?: number };
  attributes?: string[];
}

function validMonster(value: unknown): value is MonsterStats {
  if (!value || typeof value !== 'object') return false;
  const m = value as MonsterStats;
  return Number.isInteger(m.id) && typeof m.name === 'string' && !!m.name.trim()
    && typeof m.version === 'string' && typeof m.imageFile === 'string'
    && [m.level, m.hp, m.maxHit, m.defLevel, m.magicLevel, m.size].every(Number.isFinite)
    && m.hp > 0 && m.size >= 0 // Upstream uses zero for unknown size on real targets.
    && !!m.def && ['stab', 'slash', 'crush', 'magic', 'ranged'].every(k => Number.isFinite(m.def[k as keyof MonsterStats['def']]))
    && !!m.rangedDefence && ['light', 'standard', 'heavy'].every(k => Number.isFinite(m.rangedDefence![k as 'light' | 'standard' | 'heavy']))
    && Array.isArray(m.attributes) && m.attributes.every(a => typeof a === 'string');
}

class MonsterService {
  private list: MonsterStats[] = [];
  private byIdMap = new Map<number, MonsterStats>();
  private byKeyMap = new Map<string, MonsterStats>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private lastFailAt = 0;
  /** See GearService — implicit init() fast-fails during the cool-down so
   *  background callers don't each re-run the full fetch retry while offline. */
  private static readonly FAIL_COOLDOWN_MS = 60_000;

  public ready = false;
  public error: string | null = null;

  /** `force` skips the failure cool-down — for explicit user Retry buttons. */
  async init(force = false): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    if (!force && Date.now() - this.lastFailAt < MonsterService.FAIL_COOLDOWN_MS) {
      throw new Error(this.error ?? 'monster data unavailable (retry cool-down)');
    }
    this.initPromise = this.perform();
    return this.initPromise;
  }

  private async perform() {
    try {
      this.error = null;
      const cached = this.loadCache();
      const items = cached ?? this.normalize(await this.fetchData());
      this.ingest(items);
      if (!cached) this.saveCache(items);
      this.initialized = true;
      this.ready = true;
    } catch (e) {
      console.warn('MonsterService init failed', e);
      this.error = 'Could not load monster data. Check your connection and retry.';
      this.initPromise = null;
      this.lastFailAt = Date.now();
      this.ready = false;
      throw e;
    }
  }

  private async fetchData(): Promise<RawMonster[]> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      try {
        const base = (import.meta as any).env?.BASE_URL ?? '/';
        const res = await fetch(`${base}${MONSTER_CATALOGUE.asset}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) { lastErr = e; }
      finally { clearTimeout(timer); }
    }
    throw lastErr ?? new Error('fetch failed');
  }

  private normalize(raw: RawMonster[]): MonsterStats[] {
    if (!Array.isArray(raw)) throw new Error('Invalid monster dataset');
    const seen = new Set<string>();
    const out: MonsterStats[] = [];
    for (const r of raw) {
      if (!r || !Number.isInteger(r.id) || typeof r.name !== 'string' || !r.name.trim()) continue;
      const hp = r.skills?.hp ?? 0;
      if (hp <= 0) continue; // non-attackable / props
      const key = `${r.name}|${r.version ?? ''}`;
      if (seen.has(key)) continue;
      const monster: MonsterStats = {
        id: r.id,
        name: r.name,
        version: r.version ?? '',
        imageFile: r.image ?? '',
        level: r.level ?? 0,
        hp,
        maxHit: parseMaxHit(r.max_hit),
        defLevel: r.skills?.def ?? 1,
        magicLevel: r.skills?.magic ?? 1,
        def: {
          stab: r.defensive?.stab ?? 0,
          slash: r.defensive?.slash ?? 0,
          crush: r.defensive?.crush ?? 0,
          magic: r.defensive?.magic ?? 0,
          ranged: r.defensive?.standard ?? r.defensive?.ranged ?? 0,
        },
        rangedDefence: {
          light: r.defensive?.light ?? r.defensive?.ranged ?? 0,
          standard: r.defensive?.standard ?? r.defensive?.ranged ?? 0,
          heavy: r.defensive?.heavy ?? r.defensive?.ranged ?? 0,
        },
        size: r.size ?? 1,
        attributes: r.attributes ?? [],
      };
      if (!validMonster(monster)) continue;
      seen.add(key);
      out.push(monster);
    }
    if (!out.length) throw new Error('Empty monster dataset');
    return out;
  }

  private ingest(items: MonsterStats[]) {
    this.list = items;
    this.byIdMap.clear();
    this.byKeyMap.clear();
    for (const m of items) {
      this.byIdMap.set(m.id, m);
      this.byKeyMap.set(monsterKey(m), m);
    }
  }

  private loadCache(): MonsterStats[] | null {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (!saved) return null;
      const { source, data } = JSON.parse(saved);
      // The fixed source cannot age out. A new catalogue or normalizer invalidates
      // this cache; unfingerprinted live-main caches are never reused as current.
      if (source !== MONSTER_CACHE_SOURCE || !Array.isArray(data) || !data.length || !data.every(validMonster)) return null;
      return data;
    } catch { return null; }
  }

  private saveCache(items: MonsterStats[]) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), source: MONSTER_CACHE_SOURCE, data: items }));
    } catch { /* quota — keep in memory */ }
  }

  /** Name search, ranked: prefix matches first, then substring. */
  search(q: string, limit = 60): MonsterStats[] {
    const query = q.trim().toLowerCase();
    if (!query) return this.list.slice(0, limit);
    const starts: MonsterStats[] = [];
    const contains: MonsterStats[] = [];
    for (const m of this.list) {
      const n = m.name.toLowerCase();
      if (n.startsWith(query)) starts.push(m);
      else if (n.includes(query)) contains.push(m);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit);
  }

  byId(id: number | undefined): MonsterStats | undefined {
    return id == null ? undefined : this.byIdMap.get(id);
  }

  /** One exact catalogue row, keyed by {@link monsterKey}. */
  byKey(key: string | null | undefined): MonsterStats | undefined {
    return key == null ? undefined : this.byKeyMap.get(key);
  }

  /** Every version of an exact (case-insensitive) name, in catalogue order. */
  versionsOf(name: string): MonsterStats[] {
    const q = name.trim().toLowerCase();
    return this.list.filter(m => m.name.toLowerCase() === q);
  }

  /**
   * The first listed version of an exact name. Callers that plan a fight
   * choose a version explicitly (see defaultBossVersion) instead.
   */
  byName(name: string): MonsterStats | undefined {
    return this.versionsOf(name)[0];
  }
}

export const monsterService = new MonsterService();
