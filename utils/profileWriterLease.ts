import {
  parseProfileMetadata,
  PROFILE_METADATA_BACKUP_KEY,
  PROFILES_KEY,
} from './profileMetadata';

export const WRITER_LEASE_VERSION = 1 as const;
export const WRITER_LEASE_TTL_MS = 30_000;
export const WRITER_LEASE_RENEW_MS = 10_000;
export const WRITER_LEASE_ARBITRATION_MS = 50;

export type SaveOwnershipStatus = 'checking' | 'owner' | 'blocked';
export type SaveOwnershipBlockReason = 'foreign_owner' | 'storage_unavailable' | null;
export type SaveWriteAuthorizationReason = 'ownership_conflict' | 'storage_unavailable';
export type SaveWriteAuthorization =
  | { ok: true }
  | { ok: false; reason: SaveWriteAuthorizationReason };
export type ProfileWriterLease = {
  version: typeof WRITER_LEASE_VERSION;
  ownerId: string;
  expiresAt: number;
  purpose?: 'profile_delete';
  deletionId?: string;
};
export type WriterLeaseStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type WriterLeaseReadResult =
  | { ok: true; lease: ProfileWriterLease | null }
  | { ok: false; lease: null };
export type WriterLeaseOwnershipResult =
  | { status: 'owned'; lease: ProfileWriterLease }
  | { status: 'blocked'; lease: ProfileWriterLease | null }
  | { status: 'unavailable'; lease: null };
export type WriterLeaseReleaseResult = 'released' | 'not_owner' | 'unavailable';

export const writerLeaseKey = (storageKey: string): string => `${storageKey}__writer`;

const SAFE_ID = /^[A-Za-z0-9-]{1,128}$/;

const parseWriterLease = (value: string | null): ProfileWriterLease | null => {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object'
      || parsed === null
      || Array.isArray(parsed)
      || !('version' in parsed)
      || !('ownerId' in parsed)
      || !('expiresAt' in parsed)
      || parsed.version !== WRITER_LEASE_VERSION
      || typeof parsed.ownerId !== 'string'
      || parsed.ownerId.length === 0
      || typeof parsed.expiresAt !== 'number'
      || !Number.isFinite(parsed.expiresAt)
      || parsed.expiresAt <= 0
      || ('purpose' in parsed
        ? parsed.purpose !== 'profile_delete'
          || !('deletionId' in parsed)
          || typeof parsed.deletionId !== 'string'
          || !SAFE_ID.test(parsed.deletionId)
        : 'deletionId' in parsed)
    ) return null;
    return parsed as ProfileWriterLease;
  } catch {
    return null;
  }
};

export const readWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
): WriterLeaseReadResult => {
  try {
    return { ok: true, lease: parseWriterLease(storage.getItem(writerLeaseKey(storageKey))) };
  } catch {
    return { ok: false, lease: null };
  }
};

const profileIdForStorageKey = (storageKey: string): string | null => {
  const prefix = 'FATE_PROFILE_';
  if (!storageKey.startsWith(prefix)) return null;
  const profileId = storageKey.slice(prefix.length);
  return SAFE_ID.test(profileId) ? profileId : null;
};

type ProfileMetadataWriteProtection =
  | { ok: false }
  | { ok: true; status: 'read_only' }
  | { ok: true; status: 'writable'; deletionId: string | null };

const profileMetadataWriteProtection = (
  storage: WriterLeaseStorage,
  storageKey: string,
): ProfileMetadataWriteProtection => {
  const profileId = profileIdForStorageKey(storageKey);
  if (profileId === null) return { ok: true, status: 'writable', deletionId: null };
  let primaryRaw: string | null;
  let backupRaw: string | null;
  try {
    primaryRaw = storage.getItem(PROFILES_KEY);
    backupRaw = storage.getItem(PROFILE_METADATA_BACKUP_KEY);
  } catch {
    return { ok: false };
  }
  const copies = [parseProfileMetadata(primaryRaw), parseProfileMetadata(backupRaw)];
  if (copies.some(copy => copy.status === 'unsupported')) {
    return { ok: true, status: 'read_only' };
  }

  const deletionIds = new Set<string>();
  for (const copy of copies) {
    if (copy.status !== 'current' && copy.status !== 'legacy') continue;
    const deletionId = copy.metadata.deletions.find(
      intent => intent.profileId === profileId,
    )?.deletionId;
    if (deletionId !== undefined) deletionIds.add(deletionId);
  }
  if (deletionIds.size > 1) return { ok: true, status: 'read_only' };
  return {
    ok: true,
    status: 'writable',
    deletionId: deletionIds.values().next().value ?? null,
  };
};

const writeWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
  purpose?: ProfileWriterLease['purpose'],
  deletionId?: string,
): WriterLeaseOwnershipResult | null => {
  try {
    storage.setItem(writerLeaseKey(storageKey), JSON.stringify({
      version: WRITER_LEASE_VERSION,
      ownerId,
      expiresAt: now + WRITER_LEASE_TTL_MS,
      ...(purpose === undefined ? {} : { purpose, deletionId }),
    }));
  } catch {
    return { status: 'unavailable', lease: null };
  }
  return null;
};

const claimWriterLeaseWithPurpose = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
  force: boolean,
  purpose?: ProfileWriterLease['purpose'],
  deletionId?: string,
): WriterLeaseOwnershipResult => {
  const protection = profileMetadataWriteProtection(storage, storageKey);
  if (!protection.ok) return { status: 'unavailable', lease: null };
  const current = readWriterLease(storage, storageKey);
  if (!current.ok) return { status: 'unavailable', lease: null };
  if (protection.status === 'read_only') return { status: 'blocked', lease: current.lease };
  if (purpose === undefined && protection.deletionId !== null) {
    return { status: 'blocked', lease: current.lease };
  }
  if (purpose === 'profile_delete'
    && protection.deletionId !== null
    && protection.deletionId !== deletionId) {
    return { status: 'blocked', lease: current.lease };
  }

  const sameClaim = current.lease?.ownerId === ownerId
    && current.lease.purpose === purpose
    && current.lease.deletionId === deletionId;
  if (
    current.lease !== null
    && current.lease.expiresAt > now
    && !sameClaim
    && (!force || purpose === 'profile_delete' || current.lease.purpose === 'profile_delete')
  ) return { status: 'blocked', lease: current.lease };

  const writeFailure = writeWriterLease(
    storage,
    storageKey,
    ownerId,
    now,
    purpose,
    deletionId,
  );
  if (writeFailure !== null) return writeFailure;

  const readback = readWriterLease(storage, storageKey);
  if (!readback.ok) return { status: 'unavailable', lease: null };
  if (
    readback.lease?.ownerId === ownerId
    && readback.lease.purpose === purpose
    && readback.lease.deletionId === deletionId
  ) return { status: 'owned', lease: readback.lease };
  return { status: 'blocked', lease: readback.lease };
};

export const claimWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
  force = false,
): WriterLeaseOwnershipResult => claimWriterLeaseWithPurpose(
  storage,
  storageKey,
  ownerId,
  now,
  force,
);

export const claimProfileDeletionLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
  deletionId: string,
): WriterLeaseOwnershipResult => claimWriterLeaseWithPurpose(
  storage,
  storageKey,
  ownerId,
  now,
  false,
  'profile_delete',
  deletionId,
);

export const verifyWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
): WriterLeaseOwnershipResult => {
  const protection = profileMetadataWriteProtection(storage, storageKey);
  if (!protection.ok) return { status: 'unavailable', lease: null };
  const current = readWriterLease(storage, storageKey);
  if (!current.ok) return { status: 'unavailable', lease: null };
  if (protection.status === 'read_only') return { status: 'blocked', lease: current.lease };
  if (
    current.lease !== null
    && (current.lease.purpose === 'profile_delete'
      ? protection.deletionId !== current.lease.deletionId
      : protection.deletionId !== null)
  ) return { status: 'blocked', lease: current.lease };
  if (current.lease?.ownerId === ownerId && current.lease.expiresAt > now) {
    return { status: 'owned', lease: current.lease };
  }
  return { status: 'blocked', lease: current.lease };
};

export const renewWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
): WriterLeaseOwnershipResult => {
  const protection = profileMetadataWriteProtection(storage, storageKey);
  if (!protection.ok) return { status: 'unavailable', lease: null };
  const current = readWriterLease(storage, storageKey);
  if (!current.ok) return { status: 'unavailable', lease: null };
  if (protection.status === 'read_only') return { status: 'blocked', lease: current.lease };
  if (
    current.lease !== null
    && (current.lease.purpose === 'profile_delete'
      ? protection.deletionId !== current.lease.deletionId
      : protection.deletionId !== null)
  ) return { status: 'blocked', lease: current.lease };
  if (current.lease !== null && current.lease.ownerId !== ownerId && current.lease.expiresAt > now) {
    return { status: 'blocked', lease: current.lease };
  }

  const writeFailure = writeWriterLease(
    storage,
    storageKey,
    ownerId,
    now,
    current.lease?.purpose,
    current.lease?.deletionId,
  );
  if (writeFailure !== null) return writeFailure;
  return verifyWriterLease(storage, storageKey, ownerId, now);
};

export const releaseWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
): WriterLeaseReleaseResult => {
  const current = readWriterLease(storage, storageKey);
  if (!current.ok) return 'unavailable';
  if (current.lease?.ownerId !== ownerId) return 'not_owner';

  try {
    storage.removeItem(writerLeaseKey(storageKey));
    return 'released';
  } catch {
    return 'unavailable';
  }
};
