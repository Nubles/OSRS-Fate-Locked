/**
 * What the relay accepts: the shapes of route ids and of the bodies real
 * clients send. Anything else is refused before the relay touches KV, so the
 * relay can't be used to store arbitrary files.
 */

/** The largest publish request: `{ token, payload }` with the compressed profile. */
export const MAX_REQUEST_BYTES = 256 * 1024;

/**
 * A RuneLite pairing code: a random UUID without its dashes, which is how
 * every plugin build makes one (PairingSupport.newCode) and the only form the
 * plugin and the app accept (utils/runelitePairing.ts).
 */
export const PAIRING_CODE_RE = /^[0-9a-f]{32}$/;
/** 32 random bytes in base64url without padding: an online backup's id. */
export const BACKUP_ID_RE = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
/** 16 random bytes in base64url without padding: a shared-progress run id. */
export const PROGRESS_ID_RE = /^[A-Za-z0-9_-]{21}[AQgw]$/;
/** A Discord user id (a snowflake). */
export const DISCORD_ID_RE = /^\d{17,20}$/;

/** An online backup lasts this long after its last upload. */
export const BACKUP_TTL_SECONDS = 90 * 86400;
/**
 * The longest sync code the app makes (MAX_SYNC_CODE_CHARS, utils/syncCode.ts).
 * utils/onlineBackup.test.ts checks the two stay equal.
 */
export const MAX_SYNC_CODE_CHARS = 2 * 1024 * 1024;
const BACKUP_TAG = 'FLBK1.';
const BACKUP_IV_CHARS = 16; // 12 bytes in base64url
const GCM_TAG_BYTES = 16;
/**
 * The largest online backup: the longest sync code, encrypted, as
 * `FLBK1.<iv>.<ciphertext>` (AES-GCM adds a 16-byte tag; base64url adds a
 * third). About 2.67 MiB; any run small enough for a sync code fits.
 */
export const MAX_BACKUP_BYTES = BACKUP_TAG.length + BACKUP_IV_CHARS + 1
  + Math.ceil(((MAX_SYNC_CODE_CHARS + GCM_TAG_BYTES) * 4) / 3);
/** A backup is replaced at most once a minute, so a stuck client can't spend KV's daily writes. */
export const BACKUP_MIN_INTERVAL_MS = 60 * 1000;
/**
 * When the same browser backs up again, the copy it replaces is kept as the
 * previous copy at most this often, so a bad upload can't replace the copy
 * from a day before it.
 */
export const BACKUP_ROTATE_MS = 24 * 60 * 60 * 1000;

const BASE64URL = new Uint8Array(256);
for (const symbol of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_') {
  BASE64URL[symbol.charCodeAt(0)] = 1;
}
const DOT = '.'.charCodeAt(0);

/** Whether bytes[from, to) is non-empty base64url without padding of a possible length. */
function base64UrlRun(bytes, from, to) {
  const length = to - from;
  if (length <= 0 || length % 4 === 1) return false;
  for (let index = from; index < to; index += 1) {
    if (BASE64URL[bytes[index]] !== 1) return false;
  }
  return true;
}

/**
 * Whether an upload is an encrypted backup as the app makes it
 * (utils/onlineBackup.ts::encryptBackup): `FLBK1.`, a 12-byte IV and the
 * ciphertext with its 16-byte tag, both in base64url. Checked byte by byte,
 * without decoding the body to text.
 */
export function validBackupBody(bytes) {
  const ivStart = BACKUP_TAG.length;
  const ivEnd = ivStart + BACKUP_IV_CHARS;
  // At least the tag: an empty sync code would still carry it.
  if (bytes.byteLength < ivEnd + 1 + Math.ceil((GCM_TAG_BYTES * 4) / 3)) return false;
  for (let index = 0; index < ivStart; index += 1) {
    if (bytes[index] !== BACKUP_TAG.charCodeAt(index)) return false;
  }
  return base64UrlRun(bytes, ivStart, ivEnd)
    && bytes[ivEnd] === DOT
    && base64UrlRun(bytes, ivEnd + 1, bytes.byteLength);
}

const GZIP_BASE64_RE = /^H4sI[A-Za-z0-9+/]*={0,2}$/;

/**
 * Whether a published profile is in a form the app sends and the plugin reads
 * (FateLockedBundle.loadFromJson): `FLGZ:` and base64 gzip, which the app
 * sends whenever the browser can compress (every current one), or the bundle
 * as a plain JSON object, its fallback.
 */
export function validBundlePayload(payload) {
  if (typeof payload !== 'string') return false;
  if (payload.startsWith('FLGZ:')) {
    const encoded = payload.slice('FLGZ:'.length);
    return encoded.length % 4 === 0 && GZIP_BASE64_RE.test(encoded);
  }
  if (!payload.startsWith('{')) return false;
  try {
    const bundle = JSON.parse(payload);
    return bundle !== null && typeof bundle === 'object' && !Array.isArray(bundle);
  } catch {
    return false;
  }
}
