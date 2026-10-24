import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { initialState } from '../context/GameContext';
import {
  LEGACY_DRAFT_RESCUE_KEY, MAP_SEED_HASH, REGION_DRAFT_BACKUP_KEY, REGION_DRAFT_KEY, SUBAREA_DRAFT_KEY, loadMapDraft,
} from './mapDraft';
import { buildRuneliteBundle, type RuneliteRunState } from './runeliteBundle';
import { isAreaReachable, isRegionUnlocked } from './reachability';
import { chunkUnlocked } from './chunkLocations';

const painted = { Misthalin: [{ cx: 50, cy: 50 }], Morytania: [{ cx: 40, cy: 40 }] };
const paintedSub = { Falador: [{ cx: 50, cy: 50 }] };
const envelope = (data: object, extra: object = {}) => JSON.stringify({ v: 2, seed: MAP_SEED_HASH, dirty: true, data, ...extra });

const memoryStorage = (seed: Record<string, string> = {}) => {
  const saved = new Map(Object.entries(seed));
  return {
    saved,
    getItem: vi.fn((key: string) => saved.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { saved.set(key, value); }),
  };
};

describe('loadMapDraft', () => {
  it('gives players the shipped map without touching a stored draft', () => {
    const storage = memoryStorage({ [REGION_DRAFT_KEY]: envelope(painted) });
    expect(loadMapDraft(REGION_DRAFT_KEY, REGION_CHUNKS, false, storage)).toEqual({ data: REGION_CHUNKS, dirty: false, keptStaleEdits: false });
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.saved.get(REGION_DRAFT_KEY)).toBe(envelope(painted));
  });

  it('ignores legacy drafts for players too (no rescue copy is written)', () => {
    const storage = memoryStorage({ [REGION_DRAFT_KEY]: JSON.stringify(painted) });
    expect(loadMapDraft(REGION_DRAFT_KEY, REGION_CHUNKS, false, storage).data).toBe(REGION_CHUNKS);
    expect(storage.saved.has(LEGACY_DRAFT_RESCUE_KEY)).toBe(false);
  });

  describe('with map authoring enabled', () => {
    it('loads a draft painted against the current shipped data', () => {
      const storage = memoryStorage({ [REGION_DRAFT_KEY]: envelope(painted) });
      expect(loadMapDraft(REGION_DRAFT_KEY, REGION_CHUNKS, true, storage)).toEqual({ data: painted, dirty: true, keptStaleEdits: false });
    });

    it('keeps hand edits over a newer seed and flags them', () => {
      const storage = memoryStorage({ [REGION_DRAFT_KEY]: envelope(painted, { seed: 'older' }) });
      expect(loadMapDraft(REGION_DRAFT_KEY, REGION_CHUNKS, true, storage)).toEqual({ data: painted, dirty: true, keptStaleEdits: true });
    });

    it('re-seeds an untouched draft from an older deploy', () => {
      const storage = memoryStorage({ [REGION_DRAFT_KEY]: envelope(painted, { seed: 'older', dirty: false }) });
      expect(loadMapDraft(REGION_DRAFT_KEY, REGION_CHUNKS, true, storage).data).toBe(REGION_CHUNKS);
    });

    it('re-seeds a legacy draft but rescues it once', () => {
      const legacy = JSON.stringify(painted);
      const storage = memoryStorage({ [REGION_DRAFT_KEY]: legacy });
      expect(loadMapDraft(REGION_DRAFT_KEY, REGION_CHUNKS, true, storage).data).toBe(REGION_CHUNKS);
      expect(storage.saved.get(LEGACY_DRAFT_RESCUE_KEY)).toBe(legacy);
    });

    it('falls back to shipped data on unreadable storage', () => {
      const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: vi.fn() };
      expect(loadMapDraft(SUBAREA_DRAFT_KEY, SUB_AREA_CHUNKS, true, blocked).data).toBe(SUB_AREA_CHUNKS);
      expect(loadMapDraft(SUBAREA_DRAFT_KEY, SUB_AREA_CHUNKS, true, memoryStorage({ [SUBAREA_DRAFT_KEY]: '{bad' })).data).toBe(SUB_AREA_CHUNKS);
    });
  });
});

describe('a stored map draft never reaches the rules or the RuneLite bundle', () => {
  const state: RuneliteRunState = { keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0, activeBuff: 'NONE', pinnedGoals: [] };
  const regions = ['Misthalin', 'Falador', 'Port Sarim'];
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const answers = async () => ({
    bundle: JSON.stringify(await buildRuneliteBundle(regions, state)),
    falador: isAreaReachable('Falador', { ...initialState.unlocks, regions }, 'vanilla'),
    morytania: isRegionUnlocked('Morytania', regions),
    chunk4040: chunkUnlocked(40, 40, { ...initialState.unlocks, regions }, 'vanilla'),
    chunk5050: chunkUnlocked(50, 50, { ...initialState.unlocks, regions }, 'vanilla'),
  });

  it('exports and answers the same with or without a hand-painted draft stored', async () => {
    const clean = await answers();
    storage.saved.set(REGION_DRAFT_KEY, envelope(painted));
    storage.saved.set(REGION_DRAFT_BACKUP_KEY, envelope(painted));
    storage.saved.set(SUBAREA_DRAFT_KEY, envelope(paintedSub));
    storage.getItem.mockClear();

    expect(await answers()).toEqual(clean);
    const draftReads = storage.getItem.mock.calls.filter(([key]) =>
      [REGION_DRAFT_KEY, REGION_DRAFT_BACKUP_KEY, SUBAREA_DRAFT_KEY].includes(key));
    expect(draftReads).toEqual([]);
  });
});
