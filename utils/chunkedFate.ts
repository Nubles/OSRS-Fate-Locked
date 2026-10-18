/**
 * Chunked mode's fate-driven way out of a dead end (October 2026). Two rules,
 * both rolled by fate so the player never picks what opens:
 *
 * - Breakthrough: a skill at the cap of its tier, whose next tier the run's
 *   chunks can train, gets one roll per tier at BREAKTHROUGH_CHANCE to open
 *   that tier.
 * - Fate's Mercy: when the run holds no Keys of any kind, not enough Fate for
 *   a ritual that unlocks something (Chaos or the Cartographer), no skill it
 *   can train has room below its cap, no Breakthrough or exploring roll is
 *   waiting, and no quest in its chunks is doable, fate draws one random entry
 *   from the Chunks and Skills pools a Key would roll, plus any Farming patch
 *   type or guild that alone keeps a skill from training (mercyEnablers).
 *
 * The tier cap (October 2026 review, economy finding 3): as in Vanilla, a
 * tier caps the training methods, not the level, so a player may log levels
 * past it. In Chunked, a level past the cap rolls nothing (no Key, no Chaos
 * Key; see levelPastTierCap), so fate reads a skill's level as at most
 * its cap: a skill at or past its cap has no room, and gets its Breakthrough.
 *
 * The pools are the ones Keys use (randomUnlockPool), so Mercy can only open
 * a frontier chunk or a skill tier the run's chunks can train.
 */
import { TableType, type GameState } from '../types';
import { SKILLS_LIST } from '../data/items';
import { chunkedTrainableTier, chunkedSkillRollable } from './chunkedSkillPool';
import { randomUnlockPool, type RandomUnlockCandidate } from './gameEngine';
import { exploreWaiting } from './chunkExplore';
import { getChunkFrontier } from './chunkAdjacency';
import { getActivityAccess } from './activityAccess';
import { canonicalBossId } from './contentIdentity';
import type { CATask } from '../data/caTasks';
import { ritualFateCost } from '../config/economy';
import { resolveModeRules } from '../config/gameModes';

export type FateState = Pick<GameState, 'gameModeId' | 'unlocks' | 'keys' | 'specialKeys' | 'chaosKeys' | 'pendingUnlock' | 'chunkedBreakthroughs' | 'chunkExplore'>
  & Partial<Pick<GameState, 'fatePoints' | 'freeRituals' | 'customMode'>>;

/** The highest level a tier lets a skill reach. */
export const tierCap = (tier: number): number => (tier >= 10 ? 99 : tier * 10);

/**
 * Whether the run's chunks can train this skill now and it has levels left
 * below its cap. "Can train" is chunkedTrainableTier's: the content must be
 * usable (its opening quest done, its patch type or guild unlocked, its input
 * reachable), so a skill the run can't really train never holds Mercy shut.
 */
