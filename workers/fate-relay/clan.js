/**
 * The clan feed: the latest unlocks the Discord bot posted in #live-unlocks,
 * as the tracker's Clan chat tab shows them. The bot sends what it read from
 * its own feed posts; the relay keeps only these fields, so nothing else the
 * bot holds (Discord ids, message links) can pass through it.
 */

export const CLAN_FEED_PATH = '/api/clan-feed';
export const MAX_CLAN_ENTRIES = 30;
export const MAX_CLAN_ITEMS = 5;

const object = value => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const timestamp = value => Number.isInteger(value) && value > 0 && value < 8.64e15;

/** One entry as the relay passes it on, or null when it isn't one. */
function clanEntry(value) {
  const entry = object(value);
  if (!entry || !text(entry.name, 40) || !timestamp(entry.at)) return null;
  if (entry.mode !== undefined && entry.mode !== null && !text(entry.mode, 40)) return null;
  if (!Array.isArray(entry.items) || entry.items.length === 0) return null;
  const items = entry.items.filter(item => text(item, 120)).slice(0, MAX_CLAN_ITEMS);
  if (items.length === 0) return null;
  const more = Number.isInteger(entry.more) && entry.more > 0 && entry.more < 10_000 ? entry.more : 0;
  return {
    name: entry.name,
    ...(text(entry.mode, 40) ? { mode: entry.mode } : {}),
    items,
    ...(more > 0 ? { more } : {}),
    at: entry.at,
  };
}

/**
 * The entries in the bot's answer, newest first and at most MAX_CLAN_ENTRIES,
 * or null when the answer isn't a feed at all. A malformed entry is skipped.
 */
export function clanFeed(body) {
  const record = object(body);
  if (!record || !Array.isArray(record.entries)) return null;
  return record.entries
    .map(clanEntry)
    .filter(entry => entry !== null)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_CLAN_ENTRIES);
}

/**
 * The last feed this Worker instance passed on. The edge cache does nothing
 * on a workers.dev address, so a warm instance also answers from memory for
 * a minute, and the bot is asked at most about once a minute per instance.
 */
export const CLAN_MEMORY_MS = 60_000;
let remembered = null;

export function recentClanFeed(now = Date.now()) {
  return remembered && now - remembered.at < CLAN_MEMORY_MS ? remembered.entries : null;
}

export function rememberClanFeed(entries, now = Date.now()) {
  remembered = { at: now, entries };
}

/** Tests only. */
export function forgetClanFeed() {
  remembered = null;
}
