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
import { chunkForPlace, chunkUnlocked, placeOf } from './chunkLocations';
import { canNavigateOcean, OCEAN_CHUNK_KEYS } from './oceanAccess';
import type { PermissionStatus } from './chunkPermissionSnapshot';
import { entryBlockedGate } from './questDoability';
import { chunkReachability } from './chunkReach';

/** Quests the entry gate knows, by id and by name. */
const KNOWN_QUESTS = new Set([
  ...Object.keys(QUEST_DATA),
  ...Object.values(QUEST_DATA).map((quest) => quest.name),
]);

export interface ReachSource {
  connectGraph(): ConnectGraph;
  questSections(): Record<string, string[]>;
}

type TravelReachability = typeof import('./travelReach').travelReachability;
let travelReachability: TravelReachability | null = null;
let pandemoniumOpens: typeof import('./travelReach').pandemoniumOpens | null = null;

/**
 * Loads the app's routes for runReach, once. They load with the map's chunk
 * content (ChunkContentService.init), not with the app: the travel rules
 * would push the entry chunk over its budget, and runReach only runs once
 * the chunk content is in.
 */
export const loadRunRoutes = (): Promise<void> => import('./travelReach')
  .then(module => { ({ travelReachability, pandemoniumOpens } = module); });

/**
 * The owned chunks a route from the run's start reaches, as numeric ids
 * (cx * 256 + cy). Chunked runs start in their free chunk, the rest at
 * Lumbridge. Routes are the ones the app shows (utils/travelReach.ts): a
 * travel network the run hasn't unlocked makes none, so RuneLite's "Not
 * ready" agrees with the Diary Journal's "stranded". Until those routes
 * load, the plain graph stands in, which errs toward reachable. A chunk
 * whose entry needs an unfinished quest is not reached, and routes don't
 * pass through it.
 */
export function runReach(source: ReachSource, unlocks: UnlockState, gameModeId: string): Set<string> {
  const completed = new Set(unlocks.quests);
  const blocked = entryBlockedGate(source.questSections(), completed, KNOWN_QUESTS);
  const start = gameModeId === 'chunked' ? CHUNKED_START : chunkForPlace('Lumbridge');
  const reach = travelReachability ?? chunkReachability;
  return reach(source.connectGraph(), unlocks, start, blocked, gameModeId).reachable;
}

/**
 * The run's entry for one chunk. Without a reach set (the chunk data didn't
 * load), an owned chunk counts as reached. Once the routes load, Pandemonium
 * opens its route during the quest and the sea after it, from Port Sarim
 * (utils/pandemoniumRoute.ts); questRoute false leaves that out, for interiors.
 */
export function chunkEntry(
  coord: { cx: number; cy: number },
  unlocks: UnlockState,
  gameModeId: string | undefined,
  reachable?: Set<string>,
  questRoute = true,
): PermissionStatus {
  if (questRoute && pandemoniumOpens?.(coord, unlocks, (other) => chunkEntry(other, unlocks, gameModeId, reachable, false))) return 'ALLOWED';
  if (!chunkUnlocked(coord.cx, coord.cy, unlocks, gameModeId)) return 'LOCKED';
  if (reachable && !reachable.has(String(coord.cx * 256 + coord.cy))) return 'NOT_READY';
  return 'ALLOWED';
}

/**
 * Why a chunk's entry isn't ALLOWED, in a few words, for RuneLite to show:
 * what would unlock it, the quest its entry needs, or that no route from
 * the run's start reaches it. Undefined when it is ALLOWED.
 */
export function chunkEntryReason(
  coord: { cx: number; cy: number },
  entry: PermissionStatus,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  entryQuests: string[],
): string | undefined {
  if (entry === 'ALLOWED') return undefined;
  const key = `${coord.cx},${coord.cy}`;
  const chunked = gameModeId === 'chunked';
  if (entry === 'LOCKED') {
    if (OCEAN_CHUNK_KEYS.has(key)) {
      return canNavigateOcean(unlocks) ? 'Not reached from your coast' : 'Needs Sailing and Pandemonium';
    }
    if (chunked) return 'Chunk not unlocked';
    const place = placeOf(coord.cx, coord.cy);
    const area = place.subArea ?? place.region;
    return area ? `Unlock ${area}` : 'Not in any area';
  }
  const unfinished = entryQuests.filter((quest) => KNOWN_QUESTS.has(quest) && !unlocks.quests.includes(quest));
  if (unfinished.length) return `Needs ${unfinished.join(' and ')}`;
  return chunked ? 'No route from your start chunk' : 'No route from Lumbridge';
}
