import type { UnlockState } from '../types';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';
import { evaluatePredicate, type RequirementPredicate, type PredicateResult } from './requirementPredicates';

type Coordinate = { cx: number; cy: number };
export interface ChunkQuestLocation { id: string; label: string; chunkOptions: Coordinate[] }
export interface ChunkQuestRoute {
  id: string;
  label: string;
  locations: ChunkQuestLocation[];
  unknowns?: string[];
  requirements?: RequirementPredicate[];
}
export interface ChunkQuestGeography {
  locations: ChunkQuestLocation[];
  groups: { id: string; label: string; routes: ChunkQuestRoute[] }[];
  unknowns: string[];
}
export interface ChunkQuestGeographyResult { blockers: string[]; evidence: string[]; unknowns: string[] }

const validCoordinate = (point: Coordinate): boolean => !!point
  && Number.isInteger(point.cx) && Number.isInteger(point.cy)
  && point.cx >= 0 && point.cx <= 255 && point.cy >= 0 && point.cy <= 255;
const unique = (values: string[]): string[] => [...new Set(values)];
const unknownLabels = (values: string[] = []): string[] => values.map(value =>
  typeof value === 'string' && value.trim() ? value : 'Unknown quest geography requirement');
type Assessment = ChunkQuestGeographyResult & { status: 'met' | 'blocked' | 'unknown' };
const assessLocation = (location: ChunkQuestLocation, owned: (cx: number, cy: number) => boolean): Assessment => {
  const options = location.chunkOptions ?? [];
  const valid = options.filter(validCoordinate);
  if (valid.some(point => owned(point.cx, point.cy))) {
    return { status: 'met', blockers: [], evidence: [location.label], unknowns: [] };
  }
  if (!options.length || valid.length !== options.length) {
    return { status: 'unknown', blockers: [], evidence: [], unknowns: [`${location.label}: unverified chunk coordinates`] };
  }
  return { status: 'blocked', blockers: [location.label], evidence: [], unknowns: [] };
};
export function evaluateChunkRouteRequirements(route: ChunkQuestRoute, unlocks?: UnlockState): PredicateResult {
  if (route.requirements !== undefined && !Array.isArray(route.requirements)) return { status: 'UNKNOWN', checks: [`${route.label}: invalid route requirements`] };
  if (!route.requirements?.length) return { status: 'READY', checks: [] };
  if (!unlocks) return { status: 'UNKNOWN', checks: [`${route.label}: route permissions need the current run state`] };
  // Route identity, inventory and observations must not be manufactured as confirmations.
  return evaluatePredicate({ kind: 'all', of: route.requirements }, { unlocks, gameModeId: 'chunked' });
}
const assessRoute = (route: ChunkQuestRoute, owned: (cx: number, cy: number) => boolean, unlocks?: UnlockState): Assessment => {
  const locations = (route.locations ?? []).map(location => assessLocation(location, owned));
  const permissions = evaluateChunkRouteRequirements(route, unlocks);
  const blockers = [...locations.flatMap(location => location.blockers), ...(permissions.status === 'LOCKED' ? permissions.checks : [])];
  const unknowns = [...unknownLabels(route.unknowns), ...locations.flatMap(location => location.unknowns), ...(['UNKNOWN', 'NEEDS_CONFIRMATION'].includes(permissions.status) ? permissions.checks : [])];
  if (!locations.length && !route.requirements?.length && !unknowns.length) unknowns.push(`${route.label}: route has no verified requirements`);
  return {
    status: blockers.length ? 'blocked' : unknowns.length ? 'unknown' : 'met',
    blockers, unknowns, evidence: locations.flatMap(location => location.evidence),
  };
};

/** Fixed destinations and groups are AND; coordinates and complete routes are OR.
 * Uses the current Chunked ownership rules, including the always-free start chunk.
 */
export function evaluateChunkQuestGeography(
  data: ChunkQuestGeography,
  unlocks: Pick<UnlockState, 'chunks'>,
  routeUnlocks?: UnlockState,
): ChunkQuestGeographyResult {
  const owned = (cx: number, cy: number) => isChunkUnlocked(chunkKey({ cx, cy }), unlocks.chunks ?? []);
  const fixed = (data.locations ?? []).map(location => assessLocation(location, owned));
  const result: ChunkQuestGeographyResult = {
    blockers: fixed.flatMap(location => location.blockers),
    evidence: fixed.flatMap(location => location.evidence),
    unknowns: [...unknownLabels(data.unknowns), ...fixed.flatMap(location => location.unknowns)],
  };
  for (const group of data.groups ?? []) {
    const routes = (group.routes ?? []).map(route => assessRoute(route, owned, routeUnlocks));
    const met = routes.find(route => route.status === 'met');
    if (met) result.evidence.push(group.label, ...met.evidence);
    else if (!routes.length) result.unknowns.push(`${group.label}: no verified routes`);
    else {
      const unknown = routes.filter(route => route.status === 'unknown');
      if (unknown.length) result.unknowns.push(...unknown.flatMap(route => route.unknowns));
      else result.blockers.push(`${group.label}: one complete route required`);
    }
  }
  if (!fixed.length && !(data.groups?.length) && !result.unknowns.length) {
    result.unknowns.push('No verified quest chunk geography');
  }
  return { blockers: unique(result.blockers), evidence: unique(result.evidence), unknowns: unique(result.unknowns) };
}

/** Reachable keys are region IDs, String(cx * 256 + cy), NOT saved "cx,cy" keys.
 * Returns one coordinate per selected destination for questChunkStatus. Selects
 * a whole route, never pieces of different branches. Canonical evaluation above
 * remains responsible for unknown requirements; this selector only maps travel.
 */
export function chooseChunkQuestLocations(
  data: ChunkQuestGeography,
  reachable: Set<string>,
  isUnlocked: (cx: number, cy: number) => boolean,
  routeUnlocks?: UnlockState,
): Coordinate[] {
  const canReach = (point: Coordinate) => reachable.has(String(point.cx * 256 + point.cy));
  const choose = (locations: ChunkQuestLocation[]): Coordinate[] => locations.flatMap(location => {
    const options = (location.chunkOptions ?? []).filter(validCoordinate);
    const point = options.find(candidate => isUnlocked(candidate.cx, candidate.cy) && canReach(candidate))
      ?? options.find(candidate => isUnlocked(candidate.cx, candidate.cy)) ?? options[0];
    return point ? [point] : [];
  });
  const selected = choose(data.locations ?? []);
  for (const group of data.groups ?? []) {
    const routes = (group.routes ?? []).map(route => ({
      status: assessRoute(route, isUnlocked, routeUnlocks).status,
      permitted: evaluateChunkRouteRequirements(route, routeUnlocks).status !== 'LOCKED',
      points: choose(route.locations ?? []),
    }));
    // A known satisfied alternative proves the group. An unverified empty
    // alternative must not hide that proven route's stranded destinations.
    const candidates = routes.filter(route => route.permitted);
    const pool = candidates.some(route => route.status === 'met') ? candidates.filter(route => route.status === 'met')
      : candidates.some(route => route.status === 'unknown') ? candidates.filter(route => route.status === 'unknown') : candidates;
    const score = (points: Coordinate[]) => [
      points.filter(point => !isUnlocked(point.cx, point.cy)).length,
      points.filter(point => !canReach(point)).length,
    ];
    pool.sort((a, b) => {
      const left = score(a.points), right = score(b.points);
      return left[0] - right[0] || left[1] - right[1];
    });
    if (pool[0]) selected.push(...pool[0].points);
  }
  return [...new Map(selected.map(point => [chunkKey(point), point])).values()];
}
