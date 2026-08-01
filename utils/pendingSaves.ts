export type SaveStatus = 'saved' | 'saving' | 'failed';

export type PendingSaveEntry = {
  data: string;
  status: Exclude<SaveStatus, 'saved'>;
  reason: 'storage_unavailable' | null;
};

export type PendingSaveFlushResult =
  | { ok: true }
  | { ok: false; reason: 'storage_unavailable' };

const entries = new Map<string, PendingSaveEntry>();
const listeners = new Set<() => void>();
let revision = 0;

const emit = (): void => {
  revision += 1;
  for (const listener of listeners) listener();
};

export const stagePendingSave = (storageKey: string, data: string): void => {
  entries.set(storageKey, { data, status: 'saving', reason: null });
  emit();
};

export const flushPendingSave = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
): PendingSaveFlushResult => {
  const entry = entries.get(storageKey);
  if (!entry) return { ok: true };

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
