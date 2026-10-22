import { describe, expect, it } from 'vitest';
import type { GameState, LogEntry } from '../types';
import type { SaveValidationResult } from './saveSchema';
import {
  MAX_REMEMBERED_RUNS,
  parseRestoreCounts,
  readRestoreCounts,
  rememberRun,
  restoredLabel,
  stampRestoreCount,
  writeRestoreCounts,
  type RestoreCounts,
} from './restoreCount';

const RUN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const entry = { id: 'e1', timestamp: 1, type: 'ROLL_FAIL', message: 'Rolled' } as LogEntry;

const run = (runId: string, restoreCount?: number, history: LogEntry[] = [entry]) =>
  ({ runId, restoreCount, history }) as Pick<GameState, 'runId' | 'restoreCount' | 'history'>;
const prepared = (runId: string, restoreCount?: number): SaveValidationResult =>
  ({ ok: true, state: { ...run(runId, restoreCount) } as GameState, sourceVersion: 5, warnings: [] });
const countOf = (result: SaveValidationResult): number | undefined =>
  result.ok ? result.state.restoreCount : undefined;

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
};

describe('restore counts (critique GP-4)', () => {
  it('counts every backup restore, and survives restoring a backup from before the last one', () => {
    let counts: RestoreCounts = {};
    // Restore "Session start" (count 0 inside) over the run.
    const first = stampRestoreCount(prepared(RUN), run(RUN), counts, 'restore');
    expect(countOf(first.prepared)).toBe(1);
    counts = first.counts;
    // Restore the same old backup again: its GameState still says 0, the profile remembers 1.
    const second = stampRestoreCount(prepared(RUN), run(RUN, 1), counts, 'restore');
    expect(countOf(second.prepared)).toBe(2);
    // Even with the profile's count lost, the current run's own count is not rolled back.
    expect(countOf(stampRestoreCount(prepared(RUN), run(RUN, 2), {}, 'restore').prepared)).toBe(3);
    // And with the current run elsewhere (a reset), the profile's count still holds.
    expect(countOf(stampRestoreCount(prepared(RUN), run(OTHER), second.counts, 'restore').prepared)).toBe(3);
  });

  it('counts an import of a run this profile already had, but not a run arriving for the first time', () => {
    expect(countOf(stampRestoreCount(prepared(RUN), run(RUN), {}, 'import').prepared)).toBe(1);
    expect(countOf(stampRestoreCount(prepared(RUN), run(OTHER), { [RUN]: 0 }, 'import').prepared)).toBe(1);
    const moved = stampRestoreCount(prepared(RUN, 4), run(OTHER, undefined, []), {}, 'import');
    expect(countOf(moved.prepared)).toBe(4);
    expect(countOf(stampRestoreCount(prepared(RUN), run(OTHER, undefined, []), {}, 'import').prepared)).toBeUndefined();
  });

  it('remembers the run it replaces, so importing that run back later counts', () => {
    const replaced = stampRestoreCount(prepared(OTHER), run(RUN, 2), {}, 'import');
    expect(replaced.counts[RUN]).toBe(2);
    expect(countOf(stampRestoreCount(prepared(RUN, 0), run(OTHER), replaced.counts, 'import').prepared)).toBe(3);
    // A reset remembers the run the same way; a run with no history is not worth remembering.
    expect(rememberRun({}, run(RUN, 1))).toEqual({ [RUN]: 1 });
    expect(rememberRun({}, run(RUN, 1, []))).toEqual({});
  });

  it('passes a rejected replacement through untouched', () => {
    const rejected: SaveValidationResult = { ok: false, code: 'invalid_json', message: 'bad' };
    expect(stampRestoreCount(rejected, run(RUN), { [RUN]: 1 }, 'restore')).toEqual({ prepared: rejected, counts: { [RUN]: 1 } });
  });

  it('keeps the profile count outside the save, tolerates damage, and forgets the oldest runs past the cap', () => {
    const storage = memoryStorage();
    writeRestoreCounts(storage, 'FATE_PROFILE_a', { [RUN]: 2 });
    expect(storage.values.has('FATE_PROFILE_a__restores')).toBe(true);
    expect(readRestoreCounts(storage, 'FATE_PROFILE_a')).toEqual({ [RUN]: 2 });
    expect(parseRestoreCounts('not json')).toEqual({});
    expect(parseRestoreCounts(JSON.stringify({ v: 1, runs: { [RUN]: -1, [OTHER]: 3, x: 'y' } }))).toEqual({ [OTHER]: 3 });
    const many = Object.fromEntries(Array.from({ length: MAX_REMEMBERED_RUNS + 5 }, (_, i) => [`run-${i}`, 1]));
    writeRestoreCounts(storage, 'FATE_PROFILE_a', many);
    const kept = readRestoreCounts(storage, 'FATE_PROFILE_a');
    expect(Object.keys(kept)).toHaveLength(MAX_REMEMBERED_RUNS);
    expect(kept['run-0']).toBeUndefined();
    expect(kept[`run-${MAX_REMEMBERED_RUNS + 4}`]).toBe(1);
  });

  it('labels the run card only once the run was restored', () => {
    expect(restoredLabel(undefined)).toBeNull();
    expect(restoredLabel(0)).toBeNull();
    expect(restoredLabel(1)).toBe('Restored 1 time');
    expect(restoredLabel(2)).toBe('Restored 2 times');
  });
});
