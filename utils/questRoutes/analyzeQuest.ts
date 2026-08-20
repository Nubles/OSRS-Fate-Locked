import { evaluateQuestWalkthrough } from '../questWalkthroughs/evaluator';
import { resolveQuestWalkthroughLocations } from '../questWalkthroughs/locationResolver';
import type {
  QuestWalkthroughAnalysis,
  QuestWalkthroughDefinition,
} from '../questWalkthroughs/model';
import { reviewedQuestRequirements } from '../../data/questItemRequirements';
import type {
  ExactEntityHit,
  RouteRecipe,
  RouteStation,
} from '../../data/questRouteRecipes';
import type { ConnectGraph, ItemSourceRecord } from '../../services/ChunkContentService';
import type { UnlockState } from '../../types';
import {
  resolveItemRequirement,
  type DirectRouteResolutionSnapshot,
} from './resolver';
import {
  minimalMissingChunkOptions,
  type MissingChunkOption,
} from './missingChunks';
import type {
  ChunkKey,
  ItemSourceFamilyCoverage,
  ItemRouteAnalysis,
  RawRouteRequirement,
  RouteGate,
} from './model';
import { rankRoutes } from './ranker';
import { questRouteStatusForItems } from './questRouteStatus';

export type QuestRouteStatus =
  | 'READY_NOW'
  | 'CANNOT_COMPLETE_YET'
  | 'ANALYSIS_INCOMPLETE';

export const combineQuestRouteStatus = (
  itemStatus: QuestRouteStatus,
  walkthroughStatus: QuestWalkthroughAnalysis['status'],
): QuestRouteStatus => {
  if (itemStatus === 'CANNOT_COMPLETE_YET' || walkthroughStatus === 'BLOCKED') {
    return 'CANNOT_COMPLETE_YET';
  }
  if (itemStatus === 'ANALYSIS_INCOMPLETE' || walkthroughStatus === 'INCOMPLETE') {
    return 'ANALYSIS_INCOMPLETE';
  }
  return 'READY_NOW';
};

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[]
      : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T;

export type QuestItemRouteAnalysis = DeepReadonly<ItemRouteAnalysis & {
  missingChunkOptions: MissingChunkOption[];
}>;

export interface QuestPreparationRouteAnalysis {
  readonly questId: string;
  readonly status: QuestRouteStatus;
  readonly items: readonly QuestItemRouteAnalysis[];
  readonly generatedFrom: Readonly<{
    chunkDataVersion: number;
    questRevision: string;
    accountFingerprint: string;
  }>;
}

export interface QuestRouteAnalysis extends QuestPreparationRouteAnalysis {
  readonly walkthrough: QuestWalkthroughAnalysis;
  readonly generatedFrom: QuestPreparationRouteAnalysis['generatedFrom'] & Readonly<{
    walkthroughRevision: string;
  }>;
}

export type RuneProofRouteAnalysis = QuestPreparationRouteAnalysis | QuestRouteAnalysis;

export interface QuestRouteAccountSnapshot {
  readonly skills: Readonly<Record<string, number>>;
  readonly levels: Readonly<Record<string, number>>;
  readonly regions: readonly string[];
  readonly chunks: readonly string[];
  readonly quests: readonly string[];
  readonly guilds: readonly string[];
  readonly merchants: readonly string[];
  readonly minigames: readonly string[];
  readonly mobility: readonly string[];
  readonly slayerUnlocks: readonly string[];
}

export interface QuestRouteStationRequirement {
  readonly name: string;
  readonly kind: RouteStation['entityKind'];
  readonly chunk: ChunkKey;
  readonly rawRequirements: readonly DeepReadonly<RawRouteRequirement>[];
}

export interface QuestRouteItemSourceCoverage extends ItemSourceFamilyCoverage {
  readonly itemKey: string;
}

/** Plain, fully materialized route evidence captured after content initialization. */
export interface QuestRouteAnalysisSnapshot {
  readonly chunkDataVersion: number;
  readonly gameModeId?: string;
  readonly unlockedChunks: readonly ChunkKey[];
  readonly unlocks: QuestRouteAccountSnapshot;
  readonly itemSourceRecords: readonly DeepReadonly<ItemSourceRecord>[];
  readonly recipes: readonly DeepReadonly<RouteRecipe>[];
  readonly entityLocations: readonly DeepReadonly<ExactEntityHit>[];
  readonly stationRequirements: readonly QuestRouteStationRequirement[];
  readonly sourceCoverage: readonly QuestRouteItemSourceCoverage[];
  readonly connectGraph: Readonly<Record<string, readonly string[]>>;
}

