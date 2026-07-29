import type { RuneProofRunSnapshot } from '../../types';
import {
  assertRequirementExpr,
  type Coverage,
  type FactRef,
  type RequirementExpr,
} from './model';
import { placeOf } from '../chunkLocations';
import { isRegionUnlockedForRules } from '../reachability';
import { effectiveSkillLevel } from './effectiveSkillLevel';
import { resolveModeRules, type GameModeRules } from '../../config/gameModes';

export interface LocationNodeSource {
  id: string;
  label: string;
  surfaceChunk: string;
  parentId?: string;
  coverage: 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
}

export interface LocationEdgeSource {
  id: string;
  from: string;
  to: string;
  requirements: RequirementExpr;
  bidirectional: boolean;
  provenanceIds: string[];
}

export interface LocationGraph {
  startNodeId: string;
  nodes: readonly LocationNodeSource[];
  edges: readonly LocationEdgeSource[];
}

export interface ReviewedTravelAuditEntry {
  id: string;
  coverage: 'VERIFIED';
  edgeIds: string[];
}

export interface ReviewedTravelAuditCatalog {
  schemaVersion: 1;
  entries: ReviewedTravelAuditEntry[];
}

export interface BoundReviewedLocationGraph {
  locationGraph: LocationGraph;
  travelAuditCatalog: ReviewedTravelAuditCatalog;
}

export interface ReachabilityResult {
  reachable: ReadonlySet<string>;
  strandedSurfaceChunks: ReadonlySet<string>;
  distance: ReadonlyMap<string, number>;
  predecessorEdge: ReadonlyMap<string, string>;
  coverage: Coverage;
}

interface Traversal {
  edge: LocationEdgeSource;
  to: string;
}

interface ValidatedGraph {
  nodes: ReadonlyMap<string, LocationNodeSource>;
  edges: readonly LocationEdgeSource[];
  coverage: Coverage;
}

export interface ValidatedLocationNodes {
  nodes: ReadonlyMap<string, LocationNodeSource>;
  surfaceNodes: ReadonlyMap<string, LocationNodeSource>;
  coverage: Coverage;
}

export function validateLocationNodes(
  sourceNodes: readonly unknown[],
): ValidatedLocationNodes {
  let valid = Array.isArray(sourceNodes);
  const nodeCounts = countStringIds(sourceNodes);
  const candidateNodes = new Map<string, LocationNodeSource>();

  for (const value of sourceNodes) {
    if (!isLocationNode(value) || nodeCounts.get(value.id) !== 1) {
      valid = false;
      continue;
    }
    candidateNodes.set(value.id, value);
  }

  const invalid = invalidParentIds(candidateNodes);
  for (const node of candidateNodes.values()) {
    if (node.parentId) {
      const parent = candidateNodes.get(node.parentId);
      if (parent && node.surfaceChunk !== parent.surfaceChunk) invalid.add(node.id);
    }
  }
  const surfaceOwners = new Map<string, string[]>();
  for (const node of candidateNodes.values()) {
    if (!node.parentId) {
      surfaceOwners.set(node.surfaceChunk, [
        ...(surfaceOwners.get(node.surfaceChunk) ?? []), node.id,
      ]);
    }
  }
  for (const ownerIds of surfaceOwners.values()) {
    if (ownerIds.length > 1) ownerIds.forEach(id => invalid.add(id));
  }
  if (invalid.size > 0) valid = false;

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of candidateNodes.values()) {
      if (node.parentId && invalid.has(node.parentId) && !invalid.has(node.id)) {
        invalid.add(node.id);
        changed = true;
      }
    }
  }

  const nodes = new Map([...candidateNodes].filter(([id]) => !invalid.has(id)));
  const surfaceNodes = new Map(
    [...nodes.values()].filter(node => !node.parentId)
      .map(node => [node.surfaceChunk, node]),
  );
  return { nodes, surfaceNodes, coverage: valid ? 'VERIFIED' : 'UNKNOWN' };
}

