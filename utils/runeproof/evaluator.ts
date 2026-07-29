import type { RuneProofRunSnapshot } from '../../types';
import {
  factId,
  type AcquisitionRule,
  type Coverage,
  type FactRef,
  type ProofRoute,
  type ProofWitness,
  type RequirementExpr,
  type RuneProofReport,
  type WitnessStep,
} from './model';
import { compareRoutes } from './ranking';

export interface EvaluationLimits {
  readonly maxIterations: number;
  readonly maxRoutes: number;
}

export interface ObtainabilityContext {
  readonly rules: readonly AcquisitionRule[];
  readonly snapshot: RuneProofRunSnapshot;
  readonly reachableLocations: ReadonlySet<string>;
  readonly distanceByLocation?: ReadonlyMap<string, number>;
  readonly sourceVersion: string;
  readonly coverage?: Coverage;
  readonly limits?: EvaluationLimits;
}

interface Demand {
  fact: FactRef;
  quantity: number;
}

interface InternalRoute extends ProofRoute {
  derivedFactIds: ReadonlySet<string>;
  coverage: Coverage;
  oneTimeUsage: ReadonlyMap<string, number>;
}

interface ExpressionSolution {
  chosenTerms: string[];
  children: InternalRoute[];
  factCount: number;
  ingredientCount: number;
}

interface EvaluationState {
  demands: Map<string, Demand>;
  routes: Map<string, InternalRoute[]>;
  routeIdentities: Set<string>;
  routeCount: number;
  cappedBy?: keyof EvaluationLimits;
}

const DEFAULT_LIMITS: EvaluationLimits = {
  maxIterations: 1_000,
  maxRoutes: 10_000,
};

const STOCHASTIC_SOURCE_KINDS = new Set<AcquisitionRule['sourceKind']>([
  'DROP',
  'PICKPOCKET',
  'CLUE',
]);

