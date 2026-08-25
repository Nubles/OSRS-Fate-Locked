import type { SaveWriteAuthorization } from './profileWriterLease';
import { isQuotaExceededError, removeDisposableCaches } from './storageRecovery';

export type SaveStatus = 'saved' | 'saving' | 'failed';

export type PendingSaveReason = 'storage_unavailable' | 'ownership_conflict';

export type PendingSaveEntry = {
  data: string;
  status: Exclude<SaveStatus, 'saved'>;
  reason: PendingSaveReason | null;
};

export type PendingSaveFlushResult =
  | { ok: true }
  | { ok: false; reason: PendingSaveReason };

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>
  & Partial<Pick<Storage, 'removeItem'>>;

const entries = new Map<string, PendingSaveEntry>();
const listeners = new Set<() => void>();
let revision = 0;

const emit = (): void => {
  revision += 1;
  for (const listener of listeners) listener();
};

export const stagePendingSave = (storageKey: string, data: string): void => {
  const existing = entries.get(storageKey);
  entries.set(storageKey, {
    data,
    status: existing?.status === 'failed' ? 'failed' : 'saving',
    reason: existing?.status === 'failed'
      ? 'storage_unavailable'
      : existing?.reason === 'ownership_conflict'
        ? 'ownership_conflict'
        : null,
  });
  emit();
};

export const flushPendingSave = (
  storage: SaveStorage,
  storageKey: string,
  authorizeWrite: () => SaveWriteAuthorization,
): PendingSaveFlushResult => {
  const entry = entries.get(storageKey);
  if (!entry) return { ok: true };

  const authorization = authorizeWrite();
  if (authorization.ok === false) {
    blockPendingSave(storageKey, authorization.reason);
    return authorization;
  }

  try {
    storage.setItem(storageKey, entry.data);
    if (storage.getItem(storageKey) !== entry.data) {
      throw new Error('storage readback mismatch');
    }
    entries.delete(storageKey);
    emit();
    return { ok: true };
  } catch (error) {
    if (isQuotaExceededError(error) && storage.removeItem) {
      removeDisposableCaches(storage as Pick<Storage, 'removeItem'>);
      try {
        storage.setItem(storageKey, entry.data);
        if (storage.getItem(storageKey) !== entry.data) {
          throw new Error('storage readback mismatch');
        }
        entries.delete(storageKey);
        emit();
        return { ok: true };
      } catch {
        // Fall through to the existing failed-save state below.
      }
    }
    entries.set(storageKey, {
      ...entry,
      status: 'failed',
      reason: 'storage_unavailable',
    });
    emit();
    return { ok: false, reason: 'storage_unavailable' };
  }
};

export const blockPendingSave = (
  storageKey: string,
  reason: PendingSaveReason = 'ownership_conflict',
): void => {
  const entry = entries.get(storageKey);
  if (!entry) return;
  if (
    entry.status === (reason === 'storage_unavailable' ? 'failed' : 'saving')
    && entry.reason === reason
  ) {
    return;
  }
  entries.set(storageKey, {
    ...entry,
    status: reason === 'storage_unavailable' ? 'failed' : 'saving',
    reason,
  });
  emit();
};

export const getPendingSave = (storageKey: string): PendingSaveEntry | null =>
  entries.get(storageKey) ?? null;

export const getSaveStatus = (storageKey: string): SaveStatus =>
  entries.get(storageKey)?.status ?? 'saved';

export const discardPendingSave = (storageKey: string): void => {
  if (entries.delete(storageKey)) emit();
};

export const hasAnyPendingSaves = (): boolean => entries.size > 0;

export const subscribePendingSaves = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPendingSaveRevision = (): number => revision;

export const resetPendingSavesForTest = (): void => {
  entries.clear();
  revision = 0;
  listeners.clear();
};
