/**
 * Slayer tasks as the RuneLite export decides them: one of the four
 * statuses the plugin knows for each master's task, keyed like the bundle's
 * slayerChunks, from the same rows the Slayer panel shows.
 */
import type { SlayerAssignment } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import type { PermissionStatus } from './chunkPermissionSnapshot';
import { evaluateEntityAccess } from './entityAccess';
import { mostUsable } from './permissionStatus';
import type { LocateFn, SlayerReach, SlayerStatus, SlayerTaskRow } from './slayerReach';

export interface SlayerLocationSource {
  slayerLocations(task: string, assignment?: SlayerAssignment, master?: string):
    { name: string; location: { cx: number; cy: number; sourceId?: string } }[];
}

/**
 * Where a task can be done: the first location the run can use, else one
 * that needs review, else one it owns but can't enter yet, else any.
 */
export const slayerLocate = (
  source: SlayerLocationSource,
  unlocks: UnlockState,
  gameModeId: string | undefined,
): LocateFn => (task, assignment, master) => {
  const checked = source.slayerLocations(task, assignment, master).map((hit) =>
    ({ ...hit, access: evaluateEntityAccess(hit.name, 'monster', hit.location, unlocks, gameModeId) }));
  const hit = checked.find((one) => one.access.status === 'ALLOWED')
    ?? checked.find((one) => one.access.status === 'UNKNOWN')
    ?? checked.find((one) => one.access.status === 'NOT_READY')
    ?? checked[0];
  return hit
    ? { cx: hit.location.cx, cy: hit.location.cy, unlocked: hit.access.status === 'ALLOWED', accessStatus: hit.access.status }
    : null;
};

/**
 * The panel's statuses as the plugin's four: a task the run can't take yet
 * (its Slayer, quest, combat or entry requirements) is NOT_READY, so it
 * never alerts; only a task in a locked area is LOCKED.
 */
export const SLAYER_DECISION: Record<SlayerStatus, PermissionStatus> = {
  'ready': 'ALLOWED',
  'area-locked': 'LOCKED',
  'slayer-locked': 'NOT_READY',
  'quest-locked': 'NOT_READY',
  'combat-locked': 'NOT_READY',
  'access-blocked': 'NOT_READY',
  'access-unknown': 'UNKNOWN',
  'no-location': 'UNKNOWN',
};

/**
 * Why a task isn't ready, as the export says it: the master's blocker or
 * the Slayer or Combat level first, as the Slayer panel's badge does.
 */
export function slayerReason(row: SlayerTaskRow): string | undefined {
  if (row.masterBlocker) return row.masterBlocker.label;
  switch (row.status) {
    case 'ready': return undefined;
    case 'slayer-locked': return row.blocker ?? (row.slayer ? `Slayer ${row.slayer}` : 'Slayer locked');
    case 'combat-locked': return row.combat ? `Combat ${row.combat}` : 'Combat level';
    case 'quest-locked': return 'Quest requirements';
    case 'area-locked': return 'Area locked';
    case 'access-blocked': return 'Entry requirements';
    case 'access-unknown': return 'Access needs review';
    case 'no-location': return 'No known location';
  }
}

export interface SlayerDecision {
  status: PermissionStatus;
  reason?: string;
}

/** A task as slayerChunks keys it: lowercased and trimmed, one trailing "s" dropped. */
export const slayerTaskKey = (task: string): string => task.toLowerCase().trim().replace(/s$/, '');

/**
 * A decision for each master's task ("krystilia:bear"), and one for each
 * task whatever the master ("bear"): the most usable of the masters'
 * answers, with the first such master's reason, so it is LOCKED only when
 * every master's is. A master that wouldn't give the task yet (NOT_READY)
 * probably didn't, so another master's UNKNOWN comes first.
 */
export function slayerDecisions(reach: SlayerReach): Record<string, SlayerDecision> {
  const decisions: Record<string, SlayerDecision> = {};
  const byTask = new Map<string, SlayerDecision[]>();
  for (const { master, rows } of reach.masters) {
    for (const row of rows) {
      const reason = slayerReason(row);
      const decision: SlayerDecision = { status: SLAYER_DECISION[row.status], ...(reason ? { reason } : {}) };
      const task = slayerTaskKey(row.monster);
      decisions[`${master.toLowerCase()}:${task}`] = decision;
      byTask.set(task, [...(byTask.get(task) ?? []), decision]);
    }
  }
  for (const [task, answers] of byTask) {
    const status = mostUsable(answers.map((answer) => answer.status))!;
    decisions[task] = answers.find((answer) => answer.status === status)!;
  }
  return decisions;
}
