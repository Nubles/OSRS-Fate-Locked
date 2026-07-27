// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const PROFILE_ID = 'changelog-lifecycle-profile';
const values = new Map<string, string>();
const storage: Pick<Storage, 'clear' | 'getItem' | 'removeItem' | 'setItem'> = {
  clear: () => values.clear(),
  getItem: key => values.get(key) ?? null,
  removeItem: key => { values.delete(key); },
  setItem: (key, value) => { values.set(key, String(value)); },
};

let App: React.ComponentType;
let seedOnboardingRun: (withHistory?: boolean) => string;
let profileBaseKey: (profileId: string) => string;
let changelogStorageKey: string;
let latestChangelogId: string;

beforeEach(async () => {
  values.clear();
  vi.stubGlobal('localStorage', storage);

  const [{ default: LoadedApp }, gameContext, persistence, profileStorage, changelogState, changelog] = await Promise.all([
    import('./App'),
    import('./context/GameContext'),
    import('./utils/gamePersistence'),
    import('./utils/profileStorage'),
    import('./utils/changelogState'),
    import('./data/changelog'),
  ]);
  App = LoadedApp;
  profileBaseKey = profileStorage.profileBaseKey;
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
});

afterEach(() => {
  cleanup();
  values.clear();
  vi.unstubAllGlobals();
});

describe('App changelog lifecycle', () => {
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
  });
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
});
