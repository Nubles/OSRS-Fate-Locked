/**
 * Fate Locked badges: one KV record, `badges`, holds every shared badge as
 * `{"v":1,"byCode":{"<code>":{"n":name,"t":tier,"at":ms}}}`. A post or a
 * removal rewrites it (one KV write per change); GET /badges reads it, so
 * serving the public list never lists KV. The free plan allows 1,000 list
 * operations a day, which every plugin polling every 30 minutes would spend,
 * and Cloudflare's Cache API does nothing on a *.workers.dev address.
 */
import {
  BADGES_CACHE_SECONDS,
  BADGE_NAME_RE,
  BADGE_TTL_SECONDS,
  MAX_BADGES,
  MAX_BADGE_TIER,
} from './protocol.js';

export const BADGES_KEY = 'badges';
const SNAPSHOT_VERSION = 1;
const BADGE_MAX_AGE_MS = BADGE_TTL_SECONDS * 1000;
/**
 * A read of the record may be served from the location's KV cache for this
 * long, and this isolate keeps the list it built as long, so the list is at
 * most about 10 minutes old (Cache-Control: max-age=600).
 */
export const BADGES_READ_CACHE_SECONDS = BADGES_CACHE_SECONDS / 2;
const MEMORY_MS = BADGES_READ_CACHE_SECONDS * 1000;
/** A badge resent unchanged within this long is not written again (the plugin resends at least daily). */
const UNCHANGED_REWRITE_MS = 60 * 60 * 1000;

/** Names as the plugin compares them: case aside, with spaces, '_' and '-' alike (as Jagex does). */
export const badgeNameKey = name => name.toLowerCase().replace(/[ _-]/g, ' ');

/** A stored badge `{ n, t, at }`, or null when it isn't one or is over 30 days old. */
function liveBadge(entry, now) {
  if (entry === null || typeof entry !== 'object') return null;
  const { n, t, at } = entry;
  if (typeof n !== 'string' || !BADGE_NAME_RE.test(n)) return null;
  if (!Number.isInteger(t) || t < 0 || t > MAX_BADGE_TIER) return null;
  if (!Number.isFinite(at) || at < now - BADGE_MAX_AGE_MS) return null;
  return { n, t, at };
}

/** The live badges of a stored record, by pairing code; none when it is missing or unreadable. */
function liveByCode(stored, now) {
  let byCode = null;
  try {
    const snapshot = typeof stored === 'string' ? JSON.parse(stored) : stored;
    byCode = snapshot?.v === SNAPSHOT_VERSION ? snapshot.byCode : null;
  } catch {
    byCode = null;
  }
  const live = new Map();
  if (byCode === null || typeof byCode !== 'object') return live;
  for (const [code, entry] of Object.entries(byCode)) {
    const badge = liveBadge(entry, now);
    if (badge) live.set(code, badge);
  }
  return live;
}

/**
 * The badge list body, `{"badges":[{"n","t"}, ...]}`: live badges only, a
 * name posted from more than one pairing code (a player who paired again)
 * once with its newest badge, sorted by name, at most MAX_BADGES.
 */
export function badgeListBody(stored, now) {
  const byName = new Map();
  for (const badge of liveByCode(stored, now).values()) {
    const name = badgeNameKey(badge.n);
    const held = byName.get(name);
    if (!held || badge.at > held.at) byName.set(name, badge);
  }
  const badges = [...byName.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .slice(0, MAX_BADGES)
    .map(([, { n, t }]) => ({ n, t }));
  return JSON.stringify({ badges });
}

/** Why a badge change wasn't stored: the record is full, or KV refused the write. */
export class BadgeWriteRefused extends Error {}

/**
 * Set (badge) or remove (null) a code's badge: a read-modify-write of the
 * one record, dropping badges over 30 days old on the way. KV takes about one
 * write a second per key, so a write can fail, and two changes at once can
 * read the same record and the later write wins: the other change is lost.
 * Both heal by themselves, since the plugin sends its badge again after a
 * failure and at least once a day. A new code is refused once MAX_BADGES live
 * badges are held; nobody else's badge is dropped for it.
 */
export async function changeBadge(kv, code, badge, now) {
  const live = liveByCode(await kv.get(BADGES_KEY), now);
  const held = live.get(code);
  if (badge === null) {
    if (!held) return;
    live.delete(code);
  } else {
    if (held && held.n === badge.n && held.t === badge.t && now - held.at < UNCHANGED_REWRITE_MS) return;
    if (!held && live.size >= MAX_BADGES) throw new BadgeWriteRefused('badge list full');
    live.set(code, { ...badge, at: now });
  }
  const snapshot = JSON.stringify({ v: SNAPSHOT_VERSION, byCode: Object.fromEntries(live) });
  try {
    await kv.put(BADGES_KEY, snapshot, { expirationTtl: BADGE_TTL_SECONDS });
  } catch (error) {
    throw new BadgeWriteRefused(error?.message ?? 'write failed');
  }
  memory = null;
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

/** The list this isolate built last; a badge change in this isolate drops it. */
let memory = null;

/** For tests: forget the list this isolate holds. */
export function resetBadgeCache() {
  memory = null;
}

/**
 * The current badge list `{ body, etag }`: this isolate's for 5 minutes,
 * else built from the record, read through the location's KV cache (5
 * minutes). One KV read, and no list operation, per build.
 */
export async function currentBadgeList(env) {
  const now = Date.now();
  if (memory && now - memory.builtAt < MEMORY_MS) return memory;
  const stored = await env.RELAY.get(BADGES_KEY, { cacheTtl: BADGES_READ_CACHE_SECONDS });
  const body = badgeListBody(stored, now);
  memory = { body, etag: await bodyEtag(body), builtAt: now };
  return memory;
}
