import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_SEEN_KEY,
  markLatestSeen,
  readLatestSeen,
  shouldAutoOpenChangelog,
} from './changelogState';

const latestId = '2026-07-26-vanilla-key-safety-valve';

describe('changelog seen state', () => {
  it('auto-opens only when the stored latest id differs', () => {
    expect(shouldAutoOpenChangelog(latestId, null)).toBe(true);
    expect(shouldAutoOpenChangelog(latestId, '2026-07-23-tracker-accuracy')).toBe(true);
    expect(shouldAutoOpenChangelog(latestId, latestId)).toBe(false);
  });

  it('reads and writes only the latest seen id in browser-local storage', () => {
    let stored: string | null = null;
    const storage = {
      getItem: (key: string) => (key === CHANGELOG_SEEN_KEY ? stored : null),
      setItem: (key: string, value: string) => {
        if (key === CHANGELOG_SEEN_KEY) stored = value;
      },
    };

    expect(readLatestSeen(storage)).toBeNull();
    markLatestSeen(storage, latestId);
    expect(stored).toBe(latestId);
    expect(readLatestSeen(storage)).toBe(latestId);
  });

  it('does not reopen for additions or corrections to older history', () => {
    const storedIdBeforeOlderHistoryChanged = latestId;

    expect(shouldAutoOpenChangelog(latestId, storedIdBeforeOlderHistoryChanged)).toBe(false);
  });
});