const CACHE_LIMIT = 32;
const analysisCache = new Map<string, QuestRouteAnalysis>();

const compareCodeUnitStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const normalizedList = (values: readonly string[]): string[] =>
  [...new Set(values)].sort(compareCodeUnitStrings);

const normalizedLevels = (levels: Readonly<Record<string, number>>): [string, number][] =>
  Object.entries(levels).sort(([left], [right]) => compareCodeUnitStrings(left, right));

const accountStateFingerprint = (
  gameModeId: string | undefined,
  unlockedChunks: readonly ChunkKey[],
  unlocks: QuestRouteAccountSnapshot,
): string => JSON.stringify({
  gameModeId: gameModeId ?? null,
  unlockedChunks: normalizedList(unlockedChunks),
  skills: normalizedLevels(unlocks.skills),
  levels: normalizedLevels(unlocks.levels),
  regions: normalizedList(unlocks.regions),
  chunks: normalizedList(unlocks.chunks),
  quests: normalizedList(unlocks.quests),
  guilds: normalizedList(unlocks.guilds),
  merchants: normalizedList(unlocks.merchants),
  minigames: normalizedList(unlocks.minigames),
  mobility: normalizedList(unlocks.mobility),
  slayerUnlocks: normalizedList(unlocks.slayerUnlocks),
});

const serializedGate = (gate: DeepReadonly<RouteGate>): object => {
  switch (gate.type) {
    case 'QUEST':
      return { type: gate.type, questId: gate.questId, label: gate.label };
    case 'SKILL':
      return { type: gate.type, skill: gate.skill, level: gate.level, label: gate.label };
    case 'UNLOCK':
      return {
        type: gate.type,
        category: gate.category,
        id: gate.id,
        label: gate.label,
      };
    case 'UNRESOLVED':
      return { type: gate.type, label: gate.label, raw: gate.raw };
  }
};

const serializedItem = (item: { readonly key: string; readonly name: string }): object => ({
  key: item.key,
  name: item.name,
});

const serializedRawRequirements = (
  requirements: readonly DeepReadonly<RawRouteRequirement>[],
): object[] => requirements.map(requirement => ({
  raw: requirement.raw,
  origin: requirement.origin,
}));

const normalizedConnectGraph = (
  graph: Readonly<Record<string, readonly string[]>>,
): [string, string[]][] => Object.entries(graph)
  .sort(([left], [right]) => compareCodeUnitStrings(left, right))
  .map(([from, destinations]) => [from, normalizedList(destinations)]);

const contentStateFingerprint = (snapshot: QuestRouteAnalysisSnapshot): string => JSON.stringify({
  itemSourceRecords: snapshot.itemSourceRecords.map(record => ({
    itemName: record.itemName,
    kind: record.kind,
    hostName: record.hostName,
    cx: record.cx,
    cy: record.cy,
    rawRequirements: serializedRawRequirements(record.rawRequirements),
  })),
  recipes: snapshot.recipes.map(recipe => ({
    id: recipe.id,
    kind: recipe.kind,
    output: serializedItem(recipe.output),
    outputQuantity: recipe.outputQuantity,
    ingredients: recipe.ingredients.map(ingredient => ({
      item: serializedItem(ingredient.item),
      quantity: ingredient.quantity,
      alternatives: (ingredient.alternatives ?? []).map(serializedItem),
    })),
    tools: recipe.tools.map(tool => ({
      item: serializedItem(tool.item),
      consumed: tool.consumed,
      alternatives: (tool.alternatives ?? []).map(serializedItem),
    })),
    stations: recipe.stations.map(station => ({
      entityKind: station.entityKind,
      names: [...station.names],
    })),
    gates: recipe.gates.map(serializedGate),
    deterministic: recipe.deterministic,
    sourceRevision: recipe.sourceRevision,
  })),
  entityLocations: snapshot.entityLocations.map(hit => ({
    name: hit.name,
    kind: hit.kind,
    locations: hit.locations.map(location => ({ cx: location.cx, cy: location.cy })),
  })),
  stationRequirements: snapshot.stationRequirements.map(requirement => ({
    name: requirement.name,
    kind: requirement.kind,
    chunk: requirement.chunk,
    rawRequirements: serializedRawRequirements(requirement.rawRequirements),
  })),
  sourceCoverage: [...snapshot.sourceCoverage]
    .sort((left, right) => compareCodeUnitStrings(left.itemKey, right.itemKey))
    .map(coverage => ({ ...coverage })),
  connectGraph: normalizedConnectGraph(snapshot.connectGraph),
});

