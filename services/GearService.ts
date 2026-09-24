/**
 * Loads the release-pinned OSRS Wiki DPS-calculator item dataset on demand,
 * normalises it into our GearItem shape, derives a tier for each exact item ID
 * (so gear can be gated by fate-lock tier), and caches the result in
 * localStorage. Lazy: only fetched when the player first opens Gear mode.
 *
 * Mirrors the fetch/cache pattern of services/PriceService.ts.
 */

import { GearItem, GearBonuses, ZERO_BONUSES, hasNoBonuses } from '../utils/gearStats';
import { rangedDamageTypeForCategory } from '../utils/rangedDamage';
import { canonicalTierFromName, buildTierAnchors, anchoredTier } from '../utils/gearTiers';
import { EQUIPMENT_CATALOGUE, EQUIPMENT_CACHE_SOURCE, type EquipmentPermissionCoverage } from '../data/equipmentCatalogue';

const CACHE_KEY = 'fate_osrs_gear_v3';
const LEGACY_CACHE_KEYS = ['fate_osrs_gear_v2', 'fate_osrs_gear_v1'] as const;
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
  category?: string;
  bonuses?: { str?: number; ranged_str?: number; magic_str?: number; prayer?: number };
  offensive?: { stab?: number; slash?: number; crush?: number; magic?: number; ranged?: number };
  defensive?: { stab?: number; slash?: number; crush?: number; magic?: number; ranged?: number };
}

interface GearRecord extends GearItem {
  /** Kept for deterministic picker selection; every variant still has its own rule. */
  version?: string;
}

interface GearCache {
  timestamp: number;
  data: GearRecord[];
  source?: string;
  /** A migrated cache lacks the IDs discarded by v2 and needs a successful refresh. */
  needsRefresh?: boolean;
}

function variantRank(item: GearRecord): number {
  const version = (item.version ?? '').trim().toLowerCase();
  if (!version) return 0;
  if (/^(normal|regular|base|unpoisoned|undamaged)$/.test(version)) return 1;
  if (/^(charged|fully charged|full|active|activated|energised)$/.test(version)) return 2;
  if (/^(broken|empty|inactive|uncharged|0)$/.test(version)) return 7;
  if (version.includes('locked')) return 6;
  if (version.includes('poison')) return 5;
  return 3;
}

function preferredVariant(a: GearRecord, b: GearRecord): GearRecord {
  const rank = variantRank(a) - variantRank(b);
  // IDs provide a stable tie-breaker independent of upstream ordering.
  return rank < 0 || (rank === 0 && a.id < b.id) ? a : b;
}

class GearService {
  private byIdMap = new Map<number, GearItem>();
  private bySlotMap = new Map<string, GearItem[]>();
  private tierMap = new Map<number, number>();
  private pinnedCatalogue = false;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private lastFailAt = 0;
  /** After a failed load, implicit init() calls fast-fail for this long —
   *  background callers (bundle export, relay sync on every state change)
   *  must not each re-run the full 2×15s fetch retry while offline. */
  private static readonly FAIL_COOLDOWN_MS = 60_000;

  public ready = false;
  public error: string | null = null;

