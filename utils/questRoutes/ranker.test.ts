import { describe, expect, it } from 'vitest';
import { rankFallbackRoutes, rankRoutes, routeRankTuple, travelCostForRoute } from './ranker';
import type { ChunkKey, ItemRoute } from './model';

const route = (id: string, overrides: Partial<ItemRoute> = {}): ItemRoute => ({
  id,
  item: { key: 'test-item', name: 'Test item' },
  outputQuantity: 1,
  sourceKind: 'SPAWN',
  sourceLabel: id,
  chunks: [],
  steps: [],
  blockers: [],
  deterministic: true,
  recursiveCost: 0,
  consumedIngredientCost: 0,
  skillUnlockCost: 0,
  skillLevelCost: 0,
  travelCost: 0,
  hasDataGap: false,
  ...overrides,
});

const routeThrough = (
  id: string,
  chunks: readonly ChunkKey[],
  overrides: Partial<ItemRoute> = {},
): ItemRoute => route(id, {
  chunks: [...chunks],
  steps: chunks.map((chunk, index) => ({
    id: `${id}:step-${index + 1}`,
    label: id,
    chunk,
    gates: [],
    requiresChunkUnlock: false,
    hasDataGap: false,
  })),
  ...overrides,
});

const routeAt = (
  id: string,
  chunk: ChunkKey,
  overrides: Partial<ItemRoute> = {},
): ItemRoute => routeThrough(id, [chunk], overrides);

describe('route ranking', () => {
  it('applies the approved lexicographic priorities in order', () => {
    const ordered = rankRoutes([
      route('z-rng', { deterministic: false }),
      route('b-recursive', { recursiveCost: 2 }),
      route('a-recursive', { recursiveCost: 1 }),
      route('blocked', { blockers: [{ type: 'QUEST', questId: 'q', label: 'Quest' }] }),
      route('skill', { skillUnlockCost: 1 }),
      route('travel', { travelCost: 1 }),
      route('probability-low', { deterministic: false, probability: 0.1 }),
      route('probability-high', { deterministic: false, probability: 0.5 }),
      route('data-gap', { hasDataGap: true }),
      route('a-tie'),
    ]);

    expect(ordered.map(candidate => candidate.id)).toEqual([
      'a-tie', 'travel', 'skill', 'a-recursive', 'b-recursive',
      'probability-high', 'probability-low', 'z-rng', 'blocked', 'data-gap',
    ]);
  });

  it('uses route ID as the final stable tie-breaker', () => {
    expect(rankRoutes([route('route-z'), route('route-a')]).map(candidate => candidate.id))
      .toEqual(['route-a', 'route-z']);
    expect(routeRankTuple(route('route-a'))).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 'route-a']);
  });

  it('keeps a complete blocked witness ahead of incomplete evidence', () => {
    expect(rankRoutes([
      route('a-incomplete', {
        blockers: [{ type: 'UNRESOLVED', raw: 'Unknown access', label: 'Unknown access' }],
        hasDataGap: true,
      }),
      route('z-blocked', {
        blockers: [{ type: 'QUEST', questId: 'q', label: 'Quest' }],
      }),
    ]).map(candidate => candidate.id)).toEqual(['z-blocked', 'a-incomplete']);
  });

  it('ranks consumed quantities, skill unlocks, and required levels separately', () => {
    expect(rankRoutes([
      route('a-more-ingredients', { consumedIngredientCost: 10 } as Partial<ItemRoute>),
      route('z-fewer-ingredients', { consumedIngredientCost: 2 } as Partial<ItemRoute>),
    ]).map(candidate => candidate.id)).toEqual([
      'z-fewer-ingredients', 'a-more-ingredients',
    ]);
    expect(rankRoutes([
      route('a-more-skills', { skillUnlockCost: 2 } as Partial<ItemRoute>),
      route('z-fewer-skills', { skillUnlockCost: 1 } as Partial<ItemRoute>),
    ]).map(candidate => candidate.id)).toEqual(['z-fewer-skills', 'a-more-skills']);
    expect(rankRoutes([
      route('a-higher-level', { skillLevelCost: 30 } as Partial<ItemRoute>),
      route('z-lower-level', { skillLevelCost: 15 } as Partial<ItemRoute>),
    ]).map(candidate => candidate.id)).toEqual(['z-lower-level', 'a-higher-level']);
    expect(routeRankTuple(route('mixed-costs', {
      recursiveCost: 1,
      consumedIngredientCost: 2,
      skillUnlockCost: 3,
      skillLevelCost: 4,
      travelCost: 5,
    }))).toEqual([0, 0, 1, 2, 3, 4, 5, 1, 'mixed-costs']);
  });
});

