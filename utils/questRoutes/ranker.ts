import type { ConnectGraph } from '../../services/ChunkContentService';
import type { ChunkKey, ItemRoute } from './model';

export interface RouteTravelCost {
  travelCost: number;
  travelCostEstimated: boolean;
}

export type RankedRoute = ItemRoute & RouteTravelCost;

export const chunkKeyToRegionId = (chunk: ChunkKey): string => {
  const [cx, cy] = chunk.split(',').map(Number);
  return String(cx * 256 + cy);
};

const manhattanDistance = (left: ChunkKey, right: ChunkKey): number => {
  const [leftX, leftY] = left.split(',').map(Number);
  const [rightX, rightY] = right.split(',').map(Number);
  return Math.abs(leftX - rightX) + Math.abs(leftY - rightY);
};

const graphNeighbours = (graph: ConnectGraph): Map<string, Set<string>> => {
  const neighbours = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    const destinations = neighbours.get(from) ?? new Set<string>();
    destinations.add(to);
    neighbours.set(from, destinations);
  };

  for (const [from, destinations] of Object.entries(graph)) {
    for (const to of destinations) {
      add(from, to);
      add(to, from);
    }
  }
  return neighbours;
};

const shortestPathLength = (
  neighbours: ReadonlyMap<string, ReadonlySet<string>>,
  start: string,
  end: string,
): number | null => {
  if (start === end) return 0;
  if (!neighbours.has(start) || !neighbours.has(end)) return null;

  const visited = new Set([start]);
  const queue: Array<[string, number]> = [[start, 0]];
  for (let index = 0; index < queue.length; index += 1) {
    const [current, distance] = queue[index];
    for (const next of neighbours.get(current) ?? []) {
      if (next === end) return distance + 1;
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([next, distance + 1]);
    }
  }
  return null;
};

const travelCostForChunksWithNeighbours = (
  chunks: readonly ChunkKey[],
  neighbours: ReadonlyMap<string, ReadonlySet<string>>,
  distanceCache?: Map<string, number | null>,
): RouteTravelCost => {
  let travelCost = 0;
  let travelCostEstimated = false;

  for (let index = 1; index < chunks.length; index += 1) {
    const previous = chunks[index - 1];
    const next = chunks[index];
    const previousRegion = chunkKeyToRegionId(previous);
    const nextRegion = chunkKeyToRegionId(next);
    const cacheKey = previousRegion < nextRegion
      ? `${previousRegion}\0${nextRegion}`
      : `${nextRegion}\0${previousRegion}`;
    let graphDistance = distanceCache?.get(cacheKey);
    if (graphDistance === undefined) {
      graphDistance = shortestPathLength(neighbours, previousRegion, nextRegion);
      distanceCache?.set(cacheKey, graphDistance);
    }
    if (graphDistance === null) {
      travelCost += manhattanDistance(previous, next);
      travelCostEstimated = true;
    } else {
      travelCost += graphDistance;
    }
  }

  return { travelCost, travelCostEstimated };
};

const routeChunks = (route: Pick<ItemRoute, 'steps'>): ChunkKey[] => route.steps
  .reduce<ChunkKey[]>((collected, step) => {
    if (step.chunk && collected[collected.length - 1] !== step.chunk) collected.push(step.chunk);
    return collected;
  }, []);

/** Computes travel between route-step chunks without assuming a player origin. */
export const travelCostForRoute = (
  route: Pick<ItemRoute, 'steps'>,
  graph: ConnectGraph = {},
): RouteTravelCost => travelCostForChunksWithNeighbours(routeChunks(route), graphNeighbours(graph));

export type RouteRankTuple = readonly [
  number, number, number, number, number, number, number, number, string,
];

export const routeRankTuple = (route: ItemRoute): RouteRankTuple => [
  route.blockers.length === 0 && !route.hasDataGap
    ? 0
    : !route.hasDataGap
      ? 1
      : 2,
  route.deterministic ? 0 : 1,
  route.recursiveCost,
  route.consumedIngredientCost,
  route.skillUnlockCost,
  route.skillLevelCost,
  route.travelCost,
  route.probability == null ? 1 : -route.probability,
  route.id,
] as const;

