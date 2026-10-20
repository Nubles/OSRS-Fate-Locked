
import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { PendingUnlockReveal } from '../components/PendingUnlockReveal';
import { GameState, LogEntry, UnlockState, DropSource, TableType, RivalState, type DetectedEventIdentity, type DetectedProgress, type FailureFateAward, type FateCompensationChoice, type PetCompensationChoice, type GameEventMeta as DetectedGameEventMeta, type RollAnalyticsMeta, type RollIntent } from '../types';
import { EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST } from '../data/items';
import { DROP_RATES, EQUIPMENT_TIER_MAX } from '../config/rules';
import { usesActivityKeyReserves, resolveModeRules, DEFAULT_MODE_ID } from '../config/gameModes';
import { setStartArea } from '../utils/freeAreas';
import type { GameModeRules } from '../config/gameModes';
import { getActiveRegionBonuses } from '../config/regionModifiers';
import { exploreBlocker, withExploreStart } from '../utils/chunkExplore';
import { leanTowardThread, withFateLand } from '../utils/fateLand';
import { achievementBoostFor } from '../utils/achievementBoosts';
import { failureFateForSkillLevel, failureFateForSource, getRitual, isSkillChaosMilestone, ritualFateCost, XTREME_MILESTONE_INTERVAL, BREAKTHROUGH_CHANCE, GREED_REFUND_FRACTION, gambitKeys, STARTING_KEYS } from '../config/economy';
import { BANK_BY_ID } from '../data/banks';
import { BARROWS_BROTHERS, INVOCATIONS, SACRIFICE_TIERS, WARD_COOLDOWN_ROLLS, invocationAllowed, SACRIFICE_USES_PER_RUN, type BarrowsBrother, type Invocation, type Ritual } from '../config/economy';
import {
  afterRoll, applyOddsBonus, castBarrows, castInvocations, castPact, castTears, failFate,
  pickSacrifice, ritualAvailability, rollRitualActive, rollRitualPlan, sacrificeCandidates, tidyRituals, wardApplies,
  type RitualState, type SacrificeTier,
} from '../utils/ritualEffects';
import { tableDisplayName } from '../utils/tableDisplay';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { CA_DATA } from '../data/caData';
import { ALL_CA_TASKS, CATask } from '../data/caTasks';
import { QUEST_DATA } from '../data/questData';
import { breakthroughTier, chunkedCATaskBlocker, levelPastTierCap, mercyBlocker, mercyPool, tierCap } from '../utils/chunkedFate';
import { chunkLabelWithCoords } from '../utils/chunkLabelWithCoords';
import { tierBand } from '../utils/skillTiers';
import { CHUNKED_START_KEY, chunkKey as chunkKeyOf, isFrontierChunk } from '../utils/chunkAdjacency';
import { drawCartographerOffer, liveCartographerOffer } from '../utils/cartographerOffer';
import { loadWalkSections } from '../utils/walkSections';
import { UNLOCK_COST, randomUnlockPool, pickRandomPoolEntry, isRandomUnlockEligible, isValidUnlock } from '../utils/gameEngine';
import { canonicalAreaName, canonicalizeAreaUnlocks, visibleAreaUnlocks } from '../data/areaMapPolicy';
import { drawFloat, runDrawFloat, seededContext } from '../utils/seededRng';
import { importWithRetry } from '../utils/lazyRetry';
import { hashEntry, ensureChain } from '../utils/integrity';
import {
  getBackupDataById,
  listBackups as readBackups,
  pushBackup,
  type BackupMeta,
} from '../utils/backups';
import {
  applyValidatedReplacementAsync,
  applyValidatedReplacement,
  prepareReplacement,
  replacementStaleResult,
  serializeCurrent as serializeGameState,
  SaveAuthorizationError,
  SaveOwnershipConflictError,
  saveAuthorizationFailureResult,
  type BackupWriteResult,
  type ImportResult,
} from '../utils/gamePersistence';
import { CURRENT_SAVE_VERSION, MAX_COUNTER, parseAndMigrateSave, validateAndMigrateSave, type SaveValidationResult } from '../utils/saveSchema';
import { readRestoreCounts, rememberRun, stampRestoreCount, writeRestoreCounts, type RestoreKind } from '../utils/restoreCount';
import { AchievementPayout, pickFreeRitual, settleAchievements } from '../utils/achievementRewards';
import { emptyRuneProofProgress, migrateLocalRuneProofProgress, updateRuneProofProgress, type RuneProofMutation } from '../utils/runeProofProgress';
import { checksumSave } from '../utils/saveIntegrity';
import { openRecoveryDatabase } from '../utils/recoveryDatabase';
import type {
  RecoveryCheckpointReason,
  RecoveryRepository,
  SaveDurabilitySnapshot,
  SaveRetryResult,
} from '../utils/recoveryTypes';
import { createSaveCoordinator, type SaveCoordinator } from '../utils/saveCoordinator';
import { migrateLegacyBackupRing } from '../utils/legacyBackupMigration';
import { profileBackupKey } from '../utils/profileStorage';
import { showToast } from '../utils/toast';
import { LEGACY_FATE_COMPENSATION_ID } from '../utils/fateCompensation';
import {
  gambitStakeFor,
  keysToWithhold,
  notEligiblePetCompensation,
  PET_COMPENSATION_ID,
  petCompensationResult,
  validCompensationPets,
} from '../utils/petCompensation';
import { isPetId } from '../data/petIds';
import { normalizeAccountName } from '../utils/accountName';
import { collectionItemNeedsIdentityReview, emptyCollectionLogIdentity } from '../services/CollectionLogSyncService';
import {
  canEarnDiaryTier,
  diaryTaskCompletionDecision,
  questCompletionDecision,
  withJournalCompletion,
} from '../utils/journalCompletion';
import type { CompletionAttestation, CompletionResult } from '../utils/journalCompletion';
import {
  caTaskCompletionDecision,
  caTierCompletionDecision,
  completedCAPoints,
  newlyEarnedCATiers,
} from '../utils/caProgress';
import {
  formatKeyPercent,
  formatKeyRollValue,
  normalizePercent,
  resolveKeyRoll,
  skillLevelKeyChance,
} from '../utils/keyRoll';
import { effectiveVanillaClueRate, isKnownVanillaMinigame, MINIGAME_MISS_FATE_MIN_RATE, minigameMissPaysFate, vanillaBossKeyStage, vanillaMinigameKeyStage, type KeyReserveStage } from '../config/vanillaKeyEconomy';
import type { KeyRollContext } from '../config/vanillaKeyEconomy';
import {
  blockPendingSave,
  discardPendingSave,
  flushPendingSave,
  getPendingSave,
  getPendingSaveRevision,
  getSaveStatus,
  stagePendingSave,
  subscribePendingSaves,
  type SaveStatus,
} from '../utils/pendingSaves';
import {
  useProfileWriterLease,
  type ProfileWriterLeaseOptions,
} from '../hooks/useProfileWriterLease';
import {
  isOwnershipConflictBlock,
  type SaveOwnershipBlockReason,
  type SaveOwnershipStatus,
  type SaveWriteAuthorization,
} from '../utils/profileWriterLease';
import type { SaveBootstrapResult } from '../components/SaveBootstrap';


// --- Types ---
const SAVE_DEBOUNCE_MS = 500;
const RECOVERY_CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000;

export const writeReplacementNow = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
  data: string,
  pendingSave: { current: number | null },
  cancelPending: (handle: number) => void,
  authorizeWrite: () => SaveWriteAuthorization,
): void => {
  const authorization = authorizeWrite();
  if (authorization.ok === false) {
    if (authorization.reason === 'ownership_conflict') throw new SaveOwnershipConflictError();
    throw new SaveAuthorizationError(authorization.reason);
  }
  storage.setItem(storageKey, data);
  if (pendingSave.current === null) return;
  cancelPending(pendingSave.current);
  pendingSave.current = null;
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
};

type RunIdRandomSource = {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
};

const uuidFromBytes = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const newRunId = (source: RunIdRandomSource | undefined = globalThis.crypto): string => {
  if (source?.randomUUID) return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (source?.getRandomValues) source.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  return uuidFromBytes(bytes);
};

export const newRunIdForTest = (source: RunIdRandomSource): string => newRunId(source);

const completionFailure = (reason: string): CompletionResult => {
  showToast(reason);
  return { ok: false, reason };
};

type RollEventMeta = { roll: number; baseThreshold: number; threshold: number };
type UnlockEventMeta = { item: string; cost: number; category?: TableType };
type RitualEventMeta = {
  type: Ritual['id']; won?: boolean; stake?: number; keysWon?: number; chunk?: string;
  /** For the newer rituals' scenes: the handicaps picked, the brother drawn, the tiers taken. */
  invocations?: Invocation['id'][]; brother?: BarrowsBrother['id']; taken?: SacrificeTier[]; usesLeft?: number;
};
type LevelUpEventMeta = { skill: string; level: number; totalLevel: number; chaosKeysAwarded: number; chaosKeyAwarded: boolean };

type GameEventMeta = (RollEventMeta & DetectedGameEventMeta) | UnlockEventMeta | RitualEventMeta | LevelUpEventMeta;

type GameEvent = {
  id: string;
  type: 'ROLL_SUCCESS' | 'ROLL_FAIL' | 'ROLL_OMNI' | 'ROLL_PITY' | 'UNLOCK' | 'RITUAL' | 'LEVEL_UP' | 'PET';
  x?: number;
  y?: number;
  meta?: GameEventMeta;
};

/** What the player said an earlier pet roll was: a pet, or null for not a new pet. */
export type PetChoice = { id: number; name: string } | null;

interface GameContextType extends GameState {
  lastEvent: GameEvent | null;
  saveStatus: SaveStatus;
  saveOwnershipStatus: SaveOwnershipStatus;
  saveOwnershipBlockReason: SaveOwnershipBlockReason;
  hasPendingChanges: boolean;
  saveDurability: SaveDurabilitySnapshot;
  /**
   * Wholesale run replacements (import, sync code, restore, reload, reset)
   * this session. History watchers compare it to tell a replaced history
   * from one that grew.
   */
  stateReplacements: number;
  retrySave: () => SaveRetryResult | Promise<SaveRetryResult>;
  stageForProfileEviction: () => void;
  takeOverSaveOwnership: () => Promise<boolean>;
  reloadLatestSave: () => ImportResult;
  rollForKey: (
    source: string,
    threshold: number,
    failureFate: FailureFateAward,
    x?: number,
    y?: number,
    meta?: DetectedGameEventMeta,
    context?: KeyRollContext,
  ) => void;
  acceptDetectedEvent: (
    progress: DetectedProgress,
    intent: RollIntent,
    meta: DetectedGameEventMeta,
    expected: DetectedEventIdentity,
  ) => boolean;
  unlockContent: (table: TableType, item: string, costType: 'key' | 'specialKey' | 'chaosKey', cost: number) => void;
  rollUnlock: (table?: TableType) => void;
  acknowledgeUnlock: (id: string) => void;
  performRitual: (type: 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE') => void;
  performGambit: () => void;
  /** The Cartographer's kept offer (drawn by fate the first time), as chunk keys. */
  drawCartographerChoices: () => string[];
  performCartographer: (chunkKey: string, label: string) => void;
  /** The newer Void Altar rituals. Invocations take the handicaps the player picked. */
  castRitual: (id: NewRitualId, invocations?: Invocation['id'][]) => void;
  /** Chunked: roll a waiting Breakthrough for a capped skill (utils/chunkedFate.ts). */
  rollBreakthrough: (skill: string) => void;
  /**
   * Chunked: Fate's Mercy, a random chunk or skill tier when the run has nothing left.
   * The provider lists the quests the run's chunks let it do now from the chunk
   * content (Mercy stays shut while there are any) and draws the roll itself.
   */
  callOnFate: () => void;
  /** Chunked: roll for the first time doing a thing in a newly unlocked chunk. */
  exploreChunk: (chunk: string, fact: string, x?: number, y?: number) => void;
  /** Chunked: a Gilded chunk's free Key roll (utils/fateLand.ts). */
  rollGilded: (chunk: string, x?: number, y?: number) => void;
  levelUpSkill: (skill: string) => void;
  toggleAnimations: () => void;
  toggleAdvisors: () => void;
  toggleRevealAll: () => void;
  completeOnboarding: () => void;
  resolveFateCompensation: (choice: FateCompensationChoice) => void;
  /** Settle the pet offer: one pet named for each earlier pet roll, and how to even it out. */
  resolvePetCompensation: (
    choice: PetCompensationChoice,
    keyOnly: ReadonlyArray<PetChoice>,
    omni: ReadonlyArray<PetChoice>,
  ) => void;
  /** A new pet: its Omni-Key, once per pet. It isn't a roll, so Fate and rituals stay as they are. */
  claimPet: (pet: { id: number; name: string }, x?: number, y?: number) => void;
  /** Pay newly earned achievements once (a run from before rewards gets one back pay for what it has). `earned` is every earned achievement. */
  settleAchievements: (earned: AchievementPayout[]) => void;
  /** Wear an earned achievement as the run's title, or null to take it off. */
  setAchievementTitle: (id: string | null) => void;
  setGameMode: (modeId: string, customRules?: GameModeRules) => void;
  /** Seeded runs — set/clear the seed (only while the run has no history). */
  setSeed: (seed: string) => void;
  /**
   * Gameplay RNG choke point. On a seeded run this derives from
   * (rngSeed, versioned history context, purpose, index) — deterministic and
   * replayable; an unseeded run draws the same way from its hidden salt
   * (GameState.rngSalt), so a restore cannot re-roll. EVERY gameplay outcome
   * (rolls, table picks, gambles) must draw through here, never Math.random
   * directly — that's what makes seeded runs raceable and verifiable.
   * Visual-only randomness (particles, animation jitter) is exempt.
   */
  nextFloat: (purpose: string, index?: number) => number;
  importSave: (data: unknown) => Promise<ImportResult>;
  resetGame: () => Promise<void>;
  /** Snapshot the current run before something overwrites it. */
  createBackup: (reason: string) => BackupWriteResult | Promise<BackupWriteResult>;
  /** Backups for the active profile, newest first. */
  listBackups: () => Promise<BackupMeta[]>;
  /** Restore a backup by stable id (snapshots the current run first). */
  restoreBackup: (id: string | number) => Promise<ImportResult>;
  togglePin: (id: string) => void;
  saveNote: (id: string, text: string) => void;
  updateRuneProof: (expectedRunId: string, change: RuneProofMutation) => boolean;
  completeQuest: (id: string, x?: number, y?: number, attestation?: CompletionAttestation) => CompletionResult;
  completeDiaryTask: (id: string, x?: number, y?: number, attestation?: CompletionAttestation) => CompletionResult;
  completeDiaryTier: (id: string) => CompletionResult;
  completeCATask: (id: string, x?: number, y?: number) => CompletionResult;
  completeCATier: (id: string) => CompletionResult;
  logCollectionItem: (itemId: number) => void;
  getExportData: () => string;
  /** Equip (or clear, with itemId=null) a real item in a slot; optionally clear other slots (2h handling). */
  setLoadoutSlot: (slot: string, itemId: number | null, clearSlots?: string[]) => void;
  setLinkedAccount: (account: string) => void;
  /** Change the linked character's name, as after an OSRS name change. */
  renameLinkedAccount: (from: string, to: string) => void;
  /** Rival Ghost controls. */
  setRival: (rival: RivalState) => void;
  clearRival: () => void;
  ackRival: (lead: number) => void;
}

// --- Initial State ---
const getInitialUnlocks = (): UnlockState => ({
  equipment: EQUIPMENT_SLOTS.reduce((acc, slot) => ({ ...acc, [slot]: 0 }), {} as Record<string, number>),
  skills: { 'Hitpoints': 1 },
  levels: SKILLS_LIST.reduce((acc, skill) => ({
    ...acc,
    [skill]: skill === 'Hitpoints' ? 10 : 1
  }), {} as Record<string, number>),
  regions: [],
  chunks: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  banks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {}
});

export const initialState: GameState = {
  collectionLogIdentity: emptyCollectionLogIdentity(),
  runeProofProgress: emptyRuneProofProgress(),
  version: CURRENT_SAVE_VERSION,
  areaUnlockRevision: 1,
  runId: newRunId(),
  rngSalt: newRunId(),
  runRevision: 0,
  keys: STARTING_KEYS,
  specialKeys: 0,
  chaosKeys: 0,
  fatePoints: 0,
  fateCompensation: {
    releaseId: LEGACY_FATE_COMPENSATION_ID,
    status: 'not_eligible',
    chaosKeys: 0,
    pityKeys: 0,
    fatePoints: 0,
  },
  petCompensation: notEligiblePetCompensation(),
  activeBuff: 'NONE',
  unlocks: getInitialUnlocks(),
  history: [],
  bossStandardKeysAwarded: {},
  minigameStandardKeysAwarded: {},
  clueStandardKeysAwarded: 0,
  animationsEnabled: true,
  advisorsEnabled: false,
  hasSeenOnboarding: false,
  pinnedGoals: [],
  userNotes: {},
  gameModeId: DEFAULT_MODE_ID,
  gameModeLocked: false,
  loadout: {},
};

export const createFreshState = (): GameState => ({
  ...initialState,
  collectionLogIdentity: emptyCollectionLogIdentity(),
  runeProofProgress: emptyRuneProofProgress(),
  unlocks: getInitialUnlocks(),
  history: [],
  pinnedGoals: [],
  userNotes: {},
  loadout: {},
  runId: newRunId(),
  // The run's hidden salt: its draws without a seed (see GameState.rngSalt).
  rngSalt: newRunId(),
  runRevision: 0,
  // A new run is paid for every achievement it earns (see GameState).
  achievementsClaimed: [],
});

// --- Reducer ---
interface PreparedRollResult {
  success: boolean;
  omni: boolean;
  pity: boolean;
  roll: number;
  baseThreshold: number;
  threshold: number;
  source: string;
  failureFate: FailureFateAward;
  x?: number;
  y?: number;
  meta?: DetectedGameEventMeta;
  context?: KeyRollContext;
  /** What the run's rituals did to this roll, decided when it was prepared. */
  ritual?: PreparedRitualRoll;
}

interface PreparedRitualRoll {
  /** Percentage points the rituals added to (or took from) the odds. */
  oddsBonus: number;
  /** A fail that Verac hit through into a success. */
  hitThrough?: boolean;
  /** Karil's second Key on a success. */
  secondKey?: boolean;
}

/** The rituals cast through castRitual rather than performRitual. */
export type NewRitualId = Extract<Ritual['id'], 'WARD' | 'TEARS' | 'PACT' | 'INVOCATIONS' | 'BARROWS' | 'SACRIFICE'>;

export type Action =
  | { type: 'UPDATE_RUNEPROOF'; payload: { expectedRunId: string; change: RuneProofMutation } }
  | { type: 'LOAD_SAVE'; payload: GameState }
  | { type: 'RESET' }
  | { type: 'TOGGLE_ANIMATIONS' }
  | { type: 'TOGGLE_ADVISORS' }
  | { type: 'TOGGLE_REVEAL_ALL' }
  | { type: 'SET_SEED'; payload: string }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'RESOLVE_FATE_COMPENSATION'; payload: FateCompensationChoice }
  | {
    type: 'RESOLVE_PET_COMPENSATION';
    payload: {
      choice: PetCompensationChoice;
      /** Each earlier roll that paid only a Key, oldest first: the pet, or null for not a new pet. */
      keyOnly: Array<number | null>;
      /** Each earlier roll that also brought an Omni-Key, the same way. */
      omni: Array<number | null>;
      /** The named pets' names, in that order, for the history. */
      petNames: string[];
    };
  }
  | { type: 'CLAIM_PET'; payload: { petId: number; petName: string; x?: number; y?: number; meta?: DetectedGameEventMeta } }
  | { type: 'SETTLE_ACHIEVEMENTS'; payload: AchievementPayout[] }
  | { type: 'SET_ACHIEVEMENT_TITLE'; payload: string | null }
  | {
    type: 'ACCEPT_DETECTED_PET';
    payload: {
      petId: number;
      petName: string;
      meta: DetectedGameEventMeta;
      expected: DetectedEventIdentity;
      /** The run's revision when the player confirmed the pet: it lands only on that state. */
      preparedRevision: number;
    };
  }
  | { type: 'ROLL_RESULT'; payload: PreparedRollResult }
  | {
    type: 'ACCEPT_DETECTED_EVENT';
    payload: {
      progress: DetectedProgress;
      rollResult: PreparedRollResult;
      expected: DetectedEventIdentity;
      /** The run's revision when the roll was prepared: it lands only on that state. */
      preparedRevision: number;
      skillChaos?: {
        chaosKeysAwarded: number;
        guaranteedChaosKeysAwarded: number;
        randomChaosKeysAwarded: number;
      };
    };
  }
  | { type: 'SYNC_DETECTED_PROGRESS'; payload: DetectedProgress }
  | { type: 'UNLOCK'; payload: { table: TableType; item: string; costType: 'key' | 'specialKey' | 'chaosKey'; /** Not read: every spend costs UNLOCK_COST. */ cost: number; /** A fate-drawn spend (rollUnlock); without one only an Omni-Key may name the item. */ revealId?: string; /** Drawn under Saradomin's Ward. */ ward?: boolean } }
  | { type: 'ACKNOWLEDGE_UNLOCK'; payload: string }
  | { type: 'RITUAL_LUCK' }
  | { type: 'RITUAL_GREED' }
  | { type: 'RITUAL_CHAOS' }
  | { type: 'RITUAL_TRANSMUTE' }
  | { type: 'RITUAL_GAMBIT'; payload: { won: boolean; stake: number; keysWon: number } }
  | { type: 'CARTOGRAPHER_DRAW_OFFER' }
  | { type: 'RITUAL_CARTOGRAPHER'; payload: { chunkKey: string; label: string } }
  | { type: 'RITUAL_WARD' }
  | { type: 'RITUAL_TEARS' }
  | { type: 'RITUAL_PACT' }
  | { type: 'RITUAL_INVOCATIONS'; payload: { ids: Invocation['id'][] } }
  | { type: 'RITUAL_BARROWS'; payload: { brother: BarrowsBrother['id'] } }
  | { type: 'RITUAL_SACRIFICE'; payload: { taken: SacrificeTier[] } }
  // revealId: a won Breakthrough shows the unlock reveal, as a Key's unlock does.
  | { type: 'CHUNKED_BREAKTHROUGH'; payload: { skill: string; roll: number; revealId?: string } }
  // doableQuests: the quests the run's chunks let it do now. Only the panel
  // has the chunk content to work them out, so the call must bring them.
  | { type: 'CALL_ON_FATE'; payload: { roll: number; revealId: string; doableQuests: readonly string[] } }
  | { type: 'CHUNK_EXPLORE'; payload: { chunk: string; fact: string } }
  | { type: 'FATE_MARK_ROLL'; payload: { chunk: string } }
  | { type: 'LEVEL_UP'; payload: { skill: string; chaosRoll: number } }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'TOGGLE_PIN'; payload: string }
  | { type: 'UPDATE_NOTE'; payload: { id: string; text: string } }
  | { type: 'COMPLETE_QUEST'; payload: string }
  | { type: 'COMPLETE_DIARY'; payload: string }
  | { type: 'COMPLETE_CA'; payload: string }
  | { type: 'COMPLETE_TASK'; payload: string }
  | { type: 'SET_GAME_MODE'; payload: { modeId: string; customRules?: GameModeRules } }
  | { type: 'SET_LOADOUT_SLOT'; payload: { slot: string; itemId: number | null; clearSlots?: string[] } }
  | { type: 'SET_LINKED_ACCOUNT'; payload: string }
  | { type: 'RENAME_LINKED_ACCOUNT'; payload: { from: string; to: string } }
  | { type: 'SET_RIVAL'; payload: RivalState }
  | { type: 'CLEAR_RIVAL' }
  | { type: 'ACK_RIVAL'; payload: number }
  | { type: 'LOG_ITEM'; payload: number }
  | { type: 'COMMIT_STATE'; payload: GameState & { lastEvent: GameEvent | null } };

