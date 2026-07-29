import { describe, expect, it } from 'vitest';
import {
  analyzeCurrentRunBlockers,
  findUnavoidableBlockerFactIds,
  minimizeBlockerSets,
} from './blockers';
import {
  factId,
  type AcquisitionRule,
  type Coverage,
  type FactRef,
  type RequirementExpr,
} from './model';

const empty: RequirementExpr = { op: 'ALL', terms: [] };
const home = 'location:home';

describe('minimal blocker antichains', () => {
  it('removes blocker supersets', () => {
    expect(minimizeBlockerSets([
      new Set(['item:plank']),
      new Set(['item:plank', 'skill:construction:15']),
      new Set(['location:shop']),
    ])).toEqual([['item:plank'], ['location:shop']]);
  });

  it('sorts, freezes, and intersects every exact minimal set', () => {
    const sets = minimizeBlockerSets([
      new Set([' quest:b ', 'quest:a']),
      new Set(['quest:z']),
      new Set(['quest:c', 'quest:a']),
    ]);
    expect(sets).toEqual([
      ['quest:z'],
      ['quest:a', 'quest:b'],
      ['quest:a', 'quest:c'],
    ]);
    expect(findUnavoidableBlockerFactIds(sets)).toEqual([]);
    expect(findUnavoidableBlockerFactIds([
      ['quest:a', 'quest:b'],
      ['quest:a', 'quest:c'],
    ])).toEqual(['quest:a']);
    expect(Object.isFrozen(sets)).toBe(true);
    expect(Object.isFrozen(sets[0])).toBe(true);
  });
});

