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
    reason: existing?.status === 'failed' ? 'storage_unavailable' : null,
  });
  emit();
};

export const flushPendingSave = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
  canWrite: () => boolean,
): PendingSaveFlushResult => {
  const entry = entries.get(storageKey);
  if (!entry) return { ok: true };

  if (!canWrite()) {
    blockPendingSave(storageKey);
    return { ok: false, reason: 'ownership_conflict' };
  }

  try {
    storage.setItem(storageKey, entry.data);
    entries.delete(storageKey);
    emit();
    return { ok: true };
  } catch {
    entries.set(storageKey, {
      ...entry,
      status: 'failed',
      reason: 'storage_unavailable',
    });
    emit();
    return { ok: false, reason: 'storage_unavailable' };
  }
};

export const blockPendingSave = (storageKey: string): void => {
  const entry = entries.get(storageKey);
  if (!entry) return;
  if (
    entry.status === 'saving'
    && entry.reason === 'ownership_conflict'
  ) {
    return;
  }
  entries.set(storageKey, {
    ...entry,
    status: 'saving',
    reason: 'ownership_conflict',
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