export function bindReviewedLocationGraph(
  graph: LocationGraph,
  catalog: ReviewedTravelAuditCatalog,
): BoundReviewedLocationGraph {
  if (!hasExactKeys(graph, ['startNodeId', 'nodes', 'edges'])) {
    throw new Error('Invalid reviewed travel graph shape');
  }
  for (const node of graph.nodes ?? []) {
    const nodeKeys = node.parentId === undefined
      ? ['id', 'label', 'surfaceChunk', 'coverage']
      : ['id', 'label', 'surfaceChunk', 'parentId', 'coverage'];
    if (!hasExactKeys(node, nodeKeys)) {
      throw new Error('Invalid reviewed travel node shape');
    }
  }
  for (const edge of graph.edges ?? []) {
    if (!hasExactKeys(edge, [
      'id', 'from', 'to', 'requirements', 'bidirectional', 'provenanceIds',
    ]) || !requirementHasExactShape(edge.requirements)) {
      throw new Error('Invalid reviewed travel edge shape');
    }
  }

  const validated = validateGraph(graph);
  if (validated.coverage !== 'VERIFIED') {
    throw new Error('Reviewed travel graph is not fully validated');
  }
  if (!hasExactKeys(catalog, ['schemaVersion', 'entries'])
    || catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries)) {
    throw new Error('Invalid reviewed travel-audit catalog');
  }

  const entryIds = countStringIds(catalog.entries);
  const canonicalEntries = catalog.entries.map((entry) => {
    if (!hasExactKeys(entry, ['id', 'coverage', 'edgeIds'])
      || entryIds.get(entry.id) !== 1 || entry.coverage !== 'VERIFIED'
      || !Array.isArray(entry.edgeIds) || entry.edgeIds.length === 0
      || !entry.edgeIds.every(isNonEmptyString)
      || new Set(entry.edgeIds).size !== entry.edgeIds.length) {
      throw new Error('Invalid reviewed travel-audit catalog entry');
    }
    return {
      id: entry.id,
      coverage: entry.coverage,
      edgeIds: [...entry.edgeIds].sort(compareText),
    };
  }).sort((left, right) => compareText(left.id, right.id));

  const auditById = new Map(canonicalEntries.map(entry => [entry.id, entry]));
  const canonicalEdges = validated.edges.map(edge => ({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    requirements: cloneRequirement(edge.requirements),
    bidirectional: edge.bidirectional,
    provenanceIds: [...edge.provenanceIds].sort(compareText),
  }));
  for (const edge of canonicalEdges) {
    if (new Set(edge.provenanceIds).size !== edge.provenanceIds.length
      || edge.provenanceIds.some(id => !auditById.has(id))) {
      throw new Error(`Reviewed travel provenance is missing for edge ${edge.id}`);
    }
  }
  for (const entry of canonicalEntries) {
    const claimed = canonicalEdges
      .filter(edge => edge.provenanceIds.includes(entry.id))
      .map(edge => edge.id)
      .sort(compareText);
    if (!sameStrings(entry.edgeIds, claimed)) {
      throw new Error(`Reviewed travel edge binding mismatch for ${entry.id}`);
    }
  }

  return {
    locationGraph: {
      startNodeId: graph.startNodeId,
      nodes: [...validated.nodes.values()]
        .sort((left, right) => compareText(left.id, right.id))
        .map(node => ({
          id: node.id,
          label: node.label,
          surfaceChunk: node.surfaceChunk,
          ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
          coverage: node.coverage,
        })),
      edges: canonicalEdges,
    },
    travelAuditCatalog: {
      schemaVersion: 1,
      entries: canonicalEntries,
    },
  };
}