const resolverUnlocks = (snapshot: QuestRouteAccountSnapshot): UnlockState => ({
  equipment: {},
  skills: Object.fromEntries(Object.entries(snapshot.skills)),
  levels: Object.fromEntries(Object.entries(snapshot.levels)),
  regions: [...snapshot.regions],
  chunks: [...snapshot.chunks],
  mobility: [...snapshot.mobility],
  arcana: [],
  housing: [],
  merchants: [...snapshot.merchants],
  minigames: [...snapshot.minigames],
  bosses: [],
  storage: [],
  guilds: [...snapshot.guilds],
  farming: [],
  slayerUnlocks: [...snapshot.slayerUnlocks],
  quests: [...snapshot.quests],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
});

const copiedSourceRecords = (
  records: readonly DeepReadonly<ItemSourceRecord>[],
): ItemSourceRecord[] => records.map(record => ({
  itemName: record.itemName,
  kind: record.kind,
  hostName: record.hostName,
  cx: record.cx,
  cy: record.cy,
  rawRequirements: record.rawRequirements.map(requirement => ({ ...requirement })),
}));

const copiedRecipes = (recipes: readonly DeepReadonly<RouteRecipe>[]): RouteRecipe[] =>
  recipes.map(recipe => ({
    id: recipe.id,
    kind: recipe.kind,
    output: { ...recipe.output },
    outputQuantity: recipe.outputQuantity,
    ingredients: recipe.ingredients.map(ingredient => ({
      item: { ...ingredient.item },
      quantity: ingredient.quantity,
      alternatives: ingredient.alternatives?.map(alternative => ({ ...alternative })),
    })),
    tools: recipe.tools.map(tool => ({
      item: { ...tool.item },
      consumed: tool.consumed,
      alternatives: tool.alternatives?.map(alternative => ({ ...alternative })),
    })),
    stations: recipe.stations.map(station => ({
      entityKind: station.entityKind,
      names: [...station.names],
    })),
    gates: recipe.gates.map(gate => ({ ...gate })),
    deterministic: recipe.deterministic,
    sourceRevision: recipe.sourceRevision,
  }));

const copiedEntityLocations = (
  hits: readonly DeepReadonly<ExactEntityHit>[],
): ExactEntityHit[] => hits.map(hit => ({
  name: hit.name,
  kind: hit.kind,
  locations: hit.locations.map(location => ({ ...location })),
}));

