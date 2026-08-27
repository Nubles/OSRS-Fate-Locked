// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDBFactory,
  IDBKeyRange as FakeIDBKeyRange,
  IDBObjectStore,
  indexedDB as fakeIndexedDB,
} from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DISCORD_INVITE_URL } from './constants';
import { initialState } from './context/GameContext';
import { checksumSave } from './utils/saveIntegrity';
import { resolveSaveRecovery, type SaveRecoveryInput } from './utils/saveRecovery';
import type {
  MirrorMetadata,
  RecoveryCheckpoint,
  RecoveryHead,
  RecoveryRepository,
} from './utils/recoveryTypes';
import {
  getPendingSave,
  resetPendingSavesForTest,
} from './utils/pendingSaves';

const PROFILE_ID = 'changelog-lifecycle-profile';
const values = new Map<string, string>();
let failedWriteKey: string | null = null;
let failedRemoveKey: string | null = null;
let lockAfterRemove: { key: string; raw: string } | null = null;
const storage: Pick<Storage, 'clear' | 'length' | 'key' | 'getItem' | 'removeItem' | 'setItem'> = {
  clear: () => values.clear(),
  get length() { return values.size; },
  key: index => [...values.keys()][index] ?? null,
  getItem: key => values.get(key) ?? null,
  removeItem: key => {
    if (key === failedRemoveKey) throw new DOMException('unavailable', 'SecurityError');
    values.delete(key);
    if (lockAfterRemove?.key === key) {
      values.set('FATE_PROFILES__lock', lockAfterRemove.raw);
      lockAfterRemove = null;
    }
  },
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

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(settle => { resolve = settle; });
  return { promise, resolve };
};

const emptyRepository = (): RecoveryRepository => ({
  getHead: vi.fn(async () => null),
  putHead: vi.fn(async () => ({ stored: true as const })),
  listCheckpoints: vi.fn(async () => []),
  putCheckpoint: vi.fn(async () => ({ stored: true as const })),
  deleteCheckpoints: vi.fn(async () => ({ stored: true as const })),
  getMetadata: vi.fn(async () => null),
  putMetadata: vi.fn(async () => ({ stored: true as const })),
  close: vi.fn(),
});

const seedRecoveryHead = async (
  factory: IDBFactory,
  profileId: string,
  data: string,
): Promise<void> => {
  const { openRecoveryDatabase } = await import('./utils/recoveryDatabase');
  const parsed = JSON.parse(data) as { runId?: unknown; runRevision?: unknown };
  const repository = await openRecoveryDatabase({ indexedDB: factory });
  try {
    const result = await repository.putHead({
      profileId,
      persistenceRevision: 1,
      runId: typeof parsed.runId === 'string' ? parsed.runId : `run-${profileId}`,
      runRevision: typeof parsed.runRevision === 'number' ? parsed.runRevision : 0,
      capturedAt: 1_752_000_000_000,
      checksum: await checksumSave(data),
      data,
    }, () => ({ ok: true }));
    if (!result.stored) throw new Error(`Could not seed recovery head for ${profileId}.`);
  } finally {
    repository.close();
  }
};

const readRecoveryHead = async (
  factory: IDBFactory,
  profileId: string,
): Promise<RecoveryHead | null> => {
  const { openRecoveryDatabase } = await import('./utils/recoveryDatabase');
  const repository = await openRecoveryDatabase({ indexedDB: factory });
  try {
    return await repository.getHead(profileId);
  } finally {
    repository.close();
  }
};

const seedDeletableProfile = (targetId: string, targetName: string): {
  activeRaw: string;
  targetKey: string;
  targetRaw: string;
} => {
  const readyState = JSON.parse(seedOnboardingRun()) as { hasSeenOnboarding: boolean };
  readyState.hasSeenOnboarding = true;
  const activeRaw = JSON.stringify(readyState);
  const targetRaw = JSON.stringify({ ...readyState, userNotes: { deletion: targetId } });
  const targetKey = profileBaseKey(targetId);
  values.clear();
  storage.setItem('FATE_PROFILES', JSON.stringify({
    version: 2,
    revision: 0,
    profiles: [
      { id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 },
      { id: targetId, name: targetName, createdAt: 2 },
    ],
    activeProfileId: PROFILE_ID,
    deletions: [],
  }));
  storage.setItem(profileBaseKey(PROFILE_ID), activeRaw);
  storage.setItem(targetKey, targetRaw);
  storage.setItem(changelogStorageKey, latestChangelogId);
  return { activeRaw, targetKey, targetRaw };
};

