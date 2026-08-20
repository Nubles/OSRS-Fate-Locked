import * as walkthroughCatalogue from '../../data/questWalkthroughs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chunkContentService,
  type ConnectGraph,
  type ItemSourceRecord,
} from '../../services/ChunkContentService';
import type {
  ExactEntityHit,
  RouteRecipe,
} from '../../data/questRouteRecipes';
import { routeRecipes, transformationCoverageFor } from '../../data/questRouteRecipes';
import { reviewedQuestRequirements } from '../../data/questItemRequirements';
import type { UnlockState } from '../../types';
import { questRouteStatusForItems } from './questRouteStatus';
import {
  analyzeQuest as analyzeQuestWithWalkthrough,
  combineQuestRouteStatus,
  clearQuestRouteAnalysisCache,
  type QuestRouteAnalysisSnapshot,
  type QuestRouteItemSourceCoverage,
  type QuestRouteStationRequirement,
} from './analyzeQuest';
import {
  canonicalItemKey,
  type ChunkKey,
  type ItemRef,
  type RawRouteRequirement,
} from './model';
import * as resolverModule from './resolver';
import {
  DEFAULT_RESOLVER_OPTIONS,
  MAX_EXACT_ROUTE_COMBINATIONS,
  MAX_ROUTE_SEARCH_WORK_UNITS,
  PILOT_ROUTE_SEARCH_WORK_UNIT_BUDGET,
} from './resolver';
import generatedChunkContent from '../../public/chunk-content.json';

const analyzeQuest = (
  questId: string,
  snapshot: QuestRouteAnalysisSnapshot,
) => {
  const walkthrough = walkthroughCatalogue.questWalkthroughFor(questId);
  if (!walkthrough) throw new Error(`RuneProof has no reviewed walkthrough for ${questId}.`);
  return analyzeQuestWithWalkthrough(questId, snapshot, walkthrough);
};

const unlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  chunks: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
  ...overrides,
});

const source = (
  itemName: string,
  overrides: Partial<ItemSourceRecord> = {},
): ItemSourceRecord => ({
  itemName,
  kind: 'spawn',
  hostName: `${itemName} source`,
  cx: 1,
  cy: 2,
  rawRequirements: [],
  ...overrides,
});

const daddySources = (): ItemSourceRecord[] => [
  source('Plank'),
  source('Bolt of cloth'),
  source('Bronze nails'),
];

const cookSources = (
  eggRequirements: readonly RawRouteRequirement[] = [],
): ItemSourceRecord[] => [
  source('Egg', { rawRequirements: [...eggRequirements] }),
  source('Bucket of milk'),
  source('Pot of flour'),
];

const item = (name: string): ItemRef => ({ key: canonicalItemKey(name), name });

const COMPLETE_REVIEWED_SOURCE_COVERAGE: QuestRouteItemSourceCoverage[] = [
  "Cook's Assistant",
  "Daddy's Home",
  "Doric's Quest",
  'Elemental Workshop I',
].flatMap(questId => reviewedQuestRequirements(questId)!.items)
  .flatMap(requirement => [requirement.item, ...(requirement.alternatives ?? [])])
  .filter((entry, index, entries) => entries.findIndex(item => item.key === entry.key) === index)
  .map(entry => ({
    itemKey: entry.key,
    direct: 'COMPLETE',
    transformation: 'COMPLETE',
  }));

const recipe = (
  outputName: string,
  overrides: Partial<RouteRecipe> = {},
): RouteRecipe => ({
  id: `${canonicalItemKey(outputName)}-recipe`,
  kind: 'RECIPE',
  output: item(outputName),
  outputQuantity: 1,
  ingredients: [],
  tools: [],
  stations: [{ entityKind: 'object', names: [`${outputName} station`] }],
  gates: [],
  deterministic: true,
  sourceRevision: 'test-revision',
  ...overrides,
});


const fixture = ({
  records = [],
  current = ['1,2'],
  account = unlocks(),
  chunkDataVersion = 17,
  recipes = [],
  entityHits = [],
  stationEvidence = [],
  sourceCoverage = COMPLETE_REVIEWED_SOURCE_COVERAGE,
  connectGraph = {},
}: {
  records?: readonly ItemSourceRecord[];
  current?: readonly ChunkKey[];
  account?: UnlockState;
  chunkDataVersion?: number;
  recipes?: readonly RouteRecipe[];
  entityHits?: readonly ExactEntityHit[];
  stationEvidence?: readonly QuestRouteStationRequirement[];
  sourceCoverage?: readonly QuestRouteItemSourceCoverage[];
  connectGraph?: ConnectGraph;
} = {}): QuestRouteAnalysisSnapshot => ({
  chunkDataVersion,
  unlockedChunks: [...current],
  unlocks: { ...account, chunks: [...(account.chunks ?? [])] },
  itemSourceRecords: records,
  recipes,
  entityLocations: entityHits,
  stationRequirements: stationEvidence,
  sourceCoverage,
  connectGraph,
});

