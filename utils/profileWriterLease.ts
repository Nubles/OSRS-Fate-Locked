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

const writeWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
): WriterLeaseOwnershipResult | null => {
  try {
    storage.setItem(writerLeaseKey(storageKey), JSON.stringify({
      version: WRITER_LEASE_VERSION,
      ownerId,
      expiresAt: now + WRITER_LEASE_TTL_MS,
    }));
  } catch {
    return { status: 'unavailable', lease: null };
  }

  return null;
};

export const claimWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
  force = false,
): WriterLeaseOwnershipResult => {
  const current = readWriterLease(storage, storageKey);
  if (!current.ok) return { status: 'unavailable', lease: null };
  if (
    !force
    && current.lease !== null
    && current.lease.ownerId !== ownerId
    && current.lease.expiresAt > now
  ) return { status: 'blocked', lease: current.lease };

  const writeFailure = writeWriterLease(storage, storageKey, ownerId, now);
  if (writeFailure !== null) return writeFailure;

  const readback = readWriterLease(storage, storageKey);
  if (!readback.ok) return { status: 'unavailable', lease: null };
  if (readback.lease?.ownerId === ownerId) return { status: 'owned', lease: readback.lease };
  return { status: 'blocked', lease: readback.lease };
};

export const verifyWriterLease = (
  storage: WriterLeaseStorage,
  storageKey: string,
  ownerId: string,
  now: number,
): WriterLeaseOwnershipResult => {
  const current = readWriterLease(storage, storageKey);
  if (!current.ok) return { status: 'unavailable', lease: null };
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
  const current = readWriterLease(storage, storageKey);
  if (!current.ok) return { status: 'unavailable', lease: null };
  if (current.lease !== null && current.lease.ownerId !== ownerId && current.lease.expiresAt > now) {
    return { status: 'blocked', lease: current.lease };
  }

  const writeFailure = writeWriterLease(storage, storageKey, ownerId, now);
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
