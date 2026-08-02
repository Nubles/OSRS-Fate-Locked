// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const PROFILE_ID = 'changelog-lifecycle-profile';
const values = new Map<string, string>();
let failedWriteKey: string | null = null;
const storage: Pick<Storage, 'clear' | 'getItem' | 'removeItem' | 'setItem'> = {
  clear: () => values.clear(),
  getItem: key => values.get(key) ?? null,
  removeItem: key => { values.delete(key); },
  setItem: (key, value) => {
    if (key === failedWriteKey) throw new DOMException('full', 'QuotaExceededError');
    values.set(key, String(value));
  },
};

let App: React.ComponentType;
let seedOnboardingRun: (withHistory?: boolean) => string;
let profileBaseKey: (profileId: string) => string;
let writerLeaseKey: (storageKey: string) => string;
let changelogStorageKey: string;
let latestChangelogId: string;

beforeEach(async () => {
  values.clear();
  failedWriteKey = null;
  vi.stubGlobal('localStorage', storage);
  vi.spyOn(globalThis.crypto, 'randomUUID')
    .mockReturnValue('00000000-0000-4000-8000-000000000001');
  vi.spyOn(window, 'confirm').mockReturnValue(true);

  const [{ default: LoadedApp }, gameContext, persistence, profileStorage, profileWriterLease, changelogState, changelog] = await Promise.all([
    import('./App'),
    import('./context/GameContext'),
    import('./utils/gamePersistence'),
    import('./utils/profileStorage'),
    import('./utils/profileWriterLease'),
    import('./utils/changelogState'),
    import('./data/changelog'),
  ]);
  App = LoadedApp;
  profileBaseKey = profileStorage.profileBaseKey;
  writerLeaseKey = profileWriterLease.writerLeaseKey;
  changelogStorageKey = changelogState.CHANGELOG_STORAGE_KEY;
  latestChangelogId = changelog.LATEST_CHANGELOG.id;

  seedOnboardingRun = (withHistory = true) => {
    let seeded = { ...structuredClone(gameContext.initialState), lastEvent: null };
    if (withHistory) {
      seeded = gameContext.gameReducer(
        seeded,
        {
          type: 'ROLL_RESULT',
          payload: {
            success: false,
            omni: false,
            pity: false,
            roll: 99,
            baseThreshold: 50,
            threshold: 50,
            source: 'Lifecycle test',
            failureFate: 1,
          },
        },
      );
    }
    seeded.hasSeenOnboarding = false;
    return persistence.serializeCurrent(seeded);
  };

  storage.setItem('FATE_PROFILES', JSON.stringify({
    profiles: [{ id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 }],
    activeProfileId: PROFILE_ID,
  }));
  storage.setItem(profileBaseKey(PROFILE_ID), seedOnboardingRun());
}, 30_000);

