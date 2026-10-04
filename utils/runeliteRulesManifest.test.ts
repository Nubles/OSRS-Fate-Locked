import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import { MOBILITY_LIST } from '../data/items';
import { getGameMode } from '../config/gameModes';
import { TRAVEL_METHODS } from '../data/travelMethods';
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

describe('buildRuneliteRulesManifest - free areas', () => {
  it("sends the areas the run's mode frees, whatever the global holds", async () => {
    const build = async (gameModeId: string, customMode?: ReturnType<typeof getGameMode>['rules']) =>
      (await buildRuneliteRulesManifest({
        unlocks: initialState.unlocks, run: { runId: 'free', runRevision: 1, gameModeId, customMode },
        contentService: contentSource,
        itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
      })).freeAreas;
    expect(await build('vanilla')).toContain('Varrock');
    expect(await build('xtreme')).toEqual(['Tutorial Island', 'Lumbridge']);
    expect(await build('chunked')).toEqual(['Tutorial Island']);
    expect(await build('custom', { ...getGameMode('vanilla').rules, startArea: 'none' })).toEqual(['Tutorial Island']);
  });
});

describe('buildRuneliteRulesManifest - progress', () => {
  it("sends the run card's progress, with the land chunks it owns", async () => {
    const manifest = await buildRuneliteRulesManifest({
      unlocks: { ...structuredClone(initialState.unlocks), regions: ['Falador'] },
      run: { runId: 'progress', runRevision: 1, gameModeId: 'vanilla' },
      contentService: contentSource,
      itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
    });
    expect(manifest.progress).toMatchObject({ unit: 'areas', unlocked: 10, total: 187, chunks: { total: 624 } });
    expect(manifest.progress?.chunks.unlocked).toBeGreaterThan(0);
  });
});

describe('buildRuneliteRulesManifest - capabilities', () => {
  const build = (gameModeId: string, loaded: boolean) => buildRuneliteRulesManifest({
    unlocks: { ...structuredClone(initialState.unlocks), regions: [], chunks: [] },
    run: { runId: 'capabilities', runRevision: 1, gameModeId },
    contentService: { ...contentSource, init: async () => loaded },
    itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
  });

  it('names exactly the Stage 2 sections the rules have', async () => {
    expect((await build('vanilla', true)).capabilities)
      .toEqual(['banks', 'chunkDetails', 'chunkEntries', 'detection', 'freeAreas', 'places', 'progress', 'spentBosses', 'travel']);
    expect((await build('chunked', true)).capabilities)
      .toEqual(['banks', 'chunkDetails', 'chunkEntries', 'detection', 'freeAreas', 'frontier', 'places', 'progress', 'spentBosses', 'travel']);
  });

  it('leaves out the sections that need chunk data when it did not load', async () => {
    // The detection tables and the spent bosses need no chunk data either.
    expect((await build('vanilla', false)).capabilities).toEqual(['detection', 'freeAreas', 'progress', 'spentBosses']);
    expect((await build('chunked', false)).capabilities).toEqual(['detection', 'freeAreas', 'frontier', 'progress', 'spentBosses']);
  });
});

describe('buildRuneliteRulesManifest - spent bosses', () => {
  const awarded = { Brutus: 1, Zulrah: 1, 'Theatre of Blood': 3 };
  const build = async (gameModeId: string, bossStandardKeysAwarded?: Record<string, number>) =>
    (await buildRuneliteRulesManifest({
      unlocks: initialState.unlocks,
      run: { runId: 'spent', runRevision: 1, gameModeId, bossStandardKeysAwarded },
      contentService: { ...contentSource, init: async () => false },
      itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
    })).spentBosses;

  it("sends a Vanilla run's bosses with no Standard Keys left, so RuneLite stops offering their kills", async () => {
    expect(await build('vanilla', awarded)).toEqual(['Brutus', 'Theatre of Blood']);
    expect(await build('vanilla')).toEqual([]);
  });

  it('sends none for a mode that rolls every kill', async () => {
    expect(await build('xtreme', awarded)).toEqual([]);
    expect(await build('chunked', awarded)).toEqual([]);
  });
});

describe('buildRuneliteRulesManifest - travel', () => {
  const build = (mobility: string[], loaded = true) => buildRuneliteRulesManifest({
    unlocks: { ...structuredClone(initialState.unlocks), regions: [], mobility },
    run: { runId: 'travel', runRevision: 1, gameModeId: 'vanilla' },
    contentService: { ...contentSource, init: async () => loaded, allChunkCoords: () => [{ cx: 50, cy: 50 }, { cx: 46, cy: 52 }] },
    itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
  });

  it("decides each option from the run's chunk entries, with the snapshot's reason", async () => {
    const manifest = await build([]);
    // Misthalin is free and Falador isn't.
    expect(manifest.travel?.['spell:standard:lumbridge-teleport'].options.Cast).toEqual({ to: ['50,50'], status: 'ALLOWED' });
    expect(manifest.travel?.['spell:standard:falador-teleport'].options.Cast)
      .toEqual({ to: ['46,52'], status: 'LOCKED', reason: manifest.chunks['46,52'].entryReason });
    expect([manifest.chunkEntries?.['46,52'], manifest.chunks['46,52'].entryReason]).toEqual(['LOCKED', expect.any(String)]);
  });

  it('locks an option while the unlock its method needs is locked', async () => {
    expect((await build([])).travel?.['item:amulet-of-glory'].options.Edgeville)
      .toEqual({ to: ['48,54'], status: 'LOCKED', reason: 'Needs Jewelry Teleports' });
    const unlocked = await build(['Jewelry Teleports']);
    expect(unlocked.travel?.['item:amulet-of-glory'].options.Edgeville).toEqual({ to: ['48,54'], status: 'ALLOWED' });
    expect(unlocked.travel?.['item:amulet-of-glory'].options.Rub.status).toBe('UNKNOWN');
  });

  it('sends every method, and nothing when the chunk data did not load', async () => {
    expect(Object.keys((await build([])).travel ?? {})).toHaveLength(TRAVEL_METHODS.length);
    expect((await build([], false)).travel).toBeUndefined();
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
