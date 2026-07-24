import { describe, expect, it } from 'vitest';
import {
  commitProfileMetadata,
  deleteProfileTransaction,
  profileDeletionNotice,
  deleteProfileStorage,
  profileOwnedKeys,
} from './profileStorage';
import type { ProfileMetadata } from '../types';

const expectedKeys = (profileId: string): string[] => {
  const base = `FATE_PROFILE_${profileId}`;
  return [
    base,
    `${base}__backups`,
    `${base}__exportNag`,
    `${base}__discord`,
    `${base}__discordCursor`,
    `fate_features_seen_v1_${profileId}`,
  ];
};

describe('profile-owned storage registry', () => {
  it('lists the exact six owned keys in stable order', () => {
    expect(profileOwnedKeys('target')).toEqual(expectedKeys('target'));
  });

  it('removes only the exact registered keys for the selected profile', () => {
    const targetKeys = expectedKeys('target');
    const otherKeys = expectedKeys('other');
    const preservedKeys = [
      ...otherKeys,
      'FATE_PROFILES',
      'fate-locked:last-seen-changelog',
      'fate_coach_dismissed_v1',
      'fate_tour_done_v1',
      'fate_relay_session_v1',
      'fate_rl_onboard_hidden_v1',
      'FATE_PROFILE_target_misleading',
    ];
    const store = new Map(
      [...targetKeys, ...preservedKeys].map((key) => [key, `value:${key}`]),
    );
    const attempted: string[] = [];

    const result = deleteProfileStorage({
      removeItem: (key) => {
        attempted.push(key);
        store.delete(key);
      },
    }, 'target');

    expect(attempted).toEqual(targetKeys);
    expect(result).toEqual({ removed: targetKeys, failed: [] });
    expect([...store.keys()]).toEqual(preservedKeys);
  });

  it('attempts every key after an individual removal fails', () => {
    const targetKeys = expectedKeys('target');
    const failingKey = targetKeys[1];
    const attempted: string[] = [];

    const result = deleteProfileStorage({
      removeItem: (key) => {
        attempted.push(key);
        if (key === failingKey) throw new Error('storage unavailable');
      },
    }, 'target');

    expect(attempted).toEqual(targetKeys);
    expect(result).toEqual({
      removed: targetKeys.filter((key) => key !== failingKey),
      failed: [failingKey],
    });
  });
});

const metadata: ProfileMetadata = {
  profiles: [
    { id: 'target', name: 'Target', createdAt: 1 },
    { id: 'other', name: 'Other', createdAt: 2 },
  ],
  activeProfileId: 'target',
};

