/**
 * What Farm Keys' Slayer cards ask before they roll, in Vanilla and Chunked
 * (critique GP-10). Every finished Slayer task used to roll at its master's
 * rate whatever the run had unlocked, and the Boss Task card rolled 80% with
 * no Like a Boss and no boss, beside the bosses' finite Key stashes.
 *
 * - A master gives tasks once Slayer is unlocked, and the run meets what
 *   data/slayerMasterRequirements asks: the master's area (in Chunked, the
 *   master's own chunk), quests, and the Slayer level of every way in
 *   (Duradel: Slayer 50) within Slayer's tier cap. Combat level is not
 *   tracked, so a way in that needs only a combat level counts as met.
 * - A boss task needs Like a Boss, a master who gives boss tasks, and an
 *   unlocked boss that master can assign. The player says which boss the task
 *   was, and the roll draws from that boss's Key stash at its next-Key odds,
 *   exactly as a kill does: a boss task is no way around the stash.
 *
 * Other modes (no longer in the picker) keep the old open cards.
 */
import { DropSource, type UnlockState } from '../types';
import { SLAYER_MASTER_REQUIREMENTS } from '../data/slayerMasterRequirements';
import { BOSS_TASK_BOSSES, BOSS_TASK_SLAYER_LEVELS, BOSS_TASK_UNLOCK } from '../data/slayerBossTasks';
import { vanillaBossKeyStage } from '../config/vanillaKeyEconomy';
import { isAreaReachable } from './reachability';
import { chunkPlaceLabel, farmPlaceReachable, slayerMasterChunks } from './activityAccess';
import { tierForLevel } from './skillTiers';

type GateUnlocks = Pick<UnlockState, 'skills' | 'regions' | 'quests' | 'bosses' | 'slayerUnlocks'> & Partial<Pick<UnlockState, 'chunks'>>;

const gatedMode = (gameModeId: string | undefined): boolean => gameModeId === 'vanilla' || gameModeId === 'chunked';

/** The master whose rules each Farm Keys Slayer card follows: Aya, Steve and Kuradal take Turael's, Nieve's and Duradel's place. */
export const SLAYER_CARD_MASTER: Readonly<Record<string, string>> = {
  Turael: 'Turael', Aya: 'Turael', Spria: 'Spria', Mazchna: 'Mazchna', Vannaka: 'Vannaka', Chaeldar: 'Chaeldar',
  Konar: 'Konar quo Maten', Nieve: 'Nieve', Steve: 'Nieve', Krystilia: 'Krystilia', Duradel: 'Duradel', Kuradal: 'Duradel',
};

/** The masters each Slayer roll source stands for (the Roll Inbox asks by source). */
const SOURCE_MASTERS: Partial<Record<string, readonly string[]>> = {
  [DropSource.SLAYER_BEGINNER]: ['Turael', 'Spria'],
  [DropSource.SLAYER_MAZCHNA]: ['Mazchna'],
  [DropSource.SLAYER_VANNAKA]: ['Vannaka'],
  [DropSource.SLAYER_CHAELDAR]: ['Chaeldar'],
  [DropSource.SLAYER_KONAR]: ['Konar quo Maten'],
  [DropSource.SLAYER_NIEVE]: ['Nieve'],
  [DropSource.SLAYER_KRYSTILIA]: ['Krystilia'],
  [DropSource.SLAYER_DURADEL]: ['Duradel'],
};

export const SLAYER_LOCKED = 'Unlock Slayer first';
export const BOSS_TASK_NEEDS_UNLOCK = `Needs ${BOSS_TASK_UNLOCK} (a Slayer reward)`;
export const BOSS_TASK_NEEDS_MASTER = 'Needs Konar, Nieve, Duradel or Krystilia';
export const BOSS_TASK_NEEDS_BOSS = 'Unlock a boss a Slayer master can assign you';
export const BOSS_TASK_NEEDS_TIER = 'Your bosses need a higher Slayer tier';
export const BOSS_TASK_ALL_SPENT = 'Every boss you can be assigned has paid out its stash';
/** The Roll Inbox can't tell which boss a task was, so it sends the player to the card that asks. */
export const BOSS_TASK_ROLL_ON_CARD = 'Roll a boss task on the Boss Task card in Farm Keys: pick the boss, and it rolls from that boss’s Key stash.';

const slayerTier = (unlocks: GateUnlocks): number => Math.max(0, unlocks.skills?.Slayer ?? 0);
/** The highest Slayer level Slayer's tier opens (tier × 10, all of it at tier 10). */
const slayerTierCap = (unlocks: GateUnlocks): number => (slayerTier(unlocks) >= 10 ? 99 : slayerTier(unlocks) * 10);

