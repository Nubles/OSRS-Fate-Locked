/**
 * Chunked mode's exploring rolls (Alex picked "Every chunk pays", 2026-10-17):
 * each chunk a run unlocks gives one Key roll for each new thing the player
 * does there for the first time, up to CHUNK_EXPLORE_ROLLS per chunk. The
 * things come from data/chunkSkillNodes.ts (generated): the skills the chunk
 * trains, something to fight, a Slayer master, a herb patch. A thing counts
 * once the run's tier and level in its skill reach its lowest node, and the
 * run can use it as the Skills rolls would (utils/chunkedSkillPool.ts): the
 * chunk's entry quest done, its guild unlocked, the skill's opening quest
 * done, and the skill trainable at all (a Weapon slot for Ranged, essence for
 * Runecraft, and so on). Fighting needs a combat style the run can use.
 *
 * Only chunks unlocked after a run first meets this rule count: the reducer
 * records `chunkExplore.from` (how many chunks the run held then) on the
 * run's next chunk unlock, so older chunks pay nothing back.
 */
import type { GameState, UnlockState } from '../types';
import { CHUNK_EXPLORE_ROLLS } from '../config/economy';
import {
  COMBAT_STYLE, chunkContentBlocker, chunkedCombatStyleUsable, chunkedSkillNeeds, chunkedSkillQuestOpen, chunkedTrainingLevels, chunkFacts, chunkPatches,
  runLevel, type TrainingRun,
} from './chunkedSkillPool';
import { SKILL_QUEST_GATES } from './journalStatus';
import { tierForLevel } from './skillTiers';
import { farmingPatchLabel } from './farmingPatches';

export interface ExploreThing {
  /** The fact id from data/chunkSkillNodes.ts: a skill name or @monster, @slayer, @herb. */
  fact: string;
  /** What the player did, as a button label: "Trained Mining". */
  label: string;
  /** The skill whose tier the thing needs. */
  skill: string;
  /** The tier that skill needs (1 to 10). */
  tier: number;
  /** The level that skill needs: the lowest node's exact level. */
  level: number;
  /** The chunk it is in. */
  chunk: string;
  /**
   * Farming things only: the chunk's patch types, each with the Farming tier
   * and level it needs. One of them must be among the run's Farming patch unlocks.
   */
  patches?: readonly (readonly [string, number, number])[];
}

const SPECIAL: Record<string, { label: string; skill: string }> = {
  '@monster': { label: 'Fought something', skill: 'Hitpoints' },
  '@slayer': { label: 'Got a Slayer task', skill: 'Slayer' },
  '@herb': { label: 'Used the herb patch', skill: 'Farming' },
};

/** Everything new a chunk offers to explore, in data order. */
export const exploreThings = (chunk: string): ExploreThing[] => {
  const things: ExploreThing[] = [];
  for (const [fact, level] of chunkFacts(chunk)) {
    const tier = tierForLevel(level);
    const special = SPECIAL[fact];
    // Fighting needs no tier beyond the Hitpoints every run starts with (and a combat style).
    const thing: ExploreThing = special
      ? { fact, label: special.label, skill: special.skill, tier: fact === '@monster' ? 1 : tier, level: fact === '@monster' ? 1 : level, chunk }
      : { fact, label: `Trained ${fact}`, skill: fact, tier, level, chunk };
    // A patch is only usable once its type is unlocked (the Farming table).
    if (fact === 'Farming' || fact === '@herb') {
      const patches = chunkPatches(chunk);
      const usable = fact === '@herb' ? patches.filter(([type]) => type === 'Herb') : patches;
      if (usable.length > 0) thing.patches = usable;
    }
    things.push(thing);
  }
  return things;
};

/** What of the run decides whether an exploring thing can be done. */
export type ExploreUnlocks = TrainingRun & Partial<Pick<UnlockState, 'chunks'>>;

