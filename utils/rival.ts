/**
 * Rival Ghost — a simulated nemesis account that progresses on its own fate,
 * in parallel with the player, so a run has stakes.
 *
 * A simulated rival is fully described by a tempo (keys/day), a seed, and a
 * start time; its completion at any moment is derived deterministically (so it
 * needs no ongoing storage and replays identically). A "friend" rival is just a
 * static completion snapshot decoded from a shared sync code.
 *
 * Pure + side-effect free.
 */

import {
  REGIONS_LIST, BOSSES_LIST, MINIGAMES_LIST, GUILDS_LIST,
} from '../constants';
import { COMPLETION_DENOMINATOR } from './completion';
import { RivalState } from '../types';

const MS_PER_DAY = 86_400_000;

export interface RivalPersona {
  id: string;
  name: string;
  emoji: string;
  keysPerDay: number;
  blurb: string;
}

export const RIVAL_PERSONAS: RivalPersona[] = [
  { id: 'casual', name: 'Casual Carl', emoji: '😎', keysPerDay: 4, blurb: 'Logs in after work. Beatable… probably.' },
  { id: 'steady', name: 'Steady Sam', emoji: '🧭', keysPerDay: 10, blurb: 'A reliable daily grind. Always creeping up.' },
  { id: 'sweat', name: 'Sweaty Zezima', emoji: '🔥', keysPerDay: 26, blurb: 'No-lifing the leagues. Good luck.' },
];

export const getPersona = (id: string): RivalPersona =>
  RIVAL_PERSONAS.find((p) => p.id === id) ?? RIVAL_PERSONAS[1];

// Deterministic 0..1 noise from (seed, dayIndex) — gives the rival a slightly
// uneven pace instead of a perfectly straight line.
const noise = (seed: number, n: number): number => {
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Keys the simulated rival has earned by `now` (with ±20% daily jitter). */
export const simulatedRivalKeys = (rival: RivalState, now: number): number => {
  const days = Math.max(0, (now - rival.startedAt) / MS_PER_DAY);
  const whole = Math.floor(days);
  let keys = 0;
  for (let d = 0; d < whole; d++) keys += rival.keysPerDay * (0.8 + 0.4 * noise(rival.seed, d));
  keys += rival.keysPerDay * (days - whole) * (0.8 + 0.4 * noise(rival.seed, whole));
  return keys;
};

/** The rival's completion % right now (0–100). */
export const rivalCompletion = (rival: RivalState, now: number): number => {
  if (rival.mode === 'friend') return Math.min(100, Math.max(0, Math.round(rival.friendPct ?? 0)));
  return Math.min(100, Math.round((simulatedRivalKeys(rival, now) / COMPLETION_DENOMINATOR) * 100));
};

/** Days until a simulated rival reaches `targetPct` (null if already there / friend). */
export const rivalDaysTo = (rival: RivalState, now: number, targetPct: number): number | null => {
  if (rival.mode === 'friend' || rival.keysPerDay <= 0) return null;
  const targetKeys = (targetPct / 100) * COMPLETION_DENOMINATOR;
  const have = simulatedRivalKeys(rival, now);
  if (have >= targetKeys) return 0;
  return (targetKeys - have) / rival.keysPerDay;
};

// A pool of "notable" unlocks for flavor headlines, in a stable order.
const NOTABLE = [
  ...BOSSES_LIST.map((n) => ({ kind: 'boss' as const, name: n })),
  ...REGIONS_LIST.map((n) => ({ kind: 'region' as const, name: n })),
  ...MINIGAMES_LIST.map((n) => ({ kind: 'minigame' as const, name: n })),
  ...GUILDS_LIST.map((n) => ({ kind: 'guild' as const, name: n })),
];

// Seeded Fisher–Yates so each rival "discovers" notable unlocks in its own order.
const shuffled = (seed: number) => {
  const a = NOTABLE.slice();
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export interface Headline { kind: 'boss' | 'region' | 'minigame' | 'guild'; name: string }

/** The notable unlocks the rival has reached at `pct` completion (most-recent last). */
export const rivalHeadlines = (rival: RivalState, pct: number): Headline[] => {
  const order = shuffled(rival.seed || 1);
  const count = Math.min(order.length, Math.floor((pct / 100) * order.length));
  return order.slice(0, count);
};

export interface Standing {
  playerPct: number;
  rivalPct: number;
  /** player − rival (positive = you're ahead). */
  lead: number;
  leader: 'you' | 'rival' | 'tie';
}

export const standing = (playerPct: number, rivalPct: number): Standing => {
  const lead = playerPct - rivalPct;
  return { playerPct, rivalPct, lead, leader: lead > 0 ? 'you' : lead < 0 ? 'rival' : 'tie' };
};

/** Build a fresh simulated rival from a persona (or custom keys/day). */
export const makeSimRival = (personaId: string, keysPerDay?: number): RivalState => {
  const p = getPersona(personaId);
  return {
    mode: 'sim',
    personaId: p.id,
    name: p.name,
    emoji: p.emoji,
    keysPerDay: keysPerDay ?? p.keysPerDay,
    seed: Math.floor(Math.random() * 1_000_000) + 1,
    startedAt: Date.now(),
  };
};

/** Build a friend rival from a decoded sync-code snapshot. */
export const makeFriendRival = (name: string, friendPct: number): RivalState => ({
  mode: 'friend',
  personaId: 'friend',
  name,
  emoji: '🪪',
  keysPerDay: 0,
  seed: 1,
  startedAt: Date.now(),
  friendPct: Math.min(100, Math.max(0, Math.round(friendPct))),
  friendName: name,
});
