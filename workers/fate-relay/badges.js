/**
 * Fate Locked badges: the public list every plugin that shows badges reads
 * (GET /badges). Each badge is a KV key `bd:<code>` with an empty value and
 * the badge in its metadata, so the list is built from KV list() alone,
 * without reading a single value.
 */
import { BADGES_CACHE_SECONDS, BADGE_NAME_RE, MAX_BADGES, MAX_BADGE_TIER } from './protocol.js';

const LIST_PAGE = 1000;
const CACHE_MS = BADGES_CACHE_SECONDS * 1000;

/** Names as the plugin compares them: case aside, with spaces, '_' and '-' alike (as Jagex does). */
export const badgeNameKey = name => name.toLowerCase().replace(/[ _-]/g, ' ');

/** A badge from a key's metadata `{ n, t, at }`, or null when it isn't one. */
function badgeOf(metadata) {
  if (metadata === null || typeof metadata !== 'object') return null;
  const { n, t, at } = metadata;
  if (typeof n !== 'string' || !BADGE_NAME_RE.test(n)) return null;
  if (!Number.isInteger(t) || t < 0 || t > MAX_BADGE_TIER) return null;
  return { n, t, at: Number.isFinite(at) ? at : 0 };
}

/**
 * The badge list, `{"badges":[{"n","t"}, ...]}`, sorted by name, at most
 * MAX_BADGES. A name posted from more than one pairing code (a player who
 * paired again) is listed once, with its newest badge.
 */
export async function buildBadgeList(kv) {
  const byName = new Map();
  let cursor;
  let seen = 0;
  for (;;) {
    const page = await kv.list({ prefix: 'bd:', limit: LIST_PAGE, ...(cursor ? { cursor } : {}) });
    for (const key of page.keys) {
      if (seen >= MAX_BADGES) break;
      seen += 1;
      const badge = badgeOf(key.metadata);
      if (!badge) continue;
      const name = badgeNameKey(badge.n);
      const held = byName.get(name);
      if (!held || badge.at > held.at) byName.set(name, badge);
    }
    if (page.list_complete || !page.cursor || seen >= MAX_BADGES) break;
    cursor = page.cursor;
  }
  const badges = [...byName.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, { n, t }]) => ({ n, t }));
  return JSON.stringify({ badges });
}

/** A strong ETag for a body: the first 128 bits of its SHA-256, quoted. */
export async function bodyEtag(body) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return `"${[...new Uint8Array(digest).slice(0, 16)].map(byte => byte.toString(16).padStart(2, '0')).join('')}"`;
}

/**
 * Whether an If-None-Match header names `etag`: `*`, or any validator in its
 * list, quoted or bare, strong or weak.
 */
export function matchesEtag(header, etag) {
  if (header === null) return false;
  const bare = etag.slice(1, -1);
  return header.split(',').some(part => {
    let value = part.trim();
    if (value === '*') return true;
    if (value.startsWith('W/')) value = value.slice(2);
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    return value === bare;
  });
}

/**
 * The list this isolate built or fetched last, for 10 minutes. Cloudflare's
 * Cache API (caches.default) serves other isolates in the same location; this
 * saves even its lookup for the busy ones.
 */
let memory = null;

/** For tests: forget the list this isolate holds. */
export function resetBadgeCache() {
  memory = null;
}

const defaultCache = () => {
  try {
    return typeof caches !== 'undefined' && caches?.default ? caches.default : null;
  } catch {
    return null;
  }
};

/**
 * The current badge list `{ body, etag }`: from this isolate's memory, the
 * location's cache, or KV, each kept for 10 minutes from when it was built.
 * A new list goes into the cache after the response when the runtime allows.
 */
export async function currentBadgeList(env, cacheUrl, ctx) {
  const now = Date.now();
  if (memory && now - memory.builtAt < CACHE_MS) return memory;
  const cache = defaultCache();
  const cacheKey = new Request(cacheUrl);
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      const builtAt = Number(cached?.headers.get('X-Badges-Built-At'));
      if (cached && Number.isFinite(builtAt) && now - builtAt < CACHE_MS) {
        memory = { body: await cached.text(), etag: cached.headers.get('ETag'), builtAt };
        return memory;
      }
      // Not awaited: a cancel can wait on every other reader of the stream.
      cached?.body?.cancel().catch(() => {});
    } catch {
      /* built from KV below */
    }
  }
  const body = await buildBadgeList(env.RELAY);
  memory = { body, etag: await bodyEtag(body), builtAt: now };
  if (cache) {
    const stored = cache.put(cacheKey, new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${BADGES_CACHE_SECONDS}`,
        ETag: memory.etag,
        'X-Badges-Built-At': String(now),
      },
    })).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(stored);
    else await stored;
  }
  return memory;
}
