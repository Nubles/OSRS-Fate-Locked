import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_STORAGE_KEY, ChangelogStorage,
  changelogVisibilityReducer, markChangelogSeen, resolveChangelogRestoreTarget,
  resolveChangelogModalRenderPolicy, shouldAutoOpenChangelog,
  shouldEnableUnderlyingModalEscape,
  shouldRenderUnderlyingModals, shouldShowChangelog,
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

  it('targets the persistent settings trigger only for manual opens', () => {
    const settingsTrigger = { id: 'settings-trigger' };

    expect(resolveChangelogRestoreTarget('manual', settingsTrigger))
      .toBe(settingsTrigger);
    expect(resolveChangelogRestoreTarget('automatic', settingsTrigger))
      .toBeNull();
    expect(resolveChangelogRestoreTarget('manual', null))
      .toBeNull();
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
