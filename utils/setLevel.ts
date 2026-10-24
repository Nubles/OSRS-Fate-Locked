import type { GameState, LogEntry } from '../types';

/**
 * "Set level": the player types the level a skill reached and every level in
 * between is logged in order, each rolling exactly as one click on the skill
 * would (GameContext.setSkillLevel runs the same level-up step N times). Fate
 * still rolls every level; this only saves the clicks and the N popups. The
 * pure parts live here: what a typed level means, and the one summary shown
 * instead of a popup per level.
 */

export const MAX_SKILL_LEVEL = 99;

/**
 * How many levels typing `target` as a skill's new level logs, or 0 when it
 * logs none. A single click levels only a skill with a tier unlocked and
 * below 99, so the same rules hold here, and a level can never go down.
 * utils/setLevelText.ts planSetLevel says why a level logs none.
 */
export const levelsToLog = (currentLevel: number, tier: number, target: number): number => {
  const from = Math.max(1, Math.trunc(currentLevel) || 1);
  if (tier < 1 || !Number.isInteger(target) || target > MAX_SKILL_LEVEL || target <= from) return 0;
  return target - from;
};

type Counters = Pick<GameState, 'keys' | 'specialKeys' | 'chaosKeys' | 'history' | 'unlocks'>;

export interface LevelBatchSummary {
  skill: string;
  from: number;
  to: number;
  levels: number;
  keys: number;
  omniKeys: number;
  chaosKeys: number;
  fate: number;
  /** Chunked: levels past the tier cap, logged with no roll. */
  noRoll: number;
}

/** What a run of level-ups changed, read from the run before and after it. */
export const summarizeLevelBatch = (before: Counters, after: Counters, skill: string): LevelBatchSummary => {
  const from = before.unlocks.levels[skill] || 1;
  const to = after.unlocks.levels[skill] || 1;
  const added: LogEntry[] = after.history.slice(before.history.length);
  return {
    skill,
    from,
    to,
    levels: to - from,
    keys: after.keys - before.keys,
    omniKeys: after.specialKeys - before.specialKeys,
    chaosKeys: after.chaosKeys - before.chaosKeys,
    // The Fate each miss earned. A Key found resets the Fate bar, so the
    // difference in Fate Points would undercount (or go negative).
    fate: added.reduce((sum, entry) => sum + (typeof entry.meta?.fatePointsEarned === 'number' ? entry.meta.fatePointsEarned : 0), 0),
    noRoll: added.filter(entry => typeof entry.meta?.pastTierCap === 'number').length,
  };
};
