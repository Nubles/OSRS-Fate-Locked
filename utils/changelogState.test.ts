import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_STORAGE_KEY, ChangelogStorage,
  changelogVisibilityReducer, markChangelogSeen, shouldShowChangelog,
} from './changelogState';

class MemoryStorage implements ChangelogStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('changelog state', () => {
  it('shows once, then shows a later release', () => {
    const storage = new MemoryStorage();
    expect(shouldShowChangelog('r1', storage)).toBe(true);
    markChangelogSeen('r1', storage);
    expect(storage.getItem(CHANGELOG_STORAGE_KEY)).toBe('r1');
    expect(shouldShowChangelog('r1', storage)).toBe(false);
    expect(shouldShowChangelog('r2', storage)).toBe(true);
  });

  it('survives blocked storage', () => {
    const storage: ChangelogStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(shouldShowChangelog('r1', storage)).toBe(true);
    expect(() => markChangelogSeen('r1', storage)).not.toThrow();
  });

  it('allows manual reopening', () => {
    const closed = changelogVisibilityReducer(true, { type: 'DISMISS' });
    expect(closed).toBe(false);

    expect(changelogVisibilityReducer(closed, { type: 'OPEN' })).toBe(true);
  });
});
