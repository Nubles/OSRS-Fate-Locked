import { describe, expect, it, vi } from 'vitest';
import type {
  ExactEntityLocationLookup,
  RouteRecipe,
} from '../../data/questRouteRecipes';
import type { ItemSourceRecord } from '../../services/ChunkContentService';
import type { UnlockState } from '../../types';
import { resolveItemRequirement, type DirectRouteResolutionSnapshot } from './resolver';
import {
  canonicalItemKey,
  type ChunkKey,
  type QuestItemRequirement,
  type RawRouteRequirement,
} from './model';

const retainedRankingAudit = vi.hoisted(() => ({
  afterBoundary: false,
  routeEvaluations: 0,
  combinationScores: 0,
  postBoundaryEvents: [] as string[],
}));

vi.mock('./ranker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ranker')>();
  return {
    ...actual,
    compareRouteRankTuples: (
      ...args: Parameters<typeof actual.compareRouteRankTuples>
    ) => {
      if (retainedRankingAudit.afterBoundary) {
        retainedRankingAudit.postBoundaryEvents.push('compare');
      }
      return actual.compareRouteRankTuples(...args);
    },
    routeRankTuple: (...args: Parameters<typeof actual.routeRankTuple>) => {
      if (retainedRankingAudit.afterBoundary) {
        retainedRankingAudit.postBoundaryEvents.push('route-tuple');
      }
      return actual.routeRankTuple(...args);
    },
    prepareRouteRanker: (...args: Parameters<typeof actual.prepareRouteRanker>) => {
      const prepared = actual.prepareRouteRanker(...args);
      return {
        ...prepared,
        evaluate: (...evaluateArgs: Parameters<typeof prepared.evaluate>) => {
          if (retainedRankingAudit.afterBoundary) {
            retainedRankingAudit.postBoundaryEvents.push('route-evaluate');
          }
          retainedRankingAudit.routeEvaluations += 1;
          return prepared.evaluate(...evaluateArgs);
        },
        travelCostForChunks: (
          ...travelArgs: Parameters<typeof prepared.travelCostForChunks>
        ) => {
          if (retainedRankingAudit.afterBoundary) {
            retainedRankingAudit.postBoundaryEvents.push('combination-score');
          }
          retainedRankingAudit.combinationScores += 1;
          return prepared.travelCostForChunks(...travelArgs);
        },
      };
    },
  };
});

const resetRetainedRankingAudit = () => {
  retainedRankingAudit.afterBoundary = false;
  retainedRankingAudit.routeEvaluations = 0;
  retainedRankingAudit.combinationScores = 0;
  retainedRankingAudit.postBoundaryEvents.length = 0;
};
const plankRequirement: QuestItemRequirement = {
  item: { key: 'plank', name: 'Plank' },
  quantity: 10,
  supplyPolicy: 'PLAYER_OBTAINED',
};

const unlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [], housing: [],
  merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  ...overrides,
});

const source = (overrides: Partial<ItemSourceRecord> = {}): ItemSourceRecord => ({
  itemName: 'Plank',
  kind: 'spawn',
  hostName: 'Plank spawn',
  cx: 1,
  cy: 2,
  rawRequirements: [],
  ...overrides,
});

const fixture = ({
  records = [],
  current = ['1,2'],
  account = unlocks(),
  coverage = { direct: 'COMPLETE', transformation: 'COMPLETE' },
}: {
  records?: readonly ItemSourceRecord[];
  current?: readonly ChunkKey[];
  account?: UnlockState;
  coverage?: { direct: 'COMPLETE' | 'PARTIAL'; transformation: 'COMPLETE' | 'PARTIAL' };
} = {}): DirectRouteResolutionSnapshot => {
  const unlockedChunks = new Set<ChunkKey>(current);
  const recordsByItemName = new Map<string, {
    current: ItemSourceRecord[];
    advisory: ItemSourceRecord[];
  }>();
  for (const record of records) {
    const indexed = recordsByItemName.get(record.itemName) ?? { current: [], advisory: [] };
    const chunk = `${record.cx},${record.cy}` as ChunkKey;
    indexed[unlockedChunks.has(chunk) ? 'current' : 'advisory'].push(record);
    recordsByItemName.set(record.itemName, indexed);
  }

  return {
    unlockedChunks,
    recordsForClass: (itemName, searchClass) => (
      recordsByItemName.get(itemName)?.[searchClass] ?? []
    ),
    hasKnownOutsideSources: itemName => (
      (recordsByItemName.get(itemName)?.advisory.length ?? 0) > 0
    ),
    sourceCoverage: () => coverage,
    unlocks: account,
  };
};
describe('resolveItemRequirement direct routes', () => {
  it('marks an unlocked floor spawn obtainable now', () => {
    const analysis = resolveItemRequirement(plankRequirement, fixture({
      records: [source()],
    }));

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes).toEqual([
      expect.objectContaining({
        sourceKind: 'SPAWN',
        sourceLabel: 'Plank spawn',
        chunks: ['1,2'],
        blockers: [],
        hasDataGap: false,
      }),
    ]);
  });

  it('keeps a current-chunk shop visible when its quest access is missing', () => {
    const analysis = resolveItemRequirement(plankRequirement, fixture({
      records: [source({
        kind: 'shop',
        hostName: 'Timber merchant',
        rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
      })],
    }));

    expect(analysis.state).toBe('ROUTE_BLOCKED');
    expect(analysis.currentRoutes[0].blockers).toContainEqual(
      expect.objectContaining({ type: 'QUEST', questId: 'Priest in Peril' }),
    );
  });

  it('preserves usable and blocked current routes together for later ranking', () => {
    const analysis = resolveItemRequirement(plankRequirement, fixture({
      records: [
        source({
          kind: 'shop',
          hostName: 'Timber merchant',
          rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
        }),
        source({ hostName: 'Plank spawn' }),
      ],
    }));

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes).toHaveLength(2);
    expect(analysis.currentRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceLabel: 'Timber merchant', blockers: [expect.objectContaining({ type: 'QUEST' })] }),
      expect.objectContaining({ sourceLabel: 'Plank spawn', blockers: [] }),
    ]));
  });

  it('keeps outside-chunk sources advisory instead of making the item obtainable', () => {
    const analysis = resolveItemRequirement(plankRequirement, fixture({
      records: [source({ cx: 8, cy: 9 })],
      current: ['1,2'],
    }));

    expect(analysis.state).toBe('NO_CURRENT_SOURCE');
    expect(analysis.currentRoutes).toEqual([]);
    expect(analysis.missingChunkRoutes).toEqual([
      expect.objectContaining({ sourceLabel: 'Plank spawn', chunks: ['8,9'] }),
    ]);
  });

  it('keeps an absent transformation family incomplete instead of proving no current source', () => {
    const analysis = resolveItemRequirement(plankRequirement, fixture({
      records: [source({ cx: 8, cy: 9 })],
      current: ['1,2'],
      coverage: { direct: 'COMPLETE', transformation: 'PARTIAL' },
    }));

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.missingChunkRoutes).toEqual([
      expect.objectContaining({ sourceLabel: 'Plank spawn', chunks: ['8,9'] }),
    ]);
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/transformation coverage/i));
  });

  it('treats a quest-provided requirement as nonblocking without inventing a route', () => {
    const requirement: QuestItemRequirement = {
      item: { key: 'hammer', name: 'Hammer' },
      quantity: 1,
      supplyPolicy: 'QUEST_PROVIDED',
    };

    const analysis = resolveItemRequirement(requirement, fixture());

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes).toEqual([]);
    expect(analysis.missingChunkRoutes).toEqual([]);
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/provided during the quest/i));
  });

  it('uses incomplete state when an unresolved gate is the only current evidence', () => {
    const analysis = resolveItemRequirement(plankRequirement, fixture({
      records: [source({
        rawRequirements: [{ raw: 'Access the sealed workshop', origin: 'ENTITY' }],
      })],
    }));

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.currentRoutes[0]).toEqual(expect.objectContaining({
      blockers: [expect.objectContaining({ type: 'UNRESOLVED', raw: 'Access the sealed workshop' })],
      hasDataGap: true,
    }));
  });

  it('does not let an unresolved gate hide a complete usable or blocked route', () => {
    const unresolved = source({
      hostName: 'Sealed workshop',
      rawRequirements: [{ raw: 'Access the sealed workshop', origin: 'ENTITY' }],
    });
    const usable = resolveItemRequirement(plankRequirement, fixture({
      records: [unresolved, source({ hostName: 'Plank spawn' })],
    }));
    const blocked = resolveItemRequirement(plankRequirement, fixture({
      records: [unresolved, source({
        kind: 'shop',
        hostName: 'Timber merchant',
        rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
      })],
    }));

    expect(usable.state).toBe('OBTAINABLE_NOW');
    expect(usable.currentRoutes).toHaveLength(2);
    expect(blocked.state).toBe('ROUTE_BLOCKED');
    expect(blocked.currentRoutes).toHaveLength(2);
  });

  it('preserves a complete blocked witness ahead of an incomplete route at the cap', () => {
    const analysis = resolveItemRequirement(plankRequirement, fixture({
      records: [
        source({
          hostName: 'A sealed workshop',
          rawRequirements: [{ raw: 'Access the sealed workshop', origin: 'ENTITY' }],
        }),
        source({
          hostName: 'Z timber merchant',
          rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
        }),
      ],
    }), { maxRoutesPerItem: 1 });

    expect(analysis.state).toBe('ROUTE_BLOCKED');
    expect(analysis.currentRoutes).toEqual([
      expect.objectContaining({
        sourceLabel: 'Z timber merchant',
        hasDataGap: false,
        blockers: [expect.objectContaining({ type: 'QUEST', questId: 'Priest in Peril' })],
      }),
    ]);
  });
});
const item = (name: string) => ({ key: canonicalItemKey(name), name });

