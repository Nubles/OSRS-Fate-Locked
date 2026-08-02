// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileMetadata } from '../types';
import {
  getPendingSave,
  resetPendingSavesForTest,
  stagePendingSave,
} from '../utils/pendingSaves';
import { profileBaseKey } from '../utils/profileStorage';
import { ProfileProvider, useProfiles } from './ProfileContext';
import {
  PROFILE_METADATA_BACKUP_KEY,
  PROFILE_METADATA_LOCK_KEY,
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
  version: 1,
  revision: 0,
  profiles: [
    { id: 'target', name: 'Target', createdAt: 1 },
    { id: 'other', name: 'Other', createdAt: 2 },
  ],
  activeProfileId: 'target',
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

const Task6ProfileCapture = ({ onProfiles }: { onProfiles: (profiles: Profiles) => void }) => {
  onProfiles(useProfiles());
  return <div>Profile children</div>;
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
      version: 2,
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
        version: 2,
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
      version: 2,
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
    await act(async () => { await rename; });

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
      version: 1,
      revision: 2,
      profiles: [metadata.profiles[1]],
      activeProfileId: 'other',
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

  it('defers remote removal until registration and applies only the newest deferred revision', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const staleRemoval: ProfileMetadata = {
      version: 1,
      revision: 2,
      profiles: [{ ...metadata.profiles[1], name: 'Stale removal' }],
      activeProfileId: 'other',
    };
    const newestRemoval: ProfileMetadata = {
      version: 1,
      revision: 3,
      profiles: [{ ...metadata.profiles[1], name: 'Newest removal' }],
      activeProfileId: 'other',
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

    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().profiles).toEqual(metadata.profiles);

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
      activeDuringEviction: 'target',
    }]);
    expect(rendered.current().activeProfileId).toBe('other');
    expect(rendered.current().profiles).toEqual(newestRemoval.profiles);
    expect(rendered.current().recoveryNotice?.kind).toBe('remote_removal');
    unsubscribe();
  });

  it('returns to deferring removals after the registered eviction handler unsubscribes', async () => {
    const rendered = renderTask6Profiles();
    await settleTask6Initialization();
    const calls: string[] = [];
    const unsubscribe = rendered.current().registerProfileEvictionHandler(profileId => {
      calls.push(profileId);
    });
    unsubscribe();
    const incoming: ProfileMetadata = {
      version: 1,
      revision: 2,
      profiles: [metadata.profiles[1]],
      activeProfileId: 'other',
    };

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROFILES_KEY,
        newValue: JSON.stringify(incoming),
      }));
    });

    expect(calls).toEqual([]);
    expect(rendered.current().activeProfileId).toBe('target');
    expect(rendered.current().profiles).toEqual(metadata.profiles);
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

  it('uses one validated read-only fallback when the startup expiry retry is still busy', async () => {
    storage.values.set(PROFILE_METADATA_LOCK_KEY, JSON.stringify({
      version: 1,
      ownerId: 'stuck-tab',
      expiresAt: 1_000 + PROFILE_METADATA_LOCK_TTL_MS,
    }));
    const fallback = task6Metadata({
      revision: 1,
      profiles: [{ id: 'memory', name: 'Memory', createdAt: 1_000 }],
      activeProfileId: 'memory',
    });
    const initialize = vi.spyOn(ProfileTransactions, 'initializeProfileMetadata');
    initialize
      .mockResolvedValueOnce({ ok: false, reason: 'busy', metadata: null, notice: null })
      .mockResolvedValueOnce({ ok: false, reason: 'busy', metadata: null, notice: null })
      .mockResolvedValueOnce({ ok: true, metadata: fallback, notice: null });

    const rendered = renderTask6Profiles();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('status').textContent).toBe('Loading profiles...');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TTL_MS);
    });

    expect(initialize).toHaveBeenCalledTimes(3);
    expect(rendered.current().profiles).toEqual(fallback.profiles);
    expect(rendered.current().metadataReadOnly).toBe(true);
    expect(rendered.current().mutationFailure).toBe('busy');
    expect(rendered.current().recoveryNotice?.kind).toBe('read_only');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_METADATA_LOCK_TTL_MS * 2);
    });
    expect(initialize).toHaveBeenCalledTimes(3);
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
});
