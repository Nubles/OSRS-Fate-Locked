import type { CATask } from '../data/caTasks';
import { ACTIVITY_ACCESS_AREAS } from '../data/activityAccess';
import type { UnlockState } from '../types';
import { getActivityAccess } from './activityAccess';
import type { AreaRoutes } from './areaRoutes';
import { canonicalBossId } from './contentIdentity';
import { evaluateDiaryTaskEligibility } from './journalStatus';
import { isAreaReachable } from './reachability';

/**
 * Why a Combat Achievement task can't be fought yet: its boss isn't unlocked,
 * or the boss is unlocked but the run can't get to it. Keys roll bosses
 * whatever the map, so owning a boss without its area is common.
 */
export type CATaskBlocker =
  | { kind: 'boss'; boss: string; label: string }
  | { kind: 'area'; boss: string; label: string };

const hasOwn = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);

/**
 * Whether the run can get to an unlocked boss, or what stops it. Chunked asks
 * for the chunk it is entered from (getActivityAccess). Every other mode asks
 * for one of its areas (data/activityAccess.ts) owned and reachable, as a
 * diary task's areas are: an island needs one of its entry routes, and an
 * owned area no route reaches (areaRoutes) doesn't count. A route that only
 * asks the player to confirm something, such as paying Jarvald for the boat
 * to Waterbirth Island, counts: a task has no confirm step. A boss with no
 * tracked area, such as the Mimic, needs none.
 */
export const bossAreaBlocker = (
  boss: string,
  unlocks: UnlockState,
  gameModeId?: string,
  areaRoutes?: AreaRoutes | null,
): string | undefined => {
  if (gameModeId === 'chunked') {
    const access = getActivityAccess(boss, unlocks, gameModeId);
    return access.eligible ? undefined : access.explanation;
  }
  const areas = hasOwn(ACTIVITY_ACCESS_AREAS, boss) ? ACTIVITY_ACCESS_AREAS[boss] : [];
  if (areas.length === 0) return undefined;
  const reach = evaluateDiaryTaskEligibility({ id: `ca-boss:${boss}`, anyOfRegions: [...areas] }, unlocks, gameModeId, areaRoutes);
  if (reach.confirmable) return undefined;
  const owned = areas.filter(area => isAreaReachable(area, unlocks, gameModeId));
  return owned.length === 0 ? `Needs ${areas.join(' or ')}` : `No route to ${owned.join(' or ')} yet`;
};

/**
 * What keeps a task from being fought now, or undefined when it can be (or is
 * done, or isn't at a boss, which carries no unlock to check). Only a hint:
 * a task stays free to complete by hand.
 */
export const caTaskBlocker = (
  task: Pick<CATask, 'id' | 'monster'>,
  unlocks: UnlockState,
  gameModeId?: string,
  areaRoutes?: AreaRoutes | null,
): CATaskBlocker | undefined => {
  if (unlocks.completedTasks.includes(task.id)) return undefined;
  const boss = canonicalBossId(task.monster);
  if (!boss) return undefined;
  if (!unlocks.bosses.includes(boss)) return { kind: 'boss', boss, label: `Unlock ${boss}` };
  const area = bossAreaBlocker(boss, unlocks, gameModeId, areaRoutes);
  return area ? { kind: 'area', boss, label: area } : undefined;
};

/** The blocker as a sentence for a task's details. */
export const caTaskBlockerText = (blocker: CATaskBlocker): string => (
  blocker.kind === 'boss'
    ? `Unlock ${blocker.boss} to fight here.`
    : `${blocker.boss} is unlocked, but you can't get there yet: ${blocker.label.charAt(0).toLowerCase()}${blocker.label.slice(1)}.`
);