export function evaluateObtainability(
  goal: FactRef,
  context: ObtainabilityContext,
): RuneProofReport {
  const requiredGoal = demandFor(goal, goal.quantity ?? 1);
  const limits = context.limits ?? DEFAULT_LIMITS;
  const state: EvaluationState = {
    demands: new Map([[demandKey(requiredGoal), requiredGoal]]),
    routes: new Map(),
    routeIdentities: new Set(),
    routeCount: 0,
  };
  const rules = [...context.rules].sort((left, right) => compareText(left.id, right.id));
  const seedQuantities = snapshotSeedQuantities(context.snapshot, context.reachableLocations);
  const oneTimeCapacities = new Map(rules
    .filter(rule => rule.repeatability === 'ONE_TIME')
    .map(rule => [rule.id, rule.outputQuantity]));


  let changed = true;
  let iterations = 0;
  while (changed && !state.cappedBy) {
    if (iterations >= limits.maxIterations) {
      state.cappedBy = 'maxIterations';
      break;
    }
    iterations += 1;
    changed = false;

    for (const demand of [...state.demands.values()]
      .sort((left, right) => compareText(demandKey(left), demandKey(right)))) {
      if ((seedQuantities.get(demand.fact.id) ?? 0) >= demand.quantity) {
        changed = addRoute(
          state,
          seedRoute(demand, context),
          limits,
        ) || changed;
      }

      for (const rule of rules) {
        if (rule.output.id !== demand.fact.id
          || !context.reachableLocations.has(rule.locationId)) {
          continue;
        }
        const operations = operationsFor(rule, demand.quantity);
        if (operations === null) continue;

        changed = registerExpressionDemands(
          rule.requirements,
          operations,
          state.demands,
        ) || changed;
        const solutions = expressionSolutions(rule.requirements, operations, state.routes);
        for (const solution of solutions) {
          if (solution.children.some(child =>
            child.derivedFactIds.has(demand.fact.id))) {
            continue;
          }
          const route = ruleRoute(demand, rule, operations, solution, context);
          if (!oneTimeUsageFits(route.oneTimeUsage, oneTimeCapacities)) {
            continue;
          }
          changed = addRoute(state, route, limits) || changed;
          if (state.cappedBy) break;
        }
        if (state.cappedBy) break;
      }
      if (state.cappedBy) break;
    }
  }

  if (state.cappedBy) {
    return freezeReport({
      goalId: goal.id,
      status: 'UNKNOWN',
      coverage: 'UNKNOWN',
      routes: [],
      blockers: [],
      unavoidableBlockerFactIds: [],
      routesComplete: false,
      explanation: `RuneProof safety limit exceeded: ${state.cappedBy}=${
        limits[state.cappedBy]
      }`,
    });
  }

  const candidates = nonDominated(state.routes.get(demandKey(requiredGoal)) ?? [])
    .sort(compareRoutes);
  const coverage = combineCoverage(
    context.coverage ?? 'VERIFIED',
    combineAllCoverage(candidates.map(route => route.coverage)),
  );
  if (candidates.length > 0) {
    const routes = candidates.map(stripInternalRoute);
    return freezeReport({
      goalId: goal.id,
      status: routes.some(route => route.deterministic)
        ? 'OBTAINABLE' : 'OBTAINABLE_RNG',
      coverage,
      routes,
      blockers: [],
      unavoidableBlockerFactIds: [],
      routesComplete: true,
    });
  }

  if (hasUncertainty(requiredGoal, rules, context, new Set())) {
    return freezeReport({
      goalId: goal.id,
      status: 'UNKNOWN',
      coverage: 'UNKNOWN',
      routes: [],
      blockers: [],
      unavoidableBlockerFactIds: [],
      routesComplete: true,
      explanation: 'Available evidence cannot prove the requested quantity completely.',
    });
  }

  const blockers = collectRootBlockers(requiredGoal, rules, context, seedQuantities);
  if (blockers.length > 0) {
    return freezeReport({
      goalId: goal.id,
      status: 'BLOCKED',
      coverage,
      routes: [],
      blockers: [{
        factIds: blockers.map(blocker => blocker.id),
        labels: blockers.map(blocker => blocker.label),
      }],
      unavoidableBlockerFactIds: [],
      routesComplete: true,
    });
  }

  return freezeReport({
    goalId: goal.id,
    status: 'IMPOSSIBLE',
    coverage: 'VERIFIED',
    routes: [],
    blockers: [],
    unavoidableBlockerFactIds: [],
    routesComplete: true,
  });
}

function demandFor(fact: FactRef, quantity: number): Demand {
  return {
    fact: quantity === 1
      ? { ...fact, quantity: fact.quantity }
      : { ...fact, quantity },
    quantity,
  };
}

function demandKey(demand: Demand): string {
  return `${demand.fact.id}\u0000${demand.quantity}`;
}

function operationsFor(rule: AcquisitionRule, requiredQuantity: number): number | null {
  if ((rule.repeatability === 'ONE_TIME' || rule.repeatability === 'UNKNOWN')
    && requiredQuantity > rule.outputQuantity) {
    return null;
  }
  return Math.ceil(requiredQuantity / rule.outputQuantity);
}

function registerExpressionDemands(
  expression: RequirementExpr,
  operations: number,
  demands: Map<string, Demand>,
): boolean {
  if (expression.op !== 'FACT') {
    return expression.terms.reduce(
      (changed, term) =>
        registerExpressionDemands(term, operations, demands) || changed,
      false,
    );
  }
  const quantity = requiredFactQuantity(expression.fact, operations);
  const demand = demandFor(expression.fact, quantity);
  const key = demandKey(demand);
  if (demands.has(key)) return false;
  demands.set(key, demand);
  return true;
}

function requiredFactQuantity(fact: FactRef, operations: number): number {
  const quantity = fact.quantity ?? 1;
  return fact.kind === 'ITEM' ? quantity * operations : quantity;
}

