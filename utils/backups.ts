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
import type { SaveWriteAuthorization } from './profileWriterLease';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';
import { simpleHash } from './integrity';
import { checksumSave } from './saveIntegrity';
import type { RecoveryCheckpoint, RecoveryRepository } from './recoveryTypes';
const MAX_BACKUPS = 8;

export interface BackupMeta {
  /** Stable identifier used by the restore action across renders. */
  id: string;
  ts: number;
  reason: string;
  summary: string;
  /** Source metadata used to merge journal and compatibility entries. */
  checksum?: string;
  source?: 'legacy' | 'checkpoint';
  persistenceRevision?: number;
}

interface BackupEntry extends Omit<BackupMeta, 'id'> {
  /** Older rings predate stable ids and are upgraded when listed. */
  id?: string;
  /** Serialized persisted-state JSON (same shape localStorage holds). */
  data: string;
}

export interface CombinedBackupListOptions {
  profileId: string;
  repository?: Pick<RecoveryRepository, 'listCheckpoints'> | null;
  checksum?: (data: string) => Promise<string>;
}

const readAll = (storageKey: string): BackupEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileBackupKey(storageKey)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is BackupEntry => (
      typeof entry === 'object'
      && entry !== null
      && !Array.isArray(entry)
      && typeof entry.ts === 'number'
      && Number.isSafeInteger(entry.ts)
      && entry.ts >= 0
      && typeof entry.reason === 'string'
      && typeof entry.summary === 'string'
      && typeof entry.data === 'string'
      && entry.data.length > 0
    ));
  } catch {
    return [];
  }
};

const legacyId = (entry: Pick<BackupEntry, 'ts' | 'data'>): string =>
  `legacy:${entry.ts}:${simpleHash(entry.data)}`;

const legacyMeta = (
  entry: BackupEntry,
  checksum?: string,
): BackupMeta => ({
  id: checksum === undefined ? legacyId(entry) : `legacy:${checksum}`,
  ts: entry.ts,
  reason: entry.reason,
  summary: entry.summary,
  ...(checksum === undefined ? {} : { checksum }),
  source: 'legacy',
});

/** One-line description of a serialized save, for the restore list. */
export const summarizeSave = (data: string): string => {
  try {
    const s = JSON.parse(data);
    const u = s.unlocks || {};
    const regions = Array.isArray(u.regions) ? visibleAreaUnlocks(u.regions).length : 0;
    const events = Array.isArray(s.history) ? s.history.length : 0;
    const keys = typeof s.keys === 'number' ? s.keys : 0;
    return `${keys} keys · ${regions} regions · ${events} events`;
  } catch {
    return 'Unknown run';
  }
};

/** Metadata for the profile's backups, newest first (no heavy `data` field). */
export function listBackups(storageKey: string): BackupMeta[];
export function listBackups(
  storageKey: string,
  options: CombinedBackupListOptions,
): Promise<BackupMeta[]>;
export function listBackups(
  storageKey: string,
  options?: CombinedBackupListOptions,
): BackupMeta[] | Promise<BackupMeta[]> {
  if (options !== undefined) return listCombinedBackups(storageKey, options);
  return readAll(storageKey).map(entry => legacyMeta(entry));
}

const checkpointId = (profileId: string, persistenceRevision: number): string =>
  `checkpoint:${profileId}:${persistenceRevision}`;

