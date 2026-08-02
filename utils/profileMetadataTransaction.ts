import type { ProfileMetadata } from '../types';
import {
  PROFILE_METADATA_BACKUP_KEY,
  PROFILE_METADATA_LOCK_KEY,
  PROFILES_KEY,
  type GameSaveValidator,
  type ProfileRecoveryNotice,
} from './profileMetadata';

export { PROFILE_METADATA_LOCK_KEY };

export const PROFILE_METADATA_LOCK_VERSION = 1 as const;
export const PROFILE_METADATA_LOCK_TTL_MS = 2_000;
export const PROFILE_METADATA_LOCK_ARBITRATION_MS = 25;
export const PROFILE_METADATA_LOCK_RETRY_MS = 25;
export const PROFILE_METADATA_LOCK_TIMEOUT_MS = 1_500;

export interface ProfileMetadataLockV1 {
  version: 1;
  ownerId: string;
  expiresAt: number;
}

export interface ProfileTransactionDependencies {
  storage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
  ownerId: string;
  now: () => number;
  wait: (milliseconds: number) => Promise<void>;
  validateGameSave: GameSaveValidator;
  createProfileId: () => string;
}

export type ProfileMutationFailure =
  | 'busy'
  | 'storage_unavailable'
  | 'unsupported_metadata'
  | 'invalid_metadata'
  | 'backup_failed'
  | 'verification_failed'
  | 'max_profiles'
  | 'not_found'
  | 'last_profile'
  | 'profile_in_use';

export type ProfileLockResult =
  | { status: 'acquired'; lock: ProfileMetadataLockV1 }
  | { status: 'busy'; lock: null }
  | { status: 'storage_unavailable'; lock: null };

export type ProfileLockReleaseResult = 'released' | 'not_owner' | 'storage_unavailable';

export type ProfileTransactionResult =
  | { ok: true; metadata: ProfileMetadata; notice: ProfileRecoveryNotice | null }
  | {
    ok: false;
    reason: ProfileMutationFailure;
    metadata: ProfileMetadata | null;
    notice: ProfileRecoveryNotice | null;
  };

type LockReadResult =
  | { ok: true; lock: ProfileMetadataLockV1 | null }
  | { ok: false; lock: null };

const parseProfileMetadataLock = (raw: string | null): ProfileMetadataLockV1 | null => {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const keys = Object.keys(parsed);
    if (
      keys.length !== 3
      || !keys.includes('version')
      || !keys.includes('ownerId')
      || !keys.includes('expiresAt')
    ) return null;
    const record = parsed as Record<string, unknown>;
    if (
      record.version !== PROFILE_METADATA_LOCK_VERSION
      || typeof record.ownerId !== 'string'
      || record.ownerId.length === 0
      || typeof record.expiresAt !== 'number'
      || !Number.isSafeInteger(record.expiresAt)
      || record.expiresAt <= 0
    ) return null;
    return {
      version: PROFILE_METADATA_LOCK_VERSION,
      ownerId: record.ownerId,
      expiresAt: record.expiresAt,
    };
  } catch {
    return null;
  }
};

const readLock = (deps: ProfileTransactionDependencies): LockReadResult => {
  try {
    return { ok: true, lock: parseProfileMetadataLock(deps.storage.getItem(PROFILE_METADATA_LOCK_KEY)) };
  } catch {
    return { ok: false, lock: null };
  }
};

const isUnexpiredForeignLock = (
  lock: ProfileMetadataLockV1 | null,
  deps: ProfileTransactionDependencies,
): boolean => lock !== null && lock.ownerId !== deps.ownerId && lock.expiresAt > deps.now();

const isOwnedAndUnexpired = (
  lock: ProfileMetadataLockV1 | null,
  deps: ProfileTransactionDependencies,
): lock is ProfileMetadataLockV1 =>
  lock !== null && lock.ownerId === deps.ownerId && lock.expiresAt > deps.now();

const waitForRetry = async (
  deps: ProfileTransactionDependencies,
  deadline: number,
): Promise<boolean> => {
  if (deps.now() >= deadline) return false;
  await deps.wait(PROFILE_METADATA_LOCK_RETRY_MS);
  return deps.now() < deadline;
};

