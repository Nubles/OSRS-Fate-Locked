import { describe, expect, it } from 'vitest';
import type { RuneProofRunSnapshot } from '../../types';
import {
  evaluateObtainability,
  type ObtainabilityContext,
} from './evaluator';
import {
  factId,
  type AcquisitionRule,
  type FactRef,
  type RequirementExpr,
} from './model';

const empty: RequirementExpr = { op: 'ALL', terms: [] };
const home = 'location:home';

describe('evaluateObtainability', () => {
  it('proves a direct deterministic source at a reachable exact location', () => {
    const result = evaluateObtainability(item('Pot'), context([
      rule('pot-shop', 'Pot'),
    ]));

    expect(result).toMatchObject({
      status: 'OBTAINABLE',
      routesComplete: true,
      blockers: [],
      unavoidableBlockerFactIds: [],
    });
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]).toMatchObject({
      deterministic: true,
      probability: null,
      witness: {
        rootFactId: factId('ITEM', 'Pot'),
        sourceVersion: 'source-v1',
        runId: 'run-1',
        runRevision: 4,
      },
    });
  });

  it('requires every ALL term and accepts each independently provable ANY term', () => {
    const quest = fact('QUEST', 'Cook\'s Assistant');
    const key = item('Kitchen key');
    const missing = item('Missing token');
    const output = item('Cake');
    const rules = [
      rule('key', 'Kitchen key'),
      rule('cake', 'Cake', {
        requirements: {
          op: 'ALL',
          terms: [
            { op: 'FACT', fact: quest },
            {
              op: 'ANY',
              terms: [
                { op: 'FACT', fact: missing },
                { op: 'FACT', fact: key },
              ],
            },
          ],
        },
      }),
    ];

    const result = evaluateObtainability(output, context(rules, {
      snapshot: snapshot({ completedQuests: [quest.label] }),
    }));

    expect(result.status).toBe('OBTAINABLE');
    expect(Object.values(result.routes[0].witness.steps)
      .map(step => step.ruleId)).toEqual(expect.arrayContaining([
        'seed:quest:cook-s-assistant',
        'key',
        'cake',
      ]));
  });

  it('uses ceil(required/output) and multiplies recursive ingredient quantities', () => {
    const result = evaluateObtainability(
      { ...item('Arrow'), quantity: 7 },
      context([
        rule('feather', 'Feather', { outputQuantity: 4 }),
        rule('arrows', 'Arrow', {
          outputQuantity: 3,
          requirements: {
            op: 'FACT',
            fact: { ...item('Feather'), quantity: 2 },
          },
        }),
      ]),
    );

    expect(result.status).toBe('OBTAINABLE');
    const root = result.routes[0].witness.steps.root;
    expect(root.ruleId).toBe('arrows');
    expect(root.chosenTerms).toEqual(['item:feather@6']);
    expect(Object.values(result.routes[0].witness.steps)).toContainEqual(
      expect.objectContaining({
        ruleId: 'feather',
        proves: expect.objectContaining({ quantity: 6 }),
      }),
    );
  });

  it('proves recursively obtainable ingredients through the monotone fixed point', () => {
    const result = evaluateObtainability(item('Pie'), context([
      rule('grain', 'Grain'),
      rule('flour', 'Flour', {
        requirements: { op: 'FACT', fact: item('Grain') },
      }),
      rule('pie', 'Pie', {
        requirements: { op: 'FACT', fact: item('Flour') },
      }),
    ].reverse()));

    expect(result.status).toBe('OBTAINABLE');
    expect(Object.values(result.routes[0].witness.steps)
      .map(step => step.ruleId)).toEqual(expect.arrayContaining([
        'grain', 'flour', 'pie',
      ]));
  });

  it('does not overclaim ONE_TIME or UNKNOWN reward quantities', () => {
    const oneTime = rule('reward', 'Token', {
      outputQuantity: 2,
      repeatability: 'ONE_TIME',
    });
    const unknown = rule('unknown-reward', 'Mystery token', {
      outputQuantity: 2,
      repeatability: 'UNKNOWN',
      coverage: 'PARTIAL',
    });

    expect(evaluateObtainability(
      { ...item('Token'), quantity: 2 },
      context([oneTime]),
    ).status).toBe('OBTAINABLE');
    expect(evaluateObtainability(
      { ...item('Token'), quantity: 3 },
      context([oneTime]),
    ).status).toBe('IMPOSSIBLE');
    expect(evaluateObtainability(
      { ...item('Mystery token'), quantity: 3 },
      context([unknown]),
    )).toMatchObject({
      status: 'UNKNOWN',
      routesComplete: false,
      unavoidableBlockerFactIds: [],
    });
  });

  it('does not reuse one ONE_TIME reward across sibling ALL terms', () => {
    const result = evaluateObtainability(item('Goal'), context([
      rule('one-token', 'Token', {
        outputQuantity: 1,
        repeatability: 'ONE_TIME',
      }),
      rule('goal', 'Goal', {
        requirements: {
          op: 'ALL',
          terms: [
            { op: 'FACT', fact: item('Token') },
            { op: 'FACT', fact: item('Token') },
          ],
        },
      }),
    ]));

    expect(result.status).toBe('IMPOSSIBLE');
    expect(result.routes).toEqual([]);
  });

  it('does not reuse one ONE_TIME reward through separate recursive paths', () => {
    const result = evaluateObtainability(item('Goal'), context([
      rule('one-token', 'Token', {
        outputQuantity: 1,
        repeatability: 'ONE_TIME',
      }),
      rule('left', 'Left part', {
        requirements: { op: 'FACT', fact: item('Token') },
      }),
      rule('right', 'Right part', {
        requirements: { op: 'FACT', fact: item('Token') },
      }),
      rule('goal', 'Goal', {
        requirements: {
          op: 'ALL',
          terms: [
            { op: 'FACT', fact: item('Left part') },
            { op: 'FACT', fact: item('Right part') },
          ],
        },
      }),
    ]));

    expect(result.status).toBe('IMPOSSIBLE');
    expect(result.routes).toEqual([]);
  });

  it('uses RNG only as fallback and retains known and unknown stochastic witnesses', () => {
    const rngRules = [
      rule('unknown-drop', 'Gem', {
        sourceKind: 'DROP',
        probability: null,
      }),
      rule('known-drop', 'Gem', {
        sourceKind: 'DROP',
        probability: 0.25,
      }),
    ];
    const rng = evaluateObtainability(item('Gem'), context(rngRules));

    expect(rng.status).toBe('OBTAINABLE_RNG');
    expect(rng.routes.map(route => [route.witness.steps.root.ruleId, route.probability]))
      .toEqual([
        ['known-drop', 0.25],
        ['unknown-drop', null],
      ]);

    const withDeterministic = evaluateObtainability(item('Gem'), context([
      ...rngRules,
      rule('floor-spawn', 'Gem', { sourceKind: 'SPAWN' }),
    ]));
    expect(withDeterministic.status).toBe('OBTAINABLE');
    expect(withDeterministic.routes.every(route => route.deterministic)).toBe(true);
  });

  it('does not bootstrap or invent finite blockers for an unsupported cycle', () => {
    const result = evaluateObtainability(item('A'), context([
      rule('a-from-b', 'A', {
        requirements: { op: 'FACT', fact: item('B') },
      }),
      rule('b-from-a', 'B', {
        requirements: { op: 'FACT', fact: item('A') },
      }),
    ]));

    expect(result.status).toBe('UNKNOWN');
    expect(result.routes).toEqual([]);
    expect(result.routesComplete).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(result.unavoidableBlockerFactIds).toEqual([]);
    expect(result.explanation).toContain('dependency cycle');
  });

  it('allows a cycle when one member is independently provable', () => {
    const result = evaluateObtainability(item('A'), context([
      rule('a-from-b', 'A', {
        requirements: { op: 'FACT', fact: item('B') },
      }),
      rule('b-from-a', 'B', {
        requirements: { op: 'FACT', fact: item('A') },
      }),
      rule('b-direct', 'B'),
    ]));

    expect(result.status).toBe('OBTAINABLE');
    expect(Object.values(result.routes[0].witness.steps)
      .map(step => step.ruleId)).toEqual(expect.arrayContaining([
        'a-from-b', 'b-direct',
      ]));
  });

  it('retains every equivalent witness identity but removes dominated families', () => {
    const result = evaluateObtainability(item('Pot'), context([
      rule('z-shop', 'Pot'),
      rule('a-shop', 'Pot'),
      rule('far-shop', 'Pot', { locationId: 'location:far' }),
    ], {
      reachableLocations: new Set([home, 'location:far']),
      distanceByLocation: new Map([[home, 0], ['location:far', 2]]),
    }));

    expect(result.routes.map(route => route.witness.steps.root.ruleId))
      .toEqual(expect.arrayContaining(['a-shop', 'z-shop']));
    expect(result.routes).toHaveLength(2);
  });

  it('returns an explicit UNKNOWN diagnostic when a safety cap is exceeded', () => {
    const result = evaluateObtainability(item('A'), context([
      rule('a', 'A'),
    ], { limits: { maxIterations: 0, maxRoutes: 100 } }));

    expect(result).toMatchObject({
      status: 'UNKNOWN',
      routesComplete: false,
      routes: [],
      unavoidableBlockerFactIds: [],
    });
    expect(result.explanation).toContain('maxIterations');
  });
  it('does not claim a definitive blocker from partial acquisition evidence', () => {
    const result = evaluateObtainability(item('Uncertain item'), context([
      rule('partial-source', 'Uncertain item', {
        coverage: 'PARTIAL',
        requirements: { op: 'FACT', fact: item('Unmapped input') },
      }),
    ]));

    expect(result).toMatchObject({
      status: 'UNKNOWN',
      coverage: 'UNKNOWN',
      blockers: [],
      unavoidableBlockerFactIds: [],
    });
  });
  it('replaces a selected ANY path with the exact blocker antichain', () => {
    const result = evaluateObtainability(item('Goal'), context([
      rule('goal', 'Goal', {
        requirements: {
          op: 'ANY',
          terms: [
            { op: 'FACT', fact: item('Missing A') },
            { op: 'FACT', fact: item('Missing B') },
          ],
        },
      }),
    ]));

    expect(result.status).toBe('IMPOSSIBLE');
    expect(result.blockers).toEqual([
      { factIds: ['item:missing-a'], labels: ['Missing A'] },
      { factIds: ['item:missing-b'], labels: ['Missing B'] },
    ]);
    expect(result.unavoidableBlockerFactIds).toEqual([]);
  });

  it('replaces a selected acquisition rule with the exact blocker antichain', () => {
    const result = evaluateObtainability(item('Goal'), context([
      rule('goal-from-a', 'Goal', {
        requirements: { op: 'FACT', fact: item('Missing A') },
      }),
      rule('goal-from-b', 'Goal', {
        requirements: { op: 'FACT', fact: item('Missing B') },
      }),
    ]));

    expect(result.status).toBe('IMPOSSIBLE');
    expect(result.blockers).toEqual([
      { factIds: ['item:missing-a'], labels: ['Missing A'] },
      { factIds: ['item:missing-b'], labels: ['Missing B'] },
    ]);
    expect(result.unavoidableBlockerFactIds).toEqual([]);
  });


  it('never exposes an unreachable location as a blocker or unlock suggestion', () => {
    const result = evaluateObtainability(item('Goal'), context([
      rule('remote-goal', 'Goal', { locationId: 'location:future-chunk' }),
    ]));
    expect(result).toMatchObject({
      status: 'IMPOSSIBLE',
      coverage: 'VERIFIED',
      routesComplete: true,
      blockers: [],
      unavoidableBlockerFactIds: [],
    });
    expect(JSON.stringify(result)).not.toContain('future-chunk');
  });

  it('does not classify a missing ITEM leaf alone as BLOCKED', () => {
    const result = evaluateObtainability(item('Goal'), context([
      rule('goal', 'Goal', {
        requirements: { op: 'FACT', fact: item('Missing part') },
      }),
    ]));
    expect(result).toMatchObject({
      status: 'IMPOSSIBLE',
      coverage: 'VERIFIED',
      routesComplete: true,
      blockers: [{
        factIds: ['item:missing-part'],
        labels: ['Missing part'],
      }],
      unavoidableBlockerFactIds: ['item:missing-part'],
    });
  });

  it('uses BLOCKED only for a reachable route gated by a current rule fact', () => {
    const result = evaluateObtainability(item('Goal'), context([
      rule('goal', 'Goal', {
        requirements: {
          op: 'FACT',
          fact: fact('QUEST', 'Dragon Slayer'),
        },
      }),
    ]));
    expect(result).toMatchObject({
      status: 'BLOCKED',
      coverage: 'VERIFIED',
      routesComplete: true,
      blockers: [{
        factIds: ['quest:dragon-slayer'],
        labels: ['Dragon Slayer'],
      }],
      unavoidableBlockerFactIds: ['quest:dragon-slayer'],
    });
  });
  it('is stable across rule order and deeply freezes defensive output', () => {
    const rules = [rule('z-shop', 'Pot'), rule('a-shop', 'Pot')];
    const forward = evaluateObtainability(item('Pot'), context(rules));
    const reverse = evaluateObtainability(item('Pot'), context([...rules].reverse()));

    expect(JSON.stringify(forward)).toBe(JSON.stringify(reverse));
    expect(Object.isFrozen(forward)).toBe(true);
    expect(Object.isFrozen(forward.routes)).toBe(true);
    expect(Object.isFrozen(forward.routes[0].witness.steps.root.proves)).toBe(true);
  });
});