/** Why the run can't do this thing yet, or null when it can. */
export const exploreThingBlocker = (thing: ExploreThing, unlocks: ExploreUnlocks): string | null => {
  if ((unlocks.skills[thing.skill] ?? 0) < thing.tier) return `Needs ${thing.skill} tier ${thing.tier}.`;
  const owned = unlocks.farming ?? [];
  const farmingTier = unlocks.skills.Farming ?? 0;
  const farmingLevel = runLevel(unlocks, 'Farming');
  if (thing.patches && !thing.patches.some(([type, tier, level]) => owned.includes(type) && farmingTier >= tier && farmingLevel >= level)) {
    const open = thing.patches.filter(([type]) => owned.includes(type));
    if (open.length === 0) return `Needs the ${thing.patches.map(([type]) => farmingPatchLabel(type)).join(' or ')} unlocked.`;
    const tier = Math.min(...open.map(([, need]) => need));
    if (farmingTier < tier) return `Needs Farming tier ${tier}.`;
    return `Needs Farming level ${Math.min(...open.map(([, , level]) => level))}.`;
  }
  const content = chunkContentBlocker(thing.chunk, thing.fact, unlocks);
  if (content) return content;
  if (runLevel(unlocks, thing.skill) < thing.level) return `Needs ${thing.skill} level ${thing.level}.`;
  if (thing.fact === '@monster') return chunkedCombatStyleUsable(unlocks) ? null : `Needs ${COMBAT_STYLE}.`;
  if (thing.fact.startsWith('@')) return null;
  if (!chunkedSkillQuestOpen(thing.fact, unlocks.quests)) return `Needs ${SKILL_QUEST_GATES[thing.fact]} done.`;
  const run = { ...unlocks, chunks: unlocks.chunks ?? [] };
  if (!chunkedTrainingLevels(run.chunks, run).has(thing.fact)) return `Needs ${chunkedSkillNeeds(thing.fact, run) ?? `something to train ${thing.fact} with`}.`;
  return null;
};

/** How many exploring rolls a chunk holds in all. */
export const exploreRollsFor = (chunk: string): number => Math.min(CHUNK_EXPLORE_ROLLS, exploreThings(chunk).length);

/** Whether the run lets the player do this thing yet. */
export const exploreThingReady = (thing: ExploreThing, unlocks: ExploreUnlocks): boolean => exploreThingBlocker(thing, unlocks) === null;

type ExploreRun = Pick<GameState, 'gameModeId' | 'unlocks' | 'chunkExplore'>;

/** The chunks that pay exploring rolls: those unlocked since the run met the rule. */
export const exploreEligibleChunks = (run: ExploreRun): string[] => {
  if (run.gameModeId !== 'chunked' || !run.chunkExplore) return [];
  return (run.unlocks.chunks ?? []).slice(run.chunkExplore.from);
};

/** The things already explored (rolled) in a chunk. */
export const exploredIn = (run: ExploreRun, chunk: string): readonly string[] => run.chunkExplore?.done[chunk] ?? [];

/** Rolls the chunk still holds (0 when it isn't eligible). */
export const exploreRollsLeft = (run: ExploreRun, chunk: string): number =>
  exploreEligibleChunks(run).includes(chunk)
    ? Math.max(0, exploreRollsFor(chunk) - exploredIn(run, chunk).length)
    : 0;

/** Why this thing can't be rolled now, or null when it can. */
export const exploreBlocker = (run: ExploreRun, chunk: string, fact: string): string | null => {
  if (exploreRollsLeft(run, chunk) === 0) return 'This chunk has no exploring rolls left.';
  const thing = exploreThings(chunk).find(candidate => candidate.fact === fact);
  if (!thing) return 'That isn’t something this chunk offers.';
  if (exploredIn(run, chunk).includes(fact)) return 'Already explored here.';
  return exploreThingBlocker(thing, run.unlocks);
};

/** Eligible chunks that still hold rolls, newest first. */
export const chunksToExplore = (run: ExploreRun): string[] =>
  exploreEligibleChunks(run).filter(chunk => exploreRollsLeft(run, chunk) > 0).reverse();

/**
 * The reducer's hook: the first time a Chunked run gains a chunk without an
 * exploring record, start one at the chunk count it had before, so only
 * chunks from now on pay. A new run starts with none, so all of its count.
 */
export const withExploreStart = <S extends ExploreRun>(prev: ExploreRun, next: S): S => {
  if (next.gameModeId !== 'chunked' || next.chunkExplore) return next;
  const before = prev.unlocks.chunks?.length ?? 0;
  if ((next.unlocks.chunks?.length ?? 0) <= before) return next;
  return { ...next, chunkExplore: { from: before, done: {} } };
};

/** Whether any eligible chunk has a roll left on a thing the run can do now. */
export const exploreWaiting = (run: ExploreRun): boolean =>
  chunksToExplore(run).some(chunk => exploreThings(chunk).some(thing => exploreBlocker(run, chunk, thing.fact) === null));
