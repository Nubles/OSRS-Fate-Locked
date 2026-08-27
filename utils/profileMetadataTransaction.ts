import type { Profile, ProfileDeletionIntentV1, ProfileMetadata } from '../types';
import {
  PROFILE_METADATA_BACKUP_KEY,
  LEGACY_SAVE_KEY,
  MAX_PROFILES,
  PROFILE_METADATA_RECOVERY_KEY,
  PROFILE_METADATA_LOCK_KEY,
  PROFILES_KEY,
  type GameSaveValidator,
  parseProfileMetadata,
  resolveProfileMetadata,
  type ProfileMetadataResolution,
  type ProfileRecoveryEnvelopeV1,
  type ProfileRecoveryNotice,
} from './profileMetadata';
import { deleteProfileStorage, profileBaseKey, profileOwnedKeys } from './profileStorage';
import {
  claimProfileDeletionLease,
  readWriterLease,
  releaseWriterLease,
  verifyWriterLease,
  writerLeaseKey,
} from './profileWriterLease';
import type {
  ProfileDeletionCleanupResult,
  RecoveryRepository,
} from './recoveryTypes';
import type { SaveWriteAuthorization } from './profileWriterLease';

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
  createDeletionId?: () => string;
  shouldAbort?: () => boolean;
  openRecoveryRepository?: () => Promise<RecoveryRepository>;
}
export type ProfileMutation =
  | { type: 'create'; profile: Profile }
  | { type: 'rename'; profileId: string; name: string }
  | { type: 'select'; profileId: string }
  | { type: 'delete'; profileId: string };


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

export type ProfileDeleteDetails = {
  removedEntries: number;
  removalFailures: number;
  rollbackFailures: number;
  cleanupPending: boolean;
  deletionId: string | null;
};

type LegacyProfileDeleteDetails = Pick<
  ProfileDeleteDetails,
  'removedEntries' | 'removalFailures' | 'rollbackFailures'
>;

