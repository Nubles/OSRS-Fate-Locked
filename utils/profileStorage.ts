import type { ProfileMetadata } from '../types';

export const profileBaseKey = (profileId: string): string =>
  `FATE_PROFILE_${profileId}`;

export const profileBackupKey = (storageKey: string): string =>
  `${storageKey}__backups`;

export const profileExportNagKey = (storageKey: string): string =>
  `${storageKey}__exportNag`;

export const profileDiscordKey = (storageKey: string): string =>
  `${storageKey}__discord`;

export const profileDiscordCursorKey = (storageKey: string): string =>
  `${storageKey}__discordCursor`;

export const profileFeatureSeenKey = (profileId: string): string =>
  `fate_features_seen_v1_${profileId}`;

export const profileOwnedKeys = (profileId: string): readonly string[] => {
  const storageKey = profileBaseKey(profileId);
  return [
    storageKey,
    profileBackupKey(storageKey),
    profileExportNagKey(storageKey),
    profileDiscordKey(storageKey),
    profileDiscordCursorKey(storageKey),
    profileFeatureSeenKey(profileId),
  ];
};

export interface ProfileDeleteResult {
  removed: string[];
  failed: string[];
}

export const deleteProfileStorage = (
  storage: Pick<Storage, 'removeItem'>,
  profileId: string,
): ProfileDeleteResult => {
  const result: ProfileDeleteResult = { removed: [], failed: [] };
  for (const key of profileOwnedKeys(profileId)) {
    try {
      storage.removeItem(key);
      result.removed.push(key);
    } catch {
      result.failed.push(key);
    }
  }
  return result;
};

export type ProfileDeletionStatus =
  | 'deleted'
  | 'last_profile'
  | 'metadata_write_failed';

export interface ProfileDeletionTransactionResult {
  status: ProfileDeletionStatus;
  metadata: ProfileMetadata;
  storage: ProfileDeleteResult;
}

export const deleteProfileTransaction = (
  storage: Pick<Storage, 'removeItem' | 'setItem'>,
  metadataKey: string,
  previous: ProfileMetadata,
  profileId: string,
): ProfileDeletionTransactionResult => {
  if (previous.profiles.length <= 1) {
    return {
      status: 'last_profile',
      metadata: previous,
      storage: { removed: [], failed: [] },
    };
  }

  const profiles = previous.profiles.filter((profile) => profile.id !== profileId);
  const activeProfileId = previous.activeProfileId === profileId
    ? profiles[0].id
    : previous.activeProfileId;
  const updated: ProfileMetadata = { profiles, activeProfileId };
  const deletion = deleteProfileStorage(storage, profileId);

  try {
    storage.setItem(metadataKey, JSON.stringify(updated));
  } catch {
    return {
      status: 'metadata_write_failed',
      metadata: previous,
      storage: deletion,
    };
  }

  return {
    status: 'deleted',
    metadata: updated,
    storage: deletion,
  };
};

export const profileDeletionNotice = (
  result: ProfileDeletionTransactionResult,
): string | null => {
  if (result.status === 'last_profile') return 'Cannot delete the last profile';
  if (result.status === 'metadata_write_failed') {
    return 'Profile deletion could not be saved. Your profile list is unchanged.';
  }
  if (result.storage.failed.length === 0) return null;
  const count = result.storage.failed.length;
  const noun = count === 1 ? 'entry' : 'entries';
  return 'Profile deleted, but ' + count + ' local storage ' + noun + ' could not be removed';
};
