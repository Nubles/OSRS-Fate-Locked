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
  POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST,
  GUILDS_LIST, FARMING_PATCH_LIST, SLAYER_UNLOCKS_LIST,
} from '../data/items';
import { COMBAT_POWERS_DESCRIPTION, COMBAT_POWERS_LABEL } from '../utils/tableDisplay';

import { skillLevelKeyChance } from '../utils/keyRoll';
const WIKI = 'https://oldschool.runescape.wiki/images/';

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
// A fresh account's total level is 32 (all skills at 1), so the first payout
// at total 82 is real, Lumbridge-reachable grinding (WC/Mining/Fishing/
// Cooking/Firemaking/Crafting/Prayer/Thieving/Farming), not a freebie.
export const XTREME_MILESTONE_INTERVAL = 50; // total-level gap between guaranteed keys

// Chunked mode is the same anti-softlock problem, worse: the frontier can be
// a single ~64x64-tile chunk with barely any trainable resources at all (vs.
// Xtreme's whole 6-chunk Lumbridge). Same deterministic-key mechanic, gated
// on gameModeId === 'chunked' && unlocks.chunks.length === 0 (still on the
// free start chunk, nothing rolled yet), but a tighter interval since the
// training footprint is so much smaller.
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

export const EARN_METHODS: EarnMethod[] = [
  {
    category: 'Quests',
    icon: `${WIKI}Quest_point_icon.png`,
    where: 'Journal → Quests — tick a quest as you complete it.',
    blurb: 'The backbone of early progress: every quest rolls once, scaling hard with difficulty.',
    tiers: [
      { tier: 'Novice',       source: DropSource.QUEST_NOVICE,       rate: DROP_RATES[DropSource.QUEST_NOVICE] },
      { tier: 'Intermediate', source: DropSource.QUEST_INTERMEDIATE, rate: DROP_RATES[DropSource.QUEST_INTERMEDIATE] },
      { tier: 'Experienced',  source: DropSource.QUEST_EXPERIENCED,  rate: DROP_RATES[DropSource.QUEST_EXPERIENCED] },
      { tier: 'Master',       source: DropSource.QUEST_MASTER,       rate: DROP_RATES[DropSource.QUEST_MASTER] },
      { tier: 'Grandmaster',  source: DropSource.QUEST_GRANDMASTER,  rate: DROP_RATES[DropSource.QUEST_GRANDMASTER], omni: 20, bonus: 'Guaranteed Key + the best Omni odds in the game.' },
    ],
  },
  {
    category: 'Achievement Diaries',
    icon: `${WIKI}Achievement_Diaries_icon.png`,
    where: 'Journal → Diaries — tick each diary task.',
    blurb: 'Rolls per individual task, with the rate climbing steeply toward Elite.',
    tiers: [
      { tier: 'Easy',   source: DropSource.DIARY_EASY,   rate: DROP_RATES[DropSource.DIARY_EASY] },
      { tier: 'Medium', source: DropSource.DIARY_MEDIUM, rate: DROP_RATES[DropSource.DIARY_MEDIUM] },
      { tier: 'Hard',   source: DropSource.DIARY_HARD,   rate: DROP_RATES[DropSource.DIARY_HARD] },
      { tier: 'Elite',  source: DropSource.DIARY_ELITE,  rate: DROP_RATES[DropSource.DIARY_ELITE], omni: 10, bonus: 'The best diary rate, with an elevated Omni chance.' },
    ],
  },
  {
    category: 'Combat Achievements',
    icon: `${WIKI}Combat_Achievements_icon.png`,
    where: 'Journal → Combat Achievements — tick each task.',
    blurb: 'Your reward for PvM mastery; rolls per task from Easy through Grandmaster.',
    tiers: [
      { tier: 'Easy',        source: DropSource.CA_EASY,        rate: DROP_RATES[DropSource.CA_EASY] },
      { tier: 'Medium',      source: DropSource.CA_MEDIUM,      rate: DROP_RATES[DropSource.CA_MEDIUM] },
      { tier: 'Hard',        source: DropSource.CA_HARD,        rate: DROP_RATES[DropSource.CA_HARD] },
      { tier: 'Elite',       source: DropSource.CA_ELITE,       rate: DROP_RATES[DropSource.CA_ELITE] },
      { tier: 'Master',      source: DropSource.CA_MASTER,      rate: DROP_RATES[DropSource.CA_MASTER] },
      { tier: 'Grandmaster', source: DropSource.CA_GRANDMASTER, rate: DROP_RATES[DropSource.CA_GRANDMASTER], bonus: 'The biggest CA payout.' },
    ],
  },
  {
    category: 'Clue Scrolls',
    icon: `${WIKI}Clue_scroll_%28master%29.png`,
    where: 'Farm Keys → Clue Scrolls — roll a casket card on completion.',
    blurb: 'Cash in completed caskets; rarer tiers pay out far more often.',
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
    where: 'Farm Keys → Slayer Tasks — roll a master card per finished task.',
    blurb: 'Your most repeatable income. Higher masters demand more but pay far better.',
    tiers: [
      { tier: 'Turael / Spria',     source: DropSource.SLAYER_BEGINNER,  rate: DROP_RATES[DropSource.SLAYER_BEGINNER] },
      { tier: 'Mazchna',            source: DropSource.SLAYER_MAZCHNA,    rate: DROP_RATES[DropSource.SLAYER_MAZCHNA] },
      { tier: 'Vannaka',            source: DropSource.SLAYER_VANNAKA,    rate: DROP_RATES[DropSource.SLAYER_VANNAKA] },
      { tier: 'Chaeldar',           source: DropSource.SLAYER_CHAELDAR,   rate: DROP_RATES[DropSource.SLAYER_CHAELDAR] },
      { tier: 'Konar',              source: DropSource.SLAYER_KONAR,      rate: DROP_RATES[DropSource.SLAYER_KONAR] },
      { tier: 'Nieve / Steve',      source: DropSource.SLAYER_NIEVE,      rate: DROP_RATES[DropSource.SLAYER_NIEVE] },
      { tier: 'Krystilia',          source: DropSource.SLAYER_KRYSTILIA,  rate: DROP_RATES[DropSource.SLAYER_KRYSTILIA] },
      { tier: 'Duradel / Kuradal',  source: DropSource.SLAYER_DURADEL,    rate: DROP_RATES[DropSource.SLAYER_DURADEL] },
      { tier: 'Boss Task',          source: DropSource.SLAYER_BOSS,       rate: DROP_RATES[DropSource.SLAYER_BOSS], bonus: 'The single best repeatable roll in the game.' },
    ],
  },
  {
    category: 'Bosses',
    icon: `${WIKI}Boss.png`,
    where: 'Farm Keys → Bossing — pick the boss you killed and roll.',
    blurb: 'Repeatable PvM income: every kill rolls at that specific boss’s rate, from entry bosses up to raids.',
    tiers: [
      { tier: 'Low boss',  source: DropSource.BOSS_LOW,  rate: DROP_RATES[DropSource.BOSS_LOW] },
      { tier: 'Mid boss',  source: DropSource.BOSS_MID,  rate: DROP_RATES[DropSource.BOSS_MID] },
      { tier: 'High boss', source: DropSource.BOSS_HIGH, rate: DROP_RATES[DropSource.BOSS_HIGH], omni: 10, bonus: 'Top bosses keep elevated Omni odds.' },
      { tier: 'Raid',      source: DropSource.RAID,      rate: DROP_RATES[DropSource.RAID], omni: 15, bonus: 'CoX / ToB / ToA — the best repeatable odds in the game.' },
    ],
  },
  {
    category: 'Activities',
    icon: `${WIKI}Minigames.png`,
    where: 'Farm Keys → Activities — roll on each completion.',
    blurb: 'Minigames keep paying out long after the journal is done.',
    tiers: [
      { tier: 'Minigame', source: DropSource.ACTIVITY_MINIGAME, rate: DROP_RATES[DropSource.ACTIVITY_MINIGAME] },
    ],
  },
  {
    category: 'Pets',
    icon: `${WIKI}Pet_kraken.png`,
    where: 'Farm Keys → Activities — roll the moment a pet drops.',
    blurb: 'The jackpot: any pet is a guaranteed key, with the best Omni odds going.',
    tiers: [
      { tier: 'Any pet drop', source: DropSource.PET, rate: DROP_RATES[DropSource.PET], omni: 25, bonus: 'Guaranteed Key + top-tier Omni odds.' },
    ],
  },
  {
    category: 'Collection Log',
    icon: `${WIKI}Collection_log.png`,
    where: 'Collection Log tab — log a new unique item.',
    blurb: 'Every unique slot you fill for the first time rolls once.',
    tiers: [
      { tier: 'Any new unique', source: DropSource.COLLECTION_LOG, rate: DROP_RATES[DropSource.COLLECTION_LOG] },
    ],
  },
  {
    category: 'Level Ups',
    icon: `${WIKI}Stats_icon.png`,
    where: 'Dashboard → click an unlocked skill to bank a level.',
    blurb: 'The slow drip that rewards raw XP — and the only routine Chaos Key source.',
    dynamic: true,
    tiers: [
      {
        tier: 'Per level gained',
        rate: LEVEL_ROLL_MAX,
        rateLabel: `Level ÷ 5 (up to ${LEVEL_ROLL_MAX.toFixed(1)}% at level 99)`,
        bonus: `Failure Fate: +1 at levels 2-19, +2 at 20-79, +3 at 80-99. ${LEVEL_CHAOS_CHANCE}% chance of a Chaos Key on every level, plus guaranteed Chaos Keys at levels ${SKILL_CHAOS_MILESTONES.join(', ')}.`,
      },
    ],
  },
].map(method => ({
  ...method,
  tiers: method.tiers.map(tier => tier.source
    ? { ...tier, fateOnFailure: failureFateForSource(tier.source) }
    : tier),
}));

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
    tagline: 'Your bread-and-butter currency.',
    earn: [
      'Any successful Farm Key roll (+1, or +2 under Ritual of Greed).',
      'A Pity Key when Fate Points hit your mode’s threshold.',
      'The bonus Key that rides along with every Omni-Key roll.',
    ],
    spend: 'Cash in on a table you choose to unlock one RANDOM entry from it.',
  },
  {
    id: 'omni',
    name: 'Omni-Key',
    icon: `${WIKI}Enhanced_crystal_key.png`,
    accent: 'text-purple-400',
    tagline: 'Bend Fate to your will.',
    earn: [
      'A lucky upgrade on a successful roll (mode base %, up to 20% on Grandmaster quests, 10% on Elite diaries & full CA/Diary sections).',
      'Ritual of Transmutation — fuse 5 standard Keys into 1.',
    ],
    spend: 'Hold one and the Dashboard lights up — click any locked skill, gear slot, region or boss to unlock EXACTLY it. No RNG, no table roll.',
  },
  {
    id: 'chaos',
    name: 'Chaos Key',
    icon: `${WIKI}Eternal_crystal.png`,
    accent: 'text-red-400',
    tagline: 'Surrender to entropy.',
    earn: [
      `A rare ${LEVEL_CHAOS_CHANCE}% drop on any Level Up.`,
      'Ritual of Chaos — convert Fate Points into one.',
    ],
    spend: 'Unlocks one RANDOM entry from ANY table — you don’t even pick the table.',
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
  { type: TableType.REGIONS,         label: 'Areas',      count: REGIONS_LIST.length,    blurb: 'Open new map regions you’re allowed to enter.' },
  { type: TableType.MOBILITY,        label: 'Mobility',   count: MOBILITY_LIST.length,   blurb: 'Teleports, spirit trees, fairy rings and transport networks.' },
  { type: TableType.ARCANA,          label: COMBAT_POWERS_LABEL, count: ARCANA_LIST.length, blurb: COMBAT_POWERS_DESCRIPTION },
  { type: TableType.STORAGE,         label: 'Storage',    count: STORAGE_LIST.length,    blurb: 'Looting bag, rune pouch, seed box — and rare bank access.' },
  { type: TableType.POH,             label: 'Housing',    count: POH_LIST.length,        blurb: 'Player-owned house rooms and facilities.' },
  { type: TableType.MERCHANTS,       label: 'Merchants',  count: MERCHANTS_LIST.length,  blurb: 'Shops and traders you’re permitted to use.' },
  { type: TableType.MINIGAMES,       label: 'Minigames',  count: MINIGAMES_LIST.length,  blurb: 'Activities, from Pest Control to the Inferno.' },
  { type: TableType.BOSSES,          label: 'Bosses',     count: BOSSES_LIST.length,     blurb: 'Permission to fight each major boss encounter.' },
  { type: TableType.GUILDS,          label: 'Guilds',     count: GUILDS_LIST.length,     blurb: 'Skill guilds and their perks.' },
  { type: TableType.FARMING_LAYERS,  label: 'Farming',    count: FARMING_PATCH_LIST.length, blurb: 'Farming patches across the world.' },
  { type: TableType.SLAYER_UNLOCKS,  label: 'Slayer',     count: SLAYER_UNLOCKS_LIST.length, blurb: 'Slayer reward unlocks: new tasks, superiors, helmet & more.' },
  // Bank-locked modes only (rules.bankLocks) — filtered in on demand.
  { type: TableType.BANKS,           label: 'Banks',      count: BANK_IDS.length,        blurb: 'Every bank and deposit box is locked until you roll it — banking is a privilege, not a given.' },
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

/** Gambit payout: keys won per this many staked fate points (on a 50/50 win). */
export const GAMBIT_KEYS_PER = 15;
/** Greed's consolation: this fraction of the (scaled) cost refunds on a failed roll. */
export const GREED_REFUND_FRACTION = 0.5;

export const RITUALS: Ritual[] = [
  { id: 'LUCK',         name: 'Ritual of Clarity',       tagline: 'Roll with advantage.',   fateCost: 8,  effect: 'Your next roll is made twice — the better result is kept.' },
  { id: 'GREED',        name: 'Ritual of Greed',         tagline: 'Double or… something.',  fateCost: 15, effect: 'If your next roll succeeds you get 2 Keys. If it fails, half the Fate is refunded.' },
  { id: 'CHAOS',        name: 'Ritual of Chaos',         tagline: 'Embrace entropy.',       fateCost: 25, effect: 'Immediately forge 1 Chaos Key (a random unlock from ANY table).' },
  { id: 'GAMBIT',       name: 'Void Gambit',             tagline: 'Before Fate reclaims it.', fateCost: 15, stakesAllFate: true,
    effect: `Stake ALL your Fate on a coin flip. Win: 1 Key per ${GAMBIT_KEYS_PER} staked. Lose: the Void keeps everything.` },
  { id: 'CARTOGRAPHER', name: 'Ritual of the Cartographer', tagline: 'Chart your own course.', fateCost: 40, chunkedOnly: true,
    effect: 'Reveal 3 random frontier chunks — and CHOOSE which one unlocks. The only say you get in where Fate takes you.' },
  { id: 'TRANSMUTE',    name: 'Ritual of Transmutation', tagline: 'Equivalent exchange.',   keyCost: 5,   effect: 'Fuse 5 standard Keys into 1 Omni-Key.' },
];

export const getRitual = (id: Ritual['id']): Ritual => RITUALS.find(r => r.id === id)!;

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
