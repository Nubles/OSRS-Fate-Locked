
import type { GameModeRules } from './config/gameModes';

export enum DropSource {
  QUEST_NOVICE = 'Quest (Novice)',
  QUEST_INTERMEDIATE = 'Quest (Intermediate)',
  QUEST_EXPERIENCED = 'Quest (Experienced)',
  QUEST_MASTER = 'Quest (Master)',
  QUEST_GRANDMASTER = 'Quest (Grandmaster)',
  CA_EASY = 'Combat Achievement (Easy)',
  CA_MEDIUM = 'Combat Achievement (Medium)',
  CA_HARD = 'Combat Achievement (Hard)',
  CA_ELITE = 'Combat Achievement (Elite)',
  CA_MASTER = 'Combat Achievement (Master)',
  CA_GRANDMASTER = 'Combat Achievement (Grandmaster)',
  LEVEL_UP = 'Level Up',
  COLLECTION_LOG = 'Collection Log',
  DIARY_EASY = 'Diary (Easy)',
  DIARY_MEDIUM = 'Diary (Medium)',
  DIARY_HARD = 'Diary (Hard)',
  DIARY_ELITE = 'Diary (Elite)',

  // Specific Slayer Tiers
  SLAYER_BEGINNER = 'Slayer (Turael/Spria)',
  SLAYER_MAZCHNA = 'Slayer (Mazchna)',
  SLAYER_VANNAKA = 'Slayer (Vannaka)',
  SLAYER_CHAELDAR = 'Slayer (Chaeldar)',
  SLAYER_KONAR = 'Slayer (Konar)',
  SLAYER_NIEVE = 'Slayer (Nieve/Steve)',
  SLAYER_KRYSTILIA = 'Slayer (Krystilia)',
  SLAYER_DURADEL = 'Slayer (Duradel/Kuradal)',
  SLAYER_BOSS = 'Slayer (Boss Task)',

  CLUE_BEGINNER = 'Clue Scroll (Beginner)',
  CLUE_EASY = 'Clue Scroll (Easy)',
  CLUE_MEDIUM = 'Clue Scroll (Medium)',
  CLUE_HARD = 'Clue Scroll (Hard)',
  CLUE_ELITE = 'Clue Scroll (Elite)',
  CLUE_MASTER = 'Clue Scroll (Master)',

  // Repeatable endgame faucets — roll per completion of the content. Bosses are
  // rolled per-encounter (see data/bossKeyTiers) by difficulty tier; raids share
  // the top boss rate; minigames and pets are flat.
  BOSS_LOW = 'Boss (Low)',
  BOSS_MID = 'Boss (Mid)',
  BOSS_HIGH = 'Boss (High)',
  RAID = 'Raid',
  ACTIVITY_MINIGAME = 'Activity (Minigame)',
  PET = 'Pet Drop',

  CUSTOM = 'Custom',
}
export type FateCompensationChoice = 'none' | 'chaos' | 'full';

export type FateCompensationStatus =
  | 'pending'
  | 'not_eligible'
  | FateCompensationChoice;

export interface FateCompensationState {
  releaseId: string;
  status: FateCompensationStatus;
  chaosKeys: number;
  pityKeys: number;
  fatePoints: number;
  choice?: FateCompensationChoice;
}



/** Fate awarded when a key roll fails. */
export type FailureFateAward = 1 | 2 | 3;
export enum TableType {
  EQUIPMENT = 'Equipment',
  SKILLS = 'Skills',
  REGIONS = 'Regions',
  MOBILITY = 'Mobility',
  ARCANA = 'Arcana',
  POH = 'Housing',
  MERCHANTS = 'Merchants',
  MINIGAMES = 'Minigames',
  BOSSES = 'Bosses',
  STORAGE = 'Storage',
  GUILDS = 'Guilds',
  FARMING_LAYERS = 'Farming Patches',
  AGILITY_COURSES = 'Agility Courses',
  SLAYER_UNLOCKS = 'Slayer Unlocks',
  /** Chunked mode only — one map-region chunk at a time, adjacent to the unlocked set. */
  CHUNKS = 'Chunks',
  QUESTS = 'Quests',
  DIARIES = 'Diaries',
  COMBAT_ACHIEVEMENTS = 'Combat Achievements',
  /** Bank-locked modes only — each bankable location is its own unlock. */
  BANKS = 'Banks',
}

