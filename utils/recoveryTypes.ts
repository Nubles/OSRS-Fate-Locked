import type { SaveWriteAuthorization } from './profileWriterLease';
import type { ProfileMetadata } from '../types';

export type RecoveryCheckpointReason =
  | 'interval'
  | 'session-start'
  | 'pre-replacement'
  | 'legacy-import';

export interface RecoveryHead {
  profileId: string;
  persistenceRevision: number;
  runId: string;
  runRevision: number;
  capturedAt: number;
  checksum: string;
  data: string;
}

export interface RecoveryCheckpoint extends RecoveryHead {
  reason: RecoveryCheckpointReason;
}

export interface MirrorMetadata {
  version: 1;
  persistenceRevision: number;
  capturedAt: number;
  checksum: string;
}

export type RecoveryProtectionStatus = 'checking' | 'protected' | 'degraded';

export interface SaveDurabilitySnapshot {
  primary: 'saved' | 'saving' | 'failed';
  recovery: RecoveryProtectionStatus;
  savedAt: number | null;
  /** Live write authorization reason when the primary could not be saved. */
  failureReason?: 'storage_unavailable' | 'ownership_conflict';
}

/** Result returned by an explicit save retry. Legacy callers may still return a boolean. */
export type SaveRetryResult = SaveDurabilitySnapshot | boolean;

export type RecoveryMaintenanceFailureReason =
  | 'ownership_conflict'
  | 'storage_unavailable'
  | 'quota'
  | 'stale_revision';

export type RecoveryWriteResult =
  | { stored: true; pruneFailure?: RecoveryMaintenanceFailureReason }
  | {
      stored: false;
      reason: 'ownership_conflict' | 'storage_unavailable' | 'quota' | 'stale_revision';
    };

export type RecoveryProfileDeleteResult =
  | { stored: true; removedEntries: number }
  | { stored: false; reason: RecoveryMaintenanceFailureReason };

export type ProfileDeletionCleanupFailureReason =
  | 'busy'
  | 'profile_in_use'
  | 'storage_unavailable'
  | 'unsupported_metadata'
  | 'invalid_metadata';

export type ProfileDeletionCleanupResult =
  | {
      status: 'completed';
      metadata: ProfileMetadata;
      removedEntries: number;
      removalFailures: number;
      rollbackFailures: 0;
    }
  | {
      status: 'cleanup_pending';
      reason: ProfileDeletionCleanupFailureReason;
      metadata: ProfileMetadata | null;
      removedEntries: number;
      removalFailures: number;
      rollbackFailures: 0;
    };

export interface RecoveryRepository {
  getHead(profileId: string): Promise<RecoveryHead | null>;
  putHead(
    record: RecoveryHead,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult>;
  listCheckpoints(profileId: string): Promise<RecoveryCheckpoint[]>;
  putCheckpoint(
    record: RecoveryCheckpoint,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult>;
  deleteCheckpoints(
    profileId: string,
    revisions: readonly number[],
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult>;
  getMetadata<T>(key: string): Promise<T | null>;
  putMetadata<T>(
    key: string,
    value: T,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult>;
  deleteProfileData?(
    profileId: string,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryProfileDeleteResult>;
  close(): void;
}
