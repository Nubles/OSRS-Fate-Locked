/**
 * Fate Locked online relay — outbound-only bundle sync plus durable event queues.
 * Legacy /r/:code, /state, and /suggest resources remain compatible.
 */
import {
  BACKUP_MIN_INTERVAL_MS,
  BACKUP_TTL_SECONDS,
  EVENT_TTL_SECONDS,
  MAX_BACKUP_BYTES,
  MAX_REQUEST_BYTES,
  appendUnique,
  appendUniqueNewest,
  validAcknowledgement,
  validEvent,
} from './protocol.js';
import {
  LINK_CODE_TTL_SECONDS,
  MAX_PROGRESS_BYTES,
  PROGRESS_MIN_INTERVAL_MS,
  PROGRESS_TTL_SECONDS,
  newLinkCode,
  normalizeLinkCode,
  validProgressSnapshot,
} from './progress.js';

const TTL_SECONDS = 86400;
const OWNER_TTL_SECONDS = 90 * 86400;
const OWNER_REFRESH_MS = 86400 * 1000;
// Versions count seconds from this instant. Never change it: clients hold
// versions across deploys and accept only a higher one.
const RELAY_VERSION_EPOCH_MS = Date.UTC(2026, 0, 1);
const CODE_RE = /^\/r\/([A-Za-z0-9-]{4,40})(\/state|\/suggest|\/events|\/acks)?$/;
// An online backup's id and write token: 32 bytes each, in base64url, derived from the
// player's backup code in the browser. The relay never sees the code or the key.
const BACKUP_RE = /^\/b\/([A-Za-z0-9_-]{43})(\/previous)?$/;
const BACKUP_TOKEN_RE = /^Bearer ([A-Za-z0-9_-]{43})$/;
// Which browser wrote a backup: 16 random bytes in base64url, made when it turned backup on.
const BACKUP_WRITER_RE = /^[A-Za-z0-9_-]{22}$/;
const BACKUP_PREFIX = new TextEncoder().encode('FLBK1.');
// Shared progress: 16 random bytes in base64url, made in the browser when the player
// turns sharing on. Its write token has the backup token's shape.
const PROGRESS_RE = /^\/p\/([A-Za-z0-9_-]{22})(\/link-code)?$/;
// A Discord user id. Only the Discord bot, holding PROGRESS_BOT_SECRET, reaches these.
const DISCORD_LINK_RE = /^\/l\/(\d{17,20})$/;

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

