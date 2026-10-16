/**
 * Moving a run to its character's new name after an OSRS name change.
 *
 * A run is bound to one character so that only that character's progress
 * counts: RuneLite records only while that name is logged in, and Sync & Roll
 * only pulls that name's hiscores. A name change keeps the character but not
 * the name, so the run may move to the new name, but only once Wise Old Man
 * has approved the change. Wise Old Man approves a change only when the old
 * name has left the hiscores and the new name carries on from the old one's
 * stats, so a run can't be moved onto a different character this way.
 */

const WOM_API = 'https://api.wiseoldman.net/v2';

export type RenameCheck =
  /** Wise Old Man approved the change: the run can move to `name`. */
  | { status: 'approved'; name: string }
  /** Wise Old Man has the change but hasn't decided yet. */
  | { status: 'pending' }
  /** Wise Old Man turned the change down. */
  | { status: 'denied'; message: string }
  /** The name typed can't be used, or Wise Old Man couldn't be asked. */
  | { status: 'error'; message: string };

interface NameChange {
  oldName?: unknown;
  newName?: unknown;
  status?: unknown;
  reviewContext?: { reason?: unknown } | null;
  createdAt?: unknown;
}

/** Letters, numbers, spaces, hyphens and underscores, 1 to 12 long, as in game. */
const OSRS_NAME = /^[A-Za-z0-9 _-]{1,12}$/;

/** How Wise Old Man compares names: spaces, hyphens and underscores alike, any case. */
export const womNameKey = (name: string): string =>
  name.replace(/[-_\s]+/g, ' ').trim().toLowerCase();

const DENIED_REASONS: Record<string, string> = {
  manual_review: 'A Wise Old Man moderator turned it down.',
  old_stats_cannot_be_found: "Wise Old Man couldn't find the old name's stats.",
  new_name_not_on_the_hiscores: "The new name isn't on the OSRS hiscores yet. Log in on it, then try again once the hiscores update.",
  negative_gains: 'The new name has lower stats than the old name had, so they look like different characters.',
};

const deniedMessage = (change: NameChange): string => {
  const reason = typeof change.reviewContext?.reason === 'string' ? change.reviewContext.reason : '';
  return `Wise Old Man turned down this name change. ${DENIED_REASONS[reason] ?? ''}`.trim();
};

const isPair = (change: NameChange, from: string, to: string): boolean =>
  typeof change.oldName === 'string'
  && typeof change.newName === 'string'
  && womNameKey(change.oldName) === womNameKey(from)
  && womNameKey(change.newName) === womNameKey(to);

const newestFirst = (changes: NameChange[]): NameChange[] =>
  [...changes].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/**
 * Ask Wise Old Man whether the character bound as `boundName` is now called
 * `newName`. Checks the new name's approved name changes first; failing that,
 * reports a change Wise Old Man already has for this pair, or submits one so
 * it can review it.
 */
export async function checkCharacterRename(
  boundName: string,
  newName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RenameCheck> {
  const to = newName.trim();
  if (!OSRS_NAME.test(to)) {
    return { status: 'error', message: 'Type the new name as it shows in game: up to 12 letters, numbers, spaces, hyphens or underscores.' };
  }
  if (womNameKey(to) === womNameKey(boundName)) {
    return { status: 'error', message: 'That is the name this run already uses.' };
  }

  try {
    // 1. Every approved change of the character now called `to`. Any of them
    // leaving the bound name proves it is the same character.
    const history = await fetchImpl(`${WOM_API}/players/${encodeURIComponent(to)}/names`);
    if (history.ok) {
      const changes = await readJson(history);
      if (Array.isArray(changes)) {
        const approved = (changes as NameChange[]).filter((change) => change.status === 'approved');
        const leftBound = approved.some((change) =>
          typeof change.oldName === 'string' && womNameKey(change.oldName) === womNameKey(boundName));
        if (leftBound) {
          // The newest approved change carries the name's in-game spelling.
          const latest = newestFirst(approved).find((change) =>
            typeof change.newName === 'string' && womNameKey(change.newName) === womNameKey(to));
          return { status: 'approved', name: typeof latest?.newName === 'string' ? latest.newName : to };
        }
      }
    } else if (history.status === 429) {
      return { status: 'error', message: 'Wise Old Man is busy. Wait a minute and try again.' };
    } else if (history.status !== 404) {
      return { status: 'error', message: `Wise Old Man couldn't be reached (${history.status}). Try again later.` };
    }

    // 2. A change Wise Old Man already has for this pair, waiting or turned down.
    const search = await fetchImpl(`${WOM_API}/names?username=${encodeURIComponent(to)}&limit=50`);
    if (search.ok) {
      const found = await readJson(search);
      const known = Array.isArray(found)
        ? newestFirst((found as NameChange[]).filter((change) => isPair(change, boundName, to)))[0]
        : undefined;
      if (known?.status === 'approved') return { status: 'approved', name: to };
      if (known?.status === 'pending') return { status: 'pending' };
      if (known?.status === 'denied') return { status: 'denied', message: deniedMessage(known) };
    }

    // 3. Nothing yet: hand the change to Wise Old Man to review.
    const submit = await fetchImpl(`${WOM_API}/names`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName: boundName, newName: to }),
    });
    const submitted = await readJson(submit) as (NameChange & { message?: unknown }) | null;
    if (submit.ok) {
      if (submitted?.status === 'approved') return { status: 'approved', name: to };
      if (submitted?.status === 'denied') return { status: 'denied', message: deniedMessage(submitted) };
      return { status: 'pending' };
    }
    if (submit.status === 429) {
      return { status: 'error', message: 'Wise Old Man is busy. Wait a minute and try again.' };
    }
    const message = typeof submitted?.message === 'string' ? submitted.message : `error ${submit.status}`;
    return { status: 'error', message: `Wise Old Man couldn't take this name change: ${message}` };
  } catch {
    return { status: 'error', message: "Wise Old Man couldn't be reached. Check your connection and try again." };
  }
}
