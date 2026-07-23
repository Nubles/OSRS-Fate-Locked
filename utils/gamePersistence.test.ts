import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import type { GameState } from '../types';
import { getBackupData, listBackups, pushBackup } from './backups';
import {
  applyPreparedReplacement,
  applyValidatedReplacement,
  prepareReplacement,
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

describe('transactional replacement', () => {
  it('rejects invalid input before backup or replacement callbacks run', () => {
    const events: string[] = [];
    const result = applyPreparedReplacement({ ...cloneState(), keys: -1 }, {
      current: cloneState({ keys: 3 }), defaults: initialState,
      writeBackup: () => { events.push('backup'); return { stored: true }; },
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
      replace: state => { events.push('replace:' + state.keys); },
    });
    expect(result).toEqual({ ok: true, warnings: [] });
    expect(events).toEqual(['backup:3', 'replace:9']);
  });

  it('replaces valid input with a storage warning when the protective backup fails', () => {
    const replacements: number[] = [];
    const result = applyPreparedReplacement(cloneState({ keys: 9 }), {
      current: cloneState({ keys: 3 }), defaults: initialState,
      writeBackup: () => ({ stored: false, reason: 'storage_unavailable' }),
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
      replace: () => { events.push('replace'); },
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_json' });
    expect(events).toEqual([]);
  });

  it.each([['missing', null], ['corrupt', '{not json']] as const)(
    'leaves the backup ring untouched for a %s selected backup', (_label, data) => {
      const storageKey = 'FATE_PROFILE_restore';
      if (data !== null) pushBackup(storageKey, data, 'corrupt');
      const before = listBackups(storageKey);
      const selected = data === null ? getBackupData(storageKey, 0) : getBackupData(storageKey, before[0].ts);
      const prepared = selected === null
        ? { ok: false as const, code: 'invalid_json' as const, message: 'Backup was not found.' }
        : parseAndMigrateSave(selected, initialState);
      const result = applyValidatedReplacement(prepared, {
        current: cloneState(),
        writeBackup: current => pushBackup(storageKey, current, 'Before restore'),
        replace: () => undefined,
      });
      expect(result.ok).toBe(false);
      expect(listBackups(storageKey)).toEqual(before);
    },
  );
});
