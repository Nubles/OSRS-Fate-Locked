import { LogEntry } from '../types';

/**
 * The reducer emits four log-entry types for a roll outcome: ROLL_SUCCESS,
 * ROLL_OMNI, ROLL_FAIL, and PITY (which is also a "roll" — you rolled, Fate
 * granted the key). Consumers that want "every roll" should use this set
 * rather than comparing to a bare 'ROLL' literal.
 */
export const ROLL_ENTRY_TYPES: ReadonlySet<LogEntry['type']> = new Set([
  'ROLL_SUCCESS',
  'ROLL_OMNI',
  'ROLL_FAIL',
  'PITY',
]);

export const isRollEntry = (h: LogEntry): boolean => ROLL_ENTRY_TYPES.has(h.type);

/**
 * Whether an entry's meta.chaosKeysAwarded is its own award. A level-up's Key
 * roll carries a copy of its LEVEL_UP entry's meta, award included; only a level
 * RuneLite detected (no LEVEL_UP entry) puts the award on the roll itself.
 */
export const ownsChaosAward = (h: LogEntry): boolean =>
  !isRollEntry(h) || h.meta?.detectorId === 'skill-level-v1';
