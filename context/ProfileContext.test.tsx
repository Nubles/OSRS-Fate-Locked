// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  IDBKeyRange as FakeIDBKeyRange,
  indexedDB as fakeIndexedDB,
} from 'fake-indexeddb';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { ProfileRecoveryBanner } from '../components/ProfileRecoveryBanner';
import type { ProfileMetadata } from '../types';
import {
  getPendingSave,
  resetPendingSavesForTest,
  stagePendingSave,
} from '../utils/pendingSaves';
import { profileBaseKey } from '../utils/profileStorage';
import { ProfileProvider, useProfiles } from './ProfileContext';
import {
  LEGACY_SAVE_KEY,
  PROFILE_METADATA_BACKUP_KEY,
  PROFILE_METADATA_LOCK_KEY,
  PROFILE_METADATA_RECOVERY_KEY,
  PROFILES_KEY,
} from '../utils/profileMetadata';
import * as ProfileTransactions from '../utils/profileMetadataTransaction';
import {
  PROFILE_METADATA_LOCK_ARBITRATION_MS,
  PROFILE_METADATA_LOCK_TIMEOUT_MS,
  PROFILE_METADATA_LOCK_TTL_MS,
  type ProfileTransactionResult,
} from '../utils/profileMetadataTransaction';
import { serializeCurrent } from '../utils/gamePersistence';
import { initialState } from './GameContext';

type Profiles = ReturnType<typeof useProfiles>;

const metadata: ProfileMetadata = {
  version: 2,
  revision: 0,
  profiles: [
    { id: 'target', name: 'Target', createdAt: 1 },
    { id: 'other', name: 'Other', createdAt: 2 },
  ],
  activeProfileId: 'target',
  deletions: [],
};

const ProfileCapture = ({ onProfiles }: { onProfiles: (profiles: Profiles) => void }) => {
  onProfiles(useProfiles());
  return null;
};