export function calculateReachability(
  graph: LocationGraph,
  snapshot: RuneProofRunSnapshot,
): ReachabilityResult {
  const validated = validateGraph(graph);
  let coverage = validated.coverage;
  if (!modeRules(snapshot)) coverage = 'UNKNOWN';
  const nodes = validated.nodes;
  const traversals = new Map<string, Traversal[]>();

  for (const edge of validated.edges) {
    addTraversal(traversals, edge.from, { edge, to: edge.to });
    if (edge.bidirectional) {
      addTraversal(traversals, edge.to, { edge, to: edge.from });
    }
  }

  const reachable = new Set<string>();
  const distance = new Map<string, number>();
  const predecessorEdge = new Map<string, string>();
  const start = nodes.get(graph?.startNodeId);
  const queue: string[] = [];

  if (start && !start.parentId
    && (chunkGranularity(snapshot) || surfaceLocationOwned(start, snapshot))) {
    reachable.add(start.id);
    distance.set(start.id, 0);
    queue.push(start.id);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const from = queue[cursor];
    for (const traversal of traversals.get(from) ?? []) {
      if (reachable.has(traversal.to)
        || !requirementsSatisfied(traversal.edge.requirements, snapshot)) {
        continue;
      }
      const target = nodes.get(traversal.to);
      if (!target || !locationOwned(target, reachable, snapshot)) {
        continue;
      }
      reachable.add(target.id);
      distance.set(target.id, (distance.get(from) ?? 0) + 1);
      predecessorEdge.set(target.id, traversal.edge.id);
      queue.push(target.id);
    }
  }

  const authoredSurfaceChunks = new Set(
    [...nodes.values()]
      .filter((location) => !location.parentId)
      .map((location) => location.surfaceChunk),
  );
  const ownedSurfaceChunks = chunkGranularity(snapshot)
    ? new Set(snapshot.unlockedChunks)
    : new Set([...nodes.values()]
      .filter(location => !location.parentId
        && surfaceLocationOwned(location, snapshot))
      .map(location => location.surfaceChunk));
  if (chunkGranularity(snapshot)
    && [...ownedSurfaceChunks].some((chunk) => !authoredSurfaceChunks.has(chunk))) {
    coverage = 'UNKNOWN';
  }
  if (start && !start.parentId) {
    ownedSurfaceChunks.add(start.surfaceChunk);
  }

  const reachableSurfaceChunks = new Set(
    [...reachable]
      .map((id) => nodes.get(id))
      .filter((location): location is LocationNodeSource => Boolean(location && !location.parentId))
      .map((location) => location.surfaceChunk),
  );
  const strandedSurfaceChunks = new Set(
    [...ownedSurfaceChunks].filter((chunk) => !reachableSurfaceChunks.has(chunk)),
  );

  return {
    reachable,
    strandedSurfaceChunks,
    distance,
    predecessorEdge,
    coverage,
  };
}

/**
 * Identifies the first known missing surface chunks on requirement-satisfied
 * paths from the current reachable set to the supplied target locations.
 *
 * This is an explanation helper, not an unlock recommendation or a proof that
 * the targets are globally impossible. It deliberately returns nothing when
 * the graph or account mode cannot support exact chunk reasoning.
 */
export function missingSurfaceChunksForTargets(
  graph: LocationGraph,
  snapshot: RuneProofRunSnapshot,
  targetIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const validated = validateGraph(graph);
  if (validated.coverage !== 'VERIFIED' || !chunkGranularity(snapshot)) {
    return new Set();
  }

  const reachability = calculateReachability(graph, snapshot);
  if (reachability.coverage !== 'VERIFIED') return new Set();

  const traversals: Array<{ from: string; to: string }> = [];
  for (const edge of validated.edges) {
    if (!requirementsSatisfied(edge.requirements, snapshot)) continue;
    traversals.push({ from: edge.from, to: edge.to });
    if (edge.bidirectional) traversals.push({ from: edge.to, to: edge.from });
  }

  const reverse = new Map<string, string[]>();
  for (const traversal of traversals) {
    const previous = reverse.get(traversal.to);
    if (previous) previous.push(traversal.from);
    else reverse.set(traversal.to, [traversal.from]);
  }

  const ancestors = new Set(
    [...targetIds].filter(targetId => validated.nodes.has(targetId)),
  );
  const queue = [...ancestors];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const predecessor of reverse.get(queue[cursor]) ?? []) {
      if (ancestors.has(predecessor)) continue;
      ancestors.add(predecessor);
      queue.push(predecessor);
    }
  }

  const missing = new Set<string>();
  for (const traversal of traversals) {
    if (!reachability.reachable.has(traversal.from)
      || reachability.reachable.has(traversal.to)
      || !ancestors.has(traversal.to)) {
      continue;
    }
    const frontier = validated.nodes.get(traversal.to);
    if (frontier && !frontier.parentId
      && !surfaceLocationOwned(frontier, snapshot)) {
      missing.add(frontier.surfaceChunk);
    }
  }
  return missing;
}

