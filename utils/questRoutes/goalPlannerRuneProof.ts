import { ALL_CHUNK_KEYS, CHUNKED_START_KEY, parseChunkKey } from '../chunkAdjacency';
import { chunkUnlocked } from '../chunkLocations';
import { reviewedQuestRequirements } from '../../data/questItemRequirements';
import {
  routeRecipes,
  transformationCoverageFor,
  type ExactEntityHit,
  type RouteRecipe,
} from '../../data/questRouteRecipes';
import { collectWalkthroughEntityRequests } from '../questWalkthroughs/entityRequests';
import type { QuestWalkthroughDefinition } from '../questWalkthroughs/model';
import type {
  QuestRouteAnalysisSnapshot,
  QuestRouteStationRequirement,
  RuneProofRouteAnalysis,
} from './analyzeQuest';
import type { RuneProofAvailability } from './featureFlag';
import type { QuestWalkthroughRelease } from '../../data/questWalkthroughRelease';
import type {
  ConnectGraph,
  EntityHit,
  EntityKind,
  ItemSourceRecord,
} from '../../services/ChunkContentService';
import type { UnlockState } from '../../types';

export interface RuneProofContentService {
  init(): Promise<boolean>;
  itemSourceRecords(itemName: string): readonly ItemSourceRecord[];
  itemSourceCoverage(itemName: string): 'COMPLETE' | 'PARTIAL';
  entityLocations(name: string, kinds?: EntityKind[]): EntityHit | null;
  taskRequirements(name: string, kind: EntityKind, cx: number, cy: number): string[];
  chunkEntryRequirements(cx: number, cy: number): string[];
  connectGraph(): ConnectGraph;
}

export interface RuneProofIntegration {
  availability: RuneProofAvailability;
  chunkDataVersion: number;
  contentService: RuneProofContentService;
  analyze: (
    questId: string,
    snapshot: QuestRouteAnalysisSnapshot,
    walkthrough: QuestWalkthroughDefinition,
  ) => RuneProofRouteAnalysis;
  loadWalkthrough?: (
    availability: RuneProofAvailability,
    release: QuestWalkthroughRelease,
  ) => Promise<QuestWalkthroughDefinition | undefined>;
  walkthroughReleaseFor?: (questId: string) => QuestWalkthroughRelease | undefined;
}

export interface RuneProofRequestIdentity {
  readonly key: string;
  readonly questId: string;
  readonly walkthroughRelease: QuestWalkthroughRelease;
}

export type RuneProofRenderState =
  | { request: RuneProofRequestIdentity; analysis: RuneProofRouteAnalysis; unavailable: false }
  | { request: RuneProofRequestIdentity; analysis: null; unavailable: true };

const compareCodeUnit = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

type RuneProofAccountSnapshot = Pick<
  QuestRouteAnalysisSnapshot,
  'gameModeId' | 'unlockedChunks' | 'unlocks'
>;

const normalizedList = (values: readonly string[]): string[] => (
  [...new Set(values)].sort(compareCodeUnit)
);

const normalizedLevels = (
  levels: Readonly<Record<string, number>>,
): readonly (readonly [string, number])[] => (
  Object.entries(levels).sort(([left], [right]) => compareCodeUnit(left, right))
);

export const materializeRuneProofAccount = (
  unlocks: UnlockState,
  gameModeId: string | undefined,
): RuneProofAccountSnapshot => {
  const unlockedChunks = gameModeId === 'chunked'
    ? normalizedList([CHUNKED_START_KEY, ...(unlocks.chunks ?? [])])
    : ALL_CHUNK_KEYS.filter((key) => {
      const { cx, cy } = parseChunkKey(key);
      return chunkUnlocked(cx, cy, unlocks, gameModeId);
    });

  return {
    gameModeId,
    unlockedChunks: unlockedChunks as QuestRouteAnalysisSnapshot['unlockedChunks'],
    unlocks: {
      skills: { ...unlocks.skills },
      levels: { ...unlocks.levels },
      regions: [...unlocks.regions],
      chunks: [...(unlocks.chunks ?? [])],
      quests: [...unlocks.quests],
      guilds: [...unlocks.guilds],
      merchants: [...unlocks.merchants],
      minigames: [...unlocks.minigames],
      mobility: [...unlocks.mobility],
      slayerUnlocks: [...unlocks.slayerUnlocks],
    },
  };
};

export const canonicalRuneProofAccountIdentity = (account: RuneProofAccountSnapshot): object => ({
  gameModeId: account.gameModeId ?? null,
  unlockedChunks: normalizedList(account.unlockedChunks),
  skills: normalizedLevels(account.unlocks.skills),
  levels: normalizedLevels(account.unlocks.levels),
  regions: normalizedList(account.unlocks.regions),
  chunks: normalizedList(account.unlocks.chunks),
  quests: normalizedList(account.unlocks.quests),
  guilds: normalizedList(account.unlocks.guilds),
  merchants: normalizedList(account.unlocks.merchants),
  minigames: normalizedList(account.unlocks.minigames),
  mobility: normalizedList(account.unlocks.mobility),
  slayerUnlocks: normalizedList(account.unlocks.slayerUnlocks),
});