describe('fallback route ranking', () => {
  const graph = {
    '12850': ['12851'],
    '12851': ['12850', '12852'],
    '12852': ['12851', '12853'],
    '12853': ['12852'],
  };

  it('prefers the route with the shorter journey from the prior action origin', () => {
    const farSpawn = routeAt('far-spawn', '50,53');
    const nearbySpawn = routeAt('nearby-spawn', '50,51');

    expect(rankFallbackRoutes([farSpawn, nearbySpawn], graph, { origin: '50,50' })[0].id)
      .toBe(nearbySpawn.id);
  });

  it('adds graph-evaluated internal travel to travel from the prior action origin', () => {
    const nearbyWithLongInternalTravel = routeThrough(
      'nearby-with-long-internal-travel',
      ['50,51', '50,53'],
    );
    const fartherDirectSpawn = routeAt('farther-direct-spawn', '50,52');

    expect(rankFallbackRoutes(
      [nearbyWithLongInternalTravel, fartherDirectSpawn],
      graph,
      { origin: '50,50' },
    )[0].id).toBe(fartherDirectSpawn.id);
  });

  it('uses the deterministic geometric fallback when the origin graph is unavailable', () => {
    const farSpawn = routeAt('a-far-spawn', '50,53');
    const nearbySpawn = routeAt('z-nearby-spawn', '50,51');

    expect(rankFallbackRoutes([farSpawn, nearbySpawn], undefined, { origin: '50,50' })[0].id)
      .toBe(nearbySpawn.id);
  });

  it('uses the deterministic geometric fallback when origin and route evidence are disconnected', () => {
    const farSpawn = routeAt('a-far-spawn', '50,53');
    const nearbySpawn = routeAt('z-nearby-spawn', '50,51');

    expect(rankFallbackRoutes([farSpawn, nearbySpawn], { '12850': [] }, { origin: '50,50' })[0].id)
      .toBe(nearbySpawn.id);
  });

  it('does not mutate source routes while computing fallback journeys', () => {
    const farSpawn = routeAt('far-spawn', '50,53');
    const nearbySpawn = routeAt('nearby-spawn', '50,51');
    const routes = [farSpawn, nearbySpawn];
    const before = JSON.stringify(routes);

    expect(rankFallbackRoutes(routes, graph, { origin: '50,50' }).map(route => route.id))
      .toEqual(['nearby-spawn', 'far-spawn']);
    expect(JSON.stringify(routes)).toBe(before);
  });

  it('keeps a deterministic non-combat source ahead of a nearby drop', () => {
    const nearbyDrop = routeAt('nearby-drop', '50,51', {
      sourceKind: 'DROP',
      deterministic: false,
      probability: 0.9,
    });
    const nearbyDeterministicGather = routeAt('nearby-deterministic-gather', '50,51', {
      sourceKind: 'GATHER',
    });

    expect(rankFallbackRoutes([nearbyDrop, nearbyDeterministicGather], graph, { origin: '50,50' })[0].id)
      .toBe(nearbyDeterministicGather.id);
  });

  it('keeps a chance non-combat source ahead of a nearby drop before probability', () => {
    const nearbyDrop = routeAt('nearby-drop', '50,51', {
      sourceKind: 'DROP',
      deterministic: false,
      probability: 0.9,
    });
    const nearbyChanceGather = routeAt('nearby-chance-gather', '50,51', {
      sourceKind: 'GATHER',
      deterministic: false,
      probability: 0.1,
    });

    expect(rankFallbackRoutes([nearbyDrop, nearbyChanceGather], graph, { origin: '50,50' })[0].id)
      .toBe(nearbyChanceGather.id);
  });
});

describe('travelCostForRoute', () => {
  it('sums shortest graph paths between consecutive distinct step chunks', () => {
    const result = travelCostForRoute(route('connected', {
      steps: [
        { id: 'a', label: 'A', chunk: '1,1', gates: [], requiresChunkUnlock: false, hasDataGap: false },
        { id: 'repeat', label: 'A again', chunk: '1,1', gates: [], requiresChunkUnlock: false, hasDataGap: false },
        { id: 'b', label: 'B', chunk: '1,3', gates: [], requiresChunkUnlock: false, hasDataGap: false },
      ],
    }), {
      '257': ['258'],
      '258': ['257', '259'],
      '259': ['258'],
    });

    expect(result).toEqual({ travelCost: 2, travelCostEstimated: false });
  });

  it('uses Manhattan distance and marks an estimate for disconnected pairs', () => {
    const result = travelCostForRoute(route('fallback', {
      steps: [
        { id: 'a', label: 'A', chunk: '1,1', gates: [], requiresChunkUnlock: false, hasDataGap: false },
        { id: 'b', label: 'B', chunk: '3,4', gates: [], requiresChunkUnlock: false, hasDataGap: false },
      ],
    }), { '257': [] });

    expect(result).toEqual({ travelCost: 5, travelCostEstimated: true });
  });
});
