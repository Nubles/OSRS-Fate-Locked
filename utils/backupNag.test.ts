import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldNagPure, shouldNag, markExported, snoozeNag, readNagRecord,
  lastExportLabel, NAG_AFTER_MS, SNOOZE_MS, MIN_HISTORY,
} from './backupNag';

const DAY = 24 * 60 * 60 * 1000;
const KEY = 'test_profile';

// Isolated in-memory localStorage (same pattern as backups.test.ts).
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
});

describe('shouldNagPure', () => {
  const fresh = { lastExport: 0, snoozeUntil: 0 };

  it('never nags a run without real progress', () => {
    expect(shouldNagPure(fresh, MIN_HISTORY - 1, Date.now())).toBe(false);
  });

  it('nags a never-exported run with progress', () => {
    expect(shouldNagPure(fresh, MIN_HISTORY, Date.now())).toBe(true);
  });

  it('goes quiet after an export, then returns after NAG_AFTER_MS', () => {
    const now = Date.now();
    const rec = { lastExport: now - DAY, snoozeUntil: 0 };
    expect(shouldNagPure(rec, 50, now)).toBe(false);
    expect(shouldNagPure(rec, 50, now - DAY + NAG_AFTER_MS + 1)).toBe(true);
  });

  it('respects a snooze even when overdue', () => {
    const now = Date.now();
    expect(shouldNagPure({ lastExport: 0, snoozeUntil: now + DAY }, 50, now)).toBe(false);
  });
});

describe('localStorage record', () => {
  it('markExported silences the nag', () => {
    expect(shouldNag(KEY, 50)).toBe(true);
    markExported(KEY);
    expect(shouldNag(KEY, 50)).toBe(false);
  });

  it('snoozeNag hides it for SNOOZE_MS then it returns', () => {
    const now = Date.now();
    snoozeNag(KEY, now);
    expect(shouldNag(KEY, 50, now + SNOOZE_MS - 1)).toBe(false);
    expect(shouldNag(KEY, 50, now + SNOOZE_MS + 1)).toBe(true);
  });

  it('survives a corrupt record', () => {
    localStorage.setItem(KEY + '__exportNag', '{not json');
    expect(readNagRecord(KEY)).toEqual({ lastExport: 0, snoozeUntil: 0 });
    expect(shouldNag(KEY, 50)).toBe(true);
  });

  it('lastExportLabel formats never/today/days', () => {
    expect(lastExportLabel(KEY)).toBe('never');
    const now = Date.now();
    markExported(KEY, now);
    expect(lastExportLabel(KEY, now)).toBe('today');
    expect(lastExportLabel(KEY, now + DAY)).toBe('yesterday');
    expect(lastExportLabel(KEY, now + 3 * DAY)).toBe('3 days ago');
  });
});