export type TransitionAction = Exclude<Action, { type: 'COMMIT_STATE' }>;

type DiceRoller = (purpose: string, index?: number, max?: number) => number;
type RollResultAction = Extract<TransitionAction, { type: 'ROLL_RESULT' }>;

// A missed roll on a low-odds minigame pays no Fate (see MINIGAME_MISS_FATE_MIN_RATE).
const missFateBase = (failureFate: number, minigameStage: KeyReserveStage | null): number =>
  minigameStage?.currentRate != null && !minigameMissPaysFate(minigameStage.currentRate) ? 0 : failureFate;

/**
 * Resolves a key roll exclusively from the supplied state snapshot.
 * The caller advances that snapshot atomically before resolving another roll.
 */
export function prepareKeyRollAction(
  state: GameState,
  source: string,
  threshold: number,
  failureFate: FailureFateAward,
  nextDice: DiceRoller,
  x?: number,
  y?: number,
  meta?: DetectedGameEventMeta,
  context?: undefined,
): RollResultAction;
export function prepareKeyRollAction(
  state: GameState,
  source: string,
  threshold: number,
  failureFate: FailureFateAward,
  nextDice: DiceRoller,
  x: number | undefined,
  y: number | undefined,
  meta: DetectedGameEventMeta | undefined,
  context: KeyRollContext,
): RollResultAction | null;
export function prepareKeyRollAction(
  state: GameState,
  source: string,
  threshold: number,
  failureFate: FailureFateAward,
  nextDice: DiceRoller,
  x?: number,
  y?: number,
  meta?: DetectedGameEventMeta,
  context?: KeyRollContext,
): RollResultAction | null {
  const vanillaBossContext = usesActivityKeyReserves(state.gameModeId) && context?.kind === 'boss'
    ? context
    : null;
  const vanillaClueContext = state.gameModeId === 'vanilla' && context?.kind === 'clue'
    ? context
    : null;
  const recordedBossAwarded = vanillaBossContext
    ? state.bossStandardKeysAwarded?.[vanillaBossContext.bossName] ?? 0
    : 0;
  const bossStage = vanillaBossContext
    ? vanillaBossKeyStage(vanillaBossContext.bossName, recordedBossAwarded)
    : null;
  const vanillaMinigameContext = usesActivityKeyReserves(state.gameModeId) && context?.kind === 'minigame'
    ? context
    : null;
  // A minigame that left the table (Rat Pits) has nothing left to pay.
  if (vanillaMinigameContext && !isKnownVanillaMinigame(vanillaMinigameContext.minigameName)) return null;
  const minigameStage = vanillaMinigameContext
    ? vanillaMinigameKeyStage(
      vanillaMinigameContext.minigameName,
      state.minigameStandardKeysAwarded?.[vanillaMinigameContext.minigameName] ?? 0,
    )
    : null;
  // A boss or a minigame: both pay from a fixed Key reserve.
  const reserveStage = bossStage ?? minigameStage;

  // Do not advance seeded RNG (or consume a buff) after a boss or minigame reserve ends.
  if (reserveStage?.capped) return null;

  const mode = resolveModeRules(state.gameModeId, state.customMode);
  let successBonus = 0;
  let omniBonus = 0;
  if (mode.regionModifiers) {
    const bonuses = getActiveRegionBonuses(state.unlocks.regions);
    successBonus = bonuses.successBonus;
    omniBonus = bonuses.omniBonus;
  }
  // Activity milestones the run has earned raise that activity's own rolls,
  // apart from Vanilla minigame reserves, which keep their own pace.
  if (!vanillaMinigameContext) successBonus += achievementBoostFor(source, state.achievementsClaimed);

  const clueAwarded = vanillaClueContext ? state.clueStandardKeysAwarded ?? 0 : 0;
  const isVanillaContext = vanillaBossContext !== null || vanillaClueContext !== null || vanillaMinigameContext !== null;
  const rollPurpose = vanillaBossContext
    ? `roll:boss:${vanillaBossContext.bossName}:${bossStage!.awarded}`
    : vanillaMinigameContext
    ? `roll:minigame:${vanillaMinigameContext.minigameName}:${minigameStage!.awarded}`
    : vanillaClueContext
      ? `roll:clue:${vanillaClueContext.clueTier}:${clueAwarded}`
      : 'roll';

  // Integer dice must land inside their float bin, not on its rounding edge.
  // Keep the old conversion for existing seeded histories to preserve their stream.
  const dieOffset = state.rngSeed && state.rngVersion !== 2 ? 1 : 0.5;
  let roll: number;
  let baseThreshold: number;
  let effectiveThreshold: number;
  let success: boolean;
  if (isVanillaContext) {
    baseThreshold = reserveStage?.currentRate
      ?? effectiveVanillaClueRate(threshold, clueAwarded);
    effectiveThreshold = normalizePercent(Math.max(0, Math.min(100, baseThreshold + successBonus)));
    const exactRoll = (index: number) => resolveKeyRoll(
      (nextDice(rollPurpose, index, 10_000) - dieOffset) / 10_000,
      effectiveThreshold,
    );
    const primary = exactRoll(0);
    const advantage = exactRoll(1);
    const selected = state.activeBuff === 'LUCK' && advantage.roll < primary.roll
      ? advantage
      : primary;
    roll = selected.roll;
    success = selected.success;
  } else {
    const rollUnitToFloat = (unit: number): number => (unit - dieOffset) / 1000;
    const result = resolveKeyRoll({
      primaryFloat: rollUnitToFloat(nextDice(rollPurpose, 0, 1000)),
      advantageFloat: rollUnitToFloat(nextDice(rollPurpose, 1, 1000)),
      baseThreshold: threshold,
      successBonus,
      luck: state.activeBuff === 'LUCK',
    });
    roll = result.roll;
    baseThreshold = result.baseThreshold;
    effectiveThreshold = result.effectiveThreshold;
    success = result.success;
  }

  // The run's rituals (Pact, Invocations, Barrows): odds first, then Verac's
  // hit-through on a miss. Extra dice are drawn only while a ritual asks.
  const plan = rollRitualPlan(state.rituals, state.fatePoints);
  if (plan.oddsBonus !== 0) {
    effectiveThreshold = normalizePercent(applyOddsBonus(effectiveThreshold, plan.oddsBonus));
    success = roll <= effectiveThreshold;
  }
  let hitThrough = false;
  if (!success && plan.hitThrough > 0 && nextDice(rollPurpose, 3) <= plan.hitThrough) {
    success = true;
    hitThrough = true;
  }

  let omni = false;
  let pity = false;
  let secondKey = false;

  if (success) {
    let omniChance = mode.omniChanceBase + omniBonus;
    if (source === DropSource.QUEST_GRANDMASTER) omniChance = Math.max(omniChance, 20);
    else if (source === DropSource.DIARY_ELITE) omniChance = Math.max(omniChance, 10);
    else if (source === DropSource.RAID) omniChance = Math.max(omniChance, 15);
    else if (source === DropSource.BOSS_HIGH) omniChance = Math.max(omniChance, 10);
    omniChance += plan.omniBonus;

    if (nextDice(rollPurpose, 2) <= omniChance) omni = true;
    if (plan.secondKey > 0 && nextDice(rollPurpose, 4) <= plan.secondKey) secondKey = true;
  } else {
    pity = failFate(state.rituals, missFateBase(failureFate, minigameStage), state.fatePoints, mode.pityEnabled, mode.pityThreshold).pity;
  }

  return {
    type: 'ROLL_RESULT',
    payload: {
      success,
      omni,
      pity,
      roll,
      baseThreshold,
      threshold: effectiveThreshold,
      source,
      failureFate,
      x,
      y,
      meta,
      context,
      ...(state.rituals ? { ritual: { oddsBonus: plan.oddsBonus, hitThrough, secondKey } } : {}),
    },
  };
}

// Whether a detected event still belongs to this run. Every roll raises the
// run's revision, so an event from an earlier revision stays this run's: the
// classifier checked it against the run as it is now. A run linked to a
// character takes only that character's events; an unlinked run takes any.
export const detectedEventIdentityMatches = (
  state: Pick<GameState, 'runId' | 'runRevision' | 'linkedAccount'>,
  expected: DetectedEventIdentity,
): boolean => state.runId === expected.runId
  && expected.runRevision <= state.runRevision
  && (!state.linkedAccount
    || normalizeAccountName(state.linkedAccount) === normalizeAccountName(expected.account));

export const prepareDetectedEventAcceptanceAction = (
  state: GameState,
  progress: DetectedProgress,
  intent: RollIntent,
  nextDice: DiceRoller,
  meta: DetectedGameEventMeta,
  expected: DetectedEventIdentity,
): Extract<TransitionAction, { type: 'ACCEPT_DETECTED_EVENT' }> => {
  const currentSkillLevel = progress.kind === 'SKILL_LEVEL'
    ? state.unlocks.levels[progress.skill] ?? 1
    : 0;
  const guaranteedChaosKeysAwarded = progress.kind === 'SKILL_LEVEL' && progress.level > currentSkillLevel
    ? Array.from({ length: Math.min(99, progress.level) - currentSkillLevel }, (_, index) => currentSkillLevel + index + 1)
      // Chunked: a milestone past the tier cap pays nothing, as a manual level-up there.
      .filter(level => isSkillChaosMilestone(level) && !levelPastTierCap(state.gameModeId, state.unlocks, progress.skill, level)).length
    : 0;
  // The 2% Chaos chance rolls once, as a manual level-up's does, and not for
  // a level past the Chunked tier cap (LEVEL_UP's rule).
  const randomChaosKeysAwarded = progress.kind === 'SKILL_LEVEL' && progress.level > currentSkillLevel
    && !levelPastTierCap(state.gameModeId, state.unlocks, progress.skill, currentSkillLevel + 1)
    && nextDice('detected-skill-chaos', 0, 100) <= 2
    ? 1
    : 0;
  const skillChaos = guaranteedChaosKeysAwarded || randomChaosKeysAwarded
    ? { chaosKeysAwarded: guaranteedChaosKeysAwarded + randomChaosKeysAwarded, guaranteedChaosKeysAwarded, randomChaosKeysAwarded }
    : undefined;

  const rollMeta = skillChaos ? { ...meta, ...skillChaos } : meta;
  // A Vanilla boss or clue roll carries its context, exactly as the Farm card
  // passes it, so the boss reserve and clue rates apply to detected events too.
  const rollAction = intent.context
    ? prepareKeyRollAction(state, intent.source, intent.threshold, intent.failureFate, nextDice, undefined, undefined, rollMeta, intent.context)
    : prepareKeyRollAction(state, intent.source, intent.threshold, intent.failureFate, nextDice, undefined, undefined, rollMeta);
  if (!rollAction) throw new Error('This boss has no Standard Keys left to award.');
  return {
    type: 'ACCEPT_DETECTED_EVENT',
    payload: { progress, rollResult: rollAction.payload, expected, preparedRevision: state.runRevision, skillChaos },
  };
};

export const prepareCATaskCompletionActions = (
  state: GameState & { lastEvent: GameEvent | null },
  task: CATask,
  nextDice: DiceRoller,
  x?: number,
  y?: number,
): {
  result: CompletionResult;
  actions: TransitionAction[];
} => {
  const decision = caTaskCompletionDecision(task, state.unlocks.completedTasks);
  if (decision.ok === false) return { result: decision, actions: [] };
  // Chunked: only at a boss in the run's chunks (exact chunks).
  const outsideChunks = chunkedCATaskBlocker(task, state.unlocks, state.gameModeId);
  if (outsideChunks) return { result: { ok: false, reason: outsideChunks }, actions: [] };
  const tier = CA_DATA[task.tierId];

  const completedIds = [...state.unlocks.completedTasks, task.id];
  const points = completedCAPoints(completedIds);
  const crossedTiers = newlyEarnedCATiers(points, state.unlocks.cas);
  return {
    result: { ok: true },
    actions: [
      { type: 'COMPLETE_TASK', payload: task.id },
      prepareKeyRollAction(
        state,
        tier.difficulty,
        DROP_RATES[tier.difficulty],
        failureFateForSource(tier.difficulty),
        nextDice,
        x,
        y,
      ),
      ...crossedTiers.map(tierId => ({
        type: 'COMPLETE_CA' as const,
        payload: tierId,
      })),
    ],
  };
};

type LevelUpAction = Extract<TransitionAction, { type: 'LEVEL_UP' }>;

/**
 * Preserve the established level reward RNG context by deciding the reward
 * before LEVEL_UP can append history, while applying it after the level state.
 * In Chunked, a level past the skill's tier cap has no reward to roll
 * (utils/chunkedFate.ts levelPastTierCap), so rewardAction is null.
 */
export const prepareLevelUpActions = (
  state: GameState,
  skill: string,
  chaosRoll: number,
  nextDice: DiceRoller,
): {
  levelAction: LevelUpAction;
  rewardAction: RollResultAction | null;
} => {
  const newLevel = (state.unlocks.levels[skill] || 1) + 1;
  const rollChance = skillLevelKeyChance(newLevel);
  const levelAction: LevelUpAction = { type: 'LEVEL_UP', payload: { skill, chaosRoll } };
  if (levelPastTierCap(state.gameModeId, state.unlocks, skill, newLevel)) return { levelAction, rewardAction: null };
  return {
    levelAction,
    rewardAction: prepareKeyRollAction(
      state,
      `${skill} Level ${newLevel}`,
      rollChance,
      failureFateForSkillLevel(newLevel),
      nextDice,
    ),
  };
};

// Wrap the raw reducer so any history entries appended during a dispatch
// are chained (prevHash + hash) before the new state is returned. This
// keeps the individual cases unchanged — they can keep push()-ing entries
// without thinking about hashing.
const chainAppendedHistory = (prev: GameState['history'], next: GameState['history']): GameState['history'] => {
  if (next === prev) return next;
  if (next.length <= prev.length) return next;
  let tailHash = 'GENESIS';
  if (prev.length > 0) {
    const lastPrev = prev[prev.length - 1];
    tailHash = lastPrev.hash ?? 'GENESIS';
  }
  // If prev had no hashes at all (legacy data mid-session), seed from ensureChain
  if (prev.length > 0 && !prev[prev.length - 1].hash) {
    const seeded = ensureChain(prev);
    tailHash = seeded[seeded.length - 1].hash ?? 'GENESIS';
    const chainedNew: GameState['history'] = [...seeded];
    for (let i = prev.length; i < next.length; i++) {
      const entry = next[i];
      const prevHash = tailHash;
      const hash = hashEntry(entry, prevHash);
      const linked = { ...entry, prevHash, hash };
      chainedNew.push(linked);
      tailHash = hash;
    }
    return chainedNew;
  }
  const out = next.slice(0, prev.length);
  for (let i = prev.length; i < next.length; i++) {
    const entry = next[i];
    if (entry.hash && entry.prevHash) {
      out.push(entry);
      tailHash = entry.hash;
      continue;
    }
    const prevHash = tailHash;
    const hash = hashEntry(entry, prevHash);
    out.push({ ...entry, prevHash, hash });
    tailHash = hash;
  }
  return out;
};

/**
 * Anti-softlock insurance for Xtreme Start runs still stuck at their start
 * (see XTREME_MILESTONE_INTERVAL in config/economy.ts): before any area is
 * unlocked, a guaranteed Key every interval of total level; deterministic,
 * not RNG. A manual level-up and a detected RuneLite level-up both pay it.
 * Chunked had its own branch (a Key every 25 total levels on the start
 * chunk) until October 2026; it was removed because a guaranteed Key whose
 * table the player picks is not fate's pick, and Fate's Mercy now covers a
 * dry start. Old saves keep their chunkedMilestoneClaimed counter, unread.
 */
const startMilestoneInsurance = (
  state: GameState,
  totalLevel: number,
  now: number,
): Pick<GameState, 'keys'> & {
  xtremeMilestoneClaimed: number;
  entries: LogEntry[];
} => {
  let keys = state.keys;
  const entries: LogEntry[] = [];
  let xtremeMilestoneClaimed = state.xtremeMilestoneClaimed ?? 0;
  if (state.gameModeId === 'xtreme' && visibleAreaUnlocks(state.unlocks.regions).length === 0) {
    const eligible = Math.floor(totalLevel / XTREME_MILESTONE_INTERVAL);
    if (eligible > xtremeMilestoneClaimed) {
      const gained = eligible - xtremeMilestoneClaimed;
      keys += gained;
      xtremeMilestoneClaimed = eligible;
      entries.push({
        id: generateId(),
        timestamp: now,
        type: 'XTREME_MILESTONE',
        message: `Xtreme milestone: Total Level ${eligible * XTREME_MILESTONE_INTERVAL} gives ${gained === 1 ? 'a guaranteed Key' : `${gained} guaranteed Keys`}.`,
        details: `Start-area milestone: a guaranteed Key every ${XTREME_MILESTONE_INTERVAL} total levels until you unlock an area.`,
        meta: { totalLevel, gained }
      });
    }
  }

  return { keys, xtremeMilestoneClaimed, entries };
};

/** What a ritual costs now: nothing when an achievement's free ritual of that kind is waiting. */
interface RitualPrice { id: Ritual['id']; cost: number; free: boolean }
const ritualPrice = (state: GameState, id: Ritual['id']): RitualPrice => (state.freeRituals?.includes(id)
  ? { id, cost: 0, free: true }
  : { id, cost: ritualFateCost(id, resolveModeRules(state.gameModeId, state.customMode).ritualCostMultiplier), free: false });
/** The run after paying a ritual's price: its Fate, or one waiting free ritual of that kind. */
const payRitual = <S extends GameState>(state: S, price: RitualPrice): S => {
  if (!price.free) return { ...state, fatePoints: state.fatePoints - price.cost };
  const at = state.freeRituals?.indexOf(price.id) ?? -1;
  const rest = (state.freeRituals ?? []).filter((_, j) => j !== at);
  if (rest.length > 0) return { ...state, freeRituals: rest };
  const { freeRituals: _used, ...run } = state;
  return run as S;
};
const freeMeta = (price: RitualPrice) => (price.free ? { freeRitual: true } : {});
const freeNote = (price: RitualPrice) => (price.free ? 'A free ritual from an achievement. ' : '');
/** What the waiting Ritual of Greed was paid with, so a free one refunds nothing. */
const lastGreedCost = (state: GameState): number => {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const e = state.history[i];
    if (e.type === 'ALTAR' && e.meta?.ritual === 'GREED' && typeof e.meta.fateCost === 'number') return e.meta.fateCost;
  }
  return ritualFateCost('GREED', resolveModeRules(state.gameModeId, state.customMode).ritualCostMultiplier);
};

