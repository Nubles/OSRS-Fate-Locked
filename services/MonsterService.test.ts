// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MONSTER_CATALOGUE, MONSTER_CACHE_SOURCE } from '../data/monsterCatalogue';

const CACHE_KEY = 'fate_osrs_monsters_v3';
const TARGET = { id: 2215, name: 'General Graardor', version: '', skills: { hp: 255, def: 250, magic: 80 },
  max_hit: '60 (melee)', size: 4, defensive: { stab: 90, slash: 90, crush: 90, magic: 298, light: -20, standard: 50, heavy: 150 } };

function mockStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  });
  return values;
}

function mockData(data: unknown) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, json: async () => data }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function freshService() {
  vi.resetModules();
  return (await import('./MonsterService')).monsterService;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.resetModules();
});

describe('MonsterService pinned targets', () => {
  it('loads the complete same-origin snapshot under the configured hosted base and preserves normalized stats', async () => {
    mockStorage();
    const rows = JSON.parse(readFileSync(new URL(`../public/${MONSTER_CATALOGUE.asset}`, import.meta.url), 'utf8'));
    const fetchMock = mockData(rows);
    const service = await freshService();
    await service.init();
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    expect(fetchMock).toHaveBeenCalledWith(`${base}${MONSTER_CATALOGUE.asset}`, expect.any(Object));
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\//);
    expect(service.ready).toBe(true);
    expect(service.search('', 10_000)).toHaveLength(2850); // Existing name+version deduplication.
    expect(service.byName('Menaphite Shadow')?.size).toBe(0); // Unknown-size upstream targets remain selectable.
    expect(service.byId(2215)).toMatchObject({ name: 'General Graardor', hp: 255, maxHit: 60, defLevel: 250,
      magicLevel: 80, def: { stab: 90, slash: 90, crush: 90, magic: 298, ranged: 90 },
      rangedDefence: { light: 90, standard: 90, heavy: 90 } });
  });

  it('uses matching normalized cache offline even after thirty days, without changing stat semantics', async () => {
    const storage = mockStorage();
    const fetchMock = mockData([TARGET]);
    const service = await freshService();
    await service.init();
    expect(service.byId(2215)?.rangedDefence).toEqual({ light: -20, standard: 50, heavy: 150 });
    const saved = JSON.parse(storage.get(CACHE_KEY)!);
    expect(saved.source).toBe(MONSTER_CACHE_SOURCE);
    storage.set(CACHE_KEY, JSON.stringify({ ...saved, timestamp: 1 }));
    fetchMock.mockRejectedValue(new Error('offline'));
    const reloaded = await freshService();
    await reloaded.init();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reloaded.byId(2215)).toEqual(service.byId(2215));
  });

  it.each(['unfingerprinted', 'changed-source', 'changed-normalizer', 'empty', 'malformed'])(
    'replaces a %s cache with the shipped source', async kind => {
      const storage = mockStorage();
      const fetchMock = mockData([TARGET]);
      await (await freshService()).init();
      const cached = JSON.parse(storage.get(CACHE_KEY)!);
      if (kind === 'unfingerprinted') delete cached.source;
      if (kind === 'changed-source') cached.source = `another-source:${MONSTER_CATALOGUE.normalizationVersion}`;
      if (kind === 'changed-normalizer') cached.source = `${MONSTER_CATALOGUE.sha256}:0`;
      if (kind === 'empty') cached.data = [];
      if (kind === 'malformed') cached.data[0].rangedDefence.heavy = '150';
      storage.set(CACHE_KEY, JSON.stringify(cached));
      const service = await freshService();
      await service.init();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(service.byId(2215)?.rangedDefence?.heavy).toBe(150);
      expect(JSON.parse(storage.get(CACHE_KEY)!).source).toBe(MONSTER_CACHE_SOURCE);
    });

  it.each([[], {}, [{ id: 1, name: 'Non-attackable', skills: { hp: 0 } }]])(
    'keeps invalid or empty data unready and permits explicit retry', async invalid => {
      const storage = mockStorage();
      const fetchMock = mockData(invalid);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const service = await freshService();
      await expect(service.init()).rejects.toThrow(/monster dataset/);
      expect(service.ready).toBe(false);
      expect(service.error).toBeTruthy();
      expect(storage.has(CACHE_KEY)).toBe(false);
      fetchMock.mockResolvedValue({ ok: true, json: async () => [TARGET] });
      await expect(service.init()).rejects.toThrow(); // Implicit callers respect the cool-down.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await service.init(true);
      expect(service.ready).toBe(true);
      expect(service.error).toBeNull();
    });

  it('retries a missing asset, clears request timers after network failure, then recovers on demand', async () => {
    mockStorage();
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = await freshService();
    await expect(service.init()).rejects.toThrow('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    expect(service.ready).toBe(false);
    fetchMock.mockResolvedValue({ ok: true, json: async () => [TARGET] });
    await service.init(true);
    expect(service.ready).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps successfully loaded data usable when disposable cache storage is full', async () => {
    mockStorage();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    mockData([TARGET]);
    const service = await freshService();
    await service.init();
    expect(service.ready).toBe(true);
    expect(service.byId(2215)?.hp).toBe(255);
  });
});