function expressionSolutions(
  expression: RequirementExpr,
  operations: number,
  routes: ReadonlyMap<string, readonly InternalRoute[]>,
): ExpressionSolution[] {
  if (expression.op === 'FACT') {
    const quantity = requiredFactQuantity(expression.fact, operations);
    const demand = demandFor(expression.fact, quantity);
    return (routes.get(demandKey(demand)) ?? []).map(route => ({
      chosenTerms: [`${expression.fact.id}@${quantity}`],
      children: [route],
      factCount: 1,
      ingredientCount: expression.fact.kind === 'ITEM' ? quantity : 0,
    }));
  }
  if (expression.op === 'ANY') {
    return expression.terms.flatMap(term => expressionSolutions(term, operations, routes));
  }
  return expression.terms.reduce<ExpressionSolution[]>(
    (solutions, term) => {
      const termSolutions = expressionSolutions(term, operations, routes);
      return solutions.flatMap(left => termSolutions.map(right => ({
        chosenTerms: [...left.chosenTerms, ...right.chosenTerms],
        children: [...left.children, ...right.children],
        factCount: left.factCount + right.factCount,
        ingredientCount: left.ingredientCount + right.ingredientCount,
      })));
    },
    [{
      chosenTerms: [],
      children: [],
      factCount: 0,
      ingredientCount: 0,
    }],
  );
}

function seedRoute(demand: Demand, context: ObtainabilityContext): InternalRoute {
  const proves = factWithQuantity(demand.fact, demand.quantity);
  const ruleId = `seed:${demand.fact.id}`;
  const witness = witnessFor(
    demand.fact.id,
    {
      root: {
        ruleId,
        proves,
        chosenTerms: [],
        childStepIds: [],
      },
    },
    context,
  );
  return {
    id: `route:${demand.fact.id}:${witness.proofHash}`,
    deterministic: true,
    prerequisiteCount: 0,
    recursiveIngredientCount: 0,
    travelDistance: 0,
    probability: null,
    witness,
    derivedFactIds: new Set(),
    oneTimeUsage: new Map(),
    coverage: 'VERIFIED',
  };
}

function ruleRoute(
  demand: Demand,
  rule: AcquisitionRule,
  operations: number,
  solution: ExpressionSolution,
  context: ObtainabilityContext,
): InternalRoute {
  const steps: Record<string, WitnessStep> = {};
  const childStepIds: string[] = [];
  const derivedFactIds = new Set<string>([demand.fact.id]);
  const oneTimeUsage = new Map<string, number>();
  solution.children.forEach((child, childIndex) => {
    const prefix = `c${childIndex}:`;
    childStepIds.push(`${prefix}root`);
    for (const [stepId, step] of Object.entries(child.witness.steps)) {
      steps[`${prefix}${stepId}`] = {
        ...step,
        proves: { ...step.proves },
        chosenTerms: [...step.chosenTerms],
        childStepIds: step.childStepIds.map(id => `${prefix}${id}`),
      };
    }
    child.derivedFactIds.forEach(id => derivedFactIds.add(id));
    for (const [ruleId, quantity] of child.oneTimeUsage) {
      oneTimeUsage.set(ruleId, (oneTimeUsage.get(ruleId) ?? 0) + quantity);
    }
  });
  if (rule.repeatability === 'ONE_TIME') {
    oneTimeUsage.set(rule.id, (oneTimeUsage.get(rule.id) ?? 0) + demand.quantity);
  }
  steps.root = {
    ruleId: rule.id,
    proves: factWithQuantity(demand.fact, demand.quantity),
    chosenTerms: [...solution.chosenTerms],
    childStepIds,
  };
  const orderedSteps = Object.fromEntries(
    Object.entries(steps).sort(([left], [right]) =>
      left === 'root' ? -1 : right === 'root' ? 1 : compareText(left, right)),
  );
  const witness = witnessFor(demand.fact.id, orderedSteps, context);
  const stochastic = isStochastic(rule);
  const deterministic = !stochastic
    && solution.children.every(child => child.deterministic);
  const probability = routeProbability(rule, operations, solution.children, deterministic);

  return {
    id: `route:${demand.fact.id}:${witness.proofHash}`,
    deterministic,
    prerequisiteCount: solution.factCount
      + solution.children.reduce((sum, child) => sum + child.prerequisiteCount, 0),
    recursiveIngredientCount: solution.ingredientCount
      + solution.children.reduce(
        (sum, child) => sum + child.recursiveIngredientCount,
        0,
      ),
    travelDistance: (context.distanceByLocation?.get(rule.locationId) ?? 0)
      + solution.children.reduce((sum, child) => sum + child.travelDistance, 0),
    probability,
    witness,
    derivedFactIds,
    oneTimeUsage,
    coverage: combineCoverage(
      rule.coverage,
      combineAllCoverage(solution.children.map(child => child.coverage)),
    ),
  };
}

