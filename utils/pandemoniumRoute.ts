/**
 * Pandemonium starts at Port Sarim, sails south past the Salty Grouper wreck
 * to The Pandemonium, and Junior Jim's raft takes you to the Shipyard. The sea
 * only opens once the quest is done, so until then the chunks the quest uses
 * are open whenever Port Sarim is, as the quest list (which asks only for Port
 * Sarim) already says. A player reported on 9 October 2026 that RuneLite
 * called them Locked mid-quest.
 *
 * It loads with the run's routes (loadRunRoutes in utils/chunkEntry.ts), not
 * with the app, because the entry chunk has no room for it.
 */
import type { UnlockState } from '../types';
import type { PermissionStatus } from './chunkPermissionSnapshot';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';

const PORT_SARIM = { cx: 47, cy: 50 };
export const PANDEMONIUM_ROUTE: ReadonlySet<string> = new Set([
  '47,48', '47,47', '48,46', // the sea between Port Sarim and The Pandemonium
  '47,46', // The Pandemonium
  '32,42', // the Shipyard
]);

/**
 * Whether Pandemonium opens this chunk, given the run's own entry for any
 * chunk (ownership and routes alone). During the quest, its route opens from
 * Port Sarim. Once it is done, every sea chunk the run owns (Sailing and
 * Pandemonium; the Shipyard is one) opens from Port Sarim too: you sail it
 * from your boat, so no walking route has to reach it (Alex, 9 October 2026).
 */
export const pandemoniumOpens = (
  coord: { cx: number; cy: number },
  unlocks: UnlockState,
  entryOf: (coord: { cx: number; cy: number }) => PermissionStatus,
): boolean => {
  const key = `${coord.cx},${coord.cy}`;
  const opens = unlocks.quests.includes('Pandemonium')
    ? OCEAN_CHUNK_KEYS.has(key) && entryOf(coord) === 'NOT_READY'
    : PANDEMONIUM_ROUTE.has(key);
  return opens && entryOf(PORT_SARIM) === 'ALLOWED';
};