/** The unlock state with one entry of a table opened: a tier bumped or an item added. */
const applyTableUnlock = (unlocks: UnlockState, table: TableType, item: string): UnlockState => {
  const newUnlocks = { ...unlocks };
  // Defensive helpers: pushing into an array category dedupes against the
  // existing list so a corrupted save or duplicate dispatch can't end up
  // with the same item unlocked twice. Tier categories clamp at the cap
  // so an over-unlock can't exceed the rules.
  const pushOnce = (list: string[]): string[] => list.includes(item) ? list : [...list, item];
  const bumpTier = (current: number, max: number): number => Math.min(current + 1, max);

  if (table === TableType.SKILLS) newUnlocks.skills = { ...newUnlocks.skills, [item]: bumpTier(newUnlocks.skills[item] || 0, 10) };
  else if (table === TableType.EQUIPMENT) newUnlocks.equipment = { ...newUnlocks.equipment, [item]: bumpTier(newUnlocks.equipment[item] || 0, EQUIPMENT_TIER_MAX) };
  else if (table === TableType.REGIONS) {
    const canonical = canonicalAreaName(item);
    if (!canonicalizeAreaUnlocks(newUnlocks.regions).regions.includes(canonical)) {
      newUnlocks.regions = [...newUnlocks.regions, canonical];
    }
  }
  else if (table === TableType.MOBILITY) newUnlocks.mobility = pushOnce(newUnlocks.mobility);
  else if (table === TableType.ARCANA) newUnlocks.arcana = pushOnce(newUnlocks.arcana);
  else if (table === TableType.POH) newUnlocks.housing = pushOnce(newUnlocks.housing);
  else if (table === TableType.MERCHANTS) newUnlocks.merchants = pushOnce(newUnlocks.merchants);
  else if (table === TableType.MINIGAMES) newUnlocks.minigames = pushOnce(newUnlocks.minigames);
  else if (table === TableType.BOSSES) newUnlocks.bosses = pushOnce(newUnlocks.bosses);
  else if (table === TableType.STORAGE) newUnlocks.storage = pushOnce(newUnlocks.storage);
  else if (table === TableType.GUILDS) newUnlocks.guilds = pushOnce(newUnlocks.guilds);
  else if (table === TableType.FARMING_LAYERS) newUnlocks.farming = pushOnce(newUnlocks.farming);
  else if (table === TableType.SLAYER_UNLOCKS) newUnlocks.slayerUnlocks = pushOnce(newUnlocks.slayerUnlocks);
  else if (table === TableType.CHUNKS) newUnlocks.chunks = pushOnce(newUnlocks.chunks ?? []);
  else if (table === TableType.BANKS) newUnlocks.banks = pushOnce(newUnlocks.banks ?? []);
  return newUnlocks;
};

const rawReducer = (state: GameState & { lastEvent: GameEvent | null }, action: Action): GameState & { lastEvent: GameEvent | null } => {
  const now = Date.now();

  switch (action.type) {
    case 'UPDATE_RUNEPROOF': {
      if (state.runId !== action.payload.expectedRunId) return state;
      const current = state.runeProofProgress ?? emptyRuneProofProgress();
      const progress = updateRuneProofProgress(current, action.payload.change);
      return progress === current ? state : { ...state, runeProofProgress: progress };
    }
    case 'LOAD_SAVE':
      return { ...action.payload, lastEvent: null };

    case 'RESET':
      return { ...createFreshState(), lastEvent: null };

    case 'TOGGLE_ANIMATIONS':
      return { ...state, animationsEnabled: !state.animationsEnabled };
    case 'TOGGLE_ADVISORS':
      return { ...state, advisorsEnabled: !state.advisorsEnabled };
    case 'TOGGLE_REVEAL_ALL':
      return { ...state, revealAllFeatures: !state.revealAllFeatures };

    case 'COMPLETE_ONBOARDING':
      return { ...state, hasSeenOnboarding: true };

    case 'RESOLVE_FATE_COMPENSATION': {
      const offer = state.fateCompensation;
      if (offer.status !== 'pending') return state;

      const choice = action.payload;
      const chaosKeysAwarded = choice === 'none'
        ? 0
        : Math.min(offer.chaosKeys, Math.max(0, MAX_COUNTER - state.chaosKeys));
      const pityKeysAwarded = choice === 'full'
        ? Math.min(offer.pityKeys, Math.max(0, MAX_COUNTER - state.keys))
        : 0;
      const fatePointsAfter = choice === 'full' ? offer.fatePoints : state.fatePoints;
      const log: LogEntry = {
        id: generateId(),
        timestamp: now,
        type: 'COMPENSATION',
        message: `Fate compensation resolved: ${choice}`,
        meta: {
          choice,
          chaosKeysAwarded,
          pityKeysAwarded,
          fatePointsAfter,
        },
      };

      return {
        ...state,
        keys: state.keys + pityKeysAwarded,
        chaosKeys: state.chaosKeys + chaosKeysAwarded,
        fatePoints: fatePointsAfter,
        fateCompensation: { ...offer, status: choice, choice },
        history: [...state.history, log],
      };
    }

    case 'RESOLVE_PET_COMPENSATION': {
      const offer = state.petCompensation;
      if (offer.status !== 'pending') return state;
      const { choice, keyOnly, omni, petNames } = action.payload;
      if (!validCompensationPets(offer, keyOnly, omni, state.petsClaimed)) return state;
      const petIds = [...keyOnly, ...omni].filter((id): id is number => id !== null);
      // Only a roll that paid a Key and was a new pet earns an Omni-Key.
      const earned = keyOnly.filter(id => id !== null).length;
      const rules = resolveModeRules(state.gameModeId, state.customMode);
      const result = petCompensationResult(state, earned, choice, rules, MAX_COUNTER);
      const omniKeys = result.specialKeysAwarded;
      const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
      const owedText = result.keysOwedAdded > 0
        ? result.keysOwedAdded === 1
          ? ' The next Standard Key you earn is owed.'
          : ` The next ${result.keysOwedAdded} Standard Keys you earn are owed.`
        : '';
      const fateText = choice === 'gamble' && omniKeys > 0
        ? ` and ${gambitStakeFor(rules) * omniKeys} Fate towards a Void Gambit`
        : '';
      const log: LogEntry = {
        id: generateId(),
        timestamp: now,
        type: 'COMPENSATION',
        message: omniKeys > 0
          ? `Pet compensation: ${plural(omniKeys, 'Omni-Key')}${fateText}.${owedText}`
          : petIds.length > 0 ? 'Pets named for the Omni-Key change.' : 'Earlier pet rolls kept as they were.',
        details: petIds.length > 0 ? `Pets named: ${petNames.join(', ')}.` : 'No pets named.',
        meta: {
          releaseId: PET_COMPENSATION_ID,
          choice,
          keyOnlyPetIds: keyOnly,
          omniPetIds: omni,
          specialKeysAwarded: omniKeys,
          keysOwedAdded: result.keysOwedAdded,
          pityKeysAwarded: result.pityKeysAwarded,
          keysWithheld: result.keysWithheld,
          fatePointsAfter: result.fatePoints,
        },
      };
      return {
        ...state,
        keys: result.keys,
        specialKeys: state.specialKeys + omniKeys,
        fatePoints: result.fatePoints,
        keysOwed: result.keysOwed,
        petsClaimed: [...(state.petsClaimed ?? []), ...petIds],
        petCompensation: { ...offer, status: choice },
        history: [...state.history, log],
      };
    }

    case 'SETTLE_ACHIEVEMENTS': {
      const settled = settleAchievements(state, action.payload, now, generateId, MAX_COUNTER);
      if (!settled) return state;
      return {
        ...state,
        achievementsClaimed: settled.achievementsClaimed,
        fatePoints: settled.fatePoints,
        chaosKeys: state.chaosKeys + settled.chaosKeys,
        ...(settled.freeRituals.length > 0 ? { freeRituals: settled.freeRituals } : {}),
        history: settled.entries.length > 0 ? [...state.history, ...settled.entries] : state.history,
      };
    }

    case 'SET_ACHIEVEMENT_TITLE': {
      const id = action.payload;
      if (id === null) {
        if (state.achievementTitle === undefined) return state;
        const { achievementTitle: _cleared, ...rest } = state;
        return rest;
      }
      // Only an earned (settled) achievement can be worn.
      if (id === state.achievementTitle || !state.achievementsClaimed?.includes(id)) return state;
      return { ...state, achievementTitle: id };
    }

    case 'CLAIM_PET': {
      const { petId, petName, x, y, meta } = action.payload;
      if (!isPetId(petId) || (state.petsClaimed ?? []).includes(petId) || state.specialKeys >= MAX_COUNTER) return state;
      return {
        ...state,
        specialKeys: state.specialKeys + 1,
        petsClaimed: [...(state.petsClaimed ?? []), petId],
        history: [...state.history, {
          id: generateId(),
          timestamp: now,
          type: 'PET',
          message: `${petName}: Omni-Key Found!`,
          details: 'Each new pet gives an Omni-Key, once per pet.',
          meta: { ...meta, petId, specialKeysAwarded: 1 },
          source: DropSource.PET,
        }],
        lastEvent: { id: generateId(), type: 'PET', x, y },
      };
    }

    case 'ACCEPT_DETECTED_PET': {
      // As with a detected roll: only on the state the player confirmed it on, for this run.
      if (state.runRevision !== action.payload.preparedRevision) return state;
      if (!detectedEventIdentityMatches(state, action.payload.expected)) return state;
      return rawReducer(state, {
        type: 'CLAIM_PET',
        payload: { petId: action.payload.petId, petName: action.payload.petName, meta: action.payload.meta },
      });
    }

    case 'SET_GAME_MODE': {
      // The mode is permanent once chosen — or if the run already has history
      // (defensive, covers saves predating the lock flag).
      if (state.gameModeLocked || state.history.length > 0) return state;
      // Milestone insurance counts from the run's starting total level, so a
      // new run's first level-up is not a free key. Runs that chose their mode
      // before this rule keep the counters they already have.
      const startTotal = Object.values(state.unlocks.levels).reduce((a, b) => a + b, 0);
      return {
        ...state,
        gameModeId: action.payload.modeId,
        customMode: action.payload.customRules,
        gameModeLocked: true,
        xtremeMilestoneClaimed: Math.max(state.xtremeMilestoneClaimed ?? 0, Math.floor(startTotal / XTREME_MILESTONE_INTERVAL)),
      };
    }

    case 'SET_SEED': {
      // Like the game mode, the seed is part of the run's identity — it can
      // be chosen or changed only while the run has no history.
      if (state.history.length > 0) return state;
      return { ...state, rngSeed: action.payload || undefined, rngVersion: 2 };
    }

    case 'ACCEPT_DETECTED_EVENT': {
      // The roll was prepared from one state of the run; anything since
      // (another roll, a manual log) makes it stale.
      if (state.runRevision !== action.payload.preparedRevision) return state;
      if (!detectedEventIdentityMatches(state, action.payload.expected)) return state;
      const progress = action.payload.progress;
      if (progress.kind === 'COLLECTION_ITEM' && collectionItemNeedsIdentityReview(state.unlocks.collectionLog, progress.itemId, state.collectionLogIdentity)) return state;
      const progressed = rawReducer(state, {
        type: 'SYNC_DETECTED_PROGRESS',
        payload: progress,
      });
      // As with manual completion, progress that is already recorded earns no roll.
      if (progress.kind !== 'NONE' && progressed === state) return state;
      const rewarded = action.payload.skillChaos && progressed !== state
        ? { ...progressed, chaosKeys: progressed.chaosKeys + action.payload.skillChaos.chaosKeysAwarded }
        : progressed;
      const rolled = rawReducer(rewarded, {
        type: 'ROLL_RESULT',
        payload: action.payload.rollResult,
      });
      // A detected level-up pays the start-area milestone Keys a manual one does.
      if (progress.kind === 'SKILL_LEVEL') {
        const totalLevel = Object.values(rolled.unlocks.levels).reduce((a, b) => a + b, 0);
        const insurance = startMilestoneInsurance(rolled, totalLevel, now);
        return insurance.entries.length === 0 ? rolled : {
          ...rolled,
          keys: insurance.keys,
          xtremeMilestoneClaimed: insurance.xtremeMilestoneClaimed,
          history: [...rolled.history, ...insurance.entries],
        };
      }
      // A task that completes its tier records the tier too, as the Journal does.
      if (progress.kind === 'CA_TASK') {
        return newlyEarnedCATiers(completedCAPoints(rolled.unlocks.completedTasks), rolled.unlocks.cas)
          .reduce((next, tierId) => rawReducer(next, { type: 'COMPLETE_CA', payload: tierId }), rolled);
      }
      if (progress.kind === 'DIARY_TASK') {
        const tierId = ALL_DIARY_TASKS.find(task => task.id === progress.taskId)?.tierId;
        if (tierId
          && !rolled.unlocks.diaries.includes(tierId)
          && canEarnDiaryTier(tierId, rolled.unlocks.completedTasks, ALL_DIARY_TASKS)) {
          return rawReducer(rolled, { type: 'COMPLETE_DIARY', payload: tierId });
        }
      }
      return rolled;
    }
    case 'SYNC_DETECTED_PROGRESS': {
      const progress = action.payload;
      if (progress.kind === 'NONE') return state;
      if (progress.kind === 'SKILL_LEVEL') {
        const current = state.unlocks.levels[progress.skill] ?? 1;
        if (progress.level <= current) return state;
        return { ...state, unlocks: { ...state.unlocks, levels: { ...state.unlocks.levels, [progress.skill]: progress.level } } };
      }
      if (progress.kind === 'QUEST') {
        if (state.unlocks.quests.includes(progress.questId)) return state;
        return { ...state, unlocks: { ...state.unlocks, quests: [...state.unlocks.quests, progress.questId] } };
      }
      if (progress.kind === 'CA_TASK') {
        if (state.unlocks.completedTasks.includes(progress.taskId)) return state;
        return { ...state, unlocks: { ...state.unlocks, completedTasks: [...state.unlocks.completedTasks, progress.taskId] } };
      }
      if (progress.kind === 'DIARY_TASK') {
        if (state.unlocks.completedTasks.includes(progress.taskId)) return state;
        return {
          ...state,
          unlocks: {
            ...state.unlocks,
            completedTasks: [...state.unlocks.completedTasks, progress.taskId],
          },
        };
      }
      // A pet is claimed with its Omni-Key (CLAIM_PET), never synced on its own.
      if (progress.kind === 'PET') return state;
      if (collectionItemNeedsIdentityReview(state.unlocks.collectionLog, progress.itemId, state.collectionLogIdentity)) return state;
      const current = state.unlocks.collectionLog[progress.itemId] ?? 0;
      if (current >= 1) return state;
      return { ...state, unlocks: { ...state.unlocks, collectionLog: { ...state.unlocks.collectionLog, [progress.itemId]: 1 } } };
    }

    case 'ROLL_RESULT': {
      const { success, omni, pity, roll, baseThreshold, threshold, source, failureFate = 1, x, y, meta, context, ritual: ritualRoll } = action.payload;
      const vanillaBossContext = usesActivityKeyReserves(state.gameModeId) && context?.kind === 'boss'
        ? context
        : null;
      const vanillaClueContext = state.gameModeId === 'vanilla' && context?.kind === 'clue'
        ? context
        : null;
      const recordedBossAwarded = vanillaBossContext
        ? state.bossStandardKeysAwarded?.[vanillaBossContext.bossName] ?? 0
        : 0;
      const bossStage = vanillaBossContext
        ? vanillaBossKeyStage(vanillaBossContext.bossName, recordedBossAwarded)
        : null;
      const vanillaMinigameContext = usesActivityKeyReserves(state.gameModeId) && context?.kind === 'minigame'
        ? context
        : null;
      if (vanillaMinigameContext && !isKnownVanillaMinigame(vanillaMinigameContext.minigameName)) return state;
      const minigameStage = vanillaMinigameContext
        ? vanillaMinigameKeyStage(
          vanillaMinigameContext.minigameName,
          state.minigameStandardKeysAwarded?.[vanillaMinigameContext.minigameName] ?? 0,
        )
        : null;
      const reserveStage = bossStage ?? minigameStage;

      // Callback work can race with an earlier accepted roll. This reducer-side
      // backstop rejects the stale action without changing buffs, history, or RNG state.
      if (reserveStage?.capped) return state;

      const rollText = formatKeyRollValue(roll);
      const thresholdsMatch = baseThreshold === threshold;
      const thresholdText = formatKeyPercent(threshold);
      const comparisonChanceText = thresholdsMatch
        ? thresholdText
        : `${thresholdText} effective; ${formatKeyPercent(baseThreshold)} base`;
      const inlineChanceText = thresholdsMatch
        ? thresholdText
        : `${thresholdText} effective (${formatKeyPercent(baseThreshold)} base)`;
      const luckApplied = state.activeBuff === 'LUCK';
      const isGreed = state.activeBuff === 'GREED';
      // Greed doubles any success's Standard Key, an Omni-Key roll's included.
      // A fail that brings the Pity Key pays that Key and refunds nothing.
      // Karil's second Key is a Standard Key too; Greed and the Barrows Chest never share a roll.
      const secondKey = success && ritualRoll?.secondKey === true;
      const requestedStandardKeys = success || pity
        ? success && isGreed ? 2 : secondKey ? 2 : 1
        : 0;
      const standardKeysAwarded = reserveStage
        ? Math.min(requestedStandardKeys, reserveStage.remaining)
        : requestedStandardKeys;
      const remainingStage = reserveStage
        ? reserveStage.remaining - standardKeysAwarded
        : null;
      const outcome = omni
        ? 'omni'
        : pity
          ? 'pity'
          : isGreed
            ? 'greed'
            : 'normal';
      const vanillaRollMeta = context
        ? {
            context,
            ...(context.kind === 'boss'
              ? { bossName: context.bossName, bossClass: context.bossClass }
              : context.kind === 'minigame'
                ? { minigameName: context.minigameName }
                : { clueTier: context.clueTier }),
            effectiveRate: threshold,
            standardKeysAwarded,
            currentStage: reserveStage?.awarded ?? null,
            remainingStage,
            remainingReserve: remainingStage,
            outcome,
            exhausted: reserveStage ? remainingStage === 0 : false,
          }
        : {};
      const singleDrawProbability = Math.max(0, Math.min(1, threshold / 100));
      const rawSuccessProbability = luckApplied
        ? 1 - (1 - singleDrawProbability) ** 2
        : singleDrawProbability;
      const successProbability = Number(rawSuccessProbability.toFixed(12));
      const rewardKind: RollAnalyticsMeta['rewardKind'] = success
        ? omni ? 'omni' : isGreed ? 'greed' : 'normal'
        : pity ? 'pity' : 'none';
      const analyticsMeta: RollAnalyticsMeta = {
        successProbability,
        luckApplied,
        drawResolution: vanillaBossContext || vanillaClueContext || vanillaMinigameContext ? 10000 : 1000,
        standardKeysAwarded,
        rewardKind,
      };
      const entryMeta = (fatePointsEarned: number) => ({
        roll,
        baseThreshold,
        threshold,
        source,
        fatePointsEarned,
        ...meta,
        ...vanillaRollMeta,
        ...analyticsMeta,
      });
      const eventMeta = { roll, baseThreshold, threshold, ...meta, ...vanillaRollMeta, ...analyticsMeta };

      const rollRules = resolveModeRules(state.gameModeId, state.customMode);
      // What the run's rituals do to a miss's Fate (Tears, Guthan, Torag, the Pact's debt, Invocations).
      const missBase = missFateBase(failureFate, minigameStage);
      const missFate = success ? null : failFate(state.rituals, missBase, state.fatePoints, rollRules.pityEnabled, rollRules.pityThreshold);
      const ritualNotes = [
        ...(!success && missBase === 0 && failureFate > 0 ? [`No Fate on a miss under ${MINIGAME_MISS_FATE_MIN_RATE}%.`] : []),
        ...(ritualRoll && ritualRoll.oddsBonus !== 0 ? [`Rituals ${ritualRoll.oddsBonus > 0 ? '+' : ''}${ritualRoll.oddsBonus}% odds.`] : []),
        ...(success && ritualRoll?.hitThrough ? ['Verac hit through the miss.'] : []),
        ...(secondKey && standardKeysAwarded === 2 ? ["Karil's bolt found a second Key."] : []),
        ...(missFate?.notes.length ? [`${missFate.notes.join(', ')}.`] : []),
      ];
      const ritualText = ritualNotes.length > 0 ? ` ${ritualNotes.join(' ')}` : '';
      const missMeta = missFate
        ? { ...(missFate.lost > 0 ? { fatePointsLost: missFate.lost } : {}), ...(missFate.debtPaid > 0 ? { debtPaid: missFate.debtPaid } : {}) }
        : {};

      let newState = {
        ...state,
        activeBuff: state.activeBuff === 'LUCK' || state.activeBuff === 'GREED' ? 'NONE' : state.activeBuff,
      } as GameState & { lastEvent: GameEvent | null };
      const nextRituals = tidyRituals(afterRoll(state.rituals, { success, debtPaid: missFate?.debtPaid ?? 0 }));
      if (nextRituals) newState.rituals = nextRituals;
      else delete newState.rituals;
      const newHistory = [...state.history];

      if (vanillaBossContext && standardKeysAwarded > 0) {
        newState.bossStandardKeysAwarded = {
          ...(state.bossStandardKeysAwarded ?? {}),
          [vanillaBossContext.bossName]: bossStage!.awarded + standardKeysAwarded,
        };
      }
      if (vanillaMinigameContext && standardKeysAwarded > 0) {
        newState.minigameStandardKeysAwarded = {
          ...(state.minigameStandardKeysAwarded ?? {}),
          [vanillaMinigameContext.minigameName]: minigameStage!.awarded + standardKeysAwarded,
        };
      }
      if (vanillaClueContext && standardKeysAwarded > 0) {
        newState.clueStandardKeysAwarded = (state.clueStandardKeysAwarded ?? 0) + standardKeysAwarded;
      }

      if (success) {
        // "(Doubled)" is what the integrity replay counts as 2 Standard Keys.
        // Karil's second Key says "(Second Key)", which the replay also counts as 2.
        const greedMessage = isGreed
          ? standardKeysAwarded === 2
            ? ' (Doubled)'
            : ` (Greed awarded ${standardKeysAwarded} Standard Key${standardKeysAwarded === 1 ? '' : 's'})`
          : secondKey && standardKeysAwarded === 2 ? ' (Second Key)' : '';
        if (omni) {
          newState.specialKeys += 1;
          newState.keys += standardKeysAwarded;

          newHistory.push({
             id: generateId(),
             timestamp: now,
             type: 'ROLL_OMNI',
             message: isGreed && standardKeysAwarded === 2
               ? '2 Keys and an Omni-Key Found! (Doubled)'
               : secondKey && standardKeysAwarded === 2
                 ? '2 Keys and an Omni-Key Found! (Second Key)'
                 : `Key and Omni-Key Found!${greedMessage}`,
             details: `Rolled ${rollText} (≤ ${comparisonChanceText}), and an Omni-Key came with the ${standardKeysAwarded === 2 ? '2 Keys' : 'Key'}.${ritualText}`,
             meta: entryMeta(0),
             result: 'SUCCESS',
             source,
             rollValue: roll,
             baseThreshold,
             threshold,
          });
          newState.lastEvent = { id: generateId(), type: 'ROLL_OMNI', x, y, meta: eventMeta };
        } else {
          newState.keys += standardKeysAwarded;

          newHistory.push({
             id: generateId(),
             timestamp: now,
             type: 'ROLL_SUCCESS',
             message: `Key Found!${greedMessage}`,
             details: ritualRoll?.hitThrough
               ? `Rolled ${rollText} (> ${comparisonChanceText}).${ritualText}`
               : `Rolled ${rollText} (≤ ${comparisonChanceText}).${ritualText}`,
             meta: entryMeta(0),
             result: 'SUCCESS',
             source,
             rollValue: roll,
             baseThreshold,
             threshold,
          });
          newState.lastEvent = { id: generateId(), type: 'ROLL_SUCCESS', x, y, meta: eventMeta };
        }
        newState.fatePoints = 0;
      } else if (pity) {
        newState.keys += standardKeysAwarded;
        const pityThreshold = rollRules.pityThreshold;
        const earned = missFate?.earned ?? failureFate;
        newState.fatePoints = Math.max(0, state.fatePoints + earned - pityThreshold - (missFate?.lost ?? 0));
        newHistory.push({
            id: generateId(),
            timestamp: now,
            type: 'PITY',
            message: 'MAX FATE REACHED! Pity Key granted.',
            details: `Rolled ${rollText} at ${inlineChanceText}, but Fate intervened.${ritualText}`,
            meta: { ...entryMeta(earned), ...missMeta, pityThreshold },
            result: 'SUCCESS',
            source,
            rollValue: roll,
            baseThreshold,
            threshold,
        });
        newState.lastEvent = { id: generateId(), type: 'ROLL_PITY', x, y, meta: eventMeta };
      } else {
        const earned = missFate?.earned ?? failureFate;
        newState.fatePoints += earned;
        // Greed's consolation: half the (scaled) ritual cost flows back,
        // so it's double-or-something rather than double-or-nothing.
        let greedRefund = 0;
        if (isGreed) {
          greedRefund = Math.ceil(lastGreedCost(state) * GREED_REFUND_FRACTION);
          newState.fatePoints += greedRefund;
        }
        // Blood Price takes its Fate after the miss has paid out.
        newState.fatePoints -= missFate?.lost ?? 0;
        newHistory.push({
            id: generateId(),
            timestamp: now,
            type: 'ROLL_FAIL',
            message: `No Key.${isGreed ? ` (Greed refunded ${greedRefund} Fate)` : ''}`,
            details: `Rolled ${rollText} (> ${comparisonChanceText}). Fate: ${newState.fatePoints}/${rollRules.pityThreshold}${ritualText}`,
            meta: { ...entryMeta(earned + greedRefund), ...missMeta },
            result: 'FAIL',
            source,
            rollValue: roll,
            baseThreshold,
            threshold,
        });
        newState.lastEvent = { id: generateId(), type: 'ROLL_FAIL', x, y, meta: eventMeta };
      }

      return { ...newState, history: newHistory };
    }
    case 'UNLOCK': {
      const { table, item, costType } = action.payload;
      // Every Key spend costs UNLOCK_COST, whatever the caller says.
      const cost = UNLOCK_COST;
      // Chunked has no Areas table, and an Omni-Key can't pick land there:
      // land comes from Chunk Keys, Chaos Keys, the Cartographer and Fate's Mercy.
      if (state.gameModeId === 'chunked'
        && (table === TableType.REGIONS || (table === TableType.CHUNKS && costType === 'specialKey'))) return state;
      // Only an Omni-Key names the exact entry. A Standard or Chaos Key spend
      // unlocks what fate drew (rollUnlock), which always comes with a reveal.
      if (!action.payload.revealId && costType !== 'specialKey') return state;
      if (action.payload.revealId && (state.pendingUnlock || costType === 'specialKey'
        || (costType === 'key' ? state.keys < cost : state.chaosKeys < 1)
        || !isRandomUnlockEligible(table, item, state.unlocks, state.gameModeId, costType))) return state;
      // Saradomin's Ward: a random spend on a place (or a Chaos Key) must have been drawn
      // from what the run can use now. rollUnlock filters the draw and marks it.
      const warded = !!action.payload.revealId && state.rituals?.ward === true && costType !== 'specialKey' && wardApplies(costType, table);
      if (warded && action.payload.ward !== true) return state;
      // Direct (Omni) unlocks must be paid for and still unlockable, or two
      // quick confirmations could spend one Omni-key twice.
      if (!action.payload.revealId && (state.specialKeys < 1 || !isValidUnlock(table, item, state.unlocks))) return state;

      const newUnlocks = applyTableUnlock(state.unlocks, table, item);

      let newState = { ...state, unlocks: newUnlocks };
      if (warded) {
        const rest = tidyRituals({ ...state.rituals, ward: false });
        if (rest) newState.rituals = rest;
        else delete newState.rituals;
      }
      if (costType === 'key') newState.keys -= cost;
      else if (costType === 'specialKey') newState.specialKeys -= 1;
      else if (costType === 'chaosKey') newState.chaosKeys -= 1;

      // Banks are keyed by chunk id ("13618") and chunks by "cx,cy"; show the
      // place name instead. This text goes to Discord's #live-unlocks and /progress.
      const itemLabel = table === TableType.BANKS ? (BANK_BY_ID[item]?.name ?? item)
        : table === TableType.CHUNKS ? chunkLabelWithCoords(item)
        : item;
      const log: LogEntry = {
          id: generateId(),
          timestamp: now,
          type: 'UNLOCK',
          message: `Unlocked ${itemLabel}`,
          details: `Category: ${tableDisplayName(table)}`,
          meta: { item, category: table, cost, costType, ...(warded ? { ward: true } : {}) }
      };

      return {
        ...newState,
        ...(action.payload.revealId && costType !== 'specialKey' ? {
          pendingUnlock: { id: action.payload.revealId, table, item, costType, cost },
        } : {}),
        history: [...state.history, log],
        lastEvent: action.payload.revealId ? null : { id: generateId(), type: 'UNLOCK', meta: { item, cost, category: table } }
      };
    }
    case 'ACKNOWLEDGE_UNLOCK': {
      if (state.pendingUnlock?.id !== action.payload) return state;
      const { pendingUnlock, ...rest } = state;
      return { ...rest, lastEvent: { id: generateId(), type: 'UNLOCK', meta: { item: pendingUnlock.item, cost: pendingUnlock.cost, category: pendingUnlock.table } } };
    }

    case 'RITUAL_LUCK': {
      // One buff waits for the next roll; a second would overwrite the first.
      const price = ritualPrice(state, 'LUCK');
      if (rollRitualActive(state.activeBuff, state.rituals) || state.fatePoints < price.cost) return state;
      return {
        ...payRitual(state, price),
        activeBuff: 'LUCK',
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: 'Ritual of Clarity', details: `${freeNote(price)}Your next Key roll is made twice and the better result is kept.`, meta: { ritual: 'LUCK', fateCost: price.cost, ...freeMeta(price) } }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'LUCK' } }
      };
    }

    case 'RITUAL_GREED': {
      const price = ritualPrice(state, 'GREED');
      if (rollRitualActive(state.activeBuff, state.rituals) || state.fatePoints < price.cost) return state;
      return {
        ...payRitual(state, price),
        activeBuff: 'GREED',
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: 'Ritual of Greed', details: `${freeNote(price)}Next success gives 2 Keys.`, meta: { ritual: 'GREED', fateCost: price.cost, ...freeMeta(price) } }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'GREED' } }
      };
    }

    case 'RITUAL_CHAOS': {
      const price = ritualPrice(state, 'CHAOS');
      if (state.fatePoints < price.cost) return state;
      return {
        ...payRitual(state, price),
        chaosKeys: state.chaosKeys + 1,
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: 'Ritual of Chaos', details: `${freeNote(price)}Fate converted to Chaos Key.`, meta: { ritual: 'CHAOS', fateCost: price.cost, chaosKeysAwarded: 1, ...freeMeta(price) } }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'CHAOS' } }
      };
    }

    case 'RITUAL_TRANSMUTE':
      if (state.keys < (getRitual('TRANSMUTE').keyCost ?? 5)) return state;
      return {
        ...state,
        keys: state.keys - (getRitual('TRANSMUTE').keyCost ?? 5),
        specialKeys: state.specialKeys + 1,
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: 'Ritual of Transmutation', details: '5 Keys fused into 1 Omni-Key.', meta: { ritual: 'TRANSMUTE', keyCost: getRitual('TRANSMUTE').keyCost ?? 5, specialKeysAwarded: 1 } }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'TRANSMUTE' } }
      };

    case 'RITUAL_GAMBIT': {
      // The stake is the player's ENTIRE fate pool (validated + coin-flipped
      // by the caller, keeping the reducer pure). Win or lose, fate hits 0 —
      // which is exactly where the next success would have put it anyway.
      const { won, stake, keysWon } = action.payload;
      return {
        ...state,
        fatePoints: 0,
        keys: state.keys + (won ? keysWon : 0),
        history: [...state.history, {
          id: generateId(), timestamp: now, type: 'ALTAR',
          message: won ? `Void Gambit WON: ${keysWon} Key${keysWon > 1 ? 's' : ''}!` : 'Void Gambit lost.',
          details: won ? `Staked ${stake} Fate and won.` : `Staked ${stake} Fate and lost it.`,
          meta: { ritual: 'GAMBIT', fateCost: stake, keysAwarded: won ? keysWon : 0 },
        }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'GAMBIT', won, stake, keysWon: won ? keysWon : 0 } }
      };
    }

    case 'CARTOGRAPHER_DRAW_OFFER': {
      // Fate draws the Cartographer's three frontier chunks once, the first
      // time the chooser opens, and the run keeps them: logging more never
      // reshuffles them. A new offer is drawn only after the ritual charts
      // one, or once none of the kept chunks is on the frontier any more.
      if (state.gameModeId !== 'chunked' || liveCartographerOffer(state).length > 0) return state;
      const offer = drawCartographerOffer(state).map(chunkKeyOf);
      return offer.length === 0 ? state : { ...state, cartographerOffer: offer };
    }

    case 'RITUAL_CARTOGRAPHER': {
      // The player chooses one of the three frontier chunks fate drew for
      // the offer (CARTOGRAPHER_DRAW_OFFER); the reducer refuses any other.
      // It checks the frontier itself too: only a Chunked run, and only a
      // chunk next to its land (never the start chunk or one it holds).
      const { chunkKey: chosen } = action.payload;
      const price = ritualPrice(state, 'CARTOGRAPHER');
      const cost = price.cost;
      const held = state.unlocks.chunks ?? [];
      if (state.gameModeId !== 'chunked' || state.fatePoints < cost || chosen === CHUNKED_START_KEY
        || held.includes(chosen) || !isFrontierChunk(chosen, held, state.unlocks)
        || !liveCartographerOffer(state).includes(chosen)) return state;
      const label = chunkLabelWithCoords(chosen);
      return {
        ...payRitual(state, price),
        cartographerOffer: undefined,
        unlocks: { ...state.unlocks, chunks: [...(state.unlocks.chunks ?? []), chosen] },
        history: [...state.history, {
          id: generateId(), timestamp: now, type: 'ALTAR',
          message: `Cartographer charted ${label}`,
          meta: { ritual: 'CARTOGRAPHER', fateCost: cost, chunk: chosen, ...freeMeta(price) },
          details: price.free ? `${freeNote(price)}Chose a frontier chunk.` : `Chose a frontier chunk for ${cost} Fate.`,
        }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'CARTOGRAPHER', chunk: chosen } }
      };
    }

    case 'RITUAL_WARD':
    case 'RITUAL_TEARS':
    case 'RITUAL_PACT':
    case 'RITUAL_INVOCATIONS':
    case 'RITUAL_BARROWS':
    case 'RITUAL_SACRIFICE': {
      const id = action.type.slice('RITUAL_'.length) as NewRitualId;
      const ritual = getRitual(id);
      const price = ritualPrice(state, id);
      const cost = price.cost;
      // The Altar checks the same rules; this stops a stale click.
      if (state.fatePoints < cost || !ritualAvailability(id, ritual.god, state).ok) return state;
      let rituals: RitualState = { ...state.rituals };
      let unlocks = state.unlocks;
      let specialKeys = state.specialKeys;
      let details = ritual.effect;
      const meta: Record<string, unknown> = { ritual: id, fateCost: cost, ...freeMeta(price) };
      const eventMeta: RitualEventMeta = { type: id };
      if (action.type === 'RITUAL_WARD') rituals = { ...rituals, ward: true, wardCooldown: WARD_COOLDOWN_ROLLS };
      else if (action.type === 'RITUAL_TEARS') rituals = castTears(rituals);
      else if (action.type === 'RITUAL_PACT') rituals = castPact(rituals);
      else if (action.type === 'RITUAL_INVOCATIONS') {
        const ids = action.payload.ids;
        const picked = INVOCATIONS.filter(v => ids.includes(v.id));
        if (ids.length === 0 || new Set(ids).size !== ids.length || picked.length !== ids.length) return state;
        if (!picked.every(v => invocationAllowed(v, state.fatePoints - cost))) return state;
        rituals = castInvocations(rituals, ids);
        details = `Invoked ${INVOCATIONS.filter(v => ids.includes(v.id)).map(v => v.name).join(', ')} for the next rolls.`;
        meta.invocations = ids;
        eventMeta.invocations = ids;
      } else if (action.type === 'RITUAL_BARROWS') {
        const brother = BARROWS_BROTHERS.find(b => b.id === action.payload.brother);
        if (!brother) return state;
        rituals = castBarrows(rituals, brother.id, cost);
        details = `${brother.name}: ${brother.effect} for the next rolls.`;
        meta.brother = brother.id;
        eventMeta.brother = brother.id;
      } else {
        const taken = action.payload.taken;
        const candidates = sacrificeCandidates(state.unlocks);
        const valid = taken.length === SACRIFICE_TIERS
          && new Set(taken.map(t => `${t.table}:${t.name}`)).size === taken.length
          && taken.every(t => candidates.some(c => c.table === t.table && c.name === t.name && c.tier === t.tier));
        if (!valid) return state;
        const skills = { ...state.unlocks.skills };
        const equipment = { ...state.unlocks.equipment };
        for (const t of taken) {
          if (t.table === 'skill') {
            if (t.tier - 1 > 0) skills[t.name] = t.tier - 1;
            else delete skills[t.name];
          } else equipment[t.name] = t.tier - 1;
        }
        unlocks = { ...state.unlocks, skills, equipment };
        specialKeys += 1;
        rituals.sacrificesUsed = (rituals.sacrificesUsed ?? 0) + 1;
        details = `Fate took ${taken.map(t => `${t.name} tier ${t.tier}`).join(', ')} for an Omni-Key.`;
        meta.taken = taken;
        meta.specialKeysAwarded = 1;
        eventMeta.taken = taken;
        eventMeta.usesLeft = SACRIFICE_USES_PER_RUN - rituals.sacrificesUsed;
      }
      const next: GameState & { lastEvent: GameEvent | null } = { ...payRitual(state, price), specialKeys, unlocks };
      const tidy = tidyRituals(rituals);
      if (tidy) next.rituals = tidy;
      else delete next.rituals;
      return {
        ...next,
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: ritual.name, details: `${freeNote(price)}${details}`, meta }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: eventMeta },
      };
    }

    case 'CHUNKED_BREAKTHROUGH': {
      const { skill, roll } = action.payload;
      // A reveal still showing must be acknowledged first, as the button says.
      if (state.pendingUnlock) return state;
      const tier = breakthroughTier(state, skill);
      if (tier === null) return state;
      const won = roll < BREAKTHROUGH_CHANCE;
      const band = tierBand(tier);
      const chunkedBreakthroughs = { ...(state.chunkedBreakthroughs ?? {}), [skill]: tier };
      if (!won) {
        return {
          ...state,
          chunkedBreakthroughs,
          history: [...state.history, {
            id: generateId(), timestamp: now, type: 'LEVEL_UP',
            message: `No Breakthrough for ${skill}`,
            details: `Fate kept ${skill} at tier ${tier - 1} (methods to level ${tierCap(tier - 1)}). Levels past ${tierCap(tier - 1)} roll nothing until a Key opens levels ${band.label}.`,
            meta: { breakthrough: skill, tier, won: false },
          }],
        };
      }
      const { revealId } = action.payload;
      return {
        ...state,
        chunkedBreakthroughs,
        unlocks: applyTableUnlock(state.unlocks, TableType.SKILLS, skill),
        // A free fate draw: the reveal shows no cost, and nothing is spent.
        ...(revealId ? { pendingUnlock: { id: revealId, table: TableType.SKILLS, item: skill, costType: 'breakthrough' as const, cost: 0 } } : {}),
        history: [...state.history, {
          id: generateId(), timestamp: now, type: 'UNLOCK',
          message: `Unlocked ${skill} tier ${tier} · Breakthrough`,
          details: `Breakthrough: fate opened levels ${band.label}. Nothing was spent.`,
          meta: { item: skill, category: TableType.SKILLS, cost: 0, costType: 'breakthrough', tier },
        }],
        lastEvent: revealId ? null : { id: generateId(), type: 'UNLOCK', meta: { item: skill, cost: 0, category: TableType.SKILLS } },
      };
    }

    case 'CHUNK_EXPLORE': {
      // Chunked exploring: record the thing first; its Key roll follows as a
      // ROLL_RESULT, the way a ticked quest rolls (utils/chunkExplore.ts).
      const { chunk, fact } = action.payload;
      if (exploreBlocker(state, chunk, fact) !== null) return state;
      const record = state.chunkExplore!;
      return {
        ...state,
        chunkExplore: { ...record, done: { ...record.done, [chunk]: [...(record.done[chunk] ?? []), fact] } },
      };
    }

    case 'FATE_MARK_ROLL': {
      // A Gilded chunk's free Key roll: use it up first; the roll follows as a
      // ROLL_RESULT, the way an exploring roll does (utils/fateLand.ts).
      const land = state.fateLand;
      if (!land || !land.gilded.includes(action.payload.chunk)) return state;
      return { ...state, fateLand: { ...land, gilded: land.gilded.filter(key => key !== action.payload.chunk) } };
    }

    case 'CALL_ON_FATE': {
      // Fate's Mercy: only when the run has truly run dry. Fate draws from the
      // same Chunks and Skills pools a Key would roll; nothing is spent.
      // The doable quests need the chunk content, which the provider loads
      // and reads itself (callOnFate, utils/mercyQuests.ts); a call that
      // brings none is refused (utils/chunkedFate.ts).
      const { doableQuests, roll } = action.payload;
      if (!Array.isArray(doableQuests) || mercyBlocker(state, doableQuests) !== null) return state;
      // The roll is the provider's nextFloat('mercy'). On a seeded run the
      // reducer can recompute that draw, so it refuses any other roll: a
      // caller can't steer which chunk or skill fate opens (audit V3).
      if (typeof roll !== 'number' || !(roll >= 0 && roll < 1)
        || (state.rngSeed && roll !== drawFloat(state.rngSeed, seededContext(state), 'mercy'))) return state;
      const pool = mercyPool(state);
      const pick = pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
      // A chunk, a skill tier, or the patch type, guild, merchant or gear slot a skill needs to train.
      const label = pick.table === TableType.CHUNKS ? chunkLabelWithCoords(pick.item)
        : pick.table === TableType.SKILLS ? `${pick.item} tier ${(state.unlocks.skills[pick.item] ?? 0) + 1}`
        : pick.table === TableType.FARMING_LAYERS ? `${pick.item} patches`
        : pick.table === TableType.EQUIPMENT ? `${pick.item} tier ${(state.unlocks.equipment[pick.item] ?? 0) + 1}` : pick.item;
      return {
        ...state,
        unlocks: applyTableUnlock(state.unlocks, pick.table, pick.item),
        // A free fate draw: the reveal shows no cost, and nothing is spent.
        pendingUnlock: { id: action.payload.revealId, table: pick.table, item: pick.item, costType: 'mercy', cost: 0 },
        history: [...state.history, {
          id: generateId(), timestamp: now, type: 'UNLOCK',
          message: `Unlocked ${label} · Fate's Mercy`,
          details: `Fate's Mercy: fate drew this from ${pool.length} ${pool.length === 1 ? 'entry' : 'entries'}. Nothing was spent.`,
          meta: { item: pick.item, category: pick.table, cost: 0, costType: 'mercy' },
        }],
        lastEvent: null,
      };
    }

    case 'LEVEL_UP': {
      const { skill, chaosRoll } = action.payload;

      // The UI gates leveling at level < 99, but defend the reducer too so a
      // stray dispatch can't push the skill past the OSRS level cap.
      const currentLevel = state.unlocks.levels[skill] || 1;
      const newLevel = Math.min(currentLevel + 1, 99);
      if (newLevel === currentLevel) return state; // already capped
      const newLevels = { ...state.unlocks.levels, [skill]: newLevel };
      const newUnlocks = { ...state.unlocks, levels: newLevels };

      // Calculate Total Level
      const totalLevel = Object.values(newLevels).reduce((a, b) => a + b, 0);

      const logs = [...state.history];
      const RNG_CHAOS_CHANCE = 0.02;
      // Chunked: a level past the tier cap is logged but rolls nothing, so
      // Fate's Mercy and Breakthrough read the skill as capped.
      const pastCap = levelPastTierCap(state.gameModeId, state.unlocks, skill, newLevel);
      const randomChaosAwarded = !pastCap && chaosRoll < RNG_CHAOS_CHANCE;
      const guaranteedChaosAwarded = !pastCap && isSkillChaosMilestone(newLevel);
      const chaosKeysAwarded =
        Number(randomChaosAwarded) + Number(guaranteedChaosAwarded);
      const chaosKeyAwarded = chaosKeysAwarded > 0;
      const chaosKeys = state.chaosKeys + chaosKeysAwarded;

      if (chaosKeyAwarded) {
        const reward = `${chaosKeysAwarded} Chaos Key${chaosKeysAwarded === 1 ? '' : 's'}`;
        logs.push({
          id: generateId(),
          timestamp: now,
          type: 'LEVEL_UP',
          message: `${reward} awarded!`,
          details: guaranteedChaosAwarded
            ? `Skill level ${newLevel} milestone${randomChaosAwarded ? ' plus a lucky roll' : ''}.`
            : `The ${Math.round(RNG_CHAOS_CHANCE * 100)}% level-up chance came up, at Total Level ${totalLevel}.`,
          meta: {
            totalLevel,
            reward,
            chaosKeysAwarded,
            chaosKeyAwarded,
          },
        });
      }
      if (pastCap) {
        const cap = tierCap(state.unlocks.skills[skill] ?? 0);
        logs.push({
          id: generateId(),
          timestamp: now,
          type: 'LEVEL_UP',
          message: `${skill} Level ${newLevel}: no roll`,
          details: `Past its tier cap of level ${cap}. In Chunked, levels past the cap roll no Keys until a Key or a Breakthrough opens the next tier.`,
          meta: { skill, level: newLevel, totalLevel, pastTierCap: cap, chaosKeysAwarded: 0, chaosKeyAwarded: false },
        });
      }

      const { keys, xtremeMilestoneClaimed, entries } =
        startMilestoneInsurance(state, totalLevel, now);
      logs.push(...entries);

      const eventMeta: LevelUpEventMeta = { skill, level: newLevel, totalLevel, chaosKeysAwarded, chaosKeyAwarded };

      return {
        ...state,
        unlocks: newUnlocks,
        keys,
        chaosKeys,
        xtremeMilestoneClaimed,
        history: logs,
        lastEvent: { id: generateId(), type: 'LEVEL_UP', meta: eventMeta }
      };
    }

    case 'TOGGLE_PIN': {
      const goalId = action.payload;
      const isPinned = state.pinnedGoals.includes(goalId);
      return {
        ...state,
        pinnedGoals: isPinned
          ? state.pinnedGoals.filter(id => id !== goalId)
          : [...state.pinnedGoals, goalId]
      };
    }

    case 'UPDATE_NOTE': {
      return {
        ...state,
        userNotes: {
          ...state.userNotes,
          [action.payload.id]: action.payload.text
        }
      };
    }

    case 'COMPLETE_QUEST': {
      const questId = action.payload;
      const unlocks = withJournalCompletion(state.unlocks, 'quests', questId);
      return unlocks === state.unlocks ? state : { ...state, unlocks };
    }

    case 'COMPLETE_DIARY': {
      const id = action.payload;
      const unlocks = withJournalCompletion(state.unlocks, 'diaries', id);
      return unlocks === state.unlocks ? state : { ...state, unlocks };
    }

    case 'COMPLETE_CA': {
      const id = action.payload;
      if (state.unlocks.cas.includes(id)) return state;
      return {
        ...state,
        unlocks: {
          ...state.unlocks,
          cas: [...state.unlocks.cas, id],
        },
      };
    }

    case 'COMPLETE_TASK': {
      const taskId = action.payload;
      const unlocks = withJournalCompletion(state.unlocks, 'completedTasks', taskId);
      return unlocks === state.unlocks ? state : { ...state, unlocks };
    }

    case 'SET_RIVAL':
      return { ...state, rival: action.payload };
    case 'CLEAR_RIVAL':
      return { ...state, rival: undefined };
    case 'ACK_RIVAL':
      return state.rival ? { ...state, rival: { ...state.rival, lastSeenLead: action.payload } } : state;

    case 'SET_LOADOUT_SLOT': {
      const { slot, itemId, clearSlots } = action.payload;
      const loadout = { ...(state.loadout || {}) };
      if (itemId == null) delete loadout[slot];
      else loadout[slot] = itemId;
      if (clearSlots) for (const s of clearSlots) delete loadout[s];
      return { ...state, loadout };
    }

    case 'SET_LINKED_ACCOUNT': {
      // Link the run to one OSRS account on the first fetch; RENAME_LINKED_ACCOUNT changes it.
      if (state.linkedAccount) return state;
      return { ...state, linkedAccount: action.payload };
    }

    case 'RENAME_LINKED_ACCOUNT': {
      // The player changing the linked character's name (an OSRS name change,
      // a typo) from Sync & Roll. A run linked to another name since the
      // player opened the form stays as it is.
      const { from, to } = action.payload;
      const next = to.trim();
      if (!state.linkedAccount || !next) return state;
      if (normalizeAccountName(state.linkedAccount) !== normalizeAccountName(from)) return state;
      return { ...state, linkedAccount: next };
    }

    case 'LOG_ITEM': {
      const itemId = action.payload;
      if (collectionItemNeedsIdentityReview(state.unlocks.collectionLog, itemId, state.collectionLogIdentity)) return state;
      const currentCount = state.unlocks.collectionLog[itemId] || 0;

      const newUnlocks = {
        ...state.unlocks,
        collectionLog: {
          ...state.unlocks.collectionLog,
          [itemId]: currentCount + 1
        }
      };

      return {
        ...state,
        unlocks: newUnlocks
      };
    }

    default:
      return state;
  }
};

