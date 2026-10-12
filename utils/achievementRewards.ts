import type { GameState, LogEntry } from '../types';
import { resolveModeRules } from '../config/gameModes';

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
  clarity: number;
}

/** "+10 Fate · a free Ritual of Clarity", or null when the title is the whole reward. */
export function rewardLabel(a: Pick<AchievementPayout, 'fate' | 'clarity'>): string | null {
  const parts: string[] = [];
  if (a.fate > 0) parts.push(`+${a.fate} Fate`);
  if (a.clarity > 0) parts.push(a.clarity === 1 ? 'a free Ritual of Clarity' : `${a.clarity} free Rituals of Clarity`);
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
  freeClarity: number;
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
    return { achievementsClaimed: [...new Set(earned.map((a) => a.id))], fatePoints: state.fatePoints, freeClarity: state.freeClarity ?? 0, entries: [] };
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
  let freeClarity = state.freeClarity ?? 0;
  const entries = fresh.map((a): LogEntry => {
    const fateAwarded = Math.max(0, Math.min(a.fate, cap - fatePoints));
    const clarityAwarded = Math.max(0, Math.min(a.clarity, maxCounter - freeClarity));
    fatePoints += fateAwarded;
    freeClarity += clarityAwarded;
    const reward = rewardLabel(a);
    return {
      id: newId(),
      timestamp: now,
      type: 'ACHIEVEMENT',
      message: `Achievement: ${a.title}`,
      details: reward
        ? `${a.description}. ${reward}${fateAwarded < a.fate ? ` (Fate was full, so ${fateAwarded} was added)` : ''}, and a new title.`
        : `${a.description}. A new title.`,
      meta: { achievementId: a.id, fateAwarded, clarityAwarded, fatePointsAfter: fatePoints },
    };
  });
  return {
    achievementsClaimed: [...state.achievementsClaimed, ...fresh.map((a) => a.id)],
    fatePoints,
    freeClarity,
    entries,
  };
};
