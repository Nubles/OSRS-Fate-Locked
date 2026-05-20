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
