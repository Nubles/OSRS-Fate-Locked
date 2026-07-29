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
      steps: {},
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
