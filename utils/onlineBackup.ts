/**
 * Online backup: a copy of a run kept outside this browser.
 *
 * The run's sync code is encrypted here, with a key derived from the player's
 * backup code, and kept on the relay under an id derived from the same code
 * (workers/fate-relay, route /b/<id>). The relay sees only the id, a write token
 * and ciphertext, so nobody without the code, the relay included, can read or
 * replace the backup. The code is the only way back in: it can't be reset.
 *
 * When a second browser backs up the same run, the relay keeps the copy it
 * replaced as the previous copy (/b/<id>/previous), so a browser holding an
 * older run can't erase newer progress: a restore offers both.
 */
import {
  BACKUP_CODE_ALPHABET,
  BACKUP_CODE_LENGTH,
  formatBackupCode,
  readOnlineBackupRecord,
  writeOnlineBackupRecord,
  type OnlineBackupError,
  type OnlineBackupHold,
  type OnlineBackupRecord,
} from './onlineBackupRecord';
import { encodeSyncCode } from './syncCode';
import { simpleHash } from './integrity';

export {
  BACKUP_CODE_LENGTH,
  formatBackupCode,
  normalizeBackupCode,
  readOnlineBackupRecord,
  writeOnlineBackupRecord,
  type OnlineBackupRecord,
} from './onlineBackupRecord';

const HKDF_SALT = 'fate-locked-online-backup-v1';
const ENVELOPE_TAG = 'FLBK1';

const utf8 = (value: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(value) as Uint8Array<ArrayBuffer>;

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

/** A new random backup code, formatted for the player to keep. */
export const generateBackupCode = (
  random: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes),
): string => {
  // 256 is a multiple of 32, so each byte's low five bits pick a symbol uniformly.
  const bytes = random(new Uint8Array(BACKUP_CODE_LENGTH));
  return formatBackupCode([...bytes].map(byte => BACKUP_CODE_ALPHABET[byte & 31]).join(''));
};

/** A new random name for this browser's copy of a backup. */
export const generateBackupWriter = (
  random: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes),
): string => toBase64Url(random(new Uint8Array(16)));

export interface BackupKeys {
  /** Where the relay keeps the backup. */
  id: string;
  /** Proves to the relay that this player may replace or delete it. */
  writeToken: string;
  /** Encrypts and decrypts the backup. Never leaves this browser. */
  key: CryptoKey;
}

/**
 * The id, write token and key for a canonical code, by HKDF-SHA-256. The code is
 * 100 random bits, so a slow password hash would add nothing.
 */
