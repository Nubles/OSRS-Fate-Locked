import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import type { GameState } from '../types';
import { getBackupData, listBackups, pushBackup } from './backups';
import {
  ACCEPTED_WARNING_CLOSE_DELAY_MS,
  applyPreparedReplacement,
  applyValidatedReplacement,
  candidateMatchesSource,
  importUiDecision,
  isCurrentImportRequest,
  prepareReplacement,
  SaveOwnershipConflictError,
  serializeCurrent,
} from './gamePersistence';
import { parseAndMigrateSave } from './saveSchema';

const cloneState = (overrides: Partial<GameState> = {}): GameState => ({
  ...structuredClone(initialState),
  ...overrides,
});

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
});

describe('live-state serialization', () => {
  it('serializes the visible state instead of a stale persisted snapshot', () => {
    localStorage.setItem('profile', JSON.stringify(cloneState({ keys: 1 })));
    const visible = cloneState({ keys: 4 });
    expect(JSON.parse(serializeCurrent(visible)).keys).toBe(4);
  });

  it('is pure and excludes the transient lastEvent field entirely', () => {
    const getItem = vi.spyOn(localStorage, 'getItem');
    const visible = { ...cloneState(), lastEvent: { id: 'transient' } };
    const serialized = serializeCurrent(visible);
    expect(Object.prototype.hasOwnProperty.call(JSON.parse(serialized), 'lastEvent')).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
    expect(visible.lastEvent).toEqual({ id: 'transient' });
  });
});

describe('import outcome UI policy', () => {
  it('closes and reports success only for an accepted import', () => {
    expect(importUiDecision({ ok: true, warnings: [] })).toEqual({
      close: true,
      closeDelayMs: 0,
      success: 'Fate restored successfully',
      error: null,
      warning: null,
    });
  });

  it('keeps the source open and reports the returned rejection message', () => {
    expect(importUiDecision({
      ok: false,
      code: 'invalid_unlocks',
      message: 'Save unlock data is invalid at unlocks.levels.Attack.',
      path: 'unlocks.levels.Attack',
    })).toEqual({
      close: false,
      closeDelayMs: null,
      success: null,
      error: 'Save unlock data is invalid at unlocks.levels.Attack.',
      warning: null,
    });
  });

  it('displays backup warnings while still accepting and closing the import', () => {
    expect(ACCEPTED_WARNING_CLOSE_DELAY_MS).toBe(1_500);
    expect(importUiDecision({
      ok: true,
      warnings: [{
        code: 'storage_warning',
        message: 'The current run could not be saved as a protective backup.',
      }],
    })).toEqual({
      close: true,
      closeDelayMs: ACCEPTED_WARNING_CLOSE_DELAY_MS,
      success: 'Fate restored successfully',
      error: null,
      warning: 'The current run could not be saved as a protective backup.',
    });
  });
});

describe('async import request guards', () => {
  it('accepts only the latest request for the exact source text', () => {
    const first = { id: 1, source: 'FLSYNC.old' };
    const second = { id: 2, source: 'FLSYNC.new' };

    expect(isCurrentImportRequest(2, 'FLSYNC.new', second)).toBe(true);
    expect(isCurrentImportRequest(2, 'FLSYNC.new', first)).toBe(false);
    expect(isCurrentImportRequest(2, 'FLSYNC.edited', second)).toBe(false);
  });

  it('binds a verified candidate to the source that produced it', () => {
    const candidate = { source: 'FLSYNC.verified', value: cloneState({ keys: 9 }) };
    expect(candidateMatchesSource(candidate, 'FLSYNC.verified')).toBe(true);
    expect(candidateMatchesSource(candidate, 'FLSYNC.changed')).toBe(false);
  });

  it('uses the same request guard to reject a stale profile file read', () => {
    const fileRead = { id: 4, source: 'FATE_PROFILE_alpha' };
    expect(isCurrentImportRequest(4, 'FATE_PROFILE_alpha', fileRead)).toBe(true);
    expect(isCurrentImportRequest(5, 'FATE_PROFILE_beta', fileRead)).toBe(false);
  });
});

