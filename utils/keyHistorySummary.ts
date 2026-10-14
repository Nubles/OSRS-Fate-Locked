import type { LogEntry } from '../types';
import { isRollEntry } from './logEntry';

/**
 * The Key-roll summary the OSRS layout's History tab shows: per source group,
 * how many rolls were made and how many found a Key, plus the run's longest
 * dry streak, its luckiest roll and the latest Key found. Read-only over the
 * history; it never changes what a roll was.
 *
 * "Found a Key" means the roll paid out: ROLL_SUCCESS, ROLL_OMNI or a PITY Key.
 * A dry streak is a run of rolls in a row that found nothing (a pity Key ends
 * it, since it pays a Key). The luckiest roll is the won roll (not pity) that
 * had the smallest chance of winning.
 */
export type KeySourceGroup =
  | 'Slayer'
  | 'Clues'
  | 'Bosses'
  | 'Activities'
  | 'Quests'
  | 'Diaries'
  | 'Combat Achievements'
  | 'Collection log'
  | 'Levels'
  | 'Pets'
  | 'Other';

/** Display order, roughly the Farm Keys tabs first, then the Journal sources. */
export const KEY_SOURCE_GROUPS: readonly KeySourceGroup[] = [
  'Slayer', 'Clues', 'Bosses', 'Activities', 'Quests', 'Diaries',
  'Combat Achievements', 'Collection log', 'Levels', 'Pets', 'Other',
];

/** Which group a roll's source belongs to, from the source names the rolls write. */
export const keySourceGroup = (source: string | undefined): KeySourceGroup => {
  const s = (source ?? '').trim().toLowerCase();
  if (!s) return 'Other';
  if (s.startsWith('slayer')) return 'Slayer';
  if (s.startsWith('clue')) return 'Clues';
  if (s.startsWith('boss') || s.startsWith('raid')) return 'Bosses';
  if (s.startsWith('activity') || s.startsWith('minigame')) return 'Activities';
  if (s.startsWith('quest')) return 'Quests';
  if (s.startsWith('diary')) return 'Diaries';
  if (s.startsWith('combat achievement')) return 'Combat Achievements';
  if (s.startsWith('col. log') || s.startsWith('collection log')) return 'Collection log';
  if (s === 'level up' || / level \d+$/.test(s)) return 'Levels';
  if (s.startsWith('pet')) return 'Pets';
  return 'Other';
};

export interface KeySourceRow {
  group: KeySourceGroup;
  rolls: number;
  keys: number;
  /** keys / rolls, 0..1. */
  rate: number;
}

export interface KeyHistorySummary {
  rows: KeySourceRow[];
  rolls: number;
  keys: number;
  longestDry: number;
  currentDry: number;
  /** The won roll with the smallest chance, and that chance in percent. */
  luckiest: { entry: LogEntry; chance: number } | null;
  latestKey: LogEntry | null;
}

export const foundKey = (e: LogEntry): boolean =>
  e.type === 'ROLL_SUCCESS' || e.type === 'ROLL_OMNI' || e.type === 'PITY';

/** The roll's chance in percent: the exact success probability when logged, else its threshold. */
const chanceOf = (e: LogEntry): number | null => {
  const p = e.meta?.successProbability;
  if (typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1) return p * 100;
  const t = e.threshold;
  return typeof t === 'number' && Number.isFinite(t) && t >= 0 && t <= 100 ? t : null;
};

export const summarizeKeyHistory = (history: readonly LogEntry[]): KeyHistorySummary => {
  const byGroup = new Map<KeySourceGroup, { rolls: number; keys: number }>();
  let rolls = 0;
  let keys = 0;
  let dry = 0;
  let longestDry = 0;
  let luckiest: KeyHistorySummary['luckiest'] = null;
  let latestKey: LogEntry | null = null;

  for (const e of history) {
    if (!isRollEntry(e)) continue;
    const won = foundKey(e);
    const group = keySourceGroup(e.source);
    const g = byGroup.get(group) ?? { rolls: 0, keys: 0 };
    g.rolls += 1;
    if (won) g.keys += 1;
    byGroup.set(group, g);
    rolls += 1;
    if (won) {
      keys += 1;
      dry = 0;
      latestKey = e;
    } else {
      dry += 1;
      longestDry = Math.max(longestDry, dry);
    }
    if (e.type === 'ROLL_SUCCESS' || e.type === 'ROLL_OMNI') {
      const chance = chanceOf(e);
      if (chance !== null && (!luckiest || chance < luckiest.chance)) luckiest = { entry: e, chance };
    }
  }

  const rows = KEY_SOURCE_GROUPS
    .filter(group => byGroup.has(group))
    .map(group => {
      const g = byGroup.get(group)!;
      return { group, rolls: g.rolls, keys: g.keys, rate: g.rolls ? g.keys / g.rolls : 0 };
    });

  return { rows, rolls, keys, longestDry, currentDry: dry, luckiest, latestKey };
};

/** "12%" / "8.3%" / "0%": whole numbers from 10% up, one decimal below. */
export const formatRate = (rate: number): string => {
  const pct = rate * 100;
  if (pct === 0 || pct >= 10) return `${Math.round(pct)}%`;
  return `${(Math.round(pct * 10) / 10).toString()}%`;
};
