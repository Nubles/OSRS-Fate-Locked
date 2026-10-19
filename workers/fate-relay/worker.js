/**
 * Fate Locked online relay: the RuneLite profile (/r/), RuneLite's Send to
 * tracker events waiting for the tracker's Roll Inbox (/r/<code>/inbox),
 * Fate Locked badges (/r/<code>/badge, /badges), online backups (/b/),
 * shared progress for the Discord bot (/p/, /l/) and the web app's error
 * reports (/e). Every route id must have the exact shape its client makes,
 * and writes are rate-limited per IP, before any KV access.
 */
import {
  BACKUP_ID_RE,
  BACKUP_MIN_INTERVAL_MS,
  BACKUP_ROTATE_MS,
  BACKUP_TTL_SECONDS,
  BADGES_CACHE_SECONDS,
  DISCORD_ID_RE,
  INBOX_MAX_AGE_MS,
  INBOX_TTL_SECONDS,
  MAX_BACKUP_BYTES,
  MAX_BADGE_REQUEST_BYTES,
  MAX_INBOX_ACK_BYTES,
  MAX_INBOX_EVENT_BYTES,
  MAX_INBOX_HELD_BYTES,
  MAX_INBOX_HELD_EVENTS,
  MAX_INBOX_REQUEST_BYTES,
  MAX_REQUEST_BYTES,
  PAIRING_CODE_RE,
  PROGRESS_ID_RE,
  RUNELITE_EVENTS_FORMAT,
  inboxEventId,
  validBackupBody,
  validBadgeBody,
  validBundlePayload,
  validInboxAck,
  validInboxBatch,
} from './protocol.js';
import { BadgeWriteRefused, changeBadge, currentBadgeList, matchesEtag } from './badges.js';
import {
  LINK_CODE_TTL_SECONDS,
  MAX_PROGRESS_BYTES,
  PROGRESS_MIN_INTERVAL_MS,
  PROGRESS_TTL_SECONDS,
  newLinkCode,
  newUnlocksSince,
  normalizeLinkCode,
  validProgressSnapshot,
} from './progress.js';
import { MAX_ERROR_BYTES, errorReport, firstInWindow, forwardError } from './errors.js';

/**
 * A published profile lasts 30 days after the last publish, so RuneLite keeps
 * its rules between play sessions without the tracker open.
 */
const PROFILE_TTL_SECONDS = 30 * 86400;
const OWNER_TTL_SECONDS = 90 * 86400;
const OWNER_REFRESH_MS = 86400 * 1000;
// Versions count seconds from this instant. Never change it: clients hold
// versions across deploys and accept only a higher one.
const RELAY_VERSION_EPOCH_MS = Date.UTC(2026, 0, 1);
// Route shapes. The id each one names is checked against the exact form its
// client makes (protocol.js) before anything else.
const PROFILE_ROUTE = /^\/r\/([^/]*)$/;
const INBOX_ROUTE = /^\/r\/([^/]*)\/inbox(\/ack)?$/;
const BADGE_ROUTE = /^\/r\/([^/]*)\/badge$/;
const BACKUP_ROUTE = /^\/b\/([^/]*)(\/previous)?$/;
const PROGRESS_ROUTE = /^\/p\/([^/]*)(\/link-code)?$/;
const DISCORD_LINK_ROUTE = /^\/l\/([^/]*)$/;
// An online backup's write token: 32 bytes in base64url, derived from the
// player's backup code in the browser. The relay never sees the code or the key.
const BACKUP_TOKEN_RE = /^Bearer ([A-Za-z0-9_-]{43})$/;
// Which browser wrote a backup: 16 random bytes in base64url, made when it turned backup on.
const BACKUP_WRITER_RE = /^[A-Za-z0-9_-]{22}$/;

/**
 * Per-IP rate limits (Workers Rate Limiting bindings, wrangler.toml). Writes
 * cover every POST and DELETE from browsers; claims, the writes that create a
 * new record, have a tighter limit of their own. The Discord bot's routes are
 * not limited: they need its secret. Without a binding (tests, local
 * development) nothing is limited.
 */
const LIMITERS = {
  write: 'RELAY_WRITE_LIMITER',
  claim: 'RELAY_CLAIM_LIMITER',
  error: 'RELAY_ERROR_LIMITER',
};
const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