afterEach(() => {
  cleanup();
  values.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('App changelog lifecycle', () => {
  it.each([
    [28, 'Level Up + Chaos Key!'],
    [29, 'Level Up + 2 Chaos Keys!'],
  ] as const)('shows level reward feedback after the provider finishes the level %i roll', async (currentLevel, expectedMessage) => {
    const profileKey = profileBaseKey(PROFILE_ID);
    const readyState = JSON.parse(seedOnboardingRun());
    readyState.hasSeenOnboarding = true;
    readyState.animationsEnabled = false;
    readyState.unlocks.skills.Attack = 1;
    readyState.unlocks.levels.Attack = currentLevel;
    storage.setItem(profileKey, JSON.stringify(readyState));
    storage.setItem(changelogStorageKey, latestChangelogId);
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.01)
      .mockReturnValue(0.99);
    render(<App />);

    const attackCard = document.querySelector<HTMLElement>('[data-skill-card="Attack"]');
    expect(attackCard).toBeTruthy();
    fireEvent.click(attackCard!);

    expect(await screen.findByText(expectedMessage)).toBeTruthy();
  });

  it('auto-opens one unseen release after onboarding completes', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('dialog', { name: "What's New" })).toBeNull();

    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Enter The Void' }));

    const dialog = await screen.findByRole('dialog', { name: "What's New" });
    expect(dialog).toBeTruthy();
    expect(document.querySelectorAll('[role="dialog"][aria-labelledby="whats-new-title"]')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: "Close What's New" }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: "What's New" })).toBeNull();
    });
    expect(storage.getItem(changelogStorageKey)).toBe(latestChangelogId);
  }, 15_000);
  it('defers the unseen release until the post-onboarding game-mode prompt closes', async () => {
    storage.setItem(profileBaseKey(PROFILE_ID), seedOnboardingRun(false));
    const user = userEvent.setup();
    render(<App />);

    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Enter The Void' }));

    const gameMode = await screen.findByRole('dialog', { name: 'Choose game mode' });
    expect(screen.queryByRole('dialog', { name: "What's New" })).toBeNull();

    await user.click(within(gameMode).getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('dialog', { name: "What's New" })).toBeTruthy();
  });

  it('scrubs a valid RuneLite pairing fragment and owns the startup modal', async () => {
    const code = '0123456789abcdef0123456789abcdef';
    window.history.replaceState(
      null, '', `/#runelite-pair=${code}`,
    );
    render(<App />);

    const dialog = await screen.findByRole('dialog', {
      name: 'Connect RuneLite tracker',
    });
    expect(window.location.hash).toBe('');
    expect(within(dialog).getByText('Lifecycle test')).toBeTruthy();
    expect(within(dialog).getByText('No bound account')).toBeTruthy();
    expect(screen.queryByRole('dialog', {
      name: "What's New",
    })).toBeNull();
  });

  it('opens the RuneLite guide from a direct query and preserves unrelated URL state', async () => {
    window.history.replaceState(
      null, '', '/?open=runelite-guide&foo=bar#player-help',
    );
    render(<App />);

    expect(await screen.findByRole(
      'dialog',
      { name: 'RuneLite Plugin Guide' },
      { timeout: 10_000 },
    )).toBeTruthy();
    expect(window.location.search).toBe('?foo=bar');
    expect(window.location.hash).toBe('#player-help');
    expect(screen.queryByRole('dialog', {
      name: "What's New",
    })).toBeNull();
  }, 15_000);

  it('opens the RuneLite guide from the persistent settings menu', async () => {
    storage.setItem(changelogStorageKey, latestChangelogId);
    const user = userEvent.setup();
    render(<App />);

    const settings = screen.getByRole('button', {
      name: 'Settings & save tools',
    });
    await user.click(settings);
    await user.click(screen.getByRole('button', {
      name: 'RuneLite Plugin Guide',
    }));

    const guideDialog = await screen.findByRole('dialog', {
      name: 'RuneLite Plugin Guide',
    });
    expect(guideDialog).toBeTruthy();
    await user.click(within(guideDialog).getAllByRole('button', {
      name: 'Close RuneLite Plugin Guide',
    })[0]);
    expect(document.activeElement).toBe(settings);
  });

  it('opens the RuneLite guide from the command palette and returns focus to Jump to', async () => {
    storage.setItem(changelogStorageKey, latestChangelogId);
    const user = userEvent.setup();
    render(<App />);

    const paletteTrigger = screen.getByTitle(/Command palette/i);
    await user.click(paletteTrigger);
    await user.type(
      screen.getByPlaceholderText(/Jump to a tab, tool or action/i),
      'guardian warnings rendering',
    );
    await user.click(await screen.findByRole('button', {
      name: /RuneLite Plugin Guide.*Install, connect, configure and troubleshoot RuneLite/i,
    }));

    const guideDialog = await screen.findByRole('dialog', {
      name: 'RuneLite Plugin Guide',
    });
    await user.click(within(guideDialog).getAllByRole('button', {
      name: 'Close RuneLite Plugin Guide',
    })[0]);
    expect(document.activeElement).toBe(paletteTrigger);
  }, 15_000);

  it('recovers the latest game action after active-profile storage fails', async () => {
    const profileKey = profileBaseKey(PROFILE_ID);
    const readyState = JSON.parse(seedOnboardingRun());
    readyState.hasSeenOnboarding = true;
    storage.setItem(profileKey, JSON.stringify(readyState));
    storage.setItem(changelogStorageKey, latestChangelogId);
    const originalAnimations = readyState.animationsEnabled;
    const user = userEvent.setup();
    render(<App />);

    await new Promise(resolve => window.setTimeout(resolve, 550));
    failedWriteKey = profileKey;
    await user.click(screen.getByRole('button', { name: 'Settings & save tools' }));
    await user.click(screen.getByRole('button', { name: /Animations/ }));

    const alert = await screen.findByRole('alert', undefined, { timeout: 2_000 });
    expect(alert.textContent).toContain("Progress isn't being saved");
    expect(JSON.parse(values.get(profileKey)!).animationsEnabled).toBe(originalAnimations);
    const protectedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(protectedUnload);
    expect(protectedUnload.defaultPrevented).toBe(true);

    failedWriteKey = null;
    await user.click(screen.getByRole('button', { name: 'Retry save' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(JSON.parse(values.get(profileKey)!).animationsEnabled).toBe(!originalAnimations);
    const safeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(safeUnload);
    expect(safeUnload.defaultPrevented).toBe(false);
  }, 15_000);

  it('blocks a foreign-owned profile and saves only after confirmed takeover', async () => {
    const profileKey = profileBaseKey(PROFILE_ID);
    const readyState = JSON.parse(seedOnboardingRun());
    readyState.hasSeenOnboarding = true;
    storage.setItem(profileKey, JSON.stringify(readyState));
    storage.setItem(writerLeaseKey(profileKey), JSON.stringify({
      version: 1,
      ownerId: 'other-tab',
      expiresAt: Date.now() + 30_000,
    }));
    storage.setItem(changelogStorageKey, latestChangelogId);
    const user = userEvent.setup();
    render(<App />);

    const conflict = await screen.findByRole('alert');
    expect(conflict.textContent).toContain('This profile is open in another tab');
    await user.click(screen.getByRole('button', { name: 'Settings & save tools' }));
    await user.click(screen.getByRole('button', { name: /Animations/ }));
    expect(screen.getByRole('button', { name: /Animations/ }).getAttribute('aria-pressed'))
      .toBe(String(!readyState.animationsEnabled));
    await new Promise(resolve => window.setTimeout(resolve, 550));
    expect(JSON.parse(values.get(profileKey)!).animationsEnabled)
      .toBe(readyState.animationsEnabled);

    const protectedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(protectedUnload);
    expect(protectedUnload.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Take over and save this tab' }));
    expect(screen.getByRole('alert').textContent)
      .toContain('This profile is open in another tab');
    expect(screen.getByRole('button', { name: /Taking over/ }).hasAttribute('disabled'))
      .toBe(true);
    await waitFor(() => {
      expect(screen.queryByText('This profile is open in another tab')).toBeNull();
      expect(JSON.parse(values.get(profileKey)!).animationsEnabled)
        .toBe(!readyState.animationsEnabled);
    });
    expect(window.confirm).toHaveBeenCalledOnce();

    const safeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(safeUnload);
    expect(safeUnload.defaultPrevented).toBe(false);
  }, 15_000);
});
