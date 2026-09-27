/**
 * How the RuneLite export combines the four statuses the plugin knows.
 */
import type { PermissionStatus } from './chunkPermissionSnapshot';

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
