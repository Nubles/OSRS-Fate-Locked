/**
 * Chunked mode's Skills rolls: a Skills Key (or a Chaos Key landing on Skills)
 * only rolls a skill the run's chunks can train at the levels that tier opens.
 * Without this a Key could open Sailing for a player standing in Lumbridge
 * Castle, and early Chunked runs ran out of Keys (October 2026 simulation:
 * 200 of 200 runs stuck within 5 chunks).
 *
 * Facts come from data/chunkSkillNodes.ts (generated). Given the run's unlocks,
 * content counts only when the player can use it:
 * - a chunk whose entry needs a quest (Canifis, Priest in Peril) counts once
 *   that quest is done; a guild's fishing spots, patches or trees count once
 *   that guild is unlocked;
 * - Farming counts the patch types the run has unlocked, at each type's tier;
 *   Herblore needs a usable herb patch;
 * - skills trained by using something on a station need the input too:
 *   Firemaking and Fletching need logs (a tree the run's Woodcutting tier
 *   reaches); Smithing needs ore (a rock the Mining tier reaches, or an ore
 *   shop); Cooking at a range needs food (a fishing spot the Fishing tier
 *   reaches, or something to fight); Prayer needs bones (something to fight);
 *   Hitpoints only gains XP from combat, so it needs a combat style unlocked;
 * - a skill the game opens with a quest (SKILL_QUEST_GATES: Herblore with
 *   Druidic Ritual, Sailing with Pandemonium) has nothing to train until then.
 * Anything to fight also trains melee, Ranged, Magic and Hitpoints; a Slayer
 * master trains Slayer.
 */
import type { UnlockState } from '../types';
import {
  CHUNK_ENTRY_QUESTS, CHUNK_FARMING_PATCHES, CHUNK_GUILD_GATES, CHUNK_ORE_SHOPS, CHUNK_PATCH_TYPES, CHUNK_SKILL_FACTS, CHUNK_SKILL_TIERS,
} from '../data/chunkSkillNodes';
import { CHUNKED_START_KEY } from './chunkAdjacency';
import { SKILL_QUEST_GATES } from './journalStatus';

const COMBAT_SKILLS = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer'];
const COMBAT_STYLES = ['Attack', 'Strength', 'Defence', 'Ranged', 'Magic'];

/** What of the run decides whether chunk content is usable. */
export type TrainingRun = Pick<UnlockState, 'skills'> & Partial<Pick<UnlockState, 'farming' | 'quests' | 'guilds'>>;

const ENTRY_QUEST_OF = new Map<string, string[]>();
for (const [quest, columns] of Object.entries(CHUNK_ENTRY_QUESTS)) {
  for (const column of columns.split(';')) {
    const [cx, runs] = column.split(':');
    for (const run of runs.split(',')) {
      const [from, to = from] = run.split('-').map(Number);
      for (let cy = from; cy <= to; cy++) ENTRY_QUEST_OF.set(`${cx},${cy}`, [...(ENTRY_QUEST_OF.get(`${cx},${cy}`) ?? []), quest]);
    }
  }
}

/** A chunk's Farming patch types, each with the tier it needs. */
export const chunkPatches = (chunk: string): [string, number][] =>
  (CHUNK_FARMING_PATCHES[chunk]?.match(/../g) ?? []).map((pair): [string, number] => [CHUNK_PATCH_TYPES[pair.charCodeAt(0) - 97], pair[1] === '0' ? 10 : Number(pair[1])]);
const ORE_SHOPS = new Set(CHUNK_ORE_SHOPS);

let cachedSignature: string | null = null;
let cachedTiers = new Map<string, number>();

const signatureOf = (chunks: readonly string[], run?: TrainingRun): string => chunks.join(';') + (run ? `|${JSON.stringify([
  run.skills.Woodcutting ?? 0, run.skills.Mining ?? 0, run.skills.Fishing ?? 0, run.skills.Farming ?? 0,
  run.farming ?? [], run.quests ?? [], run.guilds ?? [], COMBAT_STYLES.some(skill => (run.skills[skill] ?? 0) >= 1),
])}` : '');

/**
 * The lowest tier each skill can be trained at across the start chunk and the
 * run's chunks. Without `run` it reads the content alone: every patch, guild
 * and quest-gated chunk counts, and station skills only need their input to
 * be somewhere in the chunks. With `run` (what the roll engine passes) it
 * counts only what the run can use, as the module comment lists.
 */