function oneTimeUsageFits(
  usage: ReadonlyMap<string, number>,
  capacities: ReadonlyMap<string, number>,
): boolean {
  return [...usage].every(([ruleId, quantity]) =>
    quantity <= (capacities.get(ruleId) ?? 0));
}

function isStochastic(rule: AcquisitionRule): boolean {
  return STOCHASTIC_SOURCE_KINDS.has(rule.sourceKind)
    || (rule.probability !== null && rule.probability < 1);
}

function routeProbability(
  rule: AcquisitionRule,
  operations: number,
  children: readonly InternalRoute[],
  deterministic: boolean,
): number | null {
  if (deterministic) return null;
  let probability = 1;
  if (isStochastic(rule)) {
    if (rule.probability === null) return null;
    probability *= rule.probability ** operations;
  }
  for (const child of children) {
    if (!child.deterministic) {
      if (child.probability === null) return null;
      probability *= child.probability;
    }
  }
  return probability;
}

function witnessFor(
  rootFactId: string,
  steps: Record<string, WitnessStep>,
  context: ObtainabilityContext,
): ProofWitness {
  const identity = stableJson({
    rootFactId,
    steps,
    sourceVersion: context.sourceVersion,
    runId: context.snapshot.runId,
    runRevision: context.snapshot.runRevision,
  });
  return {
    rootFactId,
    steps,
    sourceVersion: context.sourceVersion,
    runId: context.snapshot.runId,
    runRevision: context.snapshot.runRevision,
    proofHash: stableFingerprint(identity),
  };
}

function addRoute(
  state: EvaluationState,
  route: InternalRoute,
  limits: EvaluationLimits,
): boolean {
  const identity = `${route.witness.rootFactId}\u0000${route.witness.proofHash}`;
  if (state.routeIdentities.has(identity)) return false;
  if (state.routeCount >= limits.maxRoutes) {
    state.cappedBy = 'maxRoutes';
    return false;
  }
  const key = demandKey({
    fact: route.witness.steps.root.proves,
    quantity: route.witness.steps.root.proves.quantity ?? 1,
  });
  state.routes.set(key, [...(state.routes.get(key) ?? []), route]);
  state.routeIdentities.add(identity);
  state.routeCount += 1;
  return true;
}

function nonDominated(routes: readonly InternalRoute[]): InternalRoute[] {
  return routes.filter(candidate =>
    !routes.some(other => other !== candidate && dominates(other, candidate)));
}

function dominates(left: InternalRoute, right: InternalRoute): boolean {
  if (left.deterministic !== right.deterministic) {
    return left.deterministic;
  }
  const probabilityComparable = left.deterministic
    || (left.probability === null) === (right.probability === null);
  if (!probabilityComparable) return false;
  const probabilityAtLeast = left.deterministic
    || (left.probability ?? 0) >= (right.probability ?? 0);
  const noWorse = left.prerequisiteCount <= right.prerequisiteCount
    && left.recursiveIngredientCount <= right.recursiveIngredientCount
    && left.travelDistance <= right.travelDistance
    && probabilityAtLeast;
  const strictlyBetter = left.prerequisiteCount < right.prerequisiteCount
    || left.recursiveIngredientCount < right.recursiveIngredientCount
    || left.travelDistance < right.travelDistance
    || (!left.deterministic
      && (left.probability ?? 0) > (right.probability ?? 0));
  return noWorse && strictlyBetter;
}

