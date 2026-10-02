import { parseFateEvent, type FateEventEnvelope } from '../services/fateEventProtocol';

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
 * What a paste from RuneLite did, in a line (Stage 4): "Added 5. 2 were already here. 1 was too
 * old." A run linked to no one takes any character's events, so the line names whose they were.
 */
export function pasteSummary(pasted: PastedEvents, added: number, characters: readonly string[] = []): string {
  const already = pasted.events.length - added;
  const parts = [`Added ${added}${characters.length > 0 ? ` from ${listed(characters)}` : ''}.`];
  if (already > 0) parts.push(`${already} ${were(already)} already here.`);
  if (pasted.tooOld > 0) parts.push(`${pasted.tooOld} ${were(pasted.tooOld)} too old.`);
  if (pasted.unreadable > 0) parts.push(`${pasted.unreadable} couldn’t be read.`);
  return parts.join(' ');
}
