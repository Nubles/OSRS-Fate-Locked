/**
 * Which of a quest's chunks a Chunked run can get to: the walk from the free
 * start chunk over owned land and the run's transport (travelReachability),
 * not passing chunks whose entry needs an unfinished quest (questSections).
 * The Doable tab and the Journal (utils/chunkedContentChecks.ts) both ask
 * this, so they agree on what is stranded.
 *
 * Two exceptions, for one quest at a time:
 * - a chunk only the quest itself lets you into (Priest in Peril's way into
 *   Morytania) counts when the walk without entry gates reaches it;
 * - until Pandemonium is done, its route is open whenever Port Sarim is
 *   reached (utils/pandemoniumRoute.ts).
 */
import type { ConnectGraph } from '../services/ChunkContentService';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import { CHUNKED_START } from './chunkAdjacency';
import { PANDEMONIUM_ROUTE } from './pandemoniumRoute';
import { entryBlockedGate } from './questDoability';
import { travelReachability } from './travelReach';

export interface ChunkedQuestReach {
  /** The walk's reached chunks, as numeric ids (cx * 256 + cy). */
  reachable: ReadonlySet<string>;
  /** Whether this quest can get to the chunk with this numeric id. */
  reaches(questId: string, id: string): boolean;
}

const KNOWN_QUESTS = new Set(Object.keys(QUEST_DATA));
const PANDEMONIUM_IDS = new Set([...PANDEMONIUM_ROUTE].map(key => {
  const [cx, cy] = key.split(',').map(Number);
  return String(cx * 256 + cy);
}));
const PORT_SARIM_ID = String(47 * 256 + 50);

export function chunkedQuestReach(
  graph: ConnectGraph,
  sections: Record<string, string[]>,
  unlocks: UnlockState,
  gameModeId = 'chunked',
): ChunkedQuestReach {
  const completed = new Set<string>(unlocks.quests);
  const gate = entryBlockedGate(sections, completed, KNOWN_QUESTS);
  const { reachable } = travelReachability(graph, unlocks, CHUNKED_START, gate, gameModeId);
  let ungated: ReadonlySet<string> | null = null;
  const routeOpen = !completed.has('Pandemonium') && reachable.has(PORT_SARIM_ID);
  return {
    reachable,
    reaches: (questId, id) => {
      if (reachable.has(id)) return true;
      if (routeOpen && PANDEMONIUM_IDS.has(id)) return true;
      const needed = sections[id] ?? [];
      if (!needed.includes(questId)) return false;
      if (!needed.every(quest => quest === questId || completed.has(quest) || !KNOWN_QUESTS.has(quest))) return false;
      ungated ??= travelReachability(graph, unlocks, CHUNKED_START, undefined, gameModeId).reachable;
      return ungated.has(id);
    },
  };
}

// The Journal asks once per quest; one walk serves every quest of one account.
let last: { signature: string; graph: ConnectGraph; reach: ChunkedQuestReach } | null = null;

/** chunkedQuestReach for the latest account asked about. */
export function cachedChunkedQuestReach(
  graph: ConnectGraph,
  sections: Record<string, string[]>,
  unlocks: UnlockState,
): ChunkedQuestReach {
  const signature = JSON.stringify([
    unlocks.chunks, unlocks.quests, unlocks.mobility, unlocks.housing, unlocks.diaries, unlocks.equipment?.Weapon,
    unlocks.skills?.Sailing, unlocks.levels?.Sailing,
  ]);
  if (last?.signature !== signature || last.graph !== graph) {
    last = { signature, graph, reach: chunkedQuestReach(graph, sections, unlocks) };
  }
  return last.reach;
}
