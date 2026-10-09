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

const PANDEMONIUM_START = { cx: 47, cy: 50 };
export const PANDEMONIUM_ROUTE: ReadonlySet<string> = new Set([
  '47,48', '47,47', '48,46', // the sea between Port Sarim and The Pandemonium
  '47,46', // The Pandemonium
  '32,42', // the Shipyard
]);

/** Whether Pandemonium's route opens this chunk, given the run's entry for any chunk. */
export const pandemoniumOpens = (
  coord: { cx: number; cy: number },
  unlocks: UnlockState,
  entryOf: (coord: { cx: number; cy: number }) => PermissionStatus,
): boolean => PANDEMONIUM_ROUTE.has(`${coord.cx},${coord.cy}`)
  && !unlocks.quests.includes('Pandemonium')
  && entryOf(PANDEMONIUM_START) === 'ALLOWED';
