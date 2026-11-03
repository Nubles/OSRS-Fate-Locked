import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import {
  ARCANA_LIST, BOSSES_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, FARMING_PATCH_LIST, GUILDS_LIST, MERCHANTS_LIST,
  MINIGAMES_LIST, MOBILITY_LIST, ROLLABLE_POH_ITEMS, ROLLABLE_STORAGE_ITEMS, SKILLS_LIST, SLAYER_UNLOCKS_LIST,
} from '../constants';
import { completionDenominator } from './completion';
import { unlockableAreas } from './freeAreas';
import { BANK_IDS } from '../data/banks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_CHUNKS } from '../data/regionChunks';
import type { LogEntry, UnlockState } from '../types';
import { CHUNKED_START_KEY, chunkLabel } from './chunkAdjacency';
import { GRID, buildShareCardStats, cellToChunk, chunkToCell, latestLandUnlock, mapWindow, ownedChunks, unlockedContent } from './shareCard';

const run = (changes: Partial<UnlockState> = {}): UnlockState => ({ ...structuredClone(initialState.unlocks), ...changes });

const entry = (id: string, type: LogEntry['type'], message: string, timestamp: number, meta?: Record<string, unknown>): LogEntry =>
  ({ id, type, message, timestamp, ...(meta ? { meta } : {}) });

const DAY = 86_400_000;
const [subArea, subChunks] = Object.entries(SUB_AREA_CHUNKS).find(([, chunks]) => chunks.length > 0)!;

const stats = (over: Partial<Parameters<typeof buildShareCardStats>[0]> = {}) => buildShareCardStats({
  unlocks: run(),
  history: [],
  gameModeId: 'vanilla',
  profileName: 'Main Account',
  keys: 3, specialKeys: 1, chaosKeys: 2, fatePoints: 12,
  now: 10 * DAY,
  ...over,
});