describe('transactional replacement', () => {
  it('rejects invalid input before backup or replacement callbacks run', () => {
    const events: string[] = [];
    const result = applyPreparedReplacement({ ...cloneState(), keys: -1 }, {
      current: cloneState({ keys: 3 }), defaults: initialState,
      writeBackup: () => { events.push('backup'); return { stored: true }; },
      writeReplacement: () => undefined,
      replace: () => { events.push('replace'); },
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_number', path: 'keys' });
    expect(events).toEqual([]);
  });

  it('backs up the exact live state before replacing it once', () => {
    const events: string[] = [];
    const result = applyPreparedReplacement(cloneState({ keys: 9 }), {
      current: cloneState({ keys: 3 }), defaults: initialState,
      writeBackup: data => { events.push('backup:' + JSON.parse(data).keys); return { stored: true }; },
      writeReplacement: data => { events.push('persist:' + JSON.parse(data).keys); },
      replace: state => { events.push('replace:' + state.keys); },
    });
    expect(result).toEqual({ ok: true, warnings: [] });
    expect(events).toEqual(['backup:3', 'persist:9', 'replace:9']);
  });

  it('reports failure before in-memory replacement when the durable write throws', () => {
    const events: string[] = [];
    const result = applyPreparedReplacement(cloneState({ keys: 9 }), {
      current: cloneState({ keys: 3 }),
      defaults: initialState,
      writeBackup: data => {
        events.push('backup:' + JSON.parse(data).keys);
        return { stored: true };
      },
      writeReplacement: data => {
        events.push('persist:' + JSON.parse(data).keys);
        throw new Error('quota');
      },
      replace: state => { events.push('replace:' + state.keys); },
    });

    expect(result).toEqual({
      ok: false,
      code: 'storage_unavailable',
      message: 'The replacement run could not be saved. Your current run is unchanged.',
    });
    expect(events).toEqual(['backup:3', 'persist:9']);
  });

  it('does not replace in memory when durable ownership is held elsewhere', () => {
    const replace = vi.fn();
    const result = applyPreparedReplacement(cloneState({ keys: 9 }), {
      current: cloneState({ keys: 3 }),
      defaults: initialState,
      writeBackup: () => ({ stored: true }),
      writeReplacement: () => {
        throw new SaveOwnershipConflictError();
      },
      replace,
    });

    expect(result).toEqual({
      ok: false,
      code: 'ownership_conflict',
      message: 'This profile is being saved by another tab. Take over before replacing it.',
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it('replaces valid input with a storage warning when the protective backup fails', () => {
    const replacements: number[] = [];
    const result = applyPreparedReplacement(cloneState({ keys: 9 }), {
      current: cloneState({ keys: 3 }), defaults: initialState,
      writeBackup: () => ({ stored: false, reason: 'storage_unavailable' }),
      writeReplacement: () => undefined,
      replace: state => { replacements.push(state.keys); },
    });
    expect(result).toEqual({ ok: true, warnings: [{
      code: 'storage_warning',
      message: 'The current run could not be saved as a protective backup.',
    }] });
    expect(replacements).toEqual([9]);
  });

  it.each(['duplicate', 'empty'] as const)('does not warn for a %s backup no-op', reason => {
    const result = applyPreparedReplacement(cloneState({ keys: 9 }), {
      current: cloneState({ keys: 3 }), defaults: initialState,
      writeBackup: () => ({ stored: false, reason }),
      writeReplacement: () => undefined,
      replace: () => undefined,
    });
    expect(result).toEqual({ ok: true, warnings: [] });
  });

  it('keeps migration warnings and appends exactly one storage warning', () => {
    const historical = structuredClone(initialState) as unknown as Record<string, unknown>;
    delete historical.version;
    const result = applyPreparedReplacement(historical, {
      current: cloneState(), defaults: initialState,
      writeBackup: () => ({ stored: false, reason: 'storage_unavailable' }),
      writeReplacement: () => undefined,
      replace: () => undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.map(warning => warning.code)).toEqual(['migrated', 'storage_warning']);
  });

  it('prepares input through the canonical schema boundary', () => {
    expect(prepareReplacement({ ...cloneState(), fatePoints: Number.NaN }, cloneState(), initialState))
      .toMatchObject({ ok: false, code: 'invalid_number', path: 'fatePoints' });
  });

  it('validates a stored backup before callbacks run', () => {
    const events: string[] = [];
    const result = applyValidatedReplacement(parseAndMigrateSave('{not json', initialState), {
      current: cloneState({ keys: 3 }),
      writeBackup: () => { events.push('backup'); return { stored: true }; },
      writeReplacement: () => undefined,
      replace: () => { events.push('replace'); },
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_json' });
    expect(events).toEqual([]);
  });

  it.each([['missing', null], ['corrupt', '{not json']] as const)(
    'leaves the backup ring untouched for a %s selected backup', (_label, data) => {
      const storageKey = 'FATE_PROFILE_restore';
      if (data !== null) pushBackup(storageKey, data, 'corrupt', () => true);
      const before = listBackups(storageKey);
      const selected = data === null ? getBackupData(storageKey, 0) : getBackupData(storageKey, before[0].ts);
      const prepared = selected === null
        ? { ok: false as const, code: 'invalid_json' as const, message: 'Backup was not found.' }
        : parseAndMigrateSave(selected, initialState);
      const result = applyValidatedReplacement(prepared, {
        current: cloneState(),
        writeBackup: current => pushBackup(storageKey, current, 'Before restore', () => true),
        writeReplacement: () => undefined,
        replace: () => undefined,
      });
      expect(result.ok).toBe(false);
      expect(listBackups(storageKey)).toEqual(before);
    },
  );
});