export const acquireProfileMetadataLock = async (
  deps: ProfileTransactionDependencies,
): Promise<ProfileLockResult> => {
  const deadline = deps.now() + PROFILE_METADATA_LOCK_TIMEOUT_MS;

  while (deps.now() < deadline) {
    const observed = readLock(deps);
    if (!observed.ok) return { status: 'storage_unavailable', lock: null };
    if (isUnexpiredForeignLock(observed.lock, deps)) {
      if (!await waitForRetry(deps, deadline)) break;
      continue;
    }

    const immediate = readLock(deps);
    if (!immediate.ok) return { status: 'storage_unavailable', lock: null };
    if (isUnexpiredForeignLock(immediate.lock, deps)) {
      if (!await waitForRetry(deps, deadline)) break;
      continue;
    }

    const claim: ProfileMetadataLockV1 = {
      version: PROFILE_METADATA_LOCK_VERSION,
      ownerId: deps.ownerId,
      expiresAt: deps.now() + PROFILE_METADATA_LOCK_TTL_MS,
    };
    try {
      deps.storage.setItem(PROFILE_METADATA_LOCK_KEY, JSON.stringify(claim));
    } catch {
      return { status: 'storage_unavailable', lock: null };
    }

    const readback = readLock(deps);
    if (!readback.ok) return { status: 'storage_unavailable', lock: null };
    if (!isOwnedAndUnexpired(readback.lock, deps)) {
      if (!await waitForRetry(deps, deadline)) break;
      continue;
    }

    await deps.wait(PROFILE_METADATA_LOCK_ARBITRATION_MS);
    const arbitrated = readLock(deps);
    if (!arbitrated.ok) return { status: 'storage_unavailable', lock: null };
    if (isOwnedAndUnexpired(arbitrated.lock, deps)) {
      return { status: 'acquired', lock: arbitrated.lock };
    }
  }

  return { status: 'busy', lock: null };
};

export const releaseProfileMetadataLock = (
  deps: ProfileTransactionDependencies,
): ProfileLockReleaseResult => {
  const current = readLock(deps);
  if (!current.ok) return 'storage_unavailable';
  if (current.lock?.ownerId !== deps.ownerId) return 'not_owner';

  try {
    deps.storage.removeItem(PROFILE_METADATA_LOCK_KEY);
    return 'released';
  } catch {
    return 'storage_unavailable';
  }
};

const commitFailure = (
  reason: ProfileMutationFailure,
  previous: ProfileMetadata,
): ProfileTransactionResult => ({
  ok: false,
  reason,
  metadata: previous,
  notice: null,
});

export const commitProfileMetadataCandidate = (
  deps: ProfileTransactionDependencies,
  previous: ProfileMetadata,
  candidate: ProfileMetadata,
): ProfileTransactionResult => {
  if (
    !Number.isSafeInteger(previous.revision)
    || candidate.revision !== previous.revision + 1
    || !Number.isSafeInteger(candidate.revision)
  ) return commitFailure('invalid_metadata', previous);

  let serializedPrevious: string;
  let serializedCandidate: string;
  try {
    serializedPrevious = JSON.stringify(previous);
    serializedCandidate = JSON.stringify(candidate);
  } catch {
    return commitFailure('invalid_metadata', previous);
  }

  const lock = readLock(deps);
  if (!lock.ok) return commitFailure('storage_unavailable', previous);
  if (!isOwnedAndUnexpired(lock.lock, deps)) return commitFailure('busy', previous);

  try {
    deps.storage.setItem(PROFILE_METADATA_BACKUP_KEY, serializedPrevious);
    if (deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY) !== serializedPrevious) {
      return commitFailure('backup_failed', previous);
    }
  } catch {
    return commitFailure('backup_failed', previous);
  }

  try {
    deps.storage.setItem(PROFILES_KEY, serializedCandidate);
    if (deps.storage.getItem(PROFILES_KEY) !== serializedCandidate) {
      return commitFailure('verification_failed', previous);
    }
  } catch {
    return commitFailure('verification_failed', previous);
  }

  return { ok: true, metadata: candidate, notice: null };
};
