/**
 * How the RuneLite export combines the four statuses the plugin knows.
 */
import type { PermissionStatus } from './chunkPermissionSnapshot';
import type { GateEvaluation } from './questRoutes/accountRequirements';

/**
 * Closest to usable first. An UNKNOWN answer may still turn out usable,
 * where a NOT_READY one won't be yet.
 */
const USABLE_FIRST: readonly PermissionStatus[] = ['ALLOWED', 'UNKNOWN', 'NOT_READY', 'LOCKED'];

/**
 * The most usable of several alternatives, such as the ways into a place:
 * LOCKED only when every one is. Undefined when there are none.
 */
export const mostUsable = (statuses: readonly PermissionStatus[]): PermissionStatus | undefined =>
  USABLE_FIRST.find((status) => statuses.includes(status));

/** The least usable of several conditions that must all hold. */
export const leastUsable = (...statuses: PermissionStatus[]): PermissionStatus =>
  [...USABLE_FIRST].reverse().find((status) => statuses.includes(status)) ?? 'ALLOWED';

/**
 * A route's status from its gate evaluation. NOT_READY while one blocker is
 * plainly unmet (a quest, level, item tier or unlock not held, the Recipe for
 * Disaster count, or a room a finished quest closes); UNKNOWN only when every
 * blocker is one the save can't answer (unreviewed wording, or a quest stage
 * of a quest not yet finished). `hasDataGap` alone would let one such line hide
 * a plain blocker.
 */
export const routeStatus = ({ blockers }: GateEvaluation, quests: readonly string[]): PermissionStatus =>
  !blockers.length ? 'ALLOWED'
    : blockers.some((gate) => gate.type !== 'UNRESOLVED' && !(gate.type === 'QUEST_PROGRESS' && !quests.includes(gate.questId)))
      ? 'NOT_READY' : 'UNKNOWN';