/** Whether `request`'s IP is within the named limit. Fails open: a missing or failing binding never refuses. */
async function withinLimit(env, kind, request) {
  const limiter = env?.[LIMITERS[kind]];
  if (!limiter || typeof limiter.limit !== 'function') return true;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await limiter.limit({ key: `${kind}:${ip}` });
    return success !== false;
  } catch {
    return true;
  }
}

function tooManyRequests(headers) {
  return new Response('too many requests', {
    status: 429,
    headers: { ...headers, 'Retry-After': String(RATE_LIMIT_RETRY_AFTER_SECONDS) },
  });
}

const badRequest = headers => new Response('bad request', { status: 400, headers });

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match, Authorization, X-Backup-Writer',
    'Access-Control-Expose-Headers': 'ETag, X-Backup-Updated-At',
    // Cache preflights (browsers cap this lower), so publishes and the
    // overlay's conditional polls don't each cost an extra OPTIONS request.
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
  };
}

function json(body, headers, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/**
 * Read at most `limit` bytes of the request body. Oversized uploads are
 * refused by their declared length, or cancelled once they pass the limit,
 * instead of being buffered in full before the size check.
 */
async function readBodyWithin(request, limit) {
  const bytes = await readBytesWithin(request, limit);
  return bytes === null ? null : new TextDecoder().decode(bytes);
}

/** The body's bytes, at most `limit` of them, as readBodyWithin reads them, or null when larger. */
async function readBytesWithin(request, limit) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * The version (and ETag) for a write: seconds since RELAY_VERSION_EPOCH_MS,
 * or one more than the stored version when that is higher. A plain counter
 * restarted at 1 when a record expired, so a client holding its ETag got 304
 * for new content, and RuneLite, which imports only a version above the one
 * it holds, kept the old profile. The clock keeps versions rising across
 * expiry; the stored version keeps writes within one second distinct. Seconds
 * since 2026 fit the plugin's Java int until 2094.
 */
function nextVersion(storedVersion) {
  const seconds = Math.floor((Date.now() - RELAY_VERSION_EPOCH_MS) / 1000);
  return Math.max(seconds, (storedVersion || 0) + 1);
}

/**
 * The version an If-None-Match header names. The ETag is the bare version,
 * which RuneLite sends back as it is; a quoted or weak validator ("41" or
 * W/"41") names the same version. Nothing else is parsed: a list of
 * validators or * stays as it is and never equals a version.
 */
function validatorVersion(header) {
  if (header === null) return null;
  const value = header.startsWith('W/') ? header.slice(2) : header;
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Who may write `key`. A separate owner record holds a SHA-256 hash of the
 * write token (never the token) for 90 days after the last refresh, so a code
 * stays claimed after its 30-day data record expires. Records written before
 * owner records existed are adopted on their owner's next write. `claim` marks
 * a write that takes a code nobody holds.
 */
async function authorizeWrite(env, key, existing, presented) {
  const owner = await env.RELAY.get(`own:${key}`);
  if (owner) {
    const [hash, refreshedAt] = owner.split(':');
    if (typeof presented !== 'string' || await tokenHash(presented) !== hash) return null;
    return { token: presented, refresh: !(Date.now() - Number(refreshedAt) < OWNER_REFRESH_MS), claim: false };
  }
  if (existing?.token && existing.token !== presented) return null;
  return { token: existing?.token || presented || crypto.randomUUID(), refresh: true, claim: !existing };
}

/**
 * Refresh the owner record after the data write, at most once a day to spare
 * KV writes. Best-effort: if it fails, the data record still holds the token
 * and the next write adopts it.
 */
async function recordOwner(env, key, owner) {
  if (!owner.refresh) return;
  try {
    await env.RELAY.put(`own:${key}`, `${await tokenHash(owner.token)}:${Date.now()}`,
      { expirationTtl: OWNER_TTL_SECONDS });
  } catch {
    /* adopted from the data record on the next write */
  }
}

/**
 * Online backups: a run's save, encrypted in the browser, under an id derived from the
 * player's backup code. The relay keeps the ciphertext as it arrives, with the SHA-256 of
 * the write token, the upload time and the writing browser as the record's metadata, so
 * an upload is one KV write and the large body is never parsed (the free plan allows
 * 10 ms of CPU a request). The first upload claims the id; later uploads and the delete
 * need the same token.
 *
 * The copy an upload replaces is kept as the previous copy when another browser wrote
 * it, so a browser with an older run can't erase newer progress, and otherwise when the
 * last such rotation was at least BACKUP_ROTATE_MS ago, so an upload of a damaged or
 * reset run can't replace the copy from a day before it. The rotation time travels in
 * the newest copy's metadata, so an upload that doesn't rotate still costs one KV write.
 * Each copy lasts 90 days after it was stored.
 */
async function backupRoute(request, env, headers, id, previous) {
  const key = `b:${id}`;
  const previousKey = `${key}:previous`;
  if (request.method === 'GET') {
    const { value, metadata } = await env.RELAY.getWithMetadata(previous ? previousKey : key, { type: 'stream' });
    if (value === null || !metadata) return json({}, headers, 404);
    return new Response(value, {
      headers: { ...headers, 'Content-Type': 'text/plain', 'X-Backup-Updated-At': String(metadata.updatedAt) },
    });
  }
  if (previous || (request.method !== 'POST' && request.method !== 'DELETE')) {
    return new Response('method not allowed', { status: 405, headers });
  }
  const token = (request.headers.get('Authorization') || '').match(BACKUP_TOKEN_RE)?.[1];
  if (!token) return new Response('forbidden', { status: 403, headers });
  let writer = null;
  let body = null;
  if (request.method === 'POST') {
    // The upload is checked in full before the relay looks anything up.
    writer = request.headers.get('X-Backup-Writer') || '';
    if (!BACKUP_WRITER_RE.test(writer)) return badRequest(headers);
    body = await readBytesWithin(request, MAX_BACKUP_BYTES);
    if (body === null) return new Response('payload too large', { status: 413, headers });
    if (!validBackupBody(body)) return badRequest(headers);
  }
  const writeHash = await tokenHash(token);
  const existing = await env.RELAY.getWithMetadata(key, { type: 'stream' });
  await existing.value?.cancel();
  if (existing.metadata && existing.metadata.writeHash !== writeHash) {
    return new Response('forbidden', { status: 403, headers });
  }
  if (request.method === 'DELETE') {
    await env.RELAY.delete(key);
    await env.RELAY.delete(previousKey);
    return json({ deleted: true }, headers);
  }
  const sinceLast = Date.now() - (existing.metadata?.updatedAt ?? 0);
  if (sinceLast < BACKUP_MIN_INTERVAL_MS) {
    return json({ updatedAt: existing.metadata.updatedAt }, headers, 429,
      { 'Retry-After': String(Math.ceil((BACKUP_MIN_INTERVAL_MS - sinceLast) / 1000)) });
  }
  if (!existing.metadata && !await withinLimit(env, 'claim', request)) return tooManyRequests(headers);
  const now = Date.now();
  // Copies stored before rotations were recorded rotate on their next upload.
  const rotate = Boolean(existing.metadata) && (existing.metadata.writer !== writer
    || !(now - (existing.metadata.rotatedAt ?? 0) < BACKUP_ROTATE_MS));
  if (rotate) {
    const replaced = await env.RELAY.get(key, { type: 'arrayBuffer' });
    if (replaced !== null) {
      await env.RELAY.put(previousKey, replaced, { expirationTtl: BACKUP_TTL_SECONDS, metadata: existing.metadata });
    }
  }
  // A new backup counts from its first upload, so its second doesn't rotate at once.
  const rotatedAt = rotate || !existing.metadata ? now : existing.metadata.rotatedAt;
  await env.RELAY.put(key, body, {
    expirationTtl: BACKUP_TTL_SECONDS,
    metadata: { writeHash, updatedAt: now, writer, rotatedAt },
  });
  return json({ updatedAt: now }, headers);
}

/**
 * Shared progress, written by the player's browser. The first publish claims the id with
 * its write token (kept as a SHA-256 hash in the record's metadata); later publishes, the
 * delete and link codes need the same token. Nothing here is readable without the bot's
 * secret: the bot reads a run only through a Discord link the player made with a code.
 */
async function progressRoute(request, env, headers, id, linkCode, ctx) {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return new Response('method not allowed', { status: 405, headers });
  }
  if (linkCode && request.method !== 'POST') return new Response('method not allowed', { status: 405, headers });
  const token = (request.headers.get('Authorization') || '').match(BACKUP_TOKEN_RE)?.[1];
  if (!token) return new Response('forbidden', { status: 403, headers });
  const publish = request.method === 'POST' && !linkCode;
  let snapshot = null;
  if (publish) {
    // The summary is checked before the relay looks anything up.
    const raw = await readBodyWithin(request, MAX_PROGRESS_BYTES);
    if (raw === null) return new Response('payload too large', { status: 413, headers });
    try {
      snapshot = validProgressSnapshot(JSON.parse(raw));
    } catch {
      snapshot = null;
    }
    if (!snapshot) return badRequest(headers);
  }
  const key = `p:${id}`;
  const writeHash = await tokenHash(token);
  const existing = await env.RELAY.getWithMetadata(key);
  if (existing.metadata && existing.metadata.writeHash !== writeHash) {
    return new Response('forbidden', { status: 403, headers });
  }

  if (request.method === 'DELETE') {
    await env.RELAY.delete(key);
    return json({ deleted: true }, headers);
  }

  if (linkCode) {
    // A code names a run that has been published, so the bot always has something to show.
    if (existing.value === null) return json({}, headers, 404);
    // Each code is a new record.
    if (!await withinLimit(env, 'claim', request)) return tooManyRequests(headers);
    const code = newLinkCode();
    await env.RELAY.put(`lc:${code}`, id, { expirationTtl: LINK_CODE_TTL_SECONDS });
    return json({ code, expiresAt: Date.now() + LINK_CODE_TTL_SECONDS * 1000 }, headers);
  }

  const sinceLast = Date.now() - (existing.metadata?.updatedAt ?? 0);
  if (sinceLast < PROGRESS_MIN_INTERVAL_MS) {
    return json({ updatedAt: existing.metadata.updatedAt }, headers, 429,
      { 'Retry-After': String(Math.ceil((PROGRESS_MIN_INTERVAL_MS - sinceLast) / 1000)) });
  }
  if (!existing.metadata && !await withinLimit(env, 'claim', request)) return tooManyRequests(headers);
  const updatedAt = Date.now();
  await env.RELAY.put(key, JSON.stringify(snapshot), {
    expirationTtl: PROGRESS_TTL_SECONDS,
    metadata: { writeHash, updatedAt },
  });
  let previous = null;
  try {
    previous = existing.value === null ? null : JSON.parse(existing.value);
  } catch {
    previous = null;
  }
  await inBackground(ctx, notifyDiscordBot(env, id, previous, snapshot, updatedAt));
  return json({ updatedAt }, headers);
}

/** Run `work` after the response when the runtime allows it, else before. */
async function inBackground(ctx, work) {
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(work);
  else await work;
}

const DISCORD_EVENTS_TIMEOUT_MS = 5000;

/**
 * Tell the Discord bot a linked run published, so it can post the run's new
 * unlocks in its feed and keep the player's roles current. Only a run some
 * Discord user linked is sent, and only to the bot's own https endpoint
 * (DISCORD_EVENTS_URL) with the bot's secret. A failure never fails the publish.
 */
async function notifyDiscordBot(env, runId, previous, snapshot, updatedAt) {
  const url = env.DISCORD_EVENTS_URL;
  const secret = env.PROGRESS_BOT_SECRET;
  if (typeof url !== 'string' || !url.startsWith('https://')) return;
  if (typeof secret !== 'string' || secret.length < 32) return;
  try {
    const discordId = await env.RELAY.get(`ld:${runId}`);
    if (discordId === null || await env.RELAY.get(`l:${discordId}`) !== runId) return;
    await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId, snapshot, newUnlocks: newUnlocksSince(previous, snapshot), updatedAt }),
      signal: AbortSignal.timeout(DISCORD_EVENTS_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('discord bot notify failed', error?.name ?? 'error');
  }
}