describe('analyzeCurrentRunBlockers', () => {
  it('combines nested failed ALL and ANY branches exactly', () => {
    const questA = fact('QUEST', 'A');
    const questB = fact('QUEST', 'B');
    const skill = fact('SKILL_LEVEL', 'Construction');
    const result = analyze(item('Goal'), [rule('goal', 'Goal', {
      requirements: {
        op: 'ALL',
        terms: [{
          op: 'ANY',
          terms: [
            { op: 'FACT', fact: questB },
            {
              op: 'ALL',
              terms: [
                { op: 'FACT', fact: questA },
                { op: 'FACT', fact: skill },
              ],
            },
          ],
        }],
      },
    })]);

    expect(result).toMatchObject({
      status: 'BLOCKED',
      complete: true,
      blockers: [
        {
          factIds: [questB.id],
          labels: [questB.label],
        },
        {
          factIds: [questA.id, skill.id],
          labels: [questA.label, skill.label],
        },
      ],
      unavoidableBlockerFactIds: [],
    });
  });

  it('combines ALL requirements and exposes ANY requirements as choices', () => {
    const quest = fact('QUEST', 'A');
    const skill = fact('SKILL_LEVEL', 'B');
    const terms = [
      { op: 'FACT' as const, fact: quest },
      { op: 'FACT' as const, fact: skill },
    ];
    expect(analyze(item('All goal'), [rule('all', 'All goal', {
      requirements: { op: 'ALL', terms },
    })])).toMatchObject({
      blockers: [{
        factIds: [quest.id, skill.id],
        labels: [quest.label, skill.label],
      }],
      unavoidableBlockerFactIds: [quest.id, skill.id],
    });
    expect(analyze(item('Any goal'), [rule('any', 'Any goal', {
      requirements: { op: 'ANY', terms },
    })])).toMatchObject({
      blockers: [
        { factIds: [quest.id], labels: [quest.label] },
        { factIds: [skill.id], labels: [skill.label] },
      ],
      unavoidableBlockerFactIds: [],
    });
  });

  it('exposes every currently reachable acquisition rule as an alternative method', () => {
    const quest = fact('QUEST', 'Dragon Slayer');
    const skill = fact('SKILL_LEVEL', 'Smithing');
    const result = analyze(item('Goal'), [
      rule('goal', 'Goal', {
        requirements: { op: 'FACT', fact: item('Part') },
      }),
      rule('part-from-quest', 'Part', {
        requirements: { op: 'FACT', fact: quest },
      }),
      rule('part-from-skill', 'Part', {
        requirements: { op: 'FACT', fact: skill },
      }),
    ]);
    expect(result.blockers).toEqual([
      { factIds: [quest.id], labels: [quest.label] },
      { factIds: [skill.id], labels: [skill.label] },
    ]);
    expect(result.unavoidableBlockerFactIds).toEqual([]);
  });

  it('never recommends an unreachable location or future chunk unlock', () => {
    const result = analyze(item('Goal'), [
      rule('remote-goal', 'Goal', { locationId: 'location:future-chunk' }),
    ]);
    expect(result).toMatchObject({
      status: 'IMPOSSIBLE',
      complete: true,
      blockers: [],
      unavoidableBlockerFactIds: [],
    });
    expect(JSON.stringify(result)).not.toContain('future-chunk');
  });

  it('does not classify a missing ITEM leaf alone as BLOCKED', () => {
    const missing = item('Missing component');
    const result = analyze(item('Goal'), [rule('goal', 'Goal', {
      requirements: { op: 'FACT', fact: missing },
    })]);
    expect(result).toMatchObject({
      status: 'IMPOSSIBLE',
      blockers: [{ factIds: [missing.id], labels: [missing.label] }],
    });
  });

  it.each([
    ['PARTIAL' as Coverage, true],
    ['UNKNOWN' as Coverage, true],
    ['VERIFIED' as Coverage, false],
  ])('returns UNKNOWN for coverage %s with routesComplete %s', (
    coverage,
    routesComplete,
  ) => {
    const result = analyze(item('Goal'), [], { coverage, routesComplete });
    expect(result).toMatchObject({
      status: 'UNKNOWN',
      complete: false,
      blockers: [],
      unavoidableBlockerFactIds: [],
    });
    expect(result.diagnostic).toBeTruthy();
  });

  it('returns UNKNOWN rather than inventing finite blockers for a cycle', () => {
    const result = analyze(item('A'), [
      rule('a-from-b', 'A', {
        requirements: { op: 'FACT', fact: item('B') },
      }),
      rule('b-from-a', 'B', {
        requirements: { op: 'FACT', fact: item('A') },
      }),
    ]);
    expect(result).toMatchObject({
      status: 'UNKNOWN',
      complete: false,
      blockers: [],
      unavoidableBlockerFactIds: [],
      diagnostic: 'RuneProof blocker analysis encountered a dependency cycle: item:a@1 -> item:b@1 -> item:a@1',
    });
  });

  it('fails closed without partial claims when either bound is exceeded', () => {
    const terms = Array.from({ length: 17 }, (_, index) => ({
      op: 'FACT' as const,
      fact: fact('QUEST', 'Quest ' + index.toString().padStart(2, '0')),
    }));
    expect(analyze(item('Goal'), [rule('goal', 'Goal', {
      requirements: { op: 'ALL', terms },
    })])).toMatchObject({
      status: 'UNKNOWN',
      blockers: [],
      unavoidableBlockerFactIds: [],
      diagnostic: 'RuneProof blocker analysis exceeded maxSetSize=16',
    });
    expect(analyze(item('Goal'), [rule('goal', 'Goal', {
      requirements: { op: 'FACT', fact: fact('QUEST', 'A') },
    })], {
      limits: { maxBlockerSets: 0, maxSetSize: 16 },
    })).toMatchObject({
      status: 'UNKNOWN',
      blockers: [],
      unavoidableBlockerFactIds: [],
      diagnostic: 'RuneProof blocker analysis exceeded maxBlockerSets=0',
    });
  });

  it('uses supplied facts as the satisfied identity through ALL and ANY', () => {
    const supplied = fact('QUEST', 'Already complete');
    const ignoredChoice = fact('QUEST', 'Ignored choice');
    const remaining = fact('QUEST', 'Still missing');
    const result = analyze(item('Goal'), [rule('goal', 'Goal', {
      requirements: {
        op: 'ALL',
        terms: [
          {
            op: 'ANY',
            terms: [
              { op: 'FACT', fact: supplied },
              { op: 'FACT', fact: ignoredChoice },
            ],
          },
          { op: 'FACT', fact: remaining },
        ],
      },
    })], {
      suppliedFactQuantities: new Map([[supplied.id, 1]]),
    });
    expect(result.blockers).toEqual([{
      factIds: [remaining.id],
      labels: [remaining.label],
    }]);
  });
  it('uses the correct identities for zero-term ALL and ANY', () => {
    const missing = fact('QUEST', 'Remaining');
    const withEmptyAll = analyze(item('All identity'), [rule(
      'all-identity',
      'All identity',
      {
        requirements: {
          op: 'ALL',
          terms: [
            { op: 'ALL', terms: [] },
            { op: 'FACT', fact: missing },
          ],
        },
      },
    )]);
    expect(withEmptyAll.blockers).toEqual([{
      factIds: [missing.id],
      labels: [missing.label],
    }]);
    expect(analyze(item('Empty any'), [rule('empty-any', 'Empty any', {
      requirements: { op: 'ANY', terms: [] },
    })])).toMatchObject({
      status: 'IMPOSSIBLE',
      blockers: [],
      unavoidableBlockerFactIds: [],
    });
  });
  it('enumerates the exact Cartesian blocker frontier and fails closed above its bound', () => {
    const expression = (branches: number) => ({
      op: 'ALL' as const,
      terms: Array.from({ length: branches }, (_, branch) => ({
        op: 'ANY' as const,
        terms: [0, 1].map(side => ({
          op: 'FACT' as const,
          fact: fact('QUEST', `Branch ${branch} side ${side}`),
        })),
      })),
    });

    const exact = analyze(item('Goal'), [rule('goal', 'Goal', {
      requirements: expression(7),
    })]);
    expect(exact).toMatchObject({
      status: 'BLOCKED',
      complete: true,
      unavoidableBlockerFactIds: [],
    });
    expect(exact.blockers).toHaveLength(128);
    expect(exact.blockers.every(blocker => blocker.factIds.length === 7))
      .toBe(true);

    expect(analyze(item('Goal'), [rule('goal', 'Goal', {
      requirements: expression(8),
    })])).toMatchObject({
      status: 'UNKNOWN',
      complete: false,
      blockers: [],
      unavoidableBlockerFactIds: [],
      diagnostic: 'RuneProof blocker analysis exceeded maxBlockerSets=128',
    });
  });
  it('is stable across rule order and deeply freezes output', () => {
    const rules = [
      rule('goal', 'Goal', {
        requirements: { op: 'FACT', fact: item('Part') },
      }),
      rule('z-part', 'Part', {
        requirements: { op: 'FACT', fact: fact('QUEST', 'Zed') },
      }),
      rule('a-part', 'Part', {
        requirements: { op: 'FACT', fact: fact('QUEST', 'Alpha') },
      }),
    ];
    const forward = analyze(item('Goal'), rules);
    const reverse = analyze(item('Goal'), [...rules].reverse());
    expect(JSON.stringify(forward)).toBe(JSON.stringify(reverse));
    expect(Object.isFrozen(forward)).toBe(true);
    expect(Object.isFrozen(forward.blockers[0].factIds)).toBe(true);
  });
});

function analyze(
  goal: FactRef,
  rules: readonly AcquisitionRule[],
  overrides: Partial<Parameters<typeof analyzeCurrentRunBlockers>[0]> = {},
) {
  return analyzeCurrentRunBlockers({
    goal,
    rules,
    suppliedFactQuantities: new Map(),
    reachableLocations: new Set([home]),
    coverage: 'VERIFIED',
    routesComplete: true,
    ...overrides,
  });
}

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
    sourceKind: 'PRODUCTION',
    sourceLabel: id,
    locationId: home,
    requirements: empty,
    repeatability: 'REPEATABLE',
    probability: null,
    coverage: 'VERIFIED',
    provenanceIds: ['test:' + id],
    ...overrides,
  };
}
