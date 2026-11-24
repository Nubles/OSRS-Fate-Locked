import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { chunkContentService } from '../services/ChunkContentService';
import { createFreshState } from '../context/GameContext';
import { shortcutLocator, shortcutPlaces, shortcutReachability } from './shortcutReach';
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
