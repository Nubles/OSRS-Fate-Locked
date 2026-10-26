import type { LogEntry } from '../types';
import { isRollEntry } from './logEntry';

/** Away this long since the run's last entry and the welcome-back note shows. */
export const WELCOME_BACK_AFTER_MS = 12 * 60 * 60 * 1000;
/** A quiet spell this long between entries ends a session. */
export const SESSION_GAP_MS = 3 * 60 * 60 * 1000;

export interface LastSession {
  /** The run's last entry: the note is dismissed against it. */
  lastId: string;
  awayMs: number;
  rolls: number;
  keys: number;
  chaosKeys: number;
  fate: number;
  unlocks: string[];
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The player's last session (the entries before the most recent quiet spell)
 * when they've been away at least WELCOME_BACK_AFTER_MS, or null.
 */
export const lastSession = (history: readonly LogEntry[], now: number): LastSession | null => {
  if (!history.length) return null;
  const last = history[history.length - 1];
  const awayMs = now - last.timestamp;
  if (!(awayMs >= WELCOME_BACK_AFTER_MS)) return null;
  let start = history.length - 1;
  while (start > 0 && history[start].timestamp - history[start - 1].timestamp < SESSION_GAP_MS) start--;
  const out: LastSession = { lastId: last.id, awayMs, rolls: 0, keys: 0, chaosKeys: 0, fate: 0, unlocks: [] };
  for (let i = start; i < history.length; i++) {
    const e = history[i];
    const meta = e.meta ?? {};
    if (isRollEntry(e)) {
      out.rolls++;
      // Older entries carry no award count: a success or pity was one Key.
      out.keys += 'standardKeysAwarded' in meta ? num(meta.standardKeysAwarded) : e.type === 'ROLL_SUCCESS' || e.type === 'PITY' ? 1 : 0;
      out.fate += num(meta.fatePointsEarned);
    }
    out.chaosKeys += num(meta.chaosKeysAwarded);
    if (e.type === 'UNLOCK') out.unlocks.push(e.message.startsWith('Unlocked ') ? e.message.slice('Unlocked '.length) : String(meta.item ?? e.message));
  }
  return out;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "3 days" / "14 hours" */
export const awayText = (ms: number): string => {
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 48 ? plural(Math.floor(hours / 24), 'day') : plural(hours, 'hour');
};

const listOf = (items: readonly string[], max = 3): string => {
  const shown = items.slice(-max);
  const more = items.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${plural(more, 'more', 'more')}`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] ?? '';
};

/**
 * "Welcome back: 3 days away. Last session: 14 rolls, 2 Keys won, 1 unlock
 * (Vorkath). 6 Fate from a Pity Key."
 */
export const welcomeBackText = (s: LastSession, pityLeft?: number): string => {
  const parts: string[] = [];
  if (s.rolls) parts.push(plural(s.rolls, 'roll'));
  if (s.keys) parts.push(`${plural(s.keys, 'Key')} won`);
  if (s.chaosKeys) parts.push(`${plural(s.chaosKeys, 'Chaos Key')} won`);
  if (s.unlocks.length) parts.push(`${plural(s.unlocks.length, 'unlock')} (${listOf(s.unlocks)})`);
  const last = parts.length ? ` Last session: ${parts.join(', ')}.` : '';
  const pity = pityLeft !== undefined && pityLeft > 0 ? ` ${plural(pityLeft, 'Fate Point')} from a Pity Key.` : '';
  return `Welcome back: ${awayText(s.awayMs)} away.${last}${pity}`;
};
