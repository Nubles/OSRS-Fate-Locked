/**
 * Online backup: a copy of a run kept outside this browser.
 *
 * The run's sync code is encrypted here, with a key derived from the player's
 * backup code, and kept on the relay under an id derived from the same code
 * (workers/fate-relay, route /b/<id>). The relay sees only the id, a write token
 * and ciphertext, so nobody without the code, the relay included, can read or
 * replace the backup. The code is the only way back in: it can't be reset.
 */
import { profileOnlineBackupKey } from './profileStorage';

/** Crockford base32: no I, L, O or U, so a code read aloud or retyped stays unambiguous. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** 20 symbols of 5 bits: 100 random bits. */
export const BACKUP_CODE_LENGTH = 20;
const GROUP_LENGTH = 5;
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

/** "ABCDE-FGHJK-MNPQR-STVWX": the canonical symbols in groups of five. */
export const formatBackupCode = (canonical: string): string =>
  canonical.match(new RegExp(`.{1,${GROUP_LENGTH}}`, 'g'))?.join('-') ?? '';

/** A new random backup code, formatted for the player to keep. */
export const generateBackupCode = (
  random: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes),
): string => {
  // 256 is a multiple of 32, so each byte's low five bits pick a symbol uniformly.
  const bytes = random(new Uint8Array(BACKUP_CODE_LENGTH));
  return formatBackupCode([...bytes].map(byte => ALPHABET[byte & 31]).join(''));
};

/**
 * A typed code as its 20 symbols, or null. It forgives case, spaces and dashes,
 * and reads O as 0 and I or L as 1, as Crockford base32 does.
 */
export const normalizeBackupCode = (input: string): string | null => {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return cleaned.length === BACKUP_CODE_LENGTH && [...cleaned].every(symbol => ALPHABET.includes(symbol))
    ? cleaned
    : null;
};

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

type Fetch = typeof fetch;

export const uploadBackup = async (
  base: string, keys: BackupKeys, envelope: string, fetchImpl: Fetch = fetch,
): Promise<BackupUploadResult> => {
  let response: Response;
  try {
    response = await fetchImpl(`${base}/b/${keys.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${keys.writeToken}` },
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

export const fetchBackup = async (base: string, keys: BackupKeys, fetchImpl: Fetch = fetch): Promise<BackupFetchResult> => {
  let response: Response;
  try {
    response = await fetchImpl(`${base}/b/${keys.id}`);
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (response.status === 404) return { ok: false, reason: 'not-found' };
  if (!response.ok) return { ok: false, reason: 'unavailable' };
  const updatedAt = Number(response.headers.get('X-Backup-Updated-At'));
  return { ok: true, envelope: await response.text(), updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 };
};

/** Removes the relay's copy. True when it's gone, or was never there. */
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

// ── This browser's record, per profile ──────────────────────────────────────

export interface OnlineBackupRecord {
  /** The canonical backup code, when online backup is on for this run. */
  code?: string;
  enabledAt?: number;
  /** The last successful upload, as the relay timed it. */
  lastUploadAt?: number;
  /** The save's checksum at that upload, so an unchanged run isn't sent again. */
  lastChecksum?: string;
  /** When the player answered the one-time prompt, either way. */
  promptAnsweredAt?: number;
}

export const readOnlineBackupRecord = (storageKey: string): OnlineBackupRecord => {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileOnlineBackupKey(storageKey)) || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const record: OnlineBackupRecord = {};
    if (typeof parsed.code === 'string' && normalizeBackupCode(parsed.code)) record.code = normalizeBackupCode(parsed.code)!;
    for (const field of ['enabledAt', 'lastUploadAt', 'promptAnsweredAt'] as const) {
      if (typeof parsed[field] === 'number' && Number.isFinite(parsed[field])) record[field] = parsed[field];
    }
    if (typeof parsed.lastChecksum === 'string') record.lastChecksum = parsed.lastChecksum;
    return record;
  } catch {
    return {};
  }
};

export const writeOnlineBackupRecord = (storageKey: string, record: OnlineBackupRecord): boolean => {
  try {
    localStorage.setItem(profileOnlineBackupKey(storageKey), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
};
