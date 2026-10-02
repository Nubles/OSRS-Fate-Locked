/**
 * This browser's online backup record for a run, and the backup code's format.
 * Kept apart from utils/onlineBackup.ts (crypto and the relay), so the banners
 * that load with the app can read the record without loading the rest.
 */
import { profileOnlineBackupKey } from './profileStorage';

/** Crockford base32: no I, L, O or U, so a code read aloud or retyped stays unambiguous. */
export const BACKUP_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** 20 symbols of 5 bits: 100 random bits. */
export const BACKUP_CODE_LENGTH = 20;
const GROUP_LENGTH = 5;

/** Fired on window when a run's record changes, or to ask for an upload now (detail.action 'now'). */
export const ONLINE_BACKUP_EVENT = 'fate:online-backup';
export interface OnlineBackupEventDetail { storageKey: string; action?: 'now' }

/** "ABCDE-FGHJK-MNPQR-STVWX": the canonical symbols in groups of five. */
export const formatBackupCode = (canonical: string): string =>
  canonical.match(new RegExp(`.{1,${GROUP_LENGTH}}`, 'g'))?.join('-') ?? '';

/**
 * A typed code as its 20 symbols, or null. It forgives case, spaces and dashes,
 * and reads O as 0 and I or L as 1, as Crockford base32 does.
 */
export const normalizeBackupCode = (input: string): string | null => {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return cleaned.length === BACKUP_CODE_LENGTH && [...cleaned].every(symbol => BACKUP_CODE_ALPHABET.includes(symbol))
    ? cleaned
    : null;
};

export type OnlineBackupError = 'network' | 'unavailable' | 'forbidden' | 'too-large' | 'too-large-to-share';

export interface OnlineBackupRecord {
  /** The canonical backup code, when online backup is on for this run. */
  code?: string;
  /**
   * This browser's name for the copy it writes (16 random bytes, base64url). When
   * another browser backs the run up, the relay keeps this browser's copy as the
   * previous copy instead of losing it.
   */
  writer?: string;
  enabledAt?: number;
  /** The last successful upload, as the relay timed it. */
  lastUploadAt?: number;
  /** The save's checksum at that upload, so an unchanged run isn't sent again. */
  lastChecksum?: string;
  /** Why the last upload failed, until one succeeds. */
  lastError?: OnlineBackupError;
  /** When the player answered the one-time prompt, either way. */
  promptAnsweredAt?: number;
}

const ERRORS: ReadonlySet<string> = new Set(['network', 'unavailable', 'forbidden', 'too-large', 'too-large-to-share']);
const WRITER_RE = /^[A-Za-z0-9_-]{22}$/;

export const readOnlineBackupRecord = (storageKey: string): OnlineBackupRecord => {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileOnlineBackupKey(storageKey)) || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const record: OnlineBackupRecord = {};
    const code = typeof parsed.code === 'string' ? normalizeBackupCode(parsed.code) : null;
    if (code) record.code = code;
    if (typeof parsed.writer === 'string' && WRITER_RE.test(parsed.writer)) record.writer = parsed.writer;
    for (const field of ['enabledAt', 'lastUploadAt', 'promptAnsweredAt'] as const) {
      if (typeof parsed[field] === 'number' && Number.isFinite(parsed[field])) record[field] = parsed[field];
    }
    if (typeof parsed.lastChecksum === 'string') record.lastChecksum = parsed.lastChecksum;
    if (typeof parsed.lastError === 'string' && ERRORS.has(parsed.lastError)) record.lastError = parsed.lastError as OnlineBackupError;
    return record;
  } catch {
    return {};
  }
};

const announce = (detail: OnlineBackupEventDetail): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OnlineBackupEventDetail>(ONLINE_BACKUP_EVENT, { detail }));
};

/** Writes the record and tells the open screens. False when browser storage refused it. */
export const writeOnlineBackupRecord = (storageKey: string, record: OnlineBackupRecord): boolean => {
  try {
    localStorage.setItem(profileOnlineBackupKey(storageKey), JSON.stringify(record));
  } catch {
    return false;
  }
  announce({ storageKey });
  return true;
};

/** Asks the backup driver to upload this run now (after turning backup on, or "Back up now"). */
export const requestOnlineBackupNow = (storageKey: string): void => {
  announce({ storageKey, action: 'now' });
};
