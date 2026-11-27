// The "Collection log rolls" panel lists every Key roll a new log slot made.
// A slot logged by hand rolls as "Col. Log: <item>" (CollectionLog.tsx), but a
// slot RuneLite logs rolls through the detected event as "Collection Log"
// (fateEventEligibility.ts, DropSource.COLLECTION_LOG). The panel matched only
// the first, so a run that logs through the plugin saw "No collection log
// rolls yet" although its new items had rolled.
import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../../types';
import { collectionLogRolls } from './OsrsCollection';
import source from './OsrsCollection.tsx?raw';

const entry = (id: string, source: string, type: LogEntry['type'] = 'ROLL_FAIL', message = 'No Key', details?: string): LogEntry =>
  ({ id, timestamp: Number(id.replace(/\D/g, '')) || 0, type, source, message, details });

describe('OSRS Collection log rolls panel', () => {
  it('lists rolls logged by hand and rolls synced from RuneLite, newest first', () => {
    const history = [
      entry('e1', 'Col. Log: Abyssal whip'),
      entry('e2', 'Quest (Novice)'),
      // As a synced roll is written: the source is the drop source, the details the roll text.
      entry('e3', 'Collection Log', 'ROLL_OMNI', 'Key and Omni-Key Found!', 'Rolled 0.1 (≤ 8.0%), and an Omni-Key came with the Key.'),
      entry('e4', 'Boss (Medium)'),
    ];
    const rolls = collectionLogRolls(history);
    expect(rolls.map(e => e.id)).toEqual(['e3', 'e1']);
    // The rows show each entry's own text: nothing is rewritten.
    expect(rolls[0]).toBe(history[2]);
    expect(rolls[0].source).toBe('Collection Log');
  });

  it('keeps the newest 40 of both kinds', () => {
    const history = Array.from({ length: 50 }, (_, i) => entry(`e${i}`, i % 2 ? 'Collection Log' : `Col. Log: Item ${i}`));
    const rolls = collectionLogRolls(history);
    expect(rolls).toHaveLength(40);
    expect(rolls[0].id).toBe('e49');
    expect(rolls[39].id).toBe('e10');
  });

  it('ignores sources that only look alike', () => {
    expect(collectionLogRolls([entry('a', 'Collection Logger'), entry('b', 'Clue Scroll (Easy)')])).toEqual([]);
  });

  it('is the list the panel shows', () => {
    expect(source).toContain('const rolls = useMemo(() => collectionLogRolls(history), [history]);');
  });
});
