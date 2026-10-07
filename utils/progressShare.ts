/**
 * Relay requests for shared progress (docs/shared-progress.md). The record
 * itself, with its id and write token, is in utils/progressShareRecord.ts.
 */
import type { ProgressShareRecord } from './progressShareRecord';

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

export async function publishProgress(
  base: string,
  record: ProgressShareRecord,
  snapshot: unknown,
  fetchFn: typeof fetch = fetch,
): Promise<PublishResult> {
  try {
    const response = await fetchFn(`${base}/p/${record.id}`, {
      method: 'POST',
      headers: { ...auth(record), 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (response.ok) return { ok: true };
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
  try {
    return (await fetchFn(`${base}/p/${record.id}`, { method: 'DELETE', headers: auth(record) })).ok;
  } catch {
    return false;
  }
}

/** "ABCD-EFGH": a link code as the player reads it. */
export const formatLinkCode = (code: string): string =>
  code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