function item(label: string): FactRef {
  return fact('ITEM', label);
}

function fact(kind: FactRef['kind'], label: string): FactRef {
  return { id: factId(kind, label), kind, label };
}

function rule(
  id: string,
  output: string,
  overrides: Partial<AcquisitionRule> = {},
): AcquisitionRule {
  return {
    id,
    output: item(output),
    outputQuantity: 1,
    sourceKind: 'SHOP',
    sourceLabel: id,
    locationId: home,
    requirements: empty,
    repeatability: 'REPEATABLE',
    probability: null,
    coverage: 'VERIFIED',
    provenanceIds: [`test:${id}`],
    ...overrides,
  };
}

function context(
  rules: readonly AcquisitionRule[],
  overrides: Partial<ObtainabilityContext> = {},
): ObtainabilityContext {
  return {
    rules,
    snapshot: snapshot(),
    reachableLocations: new Set([home]),
    distanceByLocation: new Map([[home, 0]]),
    sourceVersion: 'source-v1',
    coverage: 'VERIFIED',
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<RuneProofRunSnapshot> = {},
): RuneProofRunSnapshot {
  return {
    runId: 'run-1',
    runRevision: 4,
    gameModeId: 'chunked',
    equipmentTiers: {},
    skillCaps: {},
    currentLevels: {},
    unlockedAreas: [],
    unlockedChunks: [],
    unlockedMobility: [],
    unlockedArcana: [],
    unlockedHousing: [],
    unlockedMerchants: [],
    unlockedMinigames: [],
    unlockedBosses: [],
    unlockedStorage: [],
    unlockedGuilds: [],
    unlockedFarming: [],
    unlockedSlayer: [],
    unlockedBanks: [],
    completedQuests: [],
    completedDiaries: [],
    completedCombatAchievements: [],
    completedTasks: [],
    collectionLog: {},
    ...overrides,
  };
}
