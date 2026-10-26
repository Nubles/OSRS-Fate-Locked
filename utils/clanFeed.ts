/**
 * The clan feed: other players' unlocks from the Fate Locked Discord's
 * #live-unlocks, read through the relay's /clan route
 * (workers/fate-relay/clan.js), for the OSRS chatbox's Clan tab. Read-only:
 * opening the tab costs the relay no KV write, and the relay caches the
 * answer for a minute.
 */

export interface ClanEntry {
  name: string;
  mode?: string;
  items: string[];
  more?: number;
  at: number;
}

/** The tag in front of each line, as a clan channel's name is in game. */
export const CLAN_TAG = 'Fate Locked';
export const CLAN_POLL_MS = 2 * 60_000;
const MAX_ENTRIES = 30;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

/** The entries in a /clan answer, newest first, or null when it isn't one. */
export function parseClanFeed(body: unknown): ClanEntry[] | null {
  if (!isRecord(body) || !Array.isArray(body.entries)) return null;
  const entries: ClanEntry[] = [];
  for (const raw of body.entries) {
    if (!isRecord(raw) || !text(raw.name, 40) || !Number.isFinite(raw.at) || !Array.isArray(raw.items)) continue;
    const items = raw.items.filter((item): item is string => text(item, 120)).slice(0, 5);
    if (items.length === 0) continue;
    entries.push({
      name: raw.name,
      ...(text(raw.mode, 40) ? { mode: raw.mode } : {}),
      items,
      ...(Number.isInteger(raw.more) && (raw.more as number) > 0 ? { more: raw.more as number } : {}),
      at: raw.at as number,
    });
  }
  return entries.sort((a, b) => b.at - a.at).slice(0, MAX_ENTRIES);
}

/**
 * One chat line per unlock, oldest first, as the chatbox lists them:
 * "Whim unlocked Lava Maze (Regions)." An entry that left some out says how
 * many on its last line.
 */
export function clanLines(entries: readonly ClanEntry[]): { key: string; name: string; text: string; at: number; mode?: string }[] {
  const lines: { key: string; name: string; text: string; at: number; mode?: string }[] = [];
  for (const entry of [...entries].reverse()) {
    entry.items.forEach((item, index) => {
      // Every unlock's history line starts "Unlocked " (context/GameContext.tsx).
      const what = `unlocked ${item.replace(/^Unlocked /, '')}`;
      const last = index === entry.items.length - 1;
      const more = last && entry.more ? `, and ${entry.more} more` : '';
      lines.push({
        key: `${entry.at}:${entry.name}:${index}`,
        name: entry.name,
        text: `${what.replace(/[.!]$/, '')}${more}.`,
        at: entry.at,
        ...(entry.mode ? { mode: entry.mode } : {}),
      });
    });
  }
  return lines;
}

let cached: { at: number; entries: ClanEntry[] } | null = null;

/**
 * The feed from the relay at `base`, reusing an answer under a minute old
 * so switching tabs doesn't ask again. Null when the relay can't give one.
 */
export async function fetchClanFeed(base: string, now = Date.now()): Promise<ClanEntry[] | null> {
  if (cached && now - cached.at < 60_000) return cached.entries;
  try {
    const response = await fetch(`${base}/clan`);
    if (!response.ok) return null;
    const entries = parseClanFeed(await response.json());
    if (entries) cached = { at: now, entries };
    return entries;
  } catch {
    return null;
  }
}

/** Tests only: forget the last answer. */
export const resetClanFeedCache = (): void => { cached = null; };