/** Whether the request carries the Discord bot's secret. Unset, nothing does. */
async function fromDiscordBot(request, env) {
  const secret = env.PROGRESS_BOT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) return false;
  const presented = (request.headers.get('Authorization') || '').match(/^Bearer (\S+)$/)?.[1];
  // Comparing hashes keeps the comparison's timing independent of the secret.
  return typeof presented === 'string' && await tokenHash(presented) === await tokenHash(secret);
}

/** The run a Discord user linked, as the bot shows it. */
async function linkedProgress(env, runId) {
  const { value, metadata } = await env.RELAY.getWithMetadata(`p:${runId}`, { type: 'json' });
  return value === null ? { linked: true, snapshot: null } : { linked: true, snapshot: value, updatedAt: metadata?.updatedAt ?? null };
}

/**
 * Discord links, for the bot only: POST claims a link code for a Discord user, GET reads
 * that user's shared progress, DELETE forgets the link. A link outlives the player turning
 * sharing off; the bot then reports that the run isn't shared.
 */
async function discordLinkRoute(request, env, headers, discordId) {
  if (!await fromDiscordBot(request, env)) return new Response('forbidden', { status: 403, headers });
  const key = `l:${discordId}`;
  if (request.method === 'GET') {
    const runId = await env.RELAY.get(key);
    if (runId === null) return json({ linked: false }, headers, 404);
    // Links made before the reverse index existed gain it the first time the bot reads them.
    if (await env.RELAY.get(`ld:${runId}`) === null) await env.RELAY.put(`ld:${runId}`, discordId);
    return json(await linkedProgress(env, runId), headers);
  }
  if (request.method === 'DELETE') {
    await forgetLink(env, discordId);
    return json({ deleted: true }, headers);
  }
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers });
  const raw = await readBodyWithin(request, 1024);
  let code = null;
  try {
    code = raw === null ? null : normalizeLinkCode(JSON.parse(raw)?.code);
  } catch {
    code = null;
  }
  if (!code) return new Response('bad request', { status: 400, headers });
  const runId = await env.RELAY.get(`lc:${code}`);
  if (runId === null) return json({ error: 'unknown code' }, headers, 404);
  await env.RELAY.delete(`lc:${code}`);
  await forgetLink(env, discordId);
  await env.RELAY.put(key, runId);
  // The reverse index lets a publish find who to tell; the newest link to a run wins.
  await env.RELAY.put(`ld:${runId}`, discordId);
  return json(await linkedProgress(env, runId), headers);
}

