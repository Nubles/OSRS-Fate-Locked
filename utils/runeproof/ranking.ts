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
  for (const route of routes.map(cloneProofRoute).sort(compareRoutes)) {
    const key = displayKey(route);
    groups.set(key, [...(groups.get(key) ?? []), route]);
  }
  return Object.freeze([...groups.entries()].map(([key, groupedRoutes]) => {
    const representative = groupedRoutes[0];
    return deepFreeze({
      key,
      deterministic: representative.deterministic,
      prerequisiteCount: representative.prerequisiteCount,
      recursiveIngredientCount: representative.recursiveIngredientCount,
      travelDistance: representative.travelDistance,
      probability: representative.probability,
      routes: [...groupedRoutes],
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

function cloneProofRoute(route: ProofRoute): ProofRoute {
  return {
    id: route.id,
    deterministic: route.deterministic,
    prerequisiteCount: route.prerequisiteCount,
    recursiveIngredientCount: route.recursiveIngredientCount,
    travelDistance: route.travelDistance,
    probability: route.probability,
    witness: {
      rootFactId: route.witness.rootFactId,
      steps: Object.fromEntries(Object.entries(route.witness.steps).map(([id, step]) => [
        id,
        {
          ruleId: step.ruleId,
          proves: { ...step.proves },
          chosenTerms: [...step.chosenTerms],
          childStepIds: [...step.childStepIds],
        },
      ])),
      sourceVersion: route.witness.sourceVersion,
      runId: route.witness.runId,
      runRevision: route.witness.runRevision,
      proofHash: route.witness.proofHash,
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(child => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
}