describe('ProfileProvider pending-save cleanup', () => {
  const values = new Map<string, string>();
  let failMetadataWrites = false;

  beforeEach(() => {
    vi.useFakeTimers();
    values.clear();
    values.set('FATE_PROFILES', JSON.stringify(metadata));
    failMetadataWrites = false;
    resetPendingSavesForTest();
    vi.stubGlobal('localStorage', {
      get length() { return values.size; },
      key: (index: number) => [...values.keys()][index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failMetadataWrites && key === 'FATE_PROFILES') {
          throw new DOMException('full', 'QuotaExceededError');
        }
        values.set(key, value);
      },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => values.clear(),
    });
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    vi.stubGlobal('IDBKeyRange', FakeIDBKeyRange);
  });

  afterEach(() => {
    cleanup();
    resetPendingSavesForTest();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderProfiles = async () => {
    let current: Profiles | undefined;
    render(
      <ProfileProvider>
        <ProfileCapture onProfiles={profiles => { current = profiles; }} />
      </ProfileProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    return () => {
      if (!current) throw new Error('Profile provider did not initialize');
      return current;
    };
  };

  it('discards pending data after a profile is successfully deleted', async () => {
    const targetKey = profileBaseKey('target');
    stagePendingSave(targetKey, 'newest');
    const current = await renderProfiles();

    let deletion!: Promise<ProfileTransactionResult>;
    act(() => { deletion = current().deleteProfile('target'); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await deletion;
    });

    expect(getPendingSave(targetKey)).toBeNull();
    expect(current().profiles.map(profile => profile.id)).toEqual(['other']);
  });

  it('deletes recovery sidecars with their profile and preserves other profile records', async () => {
    const targetKey = profileBaseKey('target');
    const otherKey = profileBaseKey('other');
    values.set(`${targetKey}__mirrorMeta`, 'target-mirror');
    values.set(`${targetKey}__corruptArchive`, 'target-archive');
    values.set(`${otherKey}__mirrorMeta`, 'other-mirror');
    values.set(`${otherKey}__corruptArchive`, 'other-archive');
    values.set('recovery-journal:other:head', 'other-journal');
    const current = await renderProfiles();

    let deletion!: Promise<ProfileTransactionResult>;
    act(() => { deletion = current().deleteProfile('target'); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await deletion;
    });

    expect(values.has(`${targetKey}__mirrorMeta`)).toBe(false);
    expect(values.has(`${targetKey}__corruptArchive`)).toBe(false);
    expect(values.get(`${otherKey}__mirrorMeta`)).toBe('other-mirror');
    expect(values.get(`${otherKey}__corruptArchive`)).toBe('other-archive');
    expect(values.get('recovery-journal:other:head')).toBe('other-journal');
    expect(current().profiles.map(profile => profile.id)).toEqual(['other']);
  });

  it('retains pending data when profile metadata cannot be saved', async () => {
    const targetKey = profileBaseKey('target');
    stagePendingSave(targetKey, 'newest');
    const current = await renderProfiles();
    failMetadataWrites = true;

    let deletion!: Promise<ProfileTransactionResult>;
    act(() => { deletion = current().deleteProfile('target'); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await deletion;
    });

    expect(getPendingSave(targetKey)?.data).toBe('newest');
    expect(current().profiles.map(profile => profile.id)).toEqual(['target', 'other']);
  });
});

const task6Metadata = (overrides: Partial<ProfileMetadata> = {}): ProfileMetadata => ({
  ...metadata,
  ...overrides,
});

const pendingCleanupMetadata = (
  overrides: Partial<ProfileMetadata> = {},
): ProfileMetadata => ({
  version: 2,
  revision: 7,
  profiles: [{ id: 'other', name: 'Other', createdAt: 2 }],
  activeProfileId: 'other',
  deletions: [{
    version: 1,
    deletionId: 'delete-target-1',
    profileId: 'target',
    requestedAt: 900,
    phase: 'pending_cleanup',
  }],
  ...overrides,
});

const Task6ProfileCapture = ({ onProfiles }: { onProfiles: (profiles: Profiles) => void }) => {
  onProfiles(useProfiles());
  return <div>Profile children</div>;
};

const SyntheticProfileWriter = () => {
  useEffect(() => {
    localStorage.setItem('FATE_PROFILE_synthetic', 'synthetic');
  }, []);
  return <div>Profile writer mounted</div>;
};

const task6Deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(settle => { resolve = settle; });
  return { promise, resolve };
};

const task6Storage = (seed: Record<string, string> = {}) => {
  const values = new Map(Object.entries(seed));
  return {
    values,
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
};

describe('ProfileProvider validated async state', () => {
  let storage: ReturnType<typeof task6Storage>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    storage = task6Storage({ [PROFILES_KEY]: JSON.stringify(metadata) });
    vi.stubGlobal('localStorage', storage);
    resetPendingSavesForTest();
  });

  afterEach(() => {
    cleanup();
    resetPendingSavesForTest();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderTask6Profiles = () => {
    let current: Profiles | undefined;
    const rendered = render(
      <ProfileProvider>
        <Task6ProfileCapture onProfiles={profiles => { current = profiles; }} />
      </ProfileProvider>,
    );
    return {
      ...rendered,
      current: () => {
        if (!current) throw new Error('Profile provider did not initialize');
        return current;
      },
    };
  };

  const settleTask6Initialization = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
  };

  it('installs tombstone metadata before cleanup settles and never exposes the deleted ID', async () => {
    const tombstone = pendingCleanupMetadata();
    const cleanupAttempt = task6Deferred<Awaited<ReturnType<typeof ProfileTransactions.resumeProfileDeletion>>>();
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    const resume = vi.spyOn(ProfileTransactions, 'resumeProfileDeletion')
      .mockReturnValueOnce(cleanupAttempt.promise);

    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    expect(screen.getByText('Profile children')).toBeTruthy();
    expect(rendered.current().profiles.map(profile => profile.id)).toEqual(['other']);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().pendingDeletionCount).toBe(1);
    expect(resume).toHaveBeenCalledOnce();

    cleanupAttempt.resolve({
      status: 'cleanup_pending',
      reason: 'storage_unavailable',
      metadata: tombstone,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    await act(async () => { await cleanupAttempt.promise; });
  });

  it('installs a same-tab committed tombstone before delete cleanup settles', async () => {
    const cleanupAttempt = task6Deferred<ProfileTransactionResult>();
    const tombstone = pendingCleanupMetadata({ revision: 1 });
    const finalized = { ...tombstone, revision: 2, deletions: [] };
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockImplementationOnce(async (deps) => {
      deps.onProfileDeletionCommitted?.(tombstone);
      return cleanupAttempt.promise;
    });
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    let deletion!: Promise<ProfileTransactionResult>;
    act(() => { deletion = rendered.current().deleteProfile('target'); });
    await act(async () => { await Promise.resolve(); });

    expect(rendered.current().profiles.map(profile => profile.id)).toEqual(['other']);
    expect(rendered.current().pendingDeletionCount).toBe(1);

    cleanupAttempt.resolve({ ok: true, metadata: finalized, notice: null });
    await act(async () => { await deletion; });
    expect(rendered.current().profiles.map(profile => profile.id)).toEqual(['other']);
    expect(rendered.current().pendingDeletionCount).toBe(0);
  });

  it('serializes intents and queues one relevant storage-event retry behind the active worker', async () => {
    const tombstone = pendingCleanupMetadata({
      deletions: [
        pendingCleanupMetadata().deletions[0],
        {
          version: 1,
          deletionId: 'delete-retired-1',
          profileId: 'retired',
          requestedAt: 901,
          phase: 'pending_cleanup',
        },
      ],
    });
    const first = task6Deferred<Awaited<ReturnType<typeof ProfileTransactions.resumeProfileDeletion>>>();
    const resume = vi.spyOn(ProfileTransactions, 'resumeProfileDeletion')
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue({
        status: 'cleanup_pending',
        reason: 'profile_in_use',
        metadata: tombstone,
        removedEntries: 0,
        removalFailures: 0,
        rollbackFailures: 0,
      });
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    renderTask6Profiles();
    await settleTask6Initialization();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    expect(resume).toHaveBeenCalledOnce();

    first.resolve({
      status: 'cleanup_pending',
      reason: 'profile_in_use',
      metadata: tombstone,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    await act(async () => {
      await first.promise;
      await Promise.resolve();
    });

    expect(resume.mock.calls.map(([intent]) => intent.deletionId)).toEqual([
      'delete-target-1',
      'delete-target-1',
      'delete-retired-1',
    ]);
  });

  it('durably queues storage-event noise received during pass two without a tight loop', async () => {
    const tombstone = pendingCleanupMetadata();
    const first = task6Deferred<Awaited<ReturnType<typeof ProfileTransactions.resumeProfileDeletion>>>();
    const second = task6Deferred<Awaited<ReturnType<typeof ProfileTransactions.resumeProfileDeletion>>>();
    const resume = vi.spyOn(ProfileTransactions, 'resumeProfileDeletion')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue({
        status: 'cleanup_pending',
        reason: 'busy',
        metadata: tombstone,
        removedEntries: 0,
        removalFailures: 0,
        rollbackFailures: 0,
      });
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    renderTask6Profiles();
    await settleTask6Initialization();

    act(() => {
      for (let index = 0; index < 5; index += 1) {
        window.dispatchEvent(new StorageEvent('storage', {
          key: PROFILE_METADATA_LOCK_KEY,
          newValue: null,
        }));
      }
    });
    expect(resume).toHaveBeenCalledOnce();
    first.resolve({
      status: 'cleanup_pending',
      reason: 'busy',
      metadata: tombstone,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    await act(async () => {
      await first.promise;
      await Promise.resolve();
    });
    expect(resume).toHaveBeenCalledTimes(2);

    act(() => {
      for (let index = 0; index < 5; index += 1) {
        window.dispatchEvent(new StorageEvent('storage', {
          key: PROFILE_METADATA_LOCK_KEY,
          newValue: null,
        }));
      }
    });
    second.resolve({
      status: 'cleanup_pending',
      reason: 'busy',
      metadata: tombstone,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    await act(async () => {
      await second.promise;
      await Promise.resolve();
    });

    expect(resume).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(resume).toHaveBeenCalledTimes(3);
  });

  it('defers event-triggered cleanup until an active profile mutation settles', async () => {
    const tombstone = pendingCleanupMetadata();
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    const resume = vi.spyOn(ProfileTransactions, 'resumeProfileDeletion').mockResolvedValue({
      status: 'cleanup_pending',
      reason: 'busy',
      metadata: tombstone,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    expect(resume).toHaveBeenCalledOnce();

    const mutation = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockReturnValueOnce(mutation.promise);
    let rename!: Promise<ProfileTransactionResult>;
    act(() => { rename = rendered.current().renameProfile('other', 'Renamed safely'); });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    await act(async () => { await Promise.resolve(); });

    expect(resume).toHaveBeenCalledOnce();

    mutation.resolve({
      ok: true,
      metadata: { ...tombstone, revision: 8 },
      notice: null,
    });
    await act(async () => {
      await rename;
      await Promise.resolve();
    });

    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('resumes queued cleanup after a profile mutation fails while intents remain', async () => {
    const tombstone = pendingCleanupMetadata();
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    const resume = vi.spyOn(ProfileTransactions, 'resumeProfileDeletion').mockResolvedValue({
      status: 'cleanup_pending',
      reason: 'busy',
      metadata: tombstone,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const mutation = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockReturnValueOnce(mutation.promise);
    let rename!: Promise<ProfileTransactionResult>;
    act(() => { rename = rendered.current().renameProfile('other', 'Still pending'); });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    await act(async () => { await Promise.resolve(); });
    expect(resume).toHaveBeenCalledOnce();

    mutation.resolve({
      ok: false,
      reason: 'storage_unavailable',
      metadata: tombstone,
      notice: null,
    });
    await act(async () => {
      await rename;
      await Promise.resolve();
    });

    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('installs a remote tombstone immediately and queues teardown until eviction registration', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const remoteTombstone = pendingCleanupMetadata({ revision: 9 });
    storage.values.set(PROFILES_KEY, JSON.stringify(remoteTombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(remoteTombstone));
    const resume = vi.spyOn(ProfileTransactions, 'resumeProfileDeletion').mockResolvedValue({
      status: 'cleanup_pending',
      reason: 'storage_unavailable',
      metadata: remoteTombstone,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(remoteTombstone),
      }));
    });
    await act(async () => { await Promise.resolve(); });
    expect(rendered.current().profiles.map(profile => profile.id)).toEqual(['other']);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().pendingDeletionCount).toBe(1);
    expect(resume).toHaveBeenCalledOnce();

    const evictions: string[] = [];
    act(() => {
      rendered.current().registerProfileEvictionHandler(profileId => { evictions.push(profileId); });
    });
    await act(async () => { await Promise.resolve(); });

    expect(evictions).toEqual(['target']);
    expect(rendered.current().profiles.map(profile => profile.id)).toEqual(['other']);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().pendingDeletionCount).toBe(1);
    expect(resume).toHaveBeenCalledOnce();
  });

  it('retries pending cleanup manually and installs only the completed metadata', async () => {
    const tombstone = pendingCleanupMetadata();
    const finalized = { ...tombstone, revision: 8, deletions: [] };
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    vi.spyOn(ProfileTransactions, 'resumeProfileDeletion')
      .mockResolvedValueOnce({
        status: 'cleanup_pending',
        reason: 'profile_in_use',
        metadata: tombstone,
        removedEntries: 0,
        removalFailures: 0,
        rollbackFailures: 0,
      })
      .mockResolvedValueOnce({
        status: 'completed',
        metadata: finalized,
        removedEntries: 4,
        removalFailures: 0,
        rollbackFailures: 0,
      });
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    expect(rendered.current().pendingDeletionCount).toBe(1);
    await act(async () => { await rendered.current().retryProfileDeletionCleanup(); });

    expect(rendered.current().pendingDeletionCount).toBe(0);
    expect(rendered.current().profiles.map(profile => profile.id)).toEqual(['other']);
    expect(rendered.current().mutationFailure).toBeNull();
  });

  it('classifies a manual cleanup ownership failure without exposing deletion data', async () => {
    const tombstone = pendingCleanupMetadata();
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    vi.spyOn(ProfileTransactions, 'resumeProfileDeletion').mockResolvedValue({
      status: 'cleanup_pending',
      reason: 'profile_in_use',
      metadata: tombstone,
      removedEntries: 0,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    let caught: unknown;
    await act(async () => {
      try {
        await rendered.current().retryProfileDeletionCleanup();
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toMatchObject({
      name: 'ProfileDeletionCleanupRetryError',
      reason: 'profile_in_use',
    });
    expect(String(caught)).not.toContain('delete-target-1');
    expect(rendered.current().mutationFailure).toBe('profile_in_use');
  });

  it('ignores stale cleanup completion after a newer profile registry arrives', async () => {
    const tombstone = pendingCleanupMetadata();
    const cleanupAttempt = task6Deferred<Awaited<ReturnType<typeof ProfileTransactions.resumeProfileDeletion>>>();
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    vi.spyOn(ProfileTransactions, 'resumeProfileDeletion').mockReturnValueOnce(cleanupAttempt.promise);
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const remote: ProfileMetadata = {
      version: 2,
      revision: 10,
      profiles: [
        { id: 'other', name: 'Remote Other', createdAt: 2 },
        { id: 'newest', name: 'Newest', createdAt: 3 },
      ],
      activeProfileId: 'other',
      deletions: [],
    };
    storage.values.set(PROFILES_KEY, JSON.stringify(remote));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(remote),
      }));
    });

    cleanupAttempt.resolve({
      status: 'completed',
      metadata: { ...tombstone, revision: 8, deletions: [] },
      removedEntries: 3,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    await act(async () => { await cleanupAttempt.promise; });

    expect(rendered.current().profiles).toEqual(remote.profiles);
    expect(rendered.current().pendingDeletionCount).toBe(0);
  });

  it('cancels stale cleanup UI completion on unmount and resumes the durable intent after reload', async () => {
    const tombstone = pendingCleanupMetadata();
    const first = task6Deferred<Awaited<ReturnType<typeof ProfileTransactions.resumeProfileDeletion>>>();
    storage.values.set(PROFILES_KEY, JSON.stringify(tombstone));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(tombstone));
    const resume = vi.spyOn(ProfileTransactions, 'resumeProfileDeletion')
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue({
        status: 'cleanup_pending',
        reason: 'storage_unavailable',
        metadata: tombstone,
        removedEntries: 0,
        removalFailures: 0,
        rollbackFailures: 0,
      });
    let captureCount = 0;
    const firstRender = render(
      <ProfileProvider>
        <ProfileCapture onProfiles={() => { captureCount += 1; }} />
      </ProfileProvider>,
    );
    await settleTask6Initialization();
    const beforeUnmount = captureCount;
    firstRender.unmount();
    first.resolve({
      status: 'completed',
      metadata: { ...tombstone, revision: 8, deletions: [] },
      removedEntries: 3,
      removalFailures: 0,
      rollbackFailures: 0,
    });
    await act(async () => { await first.promise; });

    expect(captureCount).toBe(beforeUnmount);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(tombstone));

    renderTask6Profiles();
    await settleTask6Initialization();
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('does not start cleanup or write when future metadata is read-only', async () => {
    const futureRaw = JSON.stringify({ version: 3, opaque: { deletion: 'private' } });
    storage.values.set(PROFILES_KEY, futureRaw);
    const before = [...storage.values];
    const resume = vi.spyOn(ProfileTransactions, 'resumeProfileDeletion');

    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().pendingDeletionCount).toBe(0);
    expect(resume).not.toHaveBeenCalled();
    expect([...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY)).toEqual(before);
  });

  it('renders an accessible loading boundary without rendering children before initialization settles', async () => {
    const initialization = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'initializeProfileMetadata').mockReturnValueOnce(initialization.promise);

    renderTask6Profiles();

    expect(screen.getByRole('status').textContent).toBe('Loading profiles...');
    expect(screen.queryByText('Profile children')).toBeNull();

    initialization.resolve({ ok: true, metadata, notice: null });
    await act(async () => { await initialization.promise; });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Profile children')).toBeTruthy();
  });

  it('recovers malformed structural JSON from a validated backup', async () => {
    const backup = task6Metadata({ revision: 4, activeProfileId: 'other' });
    storage.values.set(PROFILES_KEY, JSON.stringify({ profiles: 'not-an-array', activeProfileId: 4 }));
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(backup));

    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().profiles).toEqual(backup.profiles);
    expect(rendered.current().recoveryNotice?.kind).toBe('repaired');
    expect(rendered.current().metadataReadOnly).toBe(false);
  });

  it('reconstructs exact valid saves and reports an unreadable exact save', async () => {
    storage.values.set(PROFILES_KEY, '{bad');
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, '{also-bad');
    storage.values.set(profileBaseKey('alpha'), serializeCurrent(initialState));
    storage.values.set(profileBaseKey('broken'), '{bad-save');
    storage.values.set(profileBaseKey('alpha') + '__backups', 'not-a-base-save');

    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    expect(rendered.current().profiles).toEqual([
      { id: 'alpha', name: 'Recovered Profile 1', createdAt: 1_025 },
    ]);
    expect(rendered.current().recoveryNotice).toMatchObject({
      kind: 'partial',
      recoveredProfiles: 1,
      unreadableSaves: 1,
    });
  });

  it('opens unsupported metadata read-only without overwriting it', async () => {
    const future = JSON.stringify({
      version: 3,
      revision: 9,
      profiles: metadata.profiles,
      activeProfileId: 'target',
    });
    storage.values.set(PROFILES_KEY, future);
    storage.values.set(profileBaseKey('target'), serializeCurrent(initialState));

    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().mutationFailure).toBe('unsupported_metadata');
    expect(rendered.current().recoveryNotice?.kind).toBe('unsupported');
    expect(storage.values.get(PROFILES_KEY)).toBe(future);
  });

  it('uses a validated in-memory read-only profile when browser storage cannot be read', async () => {
    vi.stubGlobal('localStorage', {
      get length() { throw new DOMException('blocked', 'SecurityError'); },
      key: () => { throw new DOMException('blocked', 'SecurityError'); },
      getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      setItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      removeItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      clear: () => undefined,
    });

    const rendered = renderTask6Profiles();
    await settleTask6Initialization();

    expect(rendered.current().profiles).toHaveLength(1);
    expect(rendered.current().activeProfileId).toBe(rendered.current().profiles[0].id);
    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().mutationFailure).toBe('storage_unavailable');
    expect(rendered.current().recoveryNotice?.kind).toBe('read_only');
  });

  it('runs only one action at a time and installs verified create success locally', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const mutation = task6Deferred<ProfileTransactionResult>();
    const mutate = vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockReturnValueOnce(mutation.promise);

    let first!: Promise<ProfileTransactionResult>;
    let duplicate!: Promise<ProfileTransactionResult>;
    await act(async () => {
      first = rendered.current().createProfile('  New profile  ');
      duplicate = rendered.current().createProfile('Second click');
      await Promise.resolve();
    });

    expect(rendered.current().pendingAction).toBe('create');
    expect(mutate).toHaveBeenCalledTimes(1);
    const operation = mutate.mock.calls[0][1];
    expect(operation).toMatchObject({ type: 'create', profile: { name: 'New profile' } });
    if (operation.type !== 'create') throw new Error('Expected create mutation');
    const created = task6Metadata({
      revision: 1,
      profiles: [...metadata.profiles, operation.profile],
      activeProfileId: operation.profile.id,
    });
    mutation.resolve({ ok: true, metadata: created, notice: null });
    await act(async () => { await first; });

    await expect(duplicate).resolves.toMatchObject({ ok: false, reason: 'busy' });
    expect(rendered.current().pendingAction).toBeNull();
    expect(rendered.current().profiles).toEqual(created.profiles);
    expect(rendered.current().activeProfileId).toBe(operation.profile.id);
    expect(rendered.current().recentlyCreatedId).toBe(operation.profile.id);
    expect(rendered.current().mutationFailure).toBeNull();
  });

  it('keeps prior local metadata after a failed create', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'verification_failed',
      metadata: task6Metadata({ revision: 9, activeProfileId: 'other' }),
      notice: null,
    });

    let result!: ProfileTransactionResult;
    await act(async () => { result = await rendered.current().createProfile('Failed'); });

    expect(result).toMatchObject({ ok: false, reason: 'verification_failed' });
    expect(rendered.current().profiles).toEqual(metadata.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().recentlyCreatedId).toBeNull();
    expect(rendered.current().mutationFailure).toBe('verification_failed');
  });

  it('rejects stale create success after a newer validated event without success side effects', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const mutation = task6Deferred<ProfileTransactionResult>();
    const mutate = vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockReturnValueOnce(mutation.promise);
    let creation!: Promise<ProfileTransactionResult>;

    act(() => { creation = rendered.current().createProfile('Stale create'); });
    const operation = mutate.mock.calls[0][1];
    if (operation.type !== 'create') throw new Error('Expected create mutation');
    const newest = task6Metadata({
      revision: 3,
      profiles: [{ ...metadata.profiles[0], name: 'Newest target' }, metadata.profiles[1]],
    });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(newest),
      }));
    });

    mutation.resolve({
      ok: true,
      metadata: task6Metadata({
        revision: 1,
        profiles: [...metadata.profiles, operation.profile],
        activeProfileId: operation.profile.id,
      }),
      notice: null,
    });
    let result!: ProfileTransactionResult;
    await act(async () => { result = await creation; });

    expect(result).toEqual({ ok: false, reason: 'busy', metadata: newest, notice: null });
    expect(rendered.current().profiles).toEqual(newest.profiles);
    expect(rendered.current().recentlyCreatedId).toBeNull();
    expect(rendered.current().mutationFailure).toBe('busy');
  });

  it('discards pending data only after verified delete success', async () => {
    const targetKey = profileBaseKey('other');
    stagePendingSave(targetKey, 'newest');
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const mutate = vi.spyOn(ProfileTransactions, 'mutateProfileMetadata');
    mutate.mockResolvedValueOnce({
      ok: false,
      reason: 'backup_failed',
      metadata,
      notice: null,
      deleteDetails: { removedEntries: 5, removalFailures: 2, rollbackFailures: 0 },
    });

    await act(async () => { await rendered.current().deleteProfile('other'); });
    expect(getPendingSave(targetKey)?.data).toBe('newest');
    expect(rendered.current().profiles).toEqual(metadata.profiles);

    mutate.mockResolvedValueOnce({
      ok: true,
      metadata: task6Metadata({ revision: 1, profiles: [metadata.profiles[0]] }),
      notice: null,
      deleteDetails: { removedEntries: 1, removalFailures: 0, rollbackFailures: 0 },
    });
    await act(async () => { await rendered.current().deleteProfile('other'); });

    expect(getPendingSave(targetKey)).toBeNull();
    expect(rendered.current().profiles.map(profile => profile.id)).toEqual(['target']);
  });

  it('warns without exposing storage details when delete rollback cannot restore data', async () => {
    const targetKey = profileBaseKey('other');
    const privateValue = 'private-save-payload';
    stagePendingSave(targetKey, privateValue);
    let current: Profiles | undefined;
    render(
      <ProfileProvider>
        <Task6ProfileCapture onProfiles={profiles => { current = profiles; }} />
        <ProfileRecoveryBanner />
      </ProfileProvider>,
    );
    await settleTask6Initialization();
    if (!current) throw new Error('Profile provider did not initialize');

    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'storage_unavailable',
      metadata,
      notice: null,
      deleteDetails: { removedEntries: 2, removalFailures: 1, rollbackFailures: 2 },
    });

    await act(async () => { await current!.deleteProfile('other'); });

    const warning = screen.getByRole('alert').textContent ?? '';
    expect(warning).toContain('2 profile entries could not be restored during rollback.');
    expect(warning).not.toContain(targetKey);
    expect(warning).not.toContain(privateValue);
    expect(getPendingSave(targetKey)?.data).toBe(privateValue);
    expect(current.recoveryNotice).toMatchObject({ kind: 'partial', rollbackFailures: 2 });
  });

  it('rejects stale delete success after a newer validated event and retains pending data', async () => {
    const targetKey = profileBaseKey('other');
    stagePendingSave(targetKey, 'newest');
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const mutation = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockReturnValueOnce(mutation.promise);
    let deletion!: Promise<ProfileTransactionResult>;
    act(() => { deletion = rendered.current().deleteProfile('other'); });
    const newest = task6Metadata({
      revision: 3,
      profiles: [{ ...metadata.profiles[0], name: 'Newest target' }, metadata.profiles[1]],
    });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(newest),
      }));
    });

    mutation.resolve({
      ok: true,
      metadata: task6Metadata({ revision: 1, profiles: [metadata.profiles[0]] }),
      notice: null,
      deleteDetails: { removedEntries: 1, removalFailures: 0, rollbackFailures: 0 },
    });
    let result!: ProfileTransactionResult;
    await act(async () => { result = await deletion; });

    expect(result).toEqual({ ok: false, reason: 'busy', metadata: newest, notice: null });
    expect(getPendingSave(targetKey)?.data).toBe('newest');
    expect(rendered.current().profiles).toEqual(newest.profiles);
    expect(rendered.current().mutationFailure).toBe('busy');
  });

  it('keeps local selection for newer remote create, rename, and select events', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const incoming = task6Metadata({
      revision: 3,
      profiles: [
        { ...metadata.profiles[0], name: 'Remotely renamed' },
        metadata.profiles[1],
        { id: 'remote', name: 'Remote', createdAt: 3 },
      ],
      activeProfileId: 'remote',
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(incoming),
      }));
    });

    expect(rendered.current().profiles).toEqual(incoming.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().recentlyCreatedId).toBeNull();
  });

  it('cancels a real in-flight mutation when a valid newer primary event arrives', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, 'existing-backup');
    storage.values.set(PROFILE_METADATA_RECOVERY_KEY, 'existing-recovery');
    storage.values.set(profileBaseKey('target'), 'existing-save');
    let mutation!: Promise<ProfileTransactionResult>;

    act(() => { mutation = rendered.current().renameProfile('target', 'Stale rename'); });
    const newest = task6Metadata({
      revision: 3,
      profiles: [{ ...metadata.profiles[0], name: 'Newest target' }, metadata.profiles[1]],
      activeProfileId: 'other',
    });
    storage.values.set(PROFILES_KEY, JSON.stringify(newest));
    const expected = new Map(
      [...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY),
    );

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(newest),
      }));
    });
    let result!: ProfileTransactionResult;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_ARBITRATION_MS);
      result = await mutation;
    });

    expect(result).toMatchObject({ ok: false, reason: 'busy' });
    expect(rendered.current().profiles).toEqual(newest.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(new Map(
      [...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY),
    )).toEqual(expected);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it('ignores equal and lower current metadata events', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const events = [
      JSON.stringify(task6Metadata({ revision: 0, activeProfileId: 'other' })),
      JSON.stringify(task6Metadata({ revision: -1, activeProfileId: 'other' })),
    ];

    for (const newValue of events) {
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: PROFILES_KEY, newValue }));
      });
    }

    expect(rendered.current().profiles).toEqual(metadata.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
  });

  it.each([
    {
      label: 'unsupported future',
      raw: JSON.stringify({
        version: 3,
        revision: 5,
        profiles: metadata.profiles,
        activeProfileId: 'other',
      }),
      reason: 'unsupported_metadata' as const,
      noticeKind: 'unsupported' as const,
    },
    {
      label: 'malformed',
      raw: '{bad',
      reason: 'invalid_metadata' as const,
      noticeKind: 'read_only' as const,
    },
    {
      label: 'legacy',
      raw: JSON.stringify({ profiles: metadata.profiles, activeProfileId: 'other' }),
      reason: 'invalid_metadata' as const,
      noticeKind: 'read_only' as const,
    },
  ])('fails closed synchronously for a $label primary event', async ({ raw, reason, noticeKind }) => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    storage.values.set(PROFILES_KEY, raw);
    const mutate = vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValue({
      ok: true,
      metadata: task6Metadata({ revision: 1, activeProfileId: 'other' }),
      notice: null,
    });
    let blockedAction!: Promise<ProfileTransactionResult>;

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: PROFILES_KEY, newValue: raw }));
      blockedAction = rendered.current().renameProfile('target', 'Must not write');
    });

    await expect(blockedAction).resolves.toMatchObject({ ok: false, reason });
    expect(mutate).not.toHaveBeenCalled();
    expect(rendered.current().profiles).toEqual(metadata.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().pendingAction).toBeNull();
    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().mutationFailure).toBe(reason);
    expect(rendered.current().recoveryNotice?.kind).toBe(noticeKind);
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
  });

  it('keeps fail-closed compatibility state when an earlier mutation completes later', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const mutation = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockReturnValueOnce(mutation.promise);
    let rename!: Promise<ProfileTransactionResult>;
    act(() => { rename = rendered.current().renameProfile('target', 'Earlier mutation'); });
    const futureRaw = JSON.stringify({
      version: 3,
      revision: 9,
      profiles: metadata.profiles,
      activeProfileId: 'other',
    });
    storage.values.set(PROFILES_KEY, futureRaw);

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: futureRaw,
      }));
    });
    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().mutationFailure).toBe('unsupported_metadata');

    mutation.resolve({
      ok: true,
      metadata: task6Metadata({
        revision: 1,
        profiles: [
          { ...metadata.profiles[0], name: 'Earlier mutation' },
          metadata.profiles[1],
        ],
      }),
      notice: null,
    });
    let result!: ProfileTransactionResult;
    await act(async () => { result = await rename; });

    expect(result).toEqual({
      ok: false,
      reason: 'unsupported_metadata',
      metadata,
      notice: expect.objectContaining({ kind: 'unsupported' }),
    });
    expect(rendered.current().profiles).toEqual(metadata.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().mutationFailure).toBe('unsupported_metadata');
    expect(rendered.current().recoveryNotice?.kind).toBe('unsupported');
    expect(rendered.current().pendingAction).toBeNull();
    expect(storage.values.get(PROFILES_KEY)).toBe(futureRaw);
  });

  it('evicts synchronously before installing a newer registry without the local profile', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const calls: string[] = [];
    const unsubscribe = rendered.current().registerProfileEvictionHandler(profileId => {
      calls.push(profileId);
      expect(rendered.current().activeProfileId).toBe('target');
    });
    const incoming: ProfileMetadata = {
      version: 2,
      revision: 2,
      profiles: [metadata.profiles[1]],
      activeProfileId: 'other',
      deletions: [],
    };

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(incoming),
      }));
    });

    expect(calls).toEqual(['target']);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().recoveryNotice?.kind).toBe('remote_removal');
    expect(rendered.current().recentlyCreatedId).toBeNull();
    unsubscribe();
  });

  it('installs remote removal without a mounted bridge and later delivers the queued eviction', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const staleRemoval: ProfileMetadata = {
      version: 2,
      revision: 2,
      profiles: [{ ...metadata.profiles[1], name: 'Stale removal' }],
      activeProfileId: 'other',
      deletions: [],
    };
    const newestRemoval: ProfileMetadata = {
      version: 2,
      revision: 3,
      profiles: [{ ...metadata.profiles[1], name: 'Newest removal' }],
      activeProfileId: 'other',
      deletions: [],
    };

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(newestRemoval),
      }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(staleRemoval),
      }));
    });

    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().profiles).toEqual(newestRemoval.profiles);

    const calls: Array<{ profileId: string; activeDuringEviction: string }> = [];
    let unsubscribe!: () => void;
    act(() => {
      unsubscribe = rendered.current().registerProfileEvictionHandler(profileId => {
        calls.push({
          profileId,
          activeDuringEviction: rendered.current().activeProfileId,
        });
      });
    });

    expect(calls).toEqual([{
      profileId: 'target',
      activeDuringEviction: 'other',
    }]);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().profiles).toEqual(newestRemoval.profiles);
    expect(rendered.current().recoveryNotice?.kind).toBe('remote_removal');
    unsubscribe();
  });

  it('keeps remote removals hidden after the registered eviction handler unsubscribes', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const calls: string[] = [];
    const unsubscribe = rendered.current().registerProfileEvictionHandler(profileId => {
      calls.push(profileId);
    });
    unsubscribe();
    const incoming: ProfileMetadata = {
      version: 2,
      revision: 2,
      profiles: [metadata.profiles[1]],
      activeProfileId: 'other',
      deletions: [],
    };

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(incoming),
      }));
    });

    expect(calls).toEqual([]);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().profiles).toEqual(incoming.profiles);
  });

  it('does not let an older mutation completion overwrite a newer validated event', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const mutation = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockReturnValueOnce(mutation.promise);
    let rename!: Promise<ProfileTransactionResult>;
    act(() => { rename = rendered.current().renameProfile('target', 'Older completion'); });
    const newest = task6Metadata({
      revision: 3,
      profiles: [
        { ...metadata.profiles[0], name: 'Newest validated name' },
        metadata.profiles[1],
        { id: 'remote', name: 'Remote', createdAt: 3 },
      ],
      activeProfileId: 'remote',
    });
    storage.values.set(PROFILES_KEY, JSON.stringify(newest));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(newest),
      }));
    });
    expect(rendered.current().profiles).toEqual(newest.profiles);
    expect(rendered.current().activeProfileId).toBe('target');

    mutation.resolve({
      ok: true,
      metadata: task6Metadata({
        revision: 1,
        profiles: [
          { ...metadata.profiles[0], name: 'Older completion' },
          metadata.profiles[1],
        ],
      }),
      notice: null,
    });
    await act(async () => { await rename; });

    expect(rendered.current().profiles).toEqual(newest.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
  });

  it('does not let an older busy reread overwrite a newer validated event', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'busy',
      metadata: null,
      notice: null,
    });
    await act(async () => { await rendered.current().renameProfile('target', 'Busy'); });
    const reread = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'initializeProfileMetadata').mockReturnValueOnce(reread.promise);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    const newest = task6Metadata({
      revision: 4,
      profiles: [{ ...metadata.profiles[0], name: 'Newest reread winner' }, metadata.profiles[1]],
      activeProfileId: 'other',
    });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(newest),
      }));
    });
    reread.resolve({
      ok: true,
      metadata: task6Metadata({ revision: 1 }),
      notice: null,
    });
    await act(async () => { await reread.promise; });

    expect(rendered.current().profiles).toEqual(newest.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
  });

  it('performs one bounded reread after busy contention when the lock changes', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'busy',
      metadata: null,
      notice: null,
    });
    const initialize = vi.spyOn(ProfileTransactions, 'initializeProfileMetadata');
    initialize.mockResolvedValue({ ok: true, metadata: task6Metadata({ revision: 2 }), notice: null });

    await act(async () => { await rendered.current().renameProfile('target', 'Busy'); });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    await act(async () => { await Promise.resolve(); });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    await act(async () => { await Promise.resolve(); });

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(rendered.current().mutationFailure).toBeNull();
    expect(rendered.current().pendingAction).toBeNull();
  });

  it('ignores late initialization after unmount', async () => {
    const initialization = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'initializeProfileMetadata').mockReturnValueOnce(initialization.promise);
    const rendered = renderTask6Profiles();
    rendered.unmount();

    initialization.resolve({ ok: true, metadata, notice: null });
    await act(async () => { await initialization.promise; });

    expect(screen.queryByText('Profile children')).toBeNull();
  });

  it('retries one startup busy result after a metadata lock event', async () => {
    const initialize = vi.spyOn(ProfileTransactions, 'initializeProfileMetadata');
    initialize
      .mockResolvedValueOnce({
        ok: false,
        reason: 'busy',
        metadata: null,
        notice: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        metadata: task6Metadata({ revision: 1 }),
        notice: null,
      });

    renderTask6Profiles();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('status').textContent).toBe('Loading profiles...');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    await act(async () => { await Promise.resolve(); });

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Profile children')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TTL_MS);
    });
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('keeps a valid primary event as the winner when it cancels a bounded startup reread', async () => {
    vi.spyOn(ProfileTransactions, 'initializeProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'busy',
      metadata: null,
      notice: null,
    });
    const rendered = renderTask6Profiles();
    await act(async () => { await Promise.resolve(); });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    const incoming = task6Metadata({
      revision: 4,
      profiles: [{ ...metadata.profiles[0], name: 'Reread event winner' }, metadata.profiles[1]],
      activeProfileId: 'other',
    });
    const raw = JSON.stringify(incoming);
    storage.values.set(PROFILES_KEY, raw);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: raw,
      }));
    });

    expect(rendered.current().profiles).toEqual(incoming.profiles);
    expect(rendered.current().activeProfileId).toBe('other');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    });

    expect(rendered.current().profiles).toEqual(incoming.profiles);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().pendingAction).toBeNull();
    expect(rendered.current().mutationFailure).toBeNull();
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it.each([
    {
      label: 'unsupported future metadata',
      raw: JSON.stringify({
        version: 3,
        revision: 9,
        profiles: metadata.profiles,
        activeProfileId: 'other',
      }),
      reason: 'unsupported_metadata' as const,
      noticeKind: 'unsupported' as const,
    },
    {
      label: 'invalid metadata',
      raw: '{bad',
      reason: 'invalid_metadata' as const,
      noticeKind: 'read_only' as const,
    },
    {
      label: 'legacy metadata',
      raw: JSON.stringify({ profiles: metadata.profiles, activeProfileId: 'other' }),
      reason: 'invalid_metadata' as const,
      noticeKind: 'read_only' as const,
    },
  ])('preserves $label compatibility state after it cancels a bounded reread', async ({
    raw,
    reason,
    noticeKind,
  }) => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, 'existing-backup');
    storage.values.set(PROFILE_METADATA_RECOVERY_KEY, 'existing-recovery');
    storage.values.set(profileBaseKey('target'), 'existing-save');
    const initialize = vi.spyOn(ProfileTransactions, 'initializeProfileMetadata');
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'busy',
      metadata: null,
      notice: null,
    });

    await act(async () => { await rendered.current().renameProfile('target', 'Busy'); });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    storage.values.set(PROFILES_KEY, raw);
    const expected = new Map(
      [...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: PROFILES_KEY, newValue: raw }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    });

    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().mutationFailure).toBe(reason);
    expect(rendered.current().recoveryNotice?.kind).toBe(noticeKind);
    expect(rendered.current().profiles).toEqual(metadata.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().pendingAction).toBeNull();
    expect(new Map(
      [...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY),
    )).toEqual(expected);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TTL_MS * 2);
    });
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: 'unsupported future metadata',
      raw: JSON.stringify({
        version: 3,
        revision: 9,
        profiles: metadata.profiles,
        activeProfileId: 'other',
      }),
    },
    { label: 'invalid metadata', raw: '{bad' },
  ])('fails closed when $label arrives before startup initialization settles', async ({ raw }) => {
    const initialization = task6Deferred<ProfileTransactionResult>();
    vi.spyOn(ProfileTransactions, 'initializeProfileMetadata').mockReturnValueOnce(initialization.promise);
    renderTask6Profiles();
    storage.values.set(PROFILES_KEY, raw);

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: PROFILES_KEY, newValue: raw }));
    });

    expect(screen.getByRole('alert').textContent).toContain('Refresh');
    expect(screen.queryByText('Profile children')).toBeNull();

    initialization.resolve({ ok: true, metadata, notice: null });
    await act(async () => { await initialization.promise; });

    expect(screen.getByRole('alert').textContent).toContain('Refresh');
    expect(screen.queryByText('Profile children')).toBeNull();
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
  });

  it.each([
    {
      label: 'unsupported future metadata',
      raw: JSON.stringify({
        version: 3,
        revision: 9,
        profiles: metadata.profiles,
        activeProfileId: 'other',
      }),
    },
    { label: 'invalid metadata', raw: '{bad' },
    {
      label: 'legacy metadata',
      raw: JSON.stringify({ profiles: metadata.profiles, activeProfileId: 'other' }),
    },
  ])('aborts real startup transaction side effects when $label arrives during arbitration', async ({ raw }) => {
    storage.values.set(PROFILES_KEY, '{initially-broken');
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, JSON.stringify(metadata));
    storage.values.set(PROFILE_METADATA_RECOVERY_KEY, 'existing-recovery');
    storage.values.set(LEGACY_SAVE_KEY, serializeCurrent(initialState));
    storage.values.set(profileBaseKey('target'), 'existing-profile-save');
    renderTask6Profiles();

    storage.values.set(PROFILES_KEY, raw);
    const expected = new Map(
      [...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: raw,
      }));
    });

    expect(screen.getByRole('alert').textContent).toContain('Refresh');
    expect(screen.queryByText('Profile children')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    });

    expect(screen.getByRole('alert').textContent).toContain('Refresh');
    expect(screen.queryByText('Profile children')).toBeNull();
    expect(new Map(
      [...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY),
    )).toEqual(expected);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it('installs a valid primary event while startup arbitration is still in flight', async () => {
    storage.values.set(PROFILE_METADATA_BACKUP_KEY, 'existing-backup');
    storage.values.set(PROFILE_METADATA_RECOVERY_KEY, 'existing-recovery');
    const rendered = renderTask6Profiles();
    const incoming = task6Metadata({
      revision: 4,
      profiles: [{ ...metadata.profiles[0], name: 'Startup event winner' }, metadata.profiles[1]],
      activeProfileId: 'other',
    });
    const raw = JSON.stringify(incoming);
    storage.values.set(PROFILES_KEY, raw);
    const expected = new Map(
      [...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY),
    );

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: raw,
      }));
    });

    expect(rendered.current().profiles).toEqual(incoming.profiles);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(screen.getByText('Profile children')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    });

    expect(rendered.current().profiles).toEqual(incoming.profiles);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().pendingAction).toBeNull();
    expect(rendered.current().mutationFailure).toBeNull();
    expect(new Map(
      [...storage.values].filter(([key]) => key !== PROFILE_METADATA_LOCK_KEY),
    )).toEqual(expected);
    expect(storage.values.has(PROFILE_METADATA_LOCK_KEY)).toBe(false);
  });

  it('retries once when a crashed startup lock reaches its expiry', async () => {
    storage.values.set(PROFILE_METADATA_LOCK_KEY, JSON.stringify({
      version: 1,
      ownerId: 'crashed-tab',
      expiresAt: 1_000 + PROFILE_METADATA_LOCK_TTL_MS,
    }));
    const initialize = vi.spyOn(ProfileTransactions, 'initializeProfileMetadata');
    const rendered = renderTask6Profiles();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TIMEOUT_MS);
    });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe('Loading profiles...');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        PROFILE_METADATA_LOCK_TTL_MS - PROFILE_METADATA_LOCK_TIMEOUT_MS - 1,
      );
    });
    expect(initialize).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1 + PROFILE_METADATA_LOCK_ARBITRATION_MS);
    });
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(rendered.current().profiles).toEqual(metadata.profiles);
    expect(screen.getByText('Profile children')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TTL_MS);
    });
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('stops at a recoverable terminal state when the startup expiry retry is still busy', async () => {
    storage.values.set(PROFILE_METADATA_LOCK_KEY, JSON.stringify({
      version: 1,
      ownerId: 'stuck-tab',
      expiresAt: 1_000 + PROFILE_METADATA_LOCK_TTL_MS,
    }));
    const initialize = vi.spyOn(ProfileTransactions, 'initializeProfileMetadata');
    initialize
      .mockResolvedValueOnce({ ok: false, reason: 'busy', metadata: null, notice: null })
      .mockResolvedValueOnce({ ok: false, reason: 'busy', metadata: null, notice: null })
      .mockResolvedValueOnce({ ok: true, metadata: task6Metadata({ revision: 1 }), notice: null });

    render(
      <ProfileProvider>
        <SyntheticProfileWriter />
      </ProfileProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('status').textContent).toBe('Loading profiles...');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TTL_MS);
    });

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert').textContent).toContain('Refresh');
    expect(screen.queryByText('Profile writer mounted')).toBeNull();
    expect([...storage.values.keys()].filter(key => key.startsWith('FATE_PROFILE_'))).toEqual([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TTL_MS * 2);
    });
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('does not run the startup expiry retry after unmount', async () => {
    storage.values.set(PROFILE_METADATA_LOCK_KEY, JSON.stringify({
      version: 1,
      ownerId: 'stuck-tab',
      expiresAt: 1_000 + PROFILE_METADATA_LOCK_TTL_MS,
    }));
    const initialize = vi.spyOn(ProfileTransactions, 'initializeProfileMetadata');
    initialize.mockResolvedValueOnce({
      ok: false,
      reason: 'busy',
      metadata: null,
      notice: null,
    });
    const rendered = renderTask6Profiles();
    await act(async () => { await Promise.resolve(); });
    rendered.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TTL_MS);
    });
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('uses the validated read-only fallback when the bounded startup reread loses storage', async () => {
    const fallback = task6Metadata({
      revision: 1,
      profiles: [{ id: 'memory', name: 'Memory', createdAt: 1_000 }],
      activeProfileId: 'memory',
    });
    const initialize = vi.spyOn(ProfileTransactions, 'initializeProfileMetadata');
    initialize
      .mockResolvedValueOnce({
        ok: false,
        reason: 'busy',
        metadata: null,
        notice: null,
      })
      .mockResolvedValueOnce({
        ok: false,
        reason: 'storage_unavailable',
        metadata: null,
        notice: null,
      })
      .mockResolvedValueOnce({ ok: true, metadata: fallback, notice: null });

    const rendered = renderTask6Profiles();
    await act(async () => { await Promise.resolve(); });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILE_METADATA_LOCK_KEY,
        newValue: null,
      }));
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(initialize).toHaveBeenCalledTimes(3);
    expect(rendered.current().profiles).toEqual(fallback.profiles);
    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().mutationFailure).toBe('storage_unavailable');
    expect(rendered.current().recoveryNotice?.kind).toBe('read_only');
  });

  it('becomes read-only after a mutation discovers unsupported metadata', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'unsupported_metadata',
      metadata: task6Metadata({ revision: 9, activeProfileId: 'other' }),
      notice: {
        kind: 'unsupported',
        recoveredProfiles: 0,
        generatedNames: 0,
        unreadableSaves: 0,
        overflowSaves: 0,
        rollbackFailures: 0,
      },
    });

    await act(async () => {
      await rendered.current().renameProfile('target', 'Unsupported');
    });

    expect(rendered.current().profiles).toEqual(metadata.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().mutationFailure).toBe('unsupported_metadata');
    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().recoveryNotice?.kind).toBe('unsupported');
  });

  it('synchronizes create, rename, and delete events between two providers without stealing local selection', async () => {
    let clientA: Profiles | undefined;
    let clientB: Profiles | undefined;
    render(
      <>
        <ProfileProvider>
          <ProfileCapture onProfiles={profiles => { clientA = profiles; }} />
        </ProfileProvider>
        <ProfileProvider>
          <ProfileCapture onProfiles={profiles => { clientB = profiles; }} />
        </ProfileProvider>
      </>,
    );
    await settleTask6Initialization();
    const a = () => {
      if (!clientA) throw new Error('Client A did not initialize');
      return clientA;
    };
    const b = () => {
      if (!clientB) throw new Error('Client B did not initialize');
      return clientB;
    };
    const run = async (
      start: () => Promise<ProfileTransactionResult>,
    ): Promise<ProfileTransactionResult> => {
      let pending!: Promise<ProfileTransactionResult>;
      act(() => { pending = start(); });
      let result!: ProfileTransactionResult;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
        result = await pending;
      });
      return result;
    };
    const deliverPrimary = () => {
      const raw = storage.values.get(PROFILES_KEY);
      if (raw === undefined) throw new Error('Durable registry missing');
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: PROFILES_KEY,
          newValue: raw,
        }));
      });
    };

    expect((await run(() => b().switchProfile('other'))).ok).toBe(true);
    expect(a().activeProfileId).toBe('target');
    expect(b().activeProfileId).toBe('other');

    expect((await run(() => a().createProfile('Created by A'))).ok).toBe(true);
    const createdId = a().recentlyCreatedId;
    expect(createdId).not.toBeNull();
    deliverPrimary();
    expect(b().profiles.map(profile => profile.id)).toContain(createdId);
    expect(b().activeProfileId).toBe('other');
    expect(b().recentlyCreatedId).toBeNull();

    expect((await run(() => a().renameProfile(createdId!, 'Renamed by A'))).ok).toBe(true);
    deliverPrimary();
    expect(b().profiles.find(profile => profile.id === createdId)?.name).toBe('Renamed by A');
    expect(b().activeProfileId).toBe('other');

    expect((await run(() => a().deleteProfile(createdId!))).ok).toBe(true);
    deliverPrimary();
    expect(b().profiles.some(profile => profile.id === createdId)).toBe(false);
    expect(b().activeProfileId).toBe('other');
    expect(b().recentlyCreatedId).toBeNull();

    const evictionCalls: string[] = [];
    const unsubscribe = b().registerProfileEvictionHandler(profileId => {
      evictionCalls.push(profileId);
    });
    const durable = JSON.parse(storage.values.get(PROFILES_KEY)!) as ProfileMetadata;
    const removal: ProfileMetadata = {
      ...durable,
      revision: durable.revision + 1,
      profiles: durable.profiles.filter(profile => profile.id !== 'other'),
      activeProfileId: 'target',
    };
    storage.values.set(PROFILES_KEY, JSON.stringify(removal));
    deliverPrimary();

    expect(evictionCalls).toEqual(['other']);
    expect(b().activeProfileId).toBe('target');
    expect(b().profiles.map(profile => profile.id)).toEqual(['target']);
    unsubscribe();
  });

  it('refreshes a real not_found result from durable metadata while preserving local selection', async () => {
    const staleProfile = { id: 'stale', name: 'Stale', createdAt: 3 };
    const local: ProfileMetadata = {
      version: 2,
      revision: 2,
      profiles: [...metadata.profiles, staleProfile],
      activeProfileId: 'target',
      deletions: [],
    };
    storage.values.set(PROFILES_KEY, JSON.stringify(local));
    let current: Profiles | undefined;
    render(
      <ProfileProvider>
        <ProfileCapture onProfiles={profiles => { current = profiles; }} />
        <ProfileSwitcher />
      </ProfileProvider>,
    );
    await settleTask6Initialization();
    const profiles = () => {
      if (!current) throw new Error('Profile provider did not initialize');
      return current;
    };
    const durable: ProfileMetadata = {
      version: 2,
      revision: 5,
      profiles: metadata.profiles,
      activeProfileId: 'other',
      deletions: [],
    };
    const durableRaw = JSON.stringify(durable);
    storage.values.set(PROFILES_KEY, durableRaw);

    fireEvent.click(screen.getByRole('button', {
      name: 'Switch profile. Current profile: Target',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename Stale' }));
    const input = screen.getByRole('textbox', { name: 'Rename Stale' });
    fireEvent.change(input, { target: { value: 'Too late' } });
    await act(async () => {
      fireEvent.submit(input.closest('form') as HTMLFormElement);
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByRole('alert').textContent).toBe(
      'That profile no longer exists. The list has been refreshed.',
    );
    expect(screen.queryByRole('textbox', { name: 'Rename Stale' })).toBeNull();
    expect(profiles().profiles).toEqual(durable.profiles);
    expect(profiles().activeProfileId).toBe('target');
    expect(storage.values.get(PROFILES_KEY)).toBe(durableRaw);
  });

  it.each([
    { label: 'equal', revision: 5 },
    { label: 'older', revision: 4 },
  ])('does not install $label-revision metadata returned with not_found', async ({ revision }) => {
    const local = task6Metadata({ revision: 5 });
    const raw = JSON.stringify(local);
    storage.values.set(PROFILES_KEY, raw);
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'not_found',
      metadata: {
        version: 2,
        revision,
        profiles: [metadata.profiles[0]],
        activeProfileId: 'target',
        deletions: [],
      },
      notice: null,
    });

    await act(async () => {
      await rendered.current().renameProfile('other', 'Missing');
    });

    expect(rendered.current().profiles).toEqual(local.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().mutationFailure).toBe('not_found');
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
  });

  it.each([
    {
      label: 'structurally invalid',
      returned: {
        version: 1,
        revision: 20,
        profiles: [],
        activeProfileId: 'missing',
      } as unknown as ProfileMetadata,
    },
    {
      label: 'unsupported future-shaped',
      returned: {
        version: 3,
        revision: 20,
        profiles: [metadata.profiles[0]],
        activeProfileId: 'target',
        opaque: true,
      } as unknown as ProfileMetadata,
    },
  ])('does not install $label metadata returned with not_found', async ({ returned }) => {
    const raw = JSON.stringify(metadata);
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    vi.spyOn(ProfileTransactions, 'mutateProfileMetadata').mockResolvedValueOnce({
      ok: false,
      reason: 'not_found',
      metadata: returned,
      notice: null,
    });

    await act(async () => {
      await rendered.current().renameProfile('other', 'Missing');
    });

    expect(rendered.current().profiles).toEqual(metadata.profiles);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().metadataReadOnly).toBe(false);
    expect(rendered.current().mutationFailure).toBe('not_found');
    expect(storage.values.get(PROFILES_KEY)).toBe(raw);
  });
});