function validateGraph(graph: LocationGraph): ValidatedGraph {
  let valid = isRecord(graph)
    && Array.isArray(graph.nodes)
    && Array.isArray(graph.edges)
    && isNonEmptyString(graph.startNodeId);
  const sourceNodes: readonly unknown[] = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const sourceEdges: readonly unknown[] = Array.isArray(graph?.edges) ? graph.edges : [];
  const nodeCounts = countStringIds(sourceNodes);
  const edgeCounts = countStringIds(sourceEdges);
  const candidateNodes = new Map<string, LocationNodeSource>();

  for (const value of sourceNodes) {
    if (!isLocationNode(value) || nodeCounts.get(value.id) !== 1) {
      valid = false;
      continue;
    }
    candidateNodes.set(value.id, value);
    if (value.coverage !== 'VERIFIED') {
      valid = false;
    }
  }

  const invalidParents = invalidParentIds(candidateNodes);
  if (invalidParents.size > 0) {
    valid = false;
  }
  const nodes = new Map(
    [...candidateNodes].filter(([id]) => !invalidParents.has(id)),
  );

  const candidateEdges: LocationEdgeSource[] = [];
  for (const value of sourceEdges) {
    if (!isLocationEdge(value)
      || edgeCounts.get(value.id) !== 1
      || !nodes.has(value.from)
      || !nodes.has(value.to)
      || !entersThroughDeclaredParents(value, nodes)) {
      valid = false;
      continue;
    }
    candidateEdges.push(value);
  }

  const edges = [...candidateEdges]
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

  const start = nodes.get(graph?.startNodeId);
  if (!start || start.parentId) {
    valid = false;
  }

  return {
    nodes,
    edges,
    coverage: valid ? 'VERIFIED' : 'UNKNOWN',
  };
}

function countStringIds(values: readonly unknown[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!isRecord(value) || typeof value.id !== 'string') {
      continue;
    }
    counts.set(value.id, (counts.get(value.id) ?? 0) + 1);
  }
  return counts;
}

function isLocationNode(value: unknown): value is LocationNodeSource {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isSurfaceChunk(value.surfaceChunk)
    && (value.parentId === undefined || isNonEmptyString(value.parentId))
    && (value.coverage === 'VERIFIED'
      || value.coverage === 'PARTIAL'
      || value.coverage === 'UNKNOWN');
}

function isLocationEdge(value: unknown): value is LocationEdgeSource {
  if (!isRecord(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.from)
    || !isNonEmptyString(value.to)
    || typeof value.bidirectional !== 'boolean'
    || !Array.isArray(value.provenanceIds)
    || value.provenanceIds.length === 0
    || !value.provenanceIds.every(isNonEmptyString)) {
    return false;
  }
  try {
    assertRequirementExpr(value.requirements as RequirementExpr);
    return true;
  } catch {
    return false;
  }
}

function invalidParentIds(
  nodes: ReadonlyMap<string, LocationNodeSource>,
): Set<string> {
  const invalid = new Set<string>();

  for (const node of nodes.values()) {
    if (node.parentId && !nodes.has(node.parentId)) {
      invalid.add(node.id);
    }
  }

  for (const node of nodes.values()) {
    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let cursor: LocationNodeSource | undefined = node;
    while (cursor?.parentId) {
      if (invalid.has(cursor.id)) {
        path.forEach((id) => invalid.add(id));
        break;
      }
      const cycleStart = pathIndex.get(cursor.id);
      if (cycleStart !== undefined) {
        path.forEach((id) => invalid.add(id));
        break;
      }
      pathIndex.set(cursor.id, path.length);
      path.push(cursor.id);
      cursor = nodes.get(cursor.parentId);
    }
  }

  return invalid;
}

function entersThroughDeclaredParents(
  edge: LocationEdgeSource,
  nodes: ReadonlyMap<string, LocationNodeSource>,
): boolean {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (!from || !to) {
    return false;
  }
  if (!from.parentId && !to.parentId) {
    return true;
  }
  return from.parentId === to.id || to.parentId === from.id;
}

