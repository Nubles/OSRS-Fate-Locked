import { parseFateEvent, type FateEventEnvelope } from '../services/fateEventProtocol';
import type { RollInboxStore } from '../services/rollInboxStore';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What RuneLite's Copy for tracker puts on the clipboard (Stage 4). */
export const RUNELITE_COPY_FORMAT = 'fate-locked-runelite-events';
/** A paste from RuneLite takes up to this many events; the relay's batches keep MAX_EVENTS_PER_BATCH. */
export const MAX_PASTED_EVENTS = 250;

export interface PastedEvents {
  events: FateEventEnvelope[];
  /** Events older than the 30 days the tracker keeps them. */
  tooOld: number;
  /** Events the tracker can't read, and any beyond the paste's limit. */
  unreadable: number;
}

/** What RuneLite's Copy for tracker copied, or null when the text isn't its copy. */
export function parsePastedEvents(text: string): PastedEvents | null {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(input) || input.format !== RUNELITE_COPY_FORMAT || !Array.isArray(input.events)) return null;
  const events: FateEventEnvelope[] = [];
  let tooOld = 0;
  let unreadable = Math.max(0, input.events.length - MAX_PASTED_EVENTS);
  for (const item of input.events.slice(0, MAX_PASTED_EVENTS)) {
    const event = parseFateEvent(item);
    if (event) {
      events.push(event);
    } else if (isRecord(item) && Number.isSafeInteger(item.occurredAt)
      && (item.occurredAt as number) < Date.now() - THIRTY_DAYS_MS) {
      tooOld += 1;
    } else {
      unreadable += 1;
    }
  }
  return { events, tooOld, unreadable };
}

const were = (count: number): string => (count === 1 ? 'was' : 'were');

/** "Zezima", "Zezima and Nubles", or "Zezima, Nubles and Lynx Titan". */
function listed(names: readonly string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * RuneLite's events, added to the Roll Inbox: the one way they get there,
 * from Paste from RuneLite and from Send to tracker alike. The inbox skips
 * any event id it already has, and nothing rolls until the player says so.
 * A run linked to no one takes any character's events (plan decision 9), so
 * the characters are named for the line that says what was added.
 */
export function addRuneliteEvents(
  store: Pick<RollInboxStore, 'ingest'>,
  pasted: PastedEvents,
  linkedAccount: string | null | undefined,
): { added: number; characters: string[] } {
  const added = store.ingest(pasted.events);
  const characters = linkedAccount ? [] : [...new Set(pasted.events.map((event) => event.account))];
  return { added, characters };
}

/** "1 was too old." and "1 couldn’t be read.", for what a paste or a send left out. */
function leftOut(tooOld: number, unreadable: number): string[] {
  const parts: string[] = [];
  if (tooOld > 0) parts.push(`${tooOld} ${were(tooOld)} too old.`);
  if (unreadable > 0) parts.push(`${unreadable} couldn’t be read.`);
  return parts;
}

/**
 * What a paste from RuneLite did, in a line (Stage 4): "Added 5. 2 were already here. 1 was too
 * old." A run linked to no one takes any character's events, so the line names whose they were.
 */
export function pasteSummary(pasted: PastedEvents, added: number, characters: readonly string[] = []): string {
  const already = pasted.events.length - added;
  const parts = [`Added ${added}${characters.length > 0 ? ` from ${listed(characters)}` : ''}.`];
  if (already > 0) parts.push(`${already} ${were(already)} already here.`);
  parts.push(...leftOut(pasted.tooOld, pasted.unreadable));
  return parts.join(' ');
}

/** What RuneLite's Send to tracker brought into the Roll Inbox, since the player last saw it. */
export interface SentEvents {
  added: number;
  tooOld: number;
  unreadable: number;
  /** Whose events they were, for a run linked to no one. */
  characters: string[];
}

/** Two arrivals the player hasn't seen yet, told as one. */
export function mergeSentEvents(earlier: SentEvents, later: SentEvents): SentEvents {
  return {
    added: earlier.added + later.added,
    tooOld: earlier.tooOld + later.tooOld,
    unreadable: earlier.unreadable + later.unreadable,
    characters: [...new Set([...earlier.characters, ...later.characters])],
  };
}

/**
 * What Send to tracker added, in a line like a paste's: "Added 3 from RuneLite." or, for a run
 * linked to no one, "Added 3 from RuneLite (Player One)." Events that were already here aren't
 * mentioned: the tracker takes them again only when it couldn't empty the relay last time.
 */
export function sentSummary(sent: SentEvents): string {
  const whose = sent.characters.length > 0 ? ` (${listed(sent.characters)})` : '';
  return [`Added ${sent.added} from RuneLite${whose}.`, ...leftOut(sent.tooOld, sent.unreadable)].join(' ');
}