const requirement = (name: string, quantity = 1): QuestItemRequirement => ({
  item: item(name),
  quantity,
  supplyPolicy: 'PLAYER_OBTAINED',
});

const recipe = (
  output: string,
  overrides: Partial<RouteRecipe> = {},
): RouteRecipe => ({
  id: `${canonicalItemKey(output)}-recipe`,
  kind: 'RECIPE',
  output: item(output),
  outputQuantity: 1,
  ingredients: [],
  tools: [],
  stations: [{ entityKind: 'object', names: [`${output} station`] }],
  gates: [],
  deterministic: true,
  sourceRevision: 'test-fixture',
  ...overrides,
});

const recursiveFixture = ({
  records = [],
  current = ['1,2'],
  account = unlocks(),
  recipes = [],
  locations,
  requirements = () => [],
  coverage,
  fingerprint,
  indexLocations = true,
}: {
  records?: readonly ItemSourceRecord[];
  current?: readonly ChunkKey[];
  account?: UnlockState;
  recipes?: readonly RouteRecipe[];
  locations?: ExactEntityLocationLookup;
  requirements?: (
    name: string,
    kind: 'object' | 'npc',
    chunk: ChunkKey,
  ) => readonly RawRouteRequirement[];
  coverage?: DirectRouteResolutionSnapshot['sourceCoverage'];
  fingerprint?: string;
  indexLocations?: boolean;
} = {}): DirectRouteResolutionSnapshot => ({
  ...fixture({ records, current, account }),
  ...(coverage ? { sourceCoverage: coverage } : {}),
  recipesFor: (itemKey: string) => recipes.filter(entry => entry.output.key === canonicalItemKey(itemKey)),
  entityLocations: locations ?? ((name, kind) => ({
    name,
    kind,
    locations: [{ cx: 1, cy: 2 }],
  })),
  entityLocationsForPhase: indexLocations
    ? (name, kind, phase) => {
        const hit = locations
          ? locations(name, kind)
          : { name, kind, locations: [{ cx: 1, cy: 2 }] };
        if (hit === null) return null;
        const validLocations = hit.locations.filter(location => (
          Number.isInteger(location.cx) && Number.isInteger(location.cy)
        ));
        if (phase === 'advisory') return { ...hit, locations: validLocations };
        const currentSet = new Set<ChunkKey>(current);
        return {
          ...hit,
          locations: validLocations.filter(location => (
            currentSet.has(`${location.cx},${location.cy}` as ChunkKey)
          )),
        };
      }
    : undefined,
  hasAdvisoryEntityLocations: indexLocations
    ? (name, kind) => {
        const hit = locations
          ? locations(name, kind)
          : { name, kind, locations: [{ cx: 1, cy: 2 }] };
        if (hit === null) return false;
        const currentSet = new Set<ChunkKey>(current);
        return hit.locations.some(location => (
          Number.isInteger(location.cx)
          && Number.isInteger(location.cy)
          && !currentSet.has(`${location.cx},${location.cy}` as ChunkKey)
        ));
      }
    : undefined,
  stationRequirements: requirements,
  fingerprint,
});

const itemSource = (
  itemName: string,
  overrides: Partial<ItemSourceRecord> = {},
): ItemSourceRecord => source({
  itemName,
  hostName: `${itemName} source`,
  ...overrides,
});

