import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { initialState } from '../context/GameContext';
import { QUEST_DATA } from '../data/questData';
import { BOSSES_LIST, FARMING_PATCH_LIST, GUILDS_LIST, MERCHANTS_LIST, REGIONS_LIST, REGION_GROUPS, SKILLS_LIST } from '../data/items';
import { evaluateBankRequirements, evaluateEntityAccess } from './entityAccess';
import { buildChunkPermissionSnapshot } from './chunkPermissionSnapshot';
import { buildRuneliteRulesManifest } from './runeliteRulesManifest';
import { buildRuneliteBundle } from './runeliteBundle';
import { chunkReachability } from './chunkReach';
import { CHUNKED_START } from './chunkAdjacency';
import { farmingPatchFor } from './farmingPatches';

const service = new ChunkContentService();
const account = () => ({
  ...structuredClone(initialState.unlocks),
  regions: [...REGIONS_LIST, ...Object.keys(REGION_GROUPS)],
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  quests: Object.keys(QUEST_DATA), bosses: [...BOSSES_LIST], merchants: [...MERCHANTS_LIST],
  guilds: [...GUILDS_LIST], farming: [...FARMING_PATCH_LIST],
});

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
});

describe('second audit permission regressions', () => {
  it('keeps mandatory quest equipment locked in exported map permissions', () => {
    const state = account();
    state.quests = state.quests.filter(id => id !== 'The Restless Ghost');
    const loc = service.entityLocations('The Restless Ghost', ['quest'])!.locations[0];
    const row = () => buildChunkPermissionSnapshot(service.contentFor(loc.cx, loc.cy)!, loc,
      { unlocks: state, gameModeId: 'vanilla', contentService: service })
      .categories.QUESTS!.find(row => row.name === 'The Restless Ghost')!;
    expect(row()).toMatchObject({ status: 'NOT_READY', detail: expect.stringMatching(/Neck.*T1.*ghostspeak/) });
    state.equipment.Neck = 1;
    expect(row().status).toBe('ALLOWED');
  });

  it('keeps untracked quest milestones unknown, preserves their explanations, and allows completed quests', () => {
    const state = account();
    state.quests = state.quests.filter(id => id !== 'Dragon Slayer II');
    const loc = service.entityLocations('Dragon Slayer II', ['quest'])!.locations[0];
    const snapshot = () => buildChunkPermissionSnapshot(service.contentFor(loc.cx, loc.cy)!, loc,
      { unlocks: state, gameModeId: 'vanilla', contentService: service });
    const row = () => snapshot().categories.QUESTS!.find(row => row.name === 'Dragon Slayer II')!;
    expect(row()).toMatchObject({ status: 'UNKNOWN', detail: expect.stringMatching(/pyre/i) });
    state.quests.push('Dragon Slayer II');
    expect(row().status).toBe('ALLOWED');
  });

  it.each([
    ['General Graardor', 'Strength'], ['Commander Zilyana', 'Agility'], ["Kree'arra", 'Ranged'], ['Nex', 'Hitpoints'],
  ])('uses canonical %s skill gates and keeps manual access checks unknown', (name, skill) => {
    const state = account();
    state.levels[skill] = 69;
    const loc = service.entityLocations(name, ['monster'])!.locations[0];
    const result = () => evaluateEntityAccess(name, 'monster', loc, state, 'vanilla', service);
    expect(result()).toMatchObject({ status: 'NOT_READY', reasons: expect.arrayContaining([`${skill} 70`]) });
    state.levels[skill] = 70;
    expect(result().status).toBe('UNKNOWN');
    expect(result().reasons.join(' ')).toMatch(/kill.count|ancient prison/i);
    const snapshot = buildChunkPermissionSnapshot(service.contentFor(loc.cx, loc.cy)!, loc,
      { unlocks: state, gameModeId: 'vanilla', contentService: service });
    expect(snapshot.categories.ACTIVITIES!.find(row => row.name === name)?.status).toBe('UNKNOWN');
  });

  it.each([
    ['Asgarnian Ice Dungeon', 'Ice giant', 'monster', ['Port Sarim', 'Mudskipper Point']],
    ['Asgarnian Ice Dungeon', 'Blurite rocks', 'object', ['Port Sarim', 'Mudskipper Point']],
    ['Keldagrim', 'Quality Weapons Shop', 'shop', ['Rellekka', 'Mountain Camp']],
  ] as const)('requires the independent %s Fate unlock for %s', (area, name, kind, regions) => {
    const state = { ...account(), regions: [...regions] as string[] };
    const loc = service.entityLocations(name, [kind])!.locations.find(loc => loc.locationName === area)!;
    expect(evaluateEntityAccess(name, kind, loc, state, 'vanilla', service))
      .toMatchObject({ status: 'LOCKED', reasons: [`Unlock ${area}`] });
    state.regions.push(area);
    expect(evaluateEntityAccess(name, kind, loc, state, 'vanilla', service).status).toBe('ALLOWED');
    state.regions = [];
    state.chunks = [`${loc.cx},${loc.cy}`];
    expect(evaluateEntityAccess(name, kind, loc, state, 'chunked', service).status).toBe('ALLOWED');
  });

  it('keeps a surface source independent of a locked interior copy', () => {
    const state = { ...account(), regions: [] };
    const source = { taskRequirements: () => [], chunkEntryRequirements: () => [],
      entityAccessOptions: (_name: string, _kind: unknown, _cx: number, _cy: number, sourceId?: string) =>
        sourceId ? [{ requirements: [], area: 'Zanaris' }] : [{ requirements: [] }, { requirements: [], area: 'Zanaris' }],
    };
    expect(evaluateEntityAccess('Test npc', 'npc', { cx: 50, cy: 50 }, state, 'vanilla', source).status).toBe('ALLOWED');
    expect(evaluateEntityAccess('Test npc', 'npc', { cx: 50, cy: 50, sourceId: 'interior' }, state, 'vanilla', source).status).toBe('LOCKED');
  });

  it('does not let the Keldagrim bank roll replace the independent city unlock', () => {
    const coord = { cx: 43, cy: 58 };
    const state = { ...account(), regions: ['Rellekka', 'Mountain Camp'], banks: ['11066'] };
    const bank = () => buildChunkPermissionSnapshot(service.contentFor(coord.cx, coord.cy)!, coord,
      { unlocks: state, gameModeId: 'vanilla', contentService: service }).categories.BANKS![0];
    expect(bank()).toMatchObject({ status: 'LOCKED', detail: expect.stringContaining('Keldagrim') });
    state.regions.push('Keldagrim');
    expect(bank().status).toBe('ALLOWED');
  });

  it('keeps alternate Catacombs entrances conditional and never substitutes a different source', () => {
    const state = { ...account(), regions: [], chunks: ['22,57'] };
    const west = { cx: 22, cy: 57, sourceId: '6556' };
    expect(evaluateEntityAccess('Ankou', 'monster', west, state, 'chunked', service))
      .toMatchObject({ status: 'UNKNOWN', reasons: expect.arrayContaining([expect.stringMatching(/west vine.*confirmation/)]) });
    state.chunks.push('25,57');
    expect(evaluateEntityAccess('Ankou', 'monster', west, state, 'chunked', service).status).toBe('UNKNOWN');
    expect(evaluateEntityAccess('Ankou', 'monster', { cx: 25, cy: 57, sourceId: '6556' }, state, 'chunked', service).status).toBe('ALLOWED');
    expect(evaluateEntityAccess('Ankou', 'monster', { cx: 25, cy: 57, sourceId: 'missing-source' }, state, 'chunked', service).status).toBe('UNKNOWN');
  });

  it('starts fresh and adjacent Chunked traversal at the actual free courtyard', async () => {
    const state = { ...structuredClone(initialState.unlocks), regions: [], chunks: ['50,51'] };
    const reach = chunkReachability(service.connectGraph(), state, CHUNKED_START, undefined, 'chunked');
    expect(reach.ownedCount).toBe(2);
    expect(reach.reachable).toEqual(new Set(['12850', '12851']));
    expect(reach.stranded.size).toBe(0);
    state.chunks = [];
    const manifest = await buildRuneliteRulesManifest({ unlocks: state,
      run: { runId: 'permission-regression', runRevision: 0, gameModeId: 'chunked' }, contentService: service,
      itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
    });
    expect(manifest.chunks['50,50'].entry).toBe('ALLOWED');
    expect(manifest.chunks['50,50'].categories.QUESTS!.find(row => row.name === "Cook's Assistant")?.status).toBe('ALLOWED');
    // The app-authored v4 snapshot must survive bundling unchanged; legacy chunk
    // ownership remains a distinct, explicitly present field even when empty.
    const bundle = await buildRuneliteBundle([], { keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0, activeBuff: 'NONE', pinnedGoals: [] },
      undefined, undefined, [], [], true, undefined, manifest);
    expect(bundle.rules.chunks).toEqual(manifest.chunks);
    expect(bundle.unlockedChunks).toEqual([]);
  });

  it('uses Wood Tree for all regular tree patches without clearing unrelated access uncertainty', () => {
    const state = account();
    expect(farmingPatchFor('Tree patch')).toBe('Wood Tree');
    expect(farmingPatchFor('Fruit tree patch')).toBe('Fruit Tree');
    expect(farmingPatchFor('Spirit tree patch')).toBe('Spirit Tree');
    const locations = service.entityLocations('Tree patch', ['object'])!.locations;
    expect(locations.length).toBeGreaterThanOrEqual(7);
    for (const loc of locations) {
      const row = buildChunkPermissionSnapshot(service.contentFor(loc.cx, loc.cy)!, loc,
        { unlocks: state, gameModeId: 'vanilla', contentService: service }).categories.FARMING!.find(row => row.name === 'Tree patch')!;
      expect(row.status, `${loc.cx},${loc.cy}`).not.toBe('LOCKED');
    }
    state.farming = state.farming.filter(patch => patch !== 'Wood Tree');
    const loc = { cx: 46, cy: 52 };
    expect(buildChunkPermissionSnapshot(service.contentFor(loc.cx, loc.cy)!, loc,
      { unlocks: state, gameModeId: 'vanilla', contentService: service }).categories.FARMING!.find(row => row.name === 'Tree patch')?.status).toBe('LOCKED');
  });

  it.each([5939, 5427, 13354, 15151])('recognizes reviewed non-generic bank facility %i', id => {
    const coord = { cx: Math.floor(id / 256), cy: id % 256 };
    expect(evaluateBankRequirements(service.contentFor(coord.cx, coord.cy)!, coord, account(), service).status).toBe('ALLOWED');
  });

  it('does not turn the non-banking Hunter Guild buffalo or an arbitrary deposit box into a bank', () => {
    const fixture = { ...service.contentFor(24, 47)!, objects: [['Bank buffalo', 1], ['Deposit Box', 1]] as [string, number][], npcs: [] };
    const source = { taskRequirements: () => [], chunkEntryRequirements: () => [] };
    expect(evaluateBankRequirements(fixture, { cx: 24, cy: 47 }, account(), source).status).toBe('UNKNOWN');
    const state = account();
    state.quests = state.quests.filter(quest => quest !== 'Cabin Fever');
    expect(evaluateBankRequirements(service.contentFor(59, 47)!, { cx: 59, cy: 47 }, state, service).status).toBe('NOT_READY');
  });

  it.each([['Sawmill Operator', 'Sawmill Operators'], ['Estate agent', 'Real Estate Agents'], ['Sbott', 'Tanners']])
    ('requires the %s merchant category at every indexed service location', (name, category) => {
      const state = { ...account(), merchants: [] as string[] };
      const locations = service.entityLocations(name, ['npc'])!.locations;
      for (const loc of locations) {
        expect(evaluateEntityAccess(name, 'npc', loc, state, 'vanilla', service))
          .toMatchObject({ status: 'LOCKED', reasons: [`Unlock ${category}`] });
      }
      state.merchants.push(category);
      expect(locations.some(loc => evaluateEntityAccess(name, 'npc', loc, state, 'vanilla', service).status === 'ALLOWED')).toBe(true);
    });
});
