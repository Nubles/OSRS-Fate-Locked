/**
 * Persistent site storage and the "off-device copy".
 *
 * A run lives in this browser's localStorage and IndexedDB. Browsers may clear
 * that: Safari, and every browser on iPhone and iPad (they all use WebKit),
 * deletes a site's script-written storage after 7 days of browser use without
 * a visit. `navigator.storage.persist()` asks the browser to keep it.
 *
 *   - Chrome and Edge decide persist() silently; Safari 17+ decides it
 *     silently too. The tracker asks quietly, once per profile, when the run
 *     records its first History entry (components/PersistentStorageDriver.tsx).
 *   - Firefox shows a permission prompt for persist(), so it is never asked
 *     quietly there; the backup reminder keeps its "Keep site storage" button.
 *
 * Persistence never survives "Clear browsing data" or a lost device, so the
 * only real safety is a copy that left the device: a .fate file (backupNag's
 * lastExport) or an online backup upload (onlineBackupRecord's lastUploadAt).
 *
 * Pure decisions here (pinned by utils/persistentStorage.test.ts); the
 * components stay thin.
 */
import type { PersistentStorageManager } from '../hooks/usePersistentStorage';
import { readNagRecord } from './backupNag';
import { readOnlineBackupRecord, type OnlineBackupRecord } from './onlineBackupRecord';

/** Fired on window when a quiet request made the site's storage persistent. */
export const PERSISTENT_STORAGE_EVENT = 'fate:storage-persisted';

/**
 * How the browser treats site storage:
 *   'webkit'  — Safari, and any browser on iPhone or iPad: 7-day eviction.
 *   'firefox' — Firefox (not on iOS): persist() shows a permission prompt.
 *   'other'   — Chromium and the rest: persist() is decided silently.
 */
export type StorageEngine = 'webkit' | 'firefox' | 'other';

export interface BrowserTraits {
  userAgent: string;
  /** navigator.maxTouchPoints: iPadOS reports a Mac user agent with touch. */
  maxTouchPoints?: number;
  /** Opened from the home screen (display-mode: standalone or navigator.standalone). */
  standalone?: boolean;
}

export const storageEngineFor = ({ userAgent, maxTouchPoints = 0 }: BrowserTraits): StorageEngine => {
  const ua = userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) return 'webkit';
  if (/Firefox\//.test(ua)) return 'firefox';
  // Desktop Safari: Safari without a Chromium or Edge marker.
  if (/Safari\//.test(ua) && /Version\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'webkit';
  return 'other';
};

/** The first History entry is the first moment a run has something to lose. */
export const QUIET_PERSIST_MIN_HISTORY = 1;

export interface QuietPersistInput {
  historyLength: number;
  /** backupNag's persistRequestedAt for this profile; undefined = never asked. */
  requestedAt: number | undefined;
  engine: StorageEngine;
}

/** Whether to quietly call persist() now: once per profile, never where it would prompt. */
export const shouldRequestPersistenceQuietly = ({ historyLength, requestedAt, engine }: QuietPersistInput): boolean =>
  engine !== 'firefox'
  && historyLength >= QUIET_PERSIST_MIN_HISTORY
  && requestedAt === undefined;

/**
 * Ask the browser to keep this site's storage. Never throws and never waits on
 * the player: resolves true when storage is (or already was) persistent, false
 * when the browser said no, null when the API is missing or failed.
 */
export const requestPersistenceQuietly = async (
  storage: PersistentStorageManager | undefined,
): Promise<boolean | null> => {
  try {
    if (!storage || typeof storage.persist !== 'function') return null;
    if (typeof storage.persisted === 'function' && (await storage.persisted()) === true) return true;
    return (await storage.persist()) === true;
  } catch {
    return null;
  }
};

/**
 * When this run last left the device, or null for never: the later of the
 * last .fate export and the last online backup upload. An online backup
 * that's paused because it holds a different run isn't a copy of this one.
 */
export const offDeviceCopyAt = (
  lastExport: number,
  online: Pick<OnlineBackupRecord, 'code' | 'lastUploadAt' | 'held'>,
): number | null => {
  const exported = lastExport > 0 ? lastExport : 0;
  const uploaded = online.code && online.held !== 'other-run' && typeof online.lastUploadAt === 'number' && online.lastUploadAt > 0
    ? online.lastUploadAt
    : 0;
  const latest = Math.max(exported, uploaded);
  return latest > 0 ? latest : null;
};

/** How the tracker names that copy wherever it shows (Settings menu, backup reminder). */
export const OFF_DEVICE_COPY_LABEL = 'Last backup outside this browser';

/** offDeviceCopyAt for a profile, from this browser's records. */
export const readOffDeviceCopyAt = (storageKey: string): number | null =>
  offDeviceCopyAt(readNagRecord(storageKey).lastExport, readOnlineBackupRecord(storageKey));

const DAY_MS = 24 * 60 * 60 * 1000;

/** "never" | "today" | "yesterday" | "3 days ago". */
export const offDeviceCopyLabel = (at: number | null, now = Date.now()): string => {
  if (at === null) return 'never';
  const days = Math.floor((now - at) / DAY_MS);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

/**
 * Safari and iOS can wipe a run after a week away. While this browser hasn't
 * granted persistent storage and the run has never left the device, the
 * one-time online backup question comes early (at this much History) instead
 * of at the usual 10 entries. It's the same single question, answered once.
 */
export const AT_RISK_BACKUP_PROMPT_MIN_HISTORY = 3;

export interface BackupPromptTimingInput {
  engine: StorageEngine;
  standalone: boolean;
  persisted: boolean;
  hasOffDeviceCopy: boolean;
}

/**
 * True when this browser may clear the run after a week away: WebKit, not a
 * home-screen app (WebKit exempts those from the 7-day rule), no persistent
 * storage, and no copy anywhere else.
 */
export const storageAtRisk = ({ engine, standalone, persisted, hasOffDeviceCopy }: BackupPromptTimingInput): boolean =>
  engine === 'webkit' && !standalone && !persisted && !hasOffDeviceCopy;

/** History entries before the one-time online backup question shows. */
export const onlineBackupPromptMinHistory = (input: BackupPromptTimingInput, usual: number): number =>
  storageAtRisk(input) ? Math.min(usual, AT_RISK_BACKUP_PROMPT_MIN_HISTORY) : usual;

/** This browser's traits, read safely (tests and old browsers may lack any of them). */
export const browserTraits = (): BrowserTraits => {
  try {
    if (typeof navigator === 'undefined') return { userAgent: '' };
    let standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    try {
      standalone = standalone || (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true);
    } catch { /* matchMedia unavailable */ }
    return { userAgent: navigator.userAgent ?? '', maxTouchPoints: navigator.maxTouchPoints ?? 0, standalone };
  } catch {
    return { userAgent: '' };
  }
};