describe('resolveItemRequirement recursive AND/OR routes', () => {
  it('multiplies consumed ingredients but not reusable tools', () => {
    const plankRecipe = recipe('Plank', {
      id: 'logs-to-plank-with-saw',
      ingredients: [{ item: item('Logs'), quantity: 1 }],
      tools: [{ item: item('Saw'), consumed: false }],
      stations: [{ entityKind: 'object', names: ['Sawmill'] }],
    });
    const analysis = resolveItemRequirement(requirement('Plank', 10), recursiveFixture({
      records: [itemSource('Logs'), itemSource('Saw')],
      recipes: [plankRecipe],
    }));
    const route = analysis.currentRoutes.find(candidate => candidate.sourceKind === 'RECIPE')!;

    expect(route.outputQuantity).toBe(10);
    expect(route.steps.filter(step => step.label === 'Obtain Logs')).toHaveLength(1);
    expect(route.steps.find(step => step.label === 'Obtain Logs')).toMatchObject({
      quantity: 10,
      consumed: true,
    });
    expect(route.steps.filter(step => step.label === 'Obtain Saw')).toHaveLength(1);
    expect(route.steps.find(step => step.label === 'Obtain Saw')).toMatchObject({
      quantity: 1,
      consumed: false,
    });
    expect(route).toMatchObject({
      consumedIngredientCost: 10,
      skillUnlockCost: 0,
      skillLevelCost: 0,
    });
  });

  it('preserves direct sources as OR branches beside reviewed recipes with stable unique IDs', () => {
    const plankRecipe = recipe('Plank', {
      id: 'logs-to-plank',
      ingredients: [{ item: item('Logs'), quantity: 1 }],
      stations: [{ entityKind: 'object', names: ['Sawmill'] }],
    });
    const snapshot = recursiveFixture({
      records: [itemSource('Plank', { hostName: 'Plank spawn' }), itemSource('Logs')],
      recipes: [plankRecipe],
    });

    const first = resolveItemRequirement(requirement('Plank'), snapshot);
    const second = resolveItemRequirement(requirement('Plank'), snapshot);

    expect(first.currentRoutes.map(route => route.sourceKind)).toEqual(['SPAWN', 'RECIPE']);
    expect(new Set(first.currentRoutes.map(route => route.id)).size).toBe(2);
    expect(second.currentRoutes.map(route => route.id)).toEqual(first.currentRoutes.map(route => route.id));
  });

  it('requires ingredient A and ingredient B as AND dependencies', () => {
    const combined = recipe('Combined', {
      ingredients: [
        { item: item('Ingredient A'), quantity: 2 },
        { item: item('Ingredient B'), quantity: 3 },
      ],
    });
    const analysis = resolveItemRequirement(requirement('Combined'), recursiveFixture({
      records: [
        itemSource('Ingredient A', { cx: 2, cy: 3 }),
        itemSource('Ingredient B', { cx: 3, cy: 4 }),
      ],
      current: ['1,2', '2,3', '3,4'],
      recipes: [combined],
    }));

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes[0]).toMatchObject({
      chunks: ['1,2', '2,3', '3,4'],
      hasDataGap: false,
    });
    expect(analysis.currentRoutes[0].steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Obtain Ingredient A', quantity: 2, consumed: true }),
      expect.objectContaining({ label: 'Obtain Ingredient B', quantity: 3, consumed: true }),
      expect.objectContaining({ label: 'Ingredient A source' }),
      expect.objectContaining({ label: 'Ingredient B source' }),
    ]));
  });

  it('retains every independently proven sibling when one ingredient is missing', () => {
    const combined = recipe('Combined', {
      ingredients: [
        { item: item('Ingredient A'), quantity: 1 },
        { item: item('Missing ingredient'), quantity: 1 },
      ],
    });
    const analysis = resolveItemRequirement(requirement('Combined'), recursiveFixture({
      records: [itemSource('Ingredient A')],
      recipes: [combined],
    }));

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.currentRoutes).toHaveLength(1);
    expect(analysis.currentRoutes[0].steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Obtain Ingredient A' }),
      expect.objectContaining({ label: 'Ingredient A source' }),
      expect.objectContaining({ label: 'Obtain Missing ingredient' }),
    ]));
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/no known acquisition route.*Missing ingredient/i));
  });

  it('keeps a current exact station visible with its named access blocker', () => {
    const stationRecipe = recipe('Worked item', {
      stations: [{ entityKind: 'object', names: ['Sealed workbench'] }],
    });
    const analysis = resolveItemRequirement(requirement('Worked item'), recursiveFixture({
      recipes: [stationRecipe],
      requirements: (name, kind, chunk) => name === 'Sealed workbench' && kind === 'object' && chunk === '1,2'
        ? [
          { raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' },
          { raw: 'Priest in Peril', origin: 'CHUNK_ENTRY' },
        ]
        : [],
    }));

    expect(analysis.state).toBe('ROUTE_BLOCKED');
    expect(analysis.currentRoutes[0]).toMatchObject({
      chunks: ['1,2'],
      blockers: [expect.objectContaining({
        type: 'QUEST',
        questId: 'Priest in Peril',
        label: 'Priest in Peril',
      })],
      hasDataGap: false,
    });
  });

  it('moves a recursive route outside when any dependency chunk is locked and keeps the complete chunk set', () => {
    const stationRecipe = recipe('Worked item', {
      ingredients: [{ item: item('Outside ingredient'), quantity: 1 }],
    });
    const analysis = resolveItemRequirement(requirement('Worked item'), recursiveFixture({
      records: [itemSource('Outside ingredient', { cx: 8, cy: 9 })],
      recipes: [stationRecipe],
    }));

    expect(analysis.currentRoutes).toEqual([]);
    expect(analysis.missingChunkRoutes).toEqual([
      expect.objectContaining({ chunks: ['1,2', '8,9'] }),
    ]);
  });

  it('terminates recipe cycles with a precise local data note', () => {
    const aRecipe = recipe('Cycle A', {
      ingredients: [{ item: item('Cycle B'), quantity: 1 }],
    });
    const bRecipe = recipe('Cycle B', {
      ingredients: [{ item: item('Cycle A'), quantity: 1 }],
    });
    const analysis = resolveItemRequirement(requirement('Cycle A'), recursiveFixture({
      recipes: [aRecipe, bRecipe],
    }));

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.currentRoutes).not.toEqual([]);
    expect(analysis.currentRoutes[0].steps).toContainEqual(expect.objectContaining({ label: 'Obtain Cycle B' }));
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/cycle detected.*Cycle A.*quantity 1/i));
  });

  it('memoizes separately for dependency quantities and account snapshots', () => {
    const crafted = recipe('Crafted item', {
      ingredients: [{ item: item('Shared input'), quantity: 1 }],
      tools: [{ item: item('Shared input'), consumed: false }],
    });
    const records = [itemSource('Shared input', {
      rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
    })];
    const lockedSnapshot = recursiveFixture({
      records,
      recipes: [crafted],
      fingerprint: 'locked-account',
    });
    const unlockedSnapshot = recursiveFixture({
      records,
      recipes: [crafted],
      account: unlocks({ quests: ['Priest in Peril'] }),
      fingerprint: 'unlocked-account',
    });

    const locked = resolveItemRequirement(requirement('Crafted item', 2), lockedSnapshot);
    const unlocked = resolveItemRequirement(requirement('Crafted item', 2), unlockedSnapshot);
    const dependencySteps = locked.currentRoutes[0].steps.filter(step => step.label === 'Obtain Shared input');

    expect(dependencySteps.map(step => ({
      quantity: step.quantity,
      consumed: step.consumed,
    }))).toEqual([
      { quantity: 2, consumed: true },
      { quantity: 1, consumed: false },
    ]);
    expect(locked.currentRoutes[0].steps
      .filter(step => step.label === 'Shared input source')
      .map(step => step.quantity)).toEqual([2, 1]);
    expect(locked.currentRoutes[0].blockers).toContainEqual(expect.objectContaining({ type: 'QUEST' }));
    expect(unlocked.currentRoutes[0].blockers).toEqual([]);
  });

  it('returns partial sibling evidence when the depth budget is exhausted', () => {
    const aRecipe = recipe('Depth A', {
      ingredients: [{ item: item('Depth B'), quantity: 1 }],
    });
    const bRecipe = recipe('Depth B', {
      ingredients: [{ item: item('Depth C'), quantity: 1 }],
    });
    const analysis = resolveItemRequirement(
      requirement('Depth A'),
      recursiveFixture({ recipes: [aRecipe, bRecipe] }),
      { maxDepth: 1 },
    );

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.currentRoutes).not.toEqual([]);
    expect(analysis.currentRoutes[0].steps).toContainEqual(expect.objectContaining({ label: 'Obtain Depth B' }));
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/maximum recursive depth 1.*Depth B/i));
  });

  it('retains the best usable route regardless of source insertion order at the budget', () => {
    const blocked = itemSource('Budgeted item', {
      hostName: 'Blocked source',
      rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
    });
    const usable = itemSource('Budgeted item', { hostName: 'Usable source' });
    const resolve = (records: ItemSourceRecord[]) => resolveItemRequirement(
      requirement('Budgeted item'),
      recursiveFixture({ records, recipes: [] }),
      { maxRoutesPerItem: 1 },
    );

    for (const records of [[blocked, usable], [usable, blocked]]) {
      const analysis = resolve(records);
      expect(analysis.state).toBe('OBTAINABLE_NOW');
      expect(analysis.currentRoutes).toEqual([
        expect.objectContaining({ sourceLabel: 'Usable source', blockers: [] }),
      ]);
      expect(analysis.dataNotes).toContainEqual(
        expect.stringMatching(/route budget of 1 exhausted.*Budgeted item/i),
      );
    }
  });

  it('ranks complete station and dependency routes before pruning by travel', () => {
    const crafted = recipe('Collocated output', {
      ingredients: [{ item: item('Collocated input'), quantity: 1 }],
      stations: [{ entityKind: 'object', names: ['Collocated station'] }],
    });
    const analysis = resolveItemRequirement(requirement('Collocated output'), recursiveFixture({
      records: [
        itemSource('Collocated input', { hostName: 'A distant source', cx: 1, cy: 2 }),
        itemSource('Collocated input', { hostName: 'Z collocated source', cx: 2, cy: 2 }),
      ],
      current: ['1,2', '2,2'],
      recipes: [crafted],
      locations: (name, kind) => ({ name, kind, locations: [{ cx: 2, cy: 2 }] }),
    }), { maxRoutesPerItem: 1 });

    expect(analysis.currentRoutes).toHaveLength(1);
    expect(analysis.currentRoutes[0].steps).toContainEqual(expect.objectContaining({
      label: 'Z collocated source',
      chunk: '2,2',
    }));
    expect(analysis.currentRoutes[0].travelCost).toBe(0);
  });

  it('does not prune a later station before ranking it with its dependency', () => {
    const crafted = recipe('Station choice output', {
      ingredients: [{ item: item('Station choice input'), quantity: 1 }],
      stations: [{ entityKind: 'object', names: ['A distant station', 'Z collocated station'] }],
    });
    const analysis = resolveItemRequirement(requirement('Station choice output'), recursiveFixture({
      records: [itemSource('Station choice input', { cx: 9, cy: 9 })],
      current: ['1,1', '9,9'],
      recipes: [crafted],
      locations: (name, kind) => ({
        name,
        kind,
        locations: [name === 'A distant station' ? { cx: 1, cy: 1 } : { cx: 9, cy: 9 }],
      }),
    }), { maxRoutesPerItem: 1 });

    expect(analysis.currentRoutes).toHaveLength(1);
    expect(analysis.currentRoutes[0].steps).toContainEqual(expect.objectContaining({
      label: 'Use Z collocated station',
      chunk: '9,9',
    }));
    expect(analysis.currentRoutes[0].travelCost).toBe(0);
  });

  it('does not prune a dependency prefix whose endpoint makes the completed route best', () => {
    const crafted = recipe('Endpoint output', {
      ingredients: [
        { item: item('First endpoint input'), quantity: 1 },
        { item: item('Second endpoint input'), quantity: 1 },
      ],
      stations: [{ entityKind: 'object', names: ['Endpoint station'] }],
    });
    const analysis = resolveItemRequirement(requirement('Endpoint output'), recursiveFixture({
      records: [
        itemSource('First endpoint input', { hostName: 'A prefix-near source', cx: 1, cy: 2 }),
        itemSource('First endpoint input', { hostName: 'Z completion-near source', cx: 11, cy: 1 }),
        itemSource('Second endpoint input', { cx: 11, cy: 1 }),
      ],
      current: ['1,1', '1,2', '11,1'],
      recipes: [crafted],
      locations: (name, kind) => ({ name, kind, locations: [{ cx: 1, cy: 1 }] }),
    }), { maxRoutesPerItem: 1 });

    expect(analysis.currentRoutes).toHaveLength(1);
    expect(analysis.currentRoutes[0].steps).toContainEqual(expect.objectContaining({
      label: 'Z completion-near source',
      chunk: '11,1',
    }));
    expect(analysis.currentRoutes[0].travelCost).toBe(10);
  });

  it('keeps an endpoint-relevant child beyond the former fifty-route depth cap', () => {
    const crafted = recipe('Deep source output', {
      ingredients: [{ item: item('Deep source input'), quantity: 1 }],
      stations: [{ entityKind: 'object', names: ['Deep source station'] }],
    });
    const distant = Array.from({ length: 50 }, (_, index) => itemSource('Deep source input', {
      hostName: `A distant source ${String(index).padStart(2, '0')}`,
      cx: 1,
      cy: 1,
    }));
    const analysis = resolveItemRequirement(requirement('Deep source output'), recursiveFixture({
      records: [
        ...distant,
        itemSource('Deep source input', {
          hostName: 'Z collocated source beyond fifty',
          cx: 101,
          cy: 1,
        }),
      ],
      current: ['1,1', '101,1'],
      recipes: [crafted],
      locations: (name, kind) => ({ name, kind, locations: [{ cx: 101, cy: 1 }] }),
    }), { maxRoutesPerItem: 1 });

    expect(analysis.currentRoutes).toHaveLength(1);
    expect(analysis.currentRoutes[0].steps).toContainEqual(expect.objectContaining({
      label: 'Z collocated source beyond fifty',
      chunk: '101,1',
    }));
    expect(analysis.currentRoutes[0].travelCost).toBe(0);
  });

  it('does not let advisory-only overflow weaken proved current or absence states', () => {
    const blockedCurrent = itemSource('Budget state', {
      hostName: 'Current blocked source',
      cx: 1,
      cy: 2,
      rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
    });
    const outside = [
      itemSource('Budget state', { hostName: 'Outside A', cx: 8, cy: 9 }),
      itemSource('Budget state', { hostName: 'Outside B', cx: 9, cy: 9 }),
    ];

    expect(resolveItemRequirement(
      requirement('Budget state'),
      recursiveFixture({ records: [blockedCurrent, ...outside], recipes: [] }),
      { maxRoutesPerItem: 1 },
    ).state).toBe('ROUTE_BLOCKED');
    expect(resolveItemRequirement(
      requirement('Budget state'),
      recursiveFixture({ records: outside, recipes: [] }),
      { maxRoutesPerItem: 1 },
    ).state).toBe('NO_CURRENT_SOURCE');
  });

  it('finishes a current recipe before spending the shared work budget on its outside station', () => {
    const output = 'Cross-layer station priority';
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      current: ['1,2'],
      recipes: [recipe(output)],
      locations: (name, kind) => ({
        name,
        kind,
        locations: [{ cx: 1, cy: 2 }, { cx: 8, cy: 9 }],
      }),
    }), {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 5,
    });

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.searchIncompleteMayHideUsable).toBe(false);
    expect(analysis.advisorySearchIncomplete).toBe(true);
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(5);
    expect(analysis.currentRoutes).toEqual([
      expect.objectContaining({ sourceLabel: `${canonicalItemKey(output)}-recipe`, chunks: ['1,2'] }),
    ]);
  });

  it('finishes current recipe search before spending work on outside direct evidence', () => {
    const output = 'Cross-layer direct priority';
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      records: [itemSource(output, { hostName: 'Outside direct source', cx: 8, cy: 9 })],
      recipes: [recipe(output)],
    }), {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 5,
    });

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.searchIncompleteMayHideUsable).toBe(false);
    expect(analysis.advisorySearchIncomplete).toBe(true);
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(5);
    expect(analysis.currentRoutes).toEqual([
      expect.objectContaining({ sourceLabel: `${canonicalItemKey(output)}-recipe`, chunks: ['1,2'] }),
    ]);
  });

  it('keeps a blocked witness authoritative when advisory exact combinations hit the hard boundary', () => {
    const output = 'Advisory exact boundary';
    const blockedCurrent = itemSource(output, {
      hostName: 'Current blocked source',
      rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
    });
    const outsideRecipe = recipe(output);
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      records: [blockedCurrent],
      recipes: [outsideRecipe],
      locations: (name, kind) => ({
        name,
        kind,
        locations: [{ cx: 8, cy: 9 }, { cx: 9, cy: 9 }, { cx: 10, cy: 9 }],
      }),
    }), {
      maxRoutesPerItem: 50,
      maxExactRouteCombinations: 1,
      maxRouteSearchWorkUnits: 100,
    } as Parameters<typeof resolveItemRequirement>[2]);

    expect(analysis.state).toBe('ROUTE_BLOCKED');
    expect(analysis.searchIncompleteMayHideUsable).toBe(false);
    expect(analysis).toMatchObject({ advisorySearchIncomplete: true });
    expect(analysis.exactRouteCombinationsEvaluated).toBe(1);
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/advisory route search stopped/i));
  });

  it('keeps a blocked witness authoritative when advisory direct work hits the hard boundary', () => {
    const output = 'Advisory direct boundary';
    const blockedCurrent = itemSource(output, {
      hostName: 'Current blocked source',
      rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
    });
    const outside = Array.from({ length: 4 }, (_, index) => itemSource(output, {
      hostName: `Outside source ${index}`,
      cx: 8 + index,
      cy: 9,
    }));
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      records: [...outside, blockedCurrent],
    }), {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 4,
    } as Parameters<typeof resolveItemRequirement>[2]);

    expect(analysis.state).toBe('ROUTE_BLOCKED');
    expect(analysis.searchIncompleteMayHideUsable).toBe(false);
    expect(analysis).toMatchObject({ advisorySearchIncomplete: true });
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(4);
  });

  it('preserves proved current witnesses when an alternative wrapper exhausts advisory work', () => {
    const output = 'Wrapped advisory boundary';
    const cases = [
      {
        expectedState: 'OBTAINABLE_NOW',
        current: itemSource(output, { hostName: 'Current usable source' }),
      },
      {
        expectedState: 'ROUTE_BLOCKED',
        current: itemSource(output, {
          hostName: 'Current blocked source',
          rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
        }),
      },
    ] as const;

    for (const testCase of cases) {
      const analysis = resolveItemRequirement({
        ...requirement('Wrapped choice'),
        alternatives: [item(output)],
      }, recursiveFixture({
        records: [
          itemSource(output, { hostName: 'Outside source', cx: 8, cy: 9 }),
          testCase.current,
        ],
      }), {
        maxRoutesPerItem: 50,
        maxRouteSearchWorkUnits: 4,
      } as Parameters<typeof resolveItemRequirement>[2]);

      expect(analysis.state).toBe(testCase.expectedState);
      expect(analysis.currentRoutes).toHaveLength(1);
      expect(analysis.searchIncompleteMayHideUsable).toBe(false);
      expect(analysis.advisorySearchIncomplete).toBe(true);
      expect(analysis.routeSearchWorkUnitsEvaluated).toBe(4);
    }
  });

  it('preserves fully searched current witnesses when only alternative ranking exhausts work', () => {
    const output = 'Wrapped current ranking boundary';
    const blocked = itemSource(output, {
      hostName: 'Current blocked source',
      rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
    });
    const usable = itemSource(output, { hostName: 'Current usable source' });
    const wrappedRequirement: QuestItemRequirement = {
      ...requirement('Wrapped current choice'),
      alternatives: [item(output)],
    };

    for (const testCase of [
      { current: usable, expectedState: 'OBTAINABLE_NOW' },
      { current: blocked, expectedState: 'ROUTE_BLOCKED' },
    ] as const) {
      const analysis = resolveItemRequirement(
        wrappedRequirement,
        recursiveFixture({ records: [testCase.current] }),
        { maxRoutesPerItem: 50, maxRouteSearchWorkUnits: 3 },
      );

      expect(analysis.state).toBe(testCase.expectedState);
      expect(analysis.currentRoutes).toHaveLength(1);
      expect(analysis.searchIncompleteMayHideUsable).toBe(false);
      expect(analysis.routeSearchWorkUnitsEvaluated).toBe(3);
    }

    const ordered = resolveItemRequirement({
      ...wrappedRequirement,
      alternatives: [item('Blocked alternative'), item('Usable alternative')],
    }, recursiveFixture({
      records: [
        itemSource('Blocked alternative', {
          hostName: 'Blocked first',
          rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
        }),
        itemSource('Usable alternative', { hostName: 'Usable second' }),
      ],
    }), { maxRoutesPerItem: 50, maxRouteSearchWorkUnits: 7 });

    expect(ordered.state).toBe('OBTAINABLE_NOW');
    expect(ordered.currentRoutes).toEqual([
      expect.objectContaining({ sourceLabel: 'Usable second' }),
    ]);
    expect(ordered.searchIncompleteMayHideUsable).toBe(false);
    expect(ordered.routeSearchWorkUnitsEvaluated).toBe(7);
  });

  it('does not rescan the irrelevant route class after alternative ranking reaches the boundary', () => {
    class CountingChunkSet extends Set<ChunkKey> {
      membershipReads = 0;

      override has(value: ChunkKey): boolean {
        this.membershipReads += 1;
        return super.has(value);
      }
    }

    const output = 'Single-class ranking boundary';
    const currentChunks = new CountingChunkSet(['1,2']);
    const base = recursiveFixture({
      records: [itemSource(output, { hostName: 'Only usable source' })],
    });
    const analysis = resolveItemRequirement({
      ...requirement('Wrapped single-class choice'),
      alternatives: [item(output)],
    }, {
      ...base,
      unlockedChunks: currentChunks,
    }, { maxRoutesPerItem: 50, maxRouteSearchWorkUnits: 3 });

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(3);
    expect(currentChunks.membershipReads).toBe(4);
  });

  it('keeps complete-family absence authoritative when advisory work hits the hard boundary', () => {
    const output = 'Advisory work boundary';
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      recipes: [recipe(output)],
      locations: (name, kind) => ({
        name,
        kind,
        locations: [{ cx: 8, cy: 9 }, { cx: 9, cy: 9 }, { cx: 10, cy: 9 }],
      }),
    }), {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 2,
    } as Parameters<typeof resolveItemRequirement>[2]);

    expect(analysis.state).toBe('NO_CURRENT_SOURCE');
    expect(analysis.searchIncompleteMayHideUsable).toBe(false);
    expect(analysis).toMatchObject({ advisorySearchIncomplete: true });
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(2);
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/advisory route search stopped/i));
  });

  it('fails closed and stops direct-source materialization at the current work boundary', () => {
    const output = 'Direct hard boundary';
    let mappedRequirementReads = 0;
    const records = Array.from({ length: 4 }, (_, index) => {
      const record = itemSource(output, { hostName: `Blocked source ${index}` });
      Object.defineProperty(record, 'rawRequirements', {
        enumerable: true,
        get: () => {
          mappedRequirementReads += 1;
          return [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }];
        },
      });
      return record;
    });
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({ records }), {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 2,
    } as Parameters<typeof resolveItemRequirement>[2]);

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.searchIncompleteMayHideUsable).toBe(true);
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(2);
    expect(mappedRequirementReads).toBe(1);
  });

  it('stops an oversized advisory-record scan at the boundary without weakening a proved current route', () => {
    const currentOutput = 'Direct scan current proof';
    const advisoryOutput = 'Direct scan advisory tail';
    let coordinateReads = 0;
    const countedSource = (
      itemName: string,
      hostName: string,
      cx: number,
      cy: number,
    ): ItemSourceRecord => {
      const record = itemSource(itemName, { hostName, cx, cy });
      Object.defineProperties(record, {
        cx: {
          enumerable: true,
          get: () => {
            coordinateReads += 1;
            return cx;
          },
        },
        cy: {
          enumerable: true,
          get: () => {
            coordinateReads += 1;
            return cy;
          },
        },
      });
      return record;
    };
    const currentRecord = countedSource(currentOutput, 'First usable source', 1, 2);
    const advisoryRecords = Array.from({ length: 128 }, (_, index) => (
      countedSource(advisoryOutput, `Outside source ${index}`, 8 + index, 9)
    ));
    const base = recursiveFixture();
    const snapshot: DirectRouteResolutionSnapshot = {
      ...base,
      recordsForClass: (itemName, searchClass) => {
        if (itemName === currentOutput) return searchClass === 'current' ? [currentRecord] : [];
        if (itemName === advisoryOutput) {
          return searchClass === 'advisory' ? advisoryRecords : [];
        }
        return [];
      },
      hasKnownOutsideSources: itemName => itemName === advisoryOutput,
    };

    const analysis = resolveItemRequirement({
      ...requirement('Wrapped direct scan'),
      alternatives: [item(currentOutput), item(advisoryOutput)],
    }, snapshot, {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 8,
    });

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes).toEqual([
      expect.objectContaining({ sourceLabel: 'First usable source' }),
    ]);
    expect(analysis.searchIncompleteMayHideUsable).toBe(false);
    expect(analysis.advisorySearchIncomplete).toBe(true);
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(8);
    expect(coordinateReads).toBe(8);
  });
  it('fails closed and stops station-candidate materialization at the current work boundary', () => {
    const output = 'Station hard boundary';
    let stationRequirementReads = 0;
    const locations = Array.from({ length: 4 }, (_, index) => ({ cx: index + 1, cy: 2 }));
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      current: ['1,2', '2,2', '3,2', '4,2'],
      recipes: [recipe(output)],
      locations: (name, kind) => ({ name, kind, locations }),
      requirements: () => {
        stationRequirementReads += 1;
        return [];
      },
    }), {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 3,
    } as Parameters<typeof resolveItemRequirement>[2]);

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.searchIncompleteMayHideUsable).toBe(true);
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(3);
    expect(stationRequirementReads).toBe(2);
  });

  it('stops oversized exact-station location enumeration at the boundary without weakening a proved current route', () => {
    const output = 'Station scan boundary';
    let entityLookups = 0;
    let locationArrayReads = 0;
    let coordinateReads = 0;
    const locations = Array.from({ length: 128 }, (_, index) => {
      const location = {} as { cx: number; cy: number };
      Object.defineProperties(location, {
        cx: {
          enumerable: true,
          get: () => {
            coordinateReads += 1;
            return 8 + index;
          },
        },
        cy: {
          enumerable: true,
          get: () => {
            coordinateReads += 1;
            return 9;
          },
        },
      });
      return location;
    });
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      records: [itemSource(output, { hostName: 'Known usable source' })],
      indexLocations: false,
      recipes: [recipe(output)],
      locations: (name, kind) => {
        entityLookups += 1;
        return {
          name,
          kind,
          get locations() {
            locationArrayReads += 1;
            return locations;
          },
        };
      },
    }), {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 4,
    });

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes).toContainEqual(
      expect.objectContaining({ sourceLabel: 'Known usable source' }),
    );
    expect(analysis.searchIncompleteMayHideUsable).toBe(true);
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(4);
    expect(entityLookups).toBe(1);
    expect(locationArrayReads).toBe(1);
    expect(coordinateReads).toBe(2);
  });
  it('keeps invalid indexed station coordinates as a data gap', () => {
    const output = 'Invalid indexed station';
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      recipes: [recipe(output)],
      locations: (name, kind) => ({
        name,
        kind,
        locations: [{ cx: Number.NaN, cy: 2 }],
      }),
    }));

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.currentRoutes).toContainEqual(expect.objectContaining({
      sourceLabel: `${canonicalItemKey(output)}-recipe`,
      hasDataGap: true,
    }));
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/no exact object location/i));
  });
  it('performs no retained-route ranking work after the checked boundary', () => {
    class RankingBoundarySet extends Set<ChunkKey> {
      override has(value: ChunkKey): boolean {
        if (value === '3,2' && retainedRankingAudit.routeEvaluations === 5) {
          retainedRankingAudit.afterBoundary = true;
        }
        return super.has(value);
      }
    }

    resetRetainedRankingAudit();
    try {
      const output = 'Retained route boundary';
      const base = recursiveFixture({
        current: ['1,2', '2,2', '3,2'],
        records: [
          itemSource(output, { hostName: 'A source', cx: 1, cy: 2 }),
          itemSource(output, { hostName: 'B source', cx: 2, cy: 2 }),
          itemSource(output, { hostName: 'Z source', cx: 3, cy: 2 }),
        ],
      });
      const analysis = resolveItemRequirement({
        ...requirement('Wrapped retained routes'),
        alternatives: [item(output)],
      }, {
        ...base,
        unlockedChunks: new RankingBoundarySet(['1,2', '2,2', '3,2']),
      }, {
        maxRoutesPerItem: 3,
        maxRouteSearchWorkUnits: 9,
      });

      expect(analysis.state).toBe('OBTAINABLE_NOW');
      expect(analysis.currentRoutes.map(route => route.sourceLabel)).toEqual([
        'A source',
        'B source',
      ]);
      expect(analysis.searchIncompleteMayHideUsable).toBe(false);
      expect(analysis.routeSearchWorkUnitsEvaluated).toBe(9);
      expect(retainedRankingAudit.afterBoundary).toBe(true);
      expect(retainedRankingAudit.postBoundaryEvents).toEqual([]);
    } finally {
      resetRetainedRankingAudit();
    }
  });

  it('performs no retained-combination scoring work after the checked boundary', () => {
    class CombinationBoundarySet extends Set<ChunkKey> {
      override has(value: ChunkKey): boolean {
        if (value === '4,2' && retainedRankingAudit.combinationScores === 2) {
          retainedRankingAudit.afterBoundary = true;
        }
        return super.has(value);
      }
    }

    resetRetainedRankingAudit();
    try {
      const output = 'Retained combination boundary';
      const dependency = 'Ranked ingredient';
      const base = recursiveFixture({
        current: ['1,2', '2,2', '3,2', '4,2'],
        records: [
          itemSource(dependency, { hostName: 'A ingredient', cx: 2, cy: 2 }),
          itemSource(dependency, { hostName: 'B ingredient', cx: 3, cy: 2 }),
          itemSource(dependency, { hostName: 'Z ingredient', cx: 4, cy: 2 }),
        ],
        recipes: [recipe(output, {
          ingredients: [{ item: item(dependency), quantity: 1 }],
        })],
      });
      const analysis = resolveItemRequirement(requirement(output), {
        ...base,
        unlockedChunks: new CombinationBoundarySet(['1,2', '2,2', '3,2', '4,2']),
      }, {
        maxRoutesPerItem: 3,
        maxExactRouteCombinations: 10,
        maxRouteSearchWorkUnits: 11,
      });

      expect(analysis.state).toBe('DATA_INCOMPLETE');
      expect(analysis.currentRoutes).toEqual([]);
      expect(analysis.searchIncompleteMayHideUsable).toBe(true);
      expect(analysis.routeSearchWorkUnitsEvaluated).toBe(11);
      expect(analysis.exactRouteCombinationsEvaluated).toBe(2);
      expect(retainedRankingAudit.afterBoundary).toBe(true);
      expect(retainedRankingAudit.postBoundaryEvents).toEqual([]);
    } finally {
      resetRetainedRankingAudit();
    }
  });
  it('fails closed before resolving alternatives beyond the current work boundary', () => {
    const visitedItems: string[] = [];
    const base = recursiveFixture();
    const snapshot: DirectRouteResolutionSnapshot = {
      ...base,
      recordsForClass: (itemName: string) => {
        visitedItems.push(itemName);
        return [];
      },
      hasKnownOutsideSources: () => false,
    };
    const analysis = resolveItemRequirement({
      ...requirement('Any bounded input'),
      alternatives: [item('Alternative A'), item('Alternative B'), item('Alternative C')],
    }, snapshot, {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 2,
    } as Parameters<typeof resolveItemRequirement>[2]);

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.searchIncompleteMayHideUsable).toBe(true);
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(2);
    expect(visitedItems).toEqual(['Alternative A']);
  });

  it('fails closed when post-expansion ranking reaches the current work boundary', () => {
    const output = 'Post expansion boundary';
    const analysis = resolveItemRequirement(requirement(output), recursiveFixture({
      recipes: [recipe(output)],
    }), {
      maxRoutesPerItem: 50,
      maxRouteSearchWorkUnits: 4,
    } as Parameters<typeof resolveItemRequirement>[2]);

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.searchIncompleteMayHideUsable).toBe(true);
    expect(analysis.routeSearchWorkUnitsEvaluated).toBe(4);
    expect(analysis.currentRoutes).toEqual([]);
  });

  it('keeps a complete blocked direct route authoritative beside a cyclic recipe gap', () => {
    const blocked = itemSource('Blocked cycle', {
      rawRequirements: [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }],
    });
    const cycleA = recipe('Blocked cycle', {
      ingredients: [{ item: item('Cycle dependency'), quantity: 1 }],
    });
    const cycleB = recipe('Cycle dependency', {
      ingredients: [{ item: item('Blocked cycle'), quantity: 1 }],
    });
    const analysis = resolveItemRequirement(requirement('Blocked cycle'), recursiveFixture({
      records: [blocked],
      recipes: [cycleA, cycleB],
    }));

    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/cycle detected/i));
    expect(analysis.state).toBe('ROUTE_BLOCKED');
  });

  it('propagates a recursive dependency coverage gap through a missing route', () => {
    const plankRecipe = recipe('Coverage plank', {
      ingredients: [{ item: item('Coverage logs'), quantity: 1 }],
    });
    const analysis = resolveItemRequirement(requirement('Coverage plank'), recursiveFixture({
      records: [itemSource('Coverage logs', { cx: 8, cy: 9 })],
      recipes: [plankRecipe],
      coverage: itemKey => itemKey === 'coverage logs'
        ? { direct: 'COMPLETE', transformation: 'PARTIAL' }
        : { direct: 'COMPLETE', transformation: 'COMPLETE' },
    }));

    expect(analysis.missingChunkRoutes).not.toEqual([]);
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/transformation coverage.*Coverage logs/i));
    expect(analysis.state).toBe('DATA_INCOMPLETE');
  });

  it('expands a generic Pickaxe tool through exact item-family alternatives only', () => {
    const miningRecipe = recipe('Iron ore', {
      kind: 'GATHER',
      tools: [{
        item: item('Pickaxe'),
        consumed: false,
        alternatives: [
          item('Bronze pickaxe'),
          item('Iron pickaxe'),
        ],
      }],
      stations: [{ entityKind: 'object', names: ['Iron rocks'] }],
    });
    const analysis = resolveItemRequirement(requirement('Iron ore'), recursiveFixture({
      records: [
        itemSource('Iron pickaxe'),
        itemSource('Dragon pickaxe upgrade kit'),
      ],
      recipes: [miningRecipe],
    }));

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes[0].steps).toContainEqual(expect.objectContaining({
      label: 'Obtain Iron pickaxe',
      quantity: 1,
      consumed: false,
    }));
    expect(analysis.currentRoutes[0].steps.some(step => /upgrade kit/i.test(step.label))).toBe(false);
  });
});

