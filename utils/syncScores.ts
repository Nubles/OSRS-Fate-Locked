import type { SyncScores } from '../types';
import { normalizeAccountName } from './accountName';

/*
 * Kept apart from utils/syncActivity.ts (Wise Old Man's boss list, the roll
 * plan) so the reducer can record a reading without loading them.
 */

/**
 * The run's score baseline after a reading of `account`. A run with none, or
 * one for another name (a name change), takes the whole reading; otherwise
 * only metrics it couldn't read before are filled. A reading of a name other
 * than the run's changes nothing.
 */
export const recordScores = (
  current: SyncScores | undefined,
  linkedAccount: string | undefined,
  account: string,
  fresh: Readonly<Record<string, number | null>>,
  now: number,
): SyncScores | undefined => {
  if (!linkedAccount || normalizeAccountName(linkedAccount) !== normalizeAccountName(account)) return current;
  if (!current || normalizeAccountName(current.account) !== normalizeAccountName(account)) {
    return { account: linkedAccount, scores: { ...fresh }, takenAt: now };
  }
  let changed = false;
  const scores = { ...current.scores };
  for (const metric of Object.keys(fresh)) {
    if (typeof scores[metric] === 'number' || typeof fresh[metric] !== 'number') continue;
    scores[metric] = fresh[metric];
    changed = true;
  }
  return changed ? { ...current, scores } : current;
};

