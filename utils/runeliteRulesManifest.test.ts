import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import { MOBILITY_LIST } from '../data/items';
import type { ChunkContent } from '../services/ChunkContentService';
import {
  buildRuneliteRulesManifest,
  type RulesContentSource,
} from './runeliteRulesManifest';

const lumbridge: ChunkContent = {
  name: 'Lumbridge',
  monsters: [{ name: 'Goblin', count: 2, slayer: null }],
  npcs: [],
  objects: [],
  shops: ['Lumbridge General Store'],
  quests: { "Cook's Assistant": 'first' },
  diaries: {},
  clues: {},
  spawns: [],
};

const contentSource: RulesContentSource = {
  init: async () => true,
  allChunkCoords: () => [{ cx: 50, cy: 50 }],
  contentFor: () => lumbridge,
  connectGraph: () => ({}),
  shortcuts: () => [],
  questSections: () => ({}),
};

describe('buildRuneliteRulesManifest', () => {
  it('exports every rule family and a stable chunk snapshot', async () => {
    const manifest = await buildRuneliteRulesManifest({
      unlocks: {
        ...initialState.unlocks,
        regions: ['Asgarnia', 'Misthalin'],
        merchants: ['General Stores'],
        mobility: ['Spirit Trees', 'Fairy Rings'],
        slayerUnlocks: ['Bigger and Badder'],
        banks: ['12850'],
      },
      run: {
        runId: 'run-1',
        runRevision: 41,
        linkedAccount: 'Example',
        gameModeId: 'vanilla',
        rulesVersion: '1',
        contentVersion: 1,
        detectorContractVersion: 1,
      },
      exportedAt: '2026-07-24T10:00:00.000Z',
      contentService: contentSource,
      itemRuleSource: {
        init: async () => {},
        ready: true,
        itemRuleExport: () => ({ '4151': { tier: 7, slot: 'Weapon' } }),
      },
    });

    expect(manifest).toMatchObject({
      rulesVersion: '1',
      contentVersion: 1,
      detectorContractVersion: 1,
      runId: 'run-1',
      runRevision: 41,
      account: 'Example',
      gameModeId: 'vanilla',
      exportedAt: '2026-07-24T10:00:00.000Z',
      bankLocks: true,
    });
    expect(manifest.unlocks).toEqual(expect.objectContaining({
      regions: ['Asgarnia', 'Misthalin'],
      chunks: expect.any(Array),
      skills: expect.any(Object),
      levels: expect.any(Object),
      equipment: expect.any(Object),
      banks: ['12850'],
      merchants: ['General Stores'],
      bosses: expect.any(Array),
      minigames: expect.any(Array),
      mobility: expect.any(Array),
      arcana: expect.any(Array),
      guilds: expect.any(Array),
      farming: expect.any(Array),
      slayer: ['Bigger and Badder'],
      quests: expect.any(Array),
    }));
    expect(manifest.itemRules['4151']).toEqual({ tier: 7, slot: 'Weapon' });
    expect(manifest.knownMobility).toEqual([...MOBILITY_LIST].sort());
    expect(manifest.unlocks.mobility).toEqual([
      'Fairy Rings',
      'Spirit Trees',
    ]);
    expect(manifest.chunks['50,50']).toBeDefined();
    expect(Object.keys(manifest.chunks['50,50'].categories)).toEqual([
      'BANKS',
      'SHOPS',
      'QUESTS',
      'COMBAT',
    ]);
  });

  it('sorts exported collections deterministically', async () => {
    const manifest = await buildRuneliteRulesManifest({
      unlocks: {
        ...initialState.unlocks,
        regions: ['Z', 'A'],
        skills: { Zeta: 2, Attack: 4 },
        equipment: { Weapon: 3, Head: 1 },
      },
      run: {
        runId: 'run-2',
        runRevision: 2,
        gameModeId: 'vanilla',
      },
      contentService: contentSource,
      itemRuleSource: {
        init: async () => {},
        ready: true,
        itemRuleExport: () => ({ '4151': { tier: 7, slot: 'Weapon' } }),
      },
    });

    expect(manifest.unlocks.regions).toEqual(['A', 'Z']);
    expect(Object.keys(manifest.unlocks.skills)).toEqual(['Attack', 'Zeta']);
    expect(Object.keys(manifest.unlocks.equipment)).toEqual(['Head', 'Weapon']);
  });
});
