import { writerLeaseKey } from './profileWriterLease';
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
    writerLeaseKey(storageKey),
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

export interface ProfileMetadataCell {
  current: ProfileMetadata;
}

export type ProfileMetadataUpdate = (previous: ProfileMetadata) => ProfileMetadata;

export type ProfileMetadataCommitResult =
  | { ok: true; metadata: ProfileMetadata }
  | { ok: false; metadata: ProfileMetadata };

export const commitProfileMetadata = (
  storage: Pick<Storage, 'setItem'>,
  metadataKey: string,
  current: ProfileMetadataCell,
  update: ProfileMetadataUpdate,
): ProfileMetadataCommitResult => {
  const previous = current.current;
  const updated = update(previous);
  const next: ProfileMetadata = {
    ...updated,
    version: previous.version,
    revision: previous.revision + 1,
  };
  try {
    storage.setItem(metadataKey, JSON.stringify(next));
  } catch {
    return { ok: false, metadata: previous };
  }
  current.current = next;
  return { ok: true, metadata: next };
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
  storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>,
  metadataKey: string,
  current: ProfileMetadataCell,
  profileId: string,
): ProfileDeletionTransactionResult => {
  const previous = current.current;
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
  const updated: ProfileMetadata = {
    version: previous.version,
    revision: previous.revision,
    profiles,
    activeProfileId,
  };
  const snapshots = new Map<string, string>();
  for (const key of profileOwnedKeys(profileId)) {
    const value = storage.getItem(key);
    if (value !== null) snapshots.set(key, value);
  }
  const deletion = deleteProfileStorage(storage, profileId);
  const commit = commitProfileMetadata(storage, metadataKey, current, () => updated);

  if (!commit.ok) {
    const rollbackFailed: string[] = [];
    for (const key of deletion.removed) {
      const value = snapshots.get(key);
      if (value === undefined) continue;
      try {
        storage.setItem(key, value);
      } catch {
        rollbackFailed.push(key);
      }
    }
    return {
      status: 'metadata_write_failed',
      metadata: commit.metadata,
      storage: {
        removed: rollbackFailed,
        failed: deletion.failed,
      },
    };
  }

  return {
    status: 'deleted',
    metadata: commit.metadata,
    storage: deletion,
  };
};

export const profileDeletionNotice = (
  result: ProfileDeletionTransactionResult,
): string | null => {
  if (result.status === 'last_profile') return 'Cannot delete the last profile';
  if (result.status === 'metadata_write_failed') {
    const residual = result.storage.removed;
    if (residual.length === 0) {
      return 'Profile deletion could not be saved. Your profile list is unchanged.';
    }
    return 'Profile deletion could not be saved. Your profile list is unchanged, but this profile data could not be restored: '
      + residual.join(', ')
      + '.';
  }
  if (result.storage.failed.length === 0) return null;
  const count = result.storage.failed.length;
  const noun = count === 1 ? 'entry' : 'entries';
  return 'Profile deleted, but ' + count + ' local storage ' + noun + ' could not be removed';
};
