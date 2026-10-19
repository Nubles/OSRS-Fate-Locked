import { relayRetryDelayMs } from '../services/relaySync';

/**
 * When the tracker asks the relay for what RuneLite's Send to tracker left
 * (services/relayInbox.ts): at once on start and when the tab shows again,
 * every minute while it shows, never twice in 10 seconds, and after a
 * failure only once the publish backoff has passed (relayRetryDelayMs: 15 s,
 * 1 min, then every 5 min).
 */
export const RELAY_INBOX_POLL_MS = 60_000;
export const RELAY_INBOX_MIN_GAP_MS = 10_000;

/** The earliest the tracker may ask again: at once, 10 s after the last ask, or after the backoff. */
export function relayInboxEarliestAt(lastAttemptAt: number | null, failures: number): number {
  if (lastAttemptAt === null) return 0;
  return lastAttemptAt + (failures > 0 ? relayRetryDelayMs(failures) : RELAY_INBOX_MIN_GAP_MS);
}

/** When to ask next while the tab shows: a minute after an ask that worked, or after the backoff. */
export function relayInboxNextAt(lastAttemptAt: number, failures: number): number {
  return lastAttemptAt + (failures > 0 ? relayRetryDelayMs(failures) : RELAY_INBOX_POLL_MS);
}

/** The relay takes an acknowledgement of at most this many ids, each 1 to 128 characters. */
const MAX_ACK_IDS = 250;
const MAX_ID_CHARS = 128;

/**
 * Every event id in what the relay sent, readable or not, as the relay
 * reads them (`eventId`, else `id`), so the tracker can empty all of it:
 * an event it can't use would otherwise come back every minute.
 */
export function relayInboxIds(text: string): string[] {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return [];
  }
  const events = (input as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return [];
  const ids = new Set<string>();
  for (const event of events) {
    if (typeof event !== 'object' || event === null || Array.isArray(event)) continue;
    const record = event as Record<string, unknown>;
    const id = 'eventId' in record ? record.eventId : record.id;
    if (typeof id === 'string' && id.length >= 1 && id.length <= MAX_ID_CHARS) ids.add(id);
    if (ids.size === MAX_ACK_IDS) break;
  }
  return [...ids];
}
