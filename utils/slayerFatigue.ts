/**
 * Slayer fatigue (Vanilla only; Alex picked the gentle version, 2026-10-16).
 *
 * Slayer is Vanilla's one unlimited Key farm, and Wilderness tasks with Turael
 * skipping out-earned everything else. Each Slayer Key now tires Slayer: every
 * master's chance drops by 10%, down to half its rate at most. Rolling for
 * anything else rests it again: a level-up restores 2%, any other roll 5%. A
 * player who mixes in other content keeps the full rates; one who only slays
 * settles near Duradel's pace. Fate still decides every roll.
 */
import { DropSource } from '../types';
import { boostActivityOf } from './achievementBoosts';

/** Points a Slayer Key takes off every Slayer roll. */
export const SLAYER_FATIGUE_PER_KEY = 10;
/** Most fatigue a run can hold: half the best Slayer rate (Boss Task, 80%). */
export const SLAYER_FATIGUE_MAX = 40;
/** Points a level-up roll restores. */
export const SLAYER_FATIGUE_LEVEL_REST = 2;
/** Points any other roll restores. */
export const SLAYER_FATIGUE_OTHER_REST = 5;
/**
 * Rolls under this chance restore nothing, apart from level-ups (each level
 * rolls once): the shortest minigames roll at 1% every half minute.
 */
export const SLAYER_FATIGUE_REST_MIN_CHANCE = 5;

const SLAYER_SOURCES = new Set<string>([
  DropSource.SLAYER_BEGINNER, DropSource.SLAYER_MAZCHNA, DropSource.SLAYER_VANNAKA,
  DropSource.SLAYER_CHAELDAR, DropSource.SLAYER_KONAR, DropSource.SLAYER_NIEVE,
  DropSource.SLAYER_KRYSTILIA, DropSource.SLAYER_DURADEL, DropSource.SLAYER_BOSS,
]);

export const isSlayerSource = (source: string): boolean => SLAYER_SOURCES.has(source);

export const slayerFatigueApplies = (gameModeId: string | undefined): boolean => gameModeId === 'vanilla';

const clampFatigue = (fatigue: number | undefined): number =>
  Number.isFinite(fatigue) ? Math.min(SLAYER_FATIGUE_MAX, Math.max(0, Math.round(fatigue as number))) : 0;

/** Percentage points fatigue takes off this roll: never more than half the master's own rate. */
export const slayerFatigueCut = (
  source: string,
  baseRate: number,
  fatigue: number | undefined,
  gameModeId: string | undefined,
): number => (slayerFatigueApplies(gameModeId) && isSlayerSource(source)
  ? Math.min(clampFatigue(fatigue), Math.max(0, baseRate) / 2)
  : 0);

/** The run's fatigue after a roll: a Slayer Key adds to it, other rolls rest it. */
export const nextSlayerFatigue = (
  fatigue: number | undefined,
  roll: { source: string; success: boolean; baseChance: number },
  gameModeId: string | undefined,
): number => {
  const current = clampFatigue(fatigue);
  if (!slayerFatigueApplies(gameModeId)) return 0;
  if (isSlayerSource(roll.source)) return roll.success ? clampFatigue(current + SLAYER_FATIGUE_PER_KEY) : current;
  if (boostActivityOf(roll.source) === 'skills') return clampFatigue(current - SLAYER_FATIGUE_LEVEL_REST);
  return roll.baseChance >= SLAYER_FATIGUE_REST_MIN_CHANCE ? clampFatigue(current - SLAYER_FATIGUE_OTHER_REST) : current;
};
