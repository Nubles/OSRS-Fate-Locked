// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfileContextType } from '../context/ProfileContext';
import type { ProfileMetadata } from '../types';
import type {
  ProfileMutationFailure,
  ProfileTransactionResult,
} from '../utils/profileMetadataTransaction';
import { ProfileSwitcher, profileMutationMessage } from './ProfileSwitcher';

const profileContext = vi.hoisted(() => ({
  current: null as unknown as ProfileContextType,
}));

vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => profileContext.current,
}));

const metadata: ProfileMetadata = {
  version: 2,
  revision: 3,
  profiles: [
    { id: 'alpha', name: 'Alpha', createdAt: 1 },
    { id: 'beta', name: 'Beta', createdAt: 2 },
  ],
  activeProfileId: 'alpha',
  deletions: [],
};

const success = (next: ProfileMetadata = metadata): ProfileTransactionResult => ({
  ok: true,
  metadata: next,
  notice: null,
});

const failure = (reason: ProfileMutationFailure): ProfileTransactionResult => ({
  ok: false,
  reason,
  metadata,
  notice: null,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
};

const context = (overrides: Partial<ProfileContextType> = {}): ProfileContextType => ({
  profiles: metadata.profiles,
  activeProfileId: metadata.activeProfileId,
  activeProfileName: 'Alpha',
  storageKeyForActiveProfile: 'FATE_PROFILE_alpha',
  pendingAction: null,
  mutationFailure: null,
  recoveryNotice: null,
  metadataReadOnly: false,
  createProfile: vi.fn().mockResolvedValue(success()),
  switchProfile: vi.fn().mockResolvedValue(success()),
  renameProfile: vi.fn().mockResolvedValue(success()),
  deleteProfile: vi.fn().mockResolvedValue(success()),
  dismissRecoveryNotice: vi.fn(),
  recentlyCreatedId: null,
  clearRecentlyCreated: vi.fn(),
  registerProfileEvictionHandler: vi.fn(() => () => undefined),
  ...overrides,
});

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Switch profile. Current profile: Alpha' }));
};

const openCreate = async () => {
  await openMenu();
  await userEvent.click(screen.getByRole('button', { name: 'New Profile' }));
};

