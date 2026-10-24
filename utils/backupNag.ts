/**
 * Export-backup nag.
 *
 * A run lives only in this browser's localStorage — the pre-overwrite snapshot
 * ring (utils/backups.ts) can't survive the browser clearing site data. The
 * only real protection is a .fate file on disk, so we track when the player
 * last exported one (per profile) and surface a gentle banner when a run with
 * real progress hasn't been exported in a while. Dismissing snoozes it.
 *
 * Pure logic + tiny localStorage record; the UI lives in
 * components/BackupNagBanner.tsx.
 */

import { profileExportNagKey } from './profileStorage';

export const NAG_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days since last export
export const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;    // dismiss hides it for 7 days
/** Only nag runs with real progress — a day-one run has little to lose. */
export const MIN_HISTORY = 10;

interface NagRecord {
  /** Last time a .fate export (file or sync-code copy) happened. 0 = never. */
  lastExport: number;
  /** Dismissals push this forward; the banner stays hidden until then. */
  snoozeUntil: number;
  /**
   * When the tracker quietly asked the browser to keep this site's storage
   * (utils/persistentStorage.ts), so it asks once per profile. Absent = never.
   */
  persistRequestedAt?: number;
}

export const readNagRecord = (storageKey: string): NagRecord => {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileExportNagKey(storageKey)) || '');
    const record: NagRecord = {
      lastExport: typeof parsed?.lastExport === 'number' ? parsed.lastExport : 0,
      snoozeUntil: typeof parsed?.snoozeUntil === 'number' ? parsed.snoozeUntil : 0,
    };
    if (typeof parsed?.persistRequestedAt === 'number' && Number.isFinite(parsed.persistRequestedAt)) {
      record.persistRequestedAt = parsed.persistRequestedAt;
    }
    return record;
  } catch {
    return { lastExport: 0, snoozeUntil: 0 };
  }
};

const write = (storageKey: string, rec: NagRecord): void => {
  try {
    localStorage.setItem(profileExportNagKey(storageKey), JSON.stringify(rec));
  } catch {
    /* best-effort — never block the export itself */
  }
};

/** Call after any successful export (file download or sync-code upload). */
export const markExported = (storageKey: string, now = Date.now()): void =>
  write(storageKey, { ...readNagRecord(storageKey), lastExport: now });

/** Call when the banner is dismissed. */
export const snoozeNag = (storageKey: string, now = Date.now()): void =>
  write(storageKey, { ...readNagRecord(storageKey), snoozeUntil: now + SNOOZE_MS });

/** Call when the tracker has quietly asked for persistent storage for this profile. */
export const markPersistRequested = (storageKey: string, now = Date.now()): void =>
  write(storageKey, { ...readNagRecord(storageKey), persistRequestedAt: now });

/**
 * Pure decision — exported for tests. `historyLength` gates on real progress;
 * a run is nag-worthy when it has never been exported (or not for NAG_AFTER_MS)
 * and isn't snoozed.
 */
export const shouldNagPure = (
  rec: NagRecord,
  historyLength: number,
  now: number,
): boolean => {
  if (historyLength < MIN_HISTORY) return false;
  if (now < rec.snoozeUntil) return false;
  return rec.lastExport === 0 || now - rec.lastExport >= NAG_AFTER_MS;
};

export const shouldNag = (storageKey: string, historyLength: number, now = Date.now()): boolean =>
  shouldNagPure(readNagRecord(storageKey), historyLength, now);