describe('buildShareCardStats', () => {
  it('names the card after the linked account, falling back to the profile', () => {
    expect(stats({ linkedAccount: '  Nubles ' }).name).toBe('Nubles');
    expect(stats({ linkedAccount: '   ' }).name).toBe('Main Account');
  });

  it('says how many times the run was restored, and nothing for a run never restored', () => {
    expect(stats().restored).toBeNull();
    expect(stats({ restoreCount: 0 }).restored).toBeNull();
    expect(stats({ restoreCount: 1 }).restored).toBe('Restored 1 time');
    expect(stats({ restoreCount: 3 }).restored).toBe('Restored 3 times');
  });

  it('counts the day from the first history entry, starting at Day 1', () => {
    const history = [entry('a', 'ROLL_SUCCESS', 'Rolled', 2 * DAY)];
    expect(stats({ history, now: 2 * DAY + 5 }).day).toBe(1);
    expect(stats({ history, now: 9 * DAY + 5 }).day).toBe(8);
    expect(stats({ history }).since).toBe(new Date(2 * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
  });

  it('shows each skill and gear slot with its tier, and the tier caps', () => {
    const card = stats({ unlocks: run({ skills: { Attack: 3 }, levels: { Attack: 47 }, equipment: { Cape: 2 } }) });
    expect(card.skills.map(s => s.skill)).toEqual(SKILLS_LIST);
    expect(card.skills.find(s => s.skill === 'Attack')).toEqual({ skill: 'Attack', tier: 3, level: 47 });
    expect(card.skills.find(s => s.skill === 'Mining')).toMatchObject({ tier: 0 });
    expect(card.gear.map(g => g.slot)).toEqual(EQUIPMENT_SLOTS);
    expect(card.gear.find(g => g.slot === 'Cape')).toMatchObject({ tier: 2, file: 'Cape_slot.png' });
    expect(card.skillTierMax).toBe(10);
    expect(card.gearTierMax).toBe(EQUIPMENT_TIER_MAX);
  });

  it('counts unlocked content as held/total, ignoring names no longer in a table', () => {
    const card = stats({ unlocks: run({ bosses: [BOSSES_LIST[0], BOSSES_LIST[1], 'Retired boss'], banks: [BANK_IDS[0]] }) });
    expect(card.content.map(c => c.label)).toEqual([
      'Bosses', 'Minigames', 'Merchants', 'POH', 'Combat Powers', 'Storage', 'Banks', 'Mobility', 'Guilds', 'Farming', 'Slayer',
    ]);
    expect(card.content[0]).toEqual({ label: 'Bosses', done: 2, total: BOSSES_LIST.length });
    expect(card.content[6]).toMatchObject({ done: 1, total: BANK_IDS.length });
    expect(unlockedContent(run(), false).map(c => c.label)).not.toContain('Banks');
  });

  it('covers every table completion counts besides areas, skill tiers and gear tiers', () => {
    const full = run({
      bosses: [...BOSSES_LIST], minigames: [...MINIGAMES_LIST], merchants: [...MERCHANTS_LIST], housing: [...ROLLABLE_POH_ITEMS],
      arcana: [...ARCANA_LIST], storage: [...ROLLABLE_STORAGE_ITEMS], banks: [...BANK_IDS], mobility: [...MOBILITY_LIST],
      guilds: [...GUILDS_LIST], farming: [...FARMING_PATCH_LIST], slayerUnlocks: [...SLAYER_UNLOCKS_LIST],
    });
    const content = unlockedContent(full, true);
    expect(content.every(c => c.done === c.total)).toBe(true);
    const card = stats({ unlocks: full });
    const tiers = SKILLS_LIST.length * card.skillTierMax + EQUIPMENT_SLOTS.length * card.gearTierMax;
    expect(content.reduce((sum, c) => sum + c.total, 0) + unlockableAreas('vanilla').length + tiers).toBe(completionDenominator('vanilla'));
  });

  it('shows held Keys and the mode’s pity threshold, or none when pity is off', () => {
    const card = stats();
    expect(card).toMatchObject({ keys: 3, omni: 1, chaos: 2, fate: 12, fateMax: 50 });
    expect(stats({ gameModeId: 'hardcore' }).fateMax).toBeNull();
  });

  it('only calls the history checked when there is history and it passes', () => {
    expect(stats().history).toEqual({ ok: false, detail: 'No recorded history to check yet' });
    expect(stats().runId).toBeNull();
  });

  it('counts chunks in Chunked runs and owns the start chunk', () => {
    const card = stats({ gameModeId: 'chunked' });
    expect(card.areas.unit).toBe('chunks');
    expect(card.areas.unlocked).toBe(1);
    expect(card.owned.has(CHUNKED_START_KEY)).toBe(true);
  });

  it('adds Chunked’s fated sites reached and seals broken to the content boxes, and nothing in Vanilla', () => {
    const fateLand = {
      fulfilled: 0, marks: {}, gilded: [],
      sites: { [CHUNKED_START_KEY]: 'SHRINE' as const, '20,40': 'HOARD' as const, '21,40': 'RIFT' as const },
      seals: { Misthalin: '', Asgarnia: '30,50' },
    };
    const content = stats({ gameModeId: 'chunked', fateLand }).content;
    expect(content.slice(-2)).toEqual([
      { label: 'Fated sites', done: 1, total: 3 },
      { label: 'Seals', done: 2, total: Object.keys(REGION_CHUNKS).length },
    ]);
    expect(stats({ fateLand }).content.map(c => c.label)).not.toContain('Seals');
  });

  it('shows Combat Achievement points', () => {
    expect(stats().ca).toEqual({ points: 0, tier: null });
  });
});

describe('latestLandUnlock', () => {
  it('outlines the newest area unlock, skipping later non-land unlocks', () => {
    const history = [
      entry('a', 'UNLOCK', `Unlocked ${subArea}`, 1, { item: subArea, category: 'Regions' }),
      entry('b', 'UNLOCK', 'Unlocked Armour Case', 2, { item: 'Armour Case', category: 'Housing' }),
    ];
    expect(latestLandUnlock(history)).toEqual({ name: subArea, chunks: subChunks });
  });

  it('names a Chunked unlock by its place', () => {
    const history = [entry('a', 'UNLOCK', 'Unlocked chunk', 1, { item: '51,50', category: 'Chunks' })];
    expect(latestLandUnlock(history)).toEqual({ name: chunkLabel('51,50'), chunks: [{ cx: 51, cy: 50 }] });
  });

  it('shows no newest area when the latest area has no chunks on the map, or there is none', () => {
    expect(latestLandUnlock([entry('a', 'UNLOCK', 'Unlocked Nowhere', 1, { item: 'Nowhere', category: 'Regions' })])).toBeNull();
    expect(latestLandUnlock([entry('a', 'ROLL_FAIL', 'Missed', 1)])).toBeNull();
  });
});

describe('ownedChunks', () => {
  it('matches the world map: a fresh Vanilla run owns its free start areas', () => {
    expect(ownedChunks(run(), 'vanilla').size).toBeGreaterThan(0);
    expect(ownedChunks(run(), 'chunked')).toEqual(new Set([CHUNKED_START_KEY]));
  });
});

describe('mapWindow', () => {
  const aspect = 716 / 463;
  const shape = (w: { x0: number; y0: number; x1: number; y1: number }) => (w.x1 - w.x0) / (w.y1 - w.y0);

  it('fills the panel with the world, trimmed to the panel’s shape and never showing the blank outer columns', () => {
    const whole = mapWindow(new Set(), aspect, true);
    expect(whole).toMatchObject({ x0: 1, x1: GRID.w - 1 });
    expect(shape(whole)).toBeCloseTo(aspect);
    expect(whole.y0).toBeCloseTo(GRID.h - whole.y1);
    const tall = mapWindow(new Set(), 1, true);
    expect(tall).toMatchObject({ y0: 0, y1: GRID.h });
    expect(tall.x0).toBeCloseTo(GRID.w - tall.x1);
  });

  it('zooms to a small run, keeping the panel shape and the land inside', () => {
    const win = mapWindow(new Set([CHUNKED_START_KEY]), aspect, true);
    const { gx, gy } = chunkToCell({ cx: 50, cy: 50 });
    expect(win.x1 - win.x0).toBeCloseTo(14);
    expect(shape(win)).toBeCloseTo(aspect);
    expect(gx).toBeGreaterThanOrEqual(win.x0);
    expect(gx + 1).toBeLessThanOrEqual(win.x1);
    expect(gy).toBeGreaterThanOrEqual(win.y0);
    expect(gy + 1).toBeLessThanOrEqual(win.y1);
  });

  it('shows the whole world when zoom is off or the land spans it', () => {
    const corners = new Set([cellToChunk(0, 0), cellToChunk(GRID.w - 1, GRID.h - 1)].map(c => `${c.cx},${c.cy}`));
    expect(mapWindow(corners, aspect, true)).toEqual(mapWindow(new Set(), aspect, true));
    expect(mapWindow(new Set([CHUNKED_START_KEY]), aspect, false)).toEqual(mapWindow(new Set(), aspect, true));
  });

  it('maps grid cells and chunks both ways', () => {
    expect(chunkToCell(cellToChunk(7, 9))).toEqual({ gx: 7, gy: 9 });
  });
});