  /** `force` skips the failure cool-down — for explicit user Retry buttons. */
  async init(force = false): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    if (!force && Date.now() - this.lastFailAt < GearService.FAIL_COOLDOWN_MS) {
      throw new Error(this.error ?? 'equipment data unavailable (retry cool-down)');
    }
    this.initPromise = this.perform();
    return this.initPromise;
  }

  private async perform() {
    try {
      this.error = null;
      const cached = this.loadCache();
      let items: GearRecord[];
      if (cached && !cached.needsRefresh) {
        items = cached.data;
        this.pinnedCatalogue = true;
      } else {
        try {
          items = this.normalize(await this.fetchData());
          this.pinnedCatalogue = true;
          this.saveCache({ timestamp: Date.now(), data: items, source: EQUIPMENT_CACHE_SOURCE });
        } catch (error) {
          if (!cached) throw error;
          // Preserve usable equipment/loadouts when an offline player upgrades.
          // Unpinned legacy data is never an authority for plugin restrictions.
          this.pinnedCatalogue = false;
          items = cached.data;
          this.saveCache(cached);
        }
      }
      this.ingest(items);
      this.initialized = true;
      this.ready = true;
    } catch (e) {
      console.warn('GearService init failed', e);
      this.error = 'Could not load equipment data. Check your connection and retry.';
      this.initPromise = null; // allow a later retry
      this.lastFailAt = Date.now();
      this.ready = false;
      throw e;
    }
  }

  private async fetchData(): Promise<RawItem[]> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      try {
        const base = (import.meta as any).env?.BASE_URL ?? '/';
        const res = await fetch(`${base}${EQUIPMENT_CATALOGUE.asset}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr ?? new Error('fetch failed');
  }

  private normalize(raw: RawItem[]): GearRecord[] {
    if (!Array.isArray(raw)) throw new Error('Invalid equipment dataset');
    // Permission exports need exact IDs, including charge/degradation variants
    // and zero-bonus quest equipment. Only the combat picker is deduplicated.
    const byId = new Map<number, GearRecord>();
    for (const r of raw) {
      if (!r || !Number.isInteger(r.id) || r.id <= 0 || typeof r.name !== 'string' || !r.name.trim()) continue;
      const slot = Object.hasOwn(SLOT_MAP, r.slot) ? SLOT_MAP[r.slot] : undefined;
      if (!slot) continue;
      if ((r.version != null && typeof r.version !== 'string')
        || (r.speed != null && !Number.isFinite(r.speed))) continue;
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
        // Upstream uses per-mille (PlayerVsNPCCalc divides by 1000),
        // whereas GearBonuses and our combat calculations use percent.
        magicStr: (r.bonuses?.magic_str || 0) / 10,
        prayer: r.bonuses?.prayer || 0,
      };
      if (!Object.values(bonuses).every(value => typeof value === 'number' && Number.isFinite(value))) continue;
      const item: GearRecord = {
        id: r.id,
        name: r.name,
        slot,
        imageFile: typeof r.image === 'string' ? r.image : '',
        version: r.version,
        speed: r.speed || 0,
        twoHanded: !!r.isTwoHanded,
        category: typeof r.category === 'string' ? r.category : undefined,
        rangedDamageType: rangedDamageTypeForCategory(r.category),
        bonuses,
      };
      byId.set(item.id, item);
    }
    if (!byId.size) throw new Error('Empty equipment dataset');
    return [...byId.values()];
  }

  private ingest(items: GearRecord[]) {
    this.byIdMap.clear();
    this.bySlotMap.clear();
    this.tierMap.clear();

    const pickerByName = new Map<string, GearRecord>();
    for (const it of items) {
      this.byIdMap.set(it.id, it);
      if (hasNoBonuses(it.bonuses)) continue;
      const key = `${it.slot}:${it.name}`;
      const existing = pickerByName.get(key);
      pickerByName.set(key, existing ? preferredVariant(existing, it) : it);
    }
    for (const it of pickerByName.values()) {
      if (!this.bySlotMap.has(it.slot)) this.bySlotMap.set(it.slot, []);
      this.bySlotMap.get(it.slot)!.push(it);
    }

    // Pass 1: assign the canonical material/named tier (matches the Codex) to
    // every item we recognise, and collect them as anchors.
    const known: { tier: number; bonuses: GearBonuses }[] = [];
    for (const it of items) {
      const canon = canonicalTierFromName(it.name);
      if (canon != null) {
        this.tierMap.set(it.id, canon);
      }
    }
    // Charge states must not weight the strength ladder more heavily than
    // otherwise identical equipment with a single item ID.
    for (const it of pickerByName.values()) {
      const tier = this.tierMap.get(it.id);
      if (tier != null) known.push({ tier, bonuses: it.bonuses });
    }
    // Pass 2: place every unrecognised item against the canonical ladder, by its
    // own combat style, so the fallback reflects real strength (not slot rank).
    const anchors = buildTierAnchors(known);
    for (const it of items) {
      if (!this.tierMap.has(it.id)) {
        this.tierMap.set(it.id, hasNoBonuses(it.bonuses) ? 1 : anchoredTier(it.bonuses, anchors));
      }
    }

    // Strongest first, then alphabetical — a sensible default picker order.
    for (const [, list] of this.bySlotMap) {
      list.sort((a, b) => (this.tierMap.get(b.id)! - this.tierMap.get(a.id)!) || a.name.localeCompare(b.name));
    }
  }

  private readCache(key: string): GearCache | null {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return null;
      const { timestamp, data, needsRefresh, source } = JSON.parse(saved);
      if (!Number.isFinite(timestamp) || timestamp > Date.now() || Date.now() - timestamp > CACHE_TTL
        || !Array.isArray(data) || !data.length) return null;
      const valid = data.every(item => item && Number.isInteger(item.id) && item.id > 0
        && typeof item.name === 'string' && item.name.trim()
        && Object.values(SLOT_MAP).includes(item.slot)
        && typeof item.imageFile === 'string' && Number.isFinite(item.speed)
        && typeof item.twoHanded === 'boolean'
        && (item.version == null || typeof item.version === 'string')
        && (item.category == null || typeof item.category === 'string')
        && item.bonuses && Object.keys(ZERO_BONUSES).every(key => Number.isFinite(item.bonuses[key])));
      return valid ? { timestamp, data, source, needsRefresh: needsRefresh === true || source !== EQUIPMENT_CACHE_SOURCE } : null;
    } catch {
      return null;
    }
  }

  private loadCache(): GearCache | null {
    const current = this.readCache(CACHE_KEY);
    if (current) return current;
    let legacy: GearCache | null = null;
    for (const key of LEGACY_CACHE_KEYS) {
      legacy = this.readCache(key);
      if (legacy) break;
    }
    if (!legacy) return null;
    return {
      timestamp: legacy.timestamp,
      needsRefresh: true,
      data: legacy.data.map(item => ({ ...item, bonuses: { ...item.bonuses, magicStr: item.bonuses.magicStr / 10 } })),
    };
  }

  private saveCache(cache: GearCache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
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
  /** Only reviewed rules from the release-pinned source may restrict gameplay. */
  itemRuleExport(): Record<string, { tier: number; slot: string }> {
    const out: Record<string, { tier: number; slot: string }> = {};
    if (!this.pinnedCatalogue) return out;
    for (const [id, item] of this.byIdMap) {
      const tier = canonicalTierFromName(item.name);
      if (tier != null) out[id] = { tier, slot: item.slot };
    }
    return out;
  }
  /** Legacy consumers also fail open for estimates: omit their IDs entirely. */
  tierExport(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, rule] of Object.entries(this.itemRuleExport())) out[id] = rule.tier;
    return out;
  }

  permissionCoverage(): EquipmentPermissionCoverage {
    return {
      source: this.pinnedCatalogue ? EQUIPMENT_CACHE_SOURCE : null,
      status: this.pinnedCatalogue ? 'pinned' : this.ready ? 'legacy-cache' : 'unavailable',
      localItemCount: this.byIdMap.size,
      reviewedItemCount: Object.keys(this.itemRuleExport()).length,
      estimatedItemCount: [...this.byIdMap.values()].filter(item => canonicalTierFromName(item.name) == null).length,
    };
  }
}

export const gearService = new GearService();