const resolverSnapshotFrom = (
  snapshot: QuestRouteAnalysisSnapshot,
  fingerprint: string,
): { resolution: DirectRouteResolutionSnapshot; connectGraph: ConnectGraph } => {
  const records = copiedSourceRecords(snapshot.itemSourceRecords);
  const recipes = copiedRecipes(snapshot.recipes);
  const entityLocations = copiedEntityLocations(snapshot.entityLocations);
  const stationRequirements = snapshot.stationRequirements.map(requirement => ({
    name: requirement.name,
    kind: requirement.kind,
    chunk: requirement.chunk,
    rawRequirements: requirement.rawRequirements.map(evidence => ({ ...evidence })),
  }));
  const sourceCoverage = new Map(snapshot.sourceCoverage.map(coverage => [
    coverage.itemKey,
    { direct: coverage.direct, transformation: coverage.transformation },
  ]));
  const folded = (value: string): string => value.toLocaleLowerCase('en-GB');
  const unlockedChunks = new Set(snapshot.unlockedChunks);
  const recordsByItemName = new Map<string, {
    current: ItemSourceRecord[];
    advisory: ItemSourceRecord[];
  }>();
  for (const record of records) {
    const key = folded(record.itemName);
    const indexed = recordsByItemName.get(key) ?? { current: [], advisory: [] };
    const chunk = `${record.cx},${record.cy}` as ChunkKey;
    indexed[unlockedChunks.has(chunk) ? 'current' : 'advisory'].push(record);
    recordsByItemName.set(key, indexed);
  }
  const recipesByOutput = new Map<string, RouteRecipe[]>();
  for (const recipe of recipes) {
    const indexed = recipesByOutput.get(recipe.output.key) ?? [];
    indexed.push(recipe);
    recipesByOutput.set(recipe.output.key, indexed);
  }
  const entityKey = (name: string, kind: RouteStation['entityKind']): string => (
    `${kind}\0${folded(name)}`
  );
  const entityLocationByKey = new Map<string, {
    all: ExactEntityHit;
    current: ExactEntityHit;
    advisory: ExactEntityHit;
  }>();
  for (const hit of entityLocations) {
    const key = entityKey(hit.name, hit.kind);
    if (entityLocationByKey.has(key)) continue;
    const validLocations = hit.locations.filter(location => (
      Number.isInteger(location.cx) && Number.isInteger(location.cy)
    ));
    const currentLocations = validLocations.filter(location => (
      unlockedChunks.has(`${location.cx},${location.cy}` as ChunkKey)
    ));
    const advisoryLocations = validLocations.filter(location => (
      !unlockedChunks.has(`${location.cx},${location.cy}` as ChunkKey)
    ));
    entityLocationByKey.set(key, {
      all: { ...hit, locations: validLocations },
      current: { ...hit, locations: currentLocations },
      advisory: { ...hit, locations: advisoryLocations },
    });
  }
  const stationRequirementKey = (
    name: string,
    kind: RouteStation['entityKind'],
    chunk: ChunkKey,
  ): string => `${entityKey(name, kind)}\0${chunk}`;
  const stationRequirementsByKey = new Map<
    string,
    Array<(typeof stationRequirements)[number]>
  >();
  for (const requirement of stationRequirements) {
    const key = stationRequirementKey(requirement.name, requirement.kind, requirement.chunk);
    const indexed = stationRequirementsByKey.get(key) ?? [];
    indexed.push(requirement);
    stationRequirementsByKey.set(key, indexed);
  }
  const connectGraph: ConnectGraph = Object.fromEntries(
    Object.entries(snapshot.connectGraph).map(([from, destinations]) => [from, [...destinations]]),
  );

  return {
    resolution: {
      unlockedChunks,
      unlocks: resolverUnlocks(snapshot.unlocks),
      recordsForClass: (itemName, searchClass) => (
        recordsByItemName.get(folded(itemName))?.[searchClass] ?? []
      ),
      hasKnownOutsideSources: itemName => (
        (recordsByItemName.get(folded(itemName))?.advisory.length ?? 0) > 0
      ),
      sourceCoverage: itemKey => sourceCoverage.get(itemKey) ?? {
        direct: 'PARTIAL', transformation: 'PARTIAL',
      },
      recipesFor: itemKey => recipesByOutput.get(itemKey) ?? [],
      entityLocations: (name, kind) => (
        entityLocationByKey.get(entityKey(name, kind))?.all ?? null
      ),
      entityLocationsForPhase: (name, kind, phase) => {
        const indexed = entityLocationByKey.get(entityKey(name, kind));
        if (!indexed) return null;
        return phase === 'current' ? indexed.current : indexed.all;
      },
      hasAdvisoryEntityLocations: (name, kind) => (
        (entityLocationByKey.get(entityKey(name, kind))?.advisory.locations.length ?? 0) > 0
      ),
      stationRequirements: (name, kind, chunk) => (
        stationRequirementsByKey.get(stationRequirementKey(name, kind, chunk)) ?? []
      ).flatMap(requirement => (
        requirement.rawRequirements.map(evidence => ({ ...evidence }))
      )),
      connectGraph,
      fingerprint,
    },
    connectGraph,
  };
};

const clonePlain = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(entry => clonePlain(entry)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clonePlain(entry)]),
    ) as T;
  }
  return value;
};

const deepFreeze = <T>(value: T): DeepReadonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(entry => deepFreeze(entry));
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
};

const cacheGet = (key: string): QuestRouteAnalysis | undefined => {
  const cached = analysisCache.get(key);
  if (!cached) return undefined;
  analysisCache.delete(key);
  analysisCache.set(key, cached);
  return cached;
};

const cacheSet = (key: string, analysis: QuestRouteAnalysis): void => {
  analysisCache.set(key, analysis);
  while (analysisCache.size > CACHE_LIMIT) {
    const oldest = analysisCache.keys().next().value;
    if (oldest === undefined) break;
    analysisCache.delete(oldest);
  }
};

