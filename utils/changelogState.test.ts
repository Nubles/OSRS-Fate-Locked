import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_STORAGE_KEY, ChangelogStorage,
  changelogVisibilityReducer, hasUnseenReleaseForRun, markChangelogSeen,
  mayAutoOpenChangelogAgain, readSeenChangelog,
  resolveChangelogModalRenderPolicy, shouldAutoOpenChangelog,
  shouldEnableUnderlyingModalEscape,
  shouldRenderUnderlyingModals, shouldShowChangelog,
} from './changelogState';

describe('opening What\'s New again in one visit', () => {
  it('waits for the next visit, unless an offer arrived since', () => {
    expect(mayAutoOpenChangelogAgain(false, false)).toBe(true);
    expect(mayAutoOpenChangelogAgain(true, false)).toBe(false);
    expect(mayAutoOpenChangelogAgain(true, true)).toBe(true);
  });
});

class MemoryStorage implements ChangelogStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('What\'s New for a brand-new player', () => {
  const LATEST = '2026-10-18-latest';

  it('has no news for a run with no history, whatever the seen marker says', () => {
    expect(hasUnseenReleaseForRun(null, LATEST, 0)).toBe(false);
    expect(hasUnseenReleaseForRun('2026-09-01-older', LATEST, 0)).toBe(false);
    expect(hasUnseenReleaseForRun(LATEST, LATEST, 0)).toBe(false);
  });

  it('still has news for a returning player with an older or missing marker', () => {
    expect(hasUnseenReleaseForRun('2026-09-01-older', LATEST, 1)).toBe(true);
    expect(hasUnseenReleaseForRun('2026-09-01-older', LATEST, 250)).toBe(true);
    expect(hasUnseenReleaseForRun(null, LATEST, 12)).toBe(true);
  });

  it('has no news once the latest entry was seen', () => {
    expect(hasUnseenReleaseForRun(LATEST, LATEST, 40)).toBe(false);
  });

  it('marking seen at the end of onboarding keeps the first roll from bringing it back', () => {
    const storage = new MemoryStorage();
    expect(readSeenChangelog(storage)).toBeNull();
    markChangelogSeen(LATEST, storage);
    expect(hasUnseenReleaseForRun(readSeenChangelog(storage), LATEST, 1)).toBe(false);
    // The next release is news again.
    expect(hasUnseenReleaseForRun(readSeenChangelog(storage), '2026-11-01-next', 1)).toBe(true);
  });

  it('never auto-opens What\'s New right after onboarding on a fresh profile', () => {
    expect(shouldAutoOpenChangelog({
      hasSeenOnboarding: true,
      releaseIsUnseen: hasUnseenReleaseForRun(null, LATEST, 0),
      startupHash: '',
      hasPendingGameModePrompt: false,
    })).toBe(false);
  });

  it('reads blocked storage as nothing seen', () => {
    const blocked: ChangelogStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(readSeenChangelog(blocked)).toBeNull();
    expect(readSeenChangelog(undefined)).toBeNull();
  });
});

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

  it('defers an unseen release while a sync deep link owns startup', () => {
    const storage = new MemoryStorage();
    const releaseIsUnseen = shouldShowChangelog('r1', storage);

    expect(shouldAutoOpenChangelog({
      hasSeenOnboarding: true,
      releaseIsUnseen,
      startupHash: '#sync=FLSYNC.g1.payload',
      hasPendingGameModePrompt: false,
    })).toBe(false);
    expect(shouldShowChangelog('r1', storage)).toBe(true);
  });

  it('defers an unseen release for a valid RuneLite pairing request', () => {
    expect(shouldAutoOpenChangelog({
      hasSeenOnboarding: true,
      releaseIsUnseen: true,
      startupHash:
        '#runelite-pair=0123456789abcdef0123456789abcdef',
      hasPendingGameModePrompt: false,
    })).toBe(false);
  });

  it('does not defer an unseen release for an invalid pairing fragment', () => {
    expect(shouldAutoOpenChangelog({
      hasSeenOnboarding: true,
      releaseIsUnseen: true,
      startupHash: '#runelite-pair=ABCD1234',
      hasPendingGameModePrompt: false,
    })).toBe(true);
  });

  it('defers an unseen release while a new profile needs its game mode prompt', () => {
    expect(shouldAutoOpenChangelog({
      hasSeenOnboarding: true,
      releaseIsUnseen: true,
      startupHash: '',
      hasPendingGameModePrompt: true,
    })).toBe(false);
  });

  it('defers an unseen release while the direct RuneLite guide owns startup', () => {
    expect(shouldAutoOpenChangelog({
      hasSeenOnboarding: true,
      releaseIsUnseen: true,
      startupHash: '',
      hasPendingGameModePrompt: false,
      hasPendingGuidePrompt: true,
    })).toBe(false);
  });

  it('auto-opens only an unseen release on an otherwise clear startup', () => {
    const clearStartup = {
      hasSeenOnboarding: true,
      startupHash: '',
      hasPendingGameModePrompt: false,
    };

    expect(shouldAutoOpenChangelog({
      ...clearStartup,
      releaseIsUnseen: true,
    })).toBe(true);
    expect(shouldAutoOpenChangelog({
      ...clearStartup,
      releaseIsUnseen: false,
    })).toBe(false);
    expect(shouldAutoOpenChangelog({
      ...clearStartup,
      hasSeenOnboarding: false,
      releaseIsUnseen: true,
    })).toBe(false);
    expect(shouldAutoOpenChangelog({
      ...clearStartup,
      startupHash: '#sync=',
      releaseIsUnseen: true,
    })).toBe(true);
  });

  it('auto-opens a pending compensation offer even when the release was already seen', () => {
    const clearStartup = {
      hasSeenOnboarding: true,
      releaseIsUnseen: false,
      startupHash: '',
      hasPendingGameModePrompt: false,
      hasPendingCompensation: true,
    };

    expect(shouldAutoOpenChangelog(clearStartup)).toBe(true);
    expect(shouldAutoOpenChangelog({ ...clearStartup, hasPendingSyncPrompt: true })).toBe(false);
    expect(shouldAutoOpenChangelog({ ...clearStartup, hasPendingGuidePrompt: true })).toBe(false);
    expect(shouldAutoOpenChangelog({ ...clearStartup, hasPendingGameModePrompt: true })).toBe(false);
    expect(shouldAutoOpenChangelog({ ...clearStartup, hasSeenOnboarding: false })).toBe(false);
  });

  it('disables the underlying modal Escape closer while the changelog is topmost', () => {
    expect(shouldEnableUnderlyingModalEscape(true, true)).toBe(false);
    expect(shouldEnableUnderlyingModalEscape(true, false)).toBe(true);
    expect(shouldEnableUnderlyingModalEscape(false, false)).toBe(false);
  });

  it('renders underlying top-level modals only while the changelog is closed', () => {
    expect(shouldRenderUnderlyingModals(true)).toBe(false);
    expect(shouldRenderUnderlyingModals(false)).toBe(true);
  });

  it('suspends every App and Dashboard modal layer while the changelog is open', () => {
    expect(resolveChangelogModalRenderPolicy(true)).toEqual({
      renderAppModals: false,
      renderGlobalDialogOverlays: false,
      suspendDashboardModals: true,
    });
  });

  it('restores every App and Dashboard modal layer after the changelog closes', () => {
    expect(resolveChangelogModalRenderPolicy(false)).toEqual({
      renderAppModals: true,
      renderGlobalDialogOverlays: true,
      suspendDashboardModals: false,
    });
  });
});
