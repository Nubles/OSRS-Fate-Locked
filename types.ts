
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
  CUSTOM = 'Custom',
}

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
  AGILITY_SHORTCUTS = 'Agility Shortcuts',
  QUESTS = 'Quests',
  DIARIES = 'Diaries',
  COMBAT_ACHIEVEMENTS = 'Combat Achievements',
}

export interface LogEntry {
  id: string;
  timestamp: number;
  // The reducer emits ROLL_SUCCESS / ROLL_OMNI / ROLL_FAIL / PITY for roll
  // outcomes; the bare 'ROLL' literal was a footgun (consumers filtered for
  // it expecting all rolls and got nothing). Use isRollEntry() in utils
  // instead of comparing to 'ROLL'.
  type: 'UNLOCK' | 'PITY' | 'ALTAR' | 'ROLL_SUCCESS' | 'ROLL_FAIL' | 'ROLL_OMNI' | 'LEVEL_UP';
  source?: string;
  result?: 'SUCCESS' | 'FAIL';
  rollValue?: number;
  threshold?: number;
  message: string;
  details?: string;
  // Loosely typed to accommodate varied event metadata across roll, unlock, ritual, and level-up events.
  // Tightening this to a discriminated union would require changes across 20+ component files.
  meta?: Record<string, any>;
  prevHash?: string;
  hash?: string;
}

export interface UnlockState {
  equipment: Record<string, number>; // Store Tier level (0-9)
  skills: Record<string, number>; // Name -> Tier (1-10)
  levels: Record<string, number>; // Name -> Current Level (1-99)
  regions: string[];
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
  agilityShortcuts: string[];
  quests: string[]; // List of completed Quest IDs
  diaries: string[]; // List of completed Diary IDs (e.g. "Ardougne Easy")
  cas: string[]; // List of completed CA tiers (e.g. "Easy")
  completedTasks: string[]; // Individual Task IDs
  collectionLog: Record<number, number>; // ItemID -> Count
}

export interface GameState {
  version?: number;
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  activeBuff: 'NONE' | 'LUCK' | 'GREED';
  unlocks: UnlockState;
  history: LogEntry[];
  animationsEnabled?: boolean;
  hasSeenOnboarding?: boolean;
  pinnedGoals: string[]; // IDs from STRATEGY_DATABASE
  userNotes: Record<string, string>; // ID -> Note Content
  gameModeId?: string; // selected game mode
  customMode?: GameModeRules; // ruleset when gameModeId === 'custom'
  gameModeLocked?: boolean; // true once a mode has been chosen — permanent for the account
  loadout?: Record<string, number>; // equipment slot -> real item id (Gear mode)
  rival?: RivalState; // Rival Ghost the player is racing (optional)
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
