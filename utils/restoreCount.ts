/**
 * How many times a run was restored (critique GP-4).
 *
 * A restore replaces the whole run, so a count kept only in GameState would
 * be rolled back by the very restore it should record. This browser keeps
 * its own count per run id, per profile, outside GameState
 * (`<profile>__restores`), and every replacement merges the two with max():
 *
 *  - Restoring a backup (Session start, Before import, a checkpoint) always
 *    counts.
 *  - Importing a file, sync code or online backup counts when it is a run
 *    this profile already had: the current run, or one it replaced or reset
 *    before. A run arriving in a profile for the first time (a new device)
 *    does not count, and keeps the count it carries.
 *
 * The merged count is written into the replacement's GameState, so it
 * travels with exports and shows on the run card and share card.
 */
import type { GameState } from '../types';
import { profileRestoreCountKey } from './profileStorage';
import type { SaveValidationResult } from './saveSchema';

export type RestoreKind = 'restore' | 'import';

/** Run id → restores this profile has seen. Insertion order, oldest first. */
export type RestoreCounts = Record<string, number>;

/** Runs remembered per profile; the oldest are forgotten past this. */
export const MAX_REMEMBERED_RUNS = 50;

type RunCountState = Pick<GameState, 'runId' | 'restoreCount' | 'history'>;

const validCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export const parseRestoreCounts = (raw: string | null): RestoreCounts => {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    const runs = parsed && typeof parsed === 'object' ? (parsed as { runs?: unknown }).runs : undefined;
    if (!runs || typeof runs !== 'object' || Array.isArray(runs)) return {};
    const counts: RestoreCounts = {};
    for (const [runId, count] of Object.entries(runs)) if (validCount(count)) counts[runId] = count;
    return counts;
  } catch {
    return {};
  }
};

export const readRestoreCounts = (storage: Pick<Storage, 'getItem'>, storageKey: string): RestoreCounts => {
  try {
    return parseRestoreCounts(storage.getItem(profileRestoreCountKey(storageKey)));
  } catch {
    return {};
  }
};

/** Best effort: the count in the run's own state still records the restore. */
export const writeRestoreCounts = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
  counts: RestoreCounts,
): void => {
  const ids = Object.keys(counts);
  const kept = ids.slice(Math.max(0, ids.length - MAX_REMEMBERED_RUNS));
  try {
    storage.setItem(profileRestoreCountKey(storageKey), JSON.stringify({ v: 1, runs: Object.fromEntries(kept.map(id => [id, counts[id]])) }));
  } catch {
    /* storage full or blocked */
  }
};

const withRun = (counts: RestoreCounts, runId: string, count: number): RestoreCounts => {
  // Re-inserting moves the run to the newest end, so the cap forgets old runs first.
  const { [runId]: _previous, ...rest } = counts;
  return { ...rest, [runId]: count };
};

/** Remember the run leaving this profile (replaced or reset), with its count. */
export const rememberRun = (counts: RestoreCounts, run: RunCountState): RestoreCounts =>
  run.history.length === 0
    ? counts
    : withRun(counts, run.runId, Math.max(counts[run.runId] ?? 0, run.restoreCount ?? 0));

/**
 * Stamp a validated replacement with its restore count. Returns the stamped
 * replacement and the profile's counts to write once it is applied.
 */
export const stampRestoreCount = (
  prepared: SaveValidationResult,
  current: RunCountState,
  counts: RestoreCounts,
  kind: RestoreKind,
): { prepared: SaveValidationResult; counts: RestoreCounts } => {
  if (prepared.ok === false) return { prepared, counts };
  const runId = prepared.state.runId;
  const known = Object.prototype.hasOwnProperty.call(counts, runId) || runId === current.runId;
  const remembered = rememberRun(counts, current);
  const previous = Math.max(remembered[runId] ?? 0, prepared.state.restoreCount ?? 0);
  const count = kind === 'restore' || known ? previous + 1 : previous;
  const state: GameState = { ...prepared.state };
  if (count > 0) state.restoreCount = count;
  else delete state.restoreCount;
  return {
    prepared: { ...prepared, state },
    counts: count > 0 ? withRun(remembered, runId, count) : remembered,
  };
};

/** "Restored 2 times", or null for a run never restored. */
export const restoredLabel = (count: number | undefined): string | null =>
  count && count > 0 ? `Restored ${count} ${count === 1 ? 'time' : 'times'}` : null;