export const deriveBackupKeys = async (canonical: string): Promise<BackupKeys> => {
  const secret = await crypto.subtle.importKey('raw', utf8(canonical), 'HKDF', false, ['deriveBits', 'deriveKey']);
  const params = (info: string): HkdfParams => ({ name: 'HKDF', hash: 'SHA-256', salt: utf8(HKDF_SALT), info: utf8(info) });
  const bits = async (info: string) => new Uint8Array(await crypto.subtle.deriveBits(params(info), secret, 256));
  const key = await crypto.subtle.deriveKey(params('key'), secret, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { id: toBase64Url(await bits('id')), writeToken: toBase64Url(await bits('write')), key };
};

/** "FLBK1.<iv>.<ciphertext>": AES-256-GCM, with the tag bound to the format. */
export const encryptBackup = async (plaintext: string, key: CryptoKey): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8(ENVELOPE_TAG) }, key, utf8(plaintext),
  ));
  return `${ENVELOPE_TAG}.${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
};

/** The plaintext, or null when the envelope is malformed or the key isn't the one it was made with. */
export const decryptBackup = async (envelope: string, key: CryptoKey): Promise<string | null> => {
  const [tag, ivText, ciphertextText, ...rest] = envelope.trim().split('.');
  const iv = ivText ? fromBase64Url(ivText) : null;
  const ciphertext = ciphertextText ? fromBase64Url(ciphertextText) : null;
  if (tag !== ENVELOPE_TAG || rest.length > 0 || !iv || iv.length !== 12 || !ciphertext) return null;
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: utf8(ENVELOPE_TAG) }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
};

// ── The relay ────────────────────────────────────────────────────────────────

export type BackupUploadResult =
  | { ok: true; updatedAt: number }
  | { ok: false; reason: 'network' | 'unavailable' | 'forbidden' | 'too-large' | 'throttled'; retryAfterMs?: number };

export type BackupFetchResult =
  | { ok: true; envelope: string; updatedAt: number }
  | { ok: false; reason: 'network' | 'unavailable' | 'not-found' };

/** The newest copy, or the one it replaced when another browser backed the run up. */
export type BackupCopy = 'latest' | 'previous';

type Fetch = typeof fetch;

export const uploadBackup = async (
  base: string, keys: BackupKeys, envelope: string, writer: string, fetchImpl: Fetch = fetch,
): Promise<BackupUploadResult> => {
  let response: Response;
  try {
    response = await fetchImpl(`${base}/b/${keys.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${keys.writeToken}`, 'X-Backup-Writer': writer },
      body: envelope,
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (response.ok) {
    const body = await response.json().catch(() => null) as { updatedAt?: unknown } | null;
    return { ok: true, updatedAt: typeof body?.updatedAt === 'number' ? body.updatedAt : Date.now() };
  }
  if (response.status === 403) return { ok: false, reason: 'forbidden' };
  if (response.status === 413) return { ok: false, reason: 'too-large' };
  if (response.status === 429) {
    const seconds = Number(response.headers.get('Retry-After'));
    return { ok: false, reason: 'throttled', retryAfterMs: Number.isFinite(seconds) ? seconds * 1000 : 60_000 };
  }
  return { ok: false, reason: 'unavailable' };
};

export const fetchBackup = async (
  base: string, keys: BackupKeys, copy: BackupCopy = 'latest', fetchImpl: Fetch = fetch,
): Promise<BackupFetchResult> => {
  let response: Response;
  try {
    response = await fetchImpl(`${base}/b/${keys.id}${copy === 'previous' ? '/previous' : ''}`);
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (response.status === 404) return { ok: false, reason: 'not-found' };
  if (!response.ok) return { ok: false, reason: 'unavailable' };
  const updatedAt = Number(response.headers.get('X-Backup-Updated-At'));
  return { ok: true, envelope: await response.text(), updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 };
};

/** Removes the relay's copies. True when they're gone, or were never there. */
export const deleteBackup = async (base: string, keys: BackupKeys, fetchImpl: Fetch = fetch): Promise<boolean> => {
  try {
    const response = await fetchImpl(`${base}/b/${keys.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${keys.writeToken}` },
    });
    return response.ok;
  } catch {
    return false;
  }
};

// ── Backing up a run ────────────────────────────────────────────────────────

/** How long to wait before trying a failed upload again. */
export const BACKUP_RETRY_MS = 5 * 60 * 1000;

export type BackupRunOutcome =
  | { kind: 'off' }
  | { kind: 'unchanged' }
  | { kind: 'uploaded'; updatedAt: number }
  | { kind: 'retry'; afterMs: number }
  | { kind: 'failed'; reason: OnlineBackupError }
  | { kind: 'held'; reason: OnlineBackupHold };

/** The run id and History length of an export, or null when it has neither. */
export const exportRunShape = (exportJson: string): { runId: string; historyLength: number } | null => {
  try {
    const parsed = JSON.parse(exportJson) as { runId?: unknown; history?: unknown } | null;
    return parsed && typeof parsed.runId === 'string' && Array.isArray(parsed.history)
      ? { runId: parsed.runId, historyLength: parsed.history.length }
      : null;
  } catch {
    return null;
  }
};

/**
 * Whether uploading this export would overwrite a backup of another run, or of
 * a longer one: after Reset, a new run in the same profile, or a save another
 * app damaged. History only grows in play, so a shorter one means replacement.
 * A record from before runs were recorded holds nothing back.
 */
export const backupHoldFor = (
  record: OnlineBackupRecord,
  shape: { runId: string; historyLength: number } | null,
): OnlineBackupHold | null => {
  if (shape === null || record.lastRunId === undefined) return null;
  if (shape.runId !== record.lastRunId) return 'other-run';
  if (shape.historyLength < (record.lastHistoryLength ?? 0)) return 'shorter';
  return null;
};

/**
 * Uploads a run's export, encrypted, when online backup is on for it and the run
 * changed since the last upload (or always, when `force`). It never replaces a
 * backup of a different or longer run unless the player chose to (`replace`):
 * it records the hold instead, and the screens ask. The outcome goes in the
 * run's record, so the screens can say when it was last backed up or why it
 * wasn't; the driver uses the returned outcome to schedule a retry.
 */
export const backupRun = async (
  storageKey: string,
  exportJson: string,
  relayBase: string,
  options: { force?: boolean; replace?: boolean; fetchImpl?: Fetch } = {},
): Promise<BackupRunOutcome> => {
  let record = readOnlineBackupRecord(storageKey);
  if (!record.code) return { kind: 'off' };
  const shape = exportRunShape(exportJson);
  const hold = options.replace ? null : backupHoldFor(record, shape);
  if (hold !== null) {
    if (record.held !== hold) writeOnlineBackupRecord(storageKey, { ...record, held: hold });
    return { kind: 'held', reason: hold };
  }
  if (record.held) {
    // Replaced on purpose, or the backed-up run is back (restored).
    const { held: _held, ...rest } = record;
    record = rest;
    writeOnlineBackupRecord(storageKey, record);
  }
  const checksum = simpleHash(exportJson);
  if (!options.force && checksum === record.lastChecksum && !record.lastError) return { kind: 'unchanged' };

  const fail = (reason: OnlineBackupError): BackupRunOutcome => {
    const latest = readOnlineBackupRecord(storageKey);
    if (latest.code === record.code) writeOnlineBackupRecord(storageKey, { ...latest, lastError: reason });
    return reason === 'network' || reason === 'unavailable'
      ? { kind: 'retry', afterMs: BACKUP_RETRY_MS }
      : { kind: 'failed', reason };
  };

  let syncCode: string;
  try {
    syncCode = await encodeSyncCode(JSON.parse(exportJson) as Record<string, unknown>);
  } catch {
    return fail('too-large-to-share');
  }
  const writer = record.writer ?? generateBackupWriter();
  if (!record.writer) writeOnlineBackupRecord(storageKey, { ...record, writer });
  const keys = await deriveBackupKeys(record.code);
  const result = await uploadBackup(relayBase, keys, await encryptBackup(syncCode, keys.key), writer, options.fetchImpl);
  if (result.ok === false) {
    if (result.reason === 'throttled') return { kind: 'retry', afterMs: result.retryAfterMs ?? 60_000 };
    return fail(result.reason);
  }

  // Backup may have been turned off, or its code changed, while this upload ran.
  const latest = readOnlineBackupRecord(storageKey);
  if (latest.code !== record.code) return { kind: 'off' };
  const { held: _held, ...rest } = latest;
  writeOnlineBackupRecord(storageKey, {
    ...rest,
    lastUploadAt: result.updatedAt,
    lastChecksum: checksum,
    lastError: undefined,
    ...(shape === null ? {} : { lastRunId: shape.runId, lastHistoryLength: shape.historyLength }),
  });
  return { kind: 'uploaded', updatedAt: result.updatedAt };
};
