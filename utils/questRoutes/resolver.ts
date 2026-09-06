import {
  recipesFor as reviewedRecipesFor,
  type ExactEntityHit,
  type ExactEntityLocationLookup,
  type RouteRecipe,
  type RouteStation,
} from '../../data/questRouteRecipes';
import type { UnlockState } from '../../types';
import {
  compileRawRequirements,
  evaluateRouteGates,
} from './accountRequirements';
import type { ConnectGraph } from '../../services/ChunkContentService';
import { indexDirectItemSources, type ChunkSourceSnapshot } from './chunkSourceIndex';
import {
  compareRouteRankTuples,
  prepareRouteRanker,
  routeRankTuple,
  type RouteRankTuple,
} from './ranker';
import {
  canonicalItemKey,
  type ChunkKey,
  type ExactItemSource,
  type ItemRef,
  type ItemSourceFamilyCoverage,
  type ItemRoute,
  type ItemRouteAnalysis,
  type ItemRouteState,
  type QuestItemRequirement,
  type RawRouteRequirement,
  type RouteGate,
  type RouteStep,
} from './model';

export type StationRequirementLookup = (
  name: string,
  kind: RouteStation['entityKind'],
  chunk: ChunkKey,
) => readonly RawRouteRequirement[];

export interface DirectRouteResolutionSnapshot extends ChunkSourceSnapshot {
  unlocks: UnlockState;
  recipesFor?(itemKey: string): readonly RouteRecipe[];
  entityLocations?: ExactEntityLocationLookup;
  entityLocationsForPhase?(
    name: string,
    kind: RouteStation['entityKind'],
    phase: ResolvePhase,
  ): ExactEntityHit | null;
  hasAdvisoryEntityLocations?(
    name: string,
    kind: RouteStation['entityKind'],
  ): boolean;
  stationRequirements?: StationRequirementLookup;
  connectGraph?: ConnectGraph;
  fingerprint?: string;
}

export interface ResolverOptions {
  maxDepth?: number;
  maxRoutesPerItem?: number;
  /** Optional lower test/diagnostic ceiling; cannot raise the production hard boundary. */
  maxExactRouteCombinations?: number;
  /** Optional lower test/diagnostic ceiling; cannot raise the production hard boundary. */
  maxRouteSearchWorkUnits?: number;
}

/** Exact complete combinations evaluated before a future data expansion fails closed. */
export const MAX_EXACT_ROUTE_COMBINATIONS = 200_000;
/** Hard per-requirement guard across source, candidate, combination, and ranking work. */
export const MAX_ROUTE_SEARCH_WORK_UNITS = 500_000;
/** Stable four-pilot workload ceiling used instead of a runner-sensitive timer. */
export const PILOT_ROUTE_SEARCH_WORK_UNIT_BUDGET = 30_000;

export const DEFAULT_RESOLVER_OPTIONS: Required<ResolverOptions> = {
  maxDepth: 12,
  maxRoutesPerItem: 50,
  maxExactRouteCombinations: MAX_EXACT_ROUTE_COMBINATIONS,
  maxRouteSearchWorkUnits: MAX_ROUTE_SEARCH_WORK_UNITS,
};

type ResolveKey = `${string}|${number}|${string}`;
export type ResolvePhase = 'current' | 'advisory';
type ResolveResultKey = `${ResolveKey}|${number}`;

interface ResolveContext {
  active: Set<string>;
  memo: Map<string, ItemRouteAnalysis>;
  currentConcreteResults: Map<ResolveResultKey, ItemRouteAnalysis>;
  currentRequirementResults: Map<string, ItemRouteAnalysis>;
  currentRequirementAdvisoryPotential: Map<string, boolean>;
  phase: ResolvePhase;
  maxDepth: number;
  maxRoutesPerItem: number;
  maxSearchRoutesPerItem: number;
  maxExactRouteCombinations: number;
  maxRouteSearchWorkUnits: number;
  remainingExactRouteCombinations: number;
  routeSearchWorkUnitsEvaluated: number;
  currentSearchIncompleteMayHideUsable: boolean;
  advisorySearchIncomplete: boolean;
  snapshotFingerprint: string;
}

type RouteSearchClass = 'current' | 'advisory';

const markSearchIncomplete = (
  context: ResolveContext,
  searchClass: RouteSearchClass,
): void => {
  if (searchClass === 'current') context.currentSearchIncompleteMayHideUsable = true;
  else context.advisorySearchIncomplete = true;
};

const hasRouteSearchWorkCapacity = (
  context: ResolveContext,
  units = 1,
): boolean => (
  context.routeSearchWorkUnitsEvaluated + units <= context.maxRouteSearchWorkUnits
);

const tryConsumeRouteSearchWork = (
  context: ResolveContext,
  searchClass: RouteSearchClass,
  markIncomplete = true,
): boolean => {
  if (!hasRouteSearchWorkCapacity(context)) {
    if (markIncomplete) markSearchIncomplete(context, searchClass);
    return false;
  }
  context.routeSearchWorkUnitsEvaluated += 1;
  return true;
};

const tryConsumeExactRouteCombination = (
  context: ResolveContext,
  searchClass: RouteSearchClass,
): boolean => {
  if (context.remainingExactRouteCombinations <= 0) {
    markSearchIncomplete(context, searchClass);
    return false;
  }
  context.remainingExactRouteCombinations -= 1;
  return true;
};

const tryReserveRouteMaterializationAndRanking = (
  context: ResolveContext,
  searchClass: RouteSearchClass,
): boolean => (
  tryConsumeRouteSearchWork(context, searchClass)
  && tryConsumeRouteSearchWork(context, searchClass)
);

interface DependencyPlan {
  item: ItemRef;
  alternatives?: ItemRef[];
  quantity: number;
  consumed: boolean;
}

interface DependencyChoice {
  dependency: DependencyPlan;
  route?: ItemRoute;
  analysisIncomplete: boolean;
}

const routeLimitAtDepth = (context: ResolveContext, depth: number): number => (
  depth === 0 ? context.maxRoutesPerItem : context.maxSearchRoutesPerItem
);

interface StationCandidate {
  id: string;
  label: string;
  chunk?: ChunkKey;
  gates: RouteGate[];
  blockers: RouteGate[];
  hasDataGap: boolean;
  dataNotes: string[];
}

interface StationCandidateSearch {
  candidates: StationCandidate[];
  hasAdvisoryCandidate: boolean;
}

