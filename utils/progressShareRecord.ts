/**
 * This browser's shared-progress record for a run (docs/shared-progress.md).
 * Kept apart from utils/progressShare.ts (the relay requests), so the
 * always-mounted driver can read it without loading the rest.
 *
 * Shared progress with the Fate Locked Discord bot:
 *
 * When a player turns sharing on, this browser makes a random id and write
 * token for the run and publishes a ProgressSnapshot to the relay under that
 * id. A one-time link code lets the bot tie the run to the player's Discord
 * account. The record lives in per-profile localStorage OUTSIDE GameState, so
 * the write token never travels with exports, sync codes or backups.
 */
import { profileProgressShareKey } from './profileStorage';

export interface ProgressShareRecord {
  /** 16 random bytes, base64url: where the relay keeps the run's progress. */
  id: string;
  /** 32 random bytes, base64url: proves this browser may replace or delete it. */
  token: string;
  /** Whether this browser publishes progress for the run. */
  enabled: boolean;
}

/** Fired on window when a run's record changes, so the driver and the settings agree. */
export const PROGRESS_SHARE_EVENT = 'fate:progress-share';
export interface ProgressShareEventDetail { storageKey: string }

const ID_RE = /^[A-Za-z0-9_-]{22}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const newProgressShareRecord = (
  random: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes),
): ProgressShareRecord => ({
  id: toBase64Url(random(new Uint8Array(16))),
  token: toBase64Url(random(new Uint8Array(32))),
  enabled: true,
});

export const readProgressShare = (storageKey: string): ProgressShareRecord | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileProgressShareKey(storageKey)) ?? '');
    if (typeof parsed?.id === 'string' && ID_RE.test(parsed.id)
      && typeof parsed?.token === 'string' && TOKEN_RE.test(parsed.token)) {
      return { id: parsed.id, token: parsed.token, enabled: parsed.enabled === true };
    }
  } catch {
    /* missing or unreadable: not shared */
  }
  return null;
};

export const writeProgressShare = (storageKey: string, record: ProgressShareRecord | null): void => {
  try {
    if (record) localStorage.setItem(profileProgressShareKey(storageKey), JSON.stringify(record));
    else localStorage.removeItem(profileProgressShareKey(storageKey));
  } catch {
    /* quota: the settings show the stale value, nothing worse */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ProgressShareEventDetail>(PROGRESS_SHARE_EVENT, { detail: { storageKey } }));
};