describe('recursive route combination bounds', () => {
  it('reports truncated Cartesian OR combinations while retaining bounded evidence', () => {
    const combined = recipe('Many routes', {
      ingredients: [
        { item: item('Ingredient A'), quantity: 1 },
        { item: item('Ingredient B'), quantity: 1 },
      ],
    });
    const analysis = resolveItemRequirement(requirement('Many routes'), recursiveFixture({
      records: [
        itemSource('Ingredient A', { hostName: 'A source 1' }),
        itemSource('Ingredient A', { hostName: 'A source 2' }),
        itemSource('Ingredient B', { hostName: 'B source 1' }),
        itemSource('Ingredient B', { hostName: 'B source 2' }),
      ],
      recipes: [combined],
    }), { maxRoutesPerItem: 2 });

    expect(analysis.currentRoutes).toHaveLength(2);
    expect(new Set(analysis.currentRoutes.map(route => route.id)).size).toBe(2);
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/route budget of 2 exhausted.*Many routes/i));
  });
});

describe('recursive station route bounds', () => {
  it('does not report budget exhaustion when exact station routes only fill the cap', () => {
    const twoStations: ExactEntityLocationLookup = (name, kind) => ({
      name,
      kind,
      locations: [{ cx: 1, cy: 2 }, { cx: 2, cy: 3 }],
    });
    const analysis = resolveItemRequirement(requirement('Two stations'), recursiveFixture({
      current: ['1,2', '2,3'],
      recipes: [recipe('Two stations')],
      locations: twoStations,
    }), { maxRoutesPerItem: 2 });

    expect(analysis.currentRoutes).toHaveLength(2);
    expect(analysis.dataNotes).toEqual([]);
  });
});

