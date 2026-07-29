import type { ProofRoute } from './model';

export function compareRoutes(a: ProofRoute, b: ProofRoute): number {
  return Number(b.deterministic) - Number(a.deterministic)
    || a.prerequisiteCount - b.prerequisiteCount
    || a.recursiveIngredientCount - b.recursiveIngredientCount
    || a.travelDistance - b.travelDistance
    || (b.probability ?? 0) - (a.probability ?? 0)
    || a.id.localeCompare(b.id);
}

export interface ProofRouteDisplayGroup {
  readonly key: string;
  readonly deterministic: boolean;
  readonly prerequisiteCount: number;
  readonly recursiveIngredientCount: number;
  readonly travelDistance: number;
  readonly probability: number | null;
  readonly routes: readonly ProofRoute[];
}

export function groupEquivalentRoutes(
  routes: readonly ProofRoute[],
): readonly ProofRouteDisplayGroup[] {
  const groups = new Map<string, ProofRoute[]>();
  for (const route of [...routes].sort(compareRoutes)) {
    const key = displayKey(route);
    groups.set(key, [...(groups.get(key) ?? []), route]);
  }
  return Object.freeze([...groups.entries()].map(([key, groupedRoutes]) => {
    const representative = groupedRoutes[0];
    return Object.freeze({
      key,
      deterministic: representative.deterministic,
      prerequisiteCount: representative.prerequisiteCount,
      recursiveIngredientCount: representative.recursiveIngredientCount,
      travelDistance: representative.travelDistance,
      probability: representative.probability,
      routes: Object.freeze([...groupedRoutes]),
    });
  }));
}

function displayKey(route: ProofRoute): string {
  return [
    route.deterministic ? 'deterministic' : 'rng',
    route.prerequisiteCount,
    route.recursiveIngredientCount,
    route.travelDistance,
    route.probability === null ? 'unknown' : route.probability,
  ].join('|');
}