function requirementHasExactShape(value: unknown): value is RequirementExpr {
  if (!isRecord(value)) return false;
  if (value.op === 'ALL' || value.op === 'ANY') {
    return hasExactKeys(value, ['op', 'terms'])
      && Array.isArray(value.terms)
      && value.terms.every(requirementHasExactShape);
  }
  if (value.op !== 'FACT' || !hasExactKeys(value, ['op', 'fact'])
    || !isRecord(value.fact)) return false;
  const factKeys = value.fact.quantity === undefined
    ? ['id', 'kind', 'label'] : ['id', 'kind', 'label', 'quantity'];
  return hasExactKeys(value.fact, factKeys);
}

function cloneRequirement(expression: RequirementExpr): RequirementExpr {
  if (expression.op === 'FACT') {
    return {
      op: 'FACT',
      fact: {
        id: expression.fact.id,
        kind: expression.fact.kind,
        label: expression.fact.label,
        ...(expression.fact.quantity === undefined
          ? {} : { quantity: expression.fact.quantity }),
      },
    };
  }
  return {
    op: expression.op,
    terms: expression.terms.map(cloneRequirement),
  };
}

function hasExactKeys(value: unknown, keys: readonly string[]): boolean {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort(compareText);
  const expected = [...keys].sort(compareText);
  return sameStrings(actual, expected);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isSurfaceChunk(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function addTraversal(
  traversals: Map<string, Traversal[]>,
  from: string,
  traversal: Traversal,
): void {
  const existing = traversals.get(from);
  if (existing) {
    existing.push(traversal);
  } else {
    traversals.set(from, [traversal]);
  }
}

function locationOwned(
  location: LocationNodeSource,
  reachable: ReadonlySet<string>,
  snapshot: RuneProofRunSnapshot,
): boolean {
  if (location.parentId) {
    return reachable.has(location.parentId);
  }
  return surfaceLocationOwned(location, snapshot);
}

function surfaceLocationOwned(
  location: LocationNodeSource,
  snapshot: RuneProofRunSnapshot,
): boolean {
  const rules = modeRules(snapshot);
  if (!rules) return false;
  if (rules.chunkGranularity) {
    return snapshot.unlockedChunks.includes(location.surfaceChunk);
  }
  const [cx, cy] = location.surfaceChunk.split(',').map(Number);
  const place = placeOf(cx, cy);
  return Boolean(
    (place.subArea && isRegionUnlockedForRules(place.subArea, snapshot.unlockedAreas, rules))
    || (place.region && isRegionUnlockedForRules(place.region, snapshot.unlockedAreas, rules)),
  );
}

function modeRules(
  snapshot: RuneProofRunSnapshot,
): Readonly<GameModeRules> | null {
  if (snapshot.modeRules) return snapshot.modeRules;
  if (snapshot.gameModeId === 'custom') return null;
  return resolveModeRules(snapshot.gameModeId);
}

function chunkGranularity(snapshot: RuneProofRunSnapshot): boolean {
  return modeRules(snapshot)?.chunkGranularity === true;
}

function requirementsSatisfied(
  expression: RequirementExpr,
  snapshot: RuneProofRunSnapshot,
): boolean {
  switch (expression.op) {
    case 'ALL':
      return expression.terms.every((term) => requirementsSatisfied(term, snapshot));
    case 'ANY':
      return expression.terms.some((term) => requirementsSatisfied(term, snapshot));
    case 'FACT':
      return factSatisfied(expression.fact, snapshot);
  }
}

function factSatisfied(fact: FactRef, snapshot: RuneProofRunSnapshot): boolean {
  switch (fact.kind) {
    case 'QUEST':
      return includesFact(snapshot.completedQuests, fact);
    case 'SKILL_LEVEL':
      return effectiveSkillLevel(snapshot, fact.label) >= (fact.quantity ?? 1);
    case 'UNLOCK':
      return unlockFacts(snapshot).some((values) => includesFact(values, fact));
    case 'CAPABILITY':
      return includesFact(snapshot.unlockedMobility, fact)
        || includesFact(snapshot.unlockedArcana, fact);
    case 'ITEM':
    case 'LOCATION':
      return false;
  }
}

function includesFact(values: readonly string[], fact: FactRef): boolean {
  return values.includes(fact.label) || values.includes(fact.id);
}

function unlockFacts(snapshot: RuneProofRunSnapshot): readonly (readonly string[])[] {
  return [
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
}
