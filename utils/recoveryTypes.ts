import type { SaveWriteAuthorization } from './profileWriterLease';

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
}

export type RecoveryWriteResult =
  | { stored: true }
  | {
      stored: false;
      reason: 'ownership_conflict' | 'storage_unavailable' | 'quota' | 'stale_revision';
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
  close(): void;
}
