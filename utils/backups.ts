/**
 * Pre-overwrite backup ring.
 *
 * Before anything overwrites a profile's save (importing a file, importing a
 * sync code, or resetting), we stash the current state here so a mistake is
 * recoverable. Backups are per-profile (keyed off the profile's storage key)
 * and capped at MAX_BACKUPS — newest first, oldest evicted.
 */

const SUFFIX = '__backups';
const MAX_BACKUPS = 5;

export interface BackupMeta {
  ts: number;
  reason: string;
  summary: string;
}

interface BackupEntry extends BackupMeta {
  /** Serialized persisted-state JSON (same shape localStorage holds). */
  data: string;
}

const keyFor = (storageKey: string): string => storageKey + SUFFIX;

const readAll = (storageKey: string): BackupEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(storageKey)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** One-line description of a serialized save, for the restore list. */
export const summarizeSave = (data: string): string => {
  try {
    const s = JSON.parse(data);
    const u = s.unlocks || {};
    const regions = Array.isArray(u.regions) ? u.regions.length : 0;
    const events = Array.isArray(s.history) ? s.history.length : 0;
    const keys = typeof s.keys === 'number' ? s.keys : 0;
    return `${keys} keys · ${regions} regions · ${events} events`;
  } catch {
    return 'Unknown run';
  }
};

/** Metadata for the profile's backups, newest first (no heavy `data` field). */
export const listBackups = (storageKey: string): BackupMeta[] =>
  readAll(storageKey).map(({ data: _data, ...meta }) => meta);

/**
 * Snapshot `data` (a serialized persisted state). No-ops on empty input or when
 * it's identical to the most recent backup, so repeated saves don't churn the
 * ring. Quota failures are swallowed — a backup is best-effort.
 */
export const pushBackup = (storageKey: string, data: string, reason: string): void => {
  if (!data) return;
  const entries = readAll(storageKey);
  if (entries[0]?.data === data) return; // nothing changed since last snapshot
  const entry: BackupEntry = { ts: Date.now(), reason, summary: summarizeSave(data), data };
  const next = [entry, ...entries].slice(0, MAX_BACKUPS);
  try {
    localStorage.setItem(keyFor(storageKey), JSON.stringify(next));
  } catch {
    // Quota exceeded — drop the oldest and retry once with a smaller ring.
    try {
      localStorage.setItem(keyFor(storageKey), JSON.stringify(next.slice(0, 2)));
    } catch {
      /* give up silently — backups must never block the real operation */
    }
  }
};

/** The serialized save for a given backup timestamp, or null if gone. */
export const getBackupData = (storageKey: string, ts: number): string | null =>
  readAll(storageKey).find((e) => e.ts === ts)?.data ?? null;
