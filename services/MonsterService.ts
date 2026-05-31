/**
 * Loads the OSRS monster dataset (weirdgloop dps-calc) on demand for the DPS
 * calculator: defence levels/bonuses + HP per monster. Lazy + localStorage
 * cached, mirroring services/GearService.ts.
 */

const DATA_URL = 'https://raw.githubusercontent.com/weirdgloop/osrs-dps-calc/main/cdn/json/monsters.json';
const CACHE_KEY = 'fate_osrs_monsters_v2';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

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
  size: number;
  attributes: string[];
}

interface RawMonster {
  id: number;
  name: string;
  version?: string;
  image?: string;
  level?: number;
  size?: number;
  max_hit?: string | number;
  skills?: { def?: number; hp?: number; magic?: number };
  defensive?: { stab?: number; slash?: number; crush?: number; magic?: number; ranged?: number };
  attributes?: string[];
}

class MonsterService {
  private list: MonsterStats[] = [];
  private byIdMap = new Map<number, MonsterStats>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  public ready = false;
  public error: string | null = null;

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
      const items = cached ?? this.normalize(await this.fetchData());
      this.ingest(items);
      if (!cached) this.saveCache(items);
      this.initialized = true;
      this.ready = true;
    } catch (e) {
      console.warn('MonsterService init failed', e);
      this.error = 'Could not load monster data. Check your connection and retry.';
      this.initPromise = null;
      this.ready = false;
      throw e;
    }
  }

  private async fetchData(): Promise<RawMonster[]> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(DATA_URL, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr ?? new Error('fetch failed');
  }

  private normalize(raw: RawMonster[]): MonsterStats[] {
    const seen = new Set<string>();
    const out: MonsterStats[] = [];
    for (const r of raw) {
      if (!r || typeof r.id !== 'number' || !r.name) continue;
      const hp = r.skills?.hp ?? 0;
      if (hp <= 0) continue; // non-attackable / props
      const key = `${r.name}|${r.version ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: r.id,
        name: r.name,
        version: r.version ?? '',
        imageFile: r.image ?? '',
        level: r.level ?? 0,
        hp,
        maxHit: parseInt(String(r.max_hit ?? '0'), 10) || 0,
        defLevel: r.skills?.def ?? 1,
        magicLevel: r.skills?.magic ?? 1,
        def: {
          stab: r.defensive?.stab ?? 0,
          slash: r.defensive?.slash ?? 0,
          crush: r.defensive?.crush ?? 0,
          magic: r.defensive?.magic ?? 0,
          ranged: r.defensive?.ranged ?? 0,
        },
        size: r.size ?? 1,
        attributes: r.attributes ?? [],
      });
    }
    return out;
  }

  private ingest(items: MonsterStats[]) {
    this.list = items;
    this.byIdMap.clear();
    for (const m of items) this.byIdMap.set(m.id, m);
  }

  private loadCache(): MonsterStats[] | null {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (!saved) return null;
      const { timestamp, data } = JSON.parse(saved);
      if (Date.now() - timestamp > CACHE_TTL || !Array.isArray(data)) return null;
      return data as MonsterStats[];
    } catch { return null; }
  }

  private saveCache(items: MonsterStats[]) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: items }));
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

  /** Best monster for an exact (case-insensitive) name; prefers the highest-HP version. */
  byName(name: string): MonsterStats | undefined {
    const q = name.trim().toLowerCase();
    let best: MonsterStats | undefined;
    for (const m of this.list) {
      if (m.name.toLowerCase() === q && (!best || m.hp > best.hp)) best = m;
    }
    return best;
  }
}

export const monsterService = new MonsterService();
