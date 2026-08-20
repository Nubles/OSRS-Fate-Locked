import { describe, expect, it } from 'vitest';
import { rankRoutes, routeRankTuple, travelCostForRoute } from './ranker';
import type { ItemRoute } from './model';

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