const compareNewest = (a: BackupMeta, b: BackupMeta): number => {
  if (a.ts !== b.ts) return b.ts - a.ts;
  const aRevision = a.persistenceRevision ?? 0;
  const bRevision = b.persistenceRevision ?? 0;
  if (aRevision !== bRevision) return bRevision - aRevision;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

const checkpointMeta = (
  profileId: string,
  checkpoint: RecoveryCheckpoint,
): BackupMeta => ({
  id: checkpointId(profileId, checkpoint.persistenceRevision),
  ts: checkpoint.capturedAt,
  reason: checkpoint.reason,
  summary: summarizeSave(checkpoint.data),
  checksum: checkpoint.checksum,
  source: 'checkpoint',
  persistenceRevision: checkpoint.persistenceRevision,
});

/**
 * Return one restore list spanning the journal checkpoints and the old ring.
 * Equal save bytes are represented once. When both stores contain a
 * byte-identical snapshot, the newest record supplies its timestamp and label;
 * journal-only entries retain their checkpoint reason. Journal failures are
 * intentionally best-effort and leave the old ring readable.
 */
export const listCombinedBackups = async (
  storageKey: string,
  options: CombinedBackupListOptions,
): Promise<BackupMeta[]> => {
  const checksum = options.checksum ?? checksumSave;
  const legacyEntries = readAll(storageKey);
  const legacy = await Promise.all(legacyEntries.map(async entry => {
    try {
      return { meta: legacyMeta(entry, await checksum(entry.data)), data: entry.data };
    } catch {
      return { meta: legacyMeta(entry), data: entry.data };
    }
  }));

  let checkpoints: RecoveryCheckpoint[] = [];
  if (options.repository !== undefined && options.repository !== null) {
    try {
      checkpoints = await options.repository.listCheckpoints(options.profileId);
    } catch {
      checkpoints = [];
    }
  }

  const combined = new Map<string, { meta: BackupMeta; data: string }>();
  for (const item of legacy) {
    if (item.meta.checksum === undefined) {
      combined.set(item.meta.id, item);
      continue;
    }
    const existing = combined.get(item.meta.checksum);
    if (existing === undefined || compareNewest(item.meta, existing.meta) < 0) {
      combined.set(item.meta.checksum, item);
    }
  }
  for (const checkpoint of checkpoints) {
    if (typeof checkpoint.data !== 'string' || typeof checkpoint.checksum !== 'string') continue;
    const item = { meta: checkpointMeta(options.profileId, checkpoint), data: checkpoint.data };
    const existing = combined.get(checkpoint.checksum);
    if (existing !== undefined) {
      if (compareNewest(item.meta, existing.meta) < 0) combined.set(checkpoint.checksum, item);
      continue;
    }
    const matchingLegacyKey = [...combined.entries()]
      .find(([, value]) => value.data === checkpoint.data)?.[0];
    if (matchingLegacyKey !== undefined) {
      const matchingLegacy = combined.get(matchingLegacyKey)!;
      if (compareNewest(item.meta, matchingLegacy.meta) < 0) {
        combined.delete(matchingLegacyKey);
        combined.set(checkpoint.checksum, item);
      }
      continue;
    }
    combined.set(checkpoint.checksum, item);
  }
  return [...combined.values()]
    .map(item => item.meta)
    .sort(compareNewest);
};

/** Named async alias for callers that want to make the journal path explicit. */
export const listBackupsAsync = listCombinedBackups;

/**
 * Snapshot `data` (a serialized persisted state). Empty and duplicate inputs are
 * observable no-ops; storage failures are reported so replacement callers can
 * warn without blocking the accepted operation.
 */
export const pushBackup = (
  storageKey: string,
  data: string,
  reason: string,
  authorizeWrite: () => SaveWriteAuthorization,
): BackupWriteResult => {
  const initialAuthorization = authorizeWrite();
  if (initialAuthorization.ok === false) {
    return { stored: false, reason: initialAuthorization.reason };
  }
  if (!data) return { stored: false, reason: 'empty' };
  const entries = readAll(storageKey);
  if (entries[0]?.data === data) return { stored: false, reason: 'duplicate' };
  const ts = Date.now();
  const entry: BackupEntry = {
    id: legacyId({ ts, data }),
    ts,
    reason,
    summary: summarizeSave(data),
    data,
  };
  const next = [entry, ...entries].slice(0, MAX_BACKUPS);
  const writeAuthorization = authorizeWrite();
  if (writeAuthorization.ok === false) {
    return { stored: false, reason: writeAuthorization.reason };
  }
  try {
    localStorage.setItem(profileBackupKey(storageKey), JSON.stringify(next));
    return { stored: true };
  } catch {
    const retryAuthorization = authorizeWrite();
    if (retryAuthorization.ok === false) {
      return { stored: false, reason: retryAuthorization.reason };
    }
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

/** Resolve either a stable legacy id or the compatibility timestamp. */
export const getBackupDataById = async (
  storageKey: string,
  id: string | number,
  checksum: (data: string) => Promise<string> = checksumSave,
): Promise<string | null> => {
  if (typeof id === 'number') return getBackupData(storageKey, id);
  const entries = readAll(storageKey);
  const direct = entries.find(entry => legacyId(entry) === id);
  if (direct !== undefined) return direct.data;
  for (const entry of entries) {
    try {
      if (`legacy:${await checksum(entry.data)}` === id) return entry.data;
    } catch {
      // Continue to the next compatibility entry.
    }
  }
  return null;
};
