/**
 * Chunked mode's exploring rolls (Alex picked "Every chunk pays", 2026-10-17):
 * each chunk a run unlocks gives one Key roll for each new thing the player
 * does there for the first time, up to CHUNK_EXPLORE_ROLLS per chunk. The
 * things come from data/chunkSkillNodes.ts (generated): the skills the chunk
 * trains, something to fight, a Slayer master, a herb patch. A thing counts
 * once the run's tier in its skill reaches the tier its lowest node needs.
 *
 * Only chunks unlocked after a run first meets this rule count: the reducer
 * records `chunkExplore.from` (how many chunks the run held then) on the
 * run's next chunk unlock, so older chunks pay nothing back.
 */
import type { GameState, UnlockState } from '../types';
import { CHUNK_EXPLORE_ROLLS } from '../config/economy';
import { CHUNK_SKILL_FACTS, CHUNK_SKILL_TIERS } from '../data/chunkSkillNodes';
import { chunkPatches } from './chunkedSkillPool';
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
  /**
   * Farming things only: the chunk's patch types, each with the Farming tier
   * it needs. One of them must be among the run's Farming patch unlocks.
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
  const row = CHUNK_SKILL_TIERS[chunk] ?? '';
  const things: ExploreThing[] = [];
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '.') continue;
    const fact = CHUNK_SKILL_FACTS[i];
    const tier = row[i] === '0' ? 10 : Number(row[i]);
    const special = SPECIAL[fact];
    // Fighting needs no tier beyond the Hitpoints every run starts with.
    const thing: ExploreThing = special
      ? { fact, label: special.label, skill: special.skill, tier: fact === '@monster' ? 1 : tier }
      : { fact, label: `Trained ${fact}`, skill: fact, tier };
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

/** A patch type the run has unlocked and its Farming tier reaches, if the thing needs one. */
const usablePatch = (thing: ExploreThing, unlocks: Pick<UnlockState, 'skills'> & Partial<Pick<UnlockState, 'farming'>>): boolean =>
  !thing.patches || thing.patches.some(([type, need]) => (unlocks.farming ?? []).includes(type) && (unlocks.skills.Farming ?? 0) >= need);

/** How many exploring rolls a chunk holds in all. */
export const exploreRollsFor = (chunk: string): number => Math.min(CHUNK_EXPLORE_ROLLS, exploreThings(chunk).length);

/** Whether the run's tiers let the player do this thing yet. */
export const exploreThingReady = (thing: ExploreThing, unlocks: Pick<UnlockState, 'skills'> & Partial<Pick<UnlockState, 'farming'>>): boolean =>
  (unlocks.skills[thing.skill] ?? 0) >= thing.tier && usablePatch(thing, unlocks);

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
  if ((run.unlocks.skills[thing.skill] ?? 0) < thing.tier) return `Needs ${thing.skill} tier ${thing.tier}.`;
  if (!exploreThingReady(thing, run.unlocks)) {
    const locked = thing.patches?.filter(([type]) => !(run.unlocks.farming ?? []).includes(type)) ?? [];
    return locked.length === thing.patches?.length
      ? `Needs the ${locked.map(([type]) => farmingPatchLabel(type)).join(' or ')} unlocked.`
      : `Needs Farming tier ${Math.min(...(thing.patches ?? []).filter(([type]) => (run.unlocks.farming ?? []).includes(type)).map(([, need]) => need))}.`;
  }
  return null;
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
