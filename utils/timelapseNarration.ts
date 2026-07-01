import { LogEntry } from '../types';

// Narrator voice — short, slightly dramatic, never cringe. Each returns a
// single sentence to display under the event card during playback.
export const narrate = (e: LogEntry): string => {
  switch (e.type) {
    case 'ROLL_OMNI':
      return `The dice glow gold — an Omni-Key materialises${e.source ? ` from ${e.source}` : ''}.`;
    case 'ROLL_SUCCESS':
      return `${e.source ?? 'The source'} yields a key. ${e.rollValue ?? '?'} vs ${e.threshold ?? '?'}.`;
    case 'PITY':
      return `Fate, grown heavy at 50, tips the scales. A key regardless.`;
    case 'ROLL_FAIL':
      return `${e.source ?? 'It'} turns up empty. Another grain of fate settles.`;
    case 'UNLOCK': {
      const item = e.meta?.item ?? 'something new';
      const category = e.meta?.category ?? '';
      return `${item} is unlocked${category ? ` — a new ${category.toLowerCase()} bows open` : ''}.`;
    }
    case 'ALTAR':
      return `The altar flares: ${e.message.toLowerCase()}.`;
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
  emoji: string;
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
    const push = (label: string, emoji: string) => out.push({ index: i, label, emoji });

    if (i === 0) push('First fate cast', '🌀');
    if (e.type === 'ROLL_OMNI' && !seen.has('omni')) { seen.add('omni'); push('First Omni-Key!', '✨'); }
    if (e.type === 'PITY' && !seen.has('pity')) { seen.add('pity'); push('First Pity Key', '🛡️'); }
    if (e.type === 'ROLL_SUCCESS' && !seen.has('success')) { seen.add('success'); push('First Key earned', '🗝️'); }
    if (e.type === 'UNLOCK' && !seen.has('unlock')) { seen.add('unlock'); push(`First unlock: ${e.meta?.item ?? '?'}`, '🔓'); }
    if (e.type === 'LEVEL_UP' && !seen.has('level')) { seen.add('level'); push('First level up', '📈'); }
    if (e.type === 'XTREME_MILESTONE') push('Xtreme milestone key', '🌟');
    if (e.type === 'ALTAR' && !seen.has('altar')) { seen.add('altar'); push('First ritual performed', '🕯️'); }
    if (rollCount > 0 && rollCount % 100 === 0 && !seen.has(`r${rollCount}`)) {
      seen.add(`r${rollCount}`);
      push(`${rollCount} rolls cast`, '🎲');
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
