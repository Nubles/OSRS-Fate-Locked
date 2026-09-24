import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZERO_BONUSES } from '../utils/gearStats';
import { EQUIPMENT_CATALOGUE, EQUIPMENT_CACHE_SOURCE } from '../data/equipmentCatalogue';

const CURRENT_CACHE = 'fate_osrs_gear_v3';
const LEGACY_CACHE = 'fate_osrs_gear_v2';
const ORIGINAL_CACHE = 'fate_osrs_gear_v1';
const STAFF = {
  id: 11791, name: 'Staff of the dead', version: '', slot: 'weapon',
  image: 'Staff_of_the_dead.png', speed: 4, category: 'Staff',
  offensive: { magic: 17, slash: 70 }, bonuses: { str: 72, magic_str: 150 },
};

function mockStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  });
  return values;
}

function mockEquipment(data: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => data }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function freshService() {
  vi.resetModules();
  return (await import('./GearService')).gearService;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('GearService equipment ingestion', () => {
  it('converts upstream per-mille magic damage to percent once, including cached reloads', async () => {
    const storage = mockStorage();
    const fetchMock = mockEquipment([STAFF, {
      id: 21021, name: 'Ancestral robe top', version: '', slot: 'body',
      offensive: { magic: 35 }, bonuses: { magic_str: 30 },
    }]);
    const service = await freshService();
    await service.init();

    expect(service.byId(11791)?.bonuses.magicStr).toBe(15);
    expect(service.byId(11791)?.category).toBe('Staff');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(EQUIPMENT_CATALOGUE.asset), expect.any(Object));
    expect(service.byId(21021)?.bonuses.magicStr).toBe(3);
    expect(JSON.parse(storage.get(CURRENT_CACHE)!).data.find((item: { id: number }) => item.id === 11791).bonuses.magicStr).toBe(15);

    const reloaded = await freshService();
    await reloaded.init();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reloaded.byId(11791)?.bonuses.magicStr).toBe(15);
    expect(reloaded.byId(11791)?.category).toBe('Staff');
  });

  it('keeps estimates locally but omits them from both permission maps, including unreviewed zero-stat items', async () => {
    mockStorage();
    mockEquipment([STAFF,
      { id: 99901, name: 'Unreviewed combat item', slot: 'weapon', offensive: { magic: 75 } },
      { id: 99902, name: 'Unreviewed cosmetic', slot: 'neck' },
      { id: 552, name: 'Ghostspeak amulet', slot: 'neck' },
    ]);
    const service = await freshService();
    await service.init();
    expect(service.byId(99901)).toBeDefined();
    expect(service.byId(99902)).toBeDefined();
    expect(service.tierOf(99901)).toBeGreaterThan(0);
    expect(service.bySlot('Weapon').some(item => item.id === 99901)).toBe(true);
    expect(service.itemRuleExport()).toEqual({
      '552': { tier: 1, slot: 'Neck' }, '11791': { tier: 8, slot: 'Weapon' },
    });
    expect(service.tierExport()).toEqual({ '552': 1, '11791': 8 });
    expect(service.permissionCoverage()).toEqual({ source: EQUIPMENT_CACHE_SOURCE,
      status: 'pinned', localItemCount: 4, reviewedItemCount: 2, estimatedItemCount: 2 });
  });

  it('retains exact charge, damage, imbue and poison IDs while choosing usable picker rows regardless of source order', async () => {
    const variants = [
      { id: 27626, name: 'Ancient sceptre', version: 'Locked', slot: 'weapon', offensive: { magic: 20 } },
      { id: 27624, name: 'Ancient sceptre', version: 'Normal', slot: 'weapon', offensive: { magic: 20 } },
      { id: 1410, name: "Iban's staff", version: 'Broken', slot: 'weapon', offensive: { magic: 10 } },
      { id: 1409, name: "Iban's staff", version: 'Regular', slot: 'weapon', offensive: { magic: 10 } },
      { id: 1231, name: 'Dragon dagger', version: 'Poison', slot: 'weapon', offensive: { stab: 40 } },
      { id: 1215, name: 'Dragon dagger', version: 'Unpoisoned', slot: 'weapon', offensive: { stab: 40 } },
      { id: 11905, name: 'Trident of the Seas', version: 'Charged', slot: 'weapon', offensive: { magic: 15 } },
      { id: 11907, name: 'Trident of the Seas', version: 'Partially charged', slot: 'weapon', offensive: { magic: 15 } },
      { id: 11908, name: 'Trident of the Seas', version: 'Uncharged', slot: 'weapon', offensive: { magic: 15 } },
      { id: 4856, name: "Ahrim's hood", version: '100', slot: 'head', offensive: { magic: 6 } },
      { id: 4708, name: "Ahrim's hood", version: 'Undamaged', slot: 'head', offensive: { magic: 6 } },
      { id: 4860, name: "Ahrim's hood", version: '0', slot: 'head' },
      { id: 26770, name: 'Berserker ring (i)', version: "Emir's Arena", slot: 'ring', bonuses: { str: 8 } },
      { id: 11773, name: 'Berserker ring (i)', version: '', slot: 'ring', bonuses: { str: 8 } },
      { id: 552, name: 'Ghostspeak amulet', version: 'Normal', slot: 'neck' },
    ];
    for (const data of [variants, [...variants].reverse()]) {
      const storage = mockStorage();
      mockEquipment(data);
      const service = await freshService();
      await service.init();
      const rules = service.itemRuleExport();
      const tiers = service.tierExport();
      expect(Object.keys(rules)).toHaveLength(variants.length);
      for (const item of variants) {
        expect(service.byId(item.id)?.name).toBe(item.name);
        expect(rules[item.id]).toEqual({ tier: service.tierOf(item.id), slot: service.byId(item.id)!.slot });
        expect(tiers[item.id]).toBe(rules[item.id].tier);
      }
      expect(service.bySlot('Weapon').map(item => item.id).sort((a, b) => a - b)).toEqual([1215, 1409, 11905, 27624]);
      expect(service.bySlot('Head').map(item => item.id)).toEqual([4708]);
      expect(service.bySlot('Ring').map(item => item.id)).toEqual([11773]);
      expect(service.bySlot('Neck')).toEqual([]);
      expect(rules[552]).toEqual({ slot: 'Neck', tier: 1 });
      expect(JSON.parse(storage.get(CURRENT_CACHE)!).data).toHaveLength(variants.length);
      const reloaded = await freshService();
      await reloaded.init();
      expect(reloaded.itemRuleExport()).toEqual(rules);
      expect(reloaded.bySlot('Weapon').map(item => item.id)).toEqual(service.bySlot('Weapon').map(item => item.id));
    }
  });
});

