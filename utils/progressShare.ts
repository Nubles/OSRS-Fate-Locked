/**
 * Relay requests for shared progress (docs/shared-progress.md). The record
 * itself, with its id and write token, is in utils/progressShareRecord.ts.
 */
import {
  newProgressShareRecord, readProgressShare, writeProgressShare, type ProgressShareRecord,
} from './progressShareRecord';
import { showToast } from './toast';

export {
  PROGRESS_SHARE_EVENT,
  newProgressShareRecord,
  readProgressShare,
  writeProgressShare,
  type ProgressShareEventDetail,
  type ProgressShareRecord,
} from './progressShareRecord';

export type PublishResult =
  | { ok: true }
  /** The relay had a publish within the last minute: try again after `retryAfterMs`. */
  | { ok: false; retryAfterMs: number }
  | { ok: false; error: 'forbidden' | 'rejected' | 'network' };

const auth = (record: ProgressShareRecord) => ({ Authorization: `Bearer ${record.token}` });

/**
 * The summary the relay last accepted from this page for each run id, as sent,
 * whichever part of the page sent it (ProgressShareDriver or the Discord
 * settings), so the driver skips only what the relay really has.
 */
const acceptedSummaries = new Map<string, string>();
export const lastAcceptedSummary = (id: string): string | undefined => acceptedSummaries.get(id);

export async function publishProgress(
  base: string,
  record: ProgressShareRecord,
  snapshot: unknown,
  fetchFn: typeof fetch = fetch,
): Promise<PublishResult> {
  try {
    const body = JSON.stringify(snapshot);
    const response = await fetchFn(`${base}/p/${record.id}`, {
      method: 'POST',
      headers: { ...auth(record), 'Content-Type': 'application/json' },
      body,
    });
    if (response.ok) {
      acceptedSummaries.set(record.id, body);
      return { ok: true };
    }
    if (response.status === 429) return { ok: false, retryAfterMs: 60_000 };
    if (response.status === 403) return { ok: false, error: 'forbidden' };
    return { ok: false, error: response.status >= 500 ? 'network' : 'rejected' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export type LinkCodeResult =
  | { ok: true; code: string; expiresAt: number }
  /** Nothing is published yet, or the relay could not be reached. */
  | { ok: false; error: 'not-published' | 'forbidden' | 'network' };

export async function requestLinkCode(
  base: string,
  record: ProgressShareRecord,
  fetchFn: typeof fetch = fetch,
): Promise<LinkCodeResult> {
  try {
    const response = await fetchFn(`${base}/p/${record.id}/link-code`, { method: 'POST', headers: auth(record) });
    if (response.status === 404) return { ok: false, error: 'not-published' };
    if (response.status === 403) return { ok: false, error: 'forbidden' };
    if (!response.ok) return { ok: false, error: 'network' };
    const body = await response.json() as { code?: unknown; expiresAt?: unknown };
    if (typeof body.code !== 'string' || typeof body.expiresAt !== 'number') return { ok: false, error: 'network' };
    return { ok: true, code: body.code, expiresAt: body.expiresAt };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** Ask the relay to forget the run's progress. Best effort: it expires after 90 days anyway. */
export async function deleteProgress(
  base: string,
  record: ProgressShareRecord,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  acceptedSummaries.delete(record.id);
  try {
    return (await fetchFn(`${base}/p/${record.id}`, { method: 'DELETE', headers: auth(record) })).ok;
  } catch {
    return false;
  }
}

/** Ids this page made to replace a refused one. */
const replacementIds = new Set<string>();

/**
 * The relay refused this browser's own id (403): another write token holds
 * it, so this browser can never publish there again. Move the run to a new id
 * and token, keeping its settings, and tell the player, since the old Log link
 * and Discord link point at the old id. Returns the record to use from now on:
 * the new one, or the one a caller in this page already moved to; null when
 * there is nothing to move, or when the refused id is itself one this page
 * made, so a relay that refuses everything can't make it mint ids over and over.
 */
export function replaceRefusedShare(storageKey: string, refused: ProgressShareRecord): ProgressShareRecord | null {
  const current = readProgressShare(storageKey);
  if (!current) return null;
  if (current.id !== refused.id) return current;
  if (replacementIds.has(refused.id)) return null;
  const next: ProgressShareRecord = {
    ...newProgressShareRecord(), enabled: current.enabled, ...(current.publicLog ? { publicLog: true } : {}),
  };
  replacementIds.add(next.id);
  writeProgressShare(storageKey, next);
  showToast('Your Adventurer\'s Log link changed and Discord needs linking again.');
  return next;
}

/** "ABCD-EFGH": a link code as the player reads it. */
export const formatLinkCode = (code: string): string =>
  code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
