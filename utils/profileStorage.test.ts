import { describe, expect, it } from 'vitest';
import {
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
    }, 'FATE_PROFILES', metadata, 'target');

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
      removeItem: (key) => {
        if (failingKeys.includes(key)) throw new Error('blocked');
      },
      setItem: () => {
        persisted = true;
      },
    }, 'FATE_PROFILES', metadata, 'target');

    expect(persisted).toBe(true);
    expect(result.status).toBe('deleted');
    expect(result.storage.failed).toEqual(failingKeys);
  });

  it('returns previous React metadata when metadata persistence fails', () => {
    const result = deleteProfileTransaction({
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('quota');
      },
    }, 'FATE_PROFILES', metadata, 'target');

    expect(result).toEqual({
      status: 'metadata_write_failed',
      metadata,
      storage: { removed: expectedKeys('target'), failed: [] },
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
      removeItem: (key) => operations.push('remove:' + key),
      setItem: (key) => operations.push('set:' + key),
    }, 'FATE_PROFILES', single, 'target');

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
      storage: { removed: expectedKeys('target'), failed: [] },
    })).toBe('Profile deletion could not be saved. Your profile list is unchanged.');
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