describe('GearService cache upgrade and recovery', () => {
  const legacyItem = {
    id: STAFF.id, name: STAFF.name, slot: 'Weapon', imageFile: STAFF.image,
    speed: 4, twoHanded: false, bonuses: { ...ZERO_BONUSES, magic: 17, magicStr: 150 },
  };

  it.each([LEGACY_CACHE, ORIGINAL_CACHE])('migrates %s offline without modifying profiles or repeatedly dividing stats, then refreshes missing IDs', async (cacheKey) => {
    const original = JSON.stringify({ timestamp: Date.now() - 1000, data: [legacyItem] });
    const storage = mockStorage({ [cacheKey]: original, FATE_PROFILE_example: 'player save' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const service = await freshService();
    await service.init();
    expect(service.ready).toBe(true);
    expect(service.byId(STAFF.id)?.bonuses.magicStr).toBe(15);
    expect(service.itemRuleExport()).toEqual({});
    expect(service.tierExport()).toEqual({});
    expect(service.permissionCoverage().status).toBe('legacy-cache');
    expect(JSON.parse(storage.get(CURRENT_CACHE)!).needsRefresh).toBe(true);
    expect(storage.get(cacheKey)).toBe(original);
    expect(storage.get('FATE_PROFILE_example')).toBe('player save');

    const offlineReload = await freshService();
    await offlineReload.init();
    expect(offlineReload.byId(STAFF.id)?.bonuses.magicStr).toBe(15);

    mockEquipment([STAFF, { ...STAFF, id: 24144, name: 'Staff of balance' }]);
    const refreshed = await freshService();
    await refreshed.init();
    expect(refreshed.itemRuleExport()[24144]).toBeDefined();
    expect(refreshed.byId(STAFF.id)?.bonuses.magicStr).toBe(15);
    expect(JSON.parse(storage.get(CURRENT_CACHE)!).needsRefresh).not.toBe(true);
  });

  it('prefers v3, then v2, before migrating v1 when several cache generations coexist', async () => {
    const timestamp = Date.now() - 1000;
    const storage = mockStorage({
      [ORIGINAL_CACHE]: JSON.stringify({ timestamp, data: [{ ...legacyItem, bonuses: { ...legacyItem.bonuses, magicStr: 100 } }] }),
      [LEGACY_CACHE]: JSON.stringify({ timestamp, data: [legacyItem] }),
    });
    const fetchMock = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetchMock);
    const service = await freshService();
    await service.init();
    expect(service.byId(STAFF.id)?.bonuses.magicStr).toBe(15);

    storage.set(CURRENT_CACHE, JSON.stringify({ timestamp, source: EQUIPMENT_CACHE_SOURCE,
      data: [{ ...legacyItem, bonuses: { ...legacyItem.bonuses, magicStr: 20 } }] }));
    fetchMock.mockClear();
    const reloaded = await freshService();
    await reloaded.init();
    expect(reloaded.byId(STAFF.id)?.bonuses.magicStr).toBe(20);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, 'a-different-release:1'])('replaces a v3 cache from source %s with the pinned catalogue without dividing v3 stats', async (source) => {
    const original = JSON.stringify({ timestamp: Date.now(), source,
      data: [{ ...legacyItem, bonuses: { ...legacyItem.bonuses, magicStr: 15 } }] });
    const storage = mockStorage({ [CURRENT_CACHE]: original });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const offline = await freshService();
    await offline.init();
    expect(offline.byId(STAFF.id)?.bonuses.magicStr).toBe(15);
    expect(offline.tierExport()).toEqual({});
    expect(offline.permissionCoverage().source).toBeNull();
    mockEquipment([STAFF]);
    const refreshed = await freshService();
    await refreshed.init();
    expect(refreshed.byId(STAFF.id)?.bonuses.magicStr).toBe(15);
    expect(refreshed.tierExport()[STAFF.id]).toBe(8);
    expect(JSON.parse(storage.get(CURRENT_CACHE)!).source).toBe(EQUIPMENT_CACHE_SOURCE);
  });

  it.each([
    ['missing timestamp', { data: [legacyItem] }],
    ['future timestamp', { timestamp: Date.now() + 86_400_000, data: [legacyItem] }],
    ['expired timestamp', { timestamp: Date.now() - 31 * 86_400_000, data: [legacyItem] }],
    ['malformed row', { timestamp: Date.now(), data: [{}] }],
    ['missing bonuses', { timestamp: Date.now(), data: [{ ...legacyItem, bonuses: {} }] }],
    ['unknown slot', { timestamp: Date.now(), data: [{ ...legacyItem, slot: 'Pockets' }] }],
    ['empty catalogue', { timestamp: Date.now(), data: [] }],
  ])('replaces a %s cache instead of poisoning retries', async (_description, cache) => {
    mockStorage({ [CURRENT_CACHE]: JSON.stringify(cache) });
    const fetchMock = mockEquipment([STAFF]);
    const service = await freshService();
    await service.init();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.ready).toBe(true);
    expect(service.byId(STAFF.id)?.bonuses.magicStr).toBe(15);
  });

  it('does not treat an empty upstream response as a successful equipment load and allows explicit retry', async () => {
    mockStorage();
    mockEquipment([]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = await freshService();
    await expect(service.init()).rejects.toThrow('Empty equipment dataset');
    expect(service.ready).toBe(false);
    expect(service.itemRuleExport()).toEqual({});
    mockEquipment([STAFF]);
    await service.init(true);
    expect(service.ready).toBe(true);
    expect(service.byId(STAFF.id)).toBeDefined();
  });
});