function structuredResource(resource) {
  if (resource === '/events') {
    return { field: 'events', validate: validEvent, retainNewest: false };
  }
  if (resource === '/acks') {
    return { field: 'acknowledgements', validate: validAcknowledgement, retainNewest: true };
  }
  return null;
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
 * stays claimed after its 24-hour data record expires. Records written before
 * owner records existed are adopted on their owner's next write.
 */
async function authorizeWrite(env, key, existing, presented) {
  const owner = await env.RELAY.get(`own:${key}`);
  if (owner) {
    const [hash, refreshedAt] = owner.split(':');
    if (typeof presented !== 'string' || await tokenHash(presented) !== hash) return null;
    return { token: presented, refresh: !(Date.now() - Number(refreshedAt) < OWNER_REFRESH_MS) };
  }
  if (existing?.token && existing.token !== presented) return null;
  return { token: existing?.token || presented || crypto.randomUUID(), refresh: true };
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
 * need the same token. When another browser uploads, the copy it replaces is kept as the
 * previous copy, so a browser with an older run can't erase newer progress. Each copy
 * lasts 90 days after it was stored.
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
  const writer = request.headers.get('X-Backup-Writer') || '';
  if (!BACKUP_WRITER_RE.test(writer)) return new Response('bad request', { status: 400, headers });
  const body = await readBytesWithin(request, MAX_BACKUP_BYTES);
  if (body === null) return new Response('payload too large', { status: 413, headers });
  if (body.byteLength <= BACKUP_PREFIX.byteLength
    || BACKUP_PREFIX.some((byte, index) => body[index] !== byte)) {
    return new Response('bad request', { status: 400, headers });
  }
  const sinceLast = Date.now() - (existing.metadata?.updatedAt ?? 0);
  if (sinceLast < BACKUP_MIN_INTERVAL_MS) {
    return json({ updatedAt: existing.metadata.updatedAt }, headers, 429,
      { 'Retry-After': String(Math.ceil((BACKUP_MIN_INTERVAL_MS - sinceLast) / 1000)) });
  }
  if (existing.metadata && existing.metadata.writer !== writer) {
    const replaced = await env.RELAY.get(key, { type: 'arrayBuffer' });
    if (replaced !== null) {
      await env.RELAY.put(previousKey, replaced, { expirationTtl: BACKUP_TTL_SECONDS, metadata: existing.metadata });
    }
  }
  const updatedAt = Date.now();
  await env.RELAY.put(key, body, { expirationTtl: BACKUP_TTL_SECONDS, metadata: { writeHash, updatedAt, writer } });
  return json({ updatedAt }, headers);
}

/**
 * Shared progress, written by the player's browser. The first publish claims the id with
 * its write token (kept as a SHA-256 hash in the record's metadata); later publishes, the
 * delete and link codes need the same token. Nothing here is readable without the bot's
 * secret: the bot reads a run only through a Discord link the player made with a code.
 */
async function progressRoute(request, env, headers, id, linkCode) {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return new Response('method not allowed', { status: 405, headers });
  }
  if (linkCode && request.method !== 'POST') return new Response('method not allowed', { status: 405, headers });
  const token = (request.headers.get('Authorization') || '').match(BACKUP_TOKEN_RE)?.[1];
  if (!token) return new Response('forbidden', { status: 403, headers });
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
    const code = newLinkCode();
    await env.RELAY.put(`lc:${code}`, id, { expirationTtl: LINK_CODE_TTL_SECONDS });
    return json({ code, expiresAt: Date.now() + LINK_CODE_TTL_SECONDS * 1000 }, headers);
  }

  const raw = await readBodyWithin(request, MAX_PROGRESS_BYTES);
  if (raw === null) return new Response('payload too large', { status: 413, headers });
  let snapshot;
  try {
    snapshot = validProgressSnapshot(JSON.parse(raw));
  } catch {
    snapshot = null;
  }
  if (!snapshot) return new Response('bad request', { status: 400, headers });
  const sinceLast = Date.now() - (existing.metadata?.updatedAt ?? 0);
  if (sinceLast < PROGRESS_MIN_INTERVAL_MS) {
    return json({ updatedAt: existing.metadata.updatedAt }, headers, 429,
      { 'Retry-After': String(Math.ceil((PROGRESS_MIN_INTERVAL_MS - sinceLast) / 1000)) });
  }
  const updatedAt = Date.now();
  await env.RELAY.put(key, JSON.stringify(snapshot), {
    expirationTtl: PROGRESS_TTL_SECONDS,
    metadata: { writeHash, updatedAt },
  });
  return json({ updatedAt }, headers);
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
    return json(await linkedProgress(env, runId), headers);
  }
  if (request.method === 'DELETE') {
    await env.RELAY.delete(key);
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
  await env.RELAY.put(key, runId);
  return json(await linkedProgress(env, runId), headers);
}

const routes = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') return new Response(null, { headers });

    const backup = url.pathname.match(BACKUP_RE);
    if (backup) return backupRoute(request, env, headers, backup[1], Boolean(backup[2]));

    const progress = url.pathname.match(PROGRESS_RE);
    if (progress) return progressRoute(request, env, headers, progress[1], Boolean(progress[2]));

    const discordLink = url.pathname.match(DISCORD_LINK_RE);
    if (discordLink) return discordLinkRoute(request, env, headers, discordLink[1]);

    const match = url.pathname.match(CODE_RE);
    if (!match) return new Response('not found', { status: 404, headers });
    const resource = match[2] || '';
    const key = `r:${match[1]}${resource}`;
    const structured = structuredResource(resource);

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
      const body = structured
        ? { version: stored.version, [structured.field]: stored.records || [] }
        : { version: stored.version, payload: stored.payload };
      return json(body, headers, 200, { ETag: String(stored.version) });
    }

    if (request.method === 'POST') {
      const rawBody = await readBodyWithin(request, MAX_REQUEST_BYTES);
      if (rawBody === null) {
        return new Response('payload too large', { status: 413, headers });
      }
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return new Response('bad request', { status: 400, headers });
      }

      if (structured) {
        const incoming = body && body[structured.field];
        if (!Array.isArray(incoming) || incoming.length > 100
          || !incoming.every(structured.validate)) {
          return new Response('bad request', { status: 400, headers });
        }
        const existing = await env.RELAY.get(key, { type: 'json' });
        const owner = await authorizeWrite(env, key, existing, body.token);
        if (!owner) return new Response('forbidden', { status: 403, headers });
        const token = owner.token;
        const version = nextVersion(existing?.version);
        const appended = structured.retainNewest
          ? appendUniqueNewest(existing?.records || [], incoming)
          : appendUnique(existing?.records || [], incoming);
        await env.RELAY.put(key, JSON.stringify({
          version,
          token,
          records: appended.records,
        }), { expirationTtl: EVENT_TTL_SECONDS });
        await recordOwner(env, key, owner);

        if (resource === '/acks') {
          const eventKey = `r:${match[1]}/events`;
          const eventQueue = await env.RELAY.get(eventKey, { type: 'json' });
          // Pruning rewrites /events, so the token must be able to write it
          // too: anyone who knows the code can claim an unused /acks.
          if (eventQueue && await authorizeWrite(env, eventKey, eventQueue, body.token)) {
            const acknowledged = new Set(incoming.map(entry => entry.eventId));
            const retained = (eventQueue.records || [])
              .filter(entry => !acknowledged.has(entry.eventId));
            if (retained.length !== (eventQueue.records || []).length) {
              await env.RELAY.put(eventKey, JSON.stringify({
                ...eventQueue,
                version: nextVersion(eventQueue.version),
                records: retained,
              }), { expirationTtl: EVENT_TTL_SECONDS });
            }
          }
        }

        const atCapacity = appended.capacity.length > 0;
        return json({
          version,
          token,
          accepted: appended.accepted,
          duplicates: appended.duplicates,
          ...(atCapacity ? { capacity: appended.capacity } : {}),
        }, headers, atCapacity ? 429 : 200, atCapacity ? { 'Retry-After': '5' } : {});
      }

      if (resource === '' && body?.gone === true) {
        // The owner's Disconnect: the profile gives way to a tombstone that
        // holds no profile data, only the version and the token. It lasts
        // 90 days, like an owner record, so RuneLite keeps being told the
        // code is gone instead of seeing it expire into "no profile". A later
        // publish with the owner's token replaces it as usual.
        const existing = await env.RELAY.get(key, { type: 'json' });
        const owner = await authorizeWrite(env, key, existing, body.token);
        if (!owner) return new Response('forbidden', { status: 403, headers });
        const version = nextVersion(existing?.version);
        await env.RELAY.put(key, JSON.stringify({ gone: true, version, token: owner.token }),
          { expirationTtl: OWNER_TTL_SECONDS });
        await recordOwner(env, key, owner);
        return json({ version, gone: true }, headers);
      }

      if (!body || typeof body.payload !== 'string') {
        return new Response('bad request', { status: 400, headers });
      }
      const existing = await env.RELAY.get(key, { type: 'json' });
      const owner = await authorizeWrite(env, key, existing, body.token);
      if (!owner) return new Response('forbidden', { status: 403, headers });
      const token = owner.token;
      const version = nextVersion(existing?.version);
      await env.RELAY.put(key, JSON.stringify({ version, payload: body.payload, token }),
        { expirationTtl: TTL_SECONDS });
      await recordOwner(env, key, owner);
      return json({ version, token }, headers);
    }

    return new Response('method not allowed', { status: 405, headers });
  },
};

export default {
  /**
   * An unexpected failure, such as a KV outage, answers 503 with the CORS
   * headers. Without them the browser hides the status and reports only
   * "Failed to fetch".
   */
  async fetch(request, env) {
    try {
      return await routes.fetch(request, env);
    } catch (error) {
      console.error('relay request failed', error);
      return new Response('relay unavailable', {
        status: 503,
        headers: cors(request.headers.get('Origin')),
      });
    }
  },
};