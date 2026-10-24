/**
 * Fate Locked online relay: the RuneLite profile (/r/), online backups (/b/),
 * shared progress for the Discord bot (/p/, /l/) and the web app's error
 * reports (/e). Every route id must have the exact shape its client makes,
 * and writes are rate-limited per IP, before any KV access.
 */
import {
  BACKUP_ID_RE,
  BACKUP_MIN_INTERVAL_MS,
  BACKUP_ROTATE_MS,
  BACKUP_TTL_SECONDS,
  DISCORD_ID_RE,
  MAX_BACKUP_BYTES,
  MAX_REQUEST_BYTES,
  PAIRING_CODE_RE,
  PROGRESS_ID_RE,
  validBackupBody,
  validBundlePayload,
} from './protocol.js';
import {
  LINK_CODE_TTL_SECONDS,
  MAX_PROGRESS_BYTES,
  PROGRESS_MIN_INTERVAL_MS,
  PROGRESS_TTL_SECONDS,
  PROGRESS_UNCHANGED_REFRESH_MS,
  newLinkCode,
  feedForPublish,
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
/**
 * A publish refreshes the owner record at most this often: each refresh is a
 * KV write, and a week still leaves a code held at least 83 days after its
 * last publish.
 */
const OWNER_REFRESH_MS = 7 * 86400 * 1000;
// Versions count seconds from this instant. Never change it: clients hold
// versions across deploys and accept only a higher one.
const RELAY_VERSION_EPOCH_MS = Date.UTC(2026, 0, 1);
// Route shapes. The id each one names is checked against the exact form its
// client makes (protocol.js) before anything else.
const PROFILE_ROUTE = /^\/r\/([^/]*)$/;
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
 * stays claimed after its 30-day data record expires; publishes refresh it
 * at most once a week. Records written before
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
 * Refresh the owner record after the data write, at most once a week
 * (OWNER_REFRESH_MS) to spare KV writes. Best-effort: if it fails, the data record still holds the token
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

  // The summary the relay already holds (a reload, or a change the summary
  // doesn't show): no KV write, and nothing new for the bot. It is stored
  // again once a month, so a run shared but unchanged doesn't expire.
  if (unchangedProgress(existing, snapshot, Date.now())) {
    return json({ updatedAt: existing.metadata.updatedAt, unchanged: true }, headers);
  }

  const sinceLast = Date.now() - (existing.metadata?.updatedAt ?? 0);
  if (sinceLast < PROGRESS_MIN_INTERVAL_MS) {
    return json({ updatedAt: existing.metadata.updatedAt }, headers, 429,
      { 'Retry-After': String(Math.ceil((PROGRESS_MIN_INTERVAL_MS - sinceLast) / 1000)) });
  }
  if (!existing.metadata && !await withinLimit(env, 'claim', request)) return tooManyRequests(headers);
  const updatedAt = Date.now();
  let previous = null;
  try {
    previous = existing.value === null ? null : JSON.parse(existing.value);
  } catch {
    previous = null;
  }
  // The feed's limits ride in the metadata this write stores anyway.
  const feed = feedForPublish(existing.metadata, previous, snapshot, updatedAt);
  await env.RELAY.put(key, JSON.stringify(snapshot), {
    expirationTtl: PROGRESS_TTL_SECONDS,
    metadata: { writeHash, updatedAt, ...feed.meta },
  });
  await inBackground(ctx, notifyDiscordBot(env, id, feed.newUnlocks, snapshot, updatedAt));
  return json({ updatedAt }, headers);
}

/**
 * Whether a progress publish would store exactly the summary the record holds,
 * stored under PROGRESS_UNCHANGED_REFRESH_MS ago. The relay stores the
 * summary validProgressSnapshot builds, whose fields are always in one order,
 * so the stored text is compared as it is: no extra KV read, no parsing.
 */
function unchangedProgress(existing, snapshot, now) {
  const updatedAt = existing.metadata?.updatedAt;
  return typeof existing.value === 'string'
    && Number.isFinite(updatedAt)
    && now >= updatedAt
    && now - updatedAt < PROGRESS_UNCHANGED_REFRESH_MS
    && existing.value === JSON.stringify(snapshot);
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
 * (DISCORD_EVENTS_URL) with the bot's secret, carrying the unlocks feedForPublish
 * let through. A failure never fails the publish.
 */
async function notifyDiscordBot(env, runId, newUnlocks, snapshot, updatedAt) {
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
      body: JSON.stringify({ discordId, snapshot, newUnlocks, updatedAt }),
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

/** Whether a request changes something on the relay, and so counts toward the write limit. */
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

    const profile = url.pathname.match(PROFILE_ROUTE);
    const backup = url.pathname.match(BACKUP_ROUTE);
    const progress = url.pathname.match(PROGRESS_ROUTE);
    if (!profile && !backup && !progress) return new Response('not found', { status: 404, headers });
    if ((profile && !PAIRING_CODE_RE.test(profile[1]))
      || (backup && !BACKUP_ID_RE.test(backup[1]))
      || (progress && !PROGRESS_ID_RE.test(progress[1]))) {
      return badRequest(headers);
    }
    if (isWrite(request.method) && !await withinLimit(env, 'write', request)) return tooManyRequests(headers);

    if (backup) return backupRoute(request, env, headers, backup[1], Boolean(backup[2]));
    if (progress) return progressRoute(request, env, headers, progress[1], Boolean(progress[2]), ctx);
    return profileRoute(request, env, headers, profile[1]);
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