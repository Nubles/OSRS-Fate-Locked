import { describe, expect, it } from 'vitest';
import {
  deleteProfileStorage,
  profileOwnedKeys,
} from './profileStorage';

const expectedKeys = (profileId: string): string[] => {
  const base = `FATE_PROFILE_${profileId}`;
  return [
    base,
    `${base}__backups`,
    `${base}__exportNag`,
    `${base}__discord`,
    `${base}__discordCursor`,
    `fate_features_seen_v1_${profileId}`,
    `${base}__writer`,
    `${base}__mirrorMeta`,
    `${base}__corruptArchive`,
  ];
};

describe('profile-owned storage registry', () => {
  it('lists the exact nine owned keys in stable order', () => {
    expect(profileOwnedKeys('target')).toEqual(expectedKeys('target'));
  });

  it('owns mirror metadata and corrupt evidence with the profile', () => {
    expect(profileOwnedKeys('alpha')).toEqual(expect.arrayContaining([
      'FATE_PROFILE_alpha__mirrorMeta',
      'FATE_PROFILE_alpha__corruptArchive',
    ]));
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
