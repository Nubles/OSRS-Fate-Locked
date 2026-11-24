import { LogEntry, TableType } from '../types';
import { formatKeyPercent, formatKeyRollValue } from './keyRoll';
import { tableDisplayName } from './tableDisplay';
import { chunkLabelWithCoords } from './chunkLabelWithCoords';
import { BANK_BY_ID } from '../data/banks';

// An unlock's item the way its History card names it. Chunks are stored as
// their key ("49,50") and banks as their chunk id ("13618"); the reducer logs
// the place name, so the caption under the card does too.
const unlockItemLabel = (e: LogEntry): string | undefined => {
  const item = e.meta?.item;
  if (typeof item !== 'string' || !item) return undefined;
  if (e.meta?.category === TableType.BANKS) return BANK_BY_ID[item]?.name ?? item;
  if (e.meta?.category === TableType.CHUNKS && /^-?\d+,-?\d+$/.test(item)) return chunkLabelWithCoords(item);
  return item;
};

// Narrator voice — short, slightly dramatic, never cringe. Each returns a
// single sentence to display under the event card during playback.
export const narrate = (e: LogEntry): string => {
  switch (e.type) {
    case 'ROLL_OMNI':
      return `The dice glow gold — an Omni-Key materialises${e.source ? ` from ${e.source}` : ''}.`;
    case 'PET':
      return 'A new pet joins the run, and an Omni-Key comes with it.';
    case 'ROLL_SUCCESS':
      return `${e.source ?? 'The source'} yields a key. ${
        e.rollValue === undefined ? '?' : formatKeyRollValue(e.rollValue)
      } vs ${
        e.threshold === undefined ? '?' : formatKeyPercent(e.threshold)
      }.`;
    case 'PITY': {
      // The threshold the run had when this Key came (legacy Casual 30,
      // Region Rush 45, Custom 10 to 100). Older entries do not record it.
      const at = e.meta?.pityThreshold;
      const heavy = Number.isInteger(at) && at > 0 ? `grown heavy at ${at}` : 'grown heavy';
      return `Fate, ${heavy}, tips the scales. A key regardless.`;
    }
    case 'ROLL_FAIL':
      return `${e.source ?? 'It'} turns up empty. Another grain of fate settles.`;
    case 'UNLOCK': {
      const item = unlockItemLabel(e) ?? 'Something new';
      const category = typeof e.meta?.category === 'string' ? e.meta.category : '';
      // The table's Spend Keys name, which may be singular, plural or a mass noun.
      return `${item} is unlocked${category ? ` under ${tableDisplayName(category)}` : ''}.`;
    }
    case 'ALTAR': {
      // Ritual names, places and Keys keep their capitals; a message that
      // already ends in a mark ('Void Gambit lost.') gets no second one.
      const said = (e.message ?? '').trim();
      if (!said) return 'The altar flares.';
      return `The altar flares: ${said}${/[.!?]$/.test(said) ? '' : '.'}`;
    }
    case 'LEVEL_UP':
      return /Chaos Key Drop/.test(e.message)
        ? `A crack of Chaos — the world rewards persistence.`
        : `${e.message}`;
    default:
      return e.message;
  }
};

export interface Milestone {
  index: number;
  label: string;
  image: string;
}

// Walk history once and pick out moments that feel important enough to
// flag on the timeline — first-of-type events, round numbers, and rare
// outcomes (omni, pity). Used for the jump-to-milestone button.
export const detectMilestones = (history: LogEntry[]): Milestone[] => {
  const seen = new Set<string>();
  const out: Milestone[] = [];
  let rollCount = 0;
  for (let i = 0; i < history.length; i++) {
    const e = history[i];
    if (e.type === 'ROLL_OMNI' || e.type === 'ROLL_SUCCESS' || e.type === 'ROLL_FAIL' || e.type === 'PITY') {
      rollCount += 1;
    }
    const push = (label: string, image: string) => out.push({ index: i, label, image });

    if (i === 0) push('First fate cast', 'Mind_rune.png');
    if (e.type === 'ROLL_OMNI' && !seen.has('omni')) { seen.add('omni'); push('First Omni-Key!', 'Crystal_key.png'); }
    if (e.type === 'PET' && !seen.has('pet')) { seen.add('pet'); push('First pet!', 'Vorki.png'); }
    if (e.type === 'PITY' && !seen.has('pity')) { seen.add('pity'); push('First Pity Key', 'Shield_slot.png'); }
    if (e.type === 'ROLL_SUCCESS' && !seen.has('success')) { seen.add('success'); push('First Key earned', 'Brass_key.png'); }
    if (e.type === 'UNLOCK' && !seen.has('unlock')) { seen.add('unlock'); push(`First unlock: ${unlockItemLabel(e) ?? '?'}`, 'Brass_key.png'); }
    if (e.type === 'LEVEL_UP' && !seen.has('level')) { seen.add('level'); push('First level up', 'Stats_icon.png'); }
    // Chunked's start-chunk Keys log as XTREME_MILESTONE too, so the label names neither mode.
    if (e.type === 'XTREME_MILESTONE') push('Start-area milestone Key', 'Crystal_key.png');
    if (e.type === 'ALTAR' && !seen.has('altar')) { seen.add('altar'); push('First ritual performed', 'Lit_candle.png'); }
    if (rollCount > 0 && rollCount % 100 === 0 && !seen.has(`r${rollCount}`)) {
      seen.add(`r${rollCount}`);
      push(`${rollCount} rolls cast`, 'Mind_rune.png');
    }
  }
  return out;
};

// Day number derived from first timestamp. "Day 1" is whichever day the
// first event fires on; subsequent days count from there so short runs
// don't start at "Day 1027…".
export const toRunDay = (timestamp: number, firstTimestamp: number): number => {
  const firstDay = new Date(firstTimestamp);
  firstDay.setHours(0, 0, 0, 0);
  const cur = new Date(timestamp);
  cur.setHours(0, 0, 0, 0);
  const diffMs = cur.getTime() - firstDay.getTime();
  return Math.floor(diffMs / 86_400_000) + 1;
};

/** One bar of the timelapse's strip with the gap beside it, in px. */
export const TIMELAPSE_BAR_PX = 3;

/**
 * Whether every entry of a run can have its own 2px bar and 1px gap in a
 * strip this wide. A 1,392px strip (a 1440px screen) holds 464 entries and a
 * phone's about 110, so a long run's bars ran off the right edge and took
 * the marker for the current entry with them. When they do not fit, the
 * strip packs them edge to edge instead. A strip that has not been measured
 * yet (0) counts as fitting.
 */
export const timelapseBarsFit = (entries: number, stripWidth: number): boolean =>
  stripWidth <= 0 || entries * TIMELAPSE_BAR_PX <= stripWidth;
