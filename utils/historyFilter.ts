import type { LogEntry } from '../types';
import { isRollEntry } from './logEntry';

/** The History panel's category filters. */
export type HistoryFilter = 'ALL' | 'ROLLS' | 'UNLOCKS' | 'RITUALS' | 'PROGRESS';

/**
 * Which history entries a filter keeps; shared by the classic and OSRS
 * timelines and the OSRS chatbox tabs. Kept apart from LogViewer so the
 * chatbox can use it without loading the whole History panel.
 */
export const historyFilterMatches = (entry: LogEntry, filterType: HistoryFilter): boolean => {
  // A lost Chunked Breakthrough is stored as LEVEL_UP (so the audit's Key
  // balances skip it) but is a fate roll: it files under Rolls, not Level.
  const lostBreakthrough = entry.type === 'LEVEL_UP' && typeof entry.meta?.breakthrough === 'string';
  if (filterType === 'ROLLS') return isRollEntry(entry) || lostBreakthrough;
  if (filterType === 'UNLOCKS') return entry.type === 'UNLOCK';
  if (filterType === 'RITUALS') return entry.type === 'ALTAR';
  if (filterType === 'PROGRESS') return !lostBreakthrough && (entry.type === 'LEVEL_UP' || entry.type === 'XTREME_MILESTONE' || entry.type === 'ACHIEVEMENT' || entry.type === 'FATE');
  return true;
};
