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
        housing: ['Portal Nexus', 'Jewellery Box'],
        storage: ['Rune Pouch', 'Looting Bag'],
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
      housing: ['Jewellery Box', 'Portal Nexus'],
      storage: ['Looting Bag', 'Rune Pouch'],
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

  it('exports pending overlap credits as their two canonical region owners', async () => {
    const manifest = await buildRuneliteRulesManifest({
      unlocks: {
        ...initialState.unlocks,
        regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"],
      },
      run: {
        runId: 'run-pending-overlaps',
        runRevision: 3,
        gameModeId: 'vanilla',
      },
      contentService: contentSource,
      itemRuleSource: {
        init: async () => {},
        ready: true,
        itemRuleExport: () => ({}),
      },
    });

    expect(manifest.unlocks.regions).toEqual(['Baxtorian Falls', 'Taverley']);
    expect(manifest.unlocks.regions).not.toContain("Otto's Grotto");
    expect(manifest.unlocks.regions).not.toContain("Heroes' Guild");
  });
});

describe('buildRuneliteRulesManifest - frontier', () => {
  const build = (gameModeId: string, changes: Partial<typeof initialState.unlocks>) => buildRuneliteRulesManifest({
    unlocks: { ...structuredClone(initialState.unlocks), ...changes },
    run: { runId: 'frontier', runRevision: 1, gameModeId },
    contentService: contentSource,
    itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
  });
  const sailor = { skills: { ...initialState.unlocks.skills, Sailing: 1 }, levels: { ...initialState.unlocks.levels, Sailing: 1 }, quests: ['Pandemonium'] };

  it("sends a Chunked run's next chunks, in chunk order", async () => {
    const manifest = await build('chunked', { regions: [], chunks: ['49,50', '49,49'] });
    expect(manifest.frontier).toEqual(['48,49', '48,50', '49,51', '50,49', '50,51', '51,50']);
  });

  it('adds the land its Sailing reaches across the sea', async () => {
    const manifest = await build('chunked', { regions: [], chunks: ['49,50', '49,49'], ...sailor });
    expect(manifest.frontier).toEqual(expect.arrayContaining(['49,47', '50,48']));
    expect(manifest.frontier).toHaveLength(8);
  });

  it('sends no frontier for other runs', async () => {
    expect(await build('vanilla', {})).not.toHaveProperty('frontier');
  });
});

describe('buildRuneliteRulesManifest - banks', () => {
  it("decides a bank with the run's reach, as its chunk's row does", async () => {
    // Lumbridge Castle's bank, rolled, in a chunk behind an unfinished quest.
    const bankHall: ChunkContent = { ...lumbridge, objects: [['Bank booth', 2]] };
    const build = (quests: string[]) => buildRuneliteRulesManifest({
      unlocks: { ...structuredClone(initialState.unlocks), banks: ['12850'], quests },
      run: { runId: 'banks', runRevision: 1, gameModeId: 'vanilla' },
      contentService: { ...contentSource, contentFor: () => bankHall, questSections: () => ({ '12850': ["Cook's Assistant"] }) },
      itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
    });
    const gated = await build([]);
    expect(gated.banks?.['12850']).toMatchObject({ at: '50,50', physical: ['50,50'], status: 'NOT_READY' });
    expect(gated.chunks['50,50'].categories.BANKS?.[0].status).toBe('NOT_READY');
    expect((await build(["Cook's Assistant"])).banks?.['12850'].status).toBe('ALLOWED');
  });
});

describe('buildRuneliteRulesManifest - web-only unlock families', () => {
  it('adds housing and storage without changing the unlock fields the plugin reads', async () => {
    // RuneliteRulesManifest.java's Unlocks class. Gson drops every other key,
    // so the web-only families below must never gain a plugin decision here.
    const pluginUnlockFields = [
      'regions', 'chunks', 'skills', 'levels', 'equipment', 'banks',
      'merchants', 'bosses', 'minigames', 'mobility', 'arcana', 'guilds',
      'farming', 'slayer', 'quests',
    ];
    const webOnlyUnlockFields = ['housing', 'storage'];
    const manifest = await buildRuneliteRulesManifest({
      unlocks: {
        ...structuredClone(initialState.unlocks),
        housing: ['Portal Nexus'],
        storage: ['Rune Pouch'],
      },
      run: { runId: 'web-only-families', runRevision: 1, gameModeId: 'vanilla' },
      itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
      contentService: {
        init: async () => false, allChunkCoords: () => [], contentFor: () => null,
        connectGraph: () => ({}), shortcuts: () => [], questSections: () => ({}),
      },
    });

    expect(Object.keys(manifest.unlocks).sort())
      .toEqual([...pluginUnlockFields, ...webOnlyUnlockFields].sort());
    expect(manifest.unlocks.housing).toEqual(['Portal Nexus']);
    expect(manifest.unlocks.storage).toEqual(['Rune Pouch']);
  });
});
