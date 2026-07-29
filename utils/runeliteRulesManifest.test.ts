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

  it('exports compact RuneProof summaries in stable goal order', async () => {
    const manifest = await buildRuneliteRulesManifest({
      unlocks: initialState.unlocks,
      run: { runId: 'run-proof', runRevision: 7, gameModeId: 'vanilla' },
      contentService: contentSource,
      itemRuleSource: { init: async () => {}, ready: true, itemRuleExport: () => ({}) },
      runeProof: [
        { goalId: 'quest:z', goalLabel: 'Z goal', status: 'BLOCKED', explanation: 'Missing requirements.', routeLabels: [], blockerLabels: ['A gate'], unavoidableBlockerLabels: ['A gate'], proofHash: null, sourceVersion: 'sources-v1', runRevision: 7 },
        { goalId: 'item:a', goalLabel: 'A goal', status: 'OBTAINABLE', explanation: 'A current route is verified.', routeLabels: ['Floor spawn'], blockerLabels: [], unavoidableBlockerLabels: [], proofHash: 'sha256-' + 'a'.repeat(64), sourceVersion: 'sources-v1', runRevision: 7 },
      ],
    } as any);

    expect((manifest as any).runeProofSchemaVersion).toBe(1);
    expect((manifest as any).runeProof.map((summary: any) => summary.goalId))
      .toEqual(['item:a', 'quest:z']);
  });
  it('canonicalizes proof label arrays into deterministic bytes', async () => {
    const build = (routeLabels: string[]) => buildRuneliteRulesManifest({
      unlocks: initialState.unlocks,
      run: { runId: 'run-proof', runRevision: 7, gameModeId: 'vanilla' },
      contentService: contentSource,
      itemRuleSource: { init: async () => {}, ready: true, itemRuleExport: () => ({}) },
      runeProofSourceVersion: 'sources-v1',
      runeProof: [{
        goalId: 'item:a', goalLabel: 'A goal', status: 'OBTAINABLE',
        explanation: 'Verified now.', routeLabels,
        blockerLabels: [], unavoidableBlockerLabels: [],
        proofHash: 'sha256-' + 'a'.repeat(64), sourceVersion: 'sources-v1', runRevision: 7,
      }],
    } as any);

    const first = await build(['Spawn', 'Shop', 'Spawn']);
    const second = await build(['Shop', 'Spawn']);
    expect(JSON.stringify((first as any).runeProof))
      .toBe(JSON.stringify((second as any).runeProof));
    expect((first as any).runeProof[0].routeLabels).toEqual(['Shop', 'Spawn']);
  });

  it('turns stale positive certificates into UNKNOWN without route claims', async () => {
    const manifest = await buildRuneliteRulesManifest({
      unlocks: initialState.unlocks,
      run: { runId: 'run-proof', runRevision: 8, gameModeId: 'vanilla' },
      contentService: contentSource,
      itemRuleSource: { init: async () => {}, ready: true, itemRuleExport: () => ({}) },
      runeProofSourceVersion: 'sources-v2',
      runeProof: [{
        goalId: 'item:a', goalLabel: 'A goal', status: 'OBTAINABLE',
        explanation: 'Old route.', routeLabels: ['Spawn'], blockerLabels: [],
        unavoidableBlockerLabels: [], proofHash: 'sha256-' + 'a'.repeat(64),
        sourceVersion: 'sources-v1', runRevision: 7,
      }],
    } as any);

    expect((manifest as any).runeProof).toEqual([{
      goalId: 'item:a', goalLabel: 'A goal', status: 'UNKNOWN',
      explanation: 'The selected proof is stale or could not be verified.',
      routeLabels: [], blockerLabels: [], unavoidableBlockerLabels: [],
      proofHash: null, sourceVersion: 'sources-v2', runRevision: 8,
    }]);
  });

  it('preserves the semantic distinction between UNKNOWN and IMPOSSIBLE', async () => {
    const manifest = await buildRuneliteRulesManifest({
      unlocks: initialState.unlocks,
      run: { runId: 'run-proof', runRevision: 7, gameModeId: 'vanilla' },
      contentService: contentSource,
      itemRuleSource: { init: async () => {}, ready: true, itemRuleExport: () => ({}) },
      runeProofSourceVersion: 'sources-v1',
      runeProof: [
        { goalId: 'item:impossible', goalLabel: 'Impossible', status: 'IMPOSSIBLE', explanation: 'Every audited route is excluded.', routeLabels: [], blockerLabels: [], unavoidableBlockerLabels: [], proofHash: null, sourceVersion: 'sources-v1', runRevision: 7 },
        { goalId: 'item:unknown', goalLabel: 'Unknown', status: 'UNKNOWN', explanation: 'Coverage is incomplete.', routeLabels: [], blockerLabels: [], unavoidableBlockerLabels: [], proofHash: null, sourceVersion: 'sources-v1', runRevision: 7 },
      ],
    } as any);

    expect((manifest as any).runeProof.map((value: any) => value.status))
      .toEqual(['IMPOSSIBLE', 'UNKNOWN']);
  });

  it('fails closed on malformed, cyclic, and privacy-unsafe proof payloads', async () => {
    const cyclic: any[] = [];
    cyclic.push(cyclic);
    const invalid = [
      { goalId: 'item:a', goalLabel: 'A', status: 'OBTAINABLE', explanation: 'ok', routeLabels: [], blockerLabels: [], unavoidableBlockerLabels: [], proofHash: 'bad', sourceVersion: 'sources-v1', runRevision: 7 },
      { goalId: 'item:b', goalLabel: 'B', status: 'UNKNOWN', explanation: 'unknown', routeLabels: cyclic, blockerLabels: [], unavoidableBlockerLabels: [], proofHash: null, sourceVersion: 'sources-v1', runRevision: 7 },
      { goalId: 'item:c', goalLabel: 'C', status: 'UNKNOWN', explanation: 'unknown', routeLabels: [], blockerLabels: [], unavoidableBlockerLabels: [], proofHash: null, sourceVersion: 'sources-v1', runRevision: 7, inventory: ['Coins'], futureAdvice: 'Roll a new chunk', notes: 'private' },
    ];

    for (const runeProof of invalid) {
      await expect(buildRuneliteRulesManifest({
        unlocks: initialState.unlocks,
        run: { runId: 'run-proof', runRevision: 7, gameModeId: 'vanilla' },
        contentService: contentSource,
        itemRuleSource: { init: async () => {}, ready: true, itemRuleExport: () => ({}) },
        runeProofSourceVersion: 'sources-v1', runeProof: [runeProof],
      } as any)).rejects.toThrow(/RuneProof bundle/i);
    }
  });

  it('fails closed when proof count or display text exceeds strict limits', async () => {
    const make = (index: number) => ({
      goalId: `item:${index}`, goalLabel: `Goal ${index}`, status: 'UNKNOWN',
      explanation: 'Coverage incomplete.', routeLabels: [], blockerLabels: [],
      unavoidableBlockerLabels: [], proofHash: null, sourceVersion: 'sources-v1', runRevision: 7,
    });
    const base = {
      unlocks: initialState.unlocks,
      run: { runId: 'run-proof', runRevision: 7, gameModeId: 'vanilla' },
      contentService: contentSource,
      itemRuleSource: { init: async () => {}, ready: true, itemRuleExport: () => ({}) },
      runeProofSourceVersion: 'sources-v1',
    };

    await expect(buildRuneliteRulesManifest({ ...base, runeProof: Array.from({ length: 21 }, (_, index) => make(index)) } as any))
      .rejects.toThrow(/RuneProof bundle/i);
    await expect(buildRuneliteRulesManifest({ ...base, runeProof: [{ ...make(1), explanation: 'x'.repeat(513) }] } as any))
      .rejects.toThrow(/RuneProof bundle/i);
  });
});
