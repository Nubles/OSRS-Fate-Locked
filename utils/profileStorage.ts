import { writerLeaseKey } from './profileWriterLease';

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