const materializeGeneratedSnapshot = (
  questId: string,
  current: readonly ChunkKey[],
  account: UnlockState = unlocks(),
): QuestRouteAnalysisSnapshot => {
  const catalogue = reviewedQuestRequirements(questId);
  if (!catalogue) throw new Error(`Missing reviewed quest: ${questId}`);

  const pending = catalogue.items.flatMap(requirement => [
    requirement.item,
    ...(requirement.alternatives ?? []),
  ]);
  const visited = new Set<string>();
  const records = new Map<string, ItemSourceRecord>();
  const recipes = new Map<string, RouteRecipe>();

  while (pending.length > 0) {
    const next = pending.shift()!;
    if (visited.has(next.key)) continue;
    visited.add(next.key);
    chunkContentService.itemSourceRecords(next.name).forEach((record) => {
      const id = [record.itemName, record.kind, record.hostName, record.cx, record.cy].join('\0');
      records.set(id, {
        ...record,
        rawRequirements: record.rawRequirements.map(requirement => ({ ...requirement })),
      });
    });
    routeRecipes.filter(entry => entry.output.key === next.key).forEach((entry) => {
      if (recipes.has(entry.id)) return;
      recipes.set(entry.id, entry);
      entry.ingredients.forEach(ingredient => {
        pending.push(ingredient.item, ...(ingredient.alternatives ?? []));
      });
      entry.tools.forEach(tool => {
        pending.push(tool.item, ...(tool.alternatives ?? []));
      });
    });
  }

  const entityLocations: ExactEntityHit[] = [];
  const stationRequirements: QuestRouteStationRequirement[] = [];
  const seenEntities = new Set<string>();
  [...recipes.values()].forEach((entry) => entry.stations.forEach((station) => {
    station.names.forEach((name) => {
      const hit = chunkContentService.entityLocations(name, [station.entityKind]);
      if (!hit || hit.kind !== station.entityKind || hit.name.toLocaleLowerCase('en-GB') !== name.toLocaleLowerCase('en-GB')) return;
      const entityId = `${hit.kind}\0${hit.name.toLocaleLowerCase('en-GB')}`;
      if (!seenEntities.has(entityId)) {
        seenEntities.add(entityId);
        entityLocations.push({
          name: hit.name,
          kind: hit.kind,
          locations: hit.locations.map(location => ({ cx: location.cx, cy: location.cy })),
        });
      }
      hit.locations.forEach((location) => {
        stationRequirements.push({
          name: hit.name,
          kind: station.entityKind,
          chunk: `${location.cx},${location.cy}`,
          rawRequirements: [
            ...chunkContentService.taskRequirements(
              hit.name,
              hit.kind,
              location.cx,
              location.cy,
            ).map(raw => ({ raw, origin: 'ENTITY' as const })),
            ...chunkContentService.chunkEntryRequirements(
              location.cx,
              location.cy,
            ).map(raw => ({ raw, origin: 'CHUNK_ENTRY' as const })),
          ],
        });
      });
    });
  }));

  return {
    chunkDataVersion: generatedChunkContent.version,
    unlockedChunks: [...current],
    unlocks: {
      skills: { ...account.skills },
      levels: { ...account.levels },
      regions: [...account.regions],
      chunks: [...(account.chunks ?? [])],
      quests: [...account.quests],
      guilds: [...account.guilds],
      merchants: [...account.merchants],
      minigames: [...account.minigames],
      mobility: [...account.mobility],
      slayerUnlocks: [...account.slayerUnlocks],
    },
    itemSourceRecords: [...records.values()],
    recipes: [...recipes.values()].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    entityLocations,
    stationRequirements,
    sourceCoverage: [...visited].map(itemKey => ({
      itemKey,
      direct: chunkContentService.itemSourceCoverage(),
      transformation: transformationCoverageFor(itemKey),
    })),
    connectGraph: chunkContentService.connectGraph(),
  };
};

