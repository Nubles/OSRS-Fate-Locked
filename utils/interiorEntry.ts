/**
 * Whether a run can enter an interior chunk (a dungeon, cave or city with
 * a chunk of its own), as the RuneLite export decides it.
 */
import { interiorArea } from '../data/interiorAreas';
import type { UnlockState } from '../types';
import { chunkEntry } from './chunkEntry';
import type { PermissionStatus } from './chunkPermissionSnapshot';
import { leastUsable, mostUsable } from './permissionStatus';
import { compileRawRequirements, evaluateRouteGates } from './questRoutes/accountRequirements';
import { isAreaReachable } from './reachability';

export interface InteriorEntrance {
  /** The surface chunk it is entered from, as a numeric id (cx * 256 + cy). */
  chunkId: string;
  /** What the route in needs, in the source's words. */
  requirements: string[];
}

export interface InteriorRecord {
  /** The interior's own chunk, "cx,cy". */
  key: string;
  name: string;
  entrances: InteriorEntrance[];
}

export interface InteriorContext {
  unlocks: UnlockState;
  gameModeId: string;
  /** The run's reach (runReach); without it an owned entrance counts as reached. */
  reachable?: Set<string>;
  /** Quests needed to enter a surface chunk at all. */
  chunkEntryRequirements(cx: number, cy: number): string[];
}

/**
 * LOCKED while the run can't reach the area the interior belongs to, even
 * through an open entrance. Otherwise the most usable way in, where a way
 * needs both its entrance chunk and its route's requirements. UNKNOWN when
 * no entrance is known.
 */
export function interiorEntry(record: InteriorRecord, context: InteriorContext): PermissionStatus {
  const area = interiorArea(record.name);
  if (area && !isAreaReachable(area, context.unlocks, context.gameModeId)) return 'LOCKED';
  const ways = record.entrances.map((entrance) => {
    const id = Number(entrance.chunkId);
    const coord = { cx: Math.floor(id / 256), cy: id % 256 };
    const route = evaluateRouteGates(compileRawRequirements(
      [...entrance.requirements, ...context.chunkEntryRequirements(coord.cx, coord.cy)]
        .map((raw) => ({ raw, origin: 'CHUNK_ENTRY' as const })),
    ), context.unlocks);
    const routeStatus: PermissionStatus = !route.blockers.length ? 'ALLOWED'
      : route.hasDataGap ? 'UNKNOWN' : 'NOT_READY';
    return leastUsable(chunkEntry(coord, context.unlocks, context.gameModeId, context.reachable), routeStatus);
  });
  return mostUsable(ways) ?? 'UNKNOWN';
}
