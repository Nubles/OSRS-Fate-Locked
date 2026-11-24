import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { chunkContentService } from '../services/ChunkContentService';
import { createFreshState } from '../context/GameContext';
import { runShortcutReach, shortcutLocator, shortcutPlaces, shortcutReachability, shortcutsByChunk } from './shortcutReach';
import { buildChunkPermissionSnapshot, type ChunkPermissionRow } from './chunkPermissionSnapshot';
import { computeAreaRoutes } from './areaRoutes';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { ALL_CHUNK_KEYS } from './chunkAdjacency';
import type { UnlockState } from '../types';

// The shortcut panels over the real chunk content (public/chunk-content.json).
const doc = JSON.parse(readFileSync(resolve('public/chunk-content.json'), 'utf8'));

beforeAll(async () => {
  (globalThis as { fetch?: unknown }).fetch = async () => ({ ok: true, json: async () => doc });
  expect(await chunkContentService.init()).toBe(true);
});

const SKILLS = ['Agility', 'Strength', 'Ranged', 'Mining', 'Construction', 'Thieving', 'Woodcutting', 'Firemaking', 'Crafting', 'Hunter', 'Magic'];

/** A run with every shortcut skill at tier 10 / level 99 and nothing else done. */
const skilled = (over: Partial<UnlockState> = {}): UnlockState => {
  const fresh = createFreshState().unlocks;
  return {
    ...fresh,
    skills: { ...fresh.skills, ...Object.fromEntries(SKILLS.map(skill => [skill, 10])) },
    levels: { ...fresh.levels, ...Object.fromEntries(SKILLS.map(skill => [skill, 99])) },
    quests: [],
    diaries: [],
    ...over,
  };
};

const rowOf = (reach: ReturnType<typeof shortcutReachability>, name: string) => {
  const row = reach.rows.find(r => r.name === name);
  expect(row, name).toBeTruthy();
  return row!;
};

describe('shortcut placement (reach-map.d1[1])', () => {
  it('places every shortcut given by a chunk id or an interior', () => {
    const interiors = doc.interiors as Record<string, { name: string }>;
    const names = new Set(Object.values(interiors).map(entry => entry.name));
    const unplaced = chunkContentService.shortcuts()
      .filter(s => s.chunks.some((entry: string) => /^\d+(-\d+)?$/.test(entry) || interiors[entry] || names.has(entry)))
      .filter(s => shortcutPlaces(s, chunkContentService).length === 0)
      .map(s => s.name);
    expect(unplaced).toEqual([]);
  });

  it('reads a chunk id as cx * 256 + cy, with or without a -N suffix, and an interior by its way in', () => {
    const at = (name: string) => shortcutPlaces(chunkContentService.shortcuts().find(s => s.name === name)!, chunkContentService);
    expect(at('Access the Grand Exchange Agility shortcut')).toEqual([{ cx: 49, cy: 54 }]);
    expect(at('Access the Al Kharid Palace southern window shortcut')).toEqual([{ cx: 51, cy: 49 }]);
    expect(at('Access the Shilo Village rocks shortcut')).toEqual([{ cx: 44, cy: 46 }, { cx: 44, cy: 47 }]);
    // Heroes' Guild#Basement is entered from 11574 (45,54), the guild by Burthorpe.
    expect(at("Access the Heroes' Guild tunnel shortcut")).toEqual([{ cx: 45, cy: 54 }]);
  });

  it('judges the Grand Exchange shortcut ready in Vanilla and Chunked once its place is owned', () => {
    const vanilla = skilled();
    const reach = shortcutReachability(chunkContentService.shortcuts(), vanilla, shortcutLocator(chunkContentService, vanilla, 'vanilla', null));
    expect(rowOf(reach, 'Access the Grand Exchange Agility shortcut')).toMatchObject({ status: 'ready', loc: { cx: 49, cy: 54 } });

    const chunked = skilled({ chunks: ['49,54'] });
    const inChunk = shortcutReachability(chunkContentService.shortcuts(), chunked, shortcutLocator(chunkContentService, chunked, 'chunked', null));
    expect(rowOf(inChunk, 'Access the Grand Exchange Agility shortcut').status).toBe('ready');
    const elsewhere = skilled({ chunks: ['50,50'] });
    const away = shortcutReachability(chunkContentService.shortcuts(), elsewhere, shortcutLocator(chunkContentService, elsewhere, 'chunked', null));
    expect(rowOf(away, 'Access the Grand Exchange Agility shortcut').status).toBe('area-locked');
  });
});

