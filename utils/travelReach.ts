/**
 * Reachability as the app shows it: the map's route graph read with the
 * reviewed corrections in data/travelLinks.ts. A travel network the run hasn't
 * unlocked makes no route, and the boats the graph leaves out join their
 * docks. The Diary Journal and the Quest Log (through utils/areaRoutes.ts),
 * the map's reachability lens and Chunked mode's Doable tab all ask this, so
 * they agree on what is stranded.
 *
 * RuneLite's chunk statuses (utils/chunkEntry.ts) still read the plain graph,
 * which errs toward "reachable": in game, a place is never called unreachable
 * because of a route this app doesn't know.
 */

import { BOAT_CROSSINGS, TRAVEL_NETWORKS, type NetworkOpener } from '../data/travelLinks';
import type { UnlockState } from '../types';
import { chunkReachability, type ReachResult } from './chunkReach';

type Graph = Record<string, string[]>;

/** A node as the graph keys it: named places as they are, "cx,cy" as cx*256+cy. */
export const graphNode = (node: string): string => {
  const match = /^(\d+),(\d+)$/.exec(node);
  return match ? String(Number(match[1]) * 256 + Number(match[2])) : node;
};

const opens = (opener: NetworkOpener, unlocks: UnlockState): boolean =>
  'mobility' in opener ? (unlocks.mobility ?? []).includes(opener.mobility)
    : 'housing' in opener ? (unlocks.housing ?? []).includes(opener.housing)
      : (unlocks.quests ?? []).includes(opener.quest);

/** The nodes of every travel network this run can't use yet. */
export function closedTravelNodes(unlocks: UnlockState): ReadonlySet<string> {
  const closed = new Set<string>();
  for (const network of TRAVEL_NETWORKS) {
    if (network.opensWith.some(opener => opens(opener, unlocks))) continue;
    for (const node of network.nodes) closed.add(graphNode(node));
  }
  return closed;
}

// The graph with the crossings open to a run, one per graph and set of crossings.
const withCrossings = new WeakMap<Graph, Map<string, Graph>>();

/** The route graph with the boats this run can take. */
export function routeGraph(connect: Graph, unlocks: UnlockState): Graph {
  const open = BOAT_CROSSINGS.filter(crossing => (crossing.quests ?? []).every(quest => (unlocks.quests ?? []).includes(quest)));
  const key = open.map(crossing => crossing.label).join('\n');
  let cache = withCrossings.get(connect);
  if (!cache) withCrossings.set(connect, cache = new Map());
  const cached = cache.get(key);
  if (cached) return cached;
  const graph: Graph = { ...connect };
  for (const crossing of open) {
    const docks = crossing.docks.map(graphNode);
    for (const dock of docks) {
      graph[dock] = [...new Set([...(graph[dock] ?? []), ...docks.filter(other => other !== dock)])];
    }
  }
  cache.set(key, graph);
  return graph;
}

/**
 * chunkReachability over the corrected graph. `blocked` adds a gate of the
 * caller's own, such as the map's quest-entry gate.
 */
export function travelReachability(
  connect: Graph,
  unlocks: UnlockState,
  home: { cx: number; cy: number } | null,
  blocked?: (chunkId: string) => boolean,
  gameModeId?: string,
): ReachResult {
  const closed = closedTravelNodes(unlocks);
  return chunkReachability(
    routeGraph(connect, unlocks), unlocks, home,
    chunkId => closed.has(chunkId) || !!blocked?.(chunkId), gameModeId,
  );
}
