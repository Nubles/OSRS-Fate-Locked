import type { LogEntry } from '../types';

/** A Key after at least this many rolls in a row gets a "Dry run over" chat line. */
export const DRY_RUN_MIN_ROLLS = 25;

/**
 * The rolls that ended a dry run: each Key roll (a Key, an Omni-Key or a Pity
 * Key) that came after DRY_RUN_MIN_ROLLS - 1 or more misses in a row, mapped
 * to how many rolls the run took, counting the roll that ended it. Reads the
 * history only, so it changes nothing in the save.
 */
export const dryRunEnds = (history: readonly LogEntry[], min = DRY_RUN_MIN_ROLLS): Map<string, number> => {
  const ends = new Map<string, number>();
  let misses = 0;
  for (const entry of history) {
    if (entry.type === 'ROLL_FAIL') { misses += 1; continue; }
    if (entry.type !== 'ROLL_SUCCESS' && entry.type !== 'ROLL_OMNI' && entry.type !== 'PITY') continue;
    if (misses + 1 >= min) ends.set(entry.id, misses + 1);
    misses = 0;
  }
  return ends;
};
