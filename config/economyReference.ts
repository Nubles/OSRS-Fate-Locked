/**
 * The Codex's summaries of the three Keys and of the tables a Key can unlock from.
 * Kept apart from config/economy.ts, which loads with the app's first screen: only the Codex
 * (components/ReferenceModal.tsx, loaded on demand) shows these.
 */
import { TableType } from '../types';
import { BANK_IDS } from '../data/banks';
import { EQUIPMENT_TIER_MAX } from './rules';
import {
  SKILLS_LIST, EQUIPMENT_SLOTS, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST,
  ROLLABLE_POH_ITEMS, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, ROLLABLE_STORAGE_ITEMS,
  GUILDS_LIST, FARMING_PATCH_LIST, SLAYER_UNLOCKS_LIST,
} from '../data/items';
import { COMBAT_POWERS_DESCRIPTION, COMBAT_POWERS_LABEL } from '../utils/tableDisplay';
import {
  andList, CHAOS_PICK_TEXT, CHUNKED_CHAOS_TEXT, CHUNKED_OMNI_LAND_TEXT, LEVEL_CHAOS_CHANCE,
  SKILL_CHAOS_MILESTONES, SKILLS_TIER_CAP, STARTING_KEYS,
} from './economy';

const WIKI = 'https://oldschool.runescape.wiki/images/';

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
    spend: `Click a locked skill, gear slot, area, boss or other entry on the Dashboard to unlock exactly that. ${CHUNKED_OMNI_LAND_TEXT}`,
  },
  {
    id: 'chaos',
    name: 'Chaos Key',
    icon: `${WIKI}Eternal_crystal.png`,
    accent: 'text-red-400',
    tagline: 'One random unlock from any table.',
    earn: [
      `Guaranteed at skill levels ${andList(SKILL_CHAOS_MILESTONES)}: ${SKILL_CHAOS_MILESTONES.length} per skill.`,
      `A separate ${LEVEL_CHAOS_CHANCE}% chance on every level-up, milestones included.`,
      'The Ritual of Chaos turns Fate Points into one.',
    ],
    spend: `${CHAOS_PICK_TEXT} Outside Chunked, places you can't reach yet can come up too. ${CHUNKED_CHAOS_TEXT}`,
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
