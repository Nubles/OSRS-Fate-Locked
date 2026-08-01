/**
 * Pre-overwrite backup ring.
 *
 * Before anything overwrites a profile's save (importing a file, importing a
 * sync code, or resetting), we stash the current state here so a mistake is
 * recoverable. GameContext also drops one automatic "Session start" snapshot
 * per profile mount. Backups are per-profile (keyed off the profile's storage
 * key) and capped at MAX_BACKUPS — newest first, oldest evicted. The ring is
 * sized so routine session snapshots can't evict every pre-overwrite one.
 */

import type { BackupWriteResult } from './gamePersistence';
import { profileBackupKey } from './profileStorage';
const MAX_BACKUPS = 8;

export interface BackupMeta {
  ts: number;
  reason: string;
  summary: string;
}

interface BackupEntry extends BackupMeta {
  /** Serialized persisted-state JSON (same shape localStorage holds). */
  data: string;
}

const readAll = (storageKey: string): BackupEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileBackupKey(storageKey)) || '[]');
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
 * Snapshot `data` (a serialized persisted state). Empty and duplicate inputs are
 * observable no-ops; storage failures are reported so replacement callers can
 * warn without blocking the accepted operation.
 */
export const pushBackup = (
  storageKey: string,
  data: string,
  reason: string,
  canWrite: () => boolean,
): BackupWriteResult => {
  if (!canWrite()) return { stored: false, reason: 'ownership_conflict' };
  if (!data) return { stored: false, reason: 'empty' };
  const entries = readAll(storageKey);
  if (entries[0]?.data === data) return { stored: false, reason: 'duplicate' };
  const entry: BackupEntry = { ts: Date.now(), reason, summary: summarizeSave(data), data };
  const next = [entry, ...entries].slice(0, MAX_BACKUPS);
  try {
    localStorage.setItem(profileBackupKey(storageKey), JSON.stringify(next));
    return { stored: true };
  } catch {
    try {
      localStorage.setItem(profileBackupKey(storageKey), JSON.stringify(next.slice(0, 2)));
      return { stored: true };
    } catch {
      return { stored: false, reason: 'storage_unavailable' };
    }
  }
};

/** The serialized save for a given backup timestamp, or null if gone. */
export const getBackupData = (storageKey: string, ts: number): string | null =>
  readAll(storageKey).find((entry) => entry.ts === ts)?.data ?? null;
