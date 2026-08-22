export type ChunkKey = `${number},${number}`;
export type SupplyPolicy = 'PLAYER_OBTAINED' | 'QUEST_PROVIDED';
export type Coverage = 'COMPLETE' | 'PARTIAL';
export type SourceKind = 'SPAWN' | 'SHOP' | 'DROP' | 'GATHER' | 'RECIPE';

export interface ItemSourceFamilyCoverage {
  readonly direct: Coverage;
  readonly transformation: Coverage;
}

export interface ItemRef {
  key: string;
  name: string;
}

export interface RawRouteRequirement {
  raw: string;
  origin: 'ENTITY' | 'CHUNK_ENTRY';
}

export type RouteGate =
  | { type: 'QUEST'; questId: string; label: string }
  | { type: 'SKILL'; skill: string; level: number; label: string }
  | { type: 'UNLOCK'; category: 'guilds' | 'merchants' | 'minigames' | 'mobility' | 'slayerUnlocks'; id: string; label: string }
  | { type: 'UNRESOLVED'; label: string; raw: string };

export interface QuestItemRequirement {
  item: ItemRef;
  quantity: number;
  supplyPolicy: SupplyPolicy;
  alternatives?: ItemRef[];
  note?: string;
}

export interface ExactItemSource {
  id: string;
  output: ItemRef;
  outputQuantity: number;
  kind: SourceKind;
  label: string;
  hostName?: string;
  chunk: ChunkKey;
  rawRequirements: RawRouteRequirement[];
  gates: RouteGate[];
  deterministic: boolean;
  probability?: number;
  coverage: Coverage;
}

export interface RouteStep {
  id: string;
  label: string;
  chunk?: ChunkKey;
  gates: RouteGate[];
  sourceKind?: SourceKind;
  blockers?: RouteGate[];
  quantity?: number;
  consumed?: boolean;
  requiresChunkUnlock: boolean;
  hasDataGap: boolean;
}

export interface ItemRoute {
  id: string;
  item: ItemRef;
  outputQuantity: number;
  sourceKind: SourceKind;
  sourceLabel: string;
  chunks: ChunkKey[];
  steps: RouteStep[];
  blockers: RouteGate[];
  deterministic: boolean;
  probability?: number;
  recursiveCost: number;
  consumedIngredientCost: number;
  skillUnlockCost: number;
  skillLevelCost: number;
  travelCost: number;
  /** True when travel cost used a geometric fallback rather than graph data. */
  travelCostEstimated?: boolean;
  hasDataGap: boolean;
}

export type ItemRouteState =
  | 'OBTAINABLE_NOW'
  | 'ROUTE_BLOCKED'
  | 'NO_CURRENT_SOURCE'
  | 'DATA_INCOMPLETE';

export interface ItemRouteAnalysis {
  requirement: QuestItemRequirement;
  state: ItemRouteState;
  currentRoutes: ItemRoute[];
  missingChunkRoutes: ItemRoute[];
  dataNotes: string[];
  /** Structured evidence gap; presentation notes are never used to infer state. */
  analysisIncomplete?: boolean;
  /** Current-route search stopped before every potentially usable candidate could be ranked. */
  searchIncompleteMayHideUsable?: boolean;
  /** Advisory-only search stopped; this cannot weaken a proved current-route state. */
  advisorySearchIncomplete?: boolean;
  /** Complete route combinations evaluated by the bounded resolver query. */
  exactRouteCombinationsEvaluated?: number;
  /** Conservative admitted work across source, candidate, combination, and ranking stages. */
  routeSearchWorkUnitsEvaluated?: number;
}

export const canonicalItemKey = (name: string): string =>
  name.trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');

export const chunkKey = (cx: number, cy: number): ChunkKey => `${cx},${cy}`;

const assertNonBlank: (value: string, label: string) => void = (value, label) => {
  if (!value.trim()) throw new Error(`${label} must not be blank`);
};

const assertPositiveFinite: (value: number, label: string) => void = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
};

const assertChunkKey: (chunk: string) => asserts chunk is ChunkKey = (chunk) => {
  if (!/^-?\d+,-?\d+$/.test(chunk)) throw new Error('chunk must be a coordinate key');
};

const validateItemRef = (item: ItemRef): ItemRef => {
  assertNonBlank(item.key, 'item key');
  assertNonBlank(item.name, 'item name');
  return item;
};

const validateProbability = (probability: number | undefined): void => {
  if (probability !== undefined && (!Number.isFinite(probability) || probability <= 0 || probability > 1)) {
    throw new Error('probability must be within (0, 1]');
  }
};

const validateRouteGate = (gate: RouteGate): RouteGate => {
  assertNonBlank(gate.label, 'gate label');

  switch (gate.type) {
    case 'QUEST':
      assertNonBlank(gate.questId, 'quest id');
      break;
    case 'SKILL':
      assertNonBlank(gate.skill, 'skill');
      assertPositiveFinite(gate.level, 'skill level');
      break;
    case 'UNLOCK':
      assertNonBlank(gate.id, 'unlock id');
      break;
    case 'UNRESOLVED':
      assertNonBlank(gate.raw, 'raw requirement');
      break;
  }

  return gate;
};

export const validateQuestRequirement = (requirement: QuestItemRequirement): QuestItemRequirement => {
  validateItemRef(requirement.item);
  assertPositiveFinite(requirement.quantity, 'quantity');
  requirement.alternatives?.forEach(validateItemRef);
  return requirement;
};

export const validateSource = (source: ExactItemSource): ExactItemSource => {
  assertNonBlank(source.id, 'source id');
  validateItemRef(source.output);
  assertPositiveFinite(source.outputQuantity, 'output quantity');
  assertNonBlank(source.label, 'source label');
  assertChunkKey(source.chunk);
  validateProbability(source.probability);
  source.rawRequirements.forEach((requirement) => {
    assertNonBlank(requirement.raw, 'raw requirement');
  });
  source.gates.forEach(validateRouteGate);
  return source;
};

export const validateRoute = (route: ItemRoute): ItemRoute => {
  assertNonBlank(route.id, 'route id');
  validateItemRef(route.item);
  assertPositiveFinite(route.outputQuantity, 'output quantity');
  assertNonBlank(route.sourceLabel, 'source label');
  route.chunks.forEach(assertChunkKey);
  validateProbability(route.probability);
  if (route.travelCostEstimated !== undefined && typeof route.travelCostEstimated !== 'boolean') {
    throw new Error('travel cost estimate flag must be boolean');
  }
  route.blockers.forEach(validateRouteGate);

  const stepIds = new Set<string>();
  route.steps.forEach((step) => {
    assertNonBlank(step.id, 'step id');
    assertNonBlank(step.label, 'step label');
    if (step.chunk) assertChunkKey(step.chunk);
    step.gates.forEach(validateRouteGate);
    step.blockers?.forEach(validateRouteGate);
    if (step.quantity !== undefined) assertPositiveFinite(step.quantity, 'step quantity');
    if (step.consumed !== undefined && typeof step.consumed !== 'boolean') {
      throw new Error('step consumed must be boolean');
    }
    if (typeof step.requiresChunkUnlock !== 'boolean') {
      throw new Error('step chunk-unlock flag must be boolean');
    }
    if (typeof step.hasDataGap !== 'boolean') {
      throw new Error('step data-gap flag must be boolean');
    }
    if (stepIds.has(step.id)) throw new Error(`duplicate step id: ${step.id}`);
    stepIds.add(step.id);
  });

  return route;
};
