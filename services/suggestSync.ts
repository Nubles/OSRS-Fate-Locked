/**
 * Roll suggestions pushed BY the RuneLite plugin, over the same relay session
 * as the main online-sync bundle (see services/relaySync.ts + workers/fate-relay).
 *
 * Direction is reversed from the main channel: the plugin writes, the web app
 * only reads. That means this service never writes to the relay — it just
 * polls /r/:code/suggest and tracks its own "last seen" timestamp client-side
 * to decide what's new, the same way the plugin tracks lastRelayVersion for
 * the main channel. No coordination needed between the two directions.
 *
 * Two independent lifecycles share the same incoming data:
 *  - Ephemeral toast queue (SuggestionBanner) — ts-gated by lastSeen, ~15s poll.
 *  - Persistent pending list (SuggestionQueue, in the Auto-Roll tab) — survives
 *    dismissing a toast; stays until the player clears it manually or actually
 *    rolls a matching category (see clearPendingForSource).
 */
import { relaySync } from './relaySync';

export interface Suggestion {
  /** Roll-table category the plugin detected, e.g. "Boss (Mid)", "Raid", "Collection Log". */
  source: string;
  /** Human label for what triggered it, e.g. a boss/item name. */
  label: string;
  ts: number;
}

const LAST_SEEN_KEY = 'fate_suggest_last_seen_v1';
const PENDING_KEY = 'fate_suggest_pending_v1';
const CLEARED_KEY = 'fate_suggest_cleared_v1';
const POLL_MS = 15 * 1000;

const key = (s: Suggestion) => `${s.ts}-${s.source}-${s.label}`;

/**
 * Does a roll's history `source` string (e.g. "Boss (Mid)", "Col. Log: Vorki")
 * satisfy a pending suggestion's category? Boss/Raid sources match the
 * DropSource string exactly; Collection Log rolls are prefixed per-item
 * ("Col. Log: X"), so that one's a prefix check instead. Plugin suggestions
 * carry bare categories ("Quest", "Diary", "Combat Achievement") while the
 * app's rolls record the tiered DropSource string ("Quest (Novice)"), so a
 * bare category matches any tier of it.
 */
export const rollSatisfiesSuggestion = (suggestionSource: string, rolledSource: string): boolean => {
  const suggestion = suggestionSource.toLowerCase();
  const rolled = rolledSource.toLowerCase();
  if (suggestion.includes('collection log')) {
    return rolled.startsWith('col. log:');
  }
  if (rolled.startsWith(`${suggestion} (`)) return true;
  return rolledSource === suggestionSource;
};

/**
 * Where a suggestion's "Take me there" button should land, as a `fate:nav`
 * event detail. Shared by the toast banner and the persistent queue so the
 * two never drift. The query pre-fills the destination's search box with the
 * item/quest name — skipped when the label is just the plugin's generic
 * "<source> complete" fallback, which would match nothing.
 */
export const suggestionNav = (s: Suggestion): { target: string; query?: string } => {
  const source = s.source.toLowerCase();
  const query = s.label && s.label !== `${s.source} complete` ? s.label : undefined;
  if (source.includes('collection log')) return { target: 'tab:COLLECTION', query };
  if (source === 'quest') return { target: 'tab:JOURNAL/QUESTS', query };
  if (source === 'diary') return { target: 'tab:JOURNAL/DIARIES', query };
  if (source === 'combat achievement') return { target: 'tab:JOURNAL/CA', query };
  return { target: 'ctrl:FARM' };
};

class SuggestSyncService {
  private listeners = new Set<(s: Suggestion[]) => void>();
  private pendingListeners = new Set<() => void>();
  private lastSeen = 0;
  private pending: Suggestion[] = [];
  /**
   * Keys the player has already cleared (manually dismissed, or auto-cleared
   * by a matching roll) — persisted, not just session-local. The relay is a
   * dumb store the plugin doesn't clear on our behalf: the SAME suggestion
   * stays in its KV blob (24h TTL) until the plugin pushes a fresh list, so
   * without this, the very next poll would silently resurrect anything we'd
   * just removed from `pending`.
   */
  private cleared = new Set<string>();
  /**
   * Timestamps already emitted THIS session (banner still open/undismissed
   * doesn't advance lastSeen — that only happens on markSeen). Without this,
   * every poll while a suggestion sits un-dismissed would re-emit it and
   * duplicate the banner (duplicate React keys, same item shown repeatedly).
   */
  private emittedThisSession = new Set<number>();
  private timer: number | null = null;