/**
 * The Standard Keys a run gave up in the pet compensation come out of the next
 * ones it earns, whatever earned them, and the history says so.
 */
const settleKeysOwed = (
  before: GameState & { lastEvent: GameEvent | null },
  after: GameState & { lastEvent: GameEvent | null },
  action: Action,
): GameState & { lastEvent: GameEvent | null } => {
  if (action.type === 'RESOLVE_PET_COMPENSATION') return after;
  const withheld = keysToWithhold(after.keysOwed, before.keys, after.keys);
  if (withheld === 0) return after;
  const owedAfter = (after.keysOwed ?? 0) - withheld;
  return {
    ...after,
    keys: after.keys - withheld,
    keysOwed: owedAfter,
    history: [...after.history, {
      id: generateId(),
      timestamp: Date.now(),
      type: 'COMPENSATION',
      message: `${withheld === 1 ? 'A Standard Key' : `${withheld} Standard Keys`} went to the pet compensation you chose.`,
      details: owedAfter > 0 ? `${owedAfter} still owed.` : 'Nothing more is owed.',
      meta: { releaseId: PET_COMPENSATION_ID, keysWithheld: withheld },
    }],
  };
};

export const gameReducer = (state: GameState & { lastEvent: GameEvent | null }, action: Action): GameState & { lastEvent: GameEvent | null } => {
  if (action.type === 'COMMIT_STATE') return action.payload;
  const rawNext = rawReducer(state, action);
  if (rawNext === state) return state;
  // A replacement brings its own history. Chaining it as an append would
  // splice in, or link to, entries of the run it replaces.
  if (action.type === 'LOAD_SAVE' || action.type === 'RESET') return rawNext;
  // A Chunked run's first chunk under the exploring rule starts its record.
  // Then fate has its say on any chunk the run just gained (utils/fateLand.ts).
  const settled = withFateLand(state, withExploreStart(state, settleKeysOwed(state, rawNext, action)), Date.now(), generateId, MAX_COUNTER);
  const chained = settled.history === state.history
    ? settled
    : { ...settled, history: chainAppendedHistory(state.history, settled.history) };
  // A Chunked run's last progress (a Key, an unlock or a level) times Fate's
  // Mercy's quiet spell (utils/chunkedFate.ts mercyQuietLeft).
  const progressed = chained.gameModeId === 'chunked' && (chained.unlocks !== state.unlocks
    || chained.keys > state.keys || chained.specialKeys > state.specialKeys || chained.chaosKeys > state.chaosKeys);
  const next = progressed ? { ...chained, chunkedProgressAt: Date.now() } : chained;
  return { ...next, runRevision: state.runRevision + 1 };
};

/**
 * Computes reducer work once, including generated event IDs, timestamps, and
 * history hashes. React later receives this exact state instead of replaying
 * the transition against a potentially stale render snapshot.
 */
export const migrateSaveForTest = (save: Partial<GameState>): GameState => {
  const result = validateAndMigrateSave(save, createFreshState());
  if (result.ok === false) throw new Error(result.message);
  return result.state;
};

export const gameReducerForTest = gameReducer;

export const prepareGameTransition = (
  state: GameState & { lastEvent: GameEvent | null },
  action: TransitionAction,
): {
  state: GameState & { lastEvent: GameEvent | null };
  commit: Extract<Action, { type: 'COMMIT_STATE' }>;
} => {
  const next = gameReducer(state, action);
  return { state: next, commit: { type: 'COMMIT_STATE', payload: next } };
};

// --- Context ---
const GameContext = createContext<GameContextType | null>(null);
export const subscribeToPendingSaveChanges = (listener: () => void): (() => void) => {
  let subscribed = true;
  // Avoid a synchronous external-store render interrupting state updates
  // queued by other passive effects in the same commit.
  const unsubscribe = subscribePendingSaves(() => {
    queueMicrotask(() => {
      if (subscribed) listener();
    });
  });
  return () => {
    subscribed = false;
    unsubscribe();
  };
};

type GameProviderProps = {
  children: React.ReactNode;
  storageKey: string;
  leaseOptions?: ProfileWriterLeaseOptions;
  bootstrap?: SaveBootstrapResult;
  coordinator?: SaveCoordinator;
  readOnly?: boolean;
};

const unavailableRecoveryRepository: RecoveryRepository = {
  getHead: async () => null,
  putHead: async () => ({ stored: false, reason: 'storage_unavailable' }),
  listCheckpoints: async () => [],
  putCheckpoint: async () => ({ stored: false, reason: 'storage_unavailable' }),
  deleteCheckpoints: async () => ({ stored: false, reason: 'storage_unavailable' }),
  getMetadata: async () => null,
  putMetadata: async () => ({ stored: false, reason: 'storage_unavailable' }),
  close: () => undefined,
};

/**
 * Keep the provider mount synchronous while IndexedDB opens. Coordinator
 * writes wait for the repository promise, and an unavailable browser falls
 * back to the compatibility mirror with degraded recovery status.
 */
const createDeferredRecoveryRepository = (
  open: () => Promise<RecoveryRepository>,
): RecoveryRepository => {
  let closed = false;
  let resolved: RecoveryRepository | null = null;
  const ready = open()
    .then(repository => {
      if (closed) repository.close();
      else resolved = repository;
      return closed ? null : repository;
    })
    .catch(() => null);
  const withRepository = async <T,>(
    operation: (repository: RecoveryRepository) => Promise<T>,
    fallback: T,
  ): Promise<T> => {
    const repository = resolved ?? await ready;
    if (repository === null || closed) return fallback;
    try {
      return await operation(repository);
    } catch {
      return fallback;
    }
  };
  return {
    getHead: profileId => withRepository(repository => repository.getHead(profileId), null),
    putHead: (record, authorizeWrite) => withRepository(
      repository => repository.putHead(record, authorizeWrite),
      { stored: false, reason: 'storage_unavailable' },
    ),
    listCheckpoints: profileId => withRepository(
      repository => repository.listCheckpoints(profileId),
      [],
    ),
    maxPersistenceRevision: profileId => withRepository(
      async repository => repository.maxPersistenceRevision
        ? repository.maxPersistenceRevision(profileId)
        : Math.max(
          (await repository.getHead(profileId))?.persistenceRevision ?? 0,
          ...(await repository.listCheckpoints(profileId))
            .map(checkpoint => checkpoint.persistenceRevision),
        ),
      0,
    ),
    putCheckpoint: (record, authorizeWrite) => withRepository(
      repository => repository.putCheckpoint(record, authorizeWrite),
      { stored: false, reason: 'storage_unavailable' },
    ),
    deleteCheckpoints: (profileId, revisions, authorizeWrite) => withRepository(
      repository => repository.deleteCheckpoints(profileId, revisions, authorizeWrite),
      { stored: false, reason: 'storage_unavailable' },
    ),
    getMetadata: <T,>(key: string) => withRepository(
      repository => repository.getMetadata<T>(key),
      null,
    ),
    putMetadata: <T,>(key: string, value: T, authorizeWrite: () => SaveWriteAuthorization) => withRepository(
      repository => repository.putMetadata(key, value, authorizeWrite),
      { stored: false, reason: 'storage_unavailable' },
    ),
    close: () => {
      closed = true;
      resolved?.close();
    },
  };
};

const coordinatorStorage = (): Pick<Storage, 'getItem' | 'setItem'> &
  Partial<Pick<Storage, 'removeItem'>> => {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => { throw new Error('Profile storage is unavailable.'); },
      removeItem: () => undefined,
    };
  }
};

const profileIdFromStorageKey = (storageKey: string): string =>
  storageKey.startsWith('FATE_PROFILE_')
    ? storageKey.slice('FATE_PROFILE_'.length)
    : storageKey;

const hydrateLocalGuideProgress = (state: GameState): GameState => {
  try { return migrateLocalRuneProofProgress(state, localStorage); }
  catch { return state; }
};

