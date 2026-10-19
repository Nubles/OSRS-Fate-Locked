import { isRunelitePairCode } from '../utils/runelitePairing';
import { resolveRelayBase } from '../utils/relayBase';
import {
  canSkipRelayPublish, parseRelayPublishedRecord, type RelayPublishedRecord,
} from '../utils/relayPublishFingerprint';

/**
 * Online relay sync (optional). Pushes the run bundle to a hosted Cloudflare
 * Worker under a short pairing code; the RuneLite plugin polls it by that code.
 * Outbound-only on both sides — see workers/fate-relay + docs/online-relay.md.
 *
 * Holds the session (code + private write-token) and a tiny pub/sub so the UI
 * and the always-mounted driver stay in sync. No data leaves until the user
 * explicitly enables it.
 */
const SESSION_KEY = 'fate_relay_session_v1';
/**
 * The last publish that worked: its pairing code, fingerprint, revision and
 * time, so an unchanged profile isn't sent again after a reload or from
 * another tab (utils/relayPublishFingerprint.ts). No profile data or token.
 */
const PUBLISHED_KEY = 'fate_relay_published_v1';
/** Development-only relay override; production ignores it (utils/relayBase.ts). */
const BASE_KEY = 'fate_relay_base';
/** A stalled POST fails after this long instead of holding up later publishes. */
const REQUEST_TIMEOUT_MS = 15_000;
/**
 * After a failed publish the driver tries again after these delays, then
 * every 5 minutes until one works, which starts the count over.
 */
export const RELAY_RETRY_DELAYS_MS = [15_000, 60_000, 5 * 60_000] as const;

/** How long to wait before the automatic retry after `failures` failed publishes in a row. */
export const relayRetryDelayMs = (failures: number): number =>
  RELAY_RETRY_DELAYS_MS[Math.min(Math.max(failures, 1), RELAY_RETRY_DELAYS_MS.length) - 1];

/** A publish the relay answered with an error status. */
export class RelayHttpError extends Error {
  constructor(readonly status: number) {
    super(`relay ${status}`);
    this.name = 'RelayHttpError';
  }
}

/**
 * Whether trying the same publish again can work: a network failure, a
 * timeout, a busy relay or a relay outage can pass; a refusal of the pairing
 * (403) or of the profile itself (400, 413) won't.
 */
export const isRetryableRelayError = (error: unknown): boolean =>
  !(error instanceof RelayHttpError)
  || error.status >= 500 || error.status === 429 || error.status === 408;

export type RelayStatus = 'off' | 'syncing' | 'synced' | 'error';

/** What a publish sends, for skipping an unchanged one later (utils/relayPublishFingerprint.ts). */
export interface PublishedProfile {
  fingerprint: string | null | undefined;
  runRevision: number;
}

interface Session {
  code: string;
  token: string;
  /** The profile this pairing publishes. Pairings saved before it was
   *  recorded have none; the first tab to publish one binds it. */
  profileId?: string;
}

const sameSession = (a: Session | null, b: Session | null): boolean =>
  a?.code === b?.code && a?.token === b?.token && a?.profileId === b?.profileId;

/** The stored pairing, or undefined when storage can't be read. */
function readStoredSession(): Session | null | undefined {
  let raw: string | null;
  try { raw = localStorage.getItem(SESSION_KEY); } catch { return undefined; }
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    // A code RuneLite can't have made (very old builds of the app made their
    // own) can't reach any RuneLite, and the relay refuses it.
    return parsed && typeof parsed.code === 'string' && isRunelitePairCode(parsed.code)
      && typeof parsed.token === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (x) => x.toString(16).padStart(2, '0')).join('');
/** A pairing code in RuneLite's form: 32 hex digits, the only form the relay accepts. */
const randomCode = (): string => randomHex(16);
const randomToken = (): string => randomHex(18);

export class RelaySyncService {
  private session: Session | null = null;
  /** The profile this tab shows. Every tab shares the one stored pairing. */
  private activeProfileId: string | null = null;
  private pushQueue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();

  status: RelayStatus = 'off';
  lastError: string | null = null;
  lastSyncAt: number | null = null;
  pushRequestRevision = 0;
  /** Failed publishes in a row since the last one that worked. */
  failures = 0;
  /** Why the last of them failed. Unlike lastError, kept while a retry is sending. */
  lastFailure: string | null = null;
  /** Whether trying the failed publish again can work. */
  retryable = true;
  /** When the driver will try a failed publish again by itself, or null. */
  retryAt: number | null = null;