export type ProfileTransactionResult =
  | { ok: true; metadata: ProfileMetadata; notice: ProfileRecoveryNotice | null; deleteDetails?: ProfileDeleteDetails | LegacyProfileDeleteDetails }
  | {
    ok: false;
    reason: ProfileMutationFailure;
    metadata: ProfileMetadata | null;
    notice: ProfileRecoveryNotice | null;
    deleteDetails?: ProfileDeleteDetails | LegacyProfileDeleteDetails;
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

export const profileMetadataLockRetryDelay = (
  deps: ProfileTransactionDependencies,
): number => {
  const observed = readLock(deps);
  if (!observed.ok || observed.lock === null) return 0;
  const remaining = observed.lock.expiresAt - deps.now();
  return Math.max(0, Math.min(PROFILE_METADATA_LOCK_TTL_MS, remaining));
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
    if (deps.now() + PROFILE_METADATA_LOCK_ARBITRATION_MS >= deadline) break;

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
    if (deps.now() >= deadline) break;
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

const transactionAborted = (
  deps: ProfileTransactionDependencies,
): boolean => deps.shouldAbort?.() === true;

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
  if (transactionAborted(deps)) return commitFailure('busy', previous);

  try {
    deps.storage.setItem(PROFILE_METADATA_BACKUP_KEY, serializedPrevious);
    if (deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY) !== serializedPrevious) {
      return commitFailure('backup_failed', previous);
    }
  } catch {
    return commitFailure('backup_failed', previous);
  }

  const primaryLock = readLock(deps);
  if (!primaryLock.ok) return commitFailure('storage_unavailable', previous);
  if (!isOwnedAndUnexpired(primaryLock.lock, deps)) return commitFailure('busy', previous);
  if (transactionAborted(deps)) return commitFailure('busy', previous);

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

type WritableProfileMetadataResolution = Exclude<ProfileMetadataResolution, { mode: 'read_only' }>;

type ResolvedProfileMetadataSources = {
  ok: true;
  primary: string | null;
  backup: string | null;
  capturedAt: number;
  resolution: ProfileMetadataResolution;
} | { ok: false };

type ProfileMutationPlan =
  | { status: 'candidate'; candidate: ProfileMetadata }
  | { status: 'unchanged' }
  | { status: 'failure'; reason: ProfileMutationFailure };

type RecoveryEnvelopeResult =
  | 'verified'
  | Extract<ProfileMutationFailure, 'busy' | 'storage_unavailable' | 'backup_failed'>;

const transactionFailure = (
  reason: ProfileMutationFailure,
  metadata: ProfileMetadata | null,
  notice: ProfileRecoveryNotice | null,
  deleteDetails?: ProfileDeleteDetails,
): ProfileTransactionResult => ({
  ok: false,
  reason,
  metadata,
  notice,
  ...(deleteDetails === undefined ? {} : { deleteDetails }),
});

const readOnlyNotice = (notice: ProfileRecoveryNotice | null): ProfileRecoveryNotice => ({
  kind: 'read_only',
  recoveredProfiles: notice?.recoveredProfiles ?? 0,
  generatedNames: notice?.generatedNames ?? 0,
  unreadableSaves: notice?.unreadableSaves ?? 0,
  overflowSaves: notice?.overflowSaves ?? 0,
  rollbackFailures: notice?.rollbackFailures ?? 0,
});

const currentMetadataAuthorityFailure = (
  deps: ProfileTransactionDependencies,
): Extract<ProfileMutationFailure, 'busy' | 'storage_unavailable'> | null => {
  const current = readLock(deps);
  if (!current.ok) return 'storage_unavailable';
  if (!isOwnedAndUnexpired(current.lock, deps)) return 'busy';
  return null;
};

const currentOwnershipFailure = (
  deps: ProfileTransactionDependencies,
): Extract<ProfileMutationFailure, 'busy' | 'storage_unavailable'> | null => {
  if (transactionAborted(deps)) return 'busy';
  const authorityFailure = currentMetadataAuthorityFailure(deps);
  if (authorityFailure !== null) return authorityFailure;
  return transactionAborted(deps) ? 'busy' : null;
};

const noWriteSuccess = (
  deps: ProfileTransactionDependencies,
  metadata: ProfileMetadata,
  notice: ProfileRecoveryNotice | null,
): ProfileTransactionResult => {
  if (transactionAborted(deps)) return transactionFailure('busy', metadata, notice);
  const ownershipFailure = currentOwnershipFailure(deps);
  return ownershipFailure === null
    ? { ok: true, metadata, notice }
    : transactionFailure(ownershipFailure, metadata, notice);
};

const withRecoveryNotice = (
  result: ProfileTransactionResult,
  notice: ProfileRecoveryNotice | null,
): ProfileTransactionResult => {
  if ('reason' in result) {
    return {
      ok: false,
      reason: result.reason,
      metadata: result.metadata,
      notice,
      ...(result.deleteDetails === undefined ? {} : { deleteDetails: result.deleteDetails }),
    };
  }
  return {
    ok: true,
    metadata: result.metadata,
    notice,
    ...(result.deleteDetails === undefined ? {} : { deleteDetails: result.deleteDetails }),
  };
};

const readNewestProfileMetadata = (
  deps: ProfileTransactionDependencies,
): ResolvedProfileMetadataSources => {
  try {
    const primary = deps.storage.getItem(PROFILES_KEY);
    const backup = deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY);
    const legacySave = deps.storage.getItem(LEGACY_SAVE_KEY);
    const capturedAt = deps.now();
    return {
      ok: true,
      primary,
      backup,
      capturedAt,
      resolution: resolveProfileMetadata({
        primary,
        backup,
        legacySave,
        storage: deps.storage,
        now: capturedAt,
        validateGameSave: deps.validateGameSave,
        createProfileId: deps.createProfileId,
      }),
    };
  } catch {
    return { ok: false };
  }
};

const verifyRecoveryEnvelope = (
  deps: ProfileTransactionDependencies,
  envelope: ProfileRecoveryEnvelopeV1,
): RecoveryEnvelopeResult => {
  try {
    const serialized = JSON.stringify(envelope);
    const ownershipFailure = currentOwnershipFailure(deps);
    if (ownershipFailure !== null) return ownershipFailure;
    if (transactionAborted(deps)) return 'busy';
    deps.storage.setItem(PROFILE_METADATA_RECOVERY_KEY, serialized);
    return deps.storage.getItem(PROFILE_METADATA_RECOVERY_KEY) === serialized
      ? 'verified'
      : 'backup_failed';
  } catch {
    return 'backup_failed';
  }
};