describe('recursive recipe boundary composition', () => {
  it('rounds recipe batches up before multiplying consumed inputs', () => {
    const batched = recipe('Batched output', {
      outputQuantity: 3,
      ingredients: [{ item: item('Input'), quantity: 2 }],
      tools: [{ item: item('Reusable tool'), consumed: false }],
    });
    const analysis = resolveItemRequirement(requirement('Batched output', 5), recursiveFixture({
      records: [itemSource('Input'), itemSource('Reusable tool')],
      recipes: [batched],
    }));

    expect(analysis.currentRoutes[0].outputQuantity).toBe(6);
    expect(analysis.currentRoutes[0].steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Obtain Input', quantity: 4, consumed: true }),
      expect.objectContaining({ label: 'Obtain Reusable tool', quantity: 1, consumed: false }),
    ]));
  });

  it('combines recipe, station, ingredient, and tool blockers without duplication', () => {
    const gated = recipe('Gated output', {
      ingredients: [{ item: item('Gated ingredient'), quantity: 1 }],
      tools: [{ item: item('Gated tool'), consumed: false }],
      stations: [{ entityKind: 'object', names: ['Gated station'] }],
      gates: [{ type: 'SKILL', skill: 'Mining', level: 15, label: 'Mining level 15' }],
    });
    const analysis = resolveItemRequirement(requirement('Gated output'), recursiveFixture({
      records: [
        itemSource('Gated ingredient', {
          rawRequirements: [{ raw: 'Crafting level 20', origin: 'ENTITY' }],
        }),
        itemSource('Gated tool', {
          rawRequirements: [{ raw: 'Dragon Slayer I Complete the quest', origin: 'ENTITY' }],
        }),
      ],
      recipes: [gated],
      requirements: () => [
        { raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' },
        { raw: 'Priest in Peril', origin: 'CHUNK_ENTRY' },
      ],
    }));

    expect(analysis.state).toBe('ROUTE_BLOCKED');
    expect(analysis.currentRoutes[0].blockers).toEqual([
      expect.objectContaining({ type: 'SKILL', skill: 'Mining', level: 15 }),
      expect.objectContaining({ type: 'QUEST', questId: 'Priest in Peril' }),
      expect.objectContaining({ type: 'SKILL', skill: 'Crafting', level: 20 }),
      expect.objectContaining({ type: 'QUEST', questId: 'Dragon Slayer I' }),
    ]);
    expect(analysis.currentRoutes[0].steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Use Gated station',
        sourceKind: 'RECIPE',
        blockers: [
          expect.objectContaining({ type: 'SKILL', skill: 'Mining', level: 15 }),
          expect.objectContaining({ type: 'QUEST', questId: 'Priest in Peril' }),
        ],
      }),
      expect.objectContaining({
        label: 'Gated ingredient source',
        sourceKind: 'SPAWN',
        blockers: [expect.objectContaining({ type: 'SKILL', skill: 'Crafting', level: 20 })],
      }),
      expect.objectContaining({
        label: 'Gated tool source',
        sourceKind: 'SPAWN',
        blockers: [expect.objectContaining({ type: 'QUEST', questId: 'Dragon Slayer I' })],
      }),
    ]));
    expect(analysis.currentRoutes[0]).toMatchObject({
      consumedIngredientCost: 1,
      skillUnlockCost: 2,
      skillLevelCost: 35,
    });
  });

  it('counts one repeated skill unlock at the maximum required level', () => {
    const repeatedSkill = recipe('Repeated skill output', {
      ingredients: [{ item: item('Repeated skill input'), quantity: 1 }],
      gates: [{ type: 'SKILL', skill: 'Mining', level: 15, label: 'Mining level 15' }],
    });
    const analysis = resolveItemRequirement(requirement('Repeated skill output'), recursiveFixture({
      records: [itemSource('Repeated skill input', {
        rawRequirements: [{ raw: 'Mining level 30', origin: 'ENTITY' }],
      })],
      recipes: [repeatedSkill],
    }));

    expect(analysis.currentRoutes[0]).toMatchObject({
      skillUnlockCost: 1,
      skillLevelCost: 30,
    });
  });
});

