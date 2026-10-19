import type { RollInboxStore } from './rollInboxStore';
import {
  addRuneliteEvents,
  mergeSentEvents,
  parsePastedEvents,
  type SentEvents,
} from '../utils/runelitePaste';
import { relayInboxIds } from '../utils/relayInbox';

/**
 * RuneLite's Send to tracker, the tracker's half: the relay holds what
 * RuneLite sent under the pairing code (`/r/<code>/inbox`, see
 * docs/online-relay.md), and the tracker takes it into the Roll Inbox the
 * way Paste from RuneLite does (addRuneliteEvents), then empties it. Nothing
 * rolls: the player still chooses Roll. Loaded with the Roll Inbox driver,
 * never with the app's entry.
 */

/** A request that stalls fails after this long, as a publish does. */
const REQUEST_TIMEOUT_MS = 15_000;

export type TakeOutcome =
  /** Read and emptied (or tried to empty). `sent` says what was new, or null when nothing was. */
  | { kind: 'taken'; sent: SentEvents | null }
  /** A network failure, a timeout, a busy or failing relay, or a code with no profile yet: try again later. */
  | { kind: 'failed' }
  /** The relay refused this pairing's token: trying again can't help until the pairing changes. */
  | { kind: 'refused' }
  /** A relay from before Send to tracker (`404 not found`): stop until the page is reloaded. */
  | { kind: 'unsupported' };

/** A relay request that rejects, and aborts, after REQUEST_TIMEOUT_MS. */
async function relayRequest(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('relay timed out'));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([fetch(url, { ...init, signal: controller.signal }), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Take what RuneLite sent: read the code's inbox with the pairing's token,
 * add the events to `store` as a paste does, then acknowledge every id read
 * (those already here and those too old or unreadable too), so the relay
 * holds nothing the tracker has seen. If the acknowledgement fails, the next
 * take reads them again and the inbox skips the ones it has.
 */
export async function takeSentEvents({ base, code, token, store, linkedAccount }: {
  base: string;
  code: string;
  token: string;
  store: Pick<RollInboxStore, 'ingest'>;
  linkedAccount: string | null | undefined;
}): Promise<TakeOutcome> {
  const auth = { Authorization: `Bearer ${token}` };
  let text: string;
  try {
    const response = await relayRequest(`${base}/r/${code}/inbox`, { headers: auth, cache: 'no-store' });
    text = await response.text();
    if (response.status === 404 && text.trim() === 'not found') return { kind: 'unsupported' };
    if (response.status === 403 || response.status === 400) return { kind: 'refused' };
    if (!response.ok) return { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
  const pasted = parsePastedEvents(text);
  if (!pasted) return { kind: 'failed' };
  const { added, characters } = addRuneliteEvents(store, pasted, linkedAccount);
  const ids = relayInboxIds(text);
  if (ids.length > 0) {
    try {
      await relayRequest(`${base}/r/${code}/inbox/ack`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // Read again next time; the Roll Inbox skips what it already has.
    }
  }
  const news = added > 0 || pasted.tooOld > 0 || pasted.unreadable > 0;
  return {
    kind: 'taken',
    sent: news ? { added, tooOld: pasted.tooOld, unreadable: pasted.unreadable, characters } : null,
  };
}

/**
 * When the tracker last asked the relay, and how many times in a row that
 * failed, for every driver in this page: a remount (a profile switch) keeps
 * the pace. `unsupported` lasts until the page is reloaded.
 */
export const relayInboxPace = { lastAttemptAt: null as number | null, failures: 0, unsupported: false };

/** For tests: a fresh page. */
export function resetRelayInboxForTest(): void {
  relayInboxPace.lastAttemptAt = null;
  relayInboxPace.failures = 0;
  relayInboxPace.unsupported = false;
  waiting.clear();
  listeners.clear();
}

type SentListener = (sent: SentEvents) => void;
/** What arrived for a run while no Roll Inbox showed it. */
const waiting = new Map<string, SentEvents>();
const listeners = new Map<string, Set<SentListener>>();

/** Tell the run's Roll Inbox what Send to tracker added, or keep it until one opens. */
export function announceSentEvents(runId: string, sent: SentEvents): void {
  const open = listeners.get(runId);
  if (open && open.size > 0) {
    for (const listener of open) listener(sent);
    return;
  }
  const earlier = waiting.get(runId);
  waiting.set(runId, earlier ? mergeSentEvents(earlier, sent) : sent);
}

/** Hear what Send to tracker adds to a run, starting with what arrived while no inbox was open. */
export function listenForSentEvents(runId: string, listener: SentListener): () => void {
  const earlier = waiting.get(runId);
  if (earlier) {
    waiting.delete(runId);
    listener(earlier);
  }
  let open = listeners.get(runId);
  if (!open) {
    open = new Set();
    listeners.set(runId, open);
  }
  open.add(listener);
  return () => {
    open.delete(listener);
  };
}

