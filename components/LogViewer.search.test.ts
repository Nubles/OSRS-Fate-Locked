// ui-osrs-b.d1[1]: the History search (Classic log and the OSRS History
// board share filterHistory) ignores apostrophes and stray spaces.
import { describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../types';
import { filterHistory } from './LogViewer';

// Counts the texts the History search folds (the term folds through the
// module's own binding and is not counted).
const foldCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../utils/textFold', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../utils/textFold')>();
  return { ...mod, foldText: (s: string) => { foldCalls.n++; return mod.foldText(s); } };
});

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

  it('folds a long History once, not on every keystroke', () => {
    const long = Array.from({ length: 5000 }, (_, i) =>
      entry(String(i + 10), `Rolled for item ${i}`, i % 2 ? `Col. Log: Item ${i}` : undefined, i % 3 ? undefined : "Warriors' Guild"));
    long.push(entry('9', "Unlocked Kree'arra"));
    let before = foldCalls.n;
    expect(filterHistory(long, 'ALL', 'kreearra', 'ASC').map(e => e.id)).toEqual(['9']);
    expect(foldCalls.n - before).toBeGreaterThan(5000);
    before = foldCalls.n;
    expect(filterHistory(long, 'ALL', 'kreearr', 'ASC').map(e => e.id)).toEqual(['9']);
    expect(filterHistory(long, 'ALL', 'warriors guild', 'ASC')).toHaveLength(1667);
    expect(foldCalls.n - before).toBe(0);
  });

  it('never matches across two fields', () => {
    // "key" ends the message and "col" starts the source: no single field holds "key col".
    expect(ids('key col')).toEqual([]);
  });

  it('reads an entry again when its text changes', () => {
    const e = entry('1', 'Unlocked Asgarnia');
    expect(filterHistory([e], 'ALL', 'varrock', 'ASC')).toEqual([]);
    e.message = 'Unlocked Varrock';
    expect(filterHistory([e], 'ALL', 'varrock', 'ASC')).toEqual([e]);
  });
});
