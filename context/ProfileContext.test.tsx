// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileMetadata } from '../types';
import {
  getPendingSave,
  resetPendingSavesForTest,
  stagePendingSave,
} from '../utils/pendingSaves';
import { profileBaseKey } from '../utils/profileStorage';
import { ProfileProvider, useProfiles } from './ProfileContext';

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
    values.clear();
    values.set('FATE_PROFILES', JSON.stringify(metadata));
    failMetadataWrites = false;
    resetPendingSavesForTest();
    vi.stubGlobal('localStorage', {
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
    vi.unstubAllGlobals();
  });

  const renderProfiles = () => {
    let current: Profiles | undefined;
    render(
      <ProfileProvider>
        <ProfileCapture onProfiles={profiles => { current = profiles; }} />
      </ProfileProvider>,
    );
    return () => {
      if (!current) throw new Error('Profile provider did not initialize');
      return current;
    };
  };

  it('discards pending data after a profile is successfully deleted', () => {
    const targetKey = profileBaseKey('target');
    stagePendingSave(targetKey, 'newest');
    const current = renderProfiles();

    act(() => current().deleteProfile('target'));

    expect(getPendingSave(targetKey)).toBeNull();
    expect(current().profiles.map(profile => profile.id)).toEqual(['other']);
  });

  it('retains pending data when profile metadata cannot be saved', () => {
    const targetKey = profileBaseKey('target');
    stagePendingSave(targetKey, 'newest');
    const current = renderProfiles();
    failMetadataWrites = true;

    act(() => current().deleteProfile('target'));

    expect(getPendingSave(targetKey)?.data).toBe('newest');
    expect(current().profiles.map(profile => profile.id)).toEqual(['target', 'other']);
  });
});