describe('analyzeQuest', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => generatedChunkContent,
    })));
    expect(await chunkContentService.init()).toBe(true);
    vi.unstubAllGlobals();
  });

  beforeEach(() => clearQuestRouteAnalysisCache());

  it('preserves every reviewed requirement in catalogue order', () => {
    const analysis = analyzeQuest("Daddy's Home", fixture({
      records: daddySources(),
    }));

    expect(analysis.items.map(item => item.requirement.item.name)).toEqual([
      'Plank',
      'Bolt of cloth',
      'Nails',
      'Hammer',
      'Saw',
      'Waxwood logs',
    ]);
  });

  it('keeps incomplete, obtainable, and blocked sibling analyses together', () => {
    const analysis = analyzeQuest("Daddy's Home", fixture({
      records: [
        source('Plank', {
          rawRequirements: [{ raw: 'Access the sealed workshop', origin: 'ENTITY' }],
        }),
        source('Bolt of cloth'),
        source('Bronze nails', {
          rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
        }),
      ],
    }));

    expect(analysis.items.slice(0, 3).map(item => item.state)).toEqual([
      'DATA_INCOMPLETE',
      'OBTAINABLE_NOW',
      'ROUTE_BLOCKED',
    ]);
    expect(questRouteStatusForItems(analysis.items)).toBe('CANNOT_COMPLETE_YET');
  });

  it('keeps quest-provided items visible without letting them block readiness', () => {
    const analysis = analyzeQuest("Daddy's Home", fixture({
      records: daddySources(),
    }));

    expect(questRouteStatusForItems(analysis.items)).toBe('READY_NOW');
    expect(analysis.items.filter(item => item.requirement.supplyPolicy === 'QUEST_PROVIDED'))
      .toEqual([
        expect.objectContaining({ state: 'OBTAINABLE_NOW', currentRoutes: [] }),
        expect.objectContaining({ state: 'OBTAINABLE_NOW', currentRoutes: [] }),
        expect.objectContaining({ state: 'OBTAINABLE_NOW', currentRoutes: [] }),
      ]);
  });

  it.each([
    ['ROUTE_BLOCKED', [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }] as RawRouteRequirement[]],
    ['NO_CURRENT_SOURCE', [] as RawRouteRequirement[]],
  ])('reports cannot complete yet for a %s player-obtained item', (state, rawRequirements) => {
    const records = cookSources(rawRequirements);
    const analysis = analyzeQuest("Cook's Assistant", fixture({
      records,
      current: state === 'NO_CURRENT_SOURCE' ? ['8,9'] : ['1,2'],
    }));

    expect(analysis.items[0].state).toBe(state);
    expect(questRouteStatusForItems(analysis.items)).toBe('CANNOT_COMPLETE_YET');
  });

  it('reports analysis incomplete only when incomplete evidence remains without a known blocker', () => {
    const analysis = analyzeQuest("Cook's Assistant", fixture({
      records: cookSources([
        { raw: 'Access the sealed workshop', origin: 'ENTITY' },
      ]),
    }));

    expect(analysis.items.map(item => item.state)).toEqual([
      'DATA_INCOMPLETE',
      'OBTAINABLE_NOW',
      'OBTAINABLE_NOW',
    ]);
    expect(questRouteStatusForItems(analysis.items)).toBe('ANALYSIS_INCOMPLETE');
  });

  it('ranks each route list and attaches minimal missing-chunk advice', () => {
    const analysis = analyzeQuest("Cook's Assistant", fixture({
      records: [
        source('Egg', {
          kind: 'shop',
          hostName: 'Blocked egg shop',
          rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
        }),
        source('Egg', { hostName: 'Usable egg spawn' }),
        source('Bucket of milk', { cx: 4, cy: 5 }),
        source('Pot of flour'),
      ],
    }));

    expect(analysis.items[0].currentRoutes.map(route => route.sourceLabel)).toEqual([
      'Usable egg spawn',
      'Blocked egg shop',
    ]);
    expect(analysis.items[1].missingChunkOptions).toEqual([{
      chunks: ['4,5'],
      routeIds: ['spawn:Bucket of milk source:4,5:bucket of milk'],
      remainingGates: [],
    }]);
    expect(analysis.items[1].state).toBe('NO_CURRENT_SOURCE');
  });

  it("prefers Cook's Assistant's deterministic local wheat route over a Black Knight drop", () => {
    const analysis = analyzeQuest("Cook's Assistant", fixture({
      current: ['50,50', '50,51', '49,51'],
      records: [
        source('Pot', { hostName: 'Pot', cx: 50, cy: 50 }),
        source('Pot of flour', { kind: 'monster', hostName: 'Black Knight', cx: 50, cy: 50 }),
      ],
      recipes: routeRecipes.filter(({ id }) => ['pick-wheat', 'grain-to-flour'].includes(id)),
      entityHits: [
        { name: 'Wheat', kind: 'object', locations: [{ cx: 49, cy: 51 }] },
        { name: 'Hopper', kind: 'object', locations: [{ cx: 49, cy: 51 }] },
      ],
    }));
    const flour = analysis.items.find(item => item.requirement.item.key === 'pot of flour');

    expect(flour?.currentRoutes[0].sourceLabel).toBe('grain-to-flour');
    expect(flour?.currentRoutes[0].deterministic).toBe(true);
    expect(flour?.currentRoutes[0].steps.map(step => step.label)).toEqual(
      expect.arrayContaining(['Use Hopper', 'Use Wheat', 'Pot']),
    );
    expect(flour?.currentRoutes[0].steps.map(step => step.label)).not.toContain('Black Knight');
  });

  it('includes chunk-data and reviewed-quest revisions in generated metadata', () => {
    const analysis = analyzeQuest("Cook's Assistant", fixture({
      records: cookSources(),
      chunkDataVersion: 91,
    }));

    expect(analysis.generatedFrom).toEqual({
      chunkDataVersion: 91,
      questRevision: '15240921',
      walkthroughRevision: walkthroughCatalogue.questWalkthroughFor("Cook's Assistant")!.revision,
      accountFingerprint: expect.any(String),
    });
  });

  it('does not reuse cached route evidence after the chunk-data version changes', () => {
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records: [],
      chunkDataVersion: 17,
    })).items)).toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records: cookSources(),
      chunkDataVersion: 18,
    })).items)).toBe('READY_NOW');
  });

  it('does not reuse cached analysis after item source evidence changes at the same version', () => {
    const withoutEgg = [source('Bucket of milk'), source('Pot of flour')];
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({ records: withoutEgg })).items))
      .toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({ records: cookSources() })).items))
      .toBe('READY_NOW');
  });

  it('keeps omitted Egg source and transformation evidence locally incomplete', () => {
    const analysis = analyzeQuest("Cook's Assistant", fixture({
      records: [source('Bucket of milk'), source('Pot of flour')],
      sourceCoverage: COMPLETE_REVIEWED_SOURCE_COVERAGE.map(coverage => (
        coverage.itemKey === 'egg'
          ? { ...coverage, transformation: 'PARTIAL' as const }
          : coverage
      )),
    }));

    expect(analysis.items.map(item => item.state)).toEqual([
      'DATA_INCOMPLETE',
      'OBTAINABLE_NOW',
      'OBTAINABLE_NOW',
    ]);
    expect(questRouteStatusForItems(analysis.items)).toBe('ANALYSIS_INCOMPLETE');
  });

  it('does not reuse cached absence when source-family coverage changes at the same version', () => {
    const records = [source('Bucket of milk'), source('Pot of flour')];
    const partialCoverage = COMPLETE_REVIEWED_SOURCE_COVERAGE.map(coverage => (
      coverage.itemKey === 'egg'
        ? { ...coverage, transformation: 'PARTIAL' as const }
        : coverage
    ));
    const incomplete = analyzeQuest("Cook's Assistant", fixture({ records, sourceCoverage: partialCoverage }));
    const complete = analyzeQuest("Cook's Assistant", fixture({
      records,
      sourceCoverage: COMPLETE_REVIEWED_SOURCE_COVERAGE,
    }));

    expect(incomplete.items[0].state).toBe('DATA_INCOMPLETE');
    expect(complete.items[0].state).toBe('NO_CURRENT_SOURCE');
    expect(complete).not.toBe(incomplete);
  });

  it('does not reuse cached analysis after reviewed recipe evidence changes', () => {
    const records = [source('Bucket of milk'), source('Pot of flour')];
    const entityHits: ExactEntityHit[] = [{
      name: 'Egg station',
      kind: 'object',
      locations: [{ cx: 1, cy: 2 }],
    }];
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({ records, entityHits })).items))
      .toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      recipes: [recipe('Egg')],
      entityHits,
    })).items)).toBe('READY_NOW');
  });

  it('keeps malformed indexed station coordinates as incomplete evidence', () => {
    const analysis = analyzeQuest("Cook's Assistant", fixture({
      records: [source('Bucket of milk'), source('Pot of flour')],
      recipes: [recipe('Egg')],
      entityHits: [{
        name: 'Egg station',
        kind: 'object',
        locations: [{ cx: Number.NaN, cy: 2 }],
      }],
    }));

    expect(analysis.items[0].state).toBe('DATA_INCOMPLETE');
    expect(analysis.items[0].currentRoutes).toContainEqual(expect.objectContaining({
      sourceLabel: 'egg-recipe',
      hasDataGap: true,
    }));
    expect(analysis.items[0].dataNotes).toContainEqual(
      expect.stringMatching(/no exact object location/i),
    );
  });
  it('does not reuse cached analysis after exact station locations change', () => {
    const records = [source('Bucket of milk'), source('Pot of flour')];
    const recipes = [recipe('Egg')];
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      recipes,
      entityHits: [{
        name: 'Egg station',
        kind: 'object',
        locations: [{ cx: 4, cy: 5 }],
      }],
    })).items)).toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      recipes,
      entityHits: [{
        name: 'Egg station',
        kind: 'object',
        locations: [{ cx: 1, cy: 2 }],
      }],
    })).items)).toBe('READY_NOW');
  });

  it('does not reuse cached analysis after station requirements change', () => {
    const records = [source('Bucket of milk'), source('Pot of flour')];
    const recipes = [recipe('Egg')];
    const entityHits: ExactEntityHit[] = [{
      name: 'Egg station',
      kind: 'object',
      locations: [{ cx: 1, cy: 2 }],
    }];
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      recipes,
      entityHits,
      stationEvidence: [{
        name: 'Egg station',
        kind: 'object',
        chunk: '1,2',
        rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
      }],
    })).items)).toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      recipes,
      entityHits,
      stationEvidence: [],
    })).items)).toBe('READY_NOW');
  });

  it('does not reuse cached route ranking after connectivity changes', () => {
    const records = [
      source('Grain', { cx: 2, cy: 2 }),
      source('Bucket of milk'),
      source('Pot of flour'),
    ];
    const recipes = [recipe('Egg', {
      ingredients: [{ item: item('Grain'), quantity: 1 }],
    })];
    const entityHits: ExactEntityHit[] = [{
      name: 'Egg station',
      kind: 'object',
      locations: [{ cx: 1, cy: 2 }],
    }];
    const disconnected = analyzeQuest("Cook's Assistant", fixture({
      records,
      recipes,
      entityHits,
      current: ['1,2', '2,2'],
      connectGraph: {},
    }));
    expect(disconnected.items[0].currentRoutes[0].travelCostEstimated).toBe(true);

    const connected = analyzeQuest("Cook's Assistant", fixture({
      records,
      recipes,
      entityHits,
      current: ['1,2', '2,2'],
      connectGraph: { '258': ['514'] },
    }));

    expect(connected.items[0].currentRoutes[0].travelCostEstimated).toBe(false);
  });

  it('prevents consumer mutation from poisoning a cached analysis', () => {
    const snapshot = fixture({ records: cookSources() });
    const first = analyzeQuest("Cook's Assistant", snapshot);
    const mutable = first as unknown as {
      items: Array<{ currentRoutes: Array<{ sourceLabel: string }> }>;
    };
    try {
      mutable.items[0].currentRoutes[0].sourceLabel = 'Poisoned source';
    } catch {
      // A deeply frozen result may reject the attempted write.
    }
    try {
      mutable.items.splice(1, 1);
    } catch {
      // A deeply frozen result may reject the attempted write.
    }

    const cached = analyzeQuest("Cook's Assistant", snapshot);

    expect(cached.items.map(entry => entry.requirement.item.name)).toEqual([
      'Egg',
      'Bucket of milk',
      'Pot of flour',
    ]);
    expect(cached.items[0].currentRoutes[0].sourceLabel).toBe('Egg source');
  });

  it('does not reuse a cached analysis after unlocked chunks change', () => {
    const records = cookSources();
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      current: ['8,9'],
    })).items)).toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      current: ['1,2'],
    })).items)).toBe('READY_NOW');
  });

  it('does not reuse a cached analysis after skill levels change', () => {
    const records = cookSources([{ raw: 'Mining level 50', origin: 'ENTITY' }]);
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      account: unlocks({ skills: { Mining: 5 }, levels: { Mining: 49 } }),
    })).items)).toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      account: unlocks({ skills: { Mining: 5 }, levels: { Mining: 50 } }),
    })).items)).toBe('READY_NOW');
  });

  it('does not reuse a cached analysis after skill tiers change', () => {
    const records = cookSources([{ raw: 'Mining level 30', origin: 'ENTITY' }]);
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      account: unlocks({ skills: { Mining: 2 }, levels: { Mining: 30 } }),
    })).items)).toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      account: unlocks({ skills: { Mining: 3 }, levels: { Mining: 30 } }),
    })).items)).toBe('READY_NOW');
  });

  it('does not reuse a cached analysis after completed quests change', () => {
    const records = cookSources([
      { raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' },
    ]);
    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({ records })).items))
      .toBe('CANNOT_COMPLETE_YET');

    expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
      records,
      account: unlocks({ quests: ['Priest in Peril'] }),
    })).items)).toBe('READY_NOW');
  });

  it.each([
    ['guilds', "Access the Cooks' Guild", "Cooks' Guild"],
    ['merchants', 'Use the Sawmill Operators', 'Sawmill Operators'],
    ['minigames', 'Play Mahogany Homes', 'Mahogany Homes'],
    ['mobility', 'Use Fairy Rings', 'Fairy Rings'],
    ['slayerUnlocks', 'Bigger and Badder', 'Bigger and Badder'],
  ] as const)(
    'does not reuse a cached analysis after %s unlocks change',
    (category, raw, unlockedId) => {
      const records = cookSources([{ raw, origin: 'ENTITY' }]);
      expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({ records })).items))
        .toBe('CANNOT_COMPLETE_YET');

      expect(questRouteStatusForItems(analyzeQuest("Cook's Assistant", fixture({
        records,
        account: unlocks({ [category]: [unlockedId] }),
      })).items)).toBe('READY_NOW');
    },
  );

  it('normalizes account-state ordering for deterministic fingerprints and cache keys', () => {
    const records = cookSources();
    const first = analyzeQuest("Cook's Assistant", fixture({
      records,
      current: ['2,3', '1,2'],
      account: unlocks({
        levels: { Woodcutting: 40, Mining: 50 },
        quests: ['Rune Mysteries', 'Priest in Peril'],
        mobility: ['Spirit Trees', 'Fairy Rings'],
      }),
    }));
    const reordered = analyzeQuest("Cook's Assistant", fixture({
      records,
      current: ['1,2', '2,3'],
      account: unlocks({
        levels: { Mining: 50, Woodcutting: 40 },
        quests: ['Priest in Peril', 'Rune Mysteries'],
        mobility: ['Fairy Rings', 'Spirit Trees'],
      }),
    }));

    expect(reordered.generatedFrom.accountFingerprint)
      .toBe(first.generatedFrom.accountFingerprint);
    expect(reordered).toBe(first);
  });

  it('clearQuestRouteAnalysisCache invalidates cached results', () => {
    const snapshot = fixture({ records: cookSources() });
    const first = analyzeQuest("Cook's Assistant", snapshot);
    expect(analyzeQuest("Cook's Assistant", snapshot)).toBe(first);

    clearQuestRouteAnalysisCache();

    expect(analyzeQuest("Cook's Assistant", snapshot)).not.toBe(first);
  });

  it('evicts old analyses after the cache receives many distinct entries', () => {
    const records = cookSources();
    const first = analyzeQuest("Cook's Assistant", fixture({
      records,
      chunkDataVersion: 0,
    }));
    for (let version = 1; version < 40; version += 1) {
      analyzeQuest("Cook's Assistant", fixture({ records, chunkDataVersion: version }));
    }

    const revisited = analyzeQuest("Cook's Assistant", fixture({
      records,
      chunkDataVersion: 0,
    }));

    expect(revisited).not.toBe(first);
  });

  it("uses generated plank evidence for direct and exact-sawmill routes in Daddy's Home", () => {
    const analysis = analyzeQuest("Daddy's Home", materializeGeneratedSnapshot(
      "Daddy's Home",
      ['21,52', '27,48', '35,45', '39,55'],
      unlocks({ quests: ['Children of the Sun'] }),
    ));
    const plank = analysis.items.find(entry => entry.requirement.item.key === 'plank')!;

    expect(plank.currentRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKind: 'SPAWN',
        sourceLabel: 'Plank',
        chunks: ['35,45'],
      }),
      expect.objectContaining({
        sourceKind: 'SPAWN',
        sourceLabel: 'Plank',
        chunks: ['39,55'],
      }),
      expect.objectContaining({
        sourceKind: 'RECIPE',
        sourceLabel: 'logs-to-plank',
        blockers: [],
      }),
    ]));
    const sawmillRoute = plank.currentRoutes.find(route => route.sourceLabel === 'logs-to-plank')!;
    expect(sawmillRoute.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Use Sawmill', chunk: '21,52' }),
      expect.objectContaining({ label: 'Obtain Logs', quantity: 10, consumed: true }),
      expect.objectContaining({ label: 'Obtain Coins', quantity: 1000, consumed: true }),
    ]));
  });

  it('does not recommend Bob when Axe Shops is locked', () => {
    const analysis = analyzeQuest("Doric's Quest", materializeGeneratedSnapshot(
      "Doric's Quest",
      ['50,50', '53,49'],
      unlocks({ skills: { Mining: 2 }, levels: { Mining: 15 } }),
    ));
    const copper = analysis.items.find(entry => entry.requirement.item.key === 'copper ore')!;

    expect(copper.state).toBe('OBTAINABLE_NOW');
    expect(copper.currentRoutes[0].steps).not.toContainEqual(
      expect.objectContaining({ label: "Bob's Brilliant Axes" }),
    );
  });

  it('keeps the generated plank shop route visible with its exact missing access quest', () => {
    const analysis = analyzeQuest("Daddy's Home", materializeGeneratedSnapshot(
      "Daddy's Home",
      ['54,51'],
    ));
    const plank = analysis.items.find(entry => entry.requirement.item.key === 'plank')!;
    const shop = plank.currentRoutes.find(route => (
      route.sourceLabel === 'Razmire Builders Merchants'
    ));

    expect(shop).toMatchObject({
      sourceKind: 'SHOP',
      chunks: ['54,51'],
      blockers: [
        { type: 'UNLOCK', category: 'merchants', id: 'Real Estate Agents', label: 'Real Estate Agents' },
        { type: 'QUEST', questId: 'Priest in Peril', label: 'Priest in Peril' },
      ],
      hasDataGap: false,
    });
  });

  it("keeps Cook's Assistant items independent when one generated route has incomplete evidence", () => {
    const analysis = analyzeQuest("Cook's Assistant", materializeGeneratedSnapshot(
      "Cook's Assistant",
      ['19,49', '41,57', '43,48'],
      unlocks({ quests: ['Children of the Sun'] }),
    ));

    expect(analysis.items.map(entry => [entry.requirement.item.name, entry.state])).toEqual([
      ['Egg', 'OBTAINABLE_NOW'],
      ['Bucket of milk', 'OBTAINABLE_NOW'],
      ['Pot of flour', 'DATA_INCOMPLETE'],
    ]);
    expect(analysis.items[2].currentRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceLabel: 'Tribesman',
        hasDataGap: true,
        blockers: [expect.objectContaining({
          type: 'UNRESOLVED',
          raw: 'Chop any type of jungle',
        })],
      }),
    ]));
  });

  it("does not treat the generated Soft clay spawn as Clay for Doric's Quest", () => {
    const generated = materializeGeneratedSnapshot("Doric's Quest", ['27,48']);
    const softClay = chunkContentService.itemSourceRecords('Soft clay')
      .filter(record => record.cx === 27 && record.cy === 48);
    expect(softClay).toHaveLength(1);
    const analysis = analyzeQuest("Doric's Quest", {
      ...generated,
      itemSourceRecords: [
        ...generated.itemSourceRecords.filter(record => record.itemName !== 'Clay'),
        ...softClay,
      ],
    });
    const clay = analysis.items.find(entry => entry.requirement.item.key === 'clay')!;

    expect(clay.state).not.toBe('OBTAINABLE_NOW');
    expect(clay.currentRoutes).toEqual([]);
    expect([...clay.currentRoutes, ...clay.missingChunkRoutes]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceLabel: 'Soft clay' })]),
    );
  });

  it('does not block Elemental Workshop I on items supplied during the quest', () => {
    const analysis = analyzeQuest('Elemental Workshop I', materializeGeneratedSnapshot(
      'Elemental Workshop I',
      ['18,55', '19,57'],
    ));
    const questProvided = analysis.items.filter(
      entry => entry.requirement.supplyPolicy === 'QUEST_PROVIDED',
    );

    expect(questRouteStatusForItems(analysis.items)).toBe('READY_NOW');
    expect(analysis.items
      .filter(entry => entry.requirement.supplyPolicy === 'PLAYER_OBTAINED')
      .map(entry => entry.state))
      .toEqual([
        'OBTAINABLE_NOW',
        'OBTAINABLE_NOW',
        'OBTAINABLE_NOW',
        'OBTAINABLE_NOW',
      ]);
    expect(questProvided.map(entry => [
      entry.requirement.item.name,
      entry.state,
      entry.currentRoutes.length,
    ])).toEqual([
      ['Knife', 'OBTAINABLE_NOW', 0],
      ['Needle', 'OBTAINABLE_NOW', 0],
      ['Leather', 'OBTAINABLE_NOW', 0],
    ]);
  });

  it('returns pilot analyses from cache by identity without resolving them again', () => {
    const pilotQuestIds = [
      "Cook's Assistant",
      "Daddy's Home",
      "Doric's Quest",
      'Elemental Workshop I',
    ];
    const current = [
      '18,55', '19,49', '19,57', '21,52', '27,48', '35,45', '41,57', '43,48',
    ] as ChunkKey[];
    const account = unlocks({
      levels: { Mining: 99 },
      quests: ['Children of the Sun', 'Priest in Peril'],
    });
    const snapshots = pilotQuestIds.map(questId => (
      materializeGeneratedSnapshot(questId, current, account)
    ));

    clearQuestRouteAnalysisCache();
    const resolverSpy = vi.spyOn(resolverModule, 'resolveItemRequirement');
    const first = pilotQuestIds.map((questId, index) => (
      analyzeQuest(questId, snapshots[index])
    ));
    const firstResolutionCount = first.reduce(
      (count, analysis) => count + analysis.items.length,
      0,
    );
    expect(resolverSpy).toHaveBeenCalledTimes(firstResolutionCount);

    const cached = pilotQuestIds.map((questId, index) => (
      analyzeQuest(questId, snapshots[index])
    ));

    cached.forEach((analysis, index) => {
      expect(analysis).toBe(first[index]);
    });
    expect(resolverSpy).toHaveBeenCalledTimes(firstResolutionCount);
    const exactCombinationCount = first
      .flatMap(analysis => analysis.items)
      .reduce((count, entry) => count + (entry.exactRouteCombinationsEvaluated ?? 0), 0);
    expect(exactCombinationCount).toBeLessThan(2_000);
    const searchWorkUnits = first
      .flatMap(analysis => analysis.items)
      .reduce((count, entry) => count + (entry.routeSearchWorkUnitsEvaluated ?? 0), 0);
    expect(searchWorkUnits).toBeLessThan(PILOT_ROUTE_SEARCH_WORK_UNIT_BUDGET);
    first.flatMap(analysis => analysis.items).forEach((entry) => {
      expect(entry.exactRouteCombinationsEvaluated)
        .toBeLessThanOrEqual(MAX_EXACT_ROUTE_COMBINATIONS);
      expect(entry.routeSearchWorkUnitsEvaluated)
        .toBeLessThanOrEqual(MAX_ROUTE_SEARCH_WORK_UNITS);
      expect(entry.dataNotes).not.toContainEqual(
        expect.stringMatching(/bounded exact route search stopped/i),
      );
      expect(entry.currentRoutes.length + entry.missingChunkRoutes.length)
        .toBeLessThanOrEqual(DEFAULT_RESOLVER_OPTIONS.maxRoutesPerItem);
      [...entry.currentRoutes, ...entry.missingChunkRoutes].forEach((route) => {
        expect(route.recursiveCost).toBeLessThanOrEqual(DEFAULT_RESOLVER_OPTIONS.maxDepth);
      });
    });
  });

  it('rejects quests outside the reviewed catalogue', () => {
    expect(() => analyzeQuest('Dragon Slayer I', fixture()))
      .toThrow('Dragon Slayer I');
  });

