// ui-osrs-b.d1[1]: the History search (Classic log and the OSRS History
// board share filterHistory) ignores apostrophes and stray spaces.
import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import { filterHistory } from './LogViewer';

const entry = (id: string, message: string, source?: string, details?: string): LogEntry =>
  ({ id, timestamp: Number(id), type: 'ROLL_SUCCESS', message, source, details });

const history = [
  entry('1', "Rolled for Larran's key", 'Col. Log: Larran\'s key'),
  entry('2', 'Unlocked Asgarnia', 'Quest: Witch\'s Potion'),
  entry('3', 'Unlocked a bank', undefined, "Warriors' Guild bank"),
];
const ids = (term: string) => filterHistory(history, 'ALL', term, 'ASC').map(e => e.id);

describe('History search', () => {
  it('finds entries typed without their apostrophe', () => {
    expect(ids('larrans key')).toEqual(['1']);
    expect(ids('witchs potion')).toEqual(['2']);
    expect(ids('warriors guild')).toEqual(['3']);
  });

  it('ignores stray spaces', () => {
    expect(ids('larrans key ')).toEqual(['1']);
    expect(ids(' ')).toEqual(['1', '2', '3']);
  });
});