describe('profile deletion transaction', () => {
  it('removes sidecars before persisting metadata and preserves active replacement', () => {
    const operations: string[] = [];
    const result = deleteProfileTransaction({
      getItem: () => null,
      removeItem: (key) => {
        operations.push('remove:' + key);
      },
      setItem: (key, value) => {
        operations.push('set:' + key);
        expect(JSON.parse(value)).toEqual({
          profiles: [metadata.profiles[1]],
          activeProfileId: 'other',
        });
      },
    }, 'FATE_PROFILES', { current: metadata }, 'target');

    expect(operations).toEqual([
      ...expectedKeys('target').map((key) => 'remove:' + key),
      'set:FATE_PROFILES',
    ]);
    expect(result).toEqual({
      status: 'deleted',
      metadata: {
        profiles: [metadata.profiles[1]],
        activeProfileId: 'other',
      },
      storage: { removed: expectedKeys('target'), failed: [] },
    });
  });

  it('commits metadata after sidecar failures and reports the exact failures', () => {
    const failingKeys = [expectedKeys('target')[1], expectedKeys('target')[4]];
    let persisted = false;
    const result = deleteProfileTransaction({
      getItem: () => null,
      removeItem: (key) => {
        if (failingKeys.includes(key)) throw new Error('blocked');
      },
      setItem: () => {
        persisted = true;
      },
    }, 'FATE_PROFILES', { current: metadata }, 'target');

    expect(persisted).toBe(true);
    expect(result.status).toBe('deleted');
    expect(result.storage.failed).toEqual(failingKeys);
  });

  it('restores every owned value when metadata persistence fails', () => {
    const targetKeys = expectedKeys('target');
    const originalEntries = [
      ...targetKeys.map((key) => [key, `value:${key}`] as const),
      ['FATE_PROFILES', JSON.stringify(metadata)] as const,
      ['FATE_PROFILE_other', 'other-save'] as const,
    ];
    const store = new Map<string, string>(originalEntries);
    const reads: string[] = [];
    const removals: string[] = [];
    const writes: string[] = [];
    const current = { current: metadata };

    const result = deleteProfileTransaction({
      getItem: (key) => {
        reads.push(key);
        return store.get(key) ?? null;
      },
      removeItem: (key) => {
        removals.push(key);
        store.delete(key);
      },
      setItem: (key, value) => {
        writes.push(key);
        if (key === 'FATE_PROFILES') throw new Error('quota');
        store.set(key, value);
      },
    }, 'FATE_PROFILES', current, 'target');

    expect(reads).toEqual(targetKeys);
    expect(removals).toEqual(targetKeys);
    expect(writes).toEqual(['FATE_PROFILES', ...targetKeys]);
    expect([...store.entries()].sort()).toEqual([...originalEntries].sort());
    expect(result).toEqual({
      status: 'metadata_write_failed',
      metadata,
      storage: { removed: [], failed: [] },
    });
    expect(current.current).toBe(metadata);
  });

  it('separates failed removals from profile data lost during rollback', () => {
    const targetKeys = expectedKeys('target');
    const initialRemoveFailure = targetKeys[1];
    const rollbackFailures = [targetKeys[0], targetKeys[3]];
    const store = new Map(targetKeys.map((key) => [key, `value:${key}`]));

    const result = deleteProfileTransaction({
      getItem: (key) => store.get(key) ?? null,
      removeItem: (key) => {
        if (key === initialRemoveFailure) throw new Error('remove blocked');
        store.delete(key);
      },
      setItem: (key, value) => {
        if (key === 'FATE_PROFILES' || rollbackFailures.includes(key)) {
          throw new Error('write blocked');
        }
        store.set(key, value);
      },
    }, 'FATE_PROFILES', { current: metadata }, 'target');

    expect(result).toEqual({
      status: 'metadata_write_failed',
      metadata,
      storage: {
        removed: rollbackFailures,
        failed: [initialRemoveFailure],
      },
    });
    expect(store.has(initialRemoveFailure)).toBe(true);
    for (const key of rollbackFailures) expect(store.has(key)).toBe(false);
    for (const key of targetKeys) {
      if (key === initialRemoveFailure || rollbackFailures.includes(key)) continue;
      expect(store.get(key)).toBe(`value:${key}`);
    }
  });

  it('returns previous React metadata when metadata persistence fails', () => {
    const result = deleteProfileTransaction({
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('quota');
      },
    }, 'FATE_PROFILES', { current: metadata }, 'target');

    expect(result).toEqual({
      status: 'metadata_write_failed',
      metadata,
      storage: { removed: [], failed: [] },
    });
    expect(result.metadata).toBe(metadata);
  });

  it('keeps last-profile protection ahead of every storage mutation', () => {
    const single: ProfileMetadata = {
      profiles: [metadata.profiles[0]],
      activeProfileId: 'target',
    };
    const operations: string[] = [];
    const result = deleteProfileTransaction({
      getItem: (key) => {
        operations.push('get:' + key);
        return null;
      },
      removeItem: (key) => operations.push('remove:' + key),
      setItem: (key) => operations.push('set:' + key),
    }, 'FATE_PROFILES', { current: single }, 'target');

    expect(operations).toEqual([]);
    expect(result).toEqual({
      status: 'last_profile',
      metadata: single,
      storage: { removed: [], failed: [] },
    });
  });
});

