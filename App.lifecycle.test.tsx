// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DISCORD_INVITE_URL } from './constants';
import {
  getPendingSave,
  resetPendingSavesForTest,
} from './utils/pendingSaves';

const PROFILE_ID = 'changelog-lifecycle-profile';
const values = new Map<string, string>();
let failedWriteKey: string | null = null;
const storage: Pick<Storage, 'clear' | 'length' | 'key' | 'getItem' | 'removeItem' | 'setItem'> = {
  clear: () => values.clear(),
  get length() { return values.size; },
  key: index => [...values.keys()][index] ?? null,
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
  resetPendingSavesForTest();
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
            failureFate: 1,
            success: false,
            omni: false,
            pity: false,
            roll: 99,
            baseThreshold: 50,
            threshold: 50,
            source: 'Lifecycle test',
          },
        },
      );
    }
    seeded.hasSeenOnboarding = false;
    return persistence.serializeCurrent(seeded);
  };

  storage.setItem('FATE_PROFILES', JSON.stringify({
    version: 1,
    revision: 0,
    profiles: [{ id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 }],
    activeProfileId: PROFILE_ID,
  }));
  storage.setItem(profileBaseKey(PROFILE_ID), seedOnboardingRun());
}, 30_000);

afterEach(() => {
  cleanup();
  resetPendingSavesForTest();
  values.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('App changelog lifecycle', () => {
  it('checks saved progress before mounting the game', async () => {
    render(<App />);

    expect(await screen.findByText('Checking saved progress…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Settings & save tools' })).toBeNull();
  });

  it('shows the official Discord invite without replacing Discord notifications', async () => {
    const readyState = JSON.parse(seedOnboardingRun());
    readyState.hasSeenOnboarding = true;
    storage.setItem(profileBaseKey(PROFILE_ID), JSON.stringify(readyState));
    storage.setItem(changelogStorageKey, latestChangelogId);
    const user = userEvent.setup();

    render(<App />);

    const invite = await screen.findByRole('link', {
      name: 'Join the Fate Locked Discord',
    });
    expect(invite.getAttribute('href')).toBe(DISCORD_INVITE_URL);
    expect(invite.getAttribute('target')).toBe('_blank');
    expect(invite.getAttribute('rel')).toBe('noreferrer');
    expect(invite.textContent).toContain('Discord');
    expect(invite.querySelector('svg')).toBeTruthy();
    expect(invite.querySelector('span')?.className).toContain('hidden sm:inline');

    await user.click(screen.getByRole('button', { name: 'Settings & save tools' }));
    await user.click(screen.getByRole('button', { name: 'Discord notifications' }));
    expect(await screen.findByRole('dialog', { name: 'Discord notifications' })).toBeTruthy();
  });
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

    const attackCard = await waitFor(() => {
      const card = document.querySelector<HTMLElement>('[data-skill-card="Attack"]');
      expect(card).toBeTruthy();
      return card!;
    });
    fireEvent.click(attackCard);

    expect(await screen.findByText(expectedMessage)).toBeTruthy();
  });

  it('recovers a structurally malformed profile registry without blanking the dashboard', async () => {
    const recoveredId = 'recovered-run';
    const recoveredState = JSON.parse(seedOnboardingRun());
    recoveredState.hasSeenOnboarding = true;
    values.clear();
    storage.setItem('FATE_PROFILES', JSON.stringify({
      version: 1,
      revision: 7,
      profiles: 'not-an-array',
      activeProfileId: recoveredId,
    }));
    storage.setItem(profileBaseKey(recoveredId), JSON.stringify(recoveredState));
    storage.setItem(`${profileBaseKey(recoveredId)}__backups`, JSON.stringify(recoveredState));
    storage.setItem(`${profileBaseKey(recoveredId)}_misleading`, JSON.stringify(recoveredState));
    storage.setItem(changelogStorageKey, latestChangelogId);

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Settings & save tools' })).toBeTruthy();
    const recoveryHeading = await screen.findByText('Profile recovery completed');
    expect(recoveryHeading.closest('[role="status"]')?.textContent).toContain('Recovered 1 profile.');
    const profileTrigger = screen.getByRole('button', {
      name: 'Switch profile. Current profile: Recovered Profile 1',
    });
    fireEvent.click(profileTrigger);
    expect(screen.getAllByText('Recovered Profile 1')).toHaveLength(2);
    expect(screen.queryByText('Recovered Profile 2')).toBeNull();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  }, 15_000);

  it('opens a supported recovered run read-only without rewriting future metadata', async () => {
    const recoveredId = 'future-run';
    const recoveredState = JSON.parse(seedOnboardingRun());
    recoveredState.hasSeenOnboarding = true;
    const futureRaw = JSON.stringify({
      version: 2,
      revision: 19,
      profiles: [{ id: 'future-only', name: 'Future only', createdAt: 1 }],
      activeProfileId: 'future-only',
      opaque: { mustSurvive: true },
    });
    values.clear();
    storage.setItem('FATE_PROFILES', futureRaw);
    storage.setItem(profileBaseKey(recoveredId), JSON.stringify(recoveredState));
    storage.setItem(`${profileBaseKey(recoveredId)}__discord`, JSON.stringify(recoveredState));
    storage.setItem(changelogStorageKey, latestChangelogId);

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Settings & save tools' })).toBeTruthy();
    const compatibilityHeading = await screen.findByText('A newer app version saved these profiles');
    expect(compatibilityHeading.closest('[role="alert"]')?.textContent).toContain('Recovered 1 profile.');
    expect(screen.getByRole('button', {
      name: 'Switch profile. Current profile: Recovered Profile 1',
    })).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(storage.getItem('FATE_PROFILES')).toBe(futureRaw);
  }, 15_000);

  it('uses the production eviction bridge before switching after a newer registry removes the active profile', async () => {
    const replacementId = 'replacement-run';
    const profileKey = profileBaseKey(PROFILE_ID);
    const readyState = JSON.parse(seedOnboardingRun());
    readyState.hasSeenOnboarding = true;
    const initialRegistry = {
      version: 1,
      revision: 0,
      profiles: [
        { id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 },
        { id: replacementId, name: 'Replacement', createdAt: 2 },
      ],
      activeProfileId: PROFILE_ID,
    };
    values.clear();
    storage.setItem('FATE_PROFILES', JSON.stringify(initialRegistry));
    storage.setItem(profileKey, JSON.stringify(readyState));
    storage.setItem(changelogStorageKey, latestChangelogId);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('button', { name: 'Settings & save tools' });
    await new Promise(resolve => window.setTimeout(resolve, 550));
    const durableBeforeEviction = storage.getItem(profileKey);
    expect(getPendingSave(profileKey)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Settings & save tools' }));
    const animations = screen.getByRole('button', { name: /Animations/ });
    await user.click(animations);
    const expectedAnimations = !readyState.animationsEnabled;
    expect(animations.getAttribute('aria-pressed')).toBe(String(expectedAnimations));

    const incoming = {
      version: 1,
      revision: 1,
      profiles: [{ id: replacementId, name: 'Replacement', createdAt: 2 }],
      activeProfileId: replacementId,
    };
    const incomingRaw = JSON.stringify(incoming);
    storage.setItem('FATE_PROFILES', incomingRaw);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'FATE_PROFILES',
        oldValue: JSON.stringify(initialRegistry),
        newValue: incomingRaw,
      }));
    });

    const pending = getPendingSave(profileKey);
    expect(pending).toMatchObject({
      status: 'saving',
      reason: 'ownership_conflict',
    });
    expect(JSON.parse(pending?.data ?? '{}').animationsEnabled).toBe(expectedAnimations);
    expect(await screen.findByRole('button', {
      name: 'Switch profile. Current profile: Replacement',
    })).toBeTruthy();
    expect(storage.getItem('FATE_PROFILES')).toBe(incomingRaw);

    await new Promise(resolve => window.setTimeout(resolve, 650));
    expect(storage.getItem(profileKey)).toBe(durableBeforeEviction);
    expect(getPendingSave(profileKey)?.reason).toBe('ownership_conflict');
    expect(screen.queryByText('Something went wrong')).toBeNull();
  }, 15_000);

  it('uses the production eviction bridge when a real not_found result removes the local selection', async () => {
    const replacementId = 'not-found-replacement';
    const profileKey = profileBaseKey(PROFILE_ID);
    const readyState = JSON.parse(seedOnboardingRun());
    readyState.hasSeenOnboarding = true;
    const initialRegistry = {
      version: 1,
      revision: 0,
      profiles: [
        { id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 },
        { id: replacementId, name: 'Replacement', createdAt: 2 },
      ],
      activeProfileId: PROFILE_ID,
    };
    values.clear();
    storage.setItem('FATE_PROFILES', JSON.stringify(initialRegistry));
    storage.setItem(profileKey, JSON.stringify(readyState));
    storage.setItem(changelogStorageKey, latestChangelogId);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('button', { name: 'Settings & save tools' });
    await new Promise(resolve => window.setTimeout(resolve, 550));
    expect(getPendingSave(profileKey)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Settings & save tools' }));
    const animations = screen.getByRole('button', { name: /Animations/ });
    await user.click(animations);
    const expectedAnimations = !readyState.animationsEnabled;

    const durable = {
      version: 1,
      revision: 4,
      profiles: [{ id: replacementId, name: 'Replacement', createdAt: 2 }],
      activeProfileId: replacementId,
    };
    const durableRaw = JSON.stringify(durable);
    storage.setItem('FATE_PROFILES', durableRaw);

    await user.click(screen.getByRole('button', {
      name: 'Switch profile. Current profile: Lifecycle test',
    }));
    await user.click(screen.getByRole('button', { name: 'Rename Lifecycle test' }));
    const renameInput = screen.getByRole('textbox', { name: 'Rename Lifecycle test' });
    await user.clear(renameInput);
    await user.type(renameInput, 'Too late');
    await user.click(screen.getByRole('button', { name: 'Save profile name' }));

    expect(await screen.findByText('Your active profile was removed in another tab'))
      .toBeTruthy();
    expect(await screen.findByRole('button', {
      name: 'Switch profile. Current profile: Replacement',
    })).toBeTruthy();
    const pending = getPendingSave(profileKey);
    expect(pending).toMatchObject({
      status: 'saving',
      reason: 'ownership_conflict',
    });
    expect(JSON.parse(pending?.data ?? '{}').animationsEnabled).toBe(expectedAnimations);
    expect(storage.getItem('FATE_PROFILES')).toBe(durableRaw);
    const durableAtEviction = storage.getItem(profileKey);

    await new Promise(resolve => window.setTimeout(resolve, 650));
    expect(storage.getItem(profileKey)).toBe(durableAtEviction);
    expect(getPendingSave(profileKey)?.reason).toBe('ownership_conflict');
    expect(screen.queryByText('Something went wrong')).toBeNull();
  }, 15_000);

  it('auto-opens one unseen release after onboarding completes', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('dialog', { name: "What's New" })).toBeNull();

    for (let step = 0; step < 4; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'Next' }));
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
      await user.click(await screen.findByRole('button', { name: 'Next' }));
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

    const settings = await screen.findByRole('button', {
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

    const paletteTrigger = await screen.findByTitle(/Command palette/i);
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
