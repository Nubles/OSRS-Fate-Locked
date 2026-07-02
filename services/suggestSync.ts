/**
 * Roll suggestions pushed BY the RuneLite plugin, over the same relay session
 * as the main online-sync bundle (see services/relaySync.ts + workers/fate-relay).
 *
 * Direction is reversed from the main channel: the plugin writes, the web app
 * only reads. That means this service never writes to the relay — it just
 * polls /r/:code/suggest and tracks its own "last seen" timestamp client-side
 * to decide what's new, the same way the plugin tracks lastRelayVersion for
 * the main channel. No coordination needed between the two directions.
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
const POLL_MS = 15 * 1000;

class SuggestSyncService {
  private listeners = new Set<(s: Suggestion[]) => void>();
  private lastSeen = 0;
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
  }

  subscribe(fn: (s: Suggestion[]) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit(fresh: Suggestion[]) { for (const fn of this.listeners) fn(fresh); }

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