describe('profile deletion notice policy', () => {
  it('shows one count-only warning for sidecar failures', () => {
    const notice = profileDeletionNotice({
      status: 'deleted',
      metadata,
      storage: { removed: [], failed: ['secret-one', 'secret-two'] },
    });
    expect(notice).toBe('Profile deleted, but 2 local storage entries could not be removed');
    expect(notice).not.toContain('secret');
  });

  it('reports metadata failure without claiming deletion', () => {
    expect(profileDeletionNotice({
      status: 'metadata_write_failed',
      metadata,
      storage: { removed: [], failed: [] },
    })).toBe('Profile deletion could not be saved. Your profile list is unchanged.');
  });

  it('names only profile data that remained deleted after rollback', () => {
    const targetKeys = expectedKeys('target');
    const initialRemoveFailure = targetKeys[1];
    const rollbackFailures = [targetKeys[0], targetKeys[3]];
    const notice = profileDeletionNotice({
      status: 'metadata_write_failed',
      metadata,
      storage: {
        removed: rollbackFailures,
        failed: [initialRemoveFailure],
      },
    });

    expect(notice).toBe(
      'Profile deletion could not be saved. Your profile list is unchanged, but this profile data could not be restored: '
      + rollbackFailures.join(', ')
      + '.',
    );
    expect(notice).not.toContain(initialRemoveFailure);
    expect(notice).not.toContain('value:');
  });

  it('preserves last-profile messaging and stays quiet after a clean delete', () => {
    expect(profileDeletionNotice({
      status: 'last_profile',
      metadata,
      storage: { removed: [], failed: [] },
    })).toBe('Cannot delete the last profile');
    expect(profileDeletionNotice({
      status: 'deleted',
      metadata,
      storage: { removed: expectedKeys('target'), failed: [] },
    })).toBeNull();
  });
});

describe('synchronous profile metadata transactions', () => {
  it('feeds each same-tick mutation the last committed metadata', () => {
    const current = { current: metadata };
    const persisted: ProfileMetadata[] = [];
    const storage = {
      setItem: (_key: string, value: string) => persisted.push(JSON.parse(value)),
    };

    const created = commitProfileMetadata(storage, 'FATE_PROFILES', current, (previous) => ({
      profiles: [
        ...previous.profiles,
        { id: 'new', name: 'New', createdAt: 3 },
      ],
      activeProfileId: 'new',
    }));
    const renamed = commitProfileMetadata(storage, 'FATE_PROFILES', current, (previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === 'target' ? { ...profile, name: 'Renamed' } : profile
      ),
    }));

    expect(created.ok).toBe(true);
    expect(renamed.ok).toBe(true);
    expect(persisted).toHaveLength(2);
    expect(current.current.profiles.map((profile) => profile.id)).toEqual(['target', 'other', 'new']);
    expect(current.current.profiles[0].name).toBe('Renamed');
    expect(current.current.activeProfileId).toBe('new');
  });

  it('keeps the exact current object when metadata persistence fails', () => {
    const current = { current: metadata };
    const result = commitProfileMetadata({
      setItem: () => {
        throw new Error('quota');
      },
    }, 'FATE_PROFILES', current, (previous) => ({
      ...previous,
      activeProfileId: 'other',
    }));

    expect(result).toEqual({ ok: false, metadata });
    expect(result.metadata).toBe(metadata);
    expect(current.current).toBe(metadata);
  });

  it('does not resurrect profiles across two same-tick allowed deletes', () => {
    const third = { id: 'third', name: 'Third', createdAt: 3 };
    const current = {
      current: {
        profiles: [...metadata.profiles, third],
        activeProfileId: 'target',
      },
    };
    const storage = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    };

    const first = deleteProfileTransaction(storage, 'FATE_PROFILES', current, 'target');
    const second = deleteProfileTransaction(storage, 'FATE_PROFILES', current, 'other');

    expect(first.status).toBe('deleted');
    expect(second.status).toBe('deleted');
    expect(current.current).toEqual({ profiles: [third], activeProfileId: 'third' });
  });

  it('preserves a same-tick prior mutation when deletion commits', () => {
    const current = { current: metadata };
    const storage = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    };
    commitProfileMetadata(storage, 'FATE_PROFILES', current, (previous) => ({
      ...previous,
      profiles: [
        ...previous.profiles,
        { id: 'new', name: 'New', createdAt: 3 },
      ],
    }));

    const result = deleteProfileTransaction(storage, 'FATE_PROFILES', current, 'target');

    expect(result.status).toBe('deleted');
    expect(current.current.profiles.map((profile) => profile.id)).toEqual(['other', 'new']);
  });
});
