import type { GameState, LogEntry } from '../types';
import { resolveModeRules } from '../config/gameModes';
import { RITUALS, type Ritual } from '../config/economy';
import { boostLabel } from './achievementBoosts';

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
  /** Chaos Keys paid. */
  chaosKeys: number;
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

/** Achievements with no set Fate pay a random 1 to 5, rolled on each run (Alex, 2026-10-15). */
export const SMALL_FATE_MIN = 1;
export const SMALL_FATE_MAX = 5;

/**
 * This run's 1 to 5 for an achievement with no set Fate. It comes from the
 * run's id, so each run has its own fixed amounts, known before they're earned,
 * and settling draws nothing from the gameplay dice.
 */
export const smallFate = (runId: string | undefined, achievementId: string): number => {
  let h = 0x811c9dc5;
  for (const ch of `${runId ?? ''}:${achievementId}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return SMALL_FATE_MIN + (h % (SMALL_FATE_MAX - SMALL_FATE_MIN + 1));
};

/** The Fate an achievement pays on this run. */
export const fateDue = (a: Pick<AchievementPayout, 'id' | 'fate'>, runId: string | undefined): number =>
  (a.fate > 0 ? a.fate : smallFate(runId, a.id));

/** "+10 Fate · +1% quest Key chance", or "+1 to 5 Fate" for one with no set Fate. */
export function rewardLabel(a: Pick<AchievementPayout, 'fate' | 'freeRituals' | 'chaosKeys'> & { id?: string }, gameModeId?: string): string | null {
  const parts: string[] = [];
  parts.push(a.fate > 0 ? `+${a.fate} Fate` : `+${SMALL_FATE_MIN} to ${SMALL_FATE_MAX} Fate`);
  const boost = a.id ? boostLabel(a.id, gameModeId) : null;
  if (boost) parts.push(boost);
  if (a.chaosKeys > 0) parts.push(a.chaosKeys === 1 ? 'a Chaos Key' : `${a.chaosKeys} Chaos Keys`);
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
  /** Chaos Keys this settlement adds. */
  chaosKeys: number;
  entries: LogEntry[];
}

/**
 * Pay each newly earned achievement once. `earned` is every achievement the
 * run has earned. A run from before achievement rewards (no
 * `achievementsClaimed`) records everything it has already earned and gets
 * one back pay for it: those free rituals, and their Fate up to the pity line. Fate fills up to the pity line at most, so the next missed
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
  const cap = achievementFateCap(state, maxCounter);
  const pool = freeRitualPool(state.gameModeId);
  const freeRituals = [...(state.freeRituals ?? [])];
  // Fate's pick for each free ritual; a pick outside the pool (a stale or forged payload) falls back to the first.
  const awardRituals = (a: AchievementPayout): string[] => {
    const awarded = Array.from({ length: Math.max(0, Math.min(a.freeRituals, maxCounter - freeRituals.length)) },
      (_, i) => { const pick = a.ritualPicks?.[i]; return pick && pool.includes(pick as Ritual['id']) ? pick : pool[0]; });
    freeRituals.push(...awarded);
    return awarded;
  };
  if (state.achievementsClaimed === undefined) {
    // Back pay, once: the free rituals those achievements give, and their Fate
    // up to the pity line at most, in one entry. No Chaos Keys, so a long run
    // isn't handed a pile of unlocks on release day (Alex, 2026-10-15).
    const seen = new Set<string>();
    const already = earned.filter((a) => !seen.has(a.id) && seen.add(a.id));
    const owed = already.reduce((n, a) => n + fateDue(a, state.runId), 0);
    const fatePoints = Math.max(state.fatePoints, Math.min(cap, state.fatePoints + owed));
    const ritualsAwarded = already.flatMap(awardRituals);
    const fateAwarded = fatePoints - state.fatePoints;
    const parts = [
      ...(fateAwarded > 0 ? [`+${fateAwarded} Fate${fateAwarded < owed ? ` (${owed} earned; Fate fills to ${cap} at most)` : ''}`] : []),
      ...ritualsAwarded.map((id) => `a free ${ritualName(id)}`),
    ];
    const entries: LogEntry[] = parts.length === 0 ? [] : [{
      id: newId(),
      timestamp: now,
      type: 'ACHIEVEMENT',
      message: 'Achievement back pay',
      details: `For the ${already.length} achievement${already.length === 1 ? '' : 's'} this run earned before rewards: ${parts.join(' · ')}.`,
      meta: { backPay: true, fateAwarded, ...(ritualsAwarded.length > 0 ? { ritualsAwarded } : {}), fatePointsAfter: fatePoints },
    }];
    return { achievementsClaimed: [...seen], fatePoints, freeRituals, chaosKeys: 0, entries };
  }
  const claimed = new Set(state.achievementsClaimed);
  const fresh = earned.filter((a) => {
    if (claimed.has(a.id)) return false;
    claimed.add(a.id);
    return true;
  });
  if (fresh.length === 0) return null;
  let fatePoints = state.fatePoints;
  let chaosKeys = 0;
  const entries = fresh.map((a): LogEntry => {
    const due = fateDue(a, state.runId);
    const fateAwarded = Math.max(0, Math.min(due, cap - fatePoints));
    fatePoints += fateAwarded;
    const ritualsAwarded = awardRituals(a);
    const fateText = `+${due} Fate${fateAwarded < due ? ` (Fate was full, so ${fateAwarded} was added)` : ''}`;
    const chaosKeysAwarded = Math.max(0, Math.min(a.chaosKeys, maxCounter - state.chaosKeys - chaosKeys));
    chaosKeys += chaosKeysAwarded;
    const chaosText = chaosKeysAwarded > 0 ? (chaosKeysAwarded === 1 ? 'a Chaos Key' : `${chaosKeysAwarded} Chaos Keys`) : null;
    const ritualText = ritualsAwarded.length > 0 ? `a free ${ritualsAwarded.map(ritualName).join(' and a free ')}` : null;
    const reward = [fateText, chaosText, ritualText, boostLabel(a.id, state.gameModeId)].filter(Boolean).join(' · ');
    return {
      id: newId(),
      timestamp: now,
      type: 'ACHIEVEMENT',
      message: `Achievement: ${a.title}`,
      details: reward
        ? `${a.description}. ${reward}, and a new title.`
        : `${a.description}. A new title.`,
      meta: { achievementId: a.id, fateAwarded, ...(chaosKeysAwarded > 0 ? { chaosKeysAwarded } : {}), ...(ritualsAwarded.length > 0 ? { ritualsAwarded } : {}), fatePointsAfter: fatePoints },
    };
  });
  return {
    achievementsClaimed: [...state.achievementsClaimed, ...fresh.map((a) => a.id)],
    fatePoints,
    freeRituals,
    chaosKeys,
    entries,
  };
};
