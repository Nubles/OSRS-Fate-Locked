/**
 * Online relay sync (optional). Pushes the run bundle to a hosted Cloudflare
 * Worker under a short pairing code; the RuneLite plugin polls it by that code.
 * Outbound-only on both sides — see workers/fate-relay + docs/online-relay.md.
 *
 * Holds the session (code + private write-token) and a tiny pub/sub so the UI
 * and the always-mounted driver stay in sync. No data leaves until the user
 * explicitly enables it.
 */
const DEFAULT_BASE = 'https://fate-relay.alexanderhaynes18.workers.dev';
const SESSION_KEY = 'fate_relay_session_v1';
const BASE_KEY = 'fate_relay_base';

export type RelayStatus = 'off' | 'syncing' | 'synced' | 'error';

interface Session { code: string; token: string; }

// Crockford base32 (no ambiguous 0/O/1/I/L/U) for a readable pairing code.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
function randomCode(len = 8): string {
  const a = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(a, (x) => ALPHABET[x % ALPHABET.length]).join('');
}
function randomToken(): string {
  const a = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
}

class RelaySyncService {
  private session: Session | null = null;
  private listeners = new Set<() => void>();

  status: RelayStatus = 'off';
  lastError: string | null = null;
  lastSyncAt: number | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) this.session = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  get enabled() { return this.session != null; }
  get code() { return this.session?.code ?? null; }

  base(): string {
    const env = (import.meta as any).env?.VITE_FATE_RELAY as string | undefined;
    let ls: string | null = null;
    try { ls = localStorage.getItem(BASE_KEY); } catch { /* ignore */ }
    return (env || ls || DEFAULT_BASE).replace(/\/$/, '');
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const fn of this.listeners) fn(); }

  /** Start a new session: fresh code + private write-token. */
  enable(): string {
    this.session = { code: randomCode(), token: randomToken() };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch { /* ignore */ }
    this.status = 'syncing';
    this.lastError = null;
    this.emit();
    return this.session.code;
  }

  disable() {
    this.session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    this.status = 'off';
    this.lastError = null;
    this.emit();
  }

  /** Push a (compressed) bundle payload to the relay. No-op when disabled. */
  async push(payload: string): Promise<boolean> {
    if (!this.session) return false;
    this.status = 'syncing';
    this.emit();
    try {
      const res = await fetch(`${this.base()}/r/${this.session.code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.session.token, payload }),
      });
      if (!res.ok) throw new Error(`relay ${res.status}`);
      this.status = 'synced';
      this.lastSyncAt = Date.now();
      this.lastError = null;
      this.emit();
      return true;
    } catch (e: any) {
      this.status = 'error';
      this.lastError = e?.message ?? 'push failed';
      this.emit();
      return false;
    }
  }
}

export const relaySync = new RelaySyncService();
