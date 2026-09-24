/**
 * Fate Locked online relay — outbound-only bundle sync plus durable event queues.
 * Legacy /r/:code, /state, and /suggest resources remain compatible.
 */
import {
  EVENT_TTL_SECONDS,
  MAX_REQUEST_BYTES,
  appendUnique,
  appendUniqueNewest,
  validAcknowledgement,
  validEvent,
} from './protocol.js';

const TTL_SECONDS = 86400;
const OWNER_TTL_SECONDS = 90 * 86400;
const OWNER_REFRESH_MS = 86400 * 1000;
// Versions count seconds from this instant. Never change it: clients hold
// versions across deploys and accept only a higher one.
const RELAY_VERSION_EPOCH_MS = Date.UTC(2026, 0, 1);
const CODE_RE = /^\/r\/([A-Za-z0-9-]{4,40})(\/state|\/suggest|\/events|\/acks)?$/;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag',
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
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return '';
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
  return new TextDecoder().decode(bytes);
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

const routes = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') return new Response(null, { headers });

    const match = url.pathname.match(CODE_RE);
    if (!match) return new Response('not found', { status: 404, headers });
    const resource = match[2] || '';
    const key = `r:${match[1]}${resource}`;
    const structured = structuredResource(resource);

    if (request.method === 'GET') {
      const stored = await env.RELAY.get(key, { type: 'json' });
      if (!stored) return json({}, headers, 404);
      if (request.headers.get('If-None-Match') === String(stored.version)) {
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