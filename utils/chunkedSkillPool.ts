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
 *
 * The deadlock audit (18 October 2026) found skills counted as trainable that
 * a real player can't train, which held Fate's Mercy shut for good. With a
 * run, these count too:
 * - levels, not just tiers: content counts once the player's level reaches
 *   it (Draynor rooftop needs Agility 10, the Water altar Runecraft 5), from
 *   the exact levels in CHUNK_SKILL_LEVELS;
 * - Ranged needs the Weapon slot at tier 1 to hold a bow or darts, and only
 *   then counts as a combat style; fighting (and so Hitpoints, Prayer's
 *   bones, Slayer tasks and Cooking's meat) needs a combat style;
 * - Runecraft needs essence: Rune Mysteries done, Mining unlocked and an
 *   essence mine teleport (Aubury, Cromperty, Sedridor, Brimstail) owned;
 * - Construction needs a house from an estate agent and planks (a sawmill
 *   and logs, or a plank shop), each of an unlocked merchant type;
 * - Hunter needs traps from a Hunter shop of an unlocked merchant type;
 * - an ore shop is Smithing's input only with its merchant type unlocked.
 * Magic needs no runes here: they come from drops and the tutorial too.
 */
import type { UnlockState } from '../types';
import {
  CHUNK_ENTRY_QUESTS, CHUNK_FARMING_PATCHES, CHUNK_GUILD_GATES, CHUNK_ORE_SHOPS, CHUNK_PATCH_TYPES, CHUNK_SKILL_FACTS,
  CHUNK_SKILL_LEVELS, CHUNK_SKILL_SERVICES, CHUNK_SKILL_TIERS,
} from '../data/chunkSkillNodes';
import { CHUNKED_START_KEY } from './chunkAdjacency';
import { SKILL_QUEST_GATES } from './journalStatus';
import { tierBand, tierForLevel } from './skillTiers';

const COMBAT_SKILLS = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer'];
const MELEE_AND_MAGIC = ['Attack', 'Strength', 'Defence', 'Magic'];
/** Skills whose content is another skill's input (logs, ore, fish, herbs). */
const INPUT_SKILLS = ['Woodcutting', 'Mining', 'Fishing', 'Farming'];

/** What of the run decides whether chunk content is usable. */
export type TrainingRun = Pick<UnlockState, 'skills'>
  & Partial<Pick<UnlockState, 'levels' | 'equipment' | 'farming' | 'quests' | 'guilds' | 'merchants'>>;

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

/** The quests a chunk's entry needs (Canifis: Priest in Peril). */
export const chunkEntryQuests = (chunk: string): readonly string[] => ENTRY_QUEST_OF.get(chunk) ?? [];

/** The guild a chunk's content for this fact sits inside, or null (the Farming Guild holds its herb patch too). */
export const chunkGuildFor = (chunk: string, fact: string): string | null => {
  const gate = CHUNK_GUILD_GATES[chunk];
  return gate && (fact === gate[0] || (gate[0] === 'Farming' && fact === '@herb')) ? gate[1] : null;
};

/** A chunk's Farming patch types, each with the tier and the Farming level it needs. */
export const chunkPatches = (chunk: string): [string, number, number][] =>
  [...(CHUNK_FARMING_PATCHES[chunk] ?? '').matchAll(/([a-z])(\d+)/g)]
    .map(([, letter, level]): [string, number, number] => [CHUNK_PATCH_TYPES[letter.charCodeAt(0) - 97], tierForLevel(Number(level)), Number(level)]);

const EXACT_LEVELS = new Map<string, Map<string, number>>(Object.entries(CHUNK_SKILL_LEVELS).map(([chunk, row]) => [chunk,
  new Map([...row.matchAll(/([a-z])(\d+)/g)].map(([, letter, level]) => [CHUNK_SKILL_FACTS[letter.charCodeAt(0) - 97], Number(level)]))]));

/** The lowest level a chunk's fact needs (its exact level, else its tier's floor), or undefined when it has none. */
export const chunkFactLevel = (chunk: string, fact: string): number | undefined => {
  const cell = CHUNK_SKILL_TIERS[chunk]?.[CHUNK_SKILL_FACTS.indexOf(fact)];
  if (cell === undefined || cell === '.') return undefined;
  return EXACT_LEVELS.get(chunk)?.get(fact) ?? tierBand(cell === '0' ? 10 : Number(cell)).min;
};

/** The run's current level in a skill (a fresh run has Hitpoints 10, the rest 1). */
export const runLevel = (run: TrainingRun, skill: string): number =>
  run.levels?.[skill] ?? (skill === 'Hitpoints' ? 10 : 1);

/** Ranged needs the Weapon slot open (tier 1 or higher) to hold a bow, darts or knives. */
const rangedWeapon = (run: TrainingRun): boolean => (run.equipment?.Weapon ?? 0) >= 1;

/**
 * Whether the run can fight: melee or Magic at tier 1 or higher, or Ranged
 * with a Weapon slot to hold a bow. Every kill gives combat XP, so a run with
 * none of these can't fight at all.
 */
export const chunkedCombatStyleUsable = (run: TrainingRun): boolean =>
  MELEE_AND_MAGIC.some(skill => (run.skills[skill] ?? 0) >= 1) || ((run.skills.Ranged ?? 0) >= 1 && rangedWeapon(run));

/** Why the run can't use a chunk's content for this fact (its entry quest, its guild), or null when it can. */
export const chunkContentBlocker = (chunk: string, fact: string, run: Partial<Pick<UnlockState, 'quests' | 'guilds'>>): string | null => {
  const quests = chunkEntryQuests(chunk).filter(quest => !(run.quests ?? []).includes(quest));
  if (quests.length > 0) return `Needs ${quests.join(' and ')} to get in.`;
  const guild = chunkGuildFor(chunk, fact);
  if (guild && !(run.guilds ?? []).includes(guild)) return `Needs the ${guild} unlocked.`;
  return null;
};

interface Training {
  /** Each trainable skill's lowest level the run can use. */
  levels: ReadonlyMap<string, number>;
  /** Skills with content the run can't use yet, and what they need. */
  missing: ReadonlyMap<string, string>;
}

let cachedSignature: string | null = null;
let cachedTraining: Training = { levels: new Map(), missing: new Map() };
let cachedTiers = new Map<string, number>();

const signatureOf = (chunks: readonly string[], run?: TrainingRun): string => chunks.join(';') + (run ? `|${JSON.stringify([
  INPUT_SKILLS.map(skill => [run.skills[skill] ?? 0, runLevel(run, skill)]),
  run.farming ?? [], run.quests ?? [], run.guilds ?? [], run.merchants ?? [], chunkedCombatStyleUsable(run), rangedWeapon(run),
])}` : '');

const training = (chunks: readonly string[], run?: TrainingRun): Training => {
  const signature = signatureOf(chunks, run);
  if (signature === cachedSignature) return cachedTraining;
  const quests = new Set(run?.quests ?? []);
  const guilds = new Set(run?.guilds ?? []);
  const farming = new Set(run?.farming ?? []);
  const merchants = new Set(run?.merchants ?? []);
  const raw = new Map<string, number>();
  const note = (skill: string, level: number) => raw.set(skill, Math.min(raw.get(skill) ?? level, level));
  let oreShopLevel: number | undefined;
  const services = new Set<string>();
  for (const key of [CHUNKED_START_KEY, ...chunks]) {
    if (run && chunkEntryQuests(key).some(quest => !quests.has(quest))) continue;
    const gate = CHUNK_GUILD_GATES[key];
    const gated = run && gate && !guilds.has(gate[1]) ? gate[0] : null;
    const row = CHUNK_SKILL_TIERS[key] ?? '';
    for (let i = 0; i < row.length; i++) {
      const fact = CHUNK_SKILL_FACTS[i];
      if (row[i] === '.' || fact === gated || (gated === 'Farming' && fact === '@herb')) continue;
      // With a run, Farming comes from the unlocked patch types below.
      if (run && (fact === 'Farming' || fact === '@herb')) continue;
      note(fact, chunkFactLevel(key, fact)!);
    }
    if (run && gated !== 'Farming') {
      for (const [type, , level] of chunkPatches(key)) {
        if (!farming.has(type)) continue;
        note('Farming', level);
        if (type === 'Herb') note('@herb', level);
      }
    }
    for (const [merchant, level] of Object.entries(CHUNK_ORE_SHOPS[key] ?? {})) {
      if (!run || merchants.has(merchant)) oreShopLevel = Math.min(oreShopLevel ?? level, level);
    }
    // A guild's sawmill (the Woodcutting Guild's) needs the guild.
    if (gated) continue;
    for (const [service, chunksOffering] of Object.entries(CHUNK_SKILL_SERVICES)) {
      const merchant = chunksOffering[key];
      if (merchant !== undefined && (!run || merchant === '' || merchants.has(merchant))) services.add(service);
    }
  }
  // Without a run, an input only has to exist; with one, its skill's tier and level must reach it.
  const usable = (skill: string) => raw.has(skill)
    && (!run || ((run.skills[skill] ?? 0) >= tierForLevel(raw.get(skill)!) && runLevel(run, skill) >= raw.get(skill)!));
  const levels = new Map(raw);
  const missing = new Map<string, string>();
  const drop = (skill: string, needs: string) => { levels.delete(skill); missing.set(skill, needs); };
  const noteLevel = (skill: string, level: number) => levels.set(skill, Math.min(levels.get(skill) ?? level, level));
  // Logs: Firemaking and Fletching start at the lowest log the run can cut (normal logs 1, oak 15, willow 30).
  if (usable('Woodcutting')) { levels.set('Firemaking', raw.get('Woodcutting')!); levels.set('Fletching', raw.get('Woodcutting')!); }
  else { drop('Firemaking', 'logs from a tree your Woodcutting can cut'); drop('Fletching', 'logs from a tree your Woodcutting can cut'); }
  if (levels.has('Smithing')) {
    const input = usable('Mining') ? 1 : oreShopLevel;
    if (input === undefined) drop('Smithing', 'ore from a rock your Mining can mine, or an ore shop you have unlocked');
    else levels.set('Smithing', Math.max(levels.get('Smithing')!, input));
  }
  const fight = raw.has('@monster') && (!run || chunkedCombatStyleUsable(run));
  if (!usable('Fishing') && !fight && levels.has('Cooking')) drop('Cooking', 'food: fish your Fishing can catch, or something you can fight');
  if (raw.has('@monster')) COMBAT_SKILLS.forEach(skill => noteLevel(skill, 1));
  const combatStyle = 'a combat style: Attack, Strength, Defence or Magic, or Ranged with a Weapon slot';
  if (run && !rangedWeapon(run) && levels.has('Ranged')) drop('Ranged', 'the Weapon slot at tier 1, to hold a bow or darts');
  // Hitpoints XP only comes with combat XP, and bones come from kills.
  if (run && !chunkedCombatStyleUsable(run)) {
    if (levels.has('Hitpoints')) drop('Hitpoints', combatStyle);
    if (levels.has('Prayer')) drop('Prayer', `bones, which need ${combatStyle}`);
  }
  if (!raw.has('@monster')) levels.delete('Prayer');
  if (raw.has('@slayer')) {
    if (!run || chunkedCombatStyleUsable(run)) noteLevel('Slayer', 1);
    else drop('Slayer', combatStyle);
  }
  if (run && levels.has('Runecraft') && !(quests.has('Rune Mysteries') && (run.skills.Mining ?? 0) >= 1 && services.has('essence'))) {
    drop('Runecraft', 'rune essence: Rune Mysteries done, Mining unlocked, and Aubury, Wizard Cromperty, Archmage Sedridor or Brimstail in your chunks');
  }
  if (run && levels.has('Construction')
    && !(services.has('estateAgent') && (services.has('planks') || (services.has('sawmill') && usable('Woodcutting'))))) {
    drop('Construction', 'a house from an estate agent and planks from a sawmill (with logs) or a plank shop, in your chunks with their merchants unlocked');
  }
  if (run && levels.has('Hunter') && !services.has('traps')) drop('Hunter', 'traps from a Hunter shop in your chunks, with Hunter Shops unlocked');
  // A herb patch trains Herblore once the run can grow herbs in it.
  const herb = raw.get('@herb');
  if (herb !== undefined && (!run || ((run.skills.Farming ?? 0) >= tierForLevel(herb) && runLevel(run, 'Farming') >= herb))) noteLevel('Herblore', 1);
  for (const fact of ['@monster', '@slayer', '@herb']) levels.delete(fact);
  cachedSignature = signature;
  cachedTraining = { levels, missing };
  cachedTiers = new Map([...levels].map(([skill, level]) => [skill, tierForLevel(level)]));
  return cachedTraining;
};

/**
 * The lowest tier each skill can be trained at across the start chunk and the
 * run's chunks. Without `run` it reads the content alone: every patch, guild
 * and quest-gated chunk counts, and station skills only need their input to
 * be somewhere in the chunks. With `run` (what the roll engine passes) it
 * counts only what the run can use, as the module comment lists.
 */
export const chunkedTrainingTiers = (chunks: readonly string[], run?: TrainingRun): ReadonlyMap<string, number> => {
  training(chunks, run);
  return cachedTiers;
};

/** The lowest level each skill can be trained at, as chunkedTrainingTiers counts it. */
export const chunkedTrainingLevels = (chunks: readonly string[], run?: TrainingRun): ReadonlyMap<string, number> =>
  training(chunks, run).levels;

/** Whether the quest that opens this skill (SKILL_QUEST_GATES) is done, or it needs none. */
export const chunkedSkillQuestOpen = (skill: string, quests: readonly string[] | undefined): boolean =>
  !Object.hasOwn(SKILL_QUEST_GATES, skill) || (quests ?? []).includes(SKILL_QUEST_GATES[skill]);

/**
 * What the run still needs before it can train a skill its chunks have
 * content for (a Weapon slot for Ranged, essence for Runecraft, a house for
 * Construction), or null when nothing is missing or there is no content.
 */
export const chunkedSkillNeeds = (skill: string, unlocks: TrainingRun & Pick<UnlockState, 'chunks'>): string | null =>
  training(unlocks.chunks ?? [], unlocks).missing.get(skill) ?? null;

/**
 * The lowest tier the run can train this skill at in its chunks, or undefined
 * when it has nothing to train: no usable content, its opening quest isn't
 * done, or all its content needs a higher level than the player has.
 */
export const chunkedTrainableTier = (skill: string, unlocks: TrainingRun & Pick<UnlockState, 'chunks'>): number | undefined => {
  if (!chunkedSkillQuestOpen(skill, unlocks.quests)) return undefined;
  const level = chunkedTrainingLevels(unlocks.chunks ?? [], unlocks).get(skill);
  return level === undefined || level > runLevel(unlocks, skill) ? undefined : tierForLevel(level);
};

/** Whether the skill's next tier opens content the run's chunks can train it at, at the player's level. */
export const chunkedSkillRollable = (skill: string, unlocks: TrainingRun & Pick<UnlockState, 'chunks'>): boolean => {
  const lowest = chunkedTrainableTier(skill, unlocks);
  return lowest !== undefined && lowest <= (unlocks.skills[skill] ?? 0) + 1;
};