const runWithLockedProfileMetadata = async (
  deps: ProfileTransactionDependencies,
  operation: (
    resolution: WritableProfileMetadataResolution,
  ) => ProfileTransactionResult | Promise<ProfileTransactionResult>,
): Promise<ProfileTransactionResult> => {
  const lock = await acquireProfileMetadataLock(deps);
  if (lock.status !== 'acquired') {
    return transactionFailure(lock.status, null, null);
  }

  try {
    if (transactionAborted(deps)) {
      return transactionFailure('busy', null, null);
    }
    const sources = readNewestProfileMetadata(deps);
    if (!sources.ok) return transactionFailure('storage_unavailable', null, null);
    if (transactionAborted(deps)) {
      return transactionFailure('busy', sources.resolution.metadata, sources.resolution.notice);
    }

    const { resolution } = sources;
    const archive = resolution.mode === 'read_only'
      ? {
        version: 1 as const,
        capturedAt: sources.capturedAt,
        primary: sources.primary,
        backup: sources.backup,
      }
      : resolution.repair?.archive ?? null;

    const archiveResult = archive === null ? 'verified' : verifyRecoveryEnvelope(deps, archive);
    if (archiveResult !== 'verified') {
      return transactionFailure(
        archiveResult,
        resolution.metadata,
        archiveResult === 'backup_failed'
          ? readOnlyNotice(resolution.notice)
          : resolution.notice,
      );
    }

    if (resolution.mode === 'read_only') {
      return transactionFailure(
        'unsupported_metadata',
        resolution.metadata,
        resolution.notice,
      );
    }
    if (transactionAborted(deps)) {
      return transactionFailure('busy', resolution.metadata, resolution.notice);
    }

    try {
      return await operation(resolution);
    } catch {
      return transactionFailure('invalid_metadata', resolution.metadata, resolution.notice);
    }
  } finally {
    releaseProfileMetadataLock(deps);
  }
};

const executeLegacyCopy = (
  deps: ProfileTransactionDependencies,
  resolution: WritableProfileMetadataResolution,
): ProfileMutationFailure | null => {
  const copy = resolution.repair?.legacyCopy;
  if (copy === null || copy === undefined) return null;

  try {
    const latest = deps.storage.getItem(copy.fromKey);
    if (latest === null || !deps.validateGameSave(latest)) return 'verification_failed';
    if (transactionAborted(deps)) return 'busy';
    const ownershipFailure = currentOwnershipFailure(deps);
    if (ownershipFailure !== null) return ownershipFailure;
    const targetKey = `FATE_PROFILE_${copy.toProfileId}`;
    if (transactionAborted(deps)) return 'busy';
    deps.storage.setItem(targetKey, latest);
    return deps.storage.getItem(targetKey) === latest ? null : 'verification_failed';
  } catch {
    return 'verification_failed';
  }
};

const validateCandidate = (candidate: ProfileMetadata): ProfileMetadata | null => {
  try {
    const parsed = parseProfileMetadata(JSON.stringify(candidate));
    return parsed.status === 'current' ? parsed.metadata : null;
  } catch {
    return null;
  }
};

const commitCandidate = (
  deps: ProfileTransactionDependencies,
  previous: ProfileMetadata,
  candidate: ProfileMetadata,
  notice: ProfileRecoveryNotice | null,
): ProfileTransactionResult => withRecoveryNotice(
  commitProfileMetadataCandidate(deps, previous, candidate),
  notice,
);

const repairCandidate = (metadata: ProfileMetadata): ProfileMetadata => ({
  ...metadata,
  revision: metadata.revision + 1,
});

export const initializeProfileMetadata = (
  deps: ProfileTransactionDependencies,
): Promise<ProfileTransactionResult> => runWithLockedProfileMetadata(deps, resolution => {
  if (resolution.mode === 'durable') {
    return noWriteSuccess(deps, resolution.metadata, resolution.notice);
  }

  const candidate = validateCandidate(repairCandidate(resolution.metadata));
  if (candidate === null) {
    return transactionFailure('invalid_metadata', resolution.metadata, resolution.notice);
  }

  const copyFailure = executeLegacyCopy(deps, resolution);
  if (copyFailure !== null) {
    return transactionFailure(copyFailure, resolution.metadata, resolution.notice);
  }

  return commitCandidate(
    deps,
    resolution.metadata,
    candidate,
    resolution.notice,
  );
});