const openRename = async () => {
  await openMenu();
  await userEvent.click(screen.getByRole('button', { name: 'Rename Alpha' }));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('profileMutationMessage', () => {
  it.each<[ProfileMutationFailure, string]>([
    ['busy', 'Another tab is updating profiles. Try again in a moment.'],
    ['profile_in_use', 'That profile is open in another tab. Switch away from it in every tab, then try again.'],
    ['max_profiles', 'Maximum of 10 profiles reached.'],
    ['not_found', 'That profile no longer exists. The list has been refreshed.'],
    ['last_profile', 'You cannot delete the last profile.'],
    ['unsupported_metadata', 'Profiles are read-only until this app supports the stored profile version.'],
    ['storage_unavailable', 'Browser storage is unavailable. Your profile list is unchanged.'],
    ['invalid_metadata', 'Profile data could not be validated. Your profile list is unchanged.'],
    ['backup_failed', 'The safety backup could not be verified. Your profile list is unchanged.'],
    ['verification_failed', 'The profile change could not be verified. Your profile list is unchanged.'],
  ])('maps %s to the approved player message', (reason, message) => {
    expect(profileMutationMessage(reason)).toBe(message);
  });
});

describe('ProfileSwitcher', () => {
  it('disables create controls immediately and starts only one transaction for duplicate submits', async () => {
    const pending = deferred<ProfileTransactionResult>();
    const createProfile = vi.fn(() => pending.promise);
    profileContext.current = context({ createProfile });
    render(<ProfileSwitcher />);
    await openCreate();

    const input = screen.getByRole('textbox', { name: 'New profile name' });
    await userEvent.type(input, '  New runner  ');
    const form = input.closest('form');
    if (form === null) throw new Error('Create form was not rendered');
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(createProfile).toHaveBeenCalledOnce();
    expect(createProfile).toHaveBeenCalledWith('New runner');
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Create profile' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel creating profile' }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { pending.resolve(success()); });
  });

  it('does not let the trigger hide a create form while its transaction is unresolved', async () => {
    const pending = deferred<ProfileTransactionResult>();
    profileContext.current = context({ createProfile: vi.fn(() => pending.promise) });
    render(<ProfileSwitcher />);
    await openCreate();
    const input = screen.getByRole('textbox', { name: 'New profile name' });
    await userEvent.type(input, 'New runner');

    fireEvent.submit(input.closest('form') as HTMLFormElement);
    fireEvent.click(screen.getByRole('button', { name: 'Switch profile. Current profile: Alpha' }));

    expect(screen.getByRole('textbox', { name: 'New profile name' })).toHaveProperty('value', 'New runner');

    await act(async () => {
      pending.resolve(failure('backup_failed'));
    });

    expect(screen.getByRole('textbox', { name: 'New profile name' })).toHaveProperty('value', 'New runner');
    expect(screen.getByRole('alert').textContent).toBe(
      'The safety backup could not be verified. Your profile list is unchanged.',
    );
  });

  it('keeps the exact create input and form open after a failed transaction', async () => {
    profileContext.current = context({
      createProfile: vi.fn().mockResolvedValue(failure('backup_failed')),
    });
    render(<ProfileSwitcher />);
    await openCreate();
    const input = screen.getByRole('textbox', { name: 'New profile name' });
    await userEvent.type(input, 'New runner');

    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }));

    expect(screen.getByRole('textbox', { name: 'New profile name' })).toHaveProperty('value', 'New runner');
    expect(screen.getByRole('alert').textContent).toBe(
      'The safety backup could not be verified. Your profile list is unchanged.',
    );
  });

  it('clears and closes create UI only after verified success', async () => {
    profileContext.current = context();
    render(<ProfileSwitcher />);
    await openCreate();
    await userEvent.type(screen.getByRole('textbox', { name: 'New profile name' }), 'New runner');

    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }));

    expect(screen.queryByRole('textbox', { name: 'New profile name' })).toBeNull();
    expect(screen.queryByText('Profiles')).toBeNull();
  });

  it('disables rename controls immediately and starts only one transaction for duplicate submits', async () => {
    const pending = deferred<ProfileTransactionResult>();
    const renameProfile = vi.fn(() => pending.promise);
    profileContext.current = context({ renameProfile });
    render(<ProfileSwitcher />);
    await openRename();

    const input = screen.getByRole('textbox', { name: 'Rename Alpha' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed runner');
    const form = input.closest('form');
    if (form === null) throw new Error('Rename form was not rendered');
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(renameProfile).toHaveBeenCalledOnce();
    expect(renameProfile).toHaveBeenCalledWith('alpha', 'Renamed runner');
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save profile name' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel renaming profile' }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { pending.resolve(success()); });
  });

  it('keeps the exact rename input and form open after a failed transaction', async () => {
    profileContext.current = context({
      renameProfile: vi.fn().mockResolvedValue(failure('verification_failed')),
    });
    render(<ProfileSwitcher />);
    await openRename();
    const input = screen.getByRole('textbox', { name: 'Rename Alpha' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed runner');

    await userEvent.click(screen.getByRole('button', { name: 'Save profile name' }));

    expect(screen.getByRole('textbox', { name: 'Rename Alpha' })).toHaveProperty('value', 'Renamed runner');
    expect(screen.getByRole('alert').textContent).toBe(
      'The profile change could not be verified. Your profile list is unchanged.',
    );
  });

  it('keeps a blank rename actionable without starting a transaction', async () => {
    const renameProfile = vi.fn().mockResolvedValue(success());
    profileContext.current = context({ renameProfile });
    render(<ProfileSwitcher />);
    await openRename();
    const input = screen.getByRole('textbox', { name: 'Rename Alpha' });
    await userEvent.clear(input);
    await userEvent.type(input, '   ');

    await userEvent.click(screen.getByRole('button', { name: 'Save profile name' }));

    expect(renameProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Rename Alpha' })).toHaveProperty('value', '   ');
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a profile name before saving.',
    );
  });

  it('clears and closes rename UI only after verified success', async () => {
    profileContext.current = context();
    render(<ProfileSwitcher />);
    await openRename();
    const input = screen.getByRole('textbox', { name: 'Rename Alpha' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed runner');

    await userEvent.click(screen.getByRole('button', { name: 'Save profile name' }));

    expect(screen.queryByRole('textbox', { name: 'Rename Alpha' })).toBeNull();
    expect(screen.getByText('Profiles')).toBeTruthy();
  });

  it('keeps the menu open after a failed switch and closes it after success', async () => {
    const switchProfile = vi.fn()
      .mockResolvedValueOnce(failure('busy'))
      .mockResolvedValueOnce(success({ ...metadata, activeProfileId: 'beta' }));
    profileContext.current = context({ switchProfile });
    render(<ProfileSwitcher />);
    await openMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Switch to Beta' }));
    expect(screen.getByText('Profiles')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Another tab is updating profiles. Try again in a moment.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Switch to Beta' }));
    expect(screen.queryByText('Profiles')).toBeNull();
  });

  it('keeps the active delete action visible but disabled, even for the only profile', async () => {
    profileContext.current = context();
    const { rerender } = render(<ProfileSwitcher />);
    await openMenu();

    const activeDelete = screen.getByRole('button', { name: 'Delete Alpha' }) as HTMLButtonElement;
    expect(activeDelete.disabled).toBe(true);
    expect(activeDelete.title).toBe('Switch profiles before deleting this profile');

    profileContext.current = context({ profiles: [metadata.profiles[0]] });
    rerender(<ProfileSwitcher />);
    expect((screen.getByRole('button', { name: 'Delete Alpha' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the menu open and explains when another tab is using a deleted profile', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    profileContext.current = context({
      deleteProfile: vi.fn().mockResolvedValue(failure('profile_in_use')),
    });
    render(<ProfileSwitcher />);
    await openMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Beta' }));

    expect(screen.getByText('Profiles')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'That profile is open in another tab. Switch away from it in every tab, then try again.',
    );
  });

  it('does not let the trigger hide an open form while context reports a pending action', async () => {
    profileContext.current = context();
    const { rerender } = render(<ProfileSwitcher />);
    await openCreate();
    const input = screen.getByRole('textbox', { name: 'New profile name' });
    await userEvent.type(input, 'Retained runner');

    profileContext.current = context({ pendingAction: 'create' });
    rerender(<ProfileSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch profile. Current profile: Alpha' }));

    expect(screen.getByRole('textbox', { name: 'New profile name' })).toHaveProperty(
      'value',
      'Retained runner',
    );
  });

  it('keeps the trigger usable for inspection while disabling all mutation controls in read-only mode', async () => {
    profileContext.current = context({ metadataReadOnly: true });
    render(<ProfileSwitcher />);

    const trigger = screen.getByRole('button', { name: 'Switch profile. Current profile: Alpha' }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    await userEvent.click(trigger);

    expect((screen.getByRole('button', { name: 'Switch to Beta' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Rename Alpha' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Delete Beta' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'New Profile' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
