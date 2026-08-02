import type { Profile, ProfileMetadata } from '../types';
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

  const primaryLock = readLock(deps);
  if (!primaryLock.ok) return commitFailure('storage_unavailable', previous);
  if (!isOwnedAndUnexpired(primaryLock.lock, deps)) return commitFailure('busy', previous);

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
): ProfileTransactionResult => ({ ok: false, reason, metadata, notice });

const readOnlyNotice = (notice: ProfileRecoveryNotice | null): ProfileRecoveryNotice => ({
  kind: 'read_only',
  recoveredProfiles: notice?.recoveredProfiles ?? 0,
  generatedNames: notice?.generatedNames ?? 0,
  unreadableSaves: notice?.unreadableSaves ?? 0,
  overflowSaves: notice?.overflowSaves ?? 0,
  rollbackFailures: notice?.rollbackFailures ?? 0,
});

const currentOwnershipFailure = (
  deps: ProfileTransactionDependencies,
): Extract<ProfileMutationFailure, 'busy' | 'storage_unavailable'> | null => {
  const current = readLock(deps);
  if (!current.ok) return 'storage_unavailable';
  return isOwnedAndUnexpired(current.lock, deps) ? null : 'busy';
};

const noWriteSuccess = (
  deps: ProfileTransactionDependencies,
  metadata: ProfileMetadata,
  notice: ProfileRecoveryNotice | null,
): ProfileTransactionResult => {
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
    return { ok: false, reason: result.reason, metadata: result.metadata, notice };
  }
  return { ok: true, metadata: result.metadata, notice };
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
  operation: (resolution: WritableProfileMetadataResolution) => ProfileTransactionResult,
): Promise<ProfileTransactionResult> => {
  const lock = await acquireProfileMetadataLock(deps);
  if (lock.status !== 'acquired') {
    return transactionFailure(lock.status, null, null);
  }

  try {
    const sources = readNewestProfileMetadata(deps);
    if (!sources.ok) return transactionFailure('storage_unavailable', null, null);

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

    try {
      return operation(resolution);
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
    const ownershipFailure = currentOwnershipFailure(deps);
    if (ownershipFailure !== null) return ownershipFailure;
    const targetKey = `FATE_PROFILE_${copy.toProfileId}`;
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

export const mutateProfileMetadata = (
  deps: ProfileTransactionDependencies,
  mutation: ProfileMutation,
): Promise<ProfileTransactionResult> => runWithLockedProfileMetadata(deps, resolution => {
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