const emptyDeleteDetails = (): ProfileDeleteDetails => ({
  removedEntries: 0,
  removalFailures: 0,
  rollbackFailures: 0,
  cleanupPending: false,
  deletionId: null,
});

const currentWriterLeaseFailure = (
  deps: ProfileTransactionDependencies,
  profileId: string,
): Extract<ProfileMutationFailure, 'storage_unavailable' | 'profile_in_use'> | null => {
  const writerLease = readWriterLease(deps.storage, profileBaseKey(profileId));
  if (!writerLease.ok) return 'storage_unavailable';
  return writerLease.lease !== null && writerLease.lease.expiresAt > deps.now()
    ? 'profile_in_use'
    : null;
};

const createDeletionId = (
  deps: ProfileTransactionDependencies,
  profileId: string,
): string => deps.createDeletionId?.() ?? `delete-${profileId}-${deps.now().toString(36)}`;

export const resumeProfileDeletion = async (
  intent: ProfileDeletionIntentV1,
  deps: ProfileTransactionDependencies,
): Promise<ProfileDeletionCleanupResult> => {
  let removedEntries = 0;
  let removalFailures = 0;

  const pending = (
    reason: Extract<ProfileDeletionCleanupResult, { status: 'cleanup_pending' }>['reason'],
    metadata: ProfileMetadata | null,
  ): ProfileDeletionCleanupResult => ({
    status: 'cleanup_pending',
    reason,
    metadata,
    removedEntries,
    removalFailures,
    rollbackFailures: 0,
  });
  const completed = (metadata: ProfileMetadata): ProfileDeletionCleanupResult => ({
    status: 'completed',
    metadata,
    removedEntries,
    removalFailures,
    rollbackFailures: 0,
  });

  const readIntentMetadata = (): {
    status: 'pending'; metadata: ProfileMetadata;
  } | {
    status: 'completed'; metadata: ProfileMetadata;
  } | {
    status: 'failure'; reason: 'storage_unavailable' | 'unsupported_metadata' | 'invalid_metadata'; metadata: ProfileMetadata | null;
  } => {
    const latest = readNewestProfileMetadata(deps);
    if (!latest.ok) return { status: 'failure', reason: 'storage_unavailable', metadata: null };
    if (latest.resolution.mode === 'read_only') {
      return {
        status: 'failure',
        reason: 'unsupported_metadata',
        metadata: latest.resolution.metadata,
      };
    }
    const metadata = latest.resolution.metadata;
    if (metadata.profiles.some(profile => profile.id === intent.profileId)) {
      return { status: 'failure', reason: 'invalid_metadata', metadata };
    }
    const matching = metadata.deletions.find(
      deletion => deletion.deletionId === intent.deletionId,
    );
    if (matching === undefined) return { status: 'completed', metadata };
    if (matching.profileId !== intent.profileId) {
      return { status: 'failure', reason: 'invalid_metadata', metadata };
    }
    return { status: 'pending', metadata };
  };

  const initial = readIntentMetadata();
  if (initial.status === 'completed') return completed(initial.metadata);
  if (initial.status === 'failure') return pending(initial.reason, initial.metadata);
  let currentMetadata = initial.metadata;
  if (transactionAborted(deps)) return pending('busy', currentMetadata);

  const storageKey = profileBaseKey(intent.profileId);
  const leaseOwnerId = `${deps.ownerId}:profile-delete:${intent.deletionId}`;
  const leaseClaim = claimProfileDeletionLease(
    deps.storage,
    storageKey,
    leaseOwnerId,
    deps.now(),
    intent.deletionId,
  );
  if (leaseClaim.status !== 'owned') {
    return pending(
      leaseClaim.status === 'unavailable' ? 'storage_unavailable' : 'profile_in_use',
      currentMetadata,
    );
  }

  let serializedTombstone: string;
  try {
    serializedTombstone = JSON.stringify(currentMetadata);
  } catch {
    releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
    return pending('invalid_metadata', currentMetadata);
  }
  let backupVerified = false;
  try {
    backupVerified = deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY) === serializedTombstone;
  } catch {
    releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
    return pending('storage_unavailable', currentMetadata);
  }
  if (!backupVerified) {
    const lock = await acquireProfileMetadataLock(deps);
    if (lock.status !== 'acquired') {
      releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
      return pending(lock.status, currentMetadata);
    }
    try {
      const latest = readIntentMetadata();
      if (latest.status === 'completed') {
        releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
        return completed(latest.metadata);
      }
      if (latest.status === 'failure') {
        releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
        return pending(latest.reason, latest.metadata);
      }
      currentMetadata = latest.metadata;
      serializedTombstone = JSON.stringify(currentMetadata);
      const authorityFailure = currentOwnershipFailure(deps);
      if (authorityFailure !== null) {
        releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
        return pending(authorityFailure, currentMetadata);
      }
      try {
        deps.storage.setItem(PROFILE_METADATA_BACKUP_KEY, serializedTombstone);
        if (deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY) !== serializedTombstone) {
          releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
          return pending('storage_unavailable', currentMetadata);
        }
      } catch {
        releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
        return pending('storage_unavailable', currentMetadata);
      }

      // This bounded attempt spent its single metadata-authority acquisition
      // repairing the durable tombstone backup. Stop before destructive cleanup
      // so a later worker can resume from two verified tombstone copies and use
      // its own one acquisition, if needed, only for finalization.
      releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
      return pending('busy', currentMetadata);
    } finally {
      releaseProfileMetadataLock(deps);
    }
  }

  const deletionLeaseOwned = (): SaveWriteAuthorization => {
    if (transactionAborted(deps)) return { ok: false, reason: 'ownership_conflict' };
    const lease = verifyWriterLease(deps.storage, storageKey, leaseOwnerId, deps.now());
    if (lease.status === 'unavailable') return { ok: false, reason: 'storage_unavailable' };
    if (
      lease.status !== 'owned'
      || lease.lease.purpose !== 'profile_delete'
      || lease.lease.deletionId !== intent.deletionId
    ) return { ok: false, reason: 'ownership_conflict' };
    const metadata = readIntentMetadata();
    return metadata.status === 'pending'
      ? { ok: true }
      : { ok: false, reason: metadata.status === 'failure' && metadata.reason === 'storage_unavailable'
        ? 'storage_unavailable'
        : 'ownership_conflict' };
  };

  const releaseDeletionLease = (): void => {
    const lease = readWriterLease(deps.storage, storageKey);
    if (
      lease.ok
      && lease.lease?.ownerId === leaseOwnerId
      && lease.lease.purpose === 'profile_delete'
      && lease.lease.deletionId === intent.deletionId
    ) releaseWriterLease(deps.storage, storageKey, leaseOwnerId);
  };

  try {
    if (deps.openRecoveryRepository !== undefined) {
      let repository: RecoveryRepository | null = null;
      try {
        repository = await deps.openRecoveryRepository();
        if (repository.deleteProfileData === undefined) {
          return pending('storage_unavailable', currentMetadata);
        }
        const deletion = await repository.deleteProfileData(
          intent.profileId,
          deletionLeaseOwned,
        );
        if ('reason' in deletion) {
          if (deletion.reason === 'ownership_conflict') {
            const latest = readIntentMetadata();
            if (latest.status === 'completed') return completed(latest.metadata);
            if (transactionAborted(deps)) return pending('busy', currentMetadata);
            const lease = verifyWriterLease(deps.storage, storageKey, leaseOwnerId, deps.now());
            return pending(
              lease.status === 'unavailable' ? 'storage_unavailable' : 'profile_in_use',
              latest.metadata,
            );
          }
          return pending('storage_unavailable', currentMetadata);
        }
        removedEntries += deletion.removedEntries;
      } catch {
        return pending('storage_unavailable', currentMetadata);
      } finally {
        try { repository?.close(); } catch { /* safe to close an aborted connection */ }
      }
    }

    if (transactionAborted(deps)) return pending('busy', currentMetadata);
    const leaseAuthorization = deletionLeaseOwned();
    if ('reason' in leaseAuthorization) {
      return pending(
        leaseAuthorization.reason === 'storage_unavailable'
          ? 'storage_unavailable'
          : 'profile_in_use',
        currentMetadata,
      );
    }

    const leaseKey = writerLeaseKey(storageKey);
    const localResult = deleteProfileStorage(
      deps.storage,
      intent.profileId,
      profileOwnedKeys(intent.profileId).filter(key => key !== leaseKey),
    );
    removedEntries += localResult.removed.length;
    removalFailures += localResult.failed.length;
    if (localResult.failed.length > 0) {
      return pending('storage_unavailable', currentMetadata);
    }
    if (transactionAborted(deps)) return pending('busy', currentMetadata);

    const lock = await acquireProfileMetadataLock(deps);
    if (lock.status !== 'acquired') return pending(lock.status, currentMetadata);
    try {
      const latest = readIntentMetadata();
      if (latest.status === 'completed') return completed(latest.metadata);
      if (latest.status === 'failure') return pending(latest.reason, latest.metadata);
      currentMetadata = latest.metadata;

      const candidate = validateCandidate({
        ...currentMetadata,
        revision: currentMetadata.revision + 1,
        deletions: currentMetadata.deletions.filter(
          deletion => deletion.deletionId !== intent.deletionId,
        ),
      });
      if (candidate === null) return pending('invalid_metadata', currentMetadata);
      let serializedCandidate: string;
      try {
        serializedCandidate = JSON.stringify(candidate);
      } catch {
        return pending('invalid_metadata', currentMetadata);
      }

      const authorityFailure = currentOwnershipFailure(deps);
      if (authorityFailure !== null) return pending(authorityFailure, currentMetadata);
      try {
        // Finalization writes the candidate backup first. If the primary write
        // fails, the primary tombstone remains authoritative and resumable.
        deps.storage.setItem(PROFILE_METADATA_BACKUP_KEY, serializedCandidate);
        if (deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY) !== serializedCandidate) {
          return pending('storage_unavailable', currentMetadata);
        }
      } catch {
        return pending('storage_unavailable', currentMetadata);
      }

      const primaryAuthorityFailure = currentOwnershipFailure(deps);
      if (primaryAuthorityFailure !== null) return pending(primaryAuthorityFailure, currentMetadata);
      try {
        deps.storage.setItem(PROFILES_KEY, serializedCandidate);
        if (deps.storage.getItem(PROFILES_KEY) !== serializedCandidate) {
          return pending('storage_unavailable', currentMetadata);
        }
      } catch {
        try {
          if (deps.storage.getItem(PROFILES_KEY) === serializedCandidate) return completed(candidate);
        } catch {
          // The tombstone primary remains the conservative state when unknown.
        }
        return pending('storage_unavailable', currentMetadata);
      }
      return completed(candidate);
    } finally {
      releaseProfileMetadataLock(deps);
    }
  } finally {
    releaseDeletionLease();
  }
};

