import { writerLeaseKey } from './profileWriterLease';
import {
  profileCorruptArchiveKey,
  profileMirrorMetadataKey,
} from './storageRecovery';
import { checksumSave } from './saveIntegrity';
import { MAX_SAVE_BYTES } from './saveSchema';

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

export interface CorruptSaveEvidence {
  primary: string | null;
  mirrorMetadata: string | null;
}

export interface CorruptSaveArchive {
  version: 1;
  capturedAt: number;
  primary: string | null;
  mirrorMetadata: string | null;
  primaryHash?: string;
  primaryBytes?: number;
  mirrorMetadataHash?: string;
  mirrorMetadataBytes?: number;
}

export interface CorruptSaveArchiveOptions {
  now?: () => number;
  checksum?: (data: string) => Promise<string>;
  maxBytes?: number;
}

export type CorruptSaveArchiveResult =
  | { ok: true }
  | { ok: false; message: string };

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const boundedEvidence = async (
  value: string | null,
  maxBytes: number,
  checksum: (data: string) => Promise<string>,
): Promise<{ value: string | null; hash?: string; bytes?: number }> => {
  if (value === null) return { value: null };
  const bytes = byteLength(value);
  if (bytes <= maxBytes) return { value };
  return {
    value: null,
    hash: await checksum(value),
    bytes,
  };
};

/**
 * Build a bounded diagnostic record without exposing corrupt save bytes in
 * UI/error paths. Oversized values remain identifiable by exact byte length
 * and SHA-256, while values inside the existing save bound stay exportable.
 */
export const buildCorruptSaveArchive = async (
  evidence: CorruptSaveEvidence,
  options: CorruptSaveArchiveOptions = {},
): Promise<CorruptSaveArchive> => {
  const maxBytes = options.maxBytes ?? MAX_SAVE_BYTES;
  const checksum = options.checksum ?? checksumSave;
  const [primary, mirrorMetadata] = await Promise.all([
    boundedEvidence(evidence.primary, maxBytes, checksum),
    boundedEvidence(evidence.mirrorMetadata, maxBytes, checksum),
  ]);
  return {
    version: 1,
    capturedAt: options.now?.() ?? Date.now(),
    primary: primary.value,
    mirrorMetadata: mirrorMetadata.value,
    ...(primary.hash ? { primaryHash: primary.hash, primaryBytes: primary.bytes } : {}),
    ...(mirrorMetadata.hash
      ? { mirrorMetadataHash: mirrorMetadata.hash, mirrorMetadataBytes: mirrorMetadata.bytes }
      : {}),
  };
};

/** Write and read back the bounded archive before any replacement is allowed. */
export const archiveCorruptSave = async (
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  storageKey: string,
  evidence: CorruptSaveEvidence,
  options: CorruptSaveArchiveOptions = {},
): Promise<CorruptSaveArchiveResult> => {
  try {
    const archive = await buildCorruptSaveArchive(evidence, options);
    const serialized = JSON.stringify(archive);
    const key = profileCorruptArchiveKey(storageKey);
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) {
      return { ok: false, message: 'Corrupt save evidence could not be archived.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Corrupt save evidence could not be archived.' };
  }
};

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
    profileMirrorMetadataKey(storageKey),
    profileCorruptArchiveKey(storageKey),
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