describe('recursive memoization context', () => {
  it('does not reuse a cycle-truncated analysis for a later independent sibling', () => {
    const root = recipe('Root item', {
      ingredients: [
        { item: item('Cycle source A'), quantity: 1 },
        { item: item('Cycle source B'), quantity: 1 },
      ],
    });
    const aRecipe = recipe('Cycle source A', {
      ingredients: [{ item: item('Cycle source B'), quantity: 1 }],
    });
    const bRecipe = recipe('Cycle source B', {
      ingredients: [{ item: item('Cycle source A'), quantity: 1 }],
    });
    const analysis = resolveItemRequirement(requirement('Root item'), recursiveFixture({
      records: [itemSource('Cycle source A')],
      recipes: [root, aRecipe, bRecipe],
    }));

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes).toContainEqual(expect.objectContaining({
      blockers: [],
      hasDataGap: false,
    }));
  });
});

describe('exact station-name OR provenance', () => {
  it('keeps collocated exact station names as separate access branches', () => {
    const collocatedNames: ExactEntityLocationLookup = (name, kind) => ({
      name,
      kind,
      locations: [{ cx: 1, cy: 2 }],
    });
    const analysis = resolveItemRequirement(requirement('Alias station output'), recursiveFixture({
      recipes: [recipe('Alias station output', {
        stations: [{ entityKind: 'object', names: ['Gated station', 'Open station'] }],
      })],
      locations: collocatedNames,
      requirements: name => name === 'Gated station'
        ? [{ raw: 'Priest in Peril Complete the quest', origin: 'ENTITY' }]
        : [],
    }));

    expect(analysis.state).toBe('OBTAINABLE_NOW');
    expect(analysis.currentRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        steps: [expect.objectContaining({ label: 'Use Gated station' })],
        blockers: [expect.objectContaining({ type: 'QUEST', questId: 'Priest in Peril' })],
      }),
      expect.objectContaining({
        steps: [expect.objectContaining({ label: 'Use Open station' })],
        blockers: [],
      }),
    ]));
  });
});