export const chunkedSkillHasRoom = (skill: string, unlocks: GameState['unlocks']): boolean => {
  const tier = unlocks.skills[skill] ?? 0;
  if (tier < 1) return false;
  const lowest = chunkedTrainableTier(skill, unlocks);
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

/**
 * Whether a level-up to `level` is past the skill's tier cap in Chunked, so it
 * rolls nothing: no Key, no Chaos Key. The level is still logged, as in
 * Vanilla, and still counts toward total level. Every other mode rolls every
 * level, so this is always false there.
 */
export const levelPastTierCap = (gameModeId: string | undefined, unlocks: Pick<GameState['unlocks'], 'skills'>, skill: string, level: number): boolean =>
  gameModeId === 'chunked' && level > tierCap(unlocks.skills[skill] ?? 0);

/**
 * The level whose odds a level-up to `level` rolls at. In Chunked a jump
 * across the tier cap (a RuneLite level detected several levels on) rolls as
 * the levels up to the cap would, at the capped level's odds, since the
 * levels past it roll nothing. Every other mode rolls at `level`.
 */
export const levelRolledAt = (gameModeId: string | undefined, unlocks: Pick<GameState['unlocks'], 'skills'>, skill: string, level: number): number =>
  gameModeId === 'chunked' ? Math.min(level, tierCap(unlocks.skills[skill] ?? 0)) : level;

/**
 * Chunked's exact-chunk rule for Combat Achievement tasks: a task fought at a
 * boss rolls only when that boss passes the Chunked activity check (its
 * entrance is in one of the run's chunks), as the Journal's doable count and
 * Key rolls for bosses already read it. The reason it can't, or null when it
 * may (every other mode, and tasks at a monster that is not a boss).
 */
export const chunkedCATaskBlocker = (
  task: Pick<CATask, 'monster'>,
  unlocks: GameState['unlocks'],
  gameModeId: string | undefined,
): string | null => {
  if (gameModeId !== 'chunked') return null;
  const boss = canonicalBossId(task.monster);
  if (!boss || getActivityAccess(boss, unlocks, 'chunked').eligible) return null;
  return `${boss} is not in your chunks. In Chunked, a Combat Achievement task only rolls where its boss is.`;
};

export type MercyBlocker = 'not_chunked' | 'keys' | 'pending_unlock' | 'fate' | 'skill_room' | 'breakthrough' | 'explore' | 'quest' | 'nothing_left';

/** Whether the run can level this skill now, or a Key could open a tier it can train. */
const skillCanMove = (skill: string, unlocks: GameState['unlocks']): boolean =>
  chunkedSkillHasRoom(skill, unlocks) || chunkedSkillRollable(skill, unlocks);

/**
 * The Farming patch types and guilds a Key could roll that are all that keeps
 * a skill below 99 from training: with the entry unlocked, a skill that could
 * neither level nor roll a tier could do one of them (Herblore needs a herb
 * patch; the Fishing, Woodcutting and Farming Guilds hold their skills' top
 * spots). Without these in Mercy's pool a run that owned every chunk but no
 * Herb patch had nothing to draw (chunked-audit sim, October 2026).
 */
export const mercyEnablers = (state: FateState): RandomUnlockCandidate[] => {
  const stuck = SKILLS_LIST.filter(skill => (state.unlocks.levels[skill] ?? 1) < 99 && !skillCanMove(skill, state.unlocks));
  if (stuck.length === 0) return [];
  const opens = (candidate: RandomUnlockCandidate): boolean => {
    const unlocks = candidate.table === TableType.FARMING_LAYERS
      ? { ...state.unlocks, farming: [...state.unlocks.farming, candidate.item] }
      : { ...state.unlocks, guilds: [...state.unlocks.guilds, candidate.item] };
    return stuck.some(skill => skillCanMove(skill, unlocks));
  };
  return [
    ...randomUnlockPool(state.unlocks, 'chunked', 'key', TableType.FARMING_LAYERS),
    ...randomUnlockPool(state.unlocks, 'chunked', 'key', TableType.GUILDS),
  ].filter(opens);
};

/**
 * What Fate's Mercy could draw: the Chunks and Skills entries a Key could
 * roll, and any patch type or guild that alone keeps a skill from training
 * (mercyEnablers).
 */
export const mercyPool = (state: FateState): RandomUnlockCandidate[] => [
  ...randomUnlockPool(state.unlocks, 'chunked', 'key', TableType.CHUNKS),
  ...randomUnlockPool(state.unlocks, 'chunked', 'key', TableType.SKILLS),
  ...mercyEnablers(state),
];

/** The rituals that unlock something without a Key: Chaos makes a Chaos Key, the Cartographer a chosen chunk. */
const MERCY_RITUALS = ['CHAOS', 'CARTOGRAPHER'] as const;

/**
 * A ritual the run can pay for now that would unlock something, or null when
 * its Fate is too low. The Cartographer only counts while the frontier has a
 * chunk to chart: with none, even a free one can do nothing, so it must not
 * hold Mercy shut (dead-end audit, October 2026).
 */
export const mercyRitualInReach = (state: FateState): { id: typeof MERCY_RITUALS[number]; cost: number; free: boolean } | null => {
  const multiplier = resolveModeRules(state.gameModeId, state.customMode).ritualCostMultiplier;
  for (const id of MERCY_RITUALS) {
    if (id === 'CARTOGRAPHER' && getChunkFrontier(state.unlocks.chunks ?? [], state.unlocks).length === 0) continue;
    if (state.freeRituals?.includes(id)) return { id, cost: 0, free: true };
    const cost = ritualFateCost(id, multiplier);
    if ((state.fatePoints ?? 0) >= cost) return { id, cost, free: false };
  }
  return null;
};

/** Skills the run can still level for Keys, in the Skills table's order. */
export const skillsWithRoom = (state: FateState): string[] =>
  SKILLS_LIST.filter(skill => chunkedSkillHasRoom(skill, state.unlocks));

/**
 * Why Fate's Mercy is not available, or null when it is. `doableQuests` are
 * the quests the run's chunks let it do now (chunkedQuestRows' DOABLE rows);
 * they need the chunk content, so the caller passes them in. Without them the
 * quest condition is not checked: the reducer refuses a call that brings none.
 */
export const mercyBlocker = (state: FateState, doableQuests?: readonly string[]): MercyBlocker | null => {
  if (state.gameModeId !== 'chunked') return 'not_chunked';
  if (state.keys > 0 || state.specialKeys > 0 || state.chaosKeys > 0) return 'keys';
  if (state.pendingUnlock) return 'pending_unlock';
  if (mercyRitualInReach(state)) return 'fate';
  if (skillsWithRoom(state).length > 0) return 'skill_room';
  if (pendingBreakthroughs(state).length > 0) return 'breakthrough';
  if (exploreWaiting(state)) return 'explore';
  if (doableQuests && doableQuests.length > 0) return 'quest';
  if (mercyPool(state).length === 0) return 'nothing_left';
  return null;
};