export const compareRouteRankTuples = (left: RouteRankTuple, right: RouteRankTuple): number => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
};

export interface PreparedRouteRanker {
  evaluate(route: ItemRoute): ItemRoute;
  travelCostForChunks(chunks: readonly ChunkKey[]): RouteTravelCost;
  rank(routes: readonly ItemRoute[]): ItemRoute[];
}

/** Prepares graph neighbours and chunk-pair distances once for a resolver query. */
export const prepareRouteRanker = (graph?: ConnectGraph): PreparedRouteRanker => {
  const neighbours = graph === undefined ? null : graphNeighbours(graph);
  const distanceCache = new Map<string, number | null>();
  const travelCostForChunks = (chunks: readonly ChunkKey[]): RouteTravelCost => (
    neighbours === null
      ? { travelCost: 0, travelCostEstimated: false }
      : travelCostForChunksWithNeighbours(chunks, neighbours, distanceCache)
  );
  const evaluate = (route: ItemRoute): ItemRoute => neighbours === null
    ? route
    : { ...route, ...travelCostForChunks(routeChunks(route)) };
  return {
    evaluate,
    travelCostForChunks,
    rank: routes => routes
      .map(evaluate)
      .sort((left, right) => compareRouteRankTuples(routeRankTuple(left), routeRankTuple(right))),
  };
};

/** Ranks routes by the approved lexicographic policy without mutating input. */
export const rankRoutes = (routes: readonly ItemRoute[], graph?: ConnectGraph): ItemRoute[] => (
  prepareRouteRanker(graph).rank(routes)
);

export interface RouteRankContext {
  readonly origin?: ChunkKey;
}

type FallbackRouteRankTuple = readonly [
  number, number, number, number, number, number, number, number, number, string,
];

const firstRouteChunkForFallback = (
  route: Pick<ItemRoute, 'chunks' | 'steps'>,
): ChunkKey | undefined => routeChunks(route)[0] ?? route.chunks[0];

const fallbackRouteRankTuple = (
  route: ItemRoute,
  originTravelCost: number,
): FallbackRouteRankTuple => [
  route.blockers.length === 0 && !route.hasDataGap
    ? 0
    : !route.hasDataGap
      ? 1
      : 2,
  route.deterministic ? 0 : 1,
  originTravelCost + route.travelCost,
  route.recursiveCost,
  route.consumedIngredientCost,
  route.skillUnlockCost,
  route.skillLevelCost,
  route.sourceKind === 'DROP' ? 1 : 0,
  route.probability == null ? 1 : -route.probability,
  route.id,
] as const;

const compareFallbackRouteRankTuples = (
  left: FallbackRouteRankTuple,
  right: FallbackRouteRankTuple,
): number => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
};

/** Ranks secondary fallback routes from an optional prior reviewed action origin. */
export const rankFallbackRoutes = (
  routes: readonly ItemRoute[],
  graph: ConnectGraph | undefined,
  context: RouteRankContext = {},
): ItemRoute[] => {
  const preparedRanker = prepareRouteRanker(graph);
  const neighbours = graphNeighbours(graph ?? {});
  const distanceCache = new Map<string, number | null>();

  return routes
    .map(route => {
      const evaluated = preparedRanker.evaluate(route);
      const firstRouteChunk = firstRouteChunkForFallback(evaluated);
      const originTravelCost = context.origin && firstRouteChunk
        ? travelCostForChunksWithNeighbours(
          [context.origin, firstRouteChunk],
          neighbours,
          distanceCache,
        ).travelCost
        : 0;
      return { route: evaluated, tuple: fallbackRouteRankTuple(evaluated, originTravelCost) };
    })
    .sort((left, right) => compareFallbackRouteRankTuples(left.tuple, right.tuple))
    .map(({ route }) => route);
};