function stripInternalRoute(route: InternalRoute): ProofRoute {
  return {
    id: route.id,
    deterministic: route.deterministic,
    prerequisiteCount: route.prerequisiteCount,
    recursiveIngredientCount: route.recursiveIngredientCount,
    travelDistance: route.travelDistance,
    probability: route.probability,
    witness: route.witness,
  };
}

function snapshotSeedQuantities(
  snapshot: RuneProofRunSnapshot,
  reachableLocations: ReadonlySet<string>,
): Map<string, number> {
  const seeds = new Map<string, number>();
  const add = (kind: FactRef['kind'], values: readonly string[]) => {
    values.forEach(value => {
      seeds.set(factId(kind, value), Number.POSITIVE_INFINITY);
      if (value.includes(':')) seeds.set(value, Number.POSITIVE_INFINITY);
    });
  };
  add('QUEST', snapshot.completedQuests);
  const unlocks = [
    snapshot.unlockedAreas,
    snapshot.unlockedChunks,
    snapshot.unlockedMobility,
    snapshot.unlockedArcana,
    snapshot.unlockedHousing,
    snapshot.unlockedMerchants,
    snapshot.unlockedMinigames,
    snapshot.unlockedBosses,
    snapshot.unlockedStorage,
    snapshot.unlockedGuilds,
    snapshot.unlockedFarming,
    snapshot.unlockedSlayer,
    snapshot.unlockedBanks,
    snapshot.completedDiaries,
    snapshot.completedCombatAchievements,
    snapshot.completedTasks,
  ];
  unlocks.forEach(values => add('UNLOCK', values));
  add('CAPABILITY', snapshot.unlockedMobility);
  add('CAPABILITY', snapshot.unlockedArcana);
  Object.entries(snapshot.currentLevels).forEach(([label, quantity]) => {
    seeds.set(factId('SKILL_LEVEL', label), quantity);
  });
  reachableLocations.forEach(location => {
    seeds.set(location, Number.POSITIVE_INFINITY);
    seeds.set(factId('LOCATION', location), Number.POSITIVE_INFINITY);
  });
  return seeds;
}

function hasUncertainty(
  demand: Demand,
  rules: readonly AcquisitionRule[],
  context: ObtainabilityContext,
  visiting: Set<string>,
): boolean {
  if ((context.coverage ?? 'VERIFIED') !== 'VERIFIED') return true;
  if (visiting.has(demand.fact.id)) return false;
  visiting.add(demand.fact.id);
  try {
    return rules.some(rule => {
      if (rule.output.id !== demand.fact.id) return false;
      if (rule.coverage !== 'VERIFIED') return true;
      if (rule.repeatability === 'UNKNOWN'
        && demand.quantity > rule.outputQuantity) return true;
      const operations = operationsFor(rule, demand.quantity);
      if (operations === null || !context.reachableLocations.has(rule.locationId)) {
        return false;
      }
      return expressionHasUncertainty(
        rule.requirements,
        operations,
        rules,
        context,
        visiting,
      );
    });
  } finally {
    visiting.delete(demand.fact.id);
  }
}

function expressionHasUncertainty(
  expression: RequirementExpr,
  operations: number,
  rules: readonly AcquisitionRule[],
  context: ObtainabilityContext,
  visiting: Set<string>,
): boolean {
  if (expression.op === 'FACT') {
    return hasUncertainty(
      demandFor(expression.fact, requiredFactQuantity(expression.fact, operations)),
      rules,
      context,
      visiting,
    );
  }
  return expression.terms.some(term =>
    expressionHasUncertainty(term, operations, rules, context, visiting));
}