export interface LogEntry {
  id: string;
  timestamp: number;
  // The reducer emits ROLL_SUCCESS / ROLL_OMNI / ROLL_FAIL / PITY for roll
  // outcomes; the bare 'ROLL' literal was a footgun (consumers filtered for
  // it expecting all rolls and got nothing). Use isRollEntry() in utils
  // instead of comparing to 'ROLL'.
  type: 'UNLOCK' | 'PITY' | 'ALTAR' | 'ROLL_SUCCESS' | 'ROLL_FAIL' | 'ROLL_OMNI' | 'LEVEL_UP' | 'XTREME_MILESTONE' | 'COMPENSATION';
  source?: string;
  result?: 'SUCCESS' | 'FAIL';
  rollValue?: number;
  baseThreshold?: number;
  threshold?: number;
  message: string;
  details?: string;
  // Loosely typed to accommodate varied event metadata across roll, unlock, ritual, and level-up events.
  // Tightening this to a discriminated union would require changes across 20+ component files.
  meta?: Record<string, any>;
  prevHash?: string;
  hash?: string;
}

export interface RollIntent {
  source: string;
  threshold: number;
  failureFate: FailureFateAward;
  target: string;
}

export interface GameEventMeta {
  fateEventId?: string;
  detectorId?: string;
  detectorVersion?: number;
}

export interface DetectedEventIdentity {
  runId: string;
  account: string;
  runRevision: number;
}

export type DetectedProgress =
  | { kind: 'SKILL_LEVEL'; skill: string; level: number }
  | { kind: 'QUEST'; questId: string }
  | { kind: 'CA_TASK'; taskId: string }
  | { kind: 'DIARY_TASK'; taskId: string }
  | { kind: 'COLLECTION_ITEM'; itemId: number }
  | { kind: 'NONE' };

export interface EventCandidate {
  label: string;
  target: string;
}

export type EventClassification =
  | { state: 'READY'; intent: RollIntent; progress: DetectedProgress }
  | { state: 'NEEDS_CONFIRMATION'; reason: string; candidates?: EventCandidate[] }
  | { state: 'BLOCKED'; reason: string; candidates?: EventCandidate[] }
  | { state: 'DUPLICATE'; reason: string; candidates?: EventCandidate[] };

export interface UnlockState {
  equipment: Record<string, number>; // Store Tier level (0-9)
  skills: Record<string, number>; // Name -> Tier (1-10)
  levels: Record<string, number>; // Name -> Current Level (1-99)
  regions: string[];
  /**
   * Chunked mode only — individual unlocked map-region chunks, keyed "cx,cy".
   * Optional (defaults to []) so the many UnlockState fixtures across the test
   * suite, written before this mode existed, don't all need updating.
   */
  chunks?: string[];
  mobility: string[];
  arcana: string[];
  housing: string[];
  merchants: string[];
  minigames: string[];
  bosses: string[];
  storage: string[];
  guilds: string[];
  farming: string[];
  slayerUnlocks: string[];
  /**
   * Bank-locked modes only (rules.bankLocks) — unlocked bank locations, keyed
   * by canonical chunk id "cx*256+cy" (see data/banks.ts). Optional so existing
   * saves/fixtures without it default to []; ignored when bankLocks is off.
   */
  banks?: string[];
  quests: string[]; // List of completed Quest IDs
  diaries: string[]; // List of completed Diary IDs (e.g. "Ardougne Easy")
  cas: string[]; // List of completed CA tiers (e.g. "Easy")
  completedTasks: string[]; // Individual Task IDs
  collectionLog: Record<number, number>; // ItemID -> Count
}