/** Drop a Discord user's link, and the run's pointer back to them when it is theirs. */
async function forgetLink(env, discordId) {
  const runId = await env.RELAY.get(`l:${discordId}`);
  if (runId === null) return;
  await env.RELAY.delete(`l:${discordId}`);
  if (await env.RELAY.get(`ld:${runId}`) === discordId) await env.RELAY.delete(`ld:${runId}`);
}

/** A write token as clients send it: the tracker's 36 hex digits, or a UUID the relay issued. Bounded so a body can't store anything else in it. */
const PROFILE_TOKEN_RE = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * The RuneLite profile for a pairing code. The browser publishes it (or marks
 * the code gone); RuneLite and the stream overlay read it, with ETags.
 */
async function profileRoute(request, env, headers, code) {
  const key = `r:${code}`;

  if (request.method === 'GET') {
    const stored = await env.RELAY.get(key, { type: 'json' });
    if (!stored) return json({}, headers, 404);
    // The owner disconnected the code. A 404, as for a code with no
    // profile, never a 410: the installed plugin builds read a 404 as a
    // missing profile but back off from a 410 as an outage. No validator
    // is consulted, since a tombstone has no content to be unchanged.
    if (stored.gone === true) return json({ gone: true }, headers, 404);
    if (validatorVersion(request.headers.get('If-None-Match')) === String(stored.version)) {
      return new Response(null, {
        status: 304,
        headers: { ...headers, ETag: String(stored.version) },
      });
    }
    return json({ version: stored.version, payload: stored.payload }, headers, 200,
      { ETag: String(stored.version) });
  }

  if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers });
  const rawBody = await readBodyWithin(request, MAX_REQUEST_BYTES);
  if (rawBody === null) {
    return new Response('payload too large', { status: 413, headers });
  }
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return badRequest(headers);
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(headers);
  if (body.token !== undefined && !(typeof body.token === 'string' && PROFILE_TOKEN_RE.test(body.token))) {
    return badRequest(headers);
  }
  const gone = body.gone === true;
  if (!gone && !validBundlePayload(body.payload)) return badRequest(headers);

  const existing = await env.RELAY.get(key, { type: 'json' });
  const owner = await authorizeWrite(env, key, existing, body.token);
  if (!owner) return new Response('forbidden', { status: 403, headers });
  if (owner.claim && !await withinLimit(env, 'claim', request)) return tooManyRequests(headers);
  const version = nextVersion(existing?.version);

  if (gone) {
    // The owner's Disconnect: the profile gives way to a tombstone that
    // holds no profile data, only the version and the token. It lasts
    // 90 days, like an owner record, so RuneLite keeps being told the
    // code is gone instead of seeing it expire into "no profile". A later
    // publish with the owner's token replaces it as usual.
    await env.RELAY.put(key, JSON.stringify({ gone: true, version, token: owner.token }),
      { expirationTtl: OWNER_TTL_SECONDS });
    await recordOwner(env, key, owner);
    return json({ version, gone: true }, headers);
  }

  await env.RELAY.put(key, JSON.stringify({ version, payload: body.payload, token: owner.token }),
    { expirationTtl: PROFILE_TTL_SECONDS });
  await recordOwner(env, key, owner);
  return json({ version, token: owner.token }, headers);
}