export const chunkedTrainingTiers = (chunks: readonly string[], run?: TrainingRun): ReadonlyMap<string, number> => {
  const signature = signatureOf(chunks, run);
  if (signature === cachedSignature) return cachedTiers;
  const quests = new Set(run?.quests ?? []);
  const guilds = new Set(run?.guilds ?? []);
  const farming = new Set(run?.farming ?? []);
  const raw = new Map<string, number>();
  const note = (skill: string, tier: number) => raw.set(skill, Math.min(raw.get(skill) ?? tier, tier));
  let oreShop = false;
  for (const key of [CHUNKED_START_KEY, ...chunks]) {
    if (run && (ENTRY_QUEST_OF.get(key) ?? []).some(quest => !quests.has(quest))) continue;
    const gate = CHUNK_GUILD_GATES[key];
    const gated = run && gate && !guilds.has(gate[1]) ? gate[0] : null;
    const row = CHUNK_SKILL_TIERS[key] ?? '';
    for (let i = 0; i < row.length; i++) {
      const fact = CHUNK_SKILL_FACTS[i];
      if (row[i] === '.' || fact === gated || (gated === 'Farming' && fact === '@herb')) continue;
      // With a run, Farming comes from the unlocked patch types below.
      if (run && (fact === 'Farming' || fact === '@herb')) continue;
      note(fact, row[i] === '0' ? 10 : Number(row[i]));
    }
    if (run && gated !== 'Farming') {
      for (const [type, tier] of chunkPatches(key)) {
        if (!farming.has(type)) continue;
        note('Farming', tier);
        if (type === 'Herb') note('@herb', tier);
      }
    }
    if (ORE_SHOPS.has(key)) oreShop = true;
  }
  // Without a run, an input only has to exist; with one, its skill must reach it.
  const usable = (skill: string) => raw.has(skill) && (!run || (run.skills[skill] ?? 0) >= raw.get(skill)!);
  const levels = new Map(raw);
  if (!usable('Woodcutting')) { levels.delete('Firemaking'); levels.delete('Fletching'); } else { levels.set('Firemaking', 1); levels.set('Fletching', 1); }
  if (!usable('Mining') && !oreShop) levels.delete('Smithing');
  if (!usable('Fishing') && !raw.has('@monster')) levels.delete('Cooking');
  if (!raw.has('@monster')) levels.delete('Prayer');
  const noteLevel = (skill: string, tier: number) => levels.set(skill, Math.min(levels.get(skill) ?? tier, tier));
  if (raw.has('@monster')) COMBAT_SKILLS.forEach(skill => noteLevel(skill, 1));
  // Hitpoints XP only comes with combat XP, so with a run it needs a combat style to train.
  if (run && !COMBAT_STYLES.some(skill => (run.skills[skill] ?? 0) >= 1)) levels.delete('Hitpoints');
  if (raw.has('@slayer')) noteLevel('Slayer', 1);
  // A herb patch trains Herblore once the run can grow herbs in it.
  if (raw.has('@herb') && (!run || (run.skills.Farming ?? 0) >= raw.get('@herb')!)) noteLevel('Herblore', 1);
  for (const fact of ['@monster', '@slayer', '@herb']) levels.delete(fact);
  cachedSignature = signature;
  cachedTiers = levels;
  return levels;
};

/** Whether the quest that opens this skill (SKILL_QUEST_GATES) is done, or it needs none. */
export const chunkedSkillQuestOpen = (skill: string, quests: readonly string[] | undefined): boolean =>
  !Object.hasOwn(SKILL_QUEST_GATES, skill) || (quests ?? []).includes(SKILL_QUEST_GATES[skill]);

/**
 * The lowest tier the run can train this skill at in its chunks, or undefined
 * when it has nothing to train (including a skill whose opening quest isn't done).
 */
export const chunkedTrainableTier = (skill: string, unlocks: TrainingRun & Pick<UnlockState, 'chunks'>): number | undefined =>
  chunkedSkillQuestOpen(skill, unlocks.quests) ? chunkedTrainingTiers(unlocks.chunks ?? [], unlocks).get(skill) : undefined;

/** Whether the skill's next tier opens a level the run's chunks can train it at. */
export const chunkedSkillRollable = (skill: string, unlocks: TrainingRun & Pick<UnlockState, 'chunks'>): boolean => {
  const lowest = chunkedTrainableTier(skill, unlocks);
  return lowest !== undefined && lowest <= (unlocks.skills[skill] ?? 0) + 1;
};
