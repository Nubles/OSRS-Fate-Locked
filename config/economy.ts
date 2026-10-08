/**
 * The Key Economy — one typed source of truth for every way to EARN and SPEND
 * keys in Fate Locked.
 *
 * The Codex, onboarding, and any "how it works" surface render from this file,
 * and `data/economy.consistency.test.ts` pins every fixed earn rate to
 * `DROP_RATES` (the engine's actual numbers). That guarantee is the whole point:
 * the rules a player reads can never drift from the rules the engine runs.
 *
 * When you change a drop rate, change it in `config/rules.ts` (DROP_RATES) — the
 * tables below read from it, so they update for free.
 */
import { DropSource, TableType, type FailureFateAward } from '../types';
import { BANK_IDS } from '../data/banks';
import { DROP_RATES, EQUIPMENT_TIER_MAX } from './rules';
import {
  SKILLS_LIST, EQUIPMENT_SLOTS, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST,
  ROLLABLE_POH_ITEMS, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, ROLLABLE_STORAGE_ITEMS,
  GUILDS_LIST, FARMING_PATCH_LIST, SLAYER_UNLOCKS_LIST,
} from '../data/items';
import { COMBAT_POWERS_DESCRIPTION, COMBAT_POWERS_LABEL } from '../utils/tableDisplay';

import { skillLevelKeyChance } from '../utils/keyRoll';
const WIKI = 'https://oldschool.runescape.wiki/images/';

/** Keys every new run starts with. GameContext's fresh state and the Rules text both read it. */
export const STARTING_KEYS = 3;

/** "a, b and c": for lists the Rules text reads out. */
export const andList = (items: readonly (string | number)[]): string =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

// ── Skill levelling is the one dynamic rate (computed per attempt) ───────────
export const SKILLS_TIER_CAP = 10;     // tiers per skill (1 Key each)
export const LEVEL_ROLL_MAX = skillLevelKeyChance(99);
export const LEVEL_CHAOS_CHANCE = 2;   // % chance of a Chaos Key on any level up


/** Fate awarded after a failed roll from a fixed source. */
export const FAILURE_FATE_BY_SOURCE: Partial<Record<DropSource, FailureFateAward>> = {
  [DropSource.QUEST_NOVICE]: 1,
  [DropSource.QUEST_INTERMEDIATE]: 1,
  [DropSource.QUEST_EXPERIENCED]: 2,
  [DropSource.QUEST_MASTER]: 3,
  [DropSource.QUEST_GRANDMASTER]: 1,
  [DropSource.DIARY_EASY]: 1,
  [DropSource.DIARY_MEDIUM]: 1,
  [DropSource.DIARY_HARD]: 2,
  [DropSource.DIARY_ELITE]: 3,
  [DropSource.CA_EASY]: 1,
  [DropSource.CA_MEDIUM]: 1,
  [DropSource.CA_HARD]: 2,
  [DropSource.CA_ELITE]: 2,
  [DropSource.CA_MASTER]: 3,
  [DropSource.CA_GRANDMASTER]: 3,
  [DropSource.CLUE_BEGINNER]: 1,
  [DropSource.CLUE_EASY]: 1,
  [DropSource.CLUE_MEDIUM]: 1,
  [DropSource.CLUE_HARD]: 2,
  [DropSource.CLUE_ELITE]: 2,
  [DropSource.CLUE_MASTER]: 3,
  [DropSource.SLAYER_BEGINNER]: 1,
  [DropSource.SLAYER_MAZCHNA]: 1,
  [DropSource.SLAYER_VANNAKA]: 1,
  [DropSource.SLAYER_CHAELDAR]: 1,
  [DropSource.SLAYER_KONAR]: 2,
  [DropSource.SLAYER_NIEVE]: 2,
  [DropSource.SLAYER_KRYSTILIA]: 2,
  [DropSource.SLAYER_DURADEL]: 2,
  [DropSource.SLAYER_BOSS]: 3,
  [DropSource.BOSS_LOW]: 1,
  [DropSource.BOSS_MID]: 2,
  [DropSource.BOSS_HIGH]: 2,
  [DropSource.RAID]: 3,
  [DropSource.ACTIVITY_MINIGAME]: 1,
  [DropSource.PET]: 1,
  [DropSource.COLLECTION_LOG]: 1,
};

/** Conservative fallback protects custom and future sources from being over-valued. */
export const failureFateForSource = (source: DropSource): FailureFateAward =>
  FAILURE_FATE_BY_SOURCE[source] ?? 1;

export const failureFateForSkillLevel = (level: number): FailureFateAward =>
  level >= 80 ? 3 : level >= 20 ? 2 : 1;

export const SKILL_CHAOS_MILESTONES = [30, 40, 50, 60, 70, 80, 90, 99] as const;

const SKILL_CHAOS_MILESTONE_SET = new Set<number>(SKILL_CHAOS_MILESTONES);

export const isSkillChaosMilestone = (level: number): boolean =>
  SKILL_CHAOS_MILESTONE_SET.has(level);
// ── Xtreme Start anti-softlock insurance ──────────────────────────────────
// Xtreme Start frees only Lumbridge, which rules out slayer/clues/most quests
// & diaries/CAs as key sources — level-ups are the only thing left, and a run
// with truly awful RNG on that single faucet can stall forever with nothing
// left to try. This is a deterministic (not RNG) safety net: a guaranteed key
// every 50 total levels, but ONLY while gameModeId === 'xtreme' AND
// unlocks.regions is still empty. It turns itself off the moment the run
// unlocks a second region, so it never inflates the tuned earn:sink ratio for
// Vanilla/Chill/Custom runs or for Xtreme runs that have already broken out.
// Keys land on multiples of the interval. A fresh account starts at total
// level 33 (24 skills at 1, Hitpoints 10), and choosing the mode counts the
// multiples already passed, so the first Xtreme key comes at total 50: real,
// Lumbridge-reachable grinding (WC/Mining/Fishing/Cooking/Firemaking/
// Crafting/Prayer/Thieving/Farming), not a freebie.
export const XTREME_MILESTONE_INTERVAL = 50; // total-level gap between guaranteed keys

// Chunked mode is the same anti-softlock problem, worse: the frontier can be
// a single ~64x64-tile chunk with barely any trainable resources at all (vs.
// Xtreme's whole 6-chunk Lumbridge). Same deterministic-key mechanic, gated
// on gameModeId === 'chunked' && unlocks.chunks.length === 0 (still on the
// free start chunk, nothing rolled yet), but a tighter interval since the
// training footprint is so much smaller. A new run's first key comes at total
// 50; runs that chose Chunked before SET_GAME_MODE counted the start (the
// 24 September 2026 release) were paid their first key on the first level-up.
export const CHUNKED_MILESTONE_INTERVAL = 25; // total-level gap between guaranteed keys

// ── Earning ──────────────────────────────────────────────────────────────────
export type EarnCategory =
  | 'Quests' | 'Achievement Diaries' | 'Combat Achievements'
  | 'Clue Scrolls' | 'Slayer Tasks' | 'Collection Log' | 'Level Ups'
  | 'Bosses' | 'Activities' | 'Pets';

export interface EarnTier {
  /** Display label for the tier / Slayer master. */
  tier: string;
  /** Engine DropSource — present for every fixed-rate tier. */
  source?: DropSource;
  /** Success %. For a fixed tier this MUST equal DROP_RATES[source]. */
  rate: number;
  /** Override the rate's display string (used by the dynamic Level Up curve). */
  rateLabel?: string;
  /** Elevated Omni-Key chance for this tier (applies when above the mode base). */
  omni?: number;
  /** Fate awarded when this fixed-rate roll fails. */
  fateOnFailure?: FailureFateAward;
  /** Extra payout note, e.g. the Level Up Chaos chance. */
  bonus?: string;
}

export interface EarnMethod {
  category: EarnCategory;
  icon: string;
  /** Where in the app you trigger this roll. */
  where: string;
  /** One-line pitch. */
  blurb: string;
  /** true when the rate is computed per attempt (Level Ups) rather than fixed. */
  dynamic?: boolean;
  tiers: EarnTier[];
}

const EARN_METHOD_DEFINITIONS: EarnMethod[] = [
  {
    category: 'Quests',
    icon: `${WIKI}Quest_point_icon.png`,
    where: 'Journal → Quests: tick a quest when you finish it.',
    blurb: 'Every quest rolls once, and harder quests roll better.',
    tiers: [
      { tier: 'Novice',       source: DropSource.QUEST_NOVICE,       rate: DROP_RATES[DropSource.QUEST_NOVICE] },
      { tier: 'Intermediate', source: DropSource.QUEST_INTERMEDIATE, rate: DROP_RATES[DropSource.QUEST_INTERMEDIATE] },
      { tier: 'Experienced',  source: DropSource.QUEST_EXPERIENCED,  rate: DROP_RATES[DropSource.QUEST_EXPERIENCED] },
      { tier: 'Master',       source: DropSource.QUEST_MASTER,       rate: DROP_RATES[DropSource.QUEST_MASTER] },
      { tier: 'Grandmaster',  source: DropSource.QUEST_GRANDMASTER,  rate: DROP_RATES[DropSource.QUEST_GRANDMASTER], omni: 20, bonus: 'A guaranteed Key, and the best Omni-Key chance of any quest.' },
    ],
  },
  {
    category: 'Achievement Diaries',
    icon: `${WIKI}Achievement_Diaries_icon.png`,
    where: 'Journal → Diaries: tick each diary task.',
    blurb: 'Each diary task rolls once, and harder tiers roll better.',
    tiers: [
      { tier: 'Easy',   source: DropSource.DIARY_EASY,   rate: DROP_RATES[DropSource.DIARY_EASY] },
      { tier: 'Medium', source: DropSource.DIARY_MEDIUM, rate: DROP_RATES[DropSource.DIARY_MEDIUM] },
      { tier: 'Hard',   source: DropSource.DIARY_HARD,   rate: DROP_RATES[DropSource.DIARY_HARD] },
      { tier: 'Elite',  source: DropSource.DIARY_ELITE,  rate: DROP_RATES[DropSource.DIARY_ELITE], omni: 10, bonus: 'The best diary rate, and a raised Omni-Key chance.' },
    ],
  },
  {
    category: 'Combat Achievements',
    icon: `${WIKI}Combat_Achievements_icon.png`,
    where: 'Journal → Combat Achievements: tick each task.',
    blurb: 'Each Combat Achievement task rolls once, from Easy to Grandmaster.',
    tiers: [
      { tier: 'Easy',        source: DropSource.CA_EASY,        rate: DROP_RATES[DropSource.CA_EASY] },
      { tier: 'Medium',      source: DropSource.CA_MEDIUM,      rate: DROP_RATES[DropSource.CA_MEDIUM] },
      { tier: 'Hard',        source: DropSource.CA_HARD,        rate: DROP_RATES[DropSource.CA_HARD] },
      { tier: 'Elite',       source: DropSource.CA_ELITE,       rate: DROP_RATES[DropSource.CA_ELITE] },
      { tier: 'Master',      source: DropSource.CA_MASTER,      rate: DROP_RATES[DropSource.CA_MASTER] },
      { tier: 'Grandmaster', source: DropSource.CA_GRANDMASTER, rate: DROP_RATES[DropSource.CA_GRANDMASTER], bonus: 'The best Combat Achievement rate.' },
    ],
  },
  {
    category: 'Clue Scrolls',
    icon: `${WIKI}Clue_scroll_%28master%29.png`,
    where: 'Farm Keys → Clues: roll that tier’s card for each clue you finish.',
    blurb: 'Each finished clue rolls once, and harder tiers roll better.',
    tiers: [
      { tier: 'Beginner', source: DropSource.CLUE_BEGINNER, rate: DROP_RATES[DropSource.CLUE_BEGINNER] },
      { tier: 'Easy',     source: DropSource.CLUE_EASY,     rate: DROP_RATES[DropSource.CLUE_EASY] },
      { tier: 'Medium',   source: DropSource.CLUE_MEDIUM,   rate: DROP_RATES[DropSource.CLUE_MEDIUM] },
      { tier: 'Hard',     source: DropSource.CLUE_HARD,     rate: DROP_RATES[DropSource.CLUE_HARD] },
      { tier: 'Elite',    source: DropSource.CLUE_ELITE,    rate: DROP_RATES[DropSource.CLUE_ELITE] },
      { tier: 'Master',   source: DropSource.CLUE_MASTER,   rate: DROP_RATES[DropSource.CLUE_MASTER] },
    ],
  },
  {
    category: 'Slayer Tasks',
    icon: `${WIKI}Slayer_icon.png`,
    where: 'Farm Keys → Slayer: roll your master’s card for each task you finish.',
    blurb: 'Every finished task rolls, with no limit, and higher masters roll better.',
    tiers: [
      { tier: 'Turael / Spria',     source: DropSource.SLAYER_BEGINNER,  rate: DROP_RATES[DropSource.SLAYER_BEGINNER] },
      { tier: 'Mazchna',            source: DropSource.SLAYER_MAZCHNA,    rate: DROP_RATES[DropSource.SLAYER_MAZCHNA] },
      { tier: 'Vannaka',            source: DropSource.SLAYER_VANNAKA,    rate: DROP_RATES[DropSource.SLAYER_VANNAKA] },
      { tier: 'Chaeldar',           source: DropSource.SLAYER_CHAELDAR,   rate: DROP_RATES[DropSource.SLAYER_CHAELDAR] },
      { tier: 'Konar',              source: DropSource.SLAYER_KONAR,      rate: DROP_RATES[DropSource.SLAYER_KONAR] },
      { tier: 'Nieve / Steve',      source: DropSource.SLAYER_NIEVE,      rate: DROP_RATES[DropSource.SLAYER_NIEVE] },
      { tier: 'Krystilia',          source: DropSource.SLAYER_KRYSTILIA,  rate: DROP_RATES[DropSource.SLAYER_KRYSTILIA] },
      { tier: 'Duradel / Kuradal',  source: DropSource.SLAYER_DURADEL,    rate: DROP_RATES[DropSource.SLAYER_DURADEL] },
      { tier: 'Boss Task',          source: DropSource.SLAYER_BOSS,       rate: DROP_RATES[DropSource.SLAYER_BOSS], bonus: 'The best Slayer rate.' },
    ],
  },
  {
    category: 'Bosses',
    icon: `${WIKI}Boss.png`,
    where: 'Farm Keys → Bossing: pick the boss you killed and roll.',
    blurb: 'In Vanilla, each boss pays a few Keys at falling odds, then stops: the list above shows how many. In Chunked, every kill rolls at its tier’s rate.',
    tiers: [
      { tier: 'Low boss',  source: DropSource.BOSS_LOW,  rate: DROP_RATES[DropSource.BOSS_LOW] },
      { tier: 'Mid boss',  source: DropSource.BOSS_MID,  rate: DROP_RATES[DropSource.BOSS_MID] },
      { tier: 'High boss', source: DropSource.BOSS_HIGH, rate: DROP_RATES[DropSource.BOSS_HIGH], omni: 10 },
      { tier: 'Raid',      source: DropSource.RAID,      rate: DROP_RATES[DropSource.RAID], omni: 15, bonus: 'Raids (CoX, ToB and ToA) have the best Omni-Key chance of any boss.' },
    ],
  },
  {
    category: 'Activities',
    icon: `${WIKI}Minigames.png`,
    where: 'Farm Keys → Activities: roll each time you finish one.',
    blurb: 'Every finished minigame rolls, with no limit.',
    tiers: [
      { tier: 'Minigame', source: DropSource.ACTIVITY_MINIGAME, rate: DROP_RATES[DropSource.ACTIVITY_MINIGAME] },
    ],
  },
  {
    category: 'Pets',
    icon: `${WIKI}Pet_kraken.png`,
    where: 'Farm Keys → Activities: claim each new pet.',
    blurb: 'Each new pet gives an Omni-Key, once per pet.',
    tiers: [
      { tier: 'Each new pet', source: DropSource.PET, rate: DROP_RATES[DropSource.PET], rateLabel: 'Omni-Key', bonus: 'An Omni-Key instead of a Key, once per pet. Claiming one isn’t a roll: Fate and rituals stay as they are.' },
    ],
  },
  {
    category: 'Collection Log',
    icon: `${WIKI}Collection_log.png`,
    where: 'Collection Log tab: log a new unique item.',
    blurb: 'Every unique slot you fill for the first time rolls once.',
    tiers: [
      { tier: 'Any new unique', source: DropSource.COLLECTION_LOG, rate: DROP_RATES[DropSource.COLLECTION_LOG] },
    ],
  },
  {
    category: 'Level Ups',
    icon: `${WIKI}Stats_icon.png`,
    where: 'Character tab: click an unlocked skill to log a level.',
    blurb: 'Every level you gain rolls once, and higher levels roll better. Level-ups also give Chaos Keys.',
    dynamic: true,
    tiers: [
      {
        tier: 'Per level gained',
        rate: LEVEL_ROLL_MAX,
        rateLabel: `Level ÷ 5 (up to ${LEVEL_ROLL_MAX.toFixed(1)}% at level 99)`,
        bonus: `Failure Fate: +1 at levels 2-19, +2 at 20-79, +3 at 80-99. Guaranteed Chaos Keys at levels ${andList(SKILL_CHAOS_MILESTONES)}, plus a separate ${LEVEL_CHAOS_CHANCE}% chance of one on every level-up.`,
      },
    ],
  },
];

export const EARN_METHODS: EarnMethod[] = EARN_METHOD_DEFINITIONS.map(method => ({
  ...method,
  tiers: method.tiers.map(tier => tier.source
    ? { ...tier, fateOnFailure: failureFateForSource(tier.source) }
    : tier),
}));

/**
 * The raised Omni-Key chance a source rolls at, if it has one. These are the tiers' `omni`
 * values, which economy.consistency.test.ts pins to the roll engine.
 */
export const omniFloor = (source: DropSource): number => {
  const omni = EARN_METHODS.flatMap(m => m.tiers).find(t => t.source === source)?.omni;
  if (omni === undefined) throw new Error(`No raised Omni-Key chance for ${source}`);
  return omni;
};

/** Min/max fixed success rate across all tiers of a method (for summary chips). */
export const earnRange = (m: EarnMethod): [number, number] => {
  const rates = m.tiers.map(t => t.rate);
  return [Math.min(...rates), Math.max(...rates)];
};

// ── Key types ────────────────────────────────────────────────────────────────
export interface KeyTypeInfo {
  id: 'standard' | 'omni' | 'chaos';
  name: string;
  icon: string;
  /** Tailwind text colour token used across the UI. */
  accent: string;
  tagline: string;
  earn: string[];
  spend: string;
}

export const KEY_TYPES: KeyTypeInfo[] = [
  {
    id: 'standard',
    name: 'Standard Key',
    icon: `${WIKI}Crystal_key.png`,
    accent: 'text-osrs-gold',
    tagline: 'The everyday Key.',
    earn: [
      'Any successful roll, wherever you log it (+1, or +2 with the Ritual of Greed).',
      'A Pity Key when Fate Points hit your mode’s threshold.',
      'A won Void Gambit.',
      `Chunked: a guaranteed Key every ${CHUNKED_MILESTONE_INTERVAL} total levels while you hold only your start chunk.`,
      `The ${STARTING_KEYS} every run starts with.`,
    ],
    spend: 'Spend it on a table you choose to unlock a random entry from it.',
  },
  {
    id: 'omni',
    name: 'Omni-Key',
    icon: `${WIKI}Enhanced_crystal_key.png`,
    accent: 'text-purple-400',
    tagline: 'Pick what you unlock.',
    earn: [
      'A bonus on a successful roll, on top of the Key: your mode’s base chance, raised to 20% on Grandmaster quests, 15% on raids and 10% on Elite diaries and high-tier bosses.',
      'Each new pet: an Omni-Key instead of a Key, once per pet.',
      'The Ritual of Transmutation: 5 Keys make 1 Omni-Key.',
    ],
    spend: 'Click a locked skill, gear slot, area, boss or other entry on the Dashboard to unlock exactly that. In Chunked, land only comes from Chunk unlocks and the Ritual of the Cartographer.',
  },
  {
    id: 'chaos',
    name: 'Chaos Key',
    icon: `${WIKI}Eternal_crystal.png`,
    accent: 'text-red-400',
    tagline: 'A random unlock from every table.',
    earn: [
      `Guaranteed at skill levels ${andList(SKILL_CHAOS_MILESTONES)}: ${SKILL_CHAOS_MILESTONES.length} per skill.`,
      `A separate ${LEVEL_CHAOS_CHANCE}% chance on every level-up, milestones included.`,
      'The Ritual of Chaos turns Fate Points into one.',
    ],
    spend: 'Unlocks one random entry from all the tables at once. Every eligible entry is equally likely, so big tables such as Banks come up most.',
  },
];

// ── Spending tables ──────────────────────────────────────────────────────────
export interface SpendTable {
  type: TableType;
  label: string;
  /** Distinct entries (slots/skills for tiered tables). */
  count: number;
  /** For tiered tables, how many upgrades each entry takes. */
  tiers?: number;
  blurb: string;
}

export const SPEND_TABLES: SpendTable[] = [
  { type: TableType.EQUIPMENT,       label: 'Equipment',  count: EQUIPMENT_SLOTS.length, tiers: EQUIPMENT_TIER_MAX, blurb: 'Open a gear slot, then upgrade its tier toward endgame.' },
  { type: TableType.SKILLS,          label: 'Skills',     count: SKILLS_LIST.length,     tiers: SKILLS_TIER_CAP,    blurb: 'Raise a skill’s tier cap by +10 levels of usable methods.' },
  { type: TableType.REGIONS,         label: 'Areas',      count: REGIONS_LIST.length,    blurb: 'Unlock a new area you can go to.' },
  { type: TableType.MOBILITY,        label: 'Mobility',   count: MOBILITY_LIST.length,   blurb: 'Teleports, spirit trees, fairy rings and transport networks.' },
  { type: TableType.ARCANA,          label: COMBAT_POWERS_LABEL, count: ARCANA_LIST.length, blurb: COMBAT_POWERS_DESCRIPTION },
  { type: TableType.STORAGE,         label: 'Storage',    count: ROLLABLE_STORAGE_ITEMS.length, blurb: 'Looting bag, rune pouch, seed box and other storage. Banks are their own table.' },
  { type: TableType.POH,             label: 'Housing',    count: ROLLABLE_POH_ITEMS.length, blurb: 'Player-owned house rooms and facilities.' },
  { type: TableType.MERCHANTS,       label: 'Merchants',  count: MERCHANTS_LIST.length,  blurb: 'Shops and traders you’re permitted to use.' },
  { type: TableType.MINIGAMES,       label: 'Minigames',  count: MINIGAMES_LIST.length,  blurb: 'Activities, from Pest Control to Guardians of the Rift.' },
  { type: TableType.BOSSES,          label: 'Bosses',     count: BOSSES_LIST.length,     blurb: 'Permission to fight each major boss encounter.' },
  { type: TableType.GUILDS,          label: 'Guilds',     count: GUILDS_LIST.length,     blurb: 'Skill guilds and their perks.' },
  { type: TableType.FARMING_LAYERS,  label: 'Farming',    count: FARMING_PATCH_LIST.length, blurb: 'Farming patches across the world.' },
  { type: TableType.SLAYER_UNLOCKS,  label: 'Slayer',     count: SLAYER_UNLOCKS_LIST.length, blurb: 'Slayer reward unlocks: new tasks, superiors, helmet & more.' },
  // Bank-locked modes only (rules.bankLocks) — filtered in on demand.
  { type: TableType.BANKS,           label: 'Banks',      count: BANK_IDS.length,        blurb: 'Banking is locked by place: each place with a bank, bank chest or deposit box is one unlock.' },
];

/** Flat cost, in keys, of a single unlock from any table. */
export const UNLOCK_KEY_COST = 1;

// ── Void Altar rituals (base costs; the mode's ritualCostMultiplier scales Fate) ─
//
// The economics that make these work: fate RESETS TO ZERO whenever a roll
// succeeds, so it can't be banked — it only exists mid-drought. The altar is
// therefore a drought valve ("spend it before a key burns it"), and every
// cost below is tuned against that: cheap habitual spice (Clarity), a
// softened gamble (Greed refunds half on failure), converters (Chaos /
// Transmute), a stake-it-all coin flip (Gambit), and Chunked mode's only
// agency valve (Cartographer, priced just under the pity key).
export interface Ritual {
  id: 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE' | 'GAMBIT' | 'CARTOGRAPHER';
  name: string;
  tagline: string;
  /** Base cost before the mode multiplier (fate costs are scaled, key costs are not). */
  fateCost?: number;
  keyCost?: number;
  effect: string;
  /** GAMBIT: fateCost is the MINIMUM stake — the ritual consumes ALL fate. */
  stakesAllFate?: boolean;
  /** Only offered in Chunked mode (needs a chunk frontier to choose from). */
  chunkedOnly?: boolean;
}

/**
 * The Void Gambit's minimum stake before the mode's multiplier. A won Gambit pays 1 Key per
 * minimum staked, scaled the same way, so a Key costs the same whatever is staked.
 */
const GAMBIT_STAKE = 15;
const gambitText = (perKey: number): string =>
  `Stake all your Fate on a coin flip. Win: 1 Key per ${perKey} staked, rounded down, and the rest is lost. Lose: all of it is lost.`;
/** Greed's consolation: this fraction of the (scaled) cost refunds on a failed roll. */
export const GREED_REFUND_FRACTION = 0.5;

export const RITUALS: Ritual[] = [
  { id: 'LUCK',         name: 'Ritual of Clarity',       tagline: 'Roll twice, keep the better.', fateCost: 8,  effect: 'Your next Key roll is made twice and the better result is kept.' },
  { id: 'GREED',        name: 'Ritual of Greed',         tagline: 'Try to double your next Key.', fateCost: 15, effect: 'If your next Key roll succeeds you get 2 Keys, even when it also brings an Omni-Key (a Vanilla boss with 1 Key left gives 1). If it fails, half the Fate comes back, unless the fail brings a Pity Key.' },
  { id: 'CHAOS',        name: 'Ritual of Chaos',         tagline: 'Buy a Chaos Key.',       fateCost: 25, effect: 'Get 1 Chaos Key now: a random unlock from every table at once.' },
  { id: 'GAMBIT',       name: 'Void Gambit',             tagline: 'A coin flip for Keys.', fateCost: GAMBIT_STAKE, stakesAllFate: true,
    effect: gambitText(GAMBIT_STAKE) },
  { id: 'CARTOGRAPHER', name: 'Ritual of the Cartographer', tagline: 'Choose your next chunk.', fateCost: 40, chunkedOnly: true,
    effect: 'See up to 3 random frontier chunks and choose which one unlocks. The only way to choose land in Chunked.' },
  { id: 'TRANSMUTE',    name: 'Ritual of Transmutation', tagline: 'Trade Keys for an Omni-Key.', keyCost: 5, effect: 'Trade 5 Keys for 1 Omni-Key.' },
];

export const getRitual = (id: Ritual['id']): Ritual => RITUALS.find(r => r.id === id)!;

/**
 * A ritual's Fate cost under the run's ritualCostMultiplier — for the Gambit,
 * its minimum stake. The engine, the Void Altar and the Codex all price
 * rituals through this, so what the Altar offers is what the engine accepts.
 */
export const ritualFateCost = (id: Ritual['id'], multiplier: number): number =>
  Math.round((getRitual(id).fateCost ?? 0) * multiplier);

/**
 * The Keys a won Void Gambit pays: 1 per minimum stake as the run's multiplier scales it (the
 * minimum the Altar shows). No stake is below the minimum, so a win pays at least 1. Paying
 * per a fixed 15 made a stake at a cheap mode's minimum pay far more per Fate than a larger
 * one, and an expensive mode the reverse.
 */
export const gambitKeys = (stake: number, multiplier: number): number =>
  Math.floor(stake / ritualFateCost('GAMBIT', multiplier));

/** A ritual's effect as the run's multiplier prices it: the Gambit names its price per Key. */
export const ritualEffect = (id: Ritual['id'], multiplier: number): string =>
  id === 'GAMBIT' ? gambitText(ritualFateCost('GAMBIT', multiplier)) : getRitual(id).effect;

export {
  BRUTUS_BOSS_NAME,
  CLUE_ONBOARDING_MINIMUMS,
  effectiveVanillaClueRate,
  clueOnboardingMinimum,
  VANILLA_BOSS_KEY_RATES,
  VANILLA_BOSS_STANDARD_KEY_TOTAL,
  vanillaBossKeySchedule,
  vanillaBossKeyStage,
} from './vanillaKeyEconomy';
export type { KeyRollContext, VanillaBossClass } from './vanillaKeyEconomy';
