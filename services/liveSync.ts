/**
 * Live two-way bridge to the Fate Locked RuneLite plugin.
 *
 * The plugin runs a localhost HTTP server (see runelite-plugin LiveSyncServer).
 * Browsers treat http://localhost as a secure origin, so this HTTPS app can poll
 * it without mixed-content blocking. We poll GET /state for live game state and
 * POST /bundle to push the run's unlock state into the plugin.
 *
 * Nothing here runs unless the user explicitly connects — a plugin that isn't
 * running just surfaces as "disconnected", never an error spam.
 */

export interface LiveState {
  loggedIn: boolean;
  player?: string;
  combatLevel?: number;
  world?: number;
  chunk?: [number, number];
  area?: string;
  /** UNLOCKED | LOCKED | UNAUTHORED */
  lock?: string;
  skills?: Record<string, number>;
  ts?: number;
}

export type LiveStatus = 'off' | 'connecting' | 'connected' | 'error';

const POLL_MS = 1500;
const PORT_KEY = 'fate_live_port';

class LiveSyncService {
  private port = 43596;
  private timer: number | null = null;
  private listeners = new Set<() => void>();

  status: LiveStatus = 'off';
  state: LiveState | null = null;
  lastError: string | null = null;

  constructor() {
    try { const p = +(localStorage.getItem(PORT_KEY) || ''); if (p > 0) this.port = p; } catch { /* ignore */ }
  }

  getPort() { return this.port; }
  setPort(p: number) {
    this.port = p;
    try { localStorage.setItem(PORT_KEY, String(p)); } catch { /* ignore */ }
    if (this.timer != null) { this.stop(); this.start(); }
  }

  private base() { return `http://127.0.0.1:${this.port}`; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const fn of this.listeners) fn(); }

  start() {
    if (this.timer != null) return;
    this.status = 'connecting';
    this.emit();
    this.poll();
    this.timer = window.setInterval(() => this.poll(), POLL_MS);
  }

  stop() {
    if (this.timer != null) { window.clearInterval(this.timer); this.timer = null; }
    this.status = 'off';
    this.state = null;
    this.lastError = null;
    this.emit();
  }

  private async poll() {
    try {
      const res = await fetch(`${this.base()}/state`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.state = await res.json();
      this.status = 'connected';
      this.lastError = null;
    } catch (e: any) {
      this.status = 'error';
      this.lastError = e?.message ?? 'unreachable';
      this.state = null;
    }
    this.emit();
  }

  /** Push a RuneLite bundle JSON string into the plugin. */
  async pushBundle(json: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.base()}/bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const liveSync = new LiveSyncService();
