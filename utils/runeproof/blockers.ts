import {
  type AcquisitionRule,
  type Coverage,
  type FactRef,
  type MinimalBlocker,
  type RequirementExpr,
} from './model';

export interface BlockerLimits {
  readonly maxBlockerSets: number;
  readonly maxSetSize: number;
}

export interface CurrentRunBlockerInput {
  readonly goal: FactRef;
  readonly rules: readonly AcquisitionRule[];
  readonly suppliedFactQuantities: ReadonlyMap<string, number>;
  readonly reachableLocations: ReadonlySet<string>;
  readonly coverage: Coverage;
  readonly routesComplete: boolean;
  readonly limits?: BlockerLimits;
}

export interface CurrentRunBlockerResult {
  readonly status: 'BLOCKED' | 'IMPOSSIBLE' | 'UNKNOWN';
  readonly blockers: MinimalBlocker[];
  readonly unavoidableBlockerFactIds: string[];
  readonly complete: boolean;
  readonly diagnostic?: string;
}

type BlockerSet = ReadonlySet<string>;
type BlockerAlternatives = readonly BlockerSet[];

const DEFAULT_LIMITS: BlockerLimits = {
  maxBlockerSets: 128,
  maxSetSize: 16,
};

const CURRENT_ROUTE_GATE_KINDS = new Set<FactRef['kind']>([
  'SKILL_LEVEL',
  'QUEST',
  'UNLOCK',
  'CAPABILITY',
]);

class IncompleteBlockerAnalysis extends Error {}

export function minimizeBlockerSets(
  values: readonly ReadonlySet<string>[],
): string[][] {
  const unique = new Map<string, string[]>();
  values.forEach(value => {
    const normalized = [...new Set([...value]
      .map(id => id.trim())
      .filter(id => id.length > 0))]
      .sort(compareText);
    unique.set(normalized.join('\u0000'), normalized);
  });

  const candidates = [...unique.values()];
  const minimal = candidates.filter(candidate =>
    !candidates.some(other =>
      other.length < candidate.length
      && other.every(id => candidate.includes(id))));
  minimal.sort(compareBlockerArrays);
  return deepFreeze(minimal.map(set => [...set]));
}

export function findUnavoidableBlockerFactIds(
  blockerSets: readonly (readonly string[])[],
): string[] {
  if (blockerSets.length === 0) return Object.freeze([]) as string[];
  const intersection = blockerSets[0].filter(id =>
    blockerSets.every(set => set.includes(id)));
  return Object.freeze([...new Set(intersection)].sort(compareText)) as string[];
}