export const GameProvider: React.FC<GameProviderProps> = ({
  children,
  storageKey,
  leaseOptions,
  bootstrap,
  coordinator: suppliedCoordinator,
  readOnly = false,
}) => {
  const initialLoadWarningRef = useRef<string | null>(null);
  const persistedSnapshotRef = useRef<string | null>(null);
  const {
    status: leaseStatus,
    blockedReason: leaseBlockReason,
    authorizeWrite: authorizeOwnership,
    takeOver: takeOverOwnership,
    release: releaseOwnership,
  } = useProfileWriterLease(storageKey, leaseOptions);
  // Regaining the lease is not enough to write: if another tab saved newer
  // progress meanwhile and this tab has unsaved changes, writes stay blocked
  // until the player keeps this tab's progress or loads the newer save.
  const [newerSaveConflict, setNewerSaveConflict] = useState(false);
  const newerSaveConflictRef = useRef(false);
  const blockedSinceOwnedRef = useRef(false);
  if (leaseStatus === 'blocked') blockedSinceOwnedRef.current = true;
  const saveOwnershipStatus: SaveOwnershipStatus = newerSaveConflict ? 'blocked' : leaseStatus;
  const saveOwnershipBlockReason: SaveOwnershipBlockReason = newerSaveConflict
    ? 'newer_save'
    : leaseBlockReason;
  const saveOwnershipStatusRef = useRef(saveOwnershipStatus);
  saveOwnershipStatusRef.current = saveOwnershipStatus;
  const saveOwnershipBlockReasonRef = useRef(saveOwnershipBlockReason);
  saveOwnershipBlockReasonRef.current = saveOwnershipBlockReason;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const authorizeOwnershipRef = useRef(authorizeOwnership);
  authorizeOwnershipRef.current = authorizeOwnership;
  const [state, dispatch] = useReducer(
    gameReducer,
    bootstrap ?? storageKey,
    (source): GameState & { lastEvent: GameEvent | null } => {
      if (typeof source !== 'string') {
        // Bootstrap already validated the primary bytes. The parsed state is
        // the provider's canonical representation, so use its serialization
        // as the baseline instead of staging a needless mirror write merely
        // because the original JSON used a different property order.
        persistedSnapshotRef.current = source.initialData === null
          ? null
          : serializeGameState(source.initialState);
        return { ...hydrateLocalGuideProgress(source.initialState), lastEvent: null };
      }
      const key = source;
      let saved: string | null = null;
      let durableReadFailed = false;
      try {
        saved = localStorage.getItem(key);
        persistedSnapshotRef.current = saved;
      } catch {
        durableReadFailed = true;
      }
      const pending = getPendingSave(key);
      if (pending) {
        const parsed = parseAndMigrateSave(pending.data, createFreshState());
        if (parsed.ok === true) return { ...hydrateLocalGuideProgress(parsed.state), lastEvent: null };
        discardPendingSave(key);
        console.warn('Pending save failed validation', parsed.code, parsed.path ?? 'root');
      }
      if (durableReadFailed) {
        initialLoadWarningRef.current = 'Saved run data could not be read, so a fresh run was started.';
        console.warn('Stored save could not be read');
      } else if (saved) {
        const parsed = parseAndMigrateSave(saved, createFreshState());
        if (parsed.ok === true) return { ...hydrateLocalGuideProgress(parsed.state), lastEvent: null };
        initialLoadWarningRef.current = 'Saved run data was invalid, so a fresh run was started.';
        console.warn('Stored save failed validation', parsed.code, parsed.path ?? 'root');
      }
      return { ...createFreshState(), lastEvent: null };
    },
  );
  const sessionStartSnapshotRef = useRef<{
    data: string;
    hasHistory: boolean;
  } | null>(null);
  if (sessionStartSnapshotRef.current === null) {
    sessionStartSnapshotRef.current = {
      data: serializeGameState(state),
      hasHistory: state.history.length > 0,
    };
  }
  const saveTimeoutRef = useRef<number | null>(null);
  const takeoverRequestedRef = useRef(false);
  const takeoverFlushAuthorizedRef = useRef(false);
  const profileEvictedRef = useRef(false);
  const mountedRef = useRef(false);
  const replacementGenerationRef = useRef(0);
  const stateMutationRef = useRef(0);
  const profileIdentityRef = useRef(storageKey);
  if (profileIdentityRef.current !== storageKey) {
    // A profile switch can reuse the provider instance. Invalidate callbacks
    // that are still awaiting the old profile before accepting the new one.
    profileIdentityRef.current = storageKey;
    replacementGenerationRef.current += 1;
    profileEvictedRef.current = false;
  }
  const [legacySaveStatus, setSaveStatus] = useState<SaveStatus>(() => getSaveStatus(storageKey));
  const [stateReplacements, setStateReplacements] = useState(0);
  useSyncExternalStore(
    subscribeToPendingSaveChanges,
    getPendingSaveRevision,
    getPendingSaveRevision,
  );
  const hasPendingChanges = getPendingSave(storageKey) !== null;

  useEffect(() => {
    const warning = initialLoadWarningRef.current;
    if (!warning) return;
    initialLoadWarningRef.current = null;
    showToast(warning);
  }, []);

  // Chunked mode's frontier walks the walking data (utils/walkSections.ts),
  // which otherwise loads only with the map's chunk content. Load it with
  // the run, so a Chunks roll uses it rather than the bare chunk grid.
  const chunkedRun = state.gameModeId === 'chunked';
  useEffect(() => {
    if (chunkedRun) loadWalkSections().catch(() => { /* the grid stands in; the map retries */ });
  }, [chunkedRun]);

  // Keep the free-area baseline in sync with the run's mode, synchronously so
  // the unlock helpers (chunkUnlocked, journal status, …) read the right set on
  // this render. Xtreme start frees only Lumbridge; every other mode frees all
  // of Misthalin.
  setStartArea(resolveModeRules(state.gameModeId, state.customMode).startArea);

  // Always-current snapshot of state so backup/reset callbacks can read the
  // latest persisted shape without re-creating on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;
  const serializeCurrent = useCallback(
    (): string => serializeGameState(stateRef.current),
    [],
  );

  const authorizeOwnedWrite = useCallback((): SaveWriteAuthorization => {
    if (profileEvictedRef.current) {
      return { ok: false, reason: 'ownership_conflict' };
    }
    if (readOnlyRef.current) {
      return { ok: false, reason: 'ownership_conflict' };
    }
    if (
      !takeoverFlushAuthorizedRef.current
      && (
        takeoverRequestedRef.current
        || newerSaveConflictRef.current
        || saveOwnershipStatusRef.current !== 'owner'
      )
    ) {
      return {
        ok: false,
        reason: saveOwnershipBlockReasonRef.current === 'storage_unavailable'
          ? 'storage_unavailable'
          : 'ownership_conflict',
      };
    }
    return authorizeOwnershipRef.current();
  }, []);

  const coordinatorRef = useRef<SaveCoordinator | null>(suppliedCoordinator ?? null);
  const recoveryRepositoryRef = useRef<RecoveryRepository | null>(null);
  const profileId = profileIdFromStorageKey(storageKey);
  if (
    coordinatorRef.current === null
    && (suppliedCoordinator !== undefined || bootstrap !== undefined)
  ) {
    const repository = typeof indexedDB === 'undefined'
      ? unavailableRecoveryRepository
      : createDeferredRecoveryRepository(() => openRecoveryDatabase());
    recoveryRepositoryRef.current = repository;
    coordinatorRef.current = suppliedCoordinator ?? createSaveCoordinator({
      profileId,
      storageKey,
      storage: coordinatorStorage(),
      repository,
      authorizeWrite: authorizeOwnedWrite,
      validate: data => parseAndMigrateSave(data, createFreshState()),
      checksum: checksumSave,
      now: Date.now,
      initialPersistenceRevision: bootstrap === undefined
        ? 0
        : bootstrap.maxDurablePersistenceRevision,
    });
  }
  const coordinator = coordinatorRef.current;
  // Another tab may have advanced the journal while this one was blocked.
  // Declared before the save effects so a flush in the same commit waits for it.
  useEffect(() => {
    if (leaseStatus === 'owner') void coordinator?.resyncRevision?.();
  }, [coordinator, leaseStatus]);
  const coordinatorSnapshotRef = useRef<SaveDurabilitySnapshot>(
    coordinator?.getSnapshot() ?? {
      primary: 'saved',
      recovery: 'checking',
      savedAt: null,
    },
  );
  const subscribeToCoordinator = useCallback((listener: () => void): (() => void) => {
    if (coordinator === null) return () => undefined;
    let subscribed = true;
    const unsubscribe = coordinator.subscribe(() => {
      // Match the pending-save bridge: coordinator.stage() can be called by a
      // passive effect while another effect is still queueing UI state. Let
      // that state update commit before useSyncExternalStore renders from the
      // new durability snapshot.
      queueMicrotask(() => {
        if (!subscribed) return;
        coordinatorSnapshotRef.current = coordinator.getSnapshot();
        listener();
      });
    });
    return () => {
      subscribed = false;
      unsubscribe();
    };
  }, [coordinator]);
  const getCoordinatorSnapshot = useCallback(
    (): SaveDurabilitySnapshot => coordinatorSnapshotRef.current,
    [],
  );
  const coordinatorDurability = useSyncExternalStore(
    subscribeToCoordinator,
    getCoordinatorSnapshot,
    getCoordinatorSnapshot,
  );
  const saveStatus: SaveStatus = coordinator === null
    ? legacySaveStatus
    : saveOwnershipBlockReason === 'storage_unavailable'
      || saveOwnershipStatus === 'blocked'
      ? 'failed'
      : coordinatorDurability.primary;
  const saveDurability: SaveDurabilitySnapshot = coordinator === null
    ? {
      primary: legacySaveStatus,
      recovery: legacySaveStatus === 'failed' ? 'degraded' : 'checking',
      savedAt: null,
      ...(legacySaveStatus === 'failed'
        ? {
          failureReason: isOwnershipConflictBlock(saveOwnershipBlockReason)
            ? 'ownership_conflict' as const
            : 'storage_unavailable' as const,
        }
        : {}),
    }
    : saveStatus === 'failed' && coordinatorDurability.primary !== 'failed'
      ? {
        ...coordinatorDurability,
        primary: 'failed',
        recovery: coordinatorDurability.recovery === 'checking'
          ? 'degraded'
          : coordinatorDurability.recovery,
        failureReason: coordinatorDurability.failureReason
          ?? (isOwnershipConflictBlock(saveOwnershipBlockReason)
            ? 'ownership_conflict'
            : 'storage_unavailable'),
      }
      : coordinatorDurability;

  const liveCoordinatorFailureReason = useCallback((): 'storage_unavailable' | 'ownership_conflict' => {
    if (profileEvictedRef.current) return 'ownership_conflict';
    // Re-read the lease at the point of failure. The render snapshot can be
    // one tick behind a pagehide/storage event that changed the owner.
    const authorization = authorizeOwnership();
    return authorization.ok === false ? authorization.reason : 'storage_unavailable';
  }, [authorizeOwnership]);

  const stageCoordinatedSnapshot = useCallback((data: string): void => {
    stagePendingSave(storageKey, data);
    coordinator?.stage(data);
  }, [coordinator, storageKey]);

  const pushOwnedBackup = useCallback((data: string, reason: string): BackupWriteResult =>
    pushBackup(storageKey, data, reason, authorizeOwnedWrite), [authorizeOwnedWrite, storageKey]);

  const intervalCheckpointRef = useRef<{ data: string; capturedAt: number } | null>(null);
  const intervalCheckpointBaselineRef = useRef<string | null>(
    persistedSnapshotRef.current === null ? null : serializeGameState(state),
  );
  const intervalCheckpointQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionStartCapturedAtRef = useRef(Date.now());
  const maybeCreateIntervalCheckpoint = useCallback((data: string): Promise<void> => {
    if (coordinator === null || data.length === 0) return Promise.resolve();
    const create = async (): Promise<void> => {
      const now = Date.now();
      const previous = intervalCheckpointRef.current;
      const elapsed = now - (previous?.capturedAt ?? sessionStartCapturedAtRef.current);
      // A durable head save alone is not a checkpoint. Only capture after the
      // bytes differ from the last persisted/checkpoint baseline.
      if (
        elapsed < RECOVERY_CHECKPOINT_INTERVAL_MS
        || intervalCheckpointBaselineRef.current === data
      ) return;

      let result: BackupWriteResult;
      try {
        result = await coordinator.createCheckpoint(data, 'interval');
      } catch {
        result = { stored: false, reason: 'storage_unavailable' };
      }
      // The old ring remains a best-effort compatibility path. Do not let a
      // ring write make a failed journal checkpoint look durable.
      pushOwnedBackup(data, 'Interval checkpoint');
      if (result.stored === true) {
        intervalCheckpointRef.current = { data, capturedAt: now };
        intervalCheckpointBaselineRef.current = data;
      }
    };
    const queued = intervalCheckpointQueueRef.current.then(create, create);
    intervalCheckpointQueueRef.current = queued.catch(() => undefined);
    return queued;
  }, [coordinator, pushOwnedBackup]);

  const settleCoordinatedFlush = useCallback(async (): Promise<SaveDurabilitySnapshot> => {
    if (coordinator === null) {
      return {
        primary: legacySaveStatus,
        recovery: 'checking',
        savedAt: null,
      };
    }
    await coordinator.flush();
    await coordinator.whenIdle();
    const result = coordinator.getSnapshot();
    coordinatorSnapshotRef.current = result;
    const pending = getPendingSave(storageKey);
    const current = serializeCurrent();
    if (result.primary === 'saved' && (pending === null || pending.data === current)) {
      persistedSnapshotRef.current = pending?.data ?? current;
      discardPendingSave(storageKey);
      await maybeCreateIntervalCheckpoint(current);
    } else if (result.primary === 'failed') {
      blockPendingSave(
        storageKey,
        liveCoordinatorFailureReason(),
      );
    }
    return result;
  }, [coordinator, legacySaveStatus, liveCoordinatorFailureReason, maybeCreateIntervalCheckpoint, serializeCurrent, storageKey]);

  const stageForProfileEviction = useCallback((): void => {
    profileEvictedRef.current = true;
    // Invalidate replacements that are already crossing an async boundary
    // before preserving the last snapshot for the old profile.
    replacementGenerationRef.current += 1;
    stateMutationRef.current += 1;
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    stageCoordinatedSnapshot(serializeCurrent());
    blockPendingSave(storageKey, 'ownership_conflict');
    if (mountedRef.current) setSaveStatus(getSaveStatus(storageKey));
    releaseOwnership();
  }, [releaseOwnership, serializeCurrent, stageCoordinatedSnapshot, storageKey]);

  const flushCurrentSave = useCallback((): boolean => {
    if (
      profileEvictedRef.current
      || (!takeoverFlushAuthorizedRef.current
        && (takeoverRequestedRef.current
          || saveOwnershipStatusRef.current !== 'owner'))
    ) {
      blockPendingSave(
        storageKey,
        !profileEvictedRef.current
          && saveOwnershipBlockReasonRef.current === 'storage_unavailable'
          ? 'storage_unavailable'
          : 'ownership_conflict',
      );
      if (mountedRef.current) {
        setSaveStatus(saveOwnershipBlockReasonRef.current === 'storage_unavailable'
          ? 'failed'
          : getSaveStatus(storageKey));
      }
      return false;
    }

    const pending = getPendingSave(storageKey);
    const result = flushPendingSave(localStorage, storageKey, authorizeOwnedWrite);
    if (result.ok === true) {
      if (pending !== null) persistedSnapshotRef.current = pending.data;
      if (mountedRef.current) setSaveStatus('saved');
      return true;
    }
    if (mountedRef.current) {
      setSaveStatus(
        result.reason === 'storage_unavailable'
        || saveOwnershipBlockReasonRef.current === 'storage_unavailable'
          ? 'failed'
          : getSaveStatus(storageKey),
      );
    }
    return result.ok;
  }, [authorizeOwnedWrite, storageKey]);

  // Debounced persistence - saves all persistent state fields
  useEffect(() => {
    const snapshot = serializeGameState(state);
    const existingPending = getPendingSave(storageKey);
    if (snapshot === persistedSnapshotRef.current && existingPending === null) {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      setSaveStatus(saveOwnershipBlockReason === 'storage_unavailable'
        ? 'failed'
        : 'saved');
      return;
    }

    stageCoordinatedSnapshot(snapshot);
    if (profileEvictedRef.current) {
      blockPendingSave(storageKey, 'ownership_conflict');
    } else if (saveOwnershipStatus !== 'owner') {
      blockPendingSave(
        storageKey,
        saveOwnershipBlockReason === 'storage_unavailable'
          ? 'storage_unavailable'
          : 'ownership_conflict',
      );
    }
    if (saveOwnershipBlockReason === 'storage_unavailable') {
      setSaveStatus('failed');
    } else {
      setSaveStatus(getSaveStatus(storageKey));
    }
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (
      profileEvictedRef.current
      || saveOwnershipStatus !== 'owner'
      || takeoverRequestedRef.current
    ) return;

    const scheduledReplacementGeneration = replacementGenerationRef.current;
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      if (replacementGenerationRef.current !== scheduledReplacementGeneration) return;
      if (coordinator === null) {
        flushCurrentSave();
        return;
      }
      coordinator.stage(serializeCurrent());
      void settleCoordinatedFlush();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [
    flushCurrentSave,
    coordinator,
    saveOwnershipBlockReason,
    saveOwnershipStatus,
    serializeCurrent,
    state,
    stageCoordinatedSnapshot,
    storageKey,
    settleCoordinatedFlush,
  ]);

  const stageCurrentSnapshotForLifecycle = useCallback(() => {
    const snapshot = serializeCurrent();
    const pending = getPendingSave(storageKey);
    const needsStaging = pending === null
      ? snapshot !== persistedSnapshotRef.current
      : pending.data !== snapshot;
    if (needsStaging) {
      stageCoordinatedSnapshot(snapshot);
    }
    if (profileEvictedRef.current) {
      blockPendingSave(storageKey, 'ownership_conflict');
    }
  }, [serializeCurrent, stageCoordinatedSnapshot, storageKey]);

  const flushAndReleaseOwnership = useCallback(() => {
    stageCurrentSnapshotForLifecycle();
    if (profileEvictedRef.current) {
      blockPendingSave(storageKey, 'ownership_conflict');
      releaseOwnership();
      return;
    }
    if (coordinator !== null) {
      const authorization = authorizeOwnedWrite();
      if (authorization.ok === false) {
        blockPendingSave(storageKey, authorization.reason);
        return;
      }
      const snapshot = serializeCurrent();
      const mirrored = coordinator.mirrorLifecycle(snapshot);
      const durability = coordinator.getSnapshot();
      coordinatorSnapshotRef.current = durability;
      const pending = getPendingSave(storageKey);
      if (mirrored && durability.primary === 'saved') {
        persistedSnapshotRef.current = snapshot;
        discardPendingSave(storageKey);
      } else if (pending !== null || snapshot !== persistedSnapshotRef.current) {
        stagePendingSave(storageKey, snapshot);
      }
      if (mirrored) releaseOwnership();
      return;
    }
    const flushed = getPendingSave(storageKey) !== null
      ? flushCurrentSave()
      : authorizeOwnedWrite().ok;
    if (flushed && getPendingSave(storageKey) === null) releaseOwnership();
  }, [
    authorizeOwnedWrite,
    coordinator,
    flushCurrentSave,
    releaseOwnership,
    serializeCurrent,
    stageCurrentSnapshotForLifecycle,
    storageKey,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    const onPageHide = () => flushAndReleaseOwnership();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('pagehide', onPageHide);
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      flushAndReleaseOwnership();
    };
  }, [flushAndReleaseOwnership]);

  useEffect(() => {
    if (coordinator === null) return;
    return () => {
      const repository = recoveryRepositoryRef.current;
      // StrictMode replays effect cleanup/setup on the same mounted provider.
      // Only destroy the durable writer after an actual unmount, not that replay.
      queueMicrotask(() => {
        if (mountedRef.current && coordinatorRef.current === coordinator) return;
        coordinator.dispose();
        if (recoveryRepositoryRef.current === repository) recoveryRepositoryRef.current = null;
        repository?.close();
      });
    };
  }, [coordinator]);

  const journalImportRequestedRef = useRef(false);
  const sessionBackupFinishedRef = useRef(false);
  const sessionBackupInFlightRef = useRef(false);
  const sessionCheckpointReadyRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const [sessionCheckpointRetryTick, setSessionCheckpointRetryTick] = useState(0);
  useEffect(() => {
    if (
      coordinator === null
      || bootstrap?.needsJournalImport !== true
      || bootstrap.initialData === null
      || saveOwnershipStatus !== 'owner'
      || journalImportRequestedRef.current
    ) return;
    journalImportRequestedRef.current = true;
    // The bootstrap bytes have already been validated into initialState. Use
    // the provider's canonical serialization for the journal import so an
    // equivalent JSON property order cannot be mistaken for a newer state by
    // the ordinary persistence completion.
    stageCoordinatedSnapshot(serializeCurrent());
    void settleCoordinatedFlush();
  }, [
    bootstrap,
    coordinator,
    saveOwnershipStatus,
    serializeCurrent,
    settleCoordinatedFlush,
    stageCoordinatedSnapshot,
  ]);

  const legacyMigrationRunningRef = useRef(false);
  const legacyMigrationGenerationRef = useRef(0);
  useEffect(() => {
    const repository = recoveryRepositoryRef.current;
    if (
      coordinator === null
      || repository === null
      || saveOwnershipStatus !== 'owner'
      || legacyMigrationRunningRef.current
    ) return;
    legacyMigrationRunningRef.current = true;
    const generation = ++legacyMigrationGenerationRef.current;
    let active = true;
    const authorizeMigrationWrite = (): SaveWriteAuthorization => (
      active
      && generation === legacyMigrationGenerationRef.current
      && mountedRef.current
        ? authorizeOwnedWrite()
        : { ok: false, reason: 'ownership_conflict' }
    );
    void (async () => {
      try {
        // The session checkpoint is the first journal observation for this
        // mount. Wait for its complete attempt (including its ring copy) so a
        // legacy import cannot race it and claim the next recovery sequence.
        await Promise.resolve();
        const sessionCheckpointReady = await sessionCheckpointReadyRef.current;
        if (!sessionCheckpointReady || !active || generation !== legacyMigrationGenerationRef.current) return;
        await coordinator.whenIdle();
        if (!active || generation !== legacyMigrationGenerationRef.current || profileEvictedRef.current) return;
        let rawRing: string | null = null;
        try {
          rawRing = localStorage.getItem(profileBackupKey(storageKey));
        } catch {
          // IndexedDB migration remains safe when the compatibility ring is
          // unavailable; no marker is written for missing bytes.
        }
        if (!active || generation !== legacyMigrationGenerationRef.current || rawRing === null) return;
        await migrateLegacyBackupRing({
          profileId,
          rawRing,
          repository,
          authorizeWrite: authorizeMigrationWrite,
          defaults: createFreshState(),
        });
      } finally {
        if (generation === legacyMigrationGenerationRef.current) legacyMigrationRunningRef.current = false;
      }
    })();
    return () => {
      active = false;
      if (generation === legacyMigrationGenerationRef.current) {
        legacyMigrationGenerationRef.current += 1;
        legacyMigrationRunningRef.current = false;
      }
    };
  }, [
    authorizeOwnedWrite,
    coordinator,
    profileId,
    saveOwnershipStatus,
    sessionCheckpointRetryTick,
    storageKey,
  ]);

  const retrySave = useCallback((): SaveRetryResult | Promise<SaveRetryResult> => {
    const staged = serializeCurrent();
    if (coordinator !== null) {
      stageCoordinatedSnapshot(staged);
      return settleCoordinatedFlush();
    }
    stagePendingSave(storageKey, staged);
    setSaveStatus(getSaveStatus(storageKey));
    // Keep the Task 1 compatibility path synchronous. The coordinator-backed
    // path is genuinely async, while callers can safely await either result.
    return flushCurrentSave();
  }, [coordinator, flushCurrentSave, serializeCurrent, settleCoordinatedFlush, stageCoordinatedSnapshot, storageKey]);

  const takeOverSaveOwnership = useCallback(async (): Promise<boolean> => {
    if (profileEvictedRef.current) return false;
    takeoverRequestedRef.current = true;
    try {
      const owned = await takeOverOwnership();
      if (!owned) return false;
      // The player chose this tab's progress, so the regained lease needs no
      // newer-save check, and any earlier conflict is resolved.
      blockedSinceOwnedRef.current = false;
      newerSaveConflictRef.current = false;
      setNewerSaveConflict(false);
      void coordinator?.resyncRevision?.();
      takeoverFlushAuthorizedRef.current = true;
      try {
        const staged = serializeCurrent();
        if (coordinator !== null) {
          stageCoordinatedSnapshot(staged);
          const result = await settleCoordinatedFlush();
          return result.primary === 'saved';
        }
        stagePendingSave(storageKey, staged);
        setSaveStatus(getSaveStatus(storageKey));
        return flushCurrentSave();
      } finally {
        takeoverFlushAuthorizedRef.current = false;
      }
    } finally {
      takeoverRequestedRef.current = false;
    }
  }, [coordinator, flushCurrentSave, serializeCurrent, settleCoordinatedFlush, stageCoordinatedSnapshot, storageKey, takeOverOwnership]);

  // One automatic snapshot per session (per profile mount), so "the run was
  // fine yesterday" is always recoverable from the ring — not just the
  // pre-import/pre-reset moments. pushBackup no-ops when nothing changed
  // since the newest entry, so idle reloads don't churn the ring.
  useEffect(() => {
    if (
      saveOwnershipStatus !== 'owner'
      || sessionBackupFinishedRef.current
      || sessionBackupInFlightRef.current
    ) return;
    const sessionStartSnapshot = sessionStartSnapshotRef.current!;
    if (!sessionStartSnapshot.hasHistory) {
      sessionBackupFinishedRef.current = true;
      sessionCheckpointReadyRef.current = Promise.resolve(true);
      return;
    }
    if (coordinator === null) {
      const result = pushOwnedBackup(sessionStartSnapshot.data, 'Session start');
      const complete = result.stored === true || result.reason !== 'ownership_conflict';
      if (complete) sessionBackupFinishedRef.current = true;
      sessionCheckpointReadyRef.current = Promise.resolve(complete);
      return;
    }

    const mutationAtStart = stateMutationRef.current;
    sessionBackupInFlightRef.current = true;
    let checkpointSucceeded = false;
    const attempt = (async (): Promise<boolean> => {
      let checkpoint: BackupWriteResult;
      try {
        checkpoint = await coordinator.createCheckpoint(sessionStartSnapshot.data, 'session-start');
      } catch {
        checkpoint = { stored: false, reason: 'storage_unavailable' };
      }
      if (!mountedRef.current || profileEvictedRef.current) return false;
      // The lease may have changed while IndexedDB was awaiting its commit.
      // A successful old-tab transaction must not complete this mount's
      // session bookkeeping or publish a compatibility copy afterward.
      if (!authorizeOwnedWrite().ok || checkpoint.stored !== true) return false;
      intervalCheckpointBaselineRef.current = sessionStartSnapshot.data;
      intervalCheckpointRef.current = {
        data: sessionStartSnapshot.data,
        capturedAt: Date.now(),
      };
      // The compatibility copy follows the verified journal checkpoint.
      pushOwnedBackup(sessionStartSnapshot.data, 'Session start');
      sessionBackupFinishedRef.current = true;
      checkpointSucceeded = true;
      return true;
    })().finally(() => {
      sessionBackupInFlightRef.current = false;
      // A state change while this attempt was awaiting storage can rerender
      // only while the in-flight guard is set. Schedule one fresh effect pass
      // after a failed attempt so that edit does not strand the session
      // checkpoint forever. The state-mutation comparison prevents a retry
      // loop for an unchanged snapshot or a persistent storage outage.
      if (
        !checkpointSucceeded
        && mountedRef.current
        && !profileEvictedRef.current
        && saveOwnershipStatusRef.current === 'owner'
        && stateMutationRef.current !== mutationAtStart
      ) {
        queueMicrotask(() => {
          if (
            mountedRef.current
            && !profileEvictedRef.current
            && !sessionBackupFinishedRef.current
          ) setSessionCheckpointRetryTick(current => current + 1);
        });
      }
    });
    sessionCheckpointReadyRef.current = attempt.then(result => result, () => false);
  }, [
    authorizeOwnedWrite,
    coordinator,
    pushOwnedBackup,
    saveOwnershipStatus,
    sessionCheckpointRetryTick,
    state,
  ]);

  // --- Actions ---

  const commitAction = useCallback((action: TransitionAction) => {
    const transition = prepareGameTransition(stateRef.current, action);
    stateMutationRef.current += 1;
    stateRef.current = transition.state;
    dispatch(transition.commit);
    return transition.state;
  }, []);

  const updateRuneProof = useCallback((expectedRunId: string, change: RuneProofMutation): boolean => {
    if (expectedRunId !== stateRef.current.runId || profileEvictedRef.current) return false;
    const authorization = authorizeOwnedWrite();
    if (authorization.ok === false && authorization.reason === 'ownership_conflict') {
      if (change.kind !== 'BIND') showToast('Take over saving this profile before changing guide progress');
      return false;
    }
    // Storage failures keep the new snapshot pending through the same visible
    // retry/export/unload-protection path as every other saved run change.
    commitAction({ type: 'UPDATE_RUNEPROOF', payload: { expectedRunId, change } });
    return true;
  }, [authorizeOwnedWrite, commitAction, saveOwnershipStatus]);

  // Gameplay RNG choke point (see GameContextType.nextFloat). Reads through
  // stateRef so one render's callbacks always draw against the latest chain
  // tip; the tip changes with every appended history entry, which is what
  // keeps successive draws independent. A seeded run draws from its seed, any
  // other run from its hidden salt (runDrawFloat), so a restored backup gives
  // the same result for the same action. Math.random is left only for a state
  // that has neither.
  const nextFloat = useCallback((purpose: string, index = 0): number =>
    runDrawFloat(stateRef.current, purpose, index) ?? Math.random(), []);
  const nextDice = useCallback((purpose: string, index = 0, max = 100): number =>
    Math.floor(nextFloat(purpose, index) * max) + 1, [nextFloat]);
  const setSeed = useCallback((seed: string) =>
    commitAction({ type: 'SET_SEED', payload: seed }), [commitAction]);

  const rollForKey = useCallback((
    source: string,
    threshold: number,
    failureFate: FailureFateAward,
    x?: number,
    y?: number,
    meta?: DetectedGameEventMeta,
    context?: KeyRollContext,
  ) => {
    // A pet gives its Omni-Key through claimPet; it never rolls.
    if (source === DropSource.PET) return;
    const current = stateRef.current;
    const action = context
      ? prepareKeyRollAction(current, source, threshold, failureFate, nextDice, x, y, meta, context)
      : prepareKeyRollAction(current, source, threshold, failureFate, nextDice, x, y, meta);
    if (action) commitAction(action);
  }, [commitAction, nextDice]);

  const unlockContent = useCallback((table: TableType, item: string, costType: 'key' | 'specialKey' | 'chaosKey', cost: number) => {
    commitAction({ type: 'UNLOCK', payload: { table, item, costType, cost } });
  }, [commitAction]);

  const rollUnlock = useCallback((table?: TableType) => {
    const costType = table === undefined ? 'chaosKey' : 'key';
    const draw = (usable?: (candidate: { table: TableType; item: string }) => boolean) => {
      const current = stateRef.current;
      if (current.pendingUnlock) return;
      if ((costType === 'key' ? current.keys : current.chaosKeys) < UNLOCK_COST) return;
      if (authorizeOwnership().ok === false) {
        showToast('Save ownership is unavailable. Restore save access before rolling.');
        return;
      }
      // Saradomin's Ward: fate still picks, but only from what the run can use right now.
      const warded = current.rituals?.ward === true && wardApplies(costType, table);
      if (warded && !usable) return;
      let pool = randomUnlockPool(current.unlocks, current.gameModeId, costType, table, current.customMode);
      if (warded && usable) pool = pool.filter(usable);
      // Chunked: one Chunks draw in six goes toward Fate's Thread (utils/fateLand.ts).
      if (table === TableType.CHUNKS) pool = leanTowardThread(pool, current.fateLand?.thread, nextFloat('fate-thread-lean'));
      const selection = pickRandomPoolEntry(pool, () => nextFloat(costType === 'key' ? 'gacha' : 'chaos'));
      if (!selection) {
        showToast(warded
          ? "Saradomin's Ward finds nothing here you can use yet. Your Key is safe: try another category."
          : 'No eligible unlocks remain. Open more locations or choose another category.');
        return;
      }
      const next = commitAction({ type: 'UNLOCK', payload: { ...selection, costType, cost: UNLOCK_COST, revealId: generateId(), ...(warded ? { ward: true } : {}) } });
      stageCoordinatedSnapshot(serializeGameState(next));
      if (coordinator) void settleCoordinatedFlush();
      else flushCurrentSave();
    };
    const current = stateRef.current;
    if (current.rituals?.ward !== true || !wardApplies(costType, table)) { draw(); return; }
    // The Ward's activity checks load with the first warded spend, not with the app.
    import('../utils/ritualWard').then(({ wardUsable }) => {
      if (!mountedRef.current) return;
      draw(c => wardUsable(c.table, c.item, stateRef.current.unlocks, stateRef.current.gameModeId ?? DEFAULT_MODE_ID));
    }, () => showToast("Saradomin's Ward couldn't load. Check your connection and try again; your Key is safe."));
  }, [authorizeOwnership, commitAction, coordinator, flushCurrentSave, nextFloat, settleCoordinatedFlush, stageCoordinatedSnapshot]);
  const acknowledgeUnlock = useCallback((id: string) => {
    if (getPendingSave(storageKey) || (coordinator && coordinator.getSnapshot().primary !== 'saved')) return;
    commitAction({ type: 'ACKNOWLEDGE_UNLOCK', payload: id });
  }, [commitAction, coordinator, storageKey]);

  const performRitual = useCallback((type: 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE') => {
    if (type === 'LUCK') commitAction({ type: 'RITUAL_LUCK' });
    if (type === 'GREED') commitAction({ type: 'RITUAL_GREED' });
    if (type === 'CHAOS') commitAction({ type: 'RITUAL_CHAOS' });
    if (type === 'TRANSMUTE') commitAction({ type: 'RITUAL_TRANSMUTE' });
  }, [commitAction]);

  /** Void Gambit: stake ALL fate on a coin flip (RNG here — reducer stays pure). */
  const performGambit = useCallback(() => {
    const current = stateRef.current;
    const stake = current.fatePoints;
    // The minimum stake scales with the mode, exactly as the Altar shows it, and so does the
    // price of each Key a win pays.
    const multiplier = resolveModeRules(current.gameModeId, current.customMode).ritualCostMultiplier;
    if (stake < ritualFateCost('GAMBIT', multiplier)) return;
    const won = nextFloat('gambit') < 0.5;
    const keysWon = gambitKeys(stake, multiplier);
    commitAction({ type: 'RITUAL_GAMBIT', payload: { won, stake, keysWon } });
  }, [commitAction, nextFloat]);

  /** The newer rituals. Fate's picks (the brother, the tiers taken) are drawn here; the reducer stays pure. */
  const castRitual = useCallback((id: NewRitualId, invocations?: Invocation['id'][]) => {
    const current = stateRef.current;
    if (id === 'WARD') commitAction({ type: 'RITUAL_WARD' });
    else if (id === 'TEARS') commitAction({ type: 'RITUAL_TEARS' });
    else if (id === 'PACT') commitAction({ type: 'RITUAL_PACT' });
    else if (id === 'INVOCATIONS') commitAction({ type: 'RITUAL_INVOCATIONS', payload: { ids: invocations ?? [] } });
    else if (id === 'BARROWS') {
      const brother = BARROWS_BROTHERS[Math.min(BARROWS_BROTHERS.length - 1, Math.floor(nextFloat('barrows') * BARROWS_BROTHERS.length))];
      commitAction({ type: 'RITUAL_BARROWS', payload: { brother: brother.id } });
    } else if (id === 'SACRIFICE') {
      commitAction({ type: 'RITUAL_SACRIFICE', payload: { taken: pickSacrifice(current.unlocks, i => nextFloat('sacrifice', i)) } });
    }
  }, [commitAction, nextFloat]);

  const rollBreakthrough = useCallback((skill: string) => {
    const before = stateRef.current;
    const tier = breakthroughTier(before, skill);
    if (tier === null || before.pendingUnlock) return;
    if (authorizeOwnership().ok === false) {
      showToast('Save ownership is unavailable. Restore save access before rolling.');
      return;
    }
    const next = commitAction({ type: 'CHUNKED_BREAKTHROUGH', payload: { skill, roll: nextFloat('breakthrough'), revealId: generateId() } });
    if (next === before) return;
    // A win plays the unlock reveal once saved, as a Key's unlock does; a loss
    // says so, or the row would just vanish.
    if (next.pendingUnlock) {
      stageCoordinatedSnapshot(serializeGameState(next));
      if (coordinator) void settleCoordinatedFlush();
      else flushCurrentSave();
    } else {
      showToast(`No Breakthrough: ${skill} stays at tier ${tier - 1}. Levels past ${tierCap(tier - 1)} roll nothing until a Key opens its next tier.`);
    }
  }, [authorizeOwnership, commitAction, coordinator, flushCurrentSave, nextFloat, settleCoordinatedFlush, stageCoordinatedSnapshot]);

  const callOnFate = useCallback(() => {
    if (mercyBlocker(stateRef.current) !== null) return;
    if (authorizeOwnership().ok === false) {
      showToast('Save ownership is unavailable. Restore save access before calling on fate.');
      return;
    }
    // Mercy stays shut while a quest in the run's chunks is doable. That needs
    // the chunk content, so the provider loads it and lists the quests itself
    // rather than trusting the caller's list; without the content, no call.
    importWithRetry(() => import('../utils/mercyQuests'))
      .then(({ loadDoableChunkedQuests }) => loadDoableChunkedQuests(() => stateRef.current))
      .then((doableQuests) => {
        if (!mountedRef.current) return;
        if (doableQuests === null) {
          showToast("Fate's Mercy couldn't check your chunks for doable quests. Check your connection and try again.");
          return;
        }
        const before = stateRef.current;
        const next = commitAction({ type: 'CALL_ON_FATE', payload: { roll: nextFloat('mercy'), revealId: generateId(), doableQuests } });
        if (next === before) return;
        stageCoordinatedSnapshot(serializeGameState(next));
        if (coordinator) void settleCoordinatedFlush();
        else flushCurrentSave();
      }, () => showToast("Fate's Mercy couldn't load. Check your connection and try again."));
  }, [authorizeOwnership, commitAction, coordinator, flushCurrentSave, nextFloat, settleCoordinatedFlush, stageCoordinatedSnapshot]);

  const rollGilded = useCallback((chunk: string, x?: number, y?: number) => {
    const before = stateRef.current;
    if (before.pendingUnlock || !before.fateLand?.gilded.includes(chunk)) return;
    const next = commitAction({ type: 'FATE_MARK_ROLL', payload: { chunk } });
    if (next === before) return;
    rollForKey(DropSource.FATE_MARK, DROP_RATES[DropSource.FATE_MARK], failureFateForSource(DropSource.FATE_MARK), x, y);
  }, [commitAction, rollForKey]);

  const exploreChunk = useCallback((chunk: string, fact: string, x?: number, y?: number) => {
    if (exploreBlocker(stateRef.current, chunk, fact) !== null) return;
    commitAction({ type: 'CHUNK_EXPLORE', payload: { chunk, fact } });
    rollForKey(DropSource.CHUNK_EXPLORE, DROP_RATES[DropSource.CHUNK_EXPLORE], failureFateForSource(DropSource.CHUNK_EXPLORE), x, y);
  }, [commitAction, rollForKey]);

  /** Cartographer: the offer fate drew (drawing it now if none is kept), as chunk keys. */
  const drawCartographerChoices = useCallback((): string[] => {
    const next = commitAction({ type: 'CARTOGRAPHER_DRAW_OFFER' });
    return liveCartographerOffer(next);
  }, [commitAction]);

  /** Cartographer: unlock the chosen chunk of the offer (Chunked mode only). */
  const performCartographer = useCallback((chunkKey: string, label: string) => {
    commitAction({ type: 'RITUAL_CARTOGRAPHER', payload: { chunkKey, label } });
  }, [commitAction]);

  const levelUpSkill = useCallback((skill: string) => {
    const levelBefore = stateRef.current.unlocks.levels[skill] || 1;
    // Level 99 is the cap; a level-up that changes nothing earns no roll.
    if (levelBefore >= 99) return;
    // Pre-compute RNG outside reducer to maintain reducer purity
    const chaosRoll = nextFloat('levelup');
    const prepared = prepareLevelUpActions(stateRef.current, skill, chaosRoll, nextDice);
    const levelState = commitAction(prepared.levelAction);
    if ((levelState.unlocks.levels[skill] || 1) === levelBefore || !prepared.rewardAction) return;
    const levelUpMeta = levelState.lastEvent?.type === 'LEVEL_UP'
      ? levelState.lastEvent.meta
      : undefined;
    commitAction({
      ...prepared.rewardAction,
      payload: {
        ...prepared.rewardAction.payload,
        meta: { ...prepared.rewardAction.payload.meta, ...levelUpMeta },
      },
    });
  }, [commitAction, nextDice, nextFloat]);

  const acceptDetectedEvent = useCallback((
    progress: DetectedProgress,
    intent: RollIntent,
    meta: DetectedGameEventMeta,
    expected: DetectedEventIdentity,
  ): boolean => {
    const current = stateRef.current;
    if (!detectedEventIdentityMatches(current, expected)) return false;
    if (progress.kind === 'PET') {
      return commitAction({
        type: 'ACCEPT_DETECTED_PET',
        payload: { petId: progress.petId, petName: intent.target, meta, expected, preparedRevision: current.runRevision },
      }) !== current;
    }
    try {
      const action = prepareDetectedEventAcceptanceAction(
        current,
        progress,
        intent,
        nextDice,
        meta,
        expected,
      );
      return commitAction(action) !== current;
    } catch {
      return false;
    }
  }, [commitAction, nextDice]);

  const logCollectionItem = useCallback((itemId: number) => {
    commitAction({ type: 'LOG_ITEM', payload: itemId });
  }, [commitAction]);

  const setLoadoutSlot = useCallback((slot: string, itemId: number | null, clearSlots?: string[]) => {
    commitAction({ type: 'SET_LOADOUT_SLOT', payload: { slot, itemId, clearSlots } });
  }, [commitAction]);
  const setLinkedAccount = useCallback((account: string) => {
    commitAction({ type: 'SET_LINKED_ACCOUNT', payload: account });
  }, [commitAction]);

  const renameLinkedAccount = useCallback((from: string, to: string) => {
    commitAction({ type: 'RENAME_LINKED_ACCOUNT', payload: { from, to } });
  }, [commitAction]);

  const setRival = useCallback((rival: RivalState) =>
    commitAction({ type: 'SET_RIVAL', payload: rival }), [commitAction]);
  const clearRival = useCallback(() => commitAction({ type: 'CLEAR_RIVAL' }), [commitAction]);
  const ackRival = useCallback((lead: number) =>
    commitAction({ type: 'ACK_RIVAL', payload: lead }), [commitAction]);

  const completeOnboarding = useCallback(() =>
    commitAction({ type: 'COMPLETE_ONBOARDING' }), [commitAction]);
  const resolveFateCompensation = useCallback((choice: FateCompensationChoice) =>
    commitAction({ type: 'RESOLVE_FATE_COMPENSATION', payload: choice }), [commitAction]);
  const resolvePetCompensation = useCallback((
    choice: PetCompensationChoice,
    keyOnly: ReadonlyArray<PetChoice>,
    omni: ReadonlyArray<PetChoice>,
  ) => commitAction({
    type: 'RESOLVE_PET_COMPENSATION',
    payload: {
      choice,
      keyOnly: keyOnly.map(pet => pet?.id ?? null),
      omni: omni.map(pet => pet?.id ?? null),
      petNames: [...keyOnly, ...omni].flatMap(pet => (pet ? [pet.name] : [])),
    },
  }), [commitAction]);
  const claimPet = useCallback((pet: { id: number; name: string }, x?: number, y?: number) =>
    commitAction({ type: 'CLAIM_PET', payload: { petId: pet.id, petName: pet.name, x, y } }), [commitAction]);
  // Fate picks each free ritual here, so the reducer stays pure. Settled achievements draw nothing.
  const settleAchievementsCallback = useCallback((earned: AchievementPayout[]) => {
    const modeId = stateRef.current.gameModeId;
    let draw = 0;
    const claimed = stateRef.current.achievementsClaimed;
    const payload = earned.map((a) => (a.freeRituals > 0 && !claimed?.includes(a.id)
      ? { ...a, ritualPicks: Array.from({ length: a.freeRituals }, () => pickFreeRitual(modeId, nextFloat('achievement-ritual', draw++))) }
      : a));
    commitAction({ type: 'SETTLE_ACHIEVEMENTS', payload });
  }, [commitAction, nextFloat]);
  const setAchievementTitle = useCallback((id: string | null) =>
    commitAction({ type: 'SET_ACHIEVEMENT_TITLE', payload: id }), [commitAction]);
  const setGameMode = useCallback((modeId: string, customRules?: GameModeRules) =>
    commitAction({ type: 'SET_GAME_MODE', payload: { modeId, customRules } }), [commitAction]);
  const toggleAnimations = useCallback(() => commitAction({ type: 'TOGGLE_ANIMATIONS' }), [commitAction]);
  const toggleAdvisors = useCallback(() => commitAction({ type: 'TOGGLE_ADVISORS' }), [commitAction]);
  const toggleRevealAll = useCallback(() => commitAction({ type: 'TOGGLE_REVEAL_ALL' }), [commitAction]);
  const replaceState = useCallback((replacement: GameState) => {
    stateMutationRef.current += 1;
    stateRef.current = { ...replacement, lastEvent: null };
    // Batched into the same render as the new history.
    setStateReplacements(count => count + 1);
    dispatch({ type: 'LOAD_SAVE', payload: replacement });
  }, []);
  const reloadLatestSave = useCallback((): ImportResult => {
    let durable: string | null;
    try {
      durable = localStorage.getItem(storageKey);
    } catch {
      return {
        ok: false,
        code: 'storage_unavailable',
        message: 'The latest saved run could not be read. Your current run is unchanged.',
      };
    }
    if (durable === null) {
      return {
        ok: false,
        code: 'invalid_json',
        message: 'No saved run was found. Your current run is unchanged.',
      };
    }
    const parsed = parseAndMigrateSave(durable, createFreshState());
    if (parsed.ok === false) return parsed;

    const accepted = serializeGameState(parsed.state);
    persistedSnapshotRef.current = accepted;
    discardPendingSave(storageKey);
    setSaveStatus('saved');
    newerSaveConflictRef.current = false;
    setNewerSaveConflict(false);
    replaceState(parsed.state);
    return { ok: true, warnings: parsed.warnings };
  }, [replaceState, storageKey]);

  // When a tab that was blocked regains the lease on its own (the other tab
  // closed or its lease expired), the other tab may have saved newer
  // progress. Load it if this tab has nothing unsaved; otherwise keep writes
  // blocked and let the player choose, as a manual takeover would.
  useEffect(() => {
    if (leaseStatus !== 'owner' || !blockedSinceOwnedRef.current) return;
    blockedSinceOwnedRef.current = false;
    if (takeoverRequestedRef.current || profileEvictedRef.current) return;

    let stored: string | null;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      return;
    }
    const baseline = persistedSnapshotRef.current;
    if (stored === null || stored === baseline) return;
    const parsed = parseAndMigrateSave(stored, createFreshState());
    if (parsed.ok === false) return;
    const latest = serializeGameState(parsed.state);
    if (latest === baseline) return;

    const unsavedChanges = getPendingSave(storageKey) !== null
      || (baseline !== null && serializeCurrent() !== baseline);
    if (!unsavedChanges) {
      persistedSnapshotRef.current = latest;
      discardPendingSave(storageKey);
      replaceState(parsed.state);
      showToast('Loaded newer progress saved in another tab');
      return;
    }
    newerSaveConflictRef.current = true;
    saveOwnershipStatusRef.current = 'blocked';
    saveOwnershipBlockReasonRef.current = 'newer_save';
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    blockPendingSave(storageKey, 'ownership_conflict');
    setNewerSaveConflict(true);
  }, [leaseStatus, replaceState, serializeCurrent, storageKey]);

  const writeReplacement = useCallback((data: string) => {
    writeReplacementNow(
      localStorage,
      storageKey,
      data,
      saveTimeoutRef,
      handle => window.clearTimeout(handle),
      authorizeOwnedWrite,
    );
    persistedSnapshotRef.current = data;
    discardPendingSave(storageKey);
    setSaveStatus('saved');
  }, [authorizeOwnedWrite, storageKey]);

  const beginReplacement = useCallback((): (() => boolean) => {
    const generation = ++replacementGenerationRef.current;
    const mutation = stateMutationRef.current;
    const expectedCurrent = serializeCurrent();
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    return () => mountedRef.current
      && !profileEvictedRef.current
      && replacementGenerationRef.current === generation
      && stateMutationRef.current === mutation
      && serializeCurrent() === expectedCurrent;
  }, [serializeCurrent]);

  const writeCoordinatedReplacement = useCallback(async (
    data: string,
    reason: string,
    isCurrent: () => boolean = () => true,
  ): Promise<SaveDurabilitySnapshot> => {
    const failed = (savedAt: number | null = null): SaveDurabilitySnapshot => ({
      primary: 'failed',
      recovery: 'degraded',
      savedAt,
    });
    if (!isCurrent()) return failed();
    if (coordinator === null) {
      writeReplacement(data);
      if (!isCurrent()) return failed(Date.now());
      return {
        primary: 'saved',
        recovery: 'degraded',
        savedAt: Date.now(),
      };
    }
    stageCoordinatedSnapshot(data);
    const result = await coordinator.writeReplacement(data, reason);
    await coordinator.whenIdle();
    const coordinatorSnapshot = coordinator.getSnapshot();
    const settled = result.failureReason === undefined
      ? coordinatorSnapshot
      : { ...coordinatorSnapshot, failureReason: result.failureReason };
    coordinatorSnapshotRef.current = settled;
    if (!isCurrent()) return failed(settled.savedAt);
    if (settled.primary === 'saved') {
      persistedSnapshotRef.current = data;
      discardPendingSave(storageKey);
    } else {
      const failureReason = settled.failureReason ?? liveCoordinatorFailureReason();
      blockPendingSave(storageKey, failureReason);
      return { ...settled, failureReason };
    }
    return settled;
  }, [coordinator, liveCoordinatorFailureReason, stageCoordinatedSnapshot, storageKey, writeReplacement]);

  const createCoordinatedCheckpoint = useCallback(async (
    data: string,
    reason: RecoveryCheckpointReason,
  ): Promise<BackupWriteResult> => {
    const compatibilityReason = reason === 'session-start'
      ? 'Session start'
      : reason === 'pre-replacement'
        ? 'Before replacement'
        : reason === 'legacy-import'
          ? 'Legacy import'
          : 'Interval checkpoint';
    if (coordinator === null) return pushOwnedBackup(data, compatibilityReason);
    const expectedGeneration = replacementGenerationRef.current;
    const checkpoint = await coordinator.createCheckpoint(data, reason);
    // Keep the old eight-entry ring as a best-effort rollback path, while
    // preserving the journal result as the source of durability truth.
    if (checkpoint.stored === true) intervalCheckpointBaselineRef.current = data;
    if (
      mountedRef.current
      && !profileEvictedRef.current
      && replacementGenerationRef.current === expectedGeneration
    ) pushOwnedBackup(data, compatibilityReason);
    return checkpoint;
  }, [coordinator, pushOwnedBackup]);

  // Every import and restore carries the run's restore count, merged with
  // this profile's own count, which the replacement cannot roll back
  // (utils/restoreCount.ts). The profile's count is written once it lands.
  const stampReplacement = useCallback((prepared: SaveValidationResult, kind: RestoreKind) => {
    const stamped = stampRestoreCount(prepared, stateRef.current, readRestoreCounts(localStorage, storageKey), kind);
    const settle = (result: ImportResult): ImportResult => {
      if (result.ok) writeRestoreCounts(localStorage, storageKey, stamped.counts);
      return result;
    };
    return { prepared: stamped.prepared, settle };
  }, [storageKey]);

  const importSave = useCallback(async (data: unknown): Promise<ImportResult> => {
    const authorization = authorizeOwnedWrite();
    if (authorization.ok === false) return saveAuthorizationFailureResult(authorization.reason);
    const isCurrent = beginReplacement();
    const { prepared, settle } = stampReplacement(prepareReplacement(data, stateRef.current, createFreshState()), 'import');
    if (coordinator !== null) {
      return settle(await applyValidatedReplacementAsync(
        prepared,
        {
          current: stateRef.current,
          createCheckpoint: createCoordinatedCheckpoint,
          writeReplacement: (replacementData, reason) =>
            writeCoordinatedReplacement(replacementData, reason, isCurrent),
          replace: replaceState,
          isCurrent,
        },
      ));
    }
    if (!isCurrent()) return replacementStaleResult();
    return settle(applyValidatedReplacement(prepared, {
      current: stateRef.current,
      writeBackup: current => pushOwnedBackup(current, 'Before import'),
      writeReplacement,
      replace: replaceState,
    }));
  }, [authorizeOwnedWrite, beginReplacement, coordinator, createCoordinatedCheckpoint, pushOwnedBackup, replaceState, stampReplacement, writeCoordinatedReplacement, writeReplacement]);

  const createBackup = useCallback((reason: string): BackupWriteResult | Promise<BackupWriteResult> => {
    const data = serializeCurrent();
    if (coordinator === null) return pushOwnedBackup(data, reason);

    const expectedProfile = profileIdentityRef.current;
    const expectedGeneration = replacementGenerationRef.current;
    const copyCompatibilityBackup = () => {
      if (
        mountedRef.current
        && !profileEvictedRef.current
        && profileIdentityRef.current === expectedProfile
        && replacementGenerationRef.current === expectedGeneration
      ) pushOwnedBackup(data, reason);
    };
    return coordinator.createCheckpoint(data, 'pre-replacement')
      .then(result => {
        if (result.stored === true) intervalCheckpointBaselineRef.current = data;
        copyCompatibilityBackup();
        return result;
      })
      .catch(() => {
        copyCompatibilityBackup();
        return { stored: false, reason: 'storage_unavailable' as const };
      });
  }, [coordinator, pushOwnedBackup, serializeCurrent]);

  const listBackups = useCallback(async (): Promise<BackupMeta[]> => {
    const repository = recoveryRepositoryRef.current;
    if (repository === null) return readBackups(storageKey);
    return readBackups(storageKey, { profileId, repository });
  }, [profileId, storageKey]);

  const restoreBackup = useCallback(async (id: string | number): Promise<ImportResult> => {
    const authorization = authorizeOwnedWrite();
    if (authorization.ok === false) return saveAuthorizationFailureResult(authorization.reason);
    const isCurrent = beginReplacement();
    let data: string | null = await getBackupDataById(storageKey, id);
    if (!isCurrent()) return replacementStaleResult();
    const repository = recoveryRepositoryRef.current;
    if (data === null && typeof id === 'string' && repository !== null) {
      try {
        const checkpoints = await repository.listCheckpoints(profileId);
        if (!isCurrent()) return replacementStaleResult();
        const checkpoint = checkpoints.find(candidate => (
          `checkpoint:${profileId}:${candidate.persistenceRevision}` === id
        ));
        if (checkpoint !== undefined) {
          const checksum = await checksumSave(checkpoint.data);
          if (!isCurrent()) return replacementStaleResult();
          if (checksum !== checkpoint.checksum) {
            return {
              ok: false,
              code: 'invalid_json',
              message: 'This backup failed its integrity check and was not restored.',
            };
          }
          data = checkpoint.data;
        }
      } catch {
        data = null;
      }
    }
    if (data === null) {
      return { ok: false, code: 'invalid_json', message: 'Backup was not found.' };
    }
    const { prepared, settle } = stampReplacement(parseAndMigrateSave(data, createFreshState()), 'restore');
    if (coordinator !== null) {
      return settle(await applyValidatedReplacementAsync(
        prepared,
        {
          current: stateRef.current,
          createCheckpoint: createCoordinatedCheckpoint,
          writeReplacement: (replacementData, reason) =>
            writeCoordinatedReplacement(replacementData, reason, isCurrent),
          replace: replaceState,
          isCurrent,
        },
      ));
    }
    if (!isCurrent()) return replacementStaleResult();
    return settle(applyValidatedReplacement(prepared, {
      current: stateRef.current,
      writeBackup: current => pushOwnedBackup(current, 'Before restore'),
      writeReplacement,
      replace: replaceState,
    }));
  }, [authorizeOwnedWrite, beginReplacement, coordinator, createCoordinatedCheckpoint, profileId, replaceState, stampReplacement, storageKey, writeCoordinatedReplacement, writeReplacement]);

  const resetGame = useCallback(async (): Promise<void> => {
    // Auto-snapshot so an accidental reset is recoverable.
    const isCurrent = beginReplacement();
    // Remember the run being reset, so importing it again counts as a restore.
    writeRestoreCounts(localStorage, storageKey, rememberRun(readRestoreCounts(localStorage, storageKey), stateRef.current));
    if (coordinator !== null) {
      const replacement = createFreshState();
      const backup = await createCoordinatedCheckpoint(
        serializeCurrent(),
        'pre-replacement',
      );
      if (!isCurrent()) return;
      const durability = await writeCoordinatedReplacement(
        serializeGameState(replacement),
        'reset',
        isCurrent,
      );
      if (!isCurrent()) return;
      if (durability.primary === 'saved') replaceState(replacement);
      if (
        backup.stored === false
        && backup.reason === 'storage_unavailable'
        && durability.primary === 'saved'
      ) setSaveStatus('saved');
      return;
    }
    if (!isCurrent()) return;
    pushOwnedBackup(serializeCurrent(), 'Before reset');
    setStateReplacements(count => count + 1);
    commitAction({ type: 'RESET' });
  }, [beginReplacement, commitAction, coordinator, createCoordinatedCheckpoint, pushOwnedBackup, replaceState, serializeCurrent, setSaveStatus, storageKey, writeCoordinatedReplacement]);
  const togglePin = useCallback((id: string) => commitAction({ type: 'TOGGLE_PIN', payload: id }), [commitAction]);
  const saveNote = useCallback((id: string, text: string) =>
    commitAction({ type: 'UPDATE_NOTE', payload: { id, text } }), [commitAction]);
  const completeQuest = useCallback((id: string, x?: number, y?: number, attestation: CompletionAttestation = {}): CompletionResult => {
    const snapshot = stateRef.current;
    const quest = QUEST_DATA[id];
    if (!quest) return completionFailure('Unknown quest');

    const result = questCompletionDecision(quest, snapshot.unlocks, snapshot.gameModeId, attestation);
    if (result.ok === false) return completionFailure(result.reason);

    commitAction({ type: 'COMPLETE_QUEST', payload: id });
    rollForKey(quest.difficulty, DROP_RATES[quest.difficulty], failureFateForSource(quest.difficulty), x, y);
    return result;
  }, [commitAction, rollForKey]);

  const completeDiaryTask = useCallback((
    id: string,
    x?: number,
    y?: number,
    attestation: CompletionAttestation = {},
  ): CompletionResult => {
    const snapshot = stateRef.current;
    const task = ALL_DIARY_TASKS.find(candidate => candidate.id === id);
    if (!task) return completionFailure('Unknown Diary task');
    const diary = DIARY_DATA[task.tierId];
    if (!diary) return completionFailure('Unknown Diary tier');

    const result = diaryTaskCompletionDecision(
      task,
      snapshot.unlocks,
      snapshot.gameModeId,
      attestation,
    );
    if (result.ok === false) return completionFailure(result.reason);

    commitAction({ type: 'COMPLETE_TASK', payload: id });
    rollForKey(diary.difficulty, DROP_RATES[diary.difficulty], failureFateForSource(diary.difficulty), x, y);

    const current = stateRef.current;
    if (
      !current.unlocks.diaries.includes(task.tierId)
      && canEarnDiaryTier(
        task.tierId,
        current.unlocks.completedTasks,
        ALL_DIARY_TASKS,
      )
    ) {
      commitAction({ type: 'COMPLETE_DIARY', payload: task.tierId });
    }
    return result;
  }, [commitAction, rollForKey]);

  const completeDiaryTier = useCallback((id: string): CompletionResult => {
    const snapshot = stateRef.current;
    if (!DIARY_DATA[id]) return completionFailure('Unknown Diary tier');
    if (snapshot.unlocks.diaries.includes(id)) {
      return completionFailure('Already completed');
    }
    if (!canEarnDiaryTier(id, snapshot.unlocks.completedTasks, ALL_DIARY_TASKS)) {
      return completionFailure('Complete all individual tasks in this section first');
    }

    commitAction({ type: 'COMPLETE_DIARY', payload: id });
    return { ok: true };
  }, [commitAction]);

  const completeCATask = useCallback((
    id: string,
    x?: number,
    y?: number,
  ): CompletionResult => {
    const task = ALL_CA_TASKS.find(candidate => candidate.id === id);
    if (!task) return completionFailure('Unknown Combat Achievement task');

    const prepared = prepareCATaskCompletionActions(
      stateRef.current,
      task,
      nextDice,
      x,
      y,
    );
    if (prepared.result.ok === false) {
      return completionFailure(prepared.result.reason);
    }
    for (const action of prepared.actions) commitAction(action);
    return prepared.result;
  }, [commitAction, nextDice]);

  const completeCATier = useCallback((id: string): CompletionResult => {
    const snapshot = stateRef.current;
    const points = completedCAPoints(snapshot.unlocks.completedTasks);
    const result = caTierCompletionDecision(id, points, snapshot.unlocks.cas);
    if (result.ok === false) return completionFailure(result.reason);

    commitAction({ type: 'COMPLETE_CA', payload: id });
    return result;
  }, [commitAction]);

  const getExportData = useCallback((): string => serializeCurrent(), [serializeCurrent]);

  const contextValue = useMemo(() => ({
    ...state,
    saveStatus,
    saveOwnershipStatus,
    saveOwnershipBlockReason,
    hasPendingChanges,
    saveDurability,
    stateReplacements,
    retrySave,
    stageForProfileEviction,
    takeOverSaveOwnership,
    reloadLatestSave,
    rollForKey,
    acceptDetectedEvent,
    unlockContent,
    rollUnlock,
    acknowledgeUnlock,
    performRitual,
    performGambit,
    drawCartographerChoices,
    performCartographer,
    castRitual,
    rollBreakthrough,
    callOnFate,
    exploreChunk,
    rollGilded,
    levelUpSkill,
    toggleAnimations,
    toggleAdvisors,
    toggleRevealAll,
    completeOnboarding,
    resolveFateCompensation,
    resolvePetCompensation,
    claimPet,
    settleAchievements: settleAchievementsCallback,
    setAchievementTitle,
    setGameMode,
    setSeed,
    nextFloat,
    importSave,
    resetGame,
    createBackup,
    listBackups,
    restoreBackup,
    togglePin,
    saveNote,
    updateRuneProof,
    completeQuest,
    completeDiaryTask,
    completeDiaryTier,
    completeCATask,
    completeCATier,
    logCollectionItem,
    getExportData,
    setLoadoutSlot,
    setLinkedAccount,
    renameLinkedAccount,
    setRival,
    clearRival,
    ackRival
  }), [
    state,
    saveStatus,
    saveOwnershipStatus,
    saveOwnershipBlockReason,
    hasPendingChanges,
    saveDurability,
    stateReplacements,
    retrySave,
    stageForProfileEviction,
    takeOverSaveOwnership,
    reloadLatestSave,
    rollForKey,
    acceptDetectedEvent,
    unlockContent,
    rollUnlock,
    acknowledgeUnlock,
    performRitual,
    performGambit,
    drawCartographerChoices,
    performCartographer,
    castRitual,
    rollBreakthrough,
    callOnFate,
    exploreChunk,
    rollGilded,
    levelUpSkill,
    toggleAnimations,
    toggleAdvisors,
    toggleRevealAll,
    completeOnboarding,
    resolveFateCompensation,
    resolvePetCompensation,
    claimPet,
    settleAchievementsCallback,
    setAchievementTitle,
    setGameMode,
    setSeed,
    nextFloat,
    importSave,
    resetGame,
    createBackup,
    listBackups,
    restoreBackup,
    togglePin,
    saveNote,
    updateRuneProof,
    completeQuest,
    completeDiaryTask,
    completeDiaryTier,
    completeCATask,
    completeCATier,
    logCollectionItem,
    getExportData,
    setLoadoutSlot,
    setLinkedAccount,
    renameLinkedAccount,
    setRival,
    clearRival,
    ackRival
  ]);

  // A rolled unlock is revealed only once it is saved, so a refresh can't
  // reroll it. Once its reveal has shown, later saves (the run keeps saving
  // while the reveal is open) must not take it down again: that replayed the
  // reveal and flashed the whole app a second time.
  const pendingUnlockId = state.pendingUnlock?.id ?? null;
  const rollSaved = saveStatus === 'saved' && !hasPendingChanges;
  const [revealedUnlockId, setRevealedUnlockId] = useState<string | null>(null);
  if (pendingUnlockId && rollSaved && revealedUnlockId !== pendingUnlockId) setRevealedUnlockId(pendingUnlockId);
  const rollAwaitingSave = !!pendingUnlockId && !rollSaved && revealedUnlockId !== pendingUnlockId;
  const hideRunForFailedRoll = rollAwaitingSave && saveStatus === 'failed';

  return (
    <GameContext.Provider value={contextValue}>
      <div style={{ display: hideRunForFailedRoll ? 'none' : 'contents' }}>{children}</div>
      {rollAwaitingSave ? (
        // While the roll is still being written, cover the run without hiding
        // it: hiding it reset every scroll position and flashed the whole app
        // away and back. Only a failed save takes the run off screen.
        <div role="status" className={`fixed inset-0 z-[300] text-gray-100 flex flex-col items-center justify-center gap-4 p-6 text-center ${
          saveStatus === 'failed' ? 'bg-[#121212]' : 'bg-black/60 backdrop-blur-md'}`}>
          <div className={saveStatus === 'failed' ? 'contents' : 'contents [&>*]:opacity-0 [&>*]:animate-[fade-in-up_0.3s_ease-out_0.5s_forwards]'}>
            <p>{saveStatus === 'failed' ? 'Your roll is waiting to be saved. Retry to reveal the same result.' : 'Saving your roll…'}</p>
            <button type="button" className="px-4 py-2 rounded border border-amber-400 text-amber-300" onClick={() => void retrySave()}>Retry save</button>
          </div>
        </div>
      ) : state.pendingUnlock ? <PendingUnlockReveal pending={state.pendingUnlock} animationsEnabled={state.animationsEnabled} onAccept={acknowledgeUnlock}
        tier={state.pendingUnlock.table === TableType.SKILLS ? state.unlocks.skills[state.pendingUnlock.item] : undefined}
        chunkedUnlocks={state.gameModeId === 'chunked' ? state.unlocks : undefined} /> : null}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
