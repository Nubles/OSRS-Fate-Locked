/**
 * Chunked mode's fate-driven way out of a dead end (October 2026). Two rules,
 * both rolled by fate so the player never picks what opens:
 *
 * - Breakthrough: a skill at the cap of its tier, whose next tier the run's
 *   chunks can train, gets one roll per tier at BREAKTHROUGH_CHANCE to open
 *   that tier.
 * - Fate's Mercy: when the run holds no Keys of any kind, no skill it can
 *   train has room below its cap, and no Breakthrough is waiting, fate draws
 *   one random entry from the Chunks and Skills pools a Key would roll.
 *
 * The pools are the ones Keys use (randomUnlockPool), so Mercy can only open
 * a frontier chunk or a skill tier the run's chunks can train.
 */
import { TableType, type GameState } from '../types';
import { SKILLS_LIST } from '../data/items';
import { chunkedTrainingTiers, chunkedSkillRollable } from './chunkedSkillPool';
import { randomUnlockPool, type RandomUnlockCandidate } from './gameEngine';

type FateState = Pick<GameState, 'gameModeId' | 'unlocks' | 'keys' | 'specialKeys' | 'chaosKeys' | 'pendingUnlock' | 'chunkedBreakthroughs'>;

/** The highest level a tier lets a skill reach. */
export const tierCap = (tier: number): number => (tier >= 10 ? 99 : tier * 10);

/** Whether the run's chunks can train this skill now and it has levels left below its cap. */
export const chunkedSkillHasRoom = (skill: string, unlocks: GameState['unlocks']): boolean => {
  const tier = unlocks.skills[skill] ?? 0;
  if (tier < 1) return false;
  const lowest = chunkedTrainingTiers(unlocks.chunks ?? []).get(skill);
  if (lowest === undefined || lowest > tier) return false;
  return (unlocks.levels[skill] ?? 1) < tierCap(tier);
};

/** The tier a Breakthrough would open for this skill, or null when none is waiting. */
export const breakthroughTier = (state: FateState, skill: string): number | null => {
  if (state.gameModeId !== 'chunked') return null;
  const tier = state.unlocks.skills[skill] ?? 0;
  if (tier < 1 || tier >= 10) return null;
  if ((state.unlocks.levels[skill] ?? 1) < tierCap(tier)) return null;
  if ((state.chunkedBreakthroughs?.[skill] ?? 0) > tier) return null;
  return chunkedSkillRollable(skill, state.unlocks) ? tier + 1 : null;
};

/** Skills with a Breakthrough roll waiting, in the Skills table's order. */
export const pendingBreakthroughs = (state: FateState): string[] =>
  SKILLS_LIST.filter(skill => breakthroughTier(state, skill) !== null);

export type MercyBlocker = 'not_chunked' | 'keys' | 'pending_unlock' | 'skill_room' | 'breakthrough' | 'nothing_left';

/** What Fate's Mercy could draw: the Chunks and Skills entries a Key could roll. */
export const mercyPool = (state: FateState): RandomUnlockCandidate[] => [
  ...randomUnlockPool(state.unlocks, 'chunked', 'key', TableType.CHUNKS),
  ...randomUnlockPool(state.unlocks, 'chunked', 'key', TableType.SKILLS),
];

/** Why Fate's Mercy is not available, or null when it is. */
export const mercyBlocker = (state: FateState): MercyBlocker | null => {
  if (state.gameModeId !== 'chunked') return 'not_chunked';
  if (state.keys > 0 || state.specialKeys > 0 || state.chaosKeys > 0) return 'keys';
  if (state.pendingUnlock) return 'pending_unlock';
  if (SKILLS_LIST.some(skill => chunkedSkillHasRoom(skill, state.unlocks))) return 'skill_room';
  if (pendingBreakthroughs(state).length > 0) return 'breakthrough';
  if (mercyPool(state).length === 0) return 'nothing_left';
  return null;
};