export const materializeQuestRouteSnapshot = (
  questId: string,
  account: RuneProofAccountSnapshot,
  contentService: RuneProofContentService,
  chunkDataVersion: number,
  walkthrough: QuestWalkthroughDefinition,
): QuestRouteAnalysisSnapshot => {
  const catalogue = reviewedQuestRequirements(questId);
  if (!catalogue) throw new Error(`RuneProof has no reviewed item catalogue for ${questId}.`);

  const pending = catalogue.items.flatMap(requirement => [
    requirement.item,
    ...(requirement.alternatives ?? []),
  ]);
  const visitedItems = new Set<string>();
  const records = new Map<string, ItemSourceRecord>();
  const recipes = new Map<string, RouteRecipe>();
  const sourceCoverage = new Map<string, QuestRouteAnalysisSnapshot['sourceCoverage'][number]>();

  while (pending.length > 0) {
    const item = pending.shift()!;
    if (visitedItems.has(item.key)) continue;
    visitedItems.add(item.key);
    sourceCoverage.set(item.key, {
      itemKey: item.key,
      direct: contentService.itemSourceCoverage(item.name),
      transformation: transformationCoverageFor(item.key),
    });

    contentService.itemSourceRecords(item.name).forEach((record) => {
      const id = [record.itemName, record.kind, record.hostName, record.cx, record.cy].join('\0');
      if (!records.has(id)) {
        records.set(id, {
          ...record,
          rawRequirements: record.rawRequirements.map(requirement => ({ ...requirement })),
        });
      }
    });

    routeRecipes.filter(recipe => recipe.output.key === item.key).forEach((recipe) => {
      if (recipes.has(recipe.id)) return;
      recipes.set(recipe.id, recipe);
      recipe.ingredients.forEach((ingredient) => {
        pending.push(ingredient.item, ...(ingredient.alternatives ?? []));
      });
      recipe.tools.forEach((tool) => {
        pending.push(tool.item, ...(tool.alternatives ?? []));
      });
    });
  }

  const reviewedRecipes = [...recipes.values()].sort((left, right) => compareCodeUnit(left.id, right.id));
  const entityLocations: ExactEntityHit[] = [];
  const stationRequirements: QuestRouteStationRequirement[] = [];
  const seenEntityHits = new Set<string>();
  const entityHitCache = new Map<string, EntityHit | null>();
  const normalizeEntityName = (name: string): string => (
    name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB')
  );
  const exactEntityHit = (name: string, kind: EntityKind): EntityHit | null => {
    const entityId = `${kind}\0${normalizeEntityName(name)}`;
    if (entityHitCache.has(entityId)) return entityHitCache.get(entityId)!;
    const candidate = contentService.entityLocations(name, [kind]);
    const hit = candidate !== null
      && candidate.kind === kind
      && normalizeEntityName(candidate.name) === normalizeEntityName(name)
      ? candidate
      : null;
    entityHitCache.set(entityId, hit);
    return hit;
  };
  const appendEntityHit = (hit: EntityHit): void => {
    const entityId = `${hit.kind}\0${normalizeEntityName(hit.name)}`;
    if (seenEntityHits.has(entityId)) return;
    seenEntityHits.add(entityId);
    entityLocations.push({
      name: hit.name,
      kind: hit.kind as ExactEntityHit['kind'],
      locations: hit.locations
        .map(location => ({ cx: location.cx, cy: location.cy }))
        .sort((left, right) => left.cx - right.cx || left.cy - right.cy),
    });
  };

  reviewedRecipes.forEach((recipe) => recipe.stations.forEach((station) => {
    station.names.forEach((name) => {
      const hit = exactEntityHit(name, station.entityKind);
      if (hit === null) return;
      appendEntityHit(hit);

      hit.locations.forEach((location) => {
        const rawRequirements = [
          ...contentService
            .taskRequirements(hit.name, hit.kind, location.cx, location.cy)
            .map(raw => ({ raw, origin: 'ENTITY' as const })),
          ...contentService
            .chunkEntryRequirements(location.cx, location.cy)
            .map(raw => ({ raw, origin: 'CHUNK_ENTRY' as const })),
        ];
        stationRequirements.push({
          name: hit.name,
          kind: station.entityKind,
          chunk: `${location.cx},${location.cy}`,
          rawRequirements,
        });
      });
    });
  }));

  collectWalkthroughEntityRequests(walkthrough).forEach(({ name, kind }) => {
    const hit = exactEntityHit(name, kind);
    if (hit !== null) appendEntityHit(hit);
  });
  entityLocations.sort((left, right) => (
    compareCodeUnit(left.kind, right.kind)
    || compareCodeUnit(normalizeEntityName(left.name), normalizeEntityName(right.name))
    || compareCodeUnit(left.name, right.name)
  ));

  const connectGraph = Object.fromEntries(
    Object.entries(contentService.connectGraph()).map(([from, destinations]) => (
      [from, [...destinations]]
    )),
  );
  return {
    ...account,
    chunkDataVersion,
    itemSourceRecords: [...records.values()],
    recipes: reviewedRecipes,
    entityLocations,
    stationRequirements,
    sourceCoverage: [...sourceCoverage.values()],
    connectGraph,
  };
};
