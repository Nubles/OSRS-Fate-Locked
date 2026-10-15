import type { GameState, LogEntry } from '../types';
import { resolveModeRules } from '../config/gameModes';
import { RITUALS, type Ritual } from '../config/economy';

/**
 * Achievement rewards, kept apart from the achievement list so the game can
 * pay them without loading every achievement's check at startup. The list
 * (utils/achievements) is loaded on demand and hands over what is earned.
 */

/** What an earned achievement pays, as the settlement needs it. */
export interface AchievementPayout {
  id: string;
  title: string;
  description: string;
  fate: number;
  /** Free rituals paid, each one picked at random from the pool below. */
  freeRituals: number;
  /** Fate's picks for those rituals, drawn by the caller so the reducer stays pure. */
  ritualPicks?: readonly string[];
}

/**
 * The rituals a free one can be. Sacrifice and Transmutation are left out
 * (Alex, 2026-10-15), Zamorak's Pact is free already, and the Void Gambit
 * stakes your own Fate, so a free one has nothing to stake.
 */
export const FREE_RITUAL_IDS: readonly Ritual['id'][] = ['LUCK', 'GREED', 'CHAOS', 'CARTOGRAPHER', 'WARD', 'TEARS', 'INVOCATIONS', 'BARROWS'];

/** The free rituals this mode offers: the Cartographer only in Chunked. */
export const freeRitualPool = (gameModeId: string | undefined): Ritual['id'][] =>
  FREE_RITUAL_IDS.filter((id) => !RITUALS.find((r) => r.id === id)?.chunkedOnly || gameModeId === 'chunked');

/** Fate's pick from the pool for a draw in [0, 1). */
export const pickFreeRitual = (gameModeId: string | undefined, draw: number): Ritual['id'] => {
  const pool = freeRitualPool(gameModeId);
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(draw * pool.length)))];
};

export const ritualName = (id: string): string => RITUALS.find((r) => r.id === id)?.name ?? id;

/** "+10 Fate · a free random ritual", or null when the title is the whole reward. */
export function rewardLabel(a: Pick<AchievementPayout, 'fate' | 'freeRituals'>): string | null {
  const parts: string[] = [];
  if (a.fate > 0) parts.push(`+${a.fate} Fate`);
  if (a.freeRituals > 0) parts.push(a.freeRituals === 1 ? 'a free random ritual' : `${a.freeRituals} free random rituals`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** The most Fate an achievement can fill to: the mode's pity line, or no line with pity off. */
export const achievementFateCap = (state: Pick<GameState, 'gameModeId' | 'customMode'>, maxCounter: number): number => {
  const rules = resolveModeRules(state.gameModeId, state.customMode);
  return rules.pityEnabled ? Math.min(rules.pityThreshold, maxCounter) : maxCounter;
};

export interface AchievementSettlement {
  achievementsClaimed: string[];
  fatePoints: number;
  freeRituals: string[];
  entries: LogEntry[];
}

/**
 * Pay each newly earned achievement once. `earned` is every achievement the
 * run has earned. A run from before achievement rewards (no
 * `achievementsClaimed`) records everything it has already earned and is paid
 * nothing for it. Fate fills up to the pity line at most, so the next missed
 * roll brings the Pity Key as usual; each entry records the balance after it
 * for the integrity replay. Returns null when nothing is due.
 */
export const settleAchievements = (
  state: GameState,
  earned: readonly AchievementPayout[],
  now: number,
  newId: () => string,
  maxCounter: number,
): AchievementSettlement | null => {
  if (state.achievementsClaimed === undefined) {
    return { achievementsClaimed: [...new Set(earned.map((a) => a.id))], fatePoints: state.fatePoints, freeRituals: [...(state.freeRituals ?? [])], entries: [] };
  }
  const claimed = new Set(state.achievementsClaimed);
  const fresh = earned.filter((a) => {
    if (claimed.has(a.id)) return false;
    claimed.add(a.id);
    return true;
  });
  if (fresh.length === 0) return null;
  const cap = achievementFateCap(state, maxCounter);
  let fatePoints = state.fatePoints;
  const freeRituals = [...(state.freeRituals ?? [])];
  const pool = freeRitualPool(state.gameModeId);
  const entries = fresh.map((a): LogEntry => {
    const fateAwarded = Math.max(0, Math.min(a.fate, cap - fatePoints));
    fatePoints += fateAwarded;
    // A pick that isn't in the pool (a stale or forged payload) falls back to the first.
    const ritualsAwarded = Array.from({ length: Math.max(0, Math.min(a.freeRituals, maxCounter - freeRituals.length)) },
      (_, i) => { const pick = a.ritualPicks?.[i]; return pick && pool.includes(pick as Ritual['id']) ? pick : pool[0]; });
    freeRituals.push(...ritualsAwarded);
    const fateText = fateAwarded > 0 || a.fate > 0
      ? `+${a.fate} Fate${fateAwarded < a.fate ? ` (Fate was full, so ${fateAwarded} was added)` : ''}` : null;
    const ritualText = ritualsAwarded.length > 0 ? `a free ${ritualsAwarded.map(ritualName).join(' and a free ')}` : null;
    const reward = [fateText, ritualText].filter(Boolean).join(' · ');
    return {
      id: newId(),
      timestamp: now,
      type: 'ACHIEVEMENT',
      message: `Achievement: ${a.title}`,
      details: reward
        ? `${a.description}. ${reward}, and a new title.`
        : `${a.description}. A new title.`,
      meta: { achievementId: a.id, fateAwarded, ...(ritualsAwarded.length > 0 ? { ritualsAwarded } : {}), fatePointsAfter: fatePoints },
    };
  });
  return {
    achievementsClaimed: [...state.achievementsClaimed, ...fresh.map((a) => a.id)],
    fatePoints,
    freeRituals,
    entries,
  };
};