const executeProfileDelete = async (
  deps: ProfileTransactionDependencies,
  resolution: WritableProfileMetadataResolution,
  profileId: string,
): Promise<ProfileTransactionResult> => {
  const previous = resolution.metadata;
  const profileIndex = previous.profiles.findIndex(profile => profile.id === profileId);
  if (profileIndex < 0) return transactionFailure('not_found', previous, resolution.notice);
  if (previous.profiles.length <= 1) {
    return transactionFailure('last_profile', previous, resolution.notice);
  }

  const initialWriterLeaseFailure = currentWriterLeaseFailure(deps, profileId);
  if (initialWriterLeaseFailure !== null) {
    return transactionFailure(initialWriterLeaseFailure, previous, resolution.notice);
  }

  const deletionId = createDeletionId(deps, profileId);
  const requestedAt = deps.now();
  const profiles = previous.profiles.filter(profile => profile.id !== profileId);
  const candidate = validateCandidate({
    ...previous,
    revision: previous.revision + 1,
    profiles,
    activeProfileId: previous.activeProfileId === profileId
      ? profiles[0].id
      : previous.activeProfileId,
    deletions: [...previous.deletions, {
      version: 1,
      deletionId,
      profileId,
      requestedAt,
      phase: 'pending_cleanup',
    }],
  });
  if (candidate === null) {
    return transactionFailure('invalid_metadata', previous, resolution.notice);
  }

  let serializedPrevious: string;
  let serializedCandidate: string;
  try {
    serializedPrevious = JSON.stringify(previous);
    serializedCandidate = JSON.stringify(candidate);
  } catch {
    return transactionFailure('invalid_metadata', previous, resolution.notice);
  }

  const beforeBackup = currentOwnershipFailure(deps);
  if (beforeBackup !== null) {
    return transactionFailure(beforeBackup, previous, resolution.notice, emptyDeleteDetails());
  }
  try {
    deps.storage.setItem(PROFILE_METADATA_BACKUP_KEY, serializedPrevious);
    if (deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY) !== serializedPrevious) {
      return transactionFailure('backup_failed', previous, resolution.notice, emptyDeleteDetails());
    }
  } catch {
    return transactionFailure('backup_failed', previous, resolution.notice, emptyDeleteDetails());
  }

  const beforeReservation = currentOwnershipFailure(deps);
  if (beforeReservation !== null) {
    return transactionFailure(beforeReservation, previous, resolution.notice, emptyDeleteDetails());
  }
  const finalWriterLeaseFailure = currentWriterLeaseFailure(deps, profileId);
  if (finalWriterLeaseFailure !== null) {
    return transactionFailure(finalWriterLeaseFailure, previous, resolution.notice, emptyDeleteDetails());
  }

  const storageKey = profileBaseKey(profileId);
  const leaseOwnerId = `${deps.ownerId}:profile-delete:${deletionId}`;
  let priorLease: string | null;
  try {
    priorLease = deps.storage.getItem(writerLeaseKey(storageKey));
  } catch {
    return transactionFailure('storage_unavailable', previous, resolution.notice, emptyDeleteDetails());
  }
  const leaseClaim = claimProfileDeletionLease(
    deps.storage,
    storageKey,
    leaseOwnerId,
    deps.now(),
    deletionId,
  );
  if (leaseClaim.status !== 'owned') {
    return transactionFailure(
      leaseClaim.status === 'unavailable' ? 'storage_unavailable' : 'profile_in_use',
      previous,
      resolution.notice,
      emptyDeleteDetails(),
    );
  }

  const restorePreCommitLease = (): number => {
    try {
      if (priorLease === null) {
        return releaseWriterLease(deps.storage, storageKey, leaseOwnerId) === 'unavailable' ? 1 : 0;
      }
      deps.storage.setItem(writerLeaseKey(storageKey), priorLease);
      return deps.storage.getItem(writerLeaseKey(storageKey)) === priorLease ? 0 : 1;
    } catch {
      return 1;
    }
  };

  const beforePrimary = currentOwnershipFailure(deps);
  if (beforePrimary !== null) {
    const rollbackFailures = restorePreCommitLease();
    return transactionFailure(beforePrimary, previous, resolution.notice, {
      ...emptyDeleteDetails(),
      rollbackFailures,
    });
  }

  let tombstoneCommitted = false;
  try {
    deps.storage.setItem(PROFILES_KEY, serializedCandidate);
    tombstoneCommitted = deps.storage.getItem(PROFILES_KEY) === serializedCandidate;
  } catch {
    try {
      tombstoneCommitted = deps.storage.getItem(PROFILES_KEY) === serializedCandidate;
    } catch {
      tombstoneCommitted = false;
    }
  }
  if (!tombstoneCommitted) {
    const rollbackFailures = restorePreCommitLease();
    return transactionFailure('verification_failed', previous, resolution.notice, {
      ...emptyDeleteDetails(),
      rollbackFailures,
    });
  }

  // The verified primary tombstone is the point of no return. A failed backup
  // refresh or cleanup attempt leaves the visible tombstone in place.
  try {
    deps.storage.setItem(PROFILE_METADATA_BACKUP_KEY, serializedCandidate);
    if (deps.storage.getItem(PROFILE_METADATA_BACKUP_KEY) !== serializedCandidate) {
      // A later bounded cleanup attempt repairs the tombstone backup before
      // it removes any profile-owned data.
    }
  } catch {
    // A later bounded cleanup/finalization attempt repairs the backup.
  }

  // The durable intent now blocks normal writers by profile ID. Drop the
  // prepare-phase reservation so cancellation cannot strand the initiating
  // tab's lease; each cleanup attempt claims its own deletion-bound lease.
  releaseWriterLease(deps.storage, storageKey, leaseOwnerId);

  const pendingDetails: ProfileDeleteDetails = {
    removedEntries: 0,
    removalFailures: 0,
    rollbackFailures: 0,
    cleanupPending: true,
    deletionId,
  };

  return {
    ok: true,
    metadata: candidate,
    notice: resolution.notice,
    deleteDetails: pendingDetails,
  };
};