interface RecipeExpansion {
  routes: ItemRoute[];
  dataNotes: string[];
  currentBudgetExceeded: boolean;
  advisoryBudgetExceeded: boolean;
  analysisIncomplete: boolean;
  searchIncompleteMayHideUsable: boolean;
  advisorySearchIncomplete: boolean;
  advisoryRoutePotential: boolean;
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const uniqueNotes = (notes: readonly string[]): string[] => unique(notes.filter(note => note.trim()));

const gateKey = (gate: RouteGate): string => {
  switch (gate.type) {
    case 'QUEST':
      return `QUEST:${gate.questId}`;
    case 'SKILL':
      return `SKILL:${gate.skill}:${gate.level}`;
    case 'UNLOCK':
      return `UNLOCK:${gate.category}:${gate.id}`;
    case 'UNRESOLVED':
      return `UNRESOLVED:${gate.raw}`;
  }
};

const uniqueGates = (gates: readonly RouteGate[]): RouteGate[] => {
  const seen = new Set<string>();
  return gates.filter((gate) => {
    const key = gateKey(gate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const routeRequirementCosts = (steps: readonly RouteStep[]) => {
  const requiredLevels = new Map<string, number>();
  let consumedIngredientCost = 0;
  for (const step of steps) {
    if (step.consumed) consumedIngredientCost += step.quantity ?? 0;
    for (const gate of step.gates) {
      if (gate.type !== 'SKILL') continue;
      requiredLevels.set(gate.skill, Math.max(requiredLevels.get(gate.skill) ?? 0, gate.level));
    }
  }
  return {
    consumedIngredientCost,
    skillUnlockCost: requiredLevels.size,
    skillLevelCost: [...requiredLevels.values()].reduce((sum, level) => sum + level, 0),
  };
};

interface LimitedRouteSet {
  currentRoutes: ItemRoute[];
  missingChunkRoutes: ItemRoute[];
  currentExceeded: boolean;
  advisoryExceeded: boolean;
}

const EMPTY_CONNECT_GRAPH: ConnectGraph = Object.freeze({});

interface RankedSearchCandidate {
  tuple: RouteRankTuple;
}

interface RankedSearchNode<Candidate extends RankedSearchCandidate> {
  candidate: Candidate;
  height: number;
  left?: RankedSearchNode<Candidate>;
  right?: RankedSearchNode<Candidate>;
}

class RankedCandidateRetainer<Candidate extends RankedSearchCandidate> {
  private root: RankedSearchNode<Candidate> | undefined;
  private retainedCount = 0;

  constructor(private readonly limit: number) {}

  get size(): number {
    return this.retainedCount;
  }

  retain(candidate: Candidate): void {
    if (this.retainedCount < this.limit) {
      this.root = this.insert(this.root, candidate);
      this.retainedCount += 1;
      return;
    }
    const worst = this.worst();
    if (!worst || compareRouteRankTuples(candidate.tuple, worst.tuple) >= 0) return;
    this.root = this.remove(this.root, worst);
    this.root = this.insert(this.root, candidate);
  }

  worst(): Candidate | undefined {
    let node = this.root;
    while (node?.right) node = node.right;
    return node?.candidate;
  }

  appendBestFirst<Result>(
    output: Result[],
    select: (candidate: Candidate) => Result,
  ): void {
    const stack: RankedSearchNode<Candidate>[] = [];
    let node = this.root;
    while (node || stack.length > 0) {
      while (node) {
        stack.push(node);
        node = node.left;
      }
      const next = stack.pop()!;
      output.push(select(next.candidate));
      node = next.right;
    }
  }

  private height(node: RankedSearchNode<Candidate> | undefined): number {
    return node?.height ?? 0;
  }

  private updateHeight(node: RankedSearchNode<Candidate>): void {
    node.height = Math.max(this.height(node.left), this.height(node.right)) + 1;
  }

  private rotateLeft(node: RankedSearchNode<Candidate>): RankedSearchNode<Candidate> {
    const right = node.right!;
    node.right = right.left;
    right.left = node;
    this.updateHeight(node);
    this.updateHeight(right);
    return right;
  }

  private rotateRight(node: RankedSearchNode<Candidate>): RankedSearchNode<Candidate> {
    const left = node.left!;
    node.left = left.right;
    left.right = node;
    this.updateHeight(node);
    this.updateHeight(left);
    return left;
  }

  private rebalance(node: RankedSearchNode<Candidate>): RankedSearchNode<Candidate> {
    this.updateHeight(node);
    const balance = this.height(node.left) - this.height(node.right);
    if (balance > 1) {
      if (this.height(node.left?.left) < this.height(node.left?.right)) {
        node.left = this.rotateLeft(node.left!);
      }
      return this.rotateRight(node);
    }
    if (balance < -1) {
      if (this.height(node.right?.right) < this.height(node.right?.left)) {
        node.right = this.rotateRight(node.right!);
      }
      return this.rotateLeft(node);
    }
    return node;
  }

  private insert(
    node: RankedSearchNode<Candidate> | undefined,
    candidate: Candidate,
  ): RankedSearchNode<Candidate> {
    if (!node) return { candidate, height: 1 };
    if (compareRouteRankTuples(candidate.tuple, node.candidate.tuple) < 0) {
      node.left = this.insert(node.left, candidate);
    } else {
      node.right = this.insert(node.right, candidate);
    }
    return this.rebalance(node);
  }

  private remove(
    node: RankedSearchNode<Candidate> | undefined,
    candidate: Candidate,
  ): RankedSearchNode<Candidate> | undefined {
    if (!node) return undefined;
    const order = compareRouteRankTuples(candidate.tuple, node.candidate.tuple);
    if (order < 0) {
      node.left = this.remove(node.left, candidate);
    } else if (order > 0) {
      node.right = this.remove(node.right, candidate);
    } else if (!node.left || !node.right) {
      return node.left ?? node.right;
    } else {
      let successor = node.right;
      while (successor.left) successor = successor.left;
      node.candidate = successor.candidate;
      node.right = this.remove(node.right, successor.candidate);
    }
    return this.rebalance(node);
  }
}

const limitRankedRoutes = (
  routes: () => Iterable<ItemRoute>,
  snapshot: Pick<DirectRouteResolutionSnapshot, 'unlockedChunks' | 'connectGraph'>,
  maxRoutes: number,
  context: ResolveContext,
  chargeRankingWork = true,
  rankingBoundaryMarksSearchIncomplete = true,
  searchClasses: readonly RouteSearchClass[] = ['current', 'advisory'],
): LimitedRouteSet => {
  interface RankedRouteCandidate {
    route: ItemRoute;
    tuple: RouteRankTuple;
  }
  const isCurrent = (route: ItemRoute): boolean => (
    route.chunks.every(chunk => snapshot.unlockedChunks.has(chunk))
  );
  const preparedRanker = prepareRouteRanker(snapshot.connectGraph ?? EMPTY_CONNECT_GRAPH);
  const processClass = (searchClass: RouteSearchClass) => {
    const retained = new RankedCandidateRetainer<RankedRouteCandidate>(maxRoutes);
    const seenIds = new Set<string>();
    let seen = 0;
    let searchIncomplete = false;
    for (const route of routes()) {
      if (isCurrent(route) !== (searchClass === 'current')) continue;
      if (seenIds.has(route.id)) continue;
      if (
        chargeRankingWork
        && !tryConsumeRouteSearchWork(
          context,
          searchClass,
          rankingBoundaryMarksSearchIncomplete,
        )
      ) {
        searchIncomplete = true;
        break;
      }
      seenIds.add(route.id);
      seen += 1;
      const evaluated = preparedRanker.evaluate(route);
      retained.retain({
        route: evaluated,
        tuple: routeRankTuple(evaluated),
      });
    }
    const rankedRoutes: ItemRoute[] = [];
    retained.appendBestFirst(rankedRoutes, candidate => candidate.route);
    return {
      routes: rankedRoutes,
      seen,
      searchIncomplete,
    };
  };

  const emptyClass = () => ({ routes: [], seen: 0, searchIncomplete: false });
  const current = searchClasses.includes('current') ? processClass('current') : emptyClass();
  const advisory = searchClasses.includes('advisory') ? processClass('advisory') : emptyClass();
  const currentRoutes = current.routes;
  const advisoryCapacity = Math.max(maxRoutes - currentRoutes.length, 0);
  const missingChunkRoutes = advisory.routes.length <= advisoryCapacity
    ? advisory.routes
    : advisory.routes.slice(0, advisoryCapacity);
  return {
    currentRoutes,
    missingChunkRoutes,
    currentExceeded: current.searchIncomplete || current.seen > currentRoutes.length,
    advisoryExceeded: advisory.searchIncomplete || advisory.seen > missingChunkRoutes.length,
  };
};

const directRoute = (
  source: ExactItemSource,
  snapshot: DirectRouteResolutionSnapshot,
  requestedQuantity: number,
): ItemRoute => {
  const evaluation = evaluateRouteGates(source.gates, snapshot.unlocks);
  const outputQuantity = Math.ceil(requestedQuantity / source.outputQuantity) * source.outputQuantity;
  const hasDataGap = source.coverage === 'PARTIAL' || evaluation.hasDataGap;
  const steps: RouteStep[] = [{
    id: source.id,
    label: source.label,
    chunk: source.chunk,
    gates: [...source.gates],
    sourceKind: source.kind,
    blockers: [...evaluation.blockers],
    quantity: outputQuantity,
    requiresChunkUnlock: !snapshot.unlockedChunks.has(source.chunk),
    hasDataGap,
  }];

  return {
    id: source.id,
    item: source.output,
    outputQuantity,
    sourceKind: source.kind,
    sourceLabel: source.label,
    chunks: [source.chunk],
    steps,
    blockers: evaluation.blockers,
    deterministic: source.deterministic,
    probability: source.probability,
    recursiveCost: 0,
    ...routeRequirementCosts(steps),
    travelCost: 0,
    hasDataGap,
  };
};

const isTraversalBoundaryNote = (note: string): boolean =>
  /cycle detected|maximum recursive depth|route budget/i.test(note);

const analysisState = (
  currentRoutes: readonly ItemRoute[],
  sourceCoverage: ItemSourceFamilyCoverage,
  analysisIncomplete: boolean,
  searchIncompleteMayHideUsable: boolean,
): ItemRouteState => {
  if (currentRoutes.some(route => route.blockers.length === 0 && !route.hasDataGap)) {
    return 'OBTAINABLE_NOW';
  }
  if (searchIncompleteMayHideUsable) return 'DATA_INCOMPLETE';
  if (currentRoutes.some(route => route.blockers.length > 0 && !route.hasDataGap)) {
    return 'ROUTE_BLOCKED';
  }
  if (currentRoutes.length > 0) return 'DATA_INCOMPLETE';
  if (analysisIncomplete) return 'DATA_INCOMPLETE';
  if (
    sourceCoverage.direct === 'COMPLETE'
    && sourceCoverage.transformation === 'COMPLETE'
  ) return 'NO_CURRENT_SOURCE';
  return 'DATA_INCOMPLETE';
};

const searchBoundaryNote = (
  itemName: string,
  searchClass: RouteSearchClass,
  context: ResolveContext,
): string => (
  `${searchClass === 'current' ? 'Current' : 'Advisory'} route search stopped while resolving ${itemName} `
  + `(limits: ${context.maxExactRouteCombinations} complete combinations and `
  + `${context.maxRouteSearchWorkUnits} search work units); additional ${searchClass} routes were not ranked.`
);

const incompleteCoverageNotes = (
  itemName: string,
  coverage: ItemSourceFamilyCoverage,
): string[] => [
  ...(coverage.direct === 'PARTIAL'
    ? [`Direct source coverage is incomplete for ${itemName}.`]
    : []),
  ...(coverage.transformation === 'PARTIAL'
    ? [`Transformation coverage is incomplete for ${itemName}.`]
    : []),
];

const sortedEntries = (record: Record<string, number>): [string, number][] =>
  Object.entries(record).sort(([left], [right]) => left.localeCompare(right));

const snapshotFingerprint = (snapshot: DirectRouteResolutionSnapshot): string => {
  if (snapshot.fingerprint?.trim()) return snapshot.fingerprint;
  const account = snapshot.unlocks;
  return JSON.stringify({
    unlockedChunks: [...snapshot.unlockedChunks].sort(),
    equipment: sortedEntries(account.equipment),
    skills: sortedEntries(account.skills),
    levels: sortedEntries(account.levels),
    regions: [...account.regions].sort(),
    chunks: [...(account.chunks ?? [])].sort(),
    mobility: [...account.mobility].sort(),
    arcana: [...account.arcana].sort(),
    housing: [...account.housing].sort(),
    merchants: [...account.merchants].sort(),
    minigames: [...account.minigames].sort(),
    bosses: [...account.bosses].sort(),
    storage: [...account.storage].sort(),
    guilds: [...account.guilds].sort(),
    farming: [...account.farming].sort(),
    slayerUnlocks: [...account.slayerUnlocks].sort(),
    banks: [...(account.banks ?? [])].sort(),
    quests: [...account.quests].sort(),
    diaries: [...account.diaries].sort(),
    cas: [...account.cas].sort(),
    completedTasks: [...account.completedTasks].sort(),
    collectionLog: sortedEntries(Object.fromEntries(
      Object.entries(account.collectionLog).map(([key, value]) => [String(key), value]),
    )),
  });
};

const normalizeOptions = (options: ResolverOptions): Required<ResolverOptions> => {
  const normalized = { ...DEFAULT_RESOLVER_OPTIONS, ...options };
  if (!Number.isInteger(normalized.maxDepth) || normalized.maxDepth < 0) {
    throw new Error('maxDepth must be a non-negative integer');
  }
  if (!Number.isInteger(normalized.maxRoutesPerItem) || normalized.maxRoutesPerItem <= 0) {
    throw new Error('maxRoutesPerItem must be a positive integer');
  }
  if (
    !Number.isInteger(normalized.maxExactRouteCombinations)
    || normalized.maxExactRouteCombinations <= 0
  ) {
    throw new Error('maxExactRouteCombinations must be a positive integer');
  }
  if (
    !Number.isInteger(normalized.maxRouteSearchWorkUnits)
    || normalized.maxRouteSearchWorkUnits <= 0
  ) {
    throw new Error('maxRouteSearchWorkUnits must be a positive integer');
  }
  return {
    ...normalized,
    maxExactRouteCombinations: Math.min(
      normalized.maxExactRouteCombinations,
      MAX_EXACT_ROUTE_COMBINATIONS,
    ),
    maxRouteSearchWorkUnits: Math.min(
      normalized.maxRouteSearchWorkUnits,
      MAX_ROUTE_SEARCH_WORK_UNITS,
    ),
  };
};

const recipeLookup = (
  snapshot: DirectRouteResolutionSnapshot,
): ((itemKey: string) => readonly RouteRecipe[]) | null => {
  if (snapshot.recipesFor) return snapshot.recipesFor;
  if (snapshot.entityLocations) return reviewedRecipesFor;
  return null;
};

const stationCandidates = (
  recipe: RouteRecipe,
  snapshot: DirectRouteResolutionSnapshot,
  context: ResolveContext,
  phase: ResolvePhase,
): StationCandidateSearch => {
  const lookup: ExactEntityLocationLookup = snapshot.entityLocationsForPhase
    ? (name, kind) => snapshot.entityLocationsForPhase!(name, kind, phase)
    : snapshot.entityLocations ?? (() => null);
  const stationRequirements = snapshot.stationRequirements;
  const resolved: StationCandidate[] = [];
  const gaps: StationCandidate[] = [];
  const seenCandidates = new Set<string>();
  const stationsWithValidLocations = new Set<RouteStation>();
  let hasValidExactLocation = false;
  let hasAdvisoryCandidate = false;
  const workClass: RouteSearchClass = phase;

  scan: for (const station of recipe.stations) {
    for (const name of station.names) {
      if (!tryConsumeRouteSearchWork(context, workClass)) break scan;
      if (
        phase === 'current'
        && snapshot.hasAdvisoryEntityLocations?.(name, station.entityKind) === true
      ) {
        hasValidExactLocation = true;
        hasAdvisoryCandidate = true;
        stationsWithValidLocations.add(station);
      }
      const hit = lookup(name, station.entityKind);
      if (
        hit === null
        || hit.kind !== station.entityKind
        || hit.name.toLocaleLowerCase('en-GB') !== name.toLocaleLowerCase('en-GB')
      ) continue;
      const locations = hit.locations;
      for (let index = 0; index < locations.length; index += 1) {
        if (index > 0 && !tryConsumeRouteSearchWork(context, workClass)) break scan;
        const { cx, cy } = locations[index];
        if (!Number.isInteger(cx) || !Number.isInteger(cy)) continue;
        hasValidExactLocation = true;
        stationsWithValidLocations.add(station);
        const chunk = `${cx},${cy}` as ChunkKey;
        const isCurrent = snapshot.unlockedChunks.has(chunk);
        if (!isCurrent) hasAdvisoryCandidate = true;
        if (phase === 'current' && !isCurrent) continue;
        const candidateKey = `${station.entityKind}:${name}:${chunk}`;
        if (seenCandidates.has(candidateKey)) continue;
        seenCandidates.add(candidateKey);
        const accessEvidenceMissing = stationRequirements === undefined;
        const gates = uniqueGates([
          ...recipe.gates,
          ...compileRawRequirements(stationRequirements?.(name, station.entityKind, chunk) ?? []),
        ]);
        const evaluation = evaluateRouteGates(gates, snapshot.unlocks);
        resolved.push({
          id: candidateKey,
          label: name,
          chunk,
          gates,
          blockers: uniqueGates(evaluation.blockers),
          hasDataGap: evaluation.hasDataGap || accessEvidenceMissing,
          dataNotes: accessEvidenceMissing
            ? [`No station access evidence for exact ${station.entityKind} ${name} at ${chunk}.`]
            : [],
        });
      }
    }
  }

  if (resolved.length > 0) return { candidates: resolved, hasAdvisoryCandidate };
  if (hasValidExactLocation) return { candidates: [], hasAdvisoryCandidate };

  for (const station of recipe.stations) {
    if (stationsWithValidLocations.has(station)) continue;
    if (!tryConsumeRouteSearchWork(context, workClass)) break;
    const gates = uniqueGates(recipe.gates);
    const evaluation = evaluateRouteGates(gates, snapshot.unlocks);
    gaps.push({
      id: `data-gap:${station.entityKind}:${station.names.join('|')}`,
      label: station.names.join(' or '),
      gates,
      blockers: uniqueGates(evaluation.blockers),
      hasDataGap: true,
      dataNotes: [`No exact ${station.entityKind} location for reviewed station: ${station.names.join(', ')}`],
    });
  }

  if (gaps.length > 0) return { candidates: gaps, hasAdvisoryCandidate };
  if (phase === 'current' && context.currentSearchIncompleteMayHideUsable) {
    return { candidates: [], hasAdvisoryCandidate };
  }
  if (phase === 'advisory' && context.advisorySearchIncomplete) {
    return { candidates: [], hasAdvisoryCandidate };
  }
  if (!tryConsumeRouteSearchWork(context, workClass)) {
    return { candidates: [], hasAdvisoryCandidate };
  }
  const gates = uniqueGates(recipe.gates);
  const evaluation = evaluateRouteGates(gates, snapshot.unlocks);
  return {
    candidates: [{
      id: 'data-gap:no-reviewed-station',
      label: recipe.id,
      gates,
      blockers: uniqueGates(evaluation.blockers),
      hasDataGap: true,
      dataNotes: [`No reviewed exact station for recipe: ${recipe.id}`],
    }],
    hasAdvisoryCandidate,
  };
};

const dependencyPlans = (recipe: RouteRecipe, requestedQuantity: number): DependencyPlan[] => {
  const batches = Math.ceil(requestedQuantity / recipe.outputQuantity);
  return [
    ...recipe.ingredients.map(ingredient => ({
      item: ingredient.item,
      alternatives: ingredient.alternatives,
      quantity: ingredient.quantity * batches,
      consumed: true,
    })),
    ...recipe.tools.map(tool => ({
      item: tool.item,
      alternatives: tool.alternatives,
      quantity: tool.consumed ? batches : 1,
      consumed: tool.consumed,
    })),
  ];
};

interface StationChoiceCombination {
  station: StationCandidate;
  choices: DependencyChoice[];
}

const dependencyChoiceId = (choices: readonly DependencyChoice[]): string => (
  choices.map((choice, index) => (
    `${index}=${choice.route?.id ?? `gap:${choice.dependency.item.key}:${choice.dependency.quantity}`}`
  )).join('|')
);

const stationChoiceId = (combination: StationChoiceCombination): string => (
  `station=${combination.station.id}:deps=${dependencyChoiceId(combination.choices)}`
);

const stationChoiceSteps = (
  id: string,
  combination: StationChoiceCombination,
  snapshot: DirectRouteResolutionSnapshot,
  sourceKind: ItemRoute['sourceKind'],
): RouteStep[] => {
  const { station, choices } = combination;
  const steps: RouteStep[] = [{
    id: `${id}:station`,
    label: `Use ${station.label}`,
    chunk: station.chunk,
    gates: [...station.gates],
    sourceKind,
    blockers: [...station.blockers],
    requiresChunkUnlock: station.chunk !== undefined
      && !snapshot.unlockedChunks.has(station.chunk),
    hasDataGap: station.hasDataGap,
  }];
  choices.forEach((choice, index) => {
    const childName = choice.route?.item.name ?? choice.dependency.item.name;
    steps.push({
      id: `${id}:dependency:${index}`,
      label: `Obtain ${childName}`,
      gates: [],
      quantity: choice.dependency.quantity,
      consumed: choice.dependency.consumed,
      requiresChunkUnlock: false,
      hasDataGap: !choice.route || choice.analysisIncomplete,
    });
    choice.route?.steps.forEach((step, stepIndex) => steps.push({
      ...step,
      id: `${id}:dependency:${index}:child:${stepIndex}:${step.id}`,
    }));
  });
  return steps;
};

const combineStationChoices = (
  stations: readonly StationCandidate[],
  choicesByDependency: readonly DependencyChoice[][],
  snapshot: DirectRouteResolutionSnapshot,
  maxRoutes: number,
  recipeDeterministic: boolean,
  context: ResolveContext,
  phase: ResolvePhase,
): {
  combinations: StationChoiceCombination[];
  currentBudgetExceeded: boolean;
  advisoryBudgetExceeded: boolean;
  searchIncompleteMayHideUsable: boolean;
  advisorySearchIncomplete: boolean;
} => {
  interface RankedCombination {
    combination: StationChoiceCombination;
    tuple: RouteRankTuple;
  }

  const graph = snapshot.connectGraph ?? EMPTY_CONNECT_GRAPH;
  const preparedRanker = prepareRouteRanker(graph);
  interface RouteFacts {
    chunkSequence: ChunkKey[];
    skillRequirements: Array<[string, number]>;
  }
  const routeFacts = new WeakMap<ItemRoute, RouteFacts>();
  const factsFor = (route: ItemRoute): RouteFacts => {
    const cached = routeFacts.get(route);
    if (cached) return cached;
    const chunkSequence: ChunkKey[] = [];
    const requiredLevels = new Map<string, number>();
    for (const step of route.steps) {
      if (step.chunk && chunkSequence[chunkSequence.length - 1] !== step.chunk) {
        chunkSequence.push(step.chunk);
      }
      for (const gate of step.gates) {
        if (gate.type !== 'SKILL') continue;
        requiredLevels.set(gate.skill, Math.max(requiredLevels.get(gate.skill) ?? 0, gate.level));
      }
    }
    const facts = {
      chunkSequence,
      skillRequirements: [...requiredLevels.entries()],
    };
    routeFacts.set(route, facts);
    return facts;
  };
  const tupleFor = (
    combination: StationChoiceCombination,
    hasRemainingDependencies = false,
  ): RouteRankTuple => {
    const { station, choices } = combination;
    const hasDataGap = station.hasDataGap || choices.some(choice => (
      !choice.route || choice.analysisIncomplete || choice.route.hasDataGap
    ));
    const hasBlocker = station.blockers.length > 0
      || choices.some(choice => (choice.route?.blockers.length ?? 0) > 0);
    const requiredLevels = new Map<string, number>();
    const addSkillRequirements = (requirements: readonly [string, number][]) => {
      for (const [skill, level] of requirements) {
        requiredLevels.set(skill, Math.max(requiredLevels.get(skill) ?? 0, level));
      }
    };
    addSkillRequirements(station.gates
      .filter((gate): gate is Extract<RouteGate, { type: 'SKILL' }> => gate.type === 'SKILL')
      .map(gate => [gate.skill, gate.level]));
    const chunkSequence: ChunkKey[] = [];
    if (station.chunk) chunkSequence.push(station.chunk);
    for (const choice of choices) {
      if (!choice.route) continue;
      const facts = factsFor(choice.route);
      addSkillRequirements(facts.skillRequirements);
      for (const chunk of facts.chunkSequence) {
        if (chunkSequence[chunkSequence.length - 1] !== chunk) chunkSequence.push(chunk);
      }
    }
    const probabilityValues = choices
      .map(choice => choice.route?.probability)
      .filter((value): value is number => value !== undefined);
    const probability = probabilityValues.length > 0
      ? probabilityValues.reduce((product, value) => product * value, 1)
      : undefined;
    return [
      !hasDataGap && !hasBlocker ? 0 : !hasDataGap ? 1 : 2,
      recipeDeterministic && choices.every(choice => choice.route?.deterministic !== false) ? 0 : 1,
      choices.reduce((cost, choice) => cost + (choice.route?.recursiveCost ?? 0), 0),
      choices.reduce((cost, choice) => cost
        + (choice.dependency.consumed ? choice.dependency.quantity : 0)
        + (choice.route?.consumedIngredientCost ?? 0), 0),
      requiredLevels.size,
      [...requiredLevels.values()].reduce((sum, level) => sum + level, 0),
      preparedRanker.travelCostForChunks(chunkSequence).travelCost,
      probability == null ? (hasRemainingDependencies ? -1 : 1) : -probability,
      stationChoiceId(combination),
    ];
  };
  const current = new RankedCandidateRetainer<RankedCombination>(maxRoutes);
  const advisory = new RankedCandidateRetainer<RankedCombination>(maxRoutes);
  let currentSeen = 0;
  let advisorySeen = 0;
  let currentBudgetExceeded = false;
  let advisoryBudgetExceeded = false;
  let currentSearchIncompleteMayHideUsable = false;
  let advisorySearchIncomplete = false;

  const choiceNeedsChunkUnlock = (choice: DependencyChoice): boolean => (
    choice.route?.chunks.some(chunk => !snapshot.unlockedChunks.has(chunk)) ?? false
  );
  const stationNeedsChunkUnlock = (station: StationCandidate): boolean => (
    station.chunk !== undefined && !snapshot.unlockedChunks.has(station.chunk)
  );
  const visit = (
    station: StationCandidate,
    dependencyChoices: readonly DependencyChoice[][],
    dependencyIndex: number,
    choices: DependencyChoice[],
    hasAdvisoryChunk: boolean,
    advisoryOnly: boolean,
  ) => {
    const searchClass: RouteSearchClass = advisoryOnly ? 'advisory' : 'current';
    if (advisoryOnly ? advisorySearchIncomplete : currentSearchIncompleteMayHideUsable) return;
    if (!tryConsumeRouteSearchWork(context, searchClass)) {
      if (advisoryOnly) advisorySearchIncomplete = true;
      else currentSearchIncompleteMayHideUsable = true;
      return;
    }
    if (
      advisoryOnly
      && !hasAdvisoryChunk
      && !dependencyChoices.slice(dependencyIndex).some(branches => (
        branches.some(choiceNeedsChunkUnlock)
      ))
    ) return;
    const targetHeap = advisoryOnly ? advisory : current;
    if (targetHeap.size >= maxRoutes) {
      const lowerBound = tupleFor(
        { station, choices },
        dependencyIndex < dependencyChoices.length,
      );
      if (compareRouteRankTuples(lowerBound, targetHeap.worst()!.tuple) >= 0) {
        if (advisoryOnly) advisoryBudgetExceeded = true;
        else currentBudgetExceeded = true;
        return;
      }
    }
    if (dependencyIndex < dependencyChoices.length) {
      for (const choice of dependencyChoices[dependencyIndex]) {
        visit(
          station,
          dependencyChoices,
          dependencyIndex + 1,
          [...choices, choice],
          hasAdvisoryChunk || choiceNeedsChunkUnlock(choice),
          advisoryOnly,
        );
        if (advisoryOnly ? advisorySearchIncomplete : currentSearchIncompleteMayHideUsable) return;
      }
      return;
    }
    if (advisoryOnly && !hasAdvisoryChunk) return;
    if (!tryConsumeExactRouteCombination(context, searchClass)) {
      if (advisoryOnly) advisorySearchIncomplete = true;
      else currentSearchIncompleteMayHideUsable = true;
      return;
    }
    const combination = { station, choices };
    const candidate = { combination, tuple: tupleFor(combination) };
    if (!hasAdvisoryChunk) {
      currentSeen += 1;
      current.retain(candidate);
    } else {
      advisorySeen += 1;
      advisory.retain(candidate);
    }
  };

  if (phase === 'current') {
    const currentStations = stations.filter(station => !stationNeedsChunkUnlock(station));
    const currentChoices = choicesByDependency.map(choices => (
      choices.filter(choice => !choiceNeedsChunkUnlock(choice))
    ));
    for (const station of currentStations) {
      visit(station, currentChoices, 0, [], false, false);
      if (currentSearchIncompleteMayHideUsable) break;
    }
  } else {
    for (const station of stations) {
      visit(
        station,
        choicesByDependency,
        0,
        [],
        stationNeedsChunkUnlock(station),
        true,
      );
      if (advisorySearchIncomplete) break;
    }
  }

  const combinations: StationChoiceCombination[] = [];
  current.appendBestFirst(combinations, candidate => candidate.combination);
  advisory.appendBestFirst(combinations, candidate => candidate.combination);
  return {
    combinations,
    currentBudgetExceeded: currentBudgetExceeded || currentSeen > maxRoutes,
    advisoryBudgetExceeded: advisoryBudgetExceeded || advisorySeen > maxRoutes,
    searchIncompleteMayHideUsable: currentSearchIncompleteMayHideUsable,
    advisorySearchIncomplete,
  };
};

const combinedProbability = (choices: readonly DependencyChoice[]): number | undefined => {
  const probabilities = choices
    .map(choice => choice.route?.probability)
    .filter((value): value is number => value !== undefined);
  if (probabilities.length === 0) return undefined;
  return probabilities.reduce((product, value) => product * value, 1);
};

const requirementResultKey = (
  requirement: QuestItemRequirement,
  context: ResolveContext,
  depth: number,
): string => JSON.stringify({
  item: canonicalItemKey(requirement.item.key),
  quantity: requirement.quantity,
  supplyPolicy: requirement.supplyPolicy,
  alternatives: requirement.alternatives?.map(item => canonicalItemKey(item.key)) ?? [],
  remainingDepth: Math.max(context.maxDepth - depth, 0),
  snapshot: context.snapshotFingerprint,
});

const resolveRequirement = (
  requirement: QuestItemRequirement,
  snapshot: DirectRouteResolutionSnapshot,
  context: ResolveContext,
  depth: number,
): ItemRouteAnalysis => {
  const resultKey = requirementResultKey(requirement, context, depth);
  const branches = requirement.alternatives?.length ? requirement.alternatives : [requirement.item];
  if (branches.length === 1 && branches[0].key === requirement.item.key) {
    const analysis = resolveConcreteRequirement(requirement, snapshot, context, depth);
    if (context.phase === 'current') {
      context.currentRequirementResults.set(resultKey, analysis);
      if (!context.currentRequirementAdvisoryPotential.has(resultKey)) {
        context.currentRequirementAdvisoryPotential.set(resultKey, false);
      }
    }
    return analysis;
  }

  const currentBaseline = context.currentRequirementResults.get(resultKey);
  if (
    context.phase === 'advisory'
    && currentBaseline
    && context.currentRequirementAdvisoryPotential.get(resultKey) !== true
  ) return currentBaseline;
  const analyses: ItemRouteAnalysis[] = [];
  let currentAdvisoryPotential = false;
  let retainedCurrentWitness: ItemRoute | undefined;
  let retainedCurrentWitnessPriority = Number.POSITIVE_INFINITY;
  for (const branch of branches) {
    const branchRequirement: QuestItemRequirement = {
      ...requirement,
      item: branch,
      alternatives: undefined,
    };
    if (
      context.phase === 'advisory'
      && context.currentRequirementAdvisoryPotential.get(
        requirementResultKey(branchRequirement, context, depth),
      ) !== true
    ) continue;
    if (!tryConsumeRouteSearchWork(context, context.phase)) break;
    const branchAnalysis = resolveConcreteRequirement(branchRequirement, snapshot, context, depth);
    analyses.push(branchAnalysis);
    if (context.phase === 'current') {
      const witness = branchAnalysis.currentRoutes[0];
      if (witness) {
        const witnessPriority = !witness.hasDataGap && witness.blockers.length === 0
          ? 0
          : !witness.hasDataGap ? 1 : 2;
        if (witnessPriority < retainedCurrentWitnessPriority) {
          retainedCurrentWitness = witness;
          retainedCurrentWitnessPriority = witnessPriority;
        }
      }
      currentAdvisoryPotential ||= context.currentRequirementAdvisoryPotential.get(
        requirementResultKey(branchRequirement, context, depth),
      ) === true;
    }
  }
  const dataNotes = uniqueNotes([
    ...(currentBaseline?.dataNotes ?? []),
    ...analyses.flatMap(analysis => analysis.dataNotes),
  ]);
  const analysisIncomplete = context.phase === 'current'
    ? analyses.some(analysis => analysis.state === 'DATA_INCOMPLETE')
    : currentBaseline?.analysisIncomplete === true;
  let searchIncompleteMayHideUsable = context.phase === 'current'
    ? analyses.some(analysis => analysis.searchIncompleteMayHideUsable === true)
      || context.currentSearchIncompleteMayHideUsable
    : currentBaseline?.searchIncompleteMayHideUsable === true;
  let advisorySearchIncomplete = context.phase === 'advisory'
    ? analyses.some(analysis => analysis.advisorySearchIncomplete === true)
      || context.advisorySearchIncomplete
    : false;
  const routeLimit = routeLimitAtDepth(context, depth);
  const baselineCurrentRoutes = currentBaseline?.currentRoutes ?? [];
  const phaseRouteCapacity = context.phase === 'current'
    ? routeLimit
    : Math.max(routeLimit - baselineCurrentRoutes.length, 0);
  const phaseRoutes = function* (): Iterable<ItemRoute> {
    for (const analysis of analyses) {
      if (context.phase === 'current') yield* analysis.currentRoutes;
      else yield* analysis.missingChunkRoutes;
    }
  };
  const limited: LimitedRouteSet = phaseRouteCapacity > 0
    ? limitRankedRoutes(
        phaseRoutes,
        snapshot,
        phaseRouteCapacity,
        context,
        true,
        context.phase === 'advisory',
        [context.phase],
      )
    : {
        currentRoutes: [],
        missingChunkRoutes: [],
        currentExceeded: context.phase === 'current' && analyses.some(analysis => analysis.currentRoutes.length > 0),
        advisoryExceeded: context.phase === 'advisory' && analyses.some(analysis => analysis.missingChunkRoutes.length > 0),
      };
  if (context.phase === 'current') {
    searchIncompleteMayHideUsable ||= context.currentSearchIncompleteMayHideUsable;
  } else {
    advisorySearchIncomplete ||= context.advisorySearchIncomplete;
  }
  if (limited.currentExceeded || limited.advisoryExceeded) {
    const classes = [
      ...(limited.currentExceeded ? ['current'] : []),
      ...(limited.advisoryExceeded ? ['advisory'] : []),
    ].join(' and ');
    dataNotes.push(`Route budget of ${routeLimit} exhausted while resolving ${requirement.item.name} (quantity ${requirement.quantity}); additional ${classes} routes were omitted.`);
  }
  if (searchIncompleteMayHideUsable) {
    dataNotes.push(searchBoundaryNote(requirement.item.name, 'current', context));
  }
  if (advisorySearchIncomplete) {
    dataNotes.push(searchBoundaryNote(requirement.item.name, 'advisory', context));
  }

  let rankedCurrentRoutes = limited.currentRoutes;
  if (context.phase === 'current' && retainedCurrentWitness) {
    const rankedWitness = rankedCurrentRoutes[0];
    const rankedPriority = rankedWitness
      ? !rankedWitness.hasDataGap && rankedWitness.blockers.length === 0
        ? 0
        : !rankedWitness.hasDataGap ? 1 : 2
      : Number.POSITIVE_INFINITY;
    if (retainedCurrentWitnessPriority < rankedPriority) {
      rankedCurrentRoutes = [retainedCurrentWitness];
    }
  }
  const currentRoutes = context.phase === 'current'
    ? rankedCurrentRoutes
    : [...baselineCurrentRoutes];
  const missingChunkRoutes = context.phase === 'current'
    ? []
    : limited.missingChunkRoutes;
  const familyCoverage: ItemSourceFamilyCoverage = context.phase === 'current'
    && analyses.every(analysis => analysis.state === 'NO_CURRENT_SOURCE')
    ? { direct: 'COMPLETE', transformation: 'COMPLETE' }
    : { direct: 'PARTIAL', transformation: 'PARTIAL' };
  const analysis: ItemRouteAnalysis = {
    requirement,
    state: context.phase === 'advisory' && currentBaseline
      ? currentBaseline.state
      : analysisState(
          currentRoutes,
          familyCoverage,
          analysisIncomplete,
          searchIncompleteMayHideUsable,
        ),
    currentRoutes,
    missingChunkRoutes,
    dataNotes: uniqueNotes(dataNotes),
    analysisIncomplete,
    searchIncompleteMayHideUsable,
    advisorySearchIncomplete,
  };
  if (context.phase === 'current') {
    context.currentRequirementResults.set(resultKey, analysis);
    context.currentRequirementAdvisoryPotential.set(resultKey, currentAdvisoryPotential);
  }
  return analysis;
};

const expandRecipe = (
  recipe: RouteRecipe,
  requirement: QuestItemRequirement,
  snapshot: DirectRouteResolutionSnapshot,
  context: ResolveContext,
  depth: number,
): RecipeExpansion => {
  const plans = dependencyPlans(recipe, requirement.quantity);
  const dataNotes: string[] = [];
  let analysisIncomplete = false;
  let searchIncompleteMayHideUsable = false;
  let advisorySearchIncomplete = false;
  let advisoryRoutePotential = false;
  const choicesByDependency = plans.map((dependency): DependencyChoice[] => {
    const dependencyRequirement: QuestItemRequirement = {
      item: dependency.item,
      quantity: dependency.quantity,
      supplyPolicy: 'PLAYER_OBTAINED',
      alternatives: dependency.alternatives,
    };
    const analysis = resolveRequirement(dependencyRequirement, snapshot, context, depth + 1);
    const dependencyHasAdvisoryPotential = context.currentRequirementAdvisoryPotential.get(
      requirementResultKey(dependencyRequirement, context, depth + 1),
    ) === true;
    advisoryRoutePotential ||= dependencyHasAdvisoryPotential;
    dataNotes.push(...analysis.dataNotes);
    const dependencySearchIncomplete = analysis.searchIncompleteMayHideUsable === true;
    searchIncompleteMayHideUsable ||= dependencySearchIncomplete;
    advisorySearchIncomplete ||= analysis.advisorySearchIncomplete === true;
    const dependencyIncomplete = analysis.state === 'DATA_INCOMPLETE';
    analysisIncomplete ||= dependencyIncomplete;
    const routes = [...analysis.currentRoutes, ...analysis.missingChunkRoutes];
    if (routes.length > 0) return routes.map(route => ({
      dependency,
      route,
      analysisIncomplete: dependencyIncomplete,
    }));
    if (context.phase === 'current' && dependencyHasAdvisoryPotential) return [];
    dataNotes.push(`No known acquisition route for ${dependency.item.name} (quantity ${dependency.quantity}).`);
    return [{ dependency, analysisIncomplete: dependencyIncomplete }];
  });
  const stationSearch = stationCandidates(recipe, snapshot, context, context.phase);
  const stations = stationSearch.candidates;
  advisoryRoutePotential ||= stationSearch.hasAdvisoryCandidate;
  stations.forEach(station => dataNotes.push(...station.dataNotes));
  analysisIncomplete ||= stations.some(station => station.hasDataGap);
  const combined = combineStationChoices(
    stations,
    choicesByDependency,
    snapshot,
    routeLimitAtDepth(context, depth),
    recipe.deterministic,
    context,
    context.phase,
  );
  searchIncompleteMayHideUsable ||= combined.searchIncompleteMayHideUsable;
  advisorySearchIncomplete ||= combined.advisorySearchIncomplete;
  const batches = Math.ceil(requirement.quantity / recipe.outputQuantity);
  const routes: ItemRoute[] = [];
  for (const combination of combined.combinations) {
    const { station, choices } = combination;
    const searchClass: RouteSearchClass = context.phase;
    if (!tryReserveRouteMaterializationAndRanking(context, searchClass)) {
      if (searchClass === 'current') searchIncompleteMayHideUsable = true;
      else advisorySearchIncomplete = true;
      break;
    }
    const id = `recipe:${recipe.id}:${requirement.item.key}:q${requirement.quantity}:${stationChoiceId(combination)}`;
    const chunks = unique([
      ...(station.chunk ? [station.chunk] : []),
      ...choices.flatMap(choice => choice.route?.chunks ?? []),
    ]);
    const steps = stationChoiceSteps(id, combination, snapshot, recipe.kind);
    routes.push({
      id,
      item: recipe.output,
      outputQuantity: batches * recipe.outputQuantity,
      sourceKind: recipe.kind,
      sourceLabel: recipe.id,
      chunks,
      steps,
      blockers: uniqueGates([
        ...station.blockers,
        ...choices.flatMap(choice => choice.route?.blockers ?? []),
      ]),
      deterministic: recipe.deterministic && choices.every(choice => choice.route?.deterministic !== false),
      probability: combinedProbability(choices),
      recursiveCost: 1 + choices.reduce((cost, choice) => cost + (choice.route?.recursiveCost ?? 0), 0),
      ...routeRequirementCosts(steps),
      travelCost: chunks.length,
      hasDataGap: station.hasDataGap || choices.some(choice => (
        !choice.route || choice.analysisIncomplete || choice.route.hasDataGap
      )),
    });
  }
  searchIncompleteMayHideUsable ||= context.currentSearchIncompleteMayHideUsable;
  advisorySearchIncomplete ||= context.advisorySearchIncomplete;
  if (searchIncompleteMayHideUsable) {
    dataNotes.push(searchBoundaryNote(requirement.item.name, 'current', context));
  }
  if (advisorySearchIncomplete) {
    dataNotes.push(searchBoundaryNote(requirement.item.name, 'advisory', context));
  }

  return {
    routes,
    dataNotes: uniqueNotes(dataNotes),
    currentBudgetExceeded: combined.currentBudgetExceeded,
    advisoryBudgetExceeded: combined.advisoryBudgetExceeded,
    analysisIncomplete,
    searchIncompleteMayHideUsable,
    advisorySearchIncomplete,
    advisoryRoutePotential,
  };
};

function resolveConcreteRequirement(
  requirement: QuestItemRequirement,
  snapshot: DirectRouteResolutionSnapshot,
  context: ResolveContext,
  depth: number,
): ItemRouteAnalysis {
  if (requirement.supplyPolicy === 'QUEST_PROVIDED') {
    return {
      requirement,
      state: 'OBTAINABLE_NOW',
      currentRoutes: [],
      missingChunkRoutes: [],
      dataNotes: ['Provided during the quest; no pre-quest acquisition route is required.'],
      analysisIncomplete: false,
      searchIncompleteMayHideUsable: false,
      advisorySearchIncomplete: false,
    };
  }

  const itemKey = canonicalItemKey(requirement.item.key);
  const key = `${itemKey}|${requirement.quantity}|${context.snapshotFingerprint}` as ResolveKey;
  const remainingDepth = Math.max(context.maxDepth - depth, 0);
  const resultKey = `${key}|${remainingDepth}` as ResolveResultKey;
  const memoKey = `${context.phase}|${resultKey}`;
  const activeKey = `${context.phase}|${key}`;
  const currentBaseline = context.currentConcreteResults.get(resultKey);
  if (
    context.phase === 'advisory'
    && currentBaseline
    && context.currentRequirementAdvisoryPotential.get(
      requirementResultKey(requirement, context, depth),
    ) !== true
  ) return currentBaseline;
  if (context.active.has(activeKey)) {
    return {
      requirement,
      state: 'DATA_INCOMPLETE',
      currentRoutes: [],
      missingChunkRoutes: [],
      dataNotes: [`Cycle detected while resolving ${requirement.item.name} (quantity ${requirement.quantity}).`],
      analysisIncomplete: true,
      searchIncompleteMayHideUsable: false,
      advisorySearchIncomplete: false,
    };
  }
  const memoized = context.memo.get(memoKey);
  if (memoized) return memoized;

  context.active.add(activeKey);
  try {
    const indexed = indexDirectItemSources(requirement.item, snapshot, {
      hasWorkCapacity: () => hasRouteSearchWorkCapacity(context),
      consumeInspectionWork: () => tryConsumeRouteSearchWork(context, context.phase),
      consumeWork: () => tryConsumeRouteSearchWork(context, context.phase),
      searchClasses: [context.phase],
    });
    const currentRoutes = context.phase === 'current'
      ? indexed.currentSources.map(source => directRoute(source, snapshot, requirement.quantity))
      : [...(currentBaseline?.currentRoutes ?? [])];
    const missingChunkRoutes = context.phase === 'advisory'
      ? indexed.knownOutsideSources.map(source => directRoute(source, snapshot, requirement.quantity))
      : [];
    const dataNotes: string[] = context.phase === 'advisory'
      ? [...(currentBaseline?.dataNotes ?? [])]
      : [];
    let currentBudgetExceeded = false;
    let advisoryBudgetExceeded = false;
    let analysisIncomplete = context.phase === 'current'
      ? false
      : currentBaseline?.analysisIncomplete === true;
    let searchIncompleteMayHideUsable = context.phase === 'current'
      ? indexed.currentSearchIncomplete || context.currentSearchIncompleteMayHideUsable
      : currentBaseline?.searchIncompleteMayHideUsable === true;
    let advisorySearchIncomplete = context.phase === 'advisory'
      ? indexed.advisorySearchIncomplete || context.advisorySearchIncomplete
      : false;
    let advisoryRoutePotential = indexed.hasKnownOutsideSources;
    const lookup = recipeLookup(snapshot);
    const recipes = lookup?.(itemKey) ?? [];

    if (recipes.length > 0) {
      if (depth >= context.maxDepth) {
        if (context.phase === 'current') {
          dataNotes.push(`Maximum recursive depth ${context.maxDepth} reached while resolving ${requirement.item.name} (quantity ${requirement.quantity}).`);
          analysisIncomplete = true;
        }
      } else {
        for (const recipe of recipes) {
          if (
            context.phase === 'advisory'
            && currentBaseline?.currentRoutes.some(route => (
              route.sourceLabel === recipe.id && !route.hasDataGap
            ))
          ) {
            if (context.routeSearchWorkUnitsEvaluated >= context.maxRouteSearchWorkUnits) {
              markSearchIncomplete(context, 'advisory');
              advisorySearchIncomplete = true;
            }
            continue;
          }
          if (!tryConsumeRouteSearchWork(context, context.phase)) {
            if (context.phase === 'current') searchIncompleteMayHideUsable = true;
            else advisorySearchIncomplete = true;
            break;
          }
          const expansion = expandRecipe(recipe, requirement, snapshot, context, depth);
          dataNotes.push(...expansion.dataNotes);
          if (context.phase === 'current') {
            currentBudgetExceeded ||= expansion.currentBudgetExceeded;
            analysisIncomplete ||= expansion.analysisIncomplete;
            searchIncompleteMayHideUsable ||= expansion.searchIncompleteMayHideUsable;
            advisoryRoutePotential ||= expansion.advisoryRoutePotential;
          } else {
            advisoryBudgetExceeded ||= expansion.advisoryBudgetExceeded;
            advisorySearchIncomplete ||= expansion.advisorySearchIncomplete;
          }
          for (const route of expansion.routes) {
            const isCurrent = route.chunks.every(chunk => snapshot.unlockedChunks.has(chunk));
            if (context.phase === 'current' && isCurrent) currentRoutes.push(route);
            if (context.phase === 'advisory' && !isCurrent) missingChunkRoutes.push(route);
          }
        }
      }
    }

    if (context.phase === 'current' && currentRoutes.length === 0) {
      dataNotes.push(...incompleteCoverageNotes(
        requirement.item.name,
        indexed.familyCoverage,
      ));
    }
    const routeLimit = routeLimitAtDepth(context, depth);
    const baselineCurrentRoutes = currentBaseline?.currentRoutes ?? [];
    const phaseRouteCapacity = context.phase === 'current'
      ? routeLimit
      : Math.max(routeLimit - baselineCurrentRoutes.length, 0);
    const limited: LimitedRouteSet = phaseRouteCapacity > 0
      ? limitRankedRoutes(
          function* (): Iterable<ItemRoute> {
            if (context.phase === 'current') yield* currentRoutes;
            else yield* missingChunkRoutes;
          },
          snapshot,
          phaseRouteCapacity,
          context,
          false,
          true,
          [context.phase],
        )
      : {
          currentRoutes: [],
          missingChunkRoutes: [],
          currentExceeded: context.phase === 'current' && currentRoutes.length > 0,
          advisoryExceeded: context.phase === 'advisory' && missingChunkRoutes.length > 0,
        };
    if (context.phase === 'current') {
      searchIncompleteMayHideUsable ||= context.currentSearchIncompleteMayHideUsable;
    } else {
      advisorySearchIncomplete ||= context.advisorySearchIncomplete;
    }
    currentBudgetExceeded ||= limited.currentExceeded;
    advisoryBudgetExceeded ||= limited.advisoryExceeded;
    const finalCurrentRoutes = context.phase === 'current'
      ? limited.currentRoutes
      : [...baselineCurrentRoutes];
    const finalMissingChunkRoutes = context.phase === 'advisory'
      ? limited.missingChunkRoutes
      : [];
    const hasAuthoritativeCurrentRoute = finalCurrentRoutes.some(route => !route.hasDataGap);
    if (
      context.phase === 'current'
      &&
      !hasAuthoritativeCurrentRoute
      && (
        indexed.familyCoverage.direct === 'PARTIAL'
        || indexed.familyCoverage.transformation === 'PARTIAL'
      )
    ) analysisIncomplete = true;
    if (currentBudgetExceeded || advisoryBudgetExceeded) {
      const classes = [
        ...(currentBudgetExceeded ? ['current'] : []),
        ...(advisoryBudgetExceeded ? ['advisory'] : []),
      ].join(' and ');
      dataNotes.push(`Route budget of ${routeLimit} exhausted while resolving ${requirement.item.name} (quantity ${requirement.quantity}); additional ${classes} routes were omitted.`);
    }
    if (searchIncompleteMayHideUsable) {
      dataNotes.push(searchBoundaryNote(requirement.item.name, 'current', context));
    }
    if (advisorySearchIncomplete) {
      dataNotes.push(searchBoundaryNote(requirement.item.name, 'advisory', context));
    }
    const notes = uniqueNotes(dataNotes);
    const analysis: ItemRouteAnalysis = {
      requirement,
      state: context.phase === 'advisory' && currentBaseline
        ? currentBaseline.state
        : analysisState(
            finalCurrentRoutes,
            indexed.familyCoverage,
            analysisIncomplete,
            searchIncompleteMayHideUsable,
          ),
      currentRoutes: finalCurrentRoutes,
      missingChunkRoutes: finalMissingChunkRoutes,
      dataNotes: notes,
      analysisIncomplete,
      searchIncompleteMayHideUsable,
      advisorySearchIncomplete,
    };
    if (context.phase === 'current') {
      context.currentConcreteResults.set(resultKey, analysis);
      context.currentRequirementAdvisoryPotential.set(
        requirementResultKey(requirement, context, depth),
        advisoryRoutePotential,
      );
    }
    if (
      !analysisIncomplete
      && !searchIncompleteMayHideUsable
      && !advisorySearchIncomplete
      && !notes.some(isTraversalBoundaryNote)
    ) context.memo.set(memoKey, analysis);
    return analysis;
  } finally {
    context.active.delete(activeKey);
  }
}

export const resolveItemRequirement = (
  requirement: QuestItemRequirement,
  snapshot: DirectRouteResolutionSnapshot,
  options: ResolverOptions = {},
): ItemRouteAnalysis => {
  const normalized = normalizeOptions(options);
  const context: ResolveContext = {
    active: new Set(),
    memo: new Map(),
    currentConcreteResults: new Map(),
    currentRequirementResults: new Map(),
    currentRequirementAdvisoryPotential: new Map(),
    phase: 'current',
    maxDepth: normalized.maxDepth,
    maxRoutesPerItem: normalized.maxRoutesPerItem,
    maxSearchRoutesPerItem: normalized.maxExactRouteCombinations,
    maxExactRouteCombinations: normalized.maxExactRouteCombinations,
    maxRouteSearchWorkUnits: normalized.maxRouteSearchWorkUnits,
    remainingExactRouteCombinations: normalized.maxExactRouteCombinations,
    routeSearchWorkUnitsEvaluated: 0,
    currentSearchIncompleteMayHideUsable: false,
    advisorySearchIncomplete: false,
    snapshotFingerprint: snapshotFingerprint(snapshot),
  };
  let analysis = resolveRequirement(requirement, snapshot, context, 0);
  if (!context.currentSearchIncompleteMayHideUsable) {
    context.phase = 'advisory';
    context.active.clear();
    analysis = resolveRequirement(requirement, snapshot, context, 0);
  }
  return {
    ...analysis,
    exactRouteCombinationsEvaluated:
      context.maxExactRouteCombinations - context.remainingExactRouteCombinations,
    routeSearchWorkUnitsEvaluated: context.routeSearchWorkUnitsEvaluated,
  };
};