beforeEach(async () => {
  values.clear();
  resetPendingSavesForTest();
  failedWriteKey = null;
  failedRemoveKey = null;
  lockAfterRemove = null;
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

  it('opens a supported recovered run read-only without deleting owned keys or writing IndexedDB', async () => {
    const recoveredId = 'future-run';
    const futureDeletedId = 'future-deleted-run';
    const futureDeletedKey = profileBaseKey(futureDeletedId);
    const { profileOwnedKeys } = await import('./utils/profileStorage');
    const futureOwnedValues = new Map(profileOwnedKeys(futureDeletedId).map(
      (key, index) => [key, index === 0
        ? 'future-owned-bytes-must-survive'
        : `future-owned-sidecar-${index}`],
    ));
    const removeItemCalls: string[] = [];
    const originalRemoveItem = storage.removeItem;
    vi.spyOn(storage, 'removeItem').mockImplementation(key => {
      removeItemCalls.push(key);
      originalRemoveItem(key);
    });
    const recoveredState = JSON.parse(seedOnboardingRun());
    recoveredState.hasSeenOnboarding = true;
    const futureRaw = JSON.stringify({
      version: 3,
      revision: 19,
      profiles: [{ id: 'future-only', name: 'Future only', createdAt: 1 }],
      activeProfileId: 'future-only',
      deletions: [{
        version: 1,
        deletionId: 'future-delete-opaque-1',
        profileId: futureDeletedId,
        requestedAt: 10,
        phase: 'pending_cleanup',
      }],
      opaque: { mustSurvive: true },
    });
    values.clear();
    storage.setItem('FATE_PROFILES', futureRaw);
    storage.setItem(profileBaseKey(recoveredId), JSON.stringify(recoveredState));
    storage.setItem(`${profileBaseKey(recoveredId)}__discord`, JSON.stringify(recoveredState));
    for (const [key, value] of futureOwnedValues) storage.setItem(key, value);
    storage.setItem(changelogStorageKey, latestChangelogId);
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    vi.stubGlobal('IDBKeyRange', FakeIDBKeyRange);
    const headCheckpointMetadataWrites = [
      vi.spyOn(IDBObjectStore.prototype, 'put'),
      vi.spyOn(IDBObjectStore.prototype, 'delete'),
      vi.spyOn(IDBObjectStore.prototype, 'clear'),
    ];

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Settings & save tools' })).toBeTruthy();
    const compatibilityHeading = await screen.findByText('A newer app version saved these profiles');
    expect(compatibilityHeading.closest('[role="alert"]')?.textContent).toContain('Recovered 1 profile.');
    expect(screen.getByRole('button', {
      name: 'Switch profile. Current profile: Recovered Profile 1',
    })).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(storage.getItem('FATE_PROFILES')).toBe(futureRaw);
    expect(storage.getItem(futureDeletedKey)).toBe('future-owned-bytes-must-survive');
    expect(removeItemCalls).toEqual([]);
    for (const [key, value] of futureOwnedValues) {
      expect(storage.getItem(key)).toBe(value);
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    for (const write of headCheckpointMetadataWrites) expect(write).not.toHaveBeenCalled();
  }, 15_000);

  it('uses the production eviction bridge before switching after a newer registry removes the active profile', async () => {
    const replacementId = 'replacement-run';
    const profileKey = profileBaseKey(PROFILE_ID);
    const readyState = JSON.parse(seedOnboardingRun());
    readyState.hasSeenOnboarding = true;
    const initialRegistry = {
      version: 2,
      revision: 0,
      profiles: [
        { id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 },
        { id: replacementId, name: 'Replacement', createdAt: 2 },
      ],
      activeProfileId: PROFILE_ID,
      deletions: [],
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
      version: 2,
      revision: 1,
      profiles: [{ id: replacementId, name: 'Replacement', createdAt: 2 }],
      activeProfileId: replacementId,
      deletions: [],
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

  it('hides a remote tombstone while the old SaveBootstrap is delayed and its bridge never mounts', async () => {
    const replacementId = 'delayed-bootstrap-replacement';
    const targetKey = profileBaseKey(PROFILE_ID);
    const replacementKey = profileBaseKey(replacementId);
    const readyState = JSON.parse(seedOnboardingRun());
    readyState.hasSeenOnboarding = true;
    const initialRegistry = {
      version: 2,
      revision: 0,
      profiles: [
        { id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 },
        { id: replacementId, name: 'Replacement', createdAt: 2 },
      ],
      activeProfileId: PROFILE_ID,
      deletions: [],
    };
    values.clear();
    storage.setItem('FATE_PROFILES', JSON.stringify(initialRegistry));
    storage.setItem(targetKey, JSON.stringify(readyState));
    storage.setItem(replacementKey, JSON.stringify(readyState));
    storage.setItem(changelogStorageKey, latestChangelogId);
    const targetRepository = deferred<RecoveryRepository>();
    const replacementRepository = deferred<RecoveryRepository>();
    const { productionSaveBootstrapDependencies } = await import('./components/SaveBootstrap');
    const openRepository = vi.spyOn(productionSaveBootstrapDependencies, 'openRepository')
      .mockImplementation(profileId => (
        profileId === PROFILE_ID ? targetRepository.promise : replacementRepository.promise
      ));
    render(<App />);

    await screen.findByText('Checking saved progress…');
    await waitFor(() => expect(openRepository).toHaveBeenCalledWith(PROFILE_ID));

    const incoming = {
      version: 2,
      revision: 1,
      profiles: [{ id: replacementId, name: 'Replacement', createdAt: 2 }],
      activeProfileId: replacementId,
      deletions: [{
        version: 1,
        deletionId: 'delete-delayed-bootstrap-1',
        profileId: PROFILE_ID,
        requestedAt: 10,
        phase: 'pending_cleanup',
      }],
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

    await waitFor(() => expect(openRepository).toHaveBeenCalledWith(replacementId));
    expect(storage.getItem('FATE_PROFILES')).toBe(incomingRaw);
    expect(storage.getItem(targetKey)).toBe(JSON.stringify(readyState));

    replacementRepository.resolve(emptyRepository());
    expect(await screen.findByRole('button', {
      name: 'Switch profile. Current profile: Replacement',
    })).toBeTruthy();
    expect(screen.queryByRole('button', {
      name: 'Switch profile. Current profile: Lifecycle test',
    })).toBeNull();
  }, 15_000);

  it('rolls back an executed IndexedDB delete when final authorization is lost before commit, then resumes after reload', async () => {
    const targetId = 'crash-before-indexeddb';
    const targetName = 'Crash before journal cleanup';
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    vi.stubGlobal('IDBKeyRange', FakeIDBKeyRange);
    const { targetKey, targetRaw } = seedDeletableProfile(targetId, targetName);
    await seedRecoveryHead(factory, targetId, targetRaw);
    const targetWriterLeaseKey = writerLeaseKey(targetKey);
    let headDeleteRequests = 0;
    let headDeleteSucceeded = false;
    const originalDelete = IDBObjectStore.prototype.delete;
    const deleteSpy = vi.spyOn(IDBObjectStore.prototype, 'delete')
      .mockImplementation(function (this: IDBObjectStore, query: IDBValidKey | IDBKeyRange) {
        const request = originalDelete.call(this, query);
        if (this.name === 'heads' && query === targetId) {
          headDeleteRequests += 1;
          request.addEventListener('success', () => {
            headDeleteSucceeded = true;
            storage.setItem(targetWriterLeaseKey, JSON.stringify({
              version: 1,
              ownerId: 'foreign-after-delete-request',
              expiresAt: Date.now() + 30_000,
            }));
          }, { once: true });
        }
        return request;
      });
    const user = userEvent.setup();
    const firstMount = render(<App />);

    await user.click(await screen.findByRole('button', {
      name: 'Switch profile. Current profile: Lifecycle test',
    }));
    await user.click(screen.getByRole('button', { name: `Delete ${targetName}` }));

    const retry = await screen.findByRole('button', { name: 'Retry profile storage cleanup' });
    await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false));
    expect(screen.getByText('Profile removed; storage cleanup pending.')).toBeTruthy();
    const committed = JSON.parse(storage.getItem('FATE_PROFILES')!) as {
      profiles: Array<{ id: string }>;
      deletions: Array<{ profileId: string }>;
    };
    expect(committed.profiles.map(profile => profile.id)).toEqual([PROFILE_ID]);
    expect(committed.deletions).toEqual([expect.objectContaining({ profileId: targetId })]);
    expect(storage.getItem(targetKey)).toBe(targetRaw);
    expect(headDeleteRequests).toBe(1);
    expect(headDeleteSucceeded).toBe(true);
    expect(await readRecoveryHead(factory, targetId)).not.toBeNull();

    const { claimWriterLease } = await import('./utils/profileWriterLease');
    storage.removeItem(targetWriterLeaseKey);
    expect(claimWriterLease(storage, targetKey, 'late-normal-tab', Date.now()).status).toBe('blocked');
    expect(claimWriterLease(storage, targetKey, 'late-forced-tab', Date.now(), true).status).toBe('blocked');
    expect(storage.getItem(targetWriterLeaseKey)).toBeNull();

    await user.click(screen.getByRole('button', {
      name: 'Switch profile. Current profile: Lifecycle test',
    }));
    expect(screen.queryByText(targetName)).toBeNull();

    firstMount.unmount();
    deleteSpy.mockRestore();
    render(<App />);

    expect(await screen.findByRole('button', {
      name: 'Switch profile. Current profile: Lifecycle test',
    })).toBeTruthy();
    await waitFor(() => {
      const reloaded = JSON.parse(storage.getItem('FATE_PROFILES')!) as { deletions: unknown[] };
      expect(reloaded.deletions).toEqual([]);
    }, { timeout: 5_000 });
    expect(storage.getItem(targetKey)).toBeNull();
    expect(await readRecoveryHead(factory, targetId)).toBeNull();
    expect(screen.queryByText('Profile removed; storage cleanup pending.')).toBeNull();
  }, 15_000);

  it('resumes local cleanup after reload when IndexedDB committed before the browser storage failure', async () => {
    const targetId = 'crash-after-indexeddb';
    const targetName = 'Crash after journal cleanup';
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    vi.stubGlobal('IDBKeyRange', FakeIDBKeyRange);
    const { targetKey, targetRaw } = seedDeletableProfile(targetId, targetName);
    await seedRecoveryHead(factory, targetId, targetRaw);
    failedRemoveKey = targetKey;
    const user = userEvent.setup();
    const firstMount = render(<App />);

    await user.click(await screen.findByRole('button', {
      name: 'Switch profile. Current profile: Lifecycle test',
    }));
    await user.click(screen.getByRole('button', { name: `Delete ${targetName}` }));

    const retry = await screen.findByRole('button', { name: 'Retry profile storage cleanup' });
    await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false));
    expect(await readRecoveryHead(factory, targetId)).toBeNull();
    expect(storage.getItem(targetKey)).toBe(targetRaw);
    expect((JSON.parse(storage.getItem('FATE_PROFILES')!) as { deletions: unknown[] }).deletions)
      .toHaveLength(1);

    firstMount.unmount();
    failedRemoveKey = null;
    render(<App />);

    await waitFor(() => {
      const reloaded = JSON.parse(storage.getItem('FATE_PROFILES')!) as { deletions: unknown[] };
      expect(reloaded.deletions).toEqual([]);
    }, { timeout: 5_000 });
    expect(storage.getItem(targetKey)).toBeNull();
    expect(await readRecoveryHead(factory, targetId)).toBeNull();
    expect(screen.queryByText(targetName)).toBeNull();
  }, 15_000);

  it('returns from continuous cleanup-lock contention and completes through the manual Retry action', async () => {
    const targetId = 'cleanup-lock-contention';
    const targetName = 'Cleanup contention target';
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    vi.stubGlobal('IDBKeyRange', FakeIDBKeyRange);
    const { targetKey } = seedDeletableProfile(targetId, targetName);
    const { PROFILE_METADATA_BACKUP_KEY, PROFILE_METADATA_LOCK_KEY } = await import('./utils/profileMetadata');
    const intent = {
      version: 1 as const,
      deletionId: 'delete-cleanup-contention-1',
      profileId: targetId,
      requestedAt: 10,
      phase: 'pending_cleanup' as const,
    };
    const tombstone = {
      version: 2 as const,
      revision: 1,
      profiles: [{ id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 }],
      activeProfileId: PROFILE_ID,
      deletions: [intent],
    };
    const tombstoneRaw = JSON.stringify(tombstone);
    storage.setItem('FATE_PROFILES', tombstoneRaw);
    storage.setItem(PROFILE_METADATA_BACKUP_KEY, tombstoneRaw);
    lockAfterRemove = {
      key: targetKey,
      raw: JSON.stringify({
        version: 1,
        ownerId: 'continuous-foreign-cleaner',
        expiresAt: Date.now() + 60_000,
      }),
    };
    const user = userEvent.setup();
    render(<App />);

    const retry = await screen.findByRole('button', { name: 'Retry profile storage cleanup' });
    await waitFor(() => {
      expect(storage.getItem(targetKey)).toBeNull();
      expect(storage.getItem(PROFILE_METADATA_LOCK_KEY)).not.toBeNull();
    });
    await new Promise(resolve => window.setTimeout(resolve, 1_700));
    expect((JSON.parse(storage.getItem('FATE_PROFILES')!) as { deletions: unknown[] }).deletions)
      .toHaveLength(1);
    expect(screen.getByText('Profile removed; storage cleanup pending.')).toBeTruthy();

    storage.removeItem(PROFILE_METADATA_LOCK_KEY);
    await user.click(retry);

    expect(await screen.findByText('Profile storage cleanup complete.')).toBeTruthy();
    await waitFor(() => {
      expect((JSON.parse(storage.getItem('FATE_PROFILES')!) as { deletions: unknown[] }).deletions)
        .toEqual([]);
    });
    expect(screen.queryByText('Profile removed; storage cleanup pending.')).toBeNull();
  }, 15_000);

  it('lets two cleanup tabs race without resurrecting the profile or deleting another profile', async () => {
    const targetId = 'two-tab-cleanup-target';
    const targetName = 'Two-tab cleanup target';
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    vi.stubGlobal('IDBKeyRange', FakeIDBKeyRange);
    const { activeRaw, targetKey, targetRaw } = seedDeletableProfile(targetId, targetName);
    const { PROFILE_METADATA_BACKUP_KEY } = await import('./utils/profileMetadata');
    const { resumeProfileDeletion } = await import('./utils/profileMetadataTransaction');
    const intent = {
      version: 1 as const,
      deletionId: 'delete-two-tab-race-1',
      profileId: targetId,
      requestedAt: 10,
      phase: 'pending_cleanup' as const,
    };
    const tombstone = {
      version: 2 as const,
      revision: 1,
      profiles: [{ id: PROFILE_ID, name: 'Lifecycle test', createdAt: 1 }],
      activeProfileId: PROFILE_ID,
      deletions: [intent],
    };
    const tombstoneRaw = JSON.stringify(tombstone);
    storage.setItem('FATE_PROFILES', tombstoneRaw);
    storage.setItem(PROFILE_METADATA_BACKUP_KEY, tombstoneRaw);
    await seedRecoveryHead(factory, targetId, targetRaw);
    await seedRecoveryHead(factory, PROFILE_ID, activeRaw);
    const { claimWriterLease } = await import('./utils/profileWriterLease');
    expect(claimWriterLease(storage, targetKey, 'normal-racer', Date.now()).status).toBe('blocked');
    expect(claimWriterLease(storage, targetKey, 'forced-racer', Date.now(), true).status).toBe('blocked');

    const { openRecoveryDatabase } = await import('./utils/recoveryDatabase');
    const makeDependencies = (ownerId: string) => ({
      storage,
      ownerId,
      now: Date.now,
      wait: (milliseconds: number) => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds)),
      validateGameSave: () => true,
      createProfileId: () => `unused-${ownerId}`,
      openRecoveryRepository: () => openRecoveryDatabase({ indexedDB: factory }),
    });
    const [first, second] = await Promise.all([
      resumeProfileDeletion(intent, makeDependencies('cleanup-tab-a')),
      resumeProfileDeletion(intent, makeDependencies('cleanup-tab-b')),
    ]);

    expect(first).toMatchObject({ status: 'completed' });
    expect(second).toMatchObject({ status: 'cleanup_pending', reason: 'profile_in_use' });
    expect(await resumeProfileDeletion(intent, makeDependencies('cleanup-tab-b')))
      .toMatchObject({ status: 'completed' });
    const finalized = JSON.parse(storage.getItem('FATE_PROFILES')!) as {
      profiles: Array<{ id: string }>;
      deletions: unknown[];
    };
    expect(finalized.profiles.map(profile => profile.id)).toEqual([PROFILE_ID]);
    expect(finalized.deletions).toEqual([]);
    expect(storage.getItem(targetKey)).toBeNull();
    expect(storage.getItem(profileBaseKey(PROFILE_ID))).toBe(activeRaw);
    expect(await readRecoveryHead(factory, targetId)).toBeNull();
    expect(await readRecoveryHead(factory, PROFILE_ID)).not.toBeNull();
  }, 15_000);

  it('arbitrates the startup compatibility matrix across legacy, journal, and corrupt evidence', async () => {
    const profileId = 'startup-matrix-profile';
    const runId = '123e4567-e89b-42d3-a456-426614174000';
    const capturedAt = 1_752_000_000_000;
    const defaults = {
      ...structuredClone(initialState),
      runId,
      runRevision: 0,
    };
    const rawSave = ({
      runRevision,
      version = 4,
      note,
    }: {
      runRevision: number;
      version?: number;
      note: string;
    }): string => {
      const state = {
        ...structuredClone(initialState),
        runId,
        runRevision,
        version,
        userNotes: { recovery: note },
      };
      return JSON.stringify(state);
    };
    const record = async ({
      persistenceRevision,
      runRevision = persistenceRevision,
      note,
      checksum,
    }: {
      persistenceRevision: number;
      runRevision?: number;
      note: string;
      checksum?: string;
    }): Promise<RecoveryHead> => {
      const data = rawSave({ runRevision, note });
      return {
        profileId,
        persistenceRevision,
        runId,
        runRevision,
        capturedAt,
        checksum: checksum ?? await checksumSave(data),
        data,
      };
    };
    const mirrorMetadata = async (entry: RecoveryHead): Promise<string> => JSON.stringify({
      version: 1,
      persistenceRevision: entry.persistenceRevision,
      capturedAt: entry.capturedAt,
      checksum: await checksumSave(entry.data),
    } satisfies MirrorMetadata);
    const fixture = (overrides: Partial<SaveRecoveryInput> = {}): SaveRecoveryInput => ({
      profileId,
      pendingRaw: null,
      primaryRaw: null,
      mirrorMetadataRaw: null,
      head: null,
      checkpoints: [],
      defaults,
      ...overrides,
    });

    const legacy = rawSave({ runRevision: 1, note: 'legacy' });
    await expect(resolveSaveRecovery(fixture({ primaryRaw: legacy }))).resolves.toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'legacy',
      persistenceRevision: 0,
      needsJournalImport: true,
      maxDurablePersistenceRevision: 0,
    });

    const sidecarPrimary = await record({ persistenceRevision: 2, note: 'sidecar' });
    await expect(resolveSaveRecovery(fixture({
      primaryRaw: sidecarPrimary.data,
      mirrorMetadataRaw: await mirrorMetadata(sidecarPrimary),
    }))).resolves.toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'normal',
      persistenceRevision: 2,
      needsJournalImport: true,
      maxDurablePersistenceRevision: 2,
    });

    const olderMirror = await record({ persistenceRevision: 2, note: 'older mirror' });
    const newerHead = await record({ persistenceRevision: 4, note: 'newer head' });
    await expect(resolveSaveRecovery(fixture({
      primaryRaw: olderMirror.data,
      mirrorMetadataRaw: await mirrorMetadata(olderMirror),
      head: newerHead,
    }))).resolves.toMatchObject({
      kind: 'ready',
      source: 'journal',
      reason: 'interrupted_mirror',
      persistenceRevision: 4,
      needsJournalImport: false,
      maxDurablePersistenceRevision: 4,
    });

    const newerMirror = await record({ persistenceRevision: 6, note: 'lifecycle mirror' });
    const olderHead = await record({ persistenceRevision: 4, note: 'older head' });
    await expect(resolveSaveRecovery(fixture({
      primaryRaw: newerMirror.data,
      mirrorMetadataRaw: await mirrorMetadata(newerMirror),
      head: olderHead,
    }))).resolves.toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'lifecycle_mirror',
      persistenceRevision: 6,
      needsJournalImport: true,
      maxDurablePersistenceRevision: 6,
    });

    const safeCheckpoint: RecoveryCheckpoint = {
      ...(await record({ persistenceRevision: 3, note: 'safe checkpoint' })),
      reason: 'interval',
    };
    const corruptHead = await record({
      persistenceRevision: 5,
      note: 'corrupt head',
      checksum: '0'.repeat(64),
    });
    await expect(resolveSaveRecovery(fixture({
      primaryRaw: '{bad',
      head: corruptHead,
      checkpoints: [safeCheckpoint],
    }))).resolves.toMatchObject({
      kind: 'recovery_required',
      cause: 'corrupt_primary',
      maxDurablePersistenceRevision: 3,
      candidates: [expect.objectContaining({
        source: 'checkpoint',
        persistenceRevision: 3,
      })],
    });

    await expect(resolveSaveRecovery(fixture())).resolves.toEqual({
      kind: 'empty',
      maxDurablePersistenceRevision: 0,
    });

    const future = rawSave({ runRevision: 9, version: 99, note: 'future' });
    await expect(resolveSaveRecovery(fixture({ primaryRaw: future }))).resolves.toEqual({
      kind: 'unsupported',
      rawCandidates: [future],
    });
  });
});
