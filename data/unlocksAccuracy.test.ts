/**
 * Accuracy audit, batch 4 (shops, guilds, banks and levels): each fix checked
 * against the shipped chunk data, so a resync or an edit that undoes one fails
 * here. Findings are named as the audit names them (S11, B1, G4…).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { createFreshState } from '../context/GameContext';
import { evaluateEntityAccess } from '../utils/entityAccess';
import {
  FARMING_PATCH_LIST, GUILDS_LIST, MERCHANTS_LIST, MINIGAMES_LIST, MISTHALIN_AREAS, MOBILITY_LIST,
  REGIONS_LIST, SKILLS_LIST, BOSSES_LIST,
} from './items';
import { QUEST_DATA } from './questData';
import type { UnlockState } from '../types';

const service = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
});

const levels = (level: number) => Object.fromEntries(SKILLS_LIST.map(skill => [skill, level]));

/** A run that owns every area and unlock, has done every quest and has these levels. */
const everything = (level = 99, changes: Partial<UnlockState> = {}): UnlockState => ({
  ...createFreshState().unlocks,
  skills: levels(10),
  levels: levels(level),
  regions: [...REGIONS_LIST, ...MISTHALIN_AREAS],
  merchants: [...MERCHANTS_LIST],
  guilds: [...GUILDS_LIST],
  minigames: [...MINIGAMES_LIST],
  mobility: [...MOBILITY_LIST],
  farming: [...FARMING_PATCH_LIST],
  bosses: [...BOSSES_LIST],
  quests: Object.keys(QUEST_DATA),
  ...changes,
});

describe('S11: members content does not wait on a free-to-play tag', () => {
  it('leaves the Chunk Picker\'s "F2P Only" tag out of every requirement', () => {
    expect(JSON.stringify(content)).not.toContain('F2P Only');
  });

  it('lets a run that owns everything use the members shops the tag held at "needs confirmation"', () => {
    const shops: [string, number, number][] = [
      ['Garden Centre', 47, 52], ['Construction supplies', 51, 54], ["Harry's Fishing Shop", 44, 53],
      ['Fancy Clothes Store', 51, 53], ['Draynor Seed Market', 48, 50], ["Trader Stan's Trading Post", 28, 57],
      ['Slayer Equipment (shop)', 45, 55], ['Pie Shop', 49, 53], ['Farming Supplies', 43, 54],
      ["Hickton's Archery Emporium", 44, 53], ["Jatix's Herblore Shop", 45, 53], ['Ye olde Tea Shoppe', 51, 53],
    ];
    for (const [name, cx, cy] of shops) {
      expect(evaluateEntityAccess(name, 'shop', { cx, cy }, everything(), 'vanilla', service), name)
        .toEqual({ status: 'ALLOWED', reasons: [] });
    }
  });
});
