import { describe, expect, it } from 'vitest';
import {
  assertRuneProofReport,
  assertRequirementExpr,
  factId,
  normalizeId,
  type RuneProofReport,
} from './model';

describe('RuneProof model', () => {
  it('builds stable normalized fact IDs', () => {
    expect(factId('ITEM', 'Oak plank')).toBe('item:oak-plank');
    expect(normalizeId('  Oak Plank!  ')).toBe('oak-plank');
  });

  it('rejects impossible reports without verified coverage', () => {
    const report = {
      goalId: 'item:oak-plank',
      status: 'IMPOSSIBLE',
      coverage: 'PARTIAL',
      routes: [],
      blockers: [],
    } as unknown as RuneProofReport;
    expect(() => assertRuneProofReport(report)).toThrow(
      'IMPOSSIBLE requires VERIFIED coverage',
    );
  });

  it('requires the first obtainable route to be deterministic', () => {
    expect(() => assertRuneProofReport({
      ...baseReport(),
      status: 'OBTAINABLE',
      routes: [rngRoute()],
    })).toThrow('OBTAINABLE requires a deterministic first route');
  });

  it('requires RNG obtainable reports to contain only RNG routes', () => {
    expect(() => assertRuneProofReport({
      ...baseReport(),
      status: 'OBTAINABLE_RNG',
      routes: [deterministicRoute()],
    })).toThrow('OBTAINABLE_RNG cannot include deterministic routes');
  });

  it('requires blocked reports to identify a blocker', () => {
    expect(() => assertRuneProofReport({
      ...baseReport(),
      status: 'BLOCKED',
    })).toThrow('BLOCKED requires at least one blocker');
  });

  it('requires impossible reports to complete route enumeration', () => {
    expect(() => assertRuneProofReport({
      ...baseReport(),
      status: 'IMPOSSIBLE',
      coverage: 'VERIFIED',
    })).toThrow('IMPOSSIBLE requires routesComplete: true');
  });

  it('does not let unknown reports claim unavoidable blockers', () => {
    expect(() => assertRuneProofReport({
      ...baseReport(),
      status: 'UNKNOWN',
      unavoidableBlockerFactIds: ['quest:dragon-slayer'],
    })).toThrow('UNKNOWN cannot claim unavoidable blocker facts');
  });

  it('rejects malformed requirement expressions', () => {
    expect(() => assertRequirementExpr({ op: 'NONE' } as never)).toThrow(
      'Invalid requirement expression',
    );
  });
});

function baseReport(): RuneProofReport {
  return {
    goalId: 'item:oak-plank',
    status: 'UNKNOWN',
    coverage: 'UNKNOWN',
    routes: [],
    blockers: [],
    unavoidableBlockerFactIds: [],
    routesComplete: false,
  };
}

function deterministicRoute() {
  return {
    id: 'route:oak-plank-shop',
    deterministic: true,
    prerequisiteCount: 0,
    recursiveIngredientCount: 0,
    travelDistance: 0,
    probability: null,
    witness: {
      rootFactId: 'item:oak-plank',
      steps: {
        root: {
          ruleId: 'rule:oak-plank-shop',
          proves: {
            id: 'item:oak-plank',
            kind: 'ITEM' as const,
            label: 'Oak plank',
          },
          chosenTerms: [],
          childStepIds: [],
        },
      },
      sourceVersion: 'test',
      runId: 'test-run',
      runRevision: 1,
      proofHash: 'test-hash',
    },
  };
}

function rngRoute() {
  return {
    ...deterministicRoute(),
    deterministic: false,
    probability: 0.5,
  };
}

describe('RuneProof structural validation', () => {
  it('accepts an obtainable route with replayable proof metadata', () => {
    expect(() => assertRuneProofReport(obtainableReport())).not.toThrow();
  });

  it('rejects a route without a replayable witness', () => {
    const route = { ...deterministicRoute(), witness: undefined } as never;
    expect(() => assertRuneProofReport(obtainableReport(route))).toThrow(
      'Invalid RuneProof route',
    );
  });

  it('rejects a witness with empty run metadata', () => {
    const route = deterministicRoute();
    route.witness.sourceVersion = '';
    expect(() => assertRuneProofReport(obtainableReport(route))).toThrow(
      'Invalid ProofWitness',
    );
  });

  it('rejects a route with an out-of-range probability', () => {
    const route = deterministicRoute();
    route.probability = 1.1;
    expect(() => assertRuneProofReport(obtainableReport(route))).toThrow(
      'Invalid RuneProof route',
    );
  });

  it('rejects malformed fact payloads', () => {
    expect(() => assertRequirementExpr({
      op: 'FACT',
      fact: {},
    } as never)).toThrow('Invalid FactRef');
  });

  it('rejects cyclic requirement expression graphs', () => {
    const expression = { op: 'ALL', terms: [] as unknown[] };
    expression.terms.push(expression);
    expect(() => assertRequirementExpr(expression as never)).toThrow(
      'Cyclic requirement expression',
    );
  });

  it('rejects witness steps that refer to missing children', () => {
    const route = deterministicRoute();
    route.witness.steps.root.childStepIds = ['missing'];
    expect(() => assertRuneProofReport(obtainableReport(route))).toThrow(
      'Missing witness child step',
    );
  });

  it('rejects cyclic witness step graphs', () => {
    const route = deterministicRoute();
    route.witness.steps.root.childStepIds = ['child'];
    const steps = route.witness.steps as Record<string, unknown>;
    steps.child = {
      ruleId: 'rule:child',
      proves: {
        id: 'item:nails',
        kind: 'ITEM',
        label: 'Nails',
      },
      chosenTerms: [],
      childStepIds: ['root'],
    };
    expect(() => assertRuneProofReport(obtainableReport(route))).toThrow(
      'Cyclic witness step',
    );
  });
});

function obtainableReport(route = deterministicRoute()): RuneProofReport {
  return {
    ...baseReport(),
    status: 'OBTAINABLE',
    coverage: 'VERIFIED',
    routes: [route],
    routesComplete: true,
  };
}