describe('fix round 1 traversal boundaries', () => {
  it('does not reuse a shallow memoized expansion at the maximum depth', () => {
    const target = recipe('Depth memo target');
    const wrapper = recipe('Depth memo wrapper', {
      ingredients: [{ item: item('Depth memo target'), quantity: 1 }],
    });
    const root = recipe('Depth memo root', {
      ingredients: [
        { item: item('Depth memo target'), quantity: 1 },
        { item: item('Depth memo wrapper'), quantity: 1 },
      ],
    });
    const analysis = resolveItemRequirement(requirement('Depth memo root'), recursiveFixture({
      recipes: [root, target, wrapper],
    }), { maxDepth: 2 });

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.dataNotes).toContainEqual(
      expect.stringMatching(/maximum recursive depth 2.*Depth memo target/i),
    );
    expect(analysis.currentRoutes).toContainEqual(expect.objectContaining({ hasDataGap: true }));
  });

  it('keeps an exact station route incomplete when station access evidence is absent', () => {
    const snapshot: DirectRouteResolutionSnapshot = {
      ...recursiveFixture({ recipes: [recipe('Unknown-access output')] }),
      stationRequirements: undefined,
    };
    const analysis = resolveItemRequirement(requirement('Unknown-access output'), snapshot);

    expect(analysis.state).toBe('DATA_INCOMPLETE');
    expect(analysis.currentRoutes).toContainEqual(expect.objectContaining({
      chunks: ['1,2'],
      blockers: [],
      hasDataGap: true,
    }));
    expect(analysis.dataNotes).toContainEqual(
      expect.stringMatching(/no station access evidence.*Unknown-access output station.*1,2/i),
    );
  });

  it('keeps traversal-boundary uncertainty above outside-only advisory evidence', () => {
    const analysis = resolveItemRequirement(requirement('Boundary item'), recursiveFixture({
      records: [itemSource('Boundary item', { cx: 8, cy: 9 })],
      recipes: [recipe('Boundary item')],
    }), { maxDepth: 0 });

    expect(analysis.currentRoutes).toEqual([]);
    expect(analysis.missingChunkRoutes).toContainEqual(expect.objectContaining({ chunks: ['8,9'] }));
    expect(analysis.dataNotes).toContainEqual(expect.stringMatching(/maximum recursive depth 0.*Boundary item/i));
    expect(analysis.state).toBe('DATA_INCOMPLETE');
  });
});