export function analyzeCurrentRunBlockers(
  input: CurrentRunBlockerInput,
): CurrentRunBlockerResult {
  if (input.coverage !== 'VERIFIED') {
    return unknown(
      'RuneProof blocker analysis requires VERIFIED coverage; received '
        + input.coverage,
    );
  }
  if (!input.routesComplete) {
    return unknown('RuneProof blocker analysis requires complete route enumeration');
  }

  const limits = input.limits ?? DEFAULT_LIMITS;
  const labels = new Map<string, FactRef>();
  const reachableGateFactIds = new Set<string>();
  const rulesByOutput = indexRules(input.rules);

  const registerFact = (fact: FactRef): void => {
    const current = labels.get(fact.id);
    if (!current || compareText(fact.label, current.label) < 0) {
      labels.set(fact.id, fact);
    }
  };

  const normalizeBounded = (
    alternatives: readonly ReadonlySet<string>[],
  ): BlockerAlternatives => {
    if (alternatives.length > limits.maxBlockerSets) {
      throw new IncompleteBlockerAnalysis(
        'RuneProof blocker analysis exceeded maxBlockerSets='
          + limits.maxBlockerSets,
      );
    }
    alternatives.forEach(set => {
      if (set.size > limits.maxSetSize) {
        throw new IncompleteBlockerAnalysis(
          'RuneProof blocker analysis exceeded maxSetSize=' + limits.maxSetSize,
        );
      }
    });
    const minimal = minimizeBlockerSets(alternatives);
    if (minimal.length > limits.maxBlockerSets) {
      throw new IncompleteBlockerAnalysis(
        'RuneProof blocker analysis exceeded maxBlockerSets='
          + limits.maxBlockerSets,
      );
    }
    return minimal.map(ids => new Set(ids));
  };

  const merge = (
    left: BlockerAlternatives,
    right: BlockerAlternatives,
  ): BlockerAlternatives => {
    const combined: Set<string>[] = [];
    for (const leftSet of left) {
      for (const rightSet of right) {
        const union = new Set([...leftSet, ...rightSet]);
        if (union.size > limits.maxSetSize) {
          throw new IncompleteBlockerAnalysis(
            'RuneProof blocker analysis exceeded maxSetSize=' + limits.maxSetSize,
          );
        }
        combined.push(union);
        if (combined.length > limits.maxBlockerSets) {
          throw new IncompleteBlockerAnalysis(
            'RuneProof blocker analysis exceeded maxBlockerSets='
              + limits.maxBlockerSets,
          );
        }
      }
    }
    return normalizeBounded(combined);
  };

  const solveExpression = (
    expression: RequirementExpr,
    operations: number,
    path: readonly string[],
  ): BlockerAlternatives => {
    if (expression.op === 'FACT') {
      const quantity = requiredFactQuantity(expression.fact, operations);
      return solveFact(expression.fact, quantity, path, true);
    }
    return expression.terms.reduce<BlockerAlternatives>(
      (alternatives, term) =>
        merge(alternatives, solveExpression(term, operations, path)),
      [new Set()],
    );
  };

  const solveFact = (
    fact: FactRef,
    quantity: number,
    path: readonly string[],
    withinReachableRoute: boolean,
  ): BlockerAlternatives => {
    registerFact(fact);
    if ((input.suppliedFactQuantities.get(fact.id) ?? 0) >= quantity) {
      return normalizeBounded([new Set()]);
    }

    const demandId = fact.id + '@' + quantity;
    const cycleStart = path.indexOf(demandId);
    if (cycleStart >= 0) {
      throw new IncompleteBlockerAnalysis(
        'RuneProof blocker analysis encountered a dependency cycle: '
          + [...path.slice(cycleStart), demandId].join(' -> '),
      );
    }
    const nextPath = [...path, demandId];
    const matchingRules = rulesByOutput.get(fact.id) ?? [];

    for (const rule of matchingRules) {
      if (rule.coverage !== 'VERIFIED') {
        throw new IncompleteBlockerAnalysis(
          'RuneProof blocker analysis encountered '
            + rule.coverage
            + ' coverage at rule '
            + rule.id,
        );
      }
      if (rule.repeatability === 'UNKNOWN'
        && quantity > rule.outputQuantity) {
        throw new IncompleteBlockerAnalysis(
          'RuneProof blocker analysis encountered ambiguous repeatability at rule '
            + rule.id,
        );
      }
    }

    const usableCapacityRules = matchingRules.filter(rule =>
      rule.repeatability === 'REPEATABLE'
      || quantity <= rule.outputQuantity);
    if (usableCapacityRules.length === 0) {
      if (withinReachableRoute && CURRENT_ROUTE_GATE_KINDS.has(fact.kind)) {
        reachableGateFactIds.add(fact.id);
      }
      return normalizeBounded([new Set([fact.id])]);
    }

    let allRules: BlockerAlternatives = [new Set()];
    for (const rule of usableCapacityRules) {
      if (!input.reachableLocations.has(rule.locationId)) {
        allRules = merge(allRules, [new Set()]);
        continue;
      }
      const operations = Math.ceil(quantity / rule.outputQuantity);
      const ruleBlockers = solveExpression(rule.requirements, operations, nextPath);
      allRules = merge(allRules, ruleBlockers);
    }
    return normalizeBounded(allRules);
  };

  try {
    const alternatives = solveFact(
      input.goal,
      input.goal.quantity ?? 1,
      [],
      false,
    );
    const blockerSets = minimizeBlockerSets(alternatives)
      .filter(set => set.length > 0);
    if (blockerSets.length > limits.maxBlockerSets) {
      throw new IncompleteBlockerAnalysis(
        'RuneProof blocker analysis exceeded maxBlockerSets='
          + limits.maxBlockerSets,
      );
    }
    const blockers = blockerSets.map(factIds => ({
      factIds: [...factIds],
      labels: factIds.map(id => labels.get(id)?.label ?? id),
    }));
    const unavoidableBlockerFactIds =
      findUnavoidableBlockerFactIds(blockerSets);
    const blocked = blockerSets.some(set =>
      set.some(id => reachableGateFactIds.has(id)));
    return deepFreeze({
      status: blocked ? 'BLOCKED' : 'IMPOSSIBLE',
      blockers,
      unavoidableBlockerFactIds,
      complete: true,
    });
  } catch (error) {
    if (error instanceof IncompleteBlockerAnalysis) {
      return unknown(error.message);
    }
    throw error;
  }
}

function indexRules(
  rules: readonly AcquisitionRule[],
): ReadonlyMap<string, readonly AcquisitionRule[]> {
  const result = new Map<string, AcquisitionRule[]>();
  [...rules]
    .sort((left, right) => compareText(left.id, right.id))
    .forEach(rule => {
      result.set(rule.output.id, [...(result.get(rule.output.id) ?? []), rule]);
    });
  return result;
}

function requiredFactQuantity(fact: FactRef, operations: number): number {
  const quantity = fact.quantity ?? 1;
  return fact.kind === 'ITEM' ? quantity * operations : quantity;
}

function unknown(diagnostic: string): CurrentRunBlockerResult {
  return deepFreeze({
    status: 'UNKNOWN',
    blockers: [],
    unavoidableBlockerFactIds: [],
    complete: false,
    diagnostic,
  });
}

function compareBlockerArrays(
  left: readonly string[],
  right: readonly string[],
): number {
  return left.length - right.length
    || compareText(left.join('\u0000'), right.join('\u0000'));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
