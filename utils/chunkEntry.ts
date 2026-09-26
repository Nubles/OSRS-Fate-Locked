/**
 * Whether a run can enter a chunk, as the RuneLite export decides it for
 * every chunk snapshot: LOCKED when the run doesn't own the chunk, NOT_READY
 * when it owns it but no route from the run's start reaches it, and ALLOWED
 * otherwise.
 */
import { QUEST_DATA } from '../data/questData';
import type { ConnectGraph } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { CHUNKED_START } from './chunkAdjacency';
import { chunkForPlace, chunkUnlocked } from './chunkLocations';
import type { PermissionStatus } from './chunkPermissionSnapshot';
import { chunkReachability } from './chunkReach';
import { entryBlockedGate } from './questDoability';

export interface ReachSource {
  connectGraph(): ConnectGraph;
  questSections(): Record<string, string[]>;
}

/**
 * The owned chunks a route from the run's start reaches, as numeric ids
 * (cx * 256 + cy). Chunked runs start in their free chunk, the rest at
 * Lumbridge. A chunk whose entry needs an unfinished quest is not reached,
 * and routes don't pass through it.
 */
export function runReach(source: ReachSource, unlocks: UnlockState, gameModeId: string): Set<string> {
  const completed = new Set(unlocks.quests);
  const known = new Set([
    ...Object.keys(QUEST_DATA),
    ...Object.values(QUEST_DATA).map((quest) => quest.name),
  ]);
  const blocked = entryBlockedGate(source.questSections(), completed, known);
  const start = gameModeId === 'chunked' ? CHUNKED_START : chunkForPlace('Lumbridge');
  return chunkReachability(source.connectGraph(), unlocks, start, blocked, gameModeId).reachable;
}

/**
 * The run's entry for one chunk. Without a reach set (the chunk data didn't
 * load), an owned chunk counts as reached.
 */
export function chunkEntry(
  coord: { cx: number; cy: number },
  unlocks: UnlockState,
  gameModeId: string | undefined,
  reachable?: Set<string>,
): PermissionStatus {
  if (!chunkUnlocked(coord.cx, coord.cy, unlocks, gameModeId)) return 'LOCKED';
  if (reachable && !reachable.has(String(coord.cx * 256 + coord.cy))) return 'NOT_READY';
  return 'ALLOWED';
}
