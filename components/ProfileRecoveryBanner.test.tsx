// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfileContextType } from '../context/ProfileContext';
import type { ProfileRecoveryNotice } from '../utils/profileMetadata';
import {
  ProfileRecoveryBanner,
  ProfileRecoveryBannerView,
} from './ProfileRecoveryBanner';

const profileContext = vi.hoisted(() => ({
  current: null as unknown as ProfileContextType,
}));

vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => profileContext.current,
}));

const notice = (
  kind: ProfileRecoveryNotice['kind'],
  overrides: Partial<ProfileRecoveryNotice> = {},
): ProfileRecoveryNotice => ({
  kind,
  recoveredProfiles: 0,
  generatedNames: 0,
  unreadableSaves: 0,
  overflowSaves: 0,
  rollbackFailures: 0,
  ...overrides,
});

const contextWithNotice = (
  recoveryNotice: ProfileRecoveryNotice | null,
  dismissRecoveryNotice: () => void = () => undefined,
): ProfileContextType => ({
  profiles: [{ id: 'alpha', name: 'Alpha', createdAt: 1 }],
  activeProfileId: 'alpha',
  activeProfileName: 'Alpha',
  storageKeyForActiveProfile: 'FATE_PROFILE_alpha',
  pendingAction: null,
  mutationFailure: null,
  recoveryNotice,
  metadataReadOnly: false,
  createProfile: vi.fn(async () => { throw new Error('Not used by this test'); }),
  switchProfile: vi.fn(async () => { throw new Error('Not used by this test'); }),
  renameProfile: vi.fn(async () => { throw new Error('Not used by this test'); }),
  deleteProfile: vi.fn(async () => { throw new Error('Not used by this test'); }),
  dismissRecoveryNotice,
  recentlyCreatedId: null,
  clearRecentlyCreated: vi.fn(),
  registerProfileEvictionHandler: vi.fn(() => () => undefined),
});

afterEach(cleanup);

describe('ProfileRecoveryBannerView', () => {
  it.each<{
    kind: ProfileRecoveryNotice['kind'];
    role: 'status' | 'alert';
    heading: string;
  }>([
    { kind: 'repaired', role: 'status', heading: 'Profile recovery completed' },
    { kind: 'partial', role: 'alert', heading: 'Some profile data needs attention' },
    { kind: 'read_only', role: 'alert', heading: 'Profiles are temporarily read-only' },
    { kind: 'unsupported', role: 'alert', heading: 'A newer app version saved these profiles' },
    { kind: 'remote_removal', role: 'alert', heading: 'Your active profile was removed in another tab' },
  ])('uses the approved accessible role and safe heading for $kind', ({ kind, role, heading }) => {
    const malicious = notice(kind, {
      recoveredProfiles: 2,
      generatedNames: 1,
      unreadableSaves: 3,
      overflowSaves: 4,
      rollbackFailures: 5,
    }) as ProfileRecoveryNotice & { rawMetadata: string; storageKey: string };
    malicious.rawMetadata = '<script>steal-profile()</script>';
    malicious.storageKey = 'FATE_PROFILES__recovery';

    render(<ProfileRecoveryBannerView notice={malicious} onDismiss={() => undefined} />);

    const banner = screen.getByRole(role);
    expect(banner.textContent).toContain(heading);
    expect(banner.textContent).not.toContain(malicious.rawMetadata);
    expect(banner.textContent).not.toContain(malicious.storageKey);
  });

  it('uses singular and plural count-only recovery details when those counts are relevant', () => {
    render(
      <ProfileRecoveryBannerView
        notice={notice('partial', {
          recoveredProfiles: 2,
          generatedNames: 1,
          unreadableSaves: 3,
          overflowSaves: 1,
          rollbackFailures: 2,
        })}
        onDismiss={() => undefined}
      />,
    );

    const copy = screen.getByRole('alert').textContent ?? '';
    expect(copy).toContain('Recovered 2 profiles.');
    expect(copy).toContain('Reconstructed 1 profile name.');
    expect(copy).toContain('Left 3 unreadable saves untouched.');
    expect(copy).toContain('Left 1 additional save untouched.');
    expect(copy).toContain('2 profile entries could not be restored during rollback.');
  });

  it('omits zero and irrelevant counts', () => {
    render(
      <ProfileRecoveryBannerView
        notice={notice('remote_removal', {
          recoveredProfiles: 9,
          generatedNames: 8,
          unreadableSaves: 7,
          overflowSaves: 6,
          rollbackFailures: 5,
        })}
        onDismiss={() => undefined}
      />,
    );

    expect(screen.getByRole('alert').textContent).not.toMatch(/\b[5-9]\b/);
  });

  it('dismisses the notice and returns focus to the profile switcher trigger', async () => {
    const onDismiss = vi.fn();
    render(
      <>
        <button type="button" data-profile-switcher-trigger>Profile trigger</button>
        <ProfileRecoveryBannerView notice={notice('repaired')} onDismiss={onDismiss} />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss profile recovery notice' }));

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Profile trigger' }));
  });

  it('does not throw when the profile switcher trigger is absent', async () => {
    const onDismiss = vi.fn();
    render(<ProfileRecoveryBannerView notice={notice('partial')} onDismiss={onDismiss} />);

    await expect(userEvent.click(
      screen.getByRole('button', { name: 'Dismiss profile recovery notice' }),
    )).resolves.toBeUndefined();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('ProfileRecoveryBanner', () => {
  it('connects the persistent provider notice to its dismissal action', async () => {
    const dismissRecoveryNotice = vi.fn();
    profileContext.current = contextWithNotice(
      notice('repaired', { recoveredProfiles: 1 }),
      dismissRecoveryNotice,
    );
    render(<ProfileRecoveryBanner />);

    expect(screen.getByRole('status').textContent).toContain('Recovered 1 profile.');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss profile recovery notice' }));
    expect(dismissRecoveryNotice).toHaveBeenCalledOnce();
  });

  it('renders nothing when the provider has no recovery notice', () => {
    profileContext.current = contextWithNotice(null);
    render(<ProfileRecoveryBanner />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