describe('quest walkthrough attachment', () => {
  const walkthroughReadySnapshot = (): QuestRouteAnalysisSnapshot => fixture({
    records: cookSources(),
    current: ['1,2', '50,50'],
    entityHits: [{
      name: 'Cook (Lumbridge)',
      kind: 'npc',
      locations: [{ cx: 50, cy: 50 }],
    }],
  });

  it.each([
    ['READY_NOW', 'READY', 'READY_NOW'],
    ['READY_NOW', 'INCOMPLETE', 'ANALYSIS_INCOMPLETE'],
    ['READY_NOW', 'BLOCKED', 'CANNOT_COMPLETE_YET'],
    ['ANALYSIS_INCOMPLETE', 'READY', 'ANALYSIS_INCOMPLETE'],
    ['ANALYSIS_INCOMPLETE', 'BLOCKED', 'CANNOT_COMPLETE_YET'],
    ['CANNOT_COMPLETE_YET', 'INCOMPLETE', 'CANNOT_COMPLETE_YET'],
  ] as const)('combines %s item and %s walkthrough status as %s', (
    itemStatus,
    walkthroughStatus,
    expected,
  ) => {
    expect(combineQuestRouteStatus(itemStatus, walkthroughStatus)).toBe(expected);
  });

  it('attaches a deeply immutable evaluated walkthrough and its revision', () => {
    const definition = walkthroughCatalogue.questWalkthroughFor("Cook's Assistant")!;
    const analysis = analyzeQuest("Cook's Assistant", walkthroughReadySnapshot());

    expect(analysis.walkthrough).toMatchObject({
      questId: "Cook's Assistant",
      status: 'BLOCKED',
      source: definition.source,
    });
    expect(analysis.walkthrough.actions).toHaveLength(definition.actions.length);
    expect(questRouteStatusForItems(analysis.items)).toBe('READY_NOW');
    expect(analysis.status).toBe('CANNOT_COMPLETE_YET');
    expect(analysis.generatedFrom.walkthroughRevision).toBe(definition.revision);
    expect(Object.isFrozen(analysis.walkthrough)).toBe(true);
    expect(Object.isFrozen(analysis.walkthrough.actions)).toBe(true);
    expect(Object.isFrozen(analysis.walkthrough.actions[0].definition)).toBe(true);
  });

  it('does not reuse cached analysis after the walkthrough revision changes', () => {
    const definition = walkthroughCatalogue.questWalkthroughFor("Cook's Assistant")!;
    const catalogueSpy = vi.spyOn(walkthroughCatalogue, 'questWalkthroughFor');
    const snapshot = walkthroughReadySnapshot();
    catalogueSpy.mockReturnValueOnce(definition);
    const first = analyzeQuest("Cook's Assistant", snapshot);
    catalogueSpy.mockReturnValueOnce({
      ...definition,
      revision: 'changed-walkthrough-revision',
    });
    const changed = analyzeQuest("Cook's Assistant", snapshot);
    catalogueSpy.mockRestore();

    expect(changed).not.toBe(first);
    expect(changed.generatedFrom.walkthroughRevision).toBe('changed-walkthrough-revision');
  });
});
});