  constructor() {
    try { this.lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) || 0); } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (raw) this.pending = JSON.parse(raw);
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(CLEARED_KEY);
      if (raw) this.cleared = new Set(JSON.parse(raw));
    } catch { /* ignore */ }
  }

  subscribe(fn: (s: Suggestion[]) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit(fresh: Suggestion[]) { for (const fn of this.listeners) fn(fresh); }

  subscribePending(fn: () => void) { this.pendingListeners.add(fn); return () => { this.pendingListeners.delete(fn); }; }
  private emitPending() { for (const fn of this.pendingListeners) fn(); }
  private savePending() { try { localStorage.setItem(PENDING_KEY, JSON.stringify(this.pending)); } catch { /* ignore */ } }
  private saveCleared() { try { localStorage.setItem(CLEARED_KEY, JSON.stringify([...this.cleared])); } catch { /* ignore */ } }

  getPending(): Suggestion[] { return [...this.pending]; }

  /** Manually clear one pending item — "not interested" / "handled it already". */
  removePending(s: Suggestion) {
    this.pending = this.pending.filter((p) => key(p) !== key(s));
    this.cleared.add(key(s));
    this.savePending();
    this.saveCleared();
    this.emitPending();
  }

  /** Clear every pending item whose category is satisfied by a roll that just happened. */
  clearPendingForRoll(rolledSource: string) {
    const toClear = this.pending.filter((p) => rollSatisfiesSuggestion(p.source, rolledSource));
    if (toClear.length === 0) return;
    for (const p of toClear) this.cleared.add(key(p));
    this.pending = this.pending.filter((p) => !rollSatisfiesSuggestion(p.source, rolledSource));
    this.savePending();
    this.saveCleared();
    this.emitPending();
  }

  /** Mark suggestions up to (and including) this timestamp as seen — call once shown. */
  markSeen(ts: number) {
    if (ts <= this.lastSeen) return;
    this.lastSeen = ts;
    try { localStorage.setItem(LAST_SEEN_KEY, String(ts)); } catch { /* ignore */ }
  }

  private async poll() {
    if (!relaySync.enabled) return;
    try {
      const res = await fetch(`${relaySync.base()}/r/${relaySync.code}/suggest`, { cache: 'no-store' });
      if (!res.ok) return; // 404 (nothing pushed yet) or transient — not an error state worth surfacing
      const { payload } = await res.json();
      if (!payload) return;
      const items: Suggestion[] = JSON.parse(payload);

      // Persistent pending list: add anything not already tracked and not
      // already cleared, regardless of lastSeen (a suggestion the player
      // never dismissed a toast for should still show up here) — but once
      // cleared, never resurrected by a later poll of the same stale relay
      // data (see the `cleared` field's doc comment).
      const existingKeys = new Set(this.pending.map(key));
      const newPending = items.filter((s) => !existingKeys.has(key(s)) && !this.cleared.has(key(s)));
      if (newPending.length > 0) {
        this.pending = [...this.pending, ...newPending].sort((a, b) => a.ts - b.ts);
        this.savePending();
        this.emitPending();
      }

      // Ephemeral toast queue: only genuinely new-since-last-poll items.
      const fresh = items
        .filter((s) => s.ts > this.lastSeen && !this.emittedThisSession.has(s.ts))
        .sort((a, b) => a.ts - b.ts);
      if (fresh.length > 0) {
        for (const s of fresh) this.emittedThisSession.add(s.ts);
        this.emit(fresh);
      }
    } catch { /* offline / relay unreachable — silently retry next tick */ }
  }

  start() {
    if (this.timer != null) return;
    this.poll();
    this.timer = window.setInterval(() => this.poll(), POLL_MS);
  }

  stop() {
    if (this.timer != null) { window.clearInterval(this.timer); this.timer = null; }
  }
}

export const suggestSync = new SuggestSyncService();
