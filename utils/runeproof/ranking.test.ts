import { describe, expect, it } from 'vitest';
import type { ProofRoute } from './model';
import { compareRoutes, groupEquivalentRoutes } from './ranking';

describe('compareRoutes', () => {
  it('uses the proof-grade route ordering exactly', () => {
    const routes = [
      route('rng-unknown', { deterministic: false, probability: null }),
      route('rng-known-low', { deterministic: false, probability: 0.1 }),
      route('rng-known-high', { deterministic: false, probability: 0.5 }),
      route('travel', { travelDistance: 2 }),
      route('ingredients', { recursiveIngredientCount: 1 }),
      route('prerequisites', { prerequisiteCount: 1 }),
      route('best-b'),
      route('best-a'),
    ];

    expect(routes.sort(compareRoutes).map(candidate => candidate.id)).toEqual([
      'best-a',
      'best-b',
      'travel',
      'ingredients',
      'prerequisites',
      'rng-known-high',
      'rng-known-low',
      'rng-unknown',
    ]);
  });
});


  it('groups equivalent display metrics without discarding witness identities', () => {
    const first = route('first');
    const second = route('second');
    const farther = route('farther', { travelDistance: 1 });

    const groups = groupEquivalentRoutes([farther, second, first]);

    expect(groups).toHaveLength(2);
    expect(groups[0].routes.map(candidate => candidate.witness.proofHash))
      .toEqual(['first', 'second']);
    expect(groups[1].routes.map(candidate => candidate.id)).toEqual(['farther']);
    expect(Object.isFrozen(groups[0].routes)).toBe(true);
  });
  it('deeply snapshots and freezes grouped routes independently of caller data', () => {
    const source = route('source');
    const groups = groupEquivalentRoutes([source]);
    const grouped = groups[0].routes[0];

    source.witness.rootFactId = 'item:mutated';
    source.witness.steps.root.proves.label = 'Mutated';
    source.witness.steps.root.chosenTerms.push('item:mutated@1');
    source.witness.steps.root.childStepIds.push('mutated');
    source.witness.steps.injected = {
      ruleId: 'injected',
      proves: { id: 'item:goal', kind: 'ITEM', label: 'Injected' },
      chosenTerms: [],
      childStepIds: [],
    };

    expect(grouped.witness).toMatchObject({
      rootFactId: 'item:goal',
      steps: { root: {
        proves: { label: 'Goal' },
        chosenTerms: [],
        childStepIds: [],
      } },
    });
    expect(grouped.witness.steps).not.toHaveProperty('injected');
    expect([
      groups, groups[0], groups[0].routes, grouped, grouped.witness,
      grouped.witness.steps, grouped.witness.steps.root,
      grouped.witness.steps.root.proves,
      grouped.witness.steps.root.chosenTerms,
      grouped.witness.steps.root.childStepIds,
    ].every(Object.isFrozen)).toBe(true);
  });

function route(
  id: string,
  overrides: Partial<ProofRoute> = {},
): ProofRoute {
  return {
    id,
    deterministic: true,
    prerequisiteCount: 0,
    recursiveIngredientCount: 0,
    travelDistance: 0,
    probability: null,
    witness: {
      rootFactId: 'item:goal',
      steps: {
        root: {
          ruleId: id,
          proves: { id: 'item:goal', kind: 'ITEM', label: 'Goal' },
          chosenTerms: [],
          childStepIds: [],
        },
      },
      sourceVersion: 'test',
      runId: 'run',
      runRevision: 1,
      proofHash: id,
    },
    ...overrides,
  };
}
