/**
 * Fate Locked online relay — a tiny outbound-only sync buffer.
 *
 * The web app POSTs the run bundle under a pairing code; the RuneLite plugin
 * GETs it by that code and imports it. Neither side runs a server (Hub-safe):
 * both just talk to this Worker. Entries are ephemeral (24h TTL).
 *
 *   POST /r/:code        { token?, payload }  → { version, token }   (write; token-gated)
 *   GET  /r/:code        → { version, payload }  (read; 304 with If-None-Match)
 *   POST /r/:code/state  { token?, payload }  → live game state (optional reverse)
 *   GET  /r/:code/state  → { version, payload }
 *   POST /r/:code/suggest { token?, payload } → plugin-detected "may be worth
 *                                                a roll" suggestions (see below)
 *   GET  /r/:code/suggest → { version, payload }
 *
 * /suggest carries the OTHER direction: the RuneLite plugin (not the web app)
 * is the writer, appending small roll suggestions ({source, label, ts} JSON,
 * plugin-side) as it detects boss kills, collection log entries, etc. The web
 * app is a read-only poller that tracks its own "last seen" timestamp
 * client-side — it never writes here, so there's no lock-step coordination
 * needed between the two directions. Same size cap, same 24h TTL, same
 * first-writer-claims-the-token model as every other sub-resource.
 *
 * Requires a KV namespace bound as `RELAY` (see wrangler.toml).
 */
const TTL_SECONDS = 86400;          // 24h — this is a transit buffer, not storage
const MAX_PAYLOAD = 256 * 1024;     // 256 KB cap
const CODE_RE = /^\/r\/([A-Za-z0-9-]{4,40})(\/state|\/suggest)?$/;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag',
    'Cache-Control': 'no-store',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const h = cors(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') return new Response(null, { headers: h });

    const m = url.pathname.match(CODE_RE);
    if (!m) return new Response('not found', { status: 404, headers: h });
    const key = `r:${m[1]}${m[2] || ''}`;

    if (request.method === 'GET') {
      const rec = await env.RELAY.get(key, { type: 'json' });
      if (!rec) return new Response('{}', { status: 404, headers: { ...h, 'Content-Type': 'application/json' } });
      if (request.headers.get('If-None-Match') === String(rec.version)) {
        return new Response(null, { status: 304, headers: { ...h, ETag: String(rec.version) } });
      }
      return new Response(JSON.stringify({ version: rec.version, payload: rec.payload }),
        { headers: { ...h, 'Content-Type': 'application/json', ETag: String(rec.version) } });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.payload !== 'string') return new Response('bad request', { status: 400, headers: h });
      if (body.payload.length > MAX_PAYLOAD) return new Response('payload too large', { status: 413, headers: h });

      const existing = await env.RELAY.get(key, { type: 'json' });
      // First writer claims the code; later writes must present the same token.
      if (existing && existing.token && existing.token !== body.token) {
        return new Response('forbidden', { status: 403, headers: h });
      }
      const token = (existing && existing.token) || body.token || crypto.randomUUID();
      const version = ((existing && existing.version) || 0) + 1;
      await env.RELAY.put(key, JSON.stringify({ version, payload: body.payload, token }),
        { expirationTtl: TTL_SECONDS });
      return new Response(JSON.stringify({ version, token }),
        { headers: { ...h, 'Content-Type': 'application/json' } });
    }

    return new Response('method not allowed', { status: 405, headers: h });
  },
};