/** The tracker's write token for a pairing code, as it sends it to read or empty the code's inbox. */
const PROFILE_BEARER_RE = /^Bearer ([A-Za-z0-9_-]{1,128})$/;
/** A tombstone is about 100 bytes; anything longer is a profile, whose text needn't be parsed. */
const MAX_TOMBSTONE_CHARS = 1024;

const noProfile = headers => json({ error: 'no profile' }, headers, 404);
const forbidden = headers => new Response('forbidden', { status: 403, headers });
const methodNotAllowed = headers => new Response('method not allowed', { status: 405, headers });
const tooLarge = headers => new Response('payload too large', { status: 413, headers });
const byteLength = text => new TextEncoder().encode(text).byteLength;

/**
 * The stored profile record of a pairing code as text, or null when it has
 * none or its owner marked it gone. Sends and badges need a live profile.
 * The large profile text is never parsed here: only a record short enough
 * to be a tombstone is.
 */
async function liveProfile(env, code) {
  const text = await env.RELAY.get(`r:${code}`);
  if (text === null) return null;
  if (text.length <= MAX_TOMBSTONE_CHARS) {
    try {
      if (JSON.parse(text)?.gone === true) return null;
    } catch {
      return null;
    }
  }
  return text;
}

/**
 * Whether `presented` is the code's write token, as authorizeWrite checks a
 * publish: against the owner record's hash, or, for a code published before
 * owner records existed, the token in the profile record. Reads nothing new.
 */
async function ownsCode(env, code, profileText, presented) {
  const owner = await env.RELAY.get(`own:r:${code}`);
  if (owner) return await tokenHash(presented) === owner.split(':')[0];
  try {
    const token = JSON.parse(profileText)?.token;
    return typeof token === 'string' && token === presented;
  } catch {
    return false;
  }
}

/** The events held in an inbox record `{"events":[...]}`; none when it is missing or unreadable. */
function heldEvents(stored) {
  if (stored === null) return [];
  try {
    const events = JSON.parse(stored)?.events;
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

/** Whether a held event is still young enough for the tracker to take. */
const stillTakeable = (event, now) => Number.isSafeInteger(event?.occurredAt)
  && event.occurredAt >= now - INBOX_MAX_AGE_MS;

/**
 * Send to tracker: RuneLite's events wait under `ri:<code>` until the
 * tracker takes them into its Roll Inbox, where the player still chooses to
 * roll. RuneLite sends what Copy for tracker copies; anyone holding the code
 * can add to it, but only the code's write token (the tracker) can read or
 * empty it. Events merge by id, a re-sent id replacing the held copy; the
 * newest 250 are kept, within 256 KiB, for 30 days after the last send.
 */
async function inboxRoute(request, env, headers, code, ack) {
  const allowed = ack ? request.method === 'POST' : request.method === 'POST' || request.method === 'GET';
  if (!allowed) return methodNotAllowed(headers);
  const key = `ri:${code}`;

  if (request.method === 'POST' && !ack) {
    // The batch is checked in full before the relay looks anything up.
    const raw = await readBodyWithin(request, MAX_INBOX_REQUEST_BYTES);
    if (raw === null) return tooLarge(headers);
    const now = Date.now();
    let events = null;
    try {
      events = validInboxBatch(JSON.parse(raw), now);
    } catch {
      events = null;
    }
    if (!events) return badRequest(headers);
    if (await liveProfile(env, code) === null) return noProfile(headers);

    const sent = new Map();
    for (const event of events) {
      const text = JSON.stringify(event);
      const bytes = byteLength(text);
      // One the tracker can't read is never held. A repeated id: the last copy counts.
      if (bytes <= MAX_INBOX_EVENT_BYTES) sent.set(inboxEventId(event), { event, text, bytes });
      else sent.delete(inboxEventId(event));
    }
    const stored = await env.RELAY.get(key);
    const merged = new Map();
    for (const event of heldEvents(stored)) {
      const id = inboxEventId(event);
      if (typeof id !== 'string' || sent.has(id) || !stillTakeable(event, now)) continue;
      const text = JSON.stringify(event);
      merged.set(id, { event, text, bytes: byteLength(text) });
    }
    for (const [id, entry] of sent) merged.set(id, entry);

    // The newest first, until the count or the size is reached; then oldest first again.
    const kept = [];
    let total = 0;
    for (const entry of [...merged.values()].sort((a, b) => b.event.occurredAt - a.event.occurredAt)) {
      if (kept.length >= MAX_INBOX_HELD_EVENTS || total + entry.bytes + 1 > MAX_INBOX_HELD_BYTES) break;
      total += entry.bytes + 1;
      kept.push(entry);
    }
    kept.reverse();
    const accepted = kept.filter(entry => sent.get(inboxEventId(entry.event)) === entry).length;
    if (kept.length > 0) {
      await env.RELAY.put(key, `{"events":[${kept.map(entry => entry.text).join(',')}]}`,
        { expirationTtl: INBOX_TTL_SECONDS });
    } else if (stored !== null) {
      await env.RELAY.delete(key);
    }
    return json({ accepted, held: kept.length }, headers);
  }

  // Reading and emptying the inbox are the tracker's, with the code's write token.
  const token = (request.headers.get('Authorization') || '').match(PROFILE_BEARER_RE)?.[1];
  if (!token) return forbidden(headers);
  let ids = null;
  if (ack) {
    const raw = await readBodyWithin(request, MAX_INBOX_ACK_BYTES);
    if (raw === null) return tooLarge(headers);
    try {
      ids = validInboxAck(JSON.parse(raw));
    } catch {
      ids = null;
    }
    if (!ids) return badRequest(headers);
  }
  const profile = await liveProfile(env, code);
  if (profile === null) return noProfile(headers);
  if (!await ownsCode(env, code, profile, token)) return forbidden(headers);
  const stored = await env.RELAY.get(key);

  if (!ack) {
    // Served as stored, `{"events":[...]}` with the format in front, without parsing it.
    const body = stored !== null && stored.startsWith('{"events":')
      ? `{"format":"${RUNELITE_EVENTS_FORMAT}",${stored.slice(1)}`
      : JSON.stringify({ format: RUNELITE_EVENTS_FORMAT, events: [] });
    return new Response(body, { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (stored === null) return json({ held: 0 }, headers);
  const taken = new Set(ids);
  const now = Date.now();
  const events = heldEvents(stored);
  const left = events.filter(event => !taken.has(inboxEventId(event)) && stillTakeable(event, now));
  if (left.length === 0) {
    await env.RELAY.delete(key);
  } else if (left.length < events.length) {
    await env.RELAY.put(key, JSON.stringify({ events: left }), { expirationTtl: INBOX_TTL_SECONDS });
  }
  return json({ held: left.length }, headers);
}

/**
 * The badge list's record couldn't take a change (KV was busy or failed, or
 * the list is full): 503, which the plugin reads as "try again later".
 */
function badgeNotStored(headers) {
  return new Response('relay busy', {
    status: 503,
    headers: { ...headers, 'Retry-After': String(RATE_LIMIT_RETRY_AFTER_SECONDS) },
  });
}

/**
 * A Fate Locked badge: the plugin's character name and milestone, kept in
 * the one badge list record (badges.js) for 30 days after the plugin last
 * sent it. One badge per code; a new one replaces it. Posting needs a live
 * profile; removing it (sharing turned off, or Disconnect) never does.
 */
async function badgeRoute(request, env, headers, code) {
  if (request.method === 'DELETE') {
    try {
      await changeBadge(env.RELAY, code, null, Date.now());
    } catch (error) {
      if (error instanceof BadgeWriteRefused) return badgeNotStored(headers);
      throw error;
    }
    return json({ deleted: true }, headers);
  }
  if (request.method !== 'POST') return methodNotAllowed(headers);
  const raw = await readBodyWithin(request, MAX_BADGE_REQUEST_BYTES);
  if (raw === null) return tooLarge(headers);
  let badge = null;
  try {
    badge = validBadgeBody(JSON.parse(raw));
  } catch {
    badge = null;
  }
  if (!badge) return badRequest(headers);
  if (await liveProfile(env, code) === null) return noProfile(headers);
  try {
    await changeBadge(env.RELAY, code, badge, Date.now());
  } catch (error) {
    if (error instanceof BadgeWriteRefused) return badgeNotStored(headers);
    throw error;
  }
  return json({ ok: true }, headers);
}

/**
 * The public badge list (badges.js), the same for everyone, so caches may
 * keep it: 10 minutes, with an ETag of its body for If-None-Match. One KV
 * read at most, never a list operation.
 */
async function badgesRoute(request, env, headers) {
  if (request.method !== 'GET') return methodNotAllowed(headers);
  const { body, etag } = await currentBadgeList(env);
  const cacheable = {
    ...headers,
    'Cache-Control': `public, max-age=${BADGES_CACHE_SECONDS}`,
    ETag: etag,
    Vary: 'Origin',
  };
  if (matchesEtag(request.headers.get('If-None-Match'), etag)) {
    return new Response(null, { status: 304, headers: cacheable });
  }
  return new Response(body, { headers: { ...cacheable, 'Content-Type': 'application/json' } });
}

/**
 * Error reports from the web app: always 204 at once, whatever the body, and
 * nothing stored. A report is forwarded after the response, at most once per
 * message and build in ERROR_DEDUPE_MS. Browsers may send it as a beacon
 * (text/plain), so any content type is read as JSON.
 */
async function errorRoute(request, env, headers, ctx) {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers });
  const accepted = new Response(null, { status: 204, headers });
  if (!await withinLimit(env, 'error', request)) return accepted;
  const raw = await readBodyWithin(request, MAX_ERROR_BYTES);
  const report = raw === null ? null : errorReport(raw);
  if (report && firstInWindow(report)) await inBackground(ctx, forwardError(env, report));
  return accepted;
}

/**
 * Whether a request changes something on the relay, and so counts toward the
 * write limit: publishes, sends to the tracker and their acknowledgements,
 * badges, backups and shared progress.
 */
const isWrite = method => method === 'POST' || method === 'DELETE';

const routes = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = cors(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') return new Response(null, { headers });

    if (url.pathname === '/e') return errorRoute(request, env, headers, ctx);

    const discordLink = url.pathname.match(DISCORD_LINK_ROUTE);
    if (discordLink) {
      if (!DISCORD_ID_RE.test(discordLink[1])) return badRequest(headers);
      return discordLinkRoute(request, env, headers, discordLink[1]);
    }

    if (url.pathname === '/badges') return badgesRoute(request, env, headers);

    const profile = url.pathname.match(PROFILE_ROUTE);
    const inbox = url.pathname.match(INBOX_ROUTE);
    const badge = url.pathname.match(BADGE_ROUTE);
    const backup = url.pathname.match(BACKUP_ROUTE);
    const progress = url.pathname.match(PROGRESS_ROUTE);
    const code = (profile || inbox || badge)?.[1];
    if (code === undefined && !backup && !progress) return new Response('not found', { status: 404, headers });
    if ((code !== undefined && !PAIRING_CODE_RE.test(code))
      || (backup && !BACKUP_ID_RE.test(backup[1]))
      || (progress && !PROGRESS_ID_RE.test(progress[1]))) {
      return badRequest(headers);
    }
    if (isWrite(request.method) && !await withinLimit(env, 'write', request)) return tooManyRequests(headers);

    if (backup) return backupRoute(request, env, headers, backup[1], Boolean(backup[2]));
    if (progress) return progressRoute(request, env, headers, progress[1], Boolean(progress[2]), ctx);
    if (inbox) return inboxRoute(request, env, headers, code, Boolean(inbox[2]));
    if (badge) return badgeRoute(request, env, headers, code);
    return profileRoute(request, env, headers, code);
  },
};

export default {
  /**
   * An unexpected failure, such as a KV outage, answers 503 with the CORS
   * headers. Without them the browser hides the status and reports only
   * "Failed to fetch".
   */
  async fetch(request, env, ctx) {
    try {
      return await routes.fetch(request, env, ctx);
    } catch (error) {
      console.error('relay request failed', error);
      return new Response('relay unavailable', {
        status: 503,
        headers: cors(request.headers.get('Origin')),
      });
    }
  },
};