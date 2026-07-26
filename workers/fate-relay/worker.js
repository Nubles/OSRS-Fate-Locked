/**
 * Fate Locked online relay — outbound-only bundle sync plus durable event queues.
 * Legacy /r/:code, /state, and /suggest resources remain compatible.
 */
import {
  EVENT_TTL_SECONDS,
  MAX_REQUEST_BYTES,
  appendUnique,
  validAcknowledgement,
  validEvent,
} from './protocol.js';

const TTL_SECONDS = 86400;
const CODE_RE = /^\/r\/([A-Za-z0-9-]{4,40})(\/state|\/suggest|\/events|\/acks)?$/;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag',
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
    return { field: 'events', validate: validEvent };
  }
  if (resource === '/acks') {
    return { field: 'acknowledgements', validate: validAcknowledgement };
  }
  return null;
}

export default {
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
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
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
        if (existing?.token && existing.token !== body.token) {
          return new Response('forbidden', { status: 403, headers });
        }
        const token = existing?.token || body.token || crypto.randomUUID();
        const version = (existing?.version || 0) + 1;
        const appended = appendUnique(existing?.records || [], incoming);
        await env.RELAY.put(key, JSON.stringify({
          version,
          token,
          records: appended.records,
        }), { expirationTtl: EVENT_TTL_SECONDS });
        return json({
          version,
          token,
          accepted: appended.accepted,
          duplicates: appended.duplicates,
        }, headers);
      }

      if (!body || typeof body.payload !== 'string') {
        return new Response('bad request', { status: 400, headers });
      }
      const existing = await env.RELAY.get(key, { type: 'json' });
      if (existing?.token && existing.token !== body.token) {
        return new Response('forbidden', { status: 403, headers });
      }
      const token = existing?.token || body.token || crypto.randomUUID();
      const version = (existing?.version || 0) + 1;
      await env.RELAY.put(key, JSON.stringify({ version, payload: body.payload, token }),
        { expirationTtl: TTL_SECONDS });
      return json({ version, token }, headers);
    }

    return new Response('method not allowed', { status: 405, headers });
  },
};