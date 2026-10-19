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

/** What RuneLite's Copy for tracker and Send to tracker send: `{ format, events }`. */
export const RUNELITE_EVENTS_FORMAT = 'fate-locked-runelite-events';
/** Send to tracker: the largest POST /r/<code>/inbox body, and how many events it may carry. */
export const MAX_INBOX_REQUEST_BYTES = 64 * 1024;
export const MAX_INBOX_EVENTS_PER_REQUEST = 100;
/**
 * The relay holds the newest this many events per code, as many as the
 * tracker's Paste from RuneLite takes (MAX_PASTED_EVENTS, utils/runelitePaste.ts).
 */
export const MAX_INBOX_HELD_EVENTS = 250;
/**
 * The most the held events may take together, oldest dropped first. A real
 * event is well under 1 KiB, so 250 of them fit; the bound keeps every read
 * and rewrite of the inbox small enough for the free plan's 10 ms of CPU.
 */
export const MAX_INBOX_HELD_BYTES = 256 * 1024;
/** The largest event kept: the tracker can't read a bigger one (MAX_EVENT_BYTES, services/fateEventProtocol.ts). */
export const MAX_INBOX_EVENT_BYTES = 8 * 1024;
export const MAX_INBOX_EVENT_ID_CHARS = 128;
/** Waiting events last this long after the last Send to tracker; the tracker refuses older events anyway. */
export const INBOX_TTL_SECONDS = 30 * 86400;
export const INBOX_MAX_AGE_MS = 30 * 86400 * 1000;
export const INBOX_MAX_AHEAD_MS = 10 * 60 * 1000;
/** The largest POST /r/<code>/inbox/ack body: 250 ids of 128 characters, quoted, with room to spare. */
export const MAX_INBOX_ACK_BYTES = 40 * 1024;

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * An event's id. RuneLite's events carry it as `eventId` (FateEvent.java and
 * services/fateEventProtocol.ts); `id` is read when an event has no
 * `eventId`, so a client that names it `id` is understood too.
 */
export function inboxEventId(event) {
  return isPlainObject(event) ? ('eventId' in event ? event.eventId : event.id) : undefined;
}

const validEventId = id => typeof id === 'string' && id.length >= 1 && id.length <= MAX_INBOX_EVENT_ID_CHARS;

/**
 * The events of a Send to tracker, or null when the body isn't one: the
 * format RuneLite copies, 1 to 100 events, each an object with an id of 1 to
 * 128 characters and an `occurredAt` in ms that is at most 30 days old and
 * at most 10 minutes ahead of `now`. Every other field passes through as it
 * came; the tracker checks each event as it checks a paste.
 */
export function validInboxBatch(body, now) {
  if (!isPlainObject(body) || body.format !== RUNELITE_EVENTS_FORMAT || !Array.isArray(body.events)) return null;
  const { events } = body;
  if (events.length < 1 || events.length > MAX_INBOX_EVENTS_PER_REQUEST) return null;
  for (const event of events) {
    if (!validEventId(inboxEventId(event))) return null;
    const at = event.occurredAt;
    if (!Number.isSafeInteger(at) || at < now - INBOX_MAX_AGE_MS || at > now + INBOX_MAX_AHEAD_MS) return null;
  }
  return events;
}

/** The ids an acknowledgement names, `{ ids: [...] }` with up to 250 ids, or null. */
export function validInboxAck(body) {
  if (!isPlainObject(body) || !Array.isArray(body.ids) || body.ids.length > MAX_INBOX_HELD_EVENTS) return null;
  return body.ids.every(validEventId) ? body.ids : null;
}

/** Fate Locked badges: the milestones, 0 (under 25%) to 4 (Fate Unbound, 100%). */
export const MAX_BADGE_TIER = 4;
/** An OSRS display name as the plugin sends it: up to 12 letters, digits, spaces, '-' and '_'. */
export const BADGE_NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/;
export const MAX_BADGE_REQUEST_BYTES = 1024;
/** A badge lasts this long after the plugin last sent it (it resends at least daily). */
export const BADGE_TTL_SECONDS = 30 * 86400;
/** GET /badges lists at most this many. */
export const MAX_BADGES = 5000;
/** How long a built badge list is served before it is built again. */
export const BADGES_CACHE_SECONDS = 600;

/** A badge `{ n, t }` from a POST /r/<code>/badge body `{ name, tier }`, or null. The name is trimmed. */
export function validBadgeBody(body) {
  if (!isPlainObject(body) || typeof body.name !== 'string') return null;
  const n = body.name.trim();
  const t = body.tier;
  if (!BADGE_NAME_RE.test(n) || !Number.isInteger(t) || t < 0 || t > MAX_BADGE_TIER) return null;
  return { n, t };
}
