import type { GameState } from '../types';
import { resolveModeRules, usesActivityKeyReserves } from '../config/gameModes';
import { getActiveRegionBonuses } from '../config/regionModifiers';
import {
  effectiveVanillaClueRate,
  isKnownVanillaMinigame,
  vanillaBossKeyStage,
  vanillaMinigameKeyStage,
  type KeyReserveStage,
  type KeyRollContext,
} from '../config/vanillaKeyEconomy';
import { achievementBoostFor } from './achievementBoosts';
import { levelPastTierCap } from './chunkedFate';
import { keyRollThresholds, normalizePercent, skillLevelKeyChance } from './keyRoll';
import { applyOddsBonus, rollRitualPlan, type RollRitualPlan } from './ritualEffects';

/**
 * The one place a Key roll's odds are worked out. prepareKeyRollAction
 * (context/GameContext.tsx) rolls against `threshold`, and every screen that
 * shows a Key chance (the classic and OSRS skill cards, the Farm Keys cards,
 * the Journal) reads it from here, so a display can't leave out a boost the
 * roll adds. utils/keyChance.test.ts pins the two together.
 */

/** What a roll's odds read from the run. useGame() and GameState both fit. */
export type KeyChanceState = Pick<
  GameState,
  | 'gameModeId' | 'customMode' | 'unlocks' | 'achievementsClaimed' | 'rituals' | 'fatePoints'
  | 'bossStandardKeysAwarded' | 'minigameStandardKeysAwarded' | 'clueStandardKeysAwarded'
>;

export interface KeyRollOdds {
  /** A boss, clue or minigame roll with its own rates: rolled to two decimals. */
  exact: boolean;
  bossContext: Extract<KeyRollContext, { kind: 'boss' }> | null;
  clueContext: Extract<KeyRollContext, { kind: 'clue' }> | null;
  minigameContext: Extract<KeyRollContext, { kind: 'minigame' }> | null;
  bossStage: KeyReserveStage | null;
  minigameStage: KeyReserveStage | null;
  /** Clue Keys awarded so far (Vanilla clue rolls only). */
  clueAwarded: number;
  /** The source's own rate, as the history records it. */
  baseThreshold: number;
  /** Region passives plus the activity's achievement boosts, in points. */
  successBonus: number;
  omniBonus: number;
  /** The run's rituals for this roll (Pact, a curse, Invocations, Barrows). */
  plan: RollRitualPlan;
  /** The chance before the rituals' odds change (what the dice resolve against first). */
  boostedThreshold: number;
  /** The chance the roll is made against, in %, with every boost and ritual. */
  threshold: number;
}

/**
 * The odds of a Key roll from `source` at `rate` (the base rate the caller
 * passes to rollForKey), or null when that roll would not happen: a boss or
 * minigame whose Key reserve has run out, or a minigame no longer on the table.
 */
export const keyRollOdds = (
  state: KeyChanceState,
  source: string,
  rate: number,
  context?: KeyRollContext,
): KeyRollOdds | null => {
  const reserves = usesActivityKeyReserves(state.gameModeId);
  const bossContext = reserves && context?.kind === 'boss' ? context : null;
  const clueContext = state.gameModeId === 'vanilla' && context?.kind === 'clue' ? context : null;
  const minigameContext = reserves && context?.kind === 'minigame' ? context : null;
  if (minigameContext && !isKnownVanillaMinigame(minigameContext.minigameName)) return null;
  const bossStage = bossContext
    ? vanillaBossKeyStage(bossContext.bossName, state.bossStandardKeysAwarded?.[bossContext.bossName] ?? 0)
    : null;
  const minigameStage = minigameContext
    ? vanillaMinigameKeyStage(minigameContext.minigameName, state.minigameStandardKeysAwarded?.[minigameContext.minigameName] ?? 0)
    : null;
  const reserveStage = bossStage ?? minigameStage;
  if (reserveStage?.capped) return null;

  const mode = resolveModeRules(state.gameModeId, state.customMode);
  let successBonus = 0;
  let omniBonus = 0;
  if (mode.regionModifiers) {
    const bonuses = getActiveRegionBonuses(state.unlocks.regions);
    successBonus = bonuses.successBonus;
    omniBonus = bonuses.omniBonus;
  }
  // Activity milestones the run has earned raise that activity's own rolls,
  // apart from minigame Key reserves, which keep their own pace.
  if (!minigameContext) successBonus += achievementBoostFor(source, state.achievementsClaimed);

  const clueAwarded = clueContext ? state.clueStandardKeysAwarded ?? 0 : 0;
  const exact = bossContext !== null || clueContext !== null || minigameContext !== null;
  let baseThreshold: number;
  let threshold: number;
  if (exact) {
    baseThreshold = reserveStage?.currentRate ?? effectiveVanillaClueRate(rate, clueAwarded);
    threshold = normalizePercent(Math.max(0, Math.min(100, baseThreshold + successBonus)));
  } else {
    ({ baseThreshold, effectiveThreshold: threshold } = keyRollThresholds(rate, successBonus));
  }
  const boostedThreshold = threshold;
  const plan = rollRitualPlan(state.rituals, state.fatePoints);
  if (plan.oddsBonus !== 0) threshold = normalizePercent(applyOddsBonus(threshold, plan.oddsBonus));

  return {
    exact, bossContext, clueContext, minigameContext, bossStage, minigameStage, clueAwarded,
    baseThreshold, successBonus, omniBonus, plan, boostedThreshold, threshold,
  };
};

/** The chance (in %) a Key roll is made against, or null when it would not roll. */
export const keyChance = (
  state: KeyChanceState,
  source: string,
  rate: number,
  context?: KeyRollContext,
): number | null => keyRollOdds(state, source, rate, context)?.threshold ?? null;

/** How far the run's boosts and rituals move a roll from its base rate, in points. */
export const keyChanceBonus = (
  state: KeyChanceState,
  source: string,
  rate: number,
  context?: KeyRollContext,
): number => {
  const odds = keyRollOdds(state, source, rate, context);
  // Rounded so summed boosts never print as 0.30000000000000004.
  return odds ? Math.round((odds.threshold - odds.baseThreshold) * 100) / 100 : 0;
};

/**
 * The Key chance of the skill's next level-up, as prepareLevelUpActions rolls
 * it, or null when the next level rolls nothing (level 99, or past a Chunked
 * tier cap).
 */
export const levelUpKeyChance = (state: KeyChanceState, skill: string): number | null => {
  const nextLevel = (state.unlocks.levels[skill] || 1) + 1;
  if (nextLevel > 99) return null;
  if (levelPastTierCap(state.gameModeId, state.unlocks, skill, nextLevel)) return null;
  return keyChance(state, `${skill} Level ${nextLevel}`, skillLevelKeyChance(nextLevel));
};
