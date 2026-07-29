import type { RuneProofRunSnapshot } from '../../types';
import {
  assertRequirementExpr,
  type Coverage,
  type FactRef,
  type RequirementExpr,
} from './model';

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

export function calculateReachability(
  graph: LocationGraph,
  snapshot: RuneProofRunSnapshot,
): ReachabilityResult {
  const nodes = new Map(graph.nodes.map((location) => [location.id, location]));
  const traversals = new Map<string, Traversal[]>();
  let coverage: Coverage = graph.nodes.every((location) => location.coverage === 'VERIFIED')
    ? 'VERIFIED'
    : 'UNKNOWN';

  for (const edge of graph.edges) {
    if (!hasValidRequirements(edge)) {
      coverage = 'UNKNOWN';
      continue;
    }
    addTraversal(traversals, edge.from, { edge, to: edge.to });
    if (edge.bidirectional) {
      addTraversal(traversals, edge.to, { edge, to: edge.from });
    }
  }

  const reachable = new Set<string>();
  const distance = new Map<string, number>();
  const predecessorEdge = new Map<string, string>();
  const start = nodes.get(graph.startNodeId);
  const queue: string[] = [];

  if (start && !start.parentId) {
    reachable.add(start.id);
    distance.set(start.id, 0);
    queue.push(start.id);
  } else {
    coverage = 'UNKNOWN';
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

  const ownedSurfaceChunks = new Set(
    graph.nodes
      .filter((location) => !location.parentId
        && snapshot.unlockedChunks.includes(location.surfaceChunk))
      .map((location) => location.surfaceChunk),
  );
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

function hasValidRequirements(
  edge: LocationEdgeSource,
): edge is LocationEdgeSource {
  if (!edge.requirements
    || !Array.isArray(edge.provenanceIds)
    || edge.provenanceIds.length === 0
    || edge.provenanceIds.some((id) => id.trim().length === 0)) {
    return false;
  }
  try {
    assertRequirementExpr(edge.requirements);
    return true;
  } catch {
    return false;
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
  return snapshot.unlockedChunks.includes(location.surfaceChunk);
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
      return (snapshot.currentLevels[fact.label] ?? 0) >= (fact.quantity ?? 1);
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