export const commitProfileDeletionTombstone = (
  profileId: string,
  deps: ProfileTransactionDependencies,
): Promise<ProfileTransactionResult> => runWithLockedProfileMetadata(
  deps,
  resolution => executeProfileDelete(deps, resolution, profileId),
);

const planProfileMutation = (
  previous: ProfileMetadata,
  mutation: ProfileMutation,
): ProfileMutationPlan => {
  switch (mutation.type) {
    case 'create': {
      const existing = previous.profiles.find(profile => profile.id === mutation.profile.id);
      if (existing !== undefined) {
        return existing.name === mutation.profile.name && existing.createdAt === mutation.profile.createdAt
          ? { status: 'unchanged' }
          : { status: 'failure', reason: 'invalid_metadata' };
      }
      if (previous.profiles.length >= MAX_PROFILES) {
        return { status: 'failure', reason: 'max_profiles' };
      }
      return {
        status: 'candidate',
        candidate: {
          ...previous,
          revision: previous.revision + 1,
          profiles: [...previous.profiles, mutation.profile],
          activeProfileId: mutation.profile.id,
        },
      };
    }
    case 'rename':
      if (!previous.profiles.some(profile => profile.id === mutation.profileId)) {
        return { status: 'failure', reason: 'not_found' };
      }
      return {
        status: 'candidate',
        candidate: {
          ...previous,
          revision: previous.revision + 1,
          profiles: previous.profiles.map(profile => profile.id === mutation.profileId
            ? { ...profile, name: mutation.name }
            : profile),
        },
      };
    case 'select':
      if (!previous.profiles.some(profile => profile.id === mutation.profileId)) {
        return { status: 'failure', reason: 'not_found' };
      }
      return {
        status: 'candidate',
        candidate: {
          ...previous,
          revision: previous.revision + 1,
          activeProfileId: mutation.profileId,
        },
      };
    case 'delete':
      return { status: 'failure', reason: 'invalid_metadata' };
  }
};

