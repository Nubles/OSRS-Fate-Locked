/**
 * Discord webhook notifications — unlock announcements for your channel.
 *
 * The webhook URL is deliberately kept OUT of GameState: it lives in its own
 * per-profile localStorage record, so it never travels with save exports,
 * sync codes, or share cards (a leaked webhook URL lets anyone post to the
 * channel). The always-mounted DiscordSyncDriver watches run history and
 * posts every new UNLOCK entry past a persisted cursor — reload-safe, no
 * duplicates, and enabling the feature never floods the channel with the
 * run's back-catalogue (the cursor seeds to the newest entry on enable).
 */
import type { LogEntry } from '../types';
import { profileDiscordCursorKey, profileDiscordKey } from './profileStorage';

export interface DiscordConfig {
  url: string;
  enabled: boolean;
}

/** Discord embeds: ≤10 per message — batch accordingly. */
export const MAX_EMBEDS_PER_POST = 10;
const EMBED_COLOR = 0xfbbf24; // the app's gold

// ── Config record (per profile, local-only) ────────────────────────────────

export const readDiscordConfig = (storageKey: string): DiscordConfig => {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileDiscordKey(storageKey)) || '');
    return {
      url: typeof parsed?.url === 'string' ? parsed.url : '',
      enabled: parsed?.enabled === true,
    };
  } catch {
    return { url: '', enabled: false };
  }
};

export const writeDiscordConfig = (storageKey: string, config: DiscordConfig): void => {
  try {
    localStorage.setItem(profileDiscordKey(storageKey), JSON.stringify(config));
  } catch {
    /* quota — settings UI will show the stale value, nothing worse */
  }
};

// ── Post cursor (the newest history entry already handled) ─────────────────

/**
 * Where announcing resumes. History is append-only, so the cursor names the
 * last entry already handled and everything after it is new — device clocks
 * never decide. `start` announces the whole history (enabled on an empty
 * run); `unset` covers a missing, unreadable or pre-anchor timestamp record.
 */
export type DiscordCursor =
  | { kind: 'unset' }
  | { kind: 'start' }
  | { kind: 'after'; id: string };

export const readCursor = (storageKey: string): DiscordCursor => {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileDiscordCursorKey(storageKey)) ?? '');
    if (parsed !== null && typeof parsed === 'object' && 'after' in parsed) {
      if (parsed.after === null) return { kind: 'start' };
      if (typeof parsed.after === 'string') return { kind: 'after', id: parsed.after };
    }
  } catch {
    /* unreadable — treated as unset */
  }
  // Older versions stored a timestamp here; it reseeds like a missing cursor.
  return { kind: 'unset' };
};

export const writeCursor = (storageKey: string, cursor: DiscordCursor): void => {
  if (cursor.kind === 'unset') return;
  try {
    localStorage.setItem(
      profileDiscordCursorKey(storageKey),
      JSON.stringify({ after: cursor.kind === 'after' ? cursor.id : null }),
    );
  } catch {
    /* best-effort */
  }
};

/** The cursor that announces only what happens from now on. */
export const cursorAtNewest = (history: LogEntry[]): DiscordCursor =>
  history.length > 0 ? { kind: 'after', id: history[history.length - 1].id } : { kind: 'start' };

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

/** Real Discord webhook URLs only — we refuse to POST anywhere else. */
export const isValidWebhookUrl = (url: string): boolean =>
  /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url.trim());

export interface AnnouncementPlan {
  /** Where the cursor moves, or null when it stays put. */
  cursor: DiscordCursor | null;
  /** UNLOCK entries to post, in history order. */
  post: LogEntry[];
}

/**
 * What to announce for `history`. `replaced` means the run was swapped
 * wholesale (import, sync code, restore, reset): those unlocks happened
 * elsewhere or earlier — often announced already by the device they came
 * from — so the cursor reseeds silently. The same happens when the cursor's
 * entry is missing, or no cursor exists yet.
 */
export const planAnnouncements = (
  history: LogEntry[],
  cursor: DiscordCursor,
  replaced: boolean,
): AnnouncementPlan => {
  const reseed: AnnouncementPlan = { cursor: cursorAtNewest(history), post: [] };
  if (replaced || cursor.kind === 'unset') return reseed;

  let from = 0;
  if (cursor.kind === 'after') {
    let at = history.length - 1;
    while (at >= 0 && history[at].id !== cursor.id) at -= 1;
    if (at < 0) return reseed;
    from = at + 1;
  }
  if (from >= history.length) return { cursor: null, post: [] };
  return {
    cursor: cursorAtNewest(history),
    post: history.slice(from).filter((e) => e.type === 'UNLOCK'),
  };
};

/** One Discord embed per unlock — item, table, and what it cost. */
export const unlockEmbed = (entry: LogEntry): Record<string, unknown> => {
  const meta = (entry.meta ?? {}) as { category?: string; cost?: number; costType?: string };
  const costLabel =
    meta.costType === 'specialKey' ? 'an Omni-key'
    : meta.costType === 'chaosKey' ? 'a Chaos key'
    : meta.cost ? `${meta.cost} ${meta.cost === 1 ? 'Key' : 'Keys'}`
    : undefined;
  return {
    title: `🔓 ${entry.message}`,
    description: [meta.category, costLabel && `spent ${costLabel}`].filter(Boolean).join(' — '),
    color: EMBED_COLOR,
    timestamp: new Date(entry.timestamp).toISOString(),
    footer: { text: 'Fate Locked Ironman' },
  };
};

export const testEmbed = (): Record<string, unknown> => ({
  title: '🔗 Fate Locked Ironman connected',
  description: 'Unlock announcements will appear in this channel.',
  color: EMBED_COLOR,
  timestamp: new Date().toISOString(),
  footer: { text: 'Fate Locked Ironman' },
});

// ── Sender ──────────────────────────────────────────────────────────────────

/**
 * POST embeds to the webhook, batching to Discord's 10-embed limit and
 * retrying once on 429 using retry_after. Returns true when every batch was
 * accepted. Failures are non-fatal by design: the driver advances its cursor
 * regardless, so a flaky network can drop an announcement but can never spam
 * the channel with retries.
 */
export const postEmbeds = async (
  url: string,
  embeds: Record<string, unknown>[],
  fetchFn: typeof fetch = fetch,
): Promise<boolean> => {
  if (!isValidWebhookUrl(url) || embeds.length === 0) return false;
  let allOk = true;
  for (let i = 0; i < embeds.length; i += MAX_EMBEDS_PER_POST) {
    const batch = embeds.slice(i, i + MAX_EMBEDS_PER_POST);
    const send = () =>
      fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: batch }),
      });
    try {
      let res = await send();
      if (res.status === 429) {
        const retryAfter = Number((await res.json().catch(() => ({})))?.retry_after) || 1;
        await new Promise((r) => setTimeout(r, Math.min(retryAfter, 5) * 1000));
        res = await send();
      }
      if (!res.ok) allOk = false;
    } catch {
      allOk = false;
    }
  }
  return allOk;
};
