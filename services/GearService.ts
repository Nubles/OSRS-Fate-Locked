/**
 * Loads the real equippable-item dataset (weirdgloop OSRS dps-calc) on demand,
 * normalises it into our GearItem shape, derives a per-slot tier for each item
 * (so gear can be gated by fate-lock tier), and caches the result in
 * localStorage. Lazy: only fetched when the player first opens Gear mode.
 *
 * Mirrors the fetch/cache pattern of services/PriceService.ts.
 */

import { GearItem, GearBonuses, hasNoBonuses } from '../utils/gearStats';
import { powerScore, assignTiersForSlot } from '../utils/gearTiers';

const DATA_URL = 'https://raw.githubusercontent.com/weirdgloop/osrs-dps-calc/main/cdn/json/equipment.json';
const CACHE_KEY = 'fate_osrs_gear_v1';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

// Dataset slot names → our 11 EQUIPMENT_SLOTS.
const SLOT_MAP: Record<string, string> = {
  head: 'Head', cape: 'Cape', neck: 'Neck', ammo: 'Ammo', weapon: 'Weapon',
  body: 'Body', shield: 'Shield', legs: 'Legs', hands: 'Gloves', feet: 'Boots', ring: 'Ring',
};

interface RawItem {
  name: string;
  id: number;
  version?: string;
  slot: string;
  image: string;
  speed?: number;
  isTwoHanded?: boolean;
  bonuses?: { str?: number; ranged_str?: number; magic_str?: number; prayer?: number };
  offensive?: { stab?: number; slash?: number; crush?: number; magic?: number; ranged?: number };
  defensive?: { stab?: number; slash?: number; crush?: number; magic?: number; ranged?: number };
}

class GearService {
  private byIdMap = new Map<number, GearItem>();
  private bySlotMap = new Map<string, GearItem[]>();
  private tierMap = new Map<number, number>();
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
      console.warn('GearService init failed', e);
      this.error = 'Could not load equipment data. Check your connection and retry.';
      this.initPromise = null; // allow a later retry
      this.ready = false;
      throw e;
    }
  }

  private async fetchData(): Promise<RawItem[]> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(DATA_URL, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error('fetch failed');
  }

  private normalize(raw: RawItem[]): GearItem[] {
    // Dedupe by name, dropping pure cosmetics and non-equippable slots.
    const byName = new Map<string, GearItem>();
    for (const r of raw) {
      const slot = SLOT_MAP[r.slot];
      if (!slot) continue;
      const bonuses: GearBonuses = {
        stab: r.offensive?.stab || 0,
        slash: r.offensive?.slash || 0,
        crush: r.offensive?.crush || 0,
        magic: r.offensive?.magic || 0,
        ranged: r.offensive?.ranged || 0,
        defStab: r.defensive?.stab || 0,
        defSlash: r.defensive?.slash || 0,
        defCrush: r.defensive?.crush || 0,
        defMagic: r.defensive?.magic || 0,
        defRanged: r.defensive?.ranged || 0,
        meleeStr: r.bonuses?.str || 0,
        rangedStr: r.bonuses?.ranged_str || 0,
        magicStr: r.bonuses?.magic_str || 0,
        prayer: r.bonuses?.prayer || 0,
      };
      if (hasNoBonuses(bonuses)) continue;
      const item: GearItem = {
        id: r.id,
        name: r.name,
        slot,
        imageFile: r.image,
        speed: r.speed || 0,
        twoHanded: !!r.isTwoHanded,
        bonuses,
      };
      const existing = byName.get(r.name);
      // Prefer the canonical (empty-version) variant when names collide.
      if (!existing || r.version === '') byName.set(r.name, item);
    }
    return [...byName.values()];
  }

  private ingest(items: GearItem[]) {
    this.byIdMap.clear();
    this.bySlotMap.clear();
    this.tierMap.clear();

    for (const it of items) {
      this.byIdMap.set(it.id, it);
      if (!this.bySlotMap.has(it.slot)) this.bySlotMap.set(it.slot, []);
      this.bySlotMap.get(it.slot)!.push(it);
    }

    for (const [, list] of this.bySlotMap) {
      const tiers = assignTiersForSlot(list.map((it) => ({ id: it.id, score: powerScore(it.bonuses) })));
      tiers.forEach((tier, id) => this.tierMap.set(id, tier));
      // Strongest first, then alphabetical — a sensible default picker order.
      list.sort((a, b) => (this.tierMap.get(b.id)! - this.tierMap.get(a.id)!) || a.name.localeCompare(b.name));
    }
  }

  private loadCache(): GearItem[] | null {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (!saved) return null;
      const { timestamp, data } = JSON.parse(saved);
      if (Date.now() - timestamp > CACHE_TTL || !Array.isArray(data)) return null;
      return data as GearItem[];
    } catch {
      return null;
    }
  }

  private saveCache(items: GearItem[]) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: items }));
    } catch {
      // Over quota — fine, we keep the data in memory for this session.
    }
  }

  bySlot(slot: string): GearItem[] {
    return this.bySlotMap.get(slot) ?? [];
  }
  byId(id: number | undefined): GearItem | undefined {
    return id == null ? undefined : this.byIdMap.get(id);
  }
  tierOf(id: number): number {
    return this.tierMap.get(id) ?? 1;
  }
}

export const gearService = new GearService();