export const clearQuestRouteAnalysisCache = (): void => {
  analysisCache.clear();
};

const analyzeQuestItems = (
  questId: string,
  snapshot: QuestRouteAnalysisSnapshot,
): {
  readonly reviewed: NonNullable<ReturnType<typeof reviewedQuestRequirements>>;
  readonly items: readonly QuestItemRouteAnalysis[];
  readonly itemStatus: QuestRouteStatus;
  readonly accountFingerprint: string;
  readonly contentFingerprint: string;
} => {
  const reviewed = reviewedQuestRequirements(questId);
  if (!reviewed) throw new Error(`RuneProof has no reviewed item catalogue for ${questId}.`);

  const accountFingerprint = accountStateFingerprint(
    snapshot.gameModeId,
    snapshot.unlockedChunks,
    snapshot.unlocks,
  );
  const contentFingerprint = contentStateFingerprint(snapshot);

  const resolver = resolverSnapshotFrom(
    snapshot,
    `${accountFingerprint}\0${contentFingerprint}`,
  );
  const items = reviewed.items.map((requirement) => {
    const analysis = resolveItemRequirement(requirement, resolver.resolution);
    const currentRoutes = rankRoutes(analysis.currentRoutes, resolver.connectGraph);
    const missingChunkRoutes = rankRoutes(
      analysis.missingChunkRoutes,
      resolver.connectGraph,
    );
    return {
      ...analysis,
      currentRoutes,
      missingChunkRoutes,
      missingChunkOptions: minimalMissingChunkOptions(
        missingChunkRoutes,
        resolver.resolution.unlockedChunks,
      ),
    };
  });
  const itemStatus = questRouteStatusForItems(items);
  return {
    reviewed,
    items,
    itemStatus,
    accountFingerprint,
    contentFingerprint,
  };
};

export const analyzeQuestPreparation = (
  questId: string,
  snapshot: QuestRouteAnalysisSnapshot,
): QuestPreparationRouteAnalysis => {
  const {
    reviewed,
    items,
    itemStatus,
    accountFingerprint,
  } = analyzeQuestItems(questId, snapshot);
  return deepFreeze(clonePlain({
    questId,
    status: itemStatus,
    items,
    generatedFrom: {
      chunkDataVersion: snapshot.chunkDataVersion,
      questRevision: reviewed.wikiRevision,
      accountFingerprint,
    },
  })) as QuestPreparationRouteAnalysis;
};

export const analyzeQuest = (
  questId: string,
  snapshot: QuestRouteAnalysisSnapshot,
  walkthroughDefinition: QuestWalkthroughDefinition,
): QuestRouteAnalysis => {
  if (walkthroughDefinition.questId !== questId) {
    throw new Error(`RuneProof walkthrough identity does not match ${questId}.`);
  }
  const reviewedForCache = reviewedQuestRequirements(questId);
  if (!reviewedForCache) throw new Error(`RuneProof has no reviewed item catalogue for ${questId}.`);
  const accountFingerprintForCache = accountStateFingerprint(
    snapshot.gameModeId,
    snapshot.unlockedChunks,
    snapshot.unlocks,
  );
  const contentFingerprintForCache = contentStateFingerprint(snapshot);
  const cacheKey = JSON.stringify([
    questId,
    snapshot.chunkDataVersion,
    reviewedForCache.wikiRevision,
    walkthroughDefinition.revision,
    accountFingerprintForCache,
    contentFingerprintForCache,
  ]);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const { reviewed, items, itemStatus, accountFingerprint } = analyzeQuestItems(questId, snapshot);

  const resolvedWalkthrough = resolveQuestWalkthroughLocations(
    walkthroughDefinition,
    { entityLocations: snapshot.entityLocations },
  );
  const walkthrough = evaluateQuestWalkthrough(resolvedWalkthrough, snapshot, items);
  const analysis = deepFreeze(clonePlain({
    questId,
    status: combineQuestRouteStatus(itemStatus, walkthrough.status),
    items,
    walkthrough,
    generatedFrom: {
      chunkDataVersion: snapshot.chunkDataVersion,
      questRevision: reviewed.wikiRevision,
      walkthroughRevision: walkthroughDefinition.revision,
      accountFingerprint,
    },
  })) as QuestRouteAnalysis;
  cacheSet(cacheKey, analysis);
  return analysis;
};