/** The least Slayer level any way in asks (Duradel 50); 0 when one way needs none. */
export const slayerMasterFloor = (master: string): number => {
  const options = SLAYER_MASTER_REQUIREMENTS[master]?.oneOf ?? [];
  return options.length === 0 ? 0 : Math.min(...options.map(option => option.skills?.Slayer ?? 0));
};

/** Why a master gives no tasks yet, in one line, or null when the master is open. */
export const slayerMasterBlock = (master: string, unlocks: GateUnlocks, gameModeId: string | undefined): string | null => {
  if (!gatedMode(gameModeId)) return null;
  if (slayerTier(unlocks) < 1) return SLAYER_LOCKED;
  const requirements = SLAYER_MASTER_REQUIREMENTS[master];
  if (gameModeId === 'chunked') {
    const chunks = slayerMasterChunks(master);
    if (chunks.length > 0 && !farmPlaceReachable(chunks, unlocks as UnlockState, gameModeId)) {
      return `Needs ${chunks.map(chunkPlaceLabel).join(' or ')}`;
    }
  } else {
    const area = requirements?.areas?.find(name => !isAreaReachable(name, unlocks as UnlockState, gameModeId));
    if (area) return `Needs the ${area} area`;
  }
  const done = new Set(unlocks.quests ?? []);
  const quest = requirements?.quests?.find(name => !done.has(name));
  if (quest) return `Needs the ${quest} quest`;
  const floor = slayerMasterFloor(master);
  if (slayerTierCap(unlocks) < floor) return `Needs Slayer tier ${tierForLevel(floor)} (level ${floor})`;
  return null;
};

/** A Farm Keys Slayer card's block (the Boss Task card has its own, bossTaskChoices). */
export const slayerCardBlock = (card: string, unlocks: GateUnlocks, gameModeId: string | undefined): string | null =>
  SLAYER_CARD_MASTER[card] ? slayerMasterBlock(SLAYER_CARD_MASTER[card], unlocks, gameModeId) : null;

/** Why a Slayer roll source can't roll from the Roll Inbox, or null: open when any of its masters is. */
export const slayerSourceBlock = (source: string, unlocks: GateUnlocks, gameModeId: string | undefined): string | null => {
  if (!gatedMode(gameModeId)) return null;
  if (source === DropSource.SLAYER_BOSS) return BOSS_TASK_ROLL_ON_CARD;
  const masters = SOURCE_MASTERS[source];
  if (!masters) return null;
  const blocks = masters.map(master => slayerMasterBlock(master, unlocks, gameModeId));
  return blocks.includes(null) ? null : blocks[0];
};

export interface BossTaskChoices {
  /** The bosses the task can have been, each with Keys left in its stash, by name. */
  bosses: string[];
  /** Why the card can't roll, or null. */
  block: string | null;
}

/**
 * The Boss Task card's picker: the unlocked bosses an open master can assign
 * at the run's Slayer tier, with Keys left in their stash.
 */
export const bossTaskChoices = (
  unlocks: GateUnlocks,
  gameModeId: string | undefined,
  bossKeysAwarded: Readonly<Record<string, number>> | undefined,
): BossTaskChoices => {
  const none = (block: string): BossTaskChoices => ({ bosses: [], block });
  if (slayerTier(unlocks) < 1) return none(SLAYER_LOCKED);
  if (!(unlocks.slayerUnlocks ?? []).includes(BOSS_TASK_UNLOCK)) return none(BOSS_TASK_NEEDS_UNLOCK);
  const masters = Object.keys(BOSS_TASK_BOSSES).filter(master => slayerMasterBlock(master, unlocks, gameModeId) === null);
  if (masters.length === 0) return none(BOSS_TASK_NEEDS_MASTER);
  const assignable = new Set(masters.flatMap(master => BOSS_TASK_BOSSES[master]));
  const unlocked = (unlocks.bosses ?? []).filter(boss => assignable.has(boss));
  if (unlocked.length === 0) return none(BOSS_TASK_NEEDS_BOSS);
  const cap = slayerTierCap(unlocks);
  const inTier = unlocked.filter(boss => (BOSS_TASK_SLAYER_LEVELS[boss] ?? 0) <= cap);
  if (inTier.length === 0) return none(BOSS_TASK_NEEDS_TIER);
  const bosses = inTier
    .filter(boss => !vanillaBossKeyStage(boss, bossKeysAwarded?.[boss] ?? 0).capped)
    .sort((left, right) => left.localeCompare(right));
  return bosses.length === 0 ? none(BOSS_TASK_ALL_SPENT) : { bosses, block: null };
};