export interface GameState {
  /** Canonical reducer states are stamped at the strict save boundary. */
  version: number;
  /** Stable identity for one run across exports, restarts, and relay delivery. */
  runId: string;
  /** Monotonic revision of persistent run state. */
  runRevision: number;
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  /** Vanilla boss standard keys already awarded, by canonical boss name. */
  bossStandardKeysAwarded?: Record<string, number>;
  /** Vanilla clue standard keys already awarded across every clue tier. */
  clueStandardKeysAwarded?: number;
  fatePoints: number;
  /** Frozen one-time offer for the weighted-Fate balance release. */
  fateCompensation: FateCompensationState;
  activeBuff: 'NONE' | 'LUCK' | 'GREED';
  unlocks: UnlockState;
  history: LogEntry[];
  animationsEnabled?: boolean;
  /** Show the advisor / recommendation panels across the app (default off). */
  advisorsEnabled?: boolean;
  /**
   * Progressive-disclosure escape hatch: when true, every gated surface
   * (dashboard tabs, header tools) is visible regardless of run milestones —
   * see utils/featureGates.ts. Default off; mature runs auto-graduate anyway
   * because the gates derive from game state.
   */
  revealAllFeatures?: boolean;
  hasSeenOnboarding?: boolean;
  pinnedGoals: string[]; // IDs from STRATEGY_DATABASE
  userNotes: Record<string, string>; // ID -> Note Content
  gameModeId?: string; // selected game mode
  customMode?: GameModeRules; // ruleset when gameModeId === 'custom'
  gameModeLocked?: boolean; // true once a mode has been chosen — permanent for the account
  /**
   * Seeded runs: when set, every gameplay outcome derives from
   * hash(rngSeed, newest history hash, purpose) — see utils/seededRng.ts.
   * Chosen at run start (weekly seed, custom phrase, or random) and locked
   * once the run has history. Undefined = classic Math.random play.
   */
  rngSeed?: string;
  loadout?: Record<string, number>; // equipment slot -> real item id (Gear mode)
  rival?: RivalState; // Rival Ghost the player is racing (optional)
  /** OSRS account this run is bound to (Auto-Roll). Set once, then permanent. */
  linkedAccount?: string;
  /**
   * Xtreme Start anti-softlock insurance: how many 50-total-level milestones
   * have already paid out a guaranteed key. Only accrues while gameModeId is
   * 'xtreme' AND unlocks.regions is still empty (no extra region unlocked yet)
   * — see XTREME_MILESTONE_INTERVAL in config/economy.ts. Stops mattering the
   * moment the run breaks out of Lumbridge, so it never touches the normal
   * key economy for any other mode.
   */
  xtremeMilestoneClaimed?: number;
  /** Same insurance as xtremeMilestoneClaimed, for the 'chunked' mode — see CHUNKED_MILESTONE_INTERVAL. */
  chunkedMilestoneClaimed?: number;
}

/** A simulated nemesis ('sim') or a friend's run snapshot ('friend') to race. */
export interface RivalState {
  mode: 'sim' | 'friend';
  personaId: string;
  name: string;
  emoji: string;
  keysPerDay: number; // simulated tempo (0 for friend snapshots)
  seed: number;
  startedAt: number;
  /** Player − rival completion at the last time the player checked (for taunts). */
  lastSeenLead?: number;
  /** Friend snapshot completion %, when mode === 'friend'. */
  friendPct?: number;
  friendName?: string;
}

// --- Profile System ---
export interface Profile {
  id: string;
  name: string;
  createdAt: number;
}

export interface ProfileMetadata {
  profiles: Profile[];
  activeProfileId: string;
}