  constructor() {
    this.session = readStoredSession() ?? null;
    // Pairing, re-pairing, binding and Disconnect in other tabs.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key !== SESSION_KEY && event.key !== null) return;
        const stored = readStoredSession();
        if (stored !== undefined) this.adoptStored(stored);
      });
    }
  }

  /** Paired with the profile this tab shows, or with no profile yet. Only
   *  then may this tab publish, or show RuneLite as connected. */
  get enabled() {
    const pairedProfile = this.session?.profileId;
    return this.session != null
      && (pairedProfile === undefined || pairedProfile === this.activeProfileId);
  }
  get code() { return this.enabled && this.session ? this.session.code : null; }

  /**
   * Record the profile this tab shows. App's GameProviderBridge calls this
   * while rendering, before anything below it reads `enabled`; it doesn't
   * emit, because switching profile remounts every reader.
   */
  setActiveProfile(profileId: string | null): void {
    this.activeProfileId = profileId;
  }

  /** Where every relay call goes. See resolveRelayBase: production ignores the override. */
  base(): string {
    const env = (import.meta as any).env?.VITE_FATE_RELAY as string | undefined;
    const dev = import.meta.env.DEV === true;
    let override: string | null = null;
    if (dev) {
      try { override = localStorage.getItem(BASE_KEY); } catch { /* ignore */ }
    }
    return resolveRelayBase({ env, override, dev });
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const fn of this.listeners) fn(); }

  /** Adopt the private pairing identity generated by RuneLite, for a profile. */
  adoptCode(code: string, profileId: string | null = this.activeProfileId): boolean {
    if (!isRunelitePairCode(code)) return false;
    const nextSession: Session = {
      code, token: randomToken(), ...(profileId != null ? { profileId } : {}),
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    } catch {
      return false;
    }
    this.session = nextSession;
    this.status = 'syncing';
    this.lastError = null;
    this.lastSyncAt = null;
    this.resetFailures();
    this.pushRequestRevision += 1;
    this.emit();
    return true;
  }

  /** Start a new session: fresh code + private write-token. */
  enable(profileId: string | null = this.activeProfileId): string {
    this.session = {
      code: randomCode(), token: randomToken(), ...(profileId != null ? { profileId } : {}),
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch { /* ignore */ }
    this.status = 'syncing';
    this.lastError = null;
    this.lastSyncAt = null;
    this.resetFailures();
    this.pushRequestRevision += 1;
    this.emit();
    return this.session.code;
  }

  /**
   * Forget the pairing, here and in every other tab. Local only: the relay
   * keeps serving the last profile until its record expires. The Disconnect
   * button calls disconnect(), which also tells the relay.
   */
  disable() {
    this.session = null;
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(PUBLISHED_KEY);
    } catch { /* ignore */ }
    this.status = 'off';
    this.lastError = null;
    this.lastSyncAt = null;
    this.resetFailures();
    this.emit();
  }

  private resetFailures(): void {
    this.failures = 0;
    this.lastFailure = null;
    this.retryable = true;
    this.retryAt = null;
  }

  /**
   * Record when the driver will try a failed publish again (null: it won't).
   * Silent while the driver is being torn down, which would otherwise emit
   * into components that are unmounting.
   */
  setRetryAt(at: number | null, silent = false): void {
    if (this.retryAt === at) return;
    this.retryAt = at;
    if (!silent) this.emit();
  }

  /**
   * Disconnect: forget the pairing at once, here and in every other tab,
   * then ask the relay to mark the code gone, so it stops serving the last
   * profile, and the linked account in it, to anyone who has the code. The
   * request waits for a publish already on its way, which would otherwise
   * land after it and restore the profile. It is best effort and never
   * rejects: if it fails, the profile expires with its record 30 days after
   * the last publish.
   */
  disconnect(): Promise<void> {
    const session = this.session;
    this.disable();
    // Only the code's write token can mark it gone.
    if (!session?.token) return Promise.resolve();
    return this.pushQueue.then(() => this.markGone(session));
  }

  /** Ask the relay to mark a pairing's code gone. Never throws. */
  private async markGone(session: Session): Promise<void> {
    try {
      await this.post(`/r/${session.code}`, { token: session.token, gone: true });
    } catch {
      // Offline or timed out: the profile expires with its record.
    }
  }

  /** Ask the mounted driver to rebuild and send the current profile. */
  requestPush(): boolean {
    if (!this.enabled) return false;
    this.status = 'syncing';
    this.lastError = null;
    this.retryAt = null;
    this.pushRequestRevision += 1;
    this.emit();
    return true;
  }

  /**
   * Surface a bundle-build failure owned by the current session. `retryable`
   * is false when trying again by itself can't help (this tab isn't saving).
   */
  reportPushFailure(error: unknown, retryable = true): void {
    if (!this.enabled) return;
    this.status = 'error';
    this.lastError = error instanceof Error
      ? error.message
      : String(error || 'bundle build failed');
    this.failures += 1;
    this.lastFailure = this.lastError;
    this.retryable = retryable;
    this.emit();
  }

  /**
   * Whether the relay already holds this profile: the last publish for this
   * pairing worked, with the same fingerprint, from this revision or an
   * earlier one, under six hours ago (canSkipRelayPublish), and none has failed
   * since. Then the profile needn't be sent, which spares a KV write, and
   * the status shows that publish (after a reload it would otherwise say
   * nothing was sent yet).
   */
  alreadyPublished(fingerprint: string | null | undefined, runRevision: number, now = Date.now()): boolean {
    const code = this.code;
    if (!code || this.status === 'error' || this.failures > 0) return false;
    let record: RelayPublishedRecord | null = null;
    try { record = parseRelayPublishedRecord(localStorage.getItem(PUBLISHED_KEY)); } catch { return false; }
    if (!record || !canSkipRelayPublish(record, code, fingerprint, runRevision, now)) return false;
    if (this.status !== 'synced' || this.lastSyncAt == null) {
      this.status = 'synced';
      this.lastSyncAt = record.at;
      this.lastError = null;
      this.emit();
    }
    return true;
  }

  /** Remember a publish that worked, for alreadyPublished. Best effort. */
  private recordPublished(code: string, published: PublishedProfile | undefined, at: number): void {
    try {
      if (!published?.fingerprint) {
        localStorage.removeItem(PUBLISHED_KEY);
        return;
      }
      const record: RelayPublishedRecord = {
        code, fingerprint: published.fingerprint, runRevision: published.runRevision, at,
      };
      localStorage.setItem(PUBLISHED_KEY, JSON.stringify(record));
    } catch { /* the next publish just isn't skipped */ }
  }

  /**
   * Push a (compressed) bundle payload to the relay. No-op when disabled.
   * `published` names the profile (its fingerprint and revision) so a later
   * unchanged one can be skipped.
   */
  push(payload: string, isCurrent: () => boolean = () => true, published?: PublishedProfile): Promise<boolean> {
    this.bindToActiveProfile();
    const session = this.session;
    if (!session || !this.enabled) return Promise.resolve(false);
    // Replacing, re-binding or disconnecting the pairing, here or in another
    // tab, drops the write.
    const current = () => this.enabled && this.session?.code === session.code
      && this.session.token === session.token && isCurrent();
    // Complete network writes in order across driver unmounts/profile switches.
    // A cancelled queued build never publishes; an already-sent write finishes
    // before the current profile's write, so the relay cannot end on stale data.
    const send = this.pushQueue.then(() => {
      if (!current()) return false;
      return this.sendPayload(payload, session, current, published);
    });
    this.pushQueue = send.catch(() => false);
    return send;
  }

  /**
   * A pairing saved before profiles were recorded goes to the first tab that
   * publishes it (the choice is written back for every tab). Storage is read
   * first: another tab may already have bound or replaced it, with its
   * storage event still on the way.
   */
  private bindToActiveProfile(): void {
    const session = this.session;
    if (!session || session.profileId !== undefined || this.activeProfileId === null) return;
    const stored = readStoredSession();
    if (stored !== undefined && !sameSession(stored, session)) {
      this.adoptStored(stored);
      return;
    }
    const bound: Session = { ...session, profileId: this.activeProfileId };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(bound)); } catch { /* this tab only */ }
    this.session = bound;
  }

  /** Take the pairing another tab stored: paired, re-paired, bound or disconnected. */
  private adoptStored(next: Session | null): void {
    if (sameSession(next, this.session)) return;
    const previousCode = this.code;
    this.session = next;
    if (!this.enabled) {
      this.status = 'off';
      this.lastError = null;
      this.lastSyncAt = null;
      this.resetFailures();
    } else if (this.code !== previousCode) {
      // Paired again for this profile; the driver publishes it from here too.
      this.status = 'syncing';
      this.lastError = null;
      this.lastSyncAt = null;
      this.resetFailures();
    }
    this.emit();
  }

  private async sendPayload(
    payload: string, session: Session, isCurrent: () => boolean, published?: PublishedProfile,
  ): Promise<boolean> {
    this.status = 'syncing';
    this.lastError = null;
    this.emit();
    try {
      const res = await this.post(`/r/${session.code}`, { token: session.token, payload });
      if (!res.ok) throw new RelayHttpError(res.status);
      if (!isCurrent()) return false;
      this.status = 'synced';
      this.lastSyncAt = Date.now();
      this.recordPublished(session.code, published, this.lastSyncAt);
      this.lastError = null;
      this.resetFailures();
      this.emit();
      return true;
    } catch (e: any) {
      if (!isCurrent()) return false;
      this.status = 'error';
      this.lastError = e?.message ?? 'push failed';
      this.failures += 1;
      this.lastFailure = this.lastError;
      this.retryable = isRetryableRelayError(e);
      this.emit();
      return false;
    }
  }

  /** JSON POST to the relay that rejects (and aborts) after REQUEST_TIMEOUT_MS. */
  private async post(path: string, body: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Race as well as abort, so a request that ignores the signal still ends.
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('relay timed out'));
      }, REQUEST_TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        fetch(`${this.base()}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }),
        timedOut,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}

export const relaySync = new RelaySyncService();