function collectRootBlockers(
  goal: Demand,
  rules: readonly AcquisitionRule[],
  context: ObtainabilityContext,
  seeds: ReadonlyMap<string, number>,
): FactRef[] {
  const goalRules = rules.filter(rule =>
    rule.output.id === goal.fact.id && operationsFor(rule, goal.quantity) !== null);
  if (goalRules.length === 0) return [];
  const candidates: FactRef[][] = [];
  for (const rule of goalRules) {
    if (!context.reachableLocations.has(rule.locationId)) {
      candidates.push([{
        id: rule.locationId,
        kind: 'LOCATION',
        label: rule.locationId,
      }]);
      continue;
    }
    const operations = operationsFor(rule, goal.quantity)!;
    const blockers = blockersForExpression(
      rule.requirements,
      operations,
      rules,
      context,
      seeds,
      new Set([goal.fact.id]),
    );
    if (blockers) candidates.push(blockers);
  }
  return candidates
    .filter(candidate => candidate.length > 0)
    .sort((left, right) =>
      left.length - right.length
      || compareText(
        left.map(fact => fact.id).join('\u0000'),
        right.map(fact => fact.id).join('\u0000'),
      ))[0] ?? [];
}

function blockersForExpression(
  expression: RequirementExpr,
  operations: number,
  rules: readonly AcquisitionRule[],
  context: ObtainabilityContext,
  seeds: ReadonlyMap<string, number>,
  visiting: Set<string>,
): FactRef[] | null {
  if (expression.op === 'FACT') {
    const quantity = requiredFactQuantity(expression.fact, operations);
    if ((seeds.get(expression.fact.id) ?? 0) >= quantity) return [];
    if (visiting.has(expression.fact.id)) return null;
    const matching = rules.filter(rule =>
      rule.output.id === expression.fact.id
      && operationsFor(rule, quantity) !== null);
    if (matching.length === 0) return [factWithQuantity(expression.fact, quantity)];
    visiting.add(expression.fact.id);
    try {
      const candidates = matching.map(rule => {
        if (!context.reachableLocations.has(rule.locationId)) {
          return [{
            id: rule.locationId,
            kind: 'LOCATION' as const,
            label: rule.locationId,
          }];
        }
        return blockersForExpression(
          rule.requirements,
          operationsFor(rule, quantity)!,
          rules,
          context,
          seeds,
          visiting,
        );
      }).filter((value): value is FactRef[] => value !== null);
      return candidates.sort((left, right) => left.length - right.length)[0] ?? null;
    } finally {
      visiting.delete(expression.fact.id);
    }
  }
  const children = expression.terms.map(term =>
    blockersForExpression(term, operations, rules, context, seeds, visiting));
  if (expression.op === 'ANY') {
    return children
      .filter((value): value is FactRef[] => value !== null)
      .sort((left, right) => left.length - right.length)[0] ?? null;
  }
  if (children.some(child => child === null)) return null;
  const unique = new Map<string, FactRef>();
  (children as FactRef[][]).flat().forEach(fact => unique.set(fact.id, fact));
  return [...unique.values()].sort((left, right) => compareText(left.id, right.id));
}

function factWithQuantity(fact: FactRef, quantity: number): FactRef {
  if (quantity === 1 && fact.quantity === undefined) return { ...fact };
  return { ...fact, quantity };
}

function combineAllCoverage(values: readonly Coverage[]): Coverage {
  return values.reduce(combineCoverage, 'VERIFIED');
}

function combineCoverage(left: Coverage, right: Coverage): Coverage {
  if (left === 'UNKNOWN' || right === 'UNKNOWN') return 'UNKNOWN';
  if (left === 'PARTIAL' || right === 'PARTIAL') return 'PARTIAL';
  return 'VERIFIED';
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function freezeReport(report: RuneProofReport): RuneProofReport {
  return deepFreeze(report);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(child => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
}