describe('shortcuts no route reaches (reach-map.d2[0])', () => {
  const boots = 'Access the climbing boots rocks shortcut';

  it('does not call a shortcut ready in an owned Vanilla area no route reaches', () => {
    const run = skilled({ regions: ['Burthorpe'] });
    const routes = computeAreaRoutes(chunkContentService.connectGraph(), run, 'vanilla');
    expect(routes.strandedAreas.has('Burthorpe')).toBe(true);
    const reach = runShortcutReach(chunkContentService, run, 'vanilla', routes);
    expect(rowOf(reach, boots).status).toBe('no-route');
    expect(reach.rows.filter(r => r.status === 'ready').map(r => r.name)).not.toContain(boots);
    // While the routes load, owning the area is enough, as before.
    expect(rowOf(runShortcutReach(chunkContentService, run, 'vanilla', null), boots).status).toBe('ready');
  });

  it('does not call a shortcut ready in an owned chunk no route reaches in Chunked', () => {
    const run = skilled({ chunks: ['49,54'] });
    const routes = computeAreaRoutes(chunkContentService.connectGraph(), run, 'chunked');
    expect(routes.strandedChunks.has('49,54')).toBe(true);
    const ge = 'Access the Grand Exchange Agility shortcut';
    expect(rowOf(runShortcutReach(chunkContentService, run, 'chunked', routes), ge).status).toBe('no-route');
    expect(rowOf(runShortcutReach(chunkContentService, run, 'chunked', null), ge).status).toBe('ready');
  });
});

describe('shortcuts in a chunk whose entry needs a quest (reach-map.d3[0])', () => {
  const allAreas = [...Object.keys(REGION_CHUNKS), ...Object.keys(SUB_AREA_CHUNKS)];
  const cases: [string, string][] = [
    ['Access the Slayer Tower window shortcut', 'Priest in Peril'],
    ['Access the Aldarin rock climb shortcut', 'Children of the Sun'],
    ["Access the Mos Le'Harmless north stepping stones shortcut", 'Cabin Fever'],
  ];

  for (const [gameModeId, own] of [['vanilla', { regions: allAreas }], ['chunked', { chunks: ALL_CHUNK_KEYS }]] as const) {
    it(`holds them until that quest is done (${gameModeId})`, () => {
      const run = skilled(own);
      const before = runShortcutReach(chunkContentService, run, gameModeId, null);
      for (const [name, quest] of cases) expect(rowOf(before, name), name).toMatchObject({ status: 'quest', quest });
      const after = runShortcutReach(chunkContentService, skilled({ ...own, quests: cases.map(([, quest]) => quest) }), gameModeId, null);
      for (const [name] of cases) expect(rowOf(after, name).status, name).toBe('ready');
    });
  }
});

describe("RuneLite chunk details' shortcut rows (reach-map.d1[2])", () => {
  const allAreas = [...Object.keys(REGION_CHUNKS), ...Object.keys(SUB_AREA_CHUNKS)];
  const travelAt = (cx: number, cy: number, unlocks: UnlockState): ChunkPermissionRow[] => {
    const content = chunkContentService.contentFor(cx, cy);
    expect(content, `${cx},${cy}`).toBeTruthy();
    return buildChunkPermissionSnapshot(content!, { cx, cy }, {
      unlocks, gameModeId: 'vanilla', shortcuts: chunkContentService.shortcuts(), shortcutContent: chunkContentService,
    }).categories.TRAVEL ?? [];
  };

  it('hold a quest-gated shortcut until its quest is done', () => {
    const name = 'Access the Shilo Village rocks shortcut';
    const [loc] = shortcutPlaces(chunkContentService.shortcuts().find(s => s.name === name)!, chunkContentService);
    const before = travelAt(loc.cx, loc.cy, skilled({ regions: allAreas })).find(row => row.name === name);
    expect(before).toMatchObject({ status: 'NOT_READY', targetKind: 'TELEPORT' });
    expect(before?.detail).toContain('Needs Shilo Village');
    const after = travelAt(loc.cx, loc.cy, skilled({ regions: allAreas, quests: ['Shilo Village'] })).find(row => row.name === name);
    expect(after?.status).toBe('ALLOWED');
  });

  it('give every shortcut the panels can place a row, with the panels\' verdict', () => {
    const run = skilled({ regions: allAreas });
    const panel = runShortcutReach(chunkContentService, run, 'vanilla', null);
    const verdict = new Map<string, string>();
    for (const [key, group] of shortcutsByChunk(chunkContentService.shortcuts(), chunkContentService)) {
      const [cx, cy] = key.split(',').map(Number);
      if (!chunkContentService.contentFor(cx, cy)) continue;
      const rows = travelAt(cx, cy, run);
      expect(rows.length, key).toBe(new Set(group.map(s => s.name)).size);
      for (const row of rows) verdict.set(`${row.name}@${key}`, row.status);
    }
    const placed = panel.rows.filter(row => row.loc);
    // Before: 15 of the 205 shortcuts had a row (an exact match on the bare chunk id).
    expect(new Set([...verdict.keys()].map(key => key.split('@')[0])).size).toBe(placed.length);
    expect(placed.length).toBeGreaterThan(150);
    for (const row of placed) {
      if (row.loc?.entryQuests?.length) continue;
      const status = verdict.get(`${row.name}@${row.loc!.cx},${row.loc!.cy}`);
      if (status === undefined) continue;
      expect(status, row.name).toBe(row.status === 'ready' ? 'ALLOWED' : 'NOT_READY');
    }
  });
});