export const mutateProfileMetadata = async (
  deps: ProfileTransactionDependencies,
  mutation: ProfileMutation,
): Promise<ProfileTransactionResult> => {
  if (mutation.type === 'delete') {
    const committed = await commitProfileDeletionTombstone(mutation.profileId, deps);
    if (!committed.ok) return committed;
    const committedDetails = committed.deleteDetails;
    if (committedDetails === undefined
      || !('deletionId' in committedDetails)
      || committedDetails.deletionId === null) return committed;
    const intent = committed.metadata.deletions.find(
      deletion => deletion.deletionId === committedDetails.deletionId,
    );
    if (intent === undefined) {
      return transactionFailure(
        'invalid_metadata',
        committed.metadata,
        committed.notice,
        committedDetails,
      );
    }
    const cleanup = await resumeProfileDeletion(intent, deps);
    return {
      ok: true,
      metadata: cleanup.metadata ?? committed.metadata,
      notice: committed.notice,
      deleteDetails: {
        removedEntries: cleanup.removedEntries,
        removalFailures: cleanup.removalFailures,
        rollbackFailures: cleanup.rollbackFailures,
        cleanupPending: cleanup.status === 'cleanup_pending',
        deletionId: cleanup.status === 'cleanup_pending' ? intent.deletionId : null,
      },
    };
  }

  return runWithLockedProfileMetadata(deps, resolution => {

    const plan = planProfileMutation(resolution.metadata, mutation);
    if (plan.status === 'failure') {
      return transactionFailure(plan.reason, resolution.metadata, resolution.notice);
    }

    if (plan.status === 'unchanged' && resolution.mode === 'durable') {
      return noWriteSuccess(deps, resolution.metadata, resolution.notice);
    }

    const candidate = validateCandidate(
      plan.status === 'unchanged'
        ? repairCandidate(resolution.metadata)
        : plan.candidate,
    );
    if (candidate === null) {
      return transactionFailure('invalid_metadata', resolution.metadata, resolution.notice);
    }

    const copyFailure = resolution.mode === 'repair' ? executeLegacyCopy(deps, resolution) : null;
    if (copyFailure !== null) {
      return transactionFailure(copyFailure, resolution.metadata, resolution.notice);
    }

    return commitCandidate(
      deps,
      resolution.metadata,
      candidate,
      resolution.notice,
    );
  });
};
