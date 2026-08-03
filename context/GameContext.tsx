
import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { GameState, LogEntry, UnlockState, DropSource, TableType, RivalState, type DetectedEventIdentity, type DetectedProgress, type FailureFateAward, type FateCompensationChoice, type GameEventMeta as DetectedGameEventMeta, type RollIntent } from '../types';
import { EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST } from '../data/items';
import { DROP_RATES, EQUIPMENT_TIER_MAX } from '../config/rules';
import { resolveModeRules, DEFAULT_MODE_ID } from '../config/gameModes';
import { setStartArea } from '../utils/freeAreas';
import type { GameModeRules } from '../config/gameModes';
import { getActiveRegionBonuses } from '../config/regionModifiers';
import { failureFateForSkillLevel, failureFateForSource, getRitual, isSkillChaosMilestone, XTREME_MILESTONE_INTERVAL, CHUNKED_MILESTONE_INTERVAL, GREED_REFUND_FRACTION, GAMBIT_KEYS_PER } from '../config/economy';
import { BANK_BY_ID } from '../data/banks';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { CA_DATA } from '../data/caData';
import { ALL_CA_TASKS, CATask } from '../data/caTasks';
import { QUEST_DATA } from '../data/questData';
import { UNLOCK_COST } from '../utils/gameEngine';
import { canonicalAreaName, canonicalizeAreaUnlocks } from '../data/areaMapPolicy';
import { drawFloat } from '../utils/seededRng';
import { hashEntry, ensureChain } from '../utils/integrity';
import { pushBackup, listBackups as readBackups, getBackupData, BackupMeta } from '../utils/backups';
import {
  applyPreparedReplacement,
  applyValidatedReplacement,
  serializeCurrent as serializeGameState,
  SaveAuthorizationError,
  SaveOwnershipConflictError,
  saveAuthorizationFailureResult,
  type BackupWriteResult,
  type ImportResult,
} from '../utils/gamePersistence';
import { CURRENT_SAVE_VERSION, MAX_COUNTER, parseAndMigrateSave, validateAndMigrateSave } from '../utils/saveSchema';
import { showToast } from '../utils/toast';
import { LEGACY_FATE_COMPENSATION_ID } from '../utils/fateCompensation';
import { normalizeAccountName } from '../services/fateEventProtocol';
import {
  canEarnDiaryTier,
  diaryTaskCompletionDecision,
  questCompletionDecision,
  withJournalCompletion,
} from '../utils/journalCompletion';
import type { CompletionAttestation, CompletionResult } from '../utils/journalCompletion';
import {
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
import { effectiveVanillaClueRate, vanillaBossKeyStage } from '../config/vanillaKeyEconomy';
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
import type {
  SaveOwnershipBlockReason,
  SaveOwnershipStatus,
  SaveWriteAuthorization,
} from '../utils/profileWriterLease';


// --- Types ---
const SAVE_DEBOUNCE_MS = 500;

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
type RitualEventMeta = { type: 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE' | 'GAMBIT' | 'CARTOGRAPHER'; won?: boolean; chunk?: string };
type LevelUpEventMeta = { skill: string; level: number; totalLevel: number; chaosKeysAwarded: number; chaosKeyAwarded: boolean };

type GameEventMeta = (RollEventMeta & DetectedGameEventMeta) | UnlockEventMeta | RitualEventMeta | LevelUpEventMeta;

type GameEvent = {
  id: string;
  type: 'ROLL_SUCCESS' | 'ROLL_FAIL' | 'ROLL_OMNI' | 'ROLL_PITY' | 'UNLOCK' | 'RITUAL' | 'LEVEL_UP';
  x?: number;
  y?: number;
  meta?: GameEventMeta;
};

interface GameContextType extends GameState {
  lastEvent: GameEvent | null;
  saveStatus: SaveStatus;
  saveOwnershipStatus: SaveOwnershipStatus;
  saveOwnershipBlockReason: SaveOwnershipBlockReason;
  hasPendingChanges: boolean;
  retrySave: () => boolean;
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
  performRitual: (type: 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE') => void;
  performGambit: () => void;
  performCartographer: (chunkKey: string, label: string) => void;
  levelUpSkill: (skill: string) => void;
  toggleAnimations: () => void;
  toggleAdvisors: () => void;
  toggleRevealAll: () => void;
  completeOnboarding: () => void;
  resolveFateCompensation: (choice: FateCompensationChoice) => void;
  setGameMode: (modeId: string, customRules?: GameModeRules) => void;
  /** Seeded runs — set/clear the seed (only while the run has no history). */
  setSeed: (seed: string) => void;
  /**
   * Gameplay RNG choke point. On a seeded run this derives from
   * (rngSeed, newest history hash, purpose, index) — deterministic and
   * replayable; on an unseeded run it's Math.random. EVERY gameplay outcome
   * (rolls, table picks, gambles) must draw through here, never Math.random
   * directly — that's what makes seeded runs raceable and verifiable.
   * Visual-only randomness (particles, animation jitter) is exempt.
   */
  nextFloat: (purpose: string, index?: number) => number;
  importSave: (data: unknown) => ImportResult;
  resetGame: () => void;
  /** Snapshot the current run before something overwrites it. */
  createBackup: (reason: string) => BackupWriteResult;
  /** Backups for the active profile, newest first. */
  listBackups: () => BackupMeta[];
  /** Restore a backup by timestamp (snapshots the current run first). */
  restoreBackup: (ts: number) => ImportResult;
  togglePin: (id: string) => void;
  saveNote: (id: string, text: string) => void;
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
  version: CURRENT_SAVE_VERSION,
  runId: newRunId(),
  runRevision: 0,
  keys: 3,
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
  activeBuff: 'NONE',
  unlocks: getInitialUnlocks(),
  history: [],
  bossStandardKeysAwarded: {},
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

const createFreshState = (): GameState => ({
  ...initialState,
  unlocks: getInitialUnlocks(),
  history: [],
  pinnedGoals: [],
  userNotes: {},
  loadout: {},
  runId: newRunId(),
  runRevision: 0,
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
}

export type Action =
  | { type: 'LOAD_SAVE'; payload: GameState }
  | { type: 'RESET' }
  | { type: 'TOGGLE_ANIMATIONS' }
  | { type: 'TOGGLE_ADVISORS' }
  | { type: 'TOGGLE_REVEAL_ALL' }
  | { type: 'SET_SEED'; payload: string }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'RESOLVE_FATE_COMPENSATION'; payload: FateCompensationChoice }
  | { type: 'ROLL_RESULT'; payload: PreparedRollResult }
  | {
    type: 'ACCEPT_DETECTED_EVENT';
    payload: {
      progress: DetectedProgress;
      rollResult: PreparedRollResult;
      expected: DetectedEventIdentity;
      skillChaos?: {
        chaosKeysAwarded: number;
        guaranteedChaosKeysAwarded: number;
        randomChaosKeysAwarded: number;
      };
    };
  }
  | { type: 'SYNC_DETECTED_PROGRESS'; payload: DetectedProgress }
  | { type: 'UNLOCK'; payload: { table: TableType; item: string; costType: 'key' | 'specialKey' | 'chaosKey'; cost: number } }
  | { type: 'RITUAL_LUCK' }
  | { type: 'RITUAL_GREED' }
  | { type: 'RITUAL_CHAOS' }
  | { type: 'RITUAL_TRANSMUTE' }
  | { type: 'RITUAL_GAMBIT'; payload: { won: boolean; stake: number; keysWon: number } }
  | { type: 'RITUAL_CARTOGRAPHER'; payload: { chunkKey: string; label: string } }
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
  | { type: 'SET_RIVAL'; payload: RivalState }
  | { type: 'CLEAR_RIVAL' }
  | { type: 'ACK_RIVAL'; payload: number }
  | { type: 'LOG_ITEM'; payload: number }
  | { type: 'COMMIT_STATE'; payload: GameState & { lastEvent: GameEvent | null } };

export type TransitionAction = Exclude<Action, { type: 'COMMIT_STATE' }>;

type DiceRoller = (purpose: string, index?: number, max?: number) => number;
type RollResultAction = Extract<TransitionAction, { type: 'ROLL_RESULT' }>;

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
  const vanillaBossContext = state.gameModeId === 'vanilla' && context?.kind === 'boss'
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

  // Do not advance seeded RNG (or consume a buff) after a boss reserve ends.
  if (bossStage?.capped) return null;

  const mode = resolveModeRules(state.gameModeId, state.customMode);
  let successBonus = 0;
  let omniBonus = 0;
  if (mode.regionModifiers) {
    const bonuses = getActiveRegionBonuses(state.unlocks.regions);
    successBonus = bonuses.successBonus;
    omniBonus = bonuses.omniBonus;
  }

  const clueAwarded = vanillaClueContext ? state.clueStandardKeysAwarded ?? 0 : 0;
  const isVanillaContext = vanillaBossContext !== null || vanillaClueContext !== null;
  const rollPurpose = vanillaBossContext
    ? `roll:boss:${vanillaBossContext.bossName}:${bossStage!.awarded}`
    : vanillaClueContext
      ? `roll:clue:${vanillaClueContext.clueTier}:${clueAwarded}`
      : 'roll';

  let roll: number;
  let baseThreshold: number;
  let effectiveThreshold: number;
  let success: boolean;
  if (isVanillaContext) {
    baseThreshold = bossStage?.currentRate
      ?? effectiveVanillaClueRate(threshold, clueAwarded);
    effectiveThreshold = normalizePercent(Math.max(0, Math.min(100, baseThreshold + successBonus)));
    const exactRoll = (index: number) => resolveKeyRoll(
      (nextDice(rollPurpose, index, 10_000) - 1) / 10_000,
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
    const rollUnitToFloat = (unit: number): number => (unit - 1) / 1000;
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

  let omni = false;
  let pity = false;

  if (success) {
    let omniChance = mode.omniChanceBase + omniBonus;
    if (source === DropSource.QUEST_GRANDMASTER) omniChance = Math.max(omniChance, 20);
    else if (source === DropSource.DIARY_ELITE) omniChance = Math.max(omniChance, 10);
    else if (source === 'Diary Section Complete') omniChance = Math.max(omniChance, 10);
    else if (source === 'CA Tier Complete') omniChance = Math.max(omniChance, 10);
    else if (source === DropSource.PET) omniChance = Math.max(omniChance, 25);
    else if (source === DropSource.RAID) omniChance = Math.max(omniChance, 15);
    else if (source === DropSource.BOSS_HIGH) omniChance = Math.max(omniChance, 10);

    if (nextDice(rollPurpose, 2) <= omniChance) omni = true;
  } else if (mode.pityEnabled && state.fatePoints + failureFate >= mode.pityThreshold) {
    pity = true;
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
    },
  };
}

export const detectedEventIdentityMatches = (
  state: Pick<GameState, 'runId' | 'runRevision' | 'linkedAccount'>,
  expected: DetectedEventIdentity,
): boolean => Boolean(state.linkedAccount)
  && state.runId === expected.runId
  && state.runRevision === expected.runRevision
  && normalizeAccountName(state.linkedAccount!) === normalizeAccountName(expected.account);

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
      .filter(isSkillChaosMilestone).length
    : 0;
  const randomChaosKeysAwarded = progress.kind === 'SKILL_LEVEL' && progress.level > currentSkillLevel
    && nextDice('detected-skill-chaos', 0, 100) <= 2
    ? 1
    : 0;
  const skillChaos = guaranteedChaosKeysAwarded || randomChaosKeysAwarded
    ? { chaosKeysAwarded: guaranteedChaosKeysAwarded + randomChaosKeysAwarded, guaranteedChaosKeysAwarded, randomChaosKeysAwarded }
    : undefined;

  const rollResult = prepareKeyRollAction(
    state,
    intent.source,
    intent.threshold,
    intent.failureFate,
    nextDice,
    undefined,
    undefined,
    skillChaos ? { ...meta, ...skillChaos } : meta,
  ).payload;
  return { type: 'ACCEPT_DETECTED_EVENT', payload: { progress, rollResult, expected, skillChaos } };
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
  if (state.unlocks.completedTasks.includes(task.id)) {
    return {
      result: { ok: false, reason: 'Already completed' },
      actions: [],
    };
  }
  const tier = CA_DATA[task.tierId];
  if (!tier) {
    return {
      result: { ok: false, reason: 'Unknown Combat Achievement tier' },
      actions: [],
    };
  }

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
 */
export const prepareLevelUpActions = (
  state: GameState,
  skill: string,
  chaosRoll: number,
  nextDice: DiceRoller,
): {
  levelAction: LevelUpAction;
  rewardAction: RollResultAction;
} => {
  const newLevel = (state.unlocks.levels[skill] || 1) + 1;
  const rollChance = skillLevelKeyChance(newLevel);
  return {
    levelAction: { type: 'LEVEL_UP', payload: { skill, chaosRoll } },
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

// Fate cost of a ritual after the run's mode multiplier. Costs live in
// config/economy.ts (RITUALS) — the single source the Codex and Void Altar
// also read, so the three can never disagree.
const ritualFateCost = (id: 'LUCK' | 'GREED' | 'CHAOS' | 'CARTOGRAPHER', mult: number): number =>
  Math.round((getRitual(id).fateCost ?? 0) * mult);

const rawReducer = (state: GameState & { lastEvent: GameEvent | null }, action: Action): GameState & { lastEvent: GameEvent | null } => {
  const now = Date.now();

  switch (action.type) {
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

    case 'SET_GAME_MODE': {
      // The mode is permanent once chosen — or if the run already has history
      // (defensive, covers saves predating the lock flag).
      if (state.gameModeLocked || state.history.length > 0) return state;
      return {
        ...state,
        gameModeId: action.payload.modeId,
        customMode: action.payload.customRules,
        gameModeLocked: true,
      };
    }

    case 'SET_SEED': {
      // Like the game mode, the seed is part of the run's identity — it can
      // be chosen or changed only while the run has no history.
      if (state.history.length > 0) return state;
      return { ...state, rngSeed: action.payload || undefined };
    }

    case 'ACCEPT_DETECTED_EVENT': {
      if (!detectedEventIdentityMatches(state, action.payload.expected)) return state;
      const progress = action.payload.progress;
      const guaranteedChaosAwarded = progress.kind === 'SKILL_LEVEL'
        && progress.level > (state.unlocks.levels[progress.skill] ?? 1)
        && isSkillChaosMilestone(progress.level);
      const progressed = rawReducer(state, {
        type: 'SYNC_DETECTED_PROGRESS',
        payload: progress,
      });
      const rewarded = action.payload.skillChaos && progressed !== state
        ? { ...progressed, chaosKeys: progressed.chaosKeys + action.payload.skillChaos.chaosKeysAwarded }
        : progressed;
      return rawReducer(rewarded, {
        type: 'ROLL_RESULT',
        payload: action.payload.rollResult,
      });
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
      const current = state.unlocks.collectionLog[progress.itemId] ?? 0;
      if (current >= 1) return state;
      return { ...state, unlocks: { ...state.unlocks, collectionLog: { ...state.unlocks.collectionLog, [progress.itemId]: 1 } } };
    }

    case 'ROLL_RESULT': {
      const { success, omni, pity, roll, baseThreshold, threshold, source, failureFate = 1, x, y, meta, context } = action.payload;
      const vanillaBossContext = state.gameModeId === 'vanilla' && context?.kind === 'boss'
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

      // Callback work can race with an earlier accepted roll. This reducer-side
      // backstop rejects the stale action without changing buffs, history, or RNG state.
      if (bossStage?.capped) return state;

      const rollText = formatKeyRollValue(roll);
      const thresholdsMatch = baseThreshold === threshold;
      const thresholdText = formatKeyPercent(threshold);
      const comparisonChanceText = thresholdsMatch
        ? thresholdText
        : `${thresholdText} effective; ${formatKeyPercent(baseThreshold)} base`;
      const inlineChanceText = thresholdsMatch
        ? thresholdText
        : `${thresholdText} effective (${formatKeyPercent(baseThreshold)} base)`;
      const isGreed = state.activeBuff === 'GREED';
      const requestedStandardKeys = success || pity
        ? success && !omni && isGreed ? 2 : 1
        : 0;
      const standardKeysAwarded = bossStage
        ? Math.min(requestedStandardKeys, bossStage.remaining)
        : requestedStandardKeys;
      const remainingStage = bossStage
        ? bossStage.remaining - standardKeysAwarded
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
              : { clueTier: context.clueTier }),
            effectiveRate: threshold,
            standardKeysAwarded,
            currentStage: bossStage?.awarded ?? null,
            remainingStage,
            remainingReserve: remainingStage,
            outcome,
            exhausted: bossStage ? remainingStage === 0 : false,
          }
        : {};
      const entryMeta = (fatePointsEarned: number) => ({
        roll,
        baseThreshold,
        threshold,
        source,
        fatePointsEarned,
        ...meta,
        ...vanillaRollMeta,
      });
      const eventMeta = { roll, baseThreshold, threshold, ...meta, ...vanillaRollMeta };

      let newState = {
        ...state,
        activeBuff: state.activeBuff === 'LUCK' || state.activeBuff === 'GREED' ? 'NONE' : state.activeBuff,
      } as GameState & { lastEvent: GameEvent | null };
      const newHistory = [...state.history];

      if (vanillaBossContext && standardKeysAwarded > 0) {
        newState.bossStandardKeysAwarded = {
          ...(state.bossStandardKeysAwarded ?? {}),
          [vanillaBossContext.bossName]: bossStage!.awarded + standardKeysAwarded,
        };
      }
      if (vanillaClueContext && standardKeysAwarded > 0) {
        newState.clueStandardKeysAwarded = (state.clueStandardKeysAwarded ?? 0) + standardKeysAwarded;
      }

      if (success) {
        if (omni) {
          newState.specialKeys += 1;
          newState.keys += standardKeysAwarded;

          newHistory.push({
             id: generateId(),
             timestamp: now,
             type: 'ROLL_OMNI',
             message: 'LEGENDARY DROP! You found an Omni-Key!',
             details: `Critical Success! Rolled ${rollText} vs ${comparisonChanceText}.`,
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
          const greedMessage = isGreed
            ? standardKeysAwarded === 2
              ? ' (Doubled)'
              : ` (Greed awarded ${standardKeysAwarded} Standard Key${standardKeysAwarded === 1 ? '' : 's'})`
            : '';

          newHistory.push({
             id: generateId(),
             timestamp: now,
             type: 'ROLL_SUCCESS',
             message: `Key Found!${greedMessage}`,
             details: `Rolled ${rollText} (≤ ${comparisonChanceText}).`,
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
        const pityThreshold = resolveModeRules(
          state.gameModeId, state.customMode,
        ).pityThreshold;
        newState.fatePoints = state.fatePoints + failureFate - pityThreshold;
        newHistory.push({
            id: generateId(),
            timestamp: now,
            type: 'PITY',
            message: 'MAX FATE REACHED! Pity Key granted.',
            details: `Rolled ${rollText} at ${inlineChanceText}, but Fate intervened.`,
            meta: { ...entryMeta(failureFate), pityThreshold },
            result: 'SUCCESS',
            source,
            rollValue: roll,
            baseThreshold,
            threshold,
        });
        newState.lastEvent = { id: generateId(), type: 'ROLL_PITY', x, y, meta: eventMeta };
      } else {
        newState.fatePoints += failureFate;
        // Greed's consolation: half the (scaled) ritual cost flows back,
        // so it's double-or-something rather than double-or-nothing.
        let greedRefund = 0;
        if (isGreed) {
          const mult = resolveModeRules(state.gameModeId, state.customMode).ritualCostMultiplier;
          greedRefund = Math.ceil(ritualFateCost('GREED', mult) * GREED_REFUND_FRACTION);
          newState.fatePoints += greedRefund;
        }
        newHistory.push({
            id: generateId(),
            timestamp: now,
            type: 'ROLL_FAIL',
            message: `No Key.${isGreed ? ` (Greed refunded ${greedRefund} Fate)` : ''}`,
            details: `Rolled ${rollText} (> ${comparisonChanceText}). Fate: ${newState.fatePoints}/${resolveModeRules(state.gameModeId, state.customMode).pityThreshold}`,
            meta: entryMeta(failureFate + greedRefund),
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
      const { table, item, costType, cost } = action.payload;

      const newUnlocks = { ...state.unlocks };
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

      let newState = { ...state, unlocks: newUnlocks };
      if (costType === 'key') newState.keys -= cost;
      else if (costType === 'specialKey') newState.specialKeys -= 1;
      else if (costType === 'chaosKey') newState.chaosKeys -= 1;

      // Banks are keyed by chunk id ("13618"); show the place name instead.
      const itemLabel = table === TableType.BANKS ? (BANK_BY_ID[item]?.name ?? item) : item;
      const log: LogEntry = {
          id: generateId(),
          timestamp: now,
          type: 'UNLOCK',
          message: `Unlocked ${itemLabel}`,
          details: `Category: ${table}`,
          meta: { item, category: table, cost, costType }
      };

      return {
        ...newState,
        history: [...state.history, log],
        lastEvent: { id: generateId(), type: 'UNLOCK', meta: { item, cost, category: table } }
      };
    }

    case 'RITUAL_LUCK':
      return {
        ...state,
        fatePoints: state.fatePoints - ritualFateCost('LUCK', resolveModeRules(state.gameModeId, state.customMode).ritualCostMultiplier),
        activeBuff: 'LUCK',
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: 'Ritual of Clarity', details: 'Next roll has Advantage.' }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'LUCK' } }
      };

    case 'RITUAL_GREED':
      return {
        ...state,
        fatePoints: state.fatePoints - ritualFateCost('GREED', resolveModeRules(state.gameModeId, state.customMode).ritualCostMultiplier),
        activeBuff: 'GREED',
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: 'Ritual of Greed', details: 'Next success gives 2 Keys.' }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'GREED' } }
      };

    case 'RITUAL_CHAOS':
      return {
        ...state,
        fatePoints: state.fatePoints - ritualFateCost('CHAOS', resolveModeRules(state.gameModeId, state.customMode).ritualCostMultiplier),
        chaosKeys: state.chaosKeys + 1,
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: 'Ritual of Chaos', details: 'Fate converted to Chaos Key.' }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'CHAOS' } }
      };

    case 'RITUAL_TRANSMUTE':
      return {
        ...state,
        keys: state.keys - (getRitual('TRANSMUTE').keyCost ?? 5),
        specialKeys: state.specialKeys + 1,
        history: [...state.history, { id: generateId(), timestamp: now, type: 'ALTAR', message: 'Ritual of Transmutation', details: '5 Keys fused into 1 Omni-Key.' }],
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
          message: won ? `Void Gambit WON — ${keysWon} Key${keysWon > 1 ? 's' : ''}!` : 'Void Gambit lost.',
          details: won ? `Staked ${stake} Fate; the Void blinked.` : `Staked ${stake} Fate; the Void keeps it.`,
        }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'GAMBIT', won } }
      };
    }

    case 'RITUAL_CARTOGRAPHER': {
      // Chunked mode's one moment of agency: the chosen frontier chunk
      // unlocks directly (candidates were drawn from the live frontier by
      // the Altar UI).
      const { chunkKey: chosen, label } = action.payload;
      const cost = ritualFateCost('CARTOGRAPHER', resolveModeRules(state.gameModeId, state.customMode).ritualCostMultiplier);
      if (state.fatePoints < cost || (state.unlocks.chunks ?? []).includes(chosen)) return state;
      return {
        ...state,
        fatePoints: state.fatePoints - cost,
        unlocks: { ...state.unlocks, chunks: [...(state.unlocks.chunks ?? []), chosen] },
        history: [...state.history, {
          id: generateId(), timestamp: now, type: 'ALTAR',
          message: `Cartographer charted ${label}`,
          details: `Chose a frontier chunk for ${cost} Fate — the one decision Fate allows.`,
        }],
        lastEvent: { id: generateId(), type: 'RITUAL', meta: { type: 'CARTOGRAPHER', chunk: chosen } }
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
      const randomChaosAwarded = chaosRoll < RNG_CHAOS_CHANCE;
      const guaranteedChaosAwarded = isSkillChaosMilestone(newLevel);
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
            : `Fate smiled upon you at Total Level ${totalLevel}.`,
          meta: {
            totalLevel,
            reward,
            chaosKeysAwarded,
            chaosKeyAwarded,
          },
        });
      }

      // Xtreme Start anti-softlock insurance — see XTREME_MILESTONE_INTERVAL in
      // config/economy.ts. Deterministic, not RNG, and only accrues while the
      // run is still stuck at just the start area.
      let keys = state.keys;
      let xtremeMilestoneClaimed = state.xtremeMilestoneClaimed ?? 0;
      if (state.gameModeId === 'xtreme' && state.unlocks.regions.length === 0) {
        const eligible = Math.floor(totalLevel / XTREME_MILESTONE_INTERVAL);
        if (eligible > xtremeMilestoneClaimed) {
          const gained = eligible - xtremeMilestoneClaimed;
          keys += gained;
          xtremeMilestoneClaimed = eligible;
          logs.push({
            id: generateId(),
            timestamp: now,
            type: 'XTREME_MILESTONE',
            message: `Xtreme milestone: Total Level ${eligible * XTREME_MILESTONE_INTERVAL} — ${gained === 1 ? 'a Key' : `${gained} Keys`} guaranteed.`,
            details: `Stuck at the start area with nothing else to roll — Fate steps in every ${XTREME_MILESTONE_INTERVAL} total levels.`,
            meta: { totalLevel, gained }
          });
        }
      }

      // Same insurance for Chunked mode — see CHUNKED_MILESTONE_INTERVAL.
      // Tighter interval than Xtreme's since a single starting chunk is a
      // much smaller training footprint than all of Lumbridge.
      let chunkedMilestoneClaimed = state.chunkedMilestoneClaimed ?? 0;
      if (state.gameModeId === 'chunked' && (state.unlocks.chunks ?? []).length === 0) {
        const eligible = Math.floor(totalLevel / CHUNKED_MILESTONE_INTERVAL);
        if (eligible > chunkedMilestoneClaimed) {
          const gained = eligible - chunkedMilestoneClaimed;
          keys += gained;
          chunkedMilestoneClaimed = eligible;
          logs.push({
            id: generateId(),
            timestamp: now,
            type: 'XTREME_MILESTONE',
            message: `Chunked milestone: Total Level ${eligible * CHUNKED_MILESTONE_INTERVAL} — ${gained === 1 ? 'a Key' : `${gained} Keys`} guaranteed.`,
            details: `Stuck in the start chunk with nothing else to roll — Fate steps in every ${CHUNKED_MILESTONE_INTERVAL} total levels.`,
            meta: { totalLevel, gained }
          });
        }
      }

      const eventMeta: LevelUpEventMeta = { skill, level: newLevel, totalLevel, chaosKeysAwarded, chaosKeyAwarded };

      return {
        ...state,
        unlocks: newUnlocks,
        keys,
        chaosKeys,
        xtremeMilestoneClaimed,
        chunkedMilestoneClaimed,
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
      // Bind the run to one OSRS account, permanently — once set it can't change.
      if (state.linkedAccount) return state;
      return { ...state, linkedAccount: action.payload };
    }

    case 'LOG_ITEM': {
      const itemId = action.payload;
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

export const gameReducer = (state: GameState & { lastEvent: GameEvent | null }, action: Action): GameState & { lastEvent: GameEvent | null } => {
  if (action.type === 'COMMIT_STATE') return action.payload;
  const rawNext = rawReducer(state, action);
  if (rawNext === state) return state;
  const next = rawNext.history === state.history
    ? rawNext
    : { ...rawNext, history: chainAppendedHistory(state.history, rawNext.history) };
  if (action.type === 'LOAD_SAVE' || action.type === 'RESET') return next;
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
};

export const GameProvider: React.FC<GameProviderProps> = ({ children, storageKey, leaseOptions }) => {
  const initialLoadWarningRef = useRef<string | null>(null);
  const persistedSnapshotRef = useRef<string | null>(null);
  const {
    status: saveOwnershipStatus,
    blockedReason: saveOwnershipBlockReason,
    authorizeWrite: authorizeOwnership,
    takeOver: takeOverOwnership,
    release: releaseOwnership,
  } = useProfileWriterLease(storageKey, leaseOptions);
  const saveOwnershipStatusRef = useRef(saveOwnershipStatus);
  saveOwnershipStatusRef.current = saveOwnershipStatus;
  const saveOwnershipBlockReasonRef = useRef(saveOwnershipBlockReason);
  saveOwnershipBlockReasonRef.current = saveOwnershipBlockReason;
  const [state, dispatch] = useReducer(
    gameReducer,
    storageKey,
    (key): GameState & { lastEvent: GameEvent | null } => {
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
        if (parsed.ok === true) return { ...parsed.state, lastEvent: null };
        discardPendingSave(key);
        console.warn('Pending save failed validation', parsed.code, parsed.path ?? 'root');
      }
      if (durableReadFailed) {
        initialLoadWarningRef.current = 'Saved run data could not be read, so a fresh run was started.';
        console.warn('Stored save could not be read');
      } else if (saved) {
        const parsed = parseAndMigrateSave(saved, createFreshState());
        if (parsed.ok === true) return { ...parsed.state, lastEvent: null };
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(() => getSaveStatus(storageKey));
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
    if (
      !takeoverFlushAuthorizedRef.current
      && (takeoverRequestedRef.current || saveOwnershipStatusRef.current !== 'owner')
    ) {
      return {
        ok: false,
        reason: saveOwnershipBlockReasonRef.current === 'storage_unavailable'
          ? 'storage_unavailable'
          : 'ownership_conflict',
      };
    }
    return authorizeOwnership();
  }, [authorizeOwnership]);

  const stageForProfileEviction = useCallback((): void => {
    profileEvictedRef.current = true;
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    stagePendingSave(storageKey, serializeCurrent());
    blockPendingSave(storageKey, 'ownership_conflict');
    if (mountedRef.current) setSaveStatus(getSaveStatus(storageKey));
    releaseOwnership();
  }, [releaseOwnership, serializeCurrent, storageKey]);

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

    stagePendingSave(storageKey, snapshot);
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

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      flushCurrentSave();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [
    flushCurrentSave,
    saveOwnershipBlockReason,
    saveOwnershipStatus,
    state,
    storageKey,
  ]);

  const stageCurrentSnapshotForLifecycle = useCallback(() => {
    const snapshot = serializeCurrent();
    const pending = getPendingSave(storageKey);
    const needsStaging = pending === null
      ? snapshot !== persistedSnapshotRef.current
      : pending.data !== snapshot;
    if (needsStaging) {
      stagePendingSave(storageKey, snapshot);
    }
    if (profileEvictedRef.current) {
      blockPendingSave(storageKey, 'ownership_conflict');
    }
  }, [serializeCurrent, storageKey]);

  const flushAndReleaseOwnership = useCallback(() => {
    stageCurrentSnapshotForLifecycle();
    if (profileEvictedRef.current) {
      blockPendingSave(storageKey, 'ownership_conflict');
      releaseOwnership();
      return;
    }
    const flushed = getPendingSave(storageKey) !== null
      ? flushCurrentSave()
      : authorizeOwnedWrite().ok;
    if (flushed && getPendingSave(storageKey) === null) releaseOwnership();
  }, [
    authorizeOwnedWrite,
    flushCurrentSave,
    releaseOwnership,
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

  const retrySave = useCallback((): boolean => {
    stagePendingSave(storageKey, serializeCurrent());
    setSaveStatus(getSaveStatus(storageKey));
    return flushCurrentSave();
  }, [flushCurrentSave, serializeCurrent, storageKey]);

  const takeOverSaveOwnership = useCallback(async (): Promise<boolean> => {
    if (profileEvictedRef.current) return false;
    takeoverRequestedRef.current = true;
    try {
      const owned = await takeOverOwnership();
      if (!owned) return false;
      takeoverFlushAuthorizedRef.current = true;
      try {
        stagePendingSave(storageKey, serializeCurrent());
        setSaveStatus(getSaveStatus(storageKey));
        return flushCurrentSave();
      } finally {
        takeoverFlushAuthorizedRef.current = false;
      }
    } finally {
      takeoverRequestedRef.current = false;
    }
  }, [flushCurrentSave, serializeCurrent, storageKey, takeOverOwnership]);

  const pushOwnedBackup = useCallback((data: string, reason: string): BackupWriteResult =>
    pushBackup(storageKey, data, reason, authorizeOwnedWrite), [authorizeOwnedWrite, storageKey]);

  // One automatic snapshot per session (per profile mount), so "the run was
  // fine yesterday" is always recoverable from the ring — not just the
  // pre-import/pre-reset moments. pushBackup no-ops when nothing changed
  // since the newest entry, so idle reloads don't churn the ring.
  const sessionBackupFinishedRef = useRef(false);
  useEffect(() => {
    if (saveOwnershipStatus !== 'owner' || sessionBackupFinishedRef.current) return;
    const sessionStartSnapshot = sessionStartSnapshotRef.current!;
    if (!sessionStartSnapshot.hasHistory) {
      sessionBackupFinishedRef.current = true;
      return;
    }
    const result = pushOwnedBackup(sessionStartSnapshot.data, 'Session start');
    if (result.stored === true || result.reason !== 'ownership_conflict') {
      sessionBackupFinishedRef.current = true;
    }
  }, [pushOwnedBackup, saveOwnershipStatus]);

  // --- Actions ---

  const commitAction = useCallback((action: TransitionAction) => {
    const transition = prepareGameTransition(stateRef.current, action);
    stateRef.current = transition.state;
    dispatch(transition.commit);
    return transition.state;
  }, []);

  // Gameplay RNG choke point (see GameContextType.nextFloat). Reads through
  // stateRef so one render's callbacks always draw against the latest chain
  // tip; the tip changes with every appended history entry, which is what
  // keeps successive draws independent on a seeded run.
  const nextFloat = useCallback((purpose: string, index = 0): number => {
    const s = stateRef.current;
    if (!s.rngSeed) return Math.random();
    const tip = s.history[s.history.length - 1]?.hash ?? 'genesis';
    return drawFloat(s.rngSeed, tip, purpose, index);
  }, []);
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
    const current = stateRef.current;
    const action = context
      ? prepareKeyRollAction(current, source, threshold, failureFate, nextDice, x, y, meta, context)
      : prepareKeyRollAction(current, source, threshold, failureFate, nextDice, x, y, meta);
    if (action) commitAction(action);
  }, [commitAction, nextDice]);

  const unlockContent = useCallback((table: TableType, item: string, costType: 'key' | 'specialKey' | 'chaosKey', cost: number) => {
    commitAction({ type: 'UNLOCK', payload: { table, item, costType, cost } });
  }, [commitAction]);

  const performRitual = useCallback((type: 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE') => {
    if (type === 'LUCK') commitAction({ type: 'RITUAL_LUCK' });
    if (type === 'GREED') commitAction({ type: 'RITUAL_GREED' });
    if (type === 'CHAOS') commitAction({ type: 'RITUAL_CHAOS' });
    if (type === 'TRANSMUTE') commitAction({ type: 'RITUAL_TRANSMUTE' });
  }, [commitAction]);

  /** Void Gambit: stake ALL fate on a coin flip (RNG here — reducer stays pure). */
  const performGambit = useCallback(() => {
    const stake = stateRef.current.fatePoints;
    const min = getRitual('GAMBIT').fateCost ?? 15;
    if (stake < min) return;
    const won = nextFloat('gambit') < 0.5;
    const keysWon = Math.max(1, Math.floor(stake / GAMBIT_KEYS_PER));
    commitAction({ type: 'RITUAL_GAMBIT', payload: { won, stake, keysWon } });
  }, [commitAction, nextFloat]);

  /** Cartographer: unlock the chosen frontier chunk (Chunked mode only). */
  const performCartographer = useCallback((chunkKey: string, label: string) => {
    commitAction({ type: 'RITUAL_CARTOGRAPHER', payload: { chunkKey, label } });
  }, [commitAction]);

  const levelUpSkill = useCallback((skill: string) => {
    // Pre-compute RNG outside reducer to maintain reducer purity
    const chaosRoll = nextFloat('levelup');
    const prepared = prepareLevelUpActions(stateRef.current, skill, chaosRoll, nextDice);
    const levelState = commitAction(prepared.levelAction);
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

  const setRival = useCallback((rival: RivalState) =>
    commitAction({ type: 'SET_RIVAL', payload: rival }), [commitAction]);
  const clearRival = useCallback(() => commitAction({ type: 'CLEAR_RIVAL' }), [commitAction]);
  const ackRival = useCallback((lead: number) =>
    commitAction({ type: 'ACK_RIVAL', payload: lead }), [commitAction]);

  const completeOnboarding = useCallback(() =>
    commitAction({ type: 'COMPLETE_ONBOARDING' }), [commitAction]);
  const resolveFateCompensation = useCallback((choice: FateCompensationChoice) =>
    commitAction({ type: 'RESOLVE_FATE_COMPENSATION', payload: choice }), [commitAction]);
  const setGameMode = useCallback((modeId: string, customRules?: GameModeRules) =>
    commitAction({ type: 'SET_GAME_MODE', payload: { modeId, customRules } }), [commitAction]);
  const toggleAnimations = useCallback(() => commitAction({ type: 'TOGGLE_ANIMATIONS' }), [commitAction]);
  const toggleAdvisors = useCallback(() => commitAction({ type: 'TOGGLE_ADVISORS' }), [commitAction]);
  const toggleRevealAll = useCallback(() => commitAction({ type: 'TOGGLE_REVEAL_ALL' }), [commitAction]);
  const replaceState = useCallback((replacement: GameState) => {
    stateRef.current = { ...replacement, lastEvent: null };
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
    replaceState(parsed.state);
    return { ok: true, warnings: parsed.warnings };
  }, [replaceState, storageKey]);

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

  const importSave = useCallback((data: unknown): ImportResult => {
    const authorization = authorizeOwnedWrite();
    if (authorization.ok === false) return saveAuthorizationFailureResult(authorization.reason);
    return applyPreparedReplacement(data, {
      current: stateRef.current,
      defaults: createFreshState(),
      writeBackup: current => pushOwnedBackup(current, 'Before import'),
      writeReplacement,
      replace: replaceState,
    });
  }, [authorizeOwnedWrite, pushOwnedBackup, replaceState, writeReplacement]);

  const createBackup = useCallback((reason: string): BackupWriteResult =>
    pushOwnedBackup(serializeCurrent(), reason), [pushOwnedBackup, serializeCurrent]);

  const listBackups = useCallback(() => readBackups(storageKey), [storageKey]);

  const restoreBackup = useCallback((ts: number): ImportResult => {
    const authorization = authorizeOwnedWrite();
    if (authorization.ok === false) return saveAuthorizationFailureResult(authorization.reason);
    const data = getBackupData(storageKey, ts);
    if (data === null) {
      return { ok: false, code: 'invalid_json', message: 'Backup was not found.' };
    }
    return applyValidatedReplacement(parseAndMigrateSave(data, createFreshState()), {
      current: stateRef.current,
      writeBackup: current => pushOwnedBackup(current, 'Before restore'),
      writeReplacement,
      replace: replaceState,
    });
  }, [authorizeOwnedWrite, pushOwnedBackup, replaceState, storageKey, writeReplacement]);

  const resetGame = useCallback(() => {
    // Auto-snapshot so an accidental reset is recoverable.
    pushOwnedBackup(serializeCurrent(), 'Before reset');
    commitAction({ type: 'RESET' });
  }, [commitAction, pushOwnedBackup, serializeCurrent]);
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
    retrySave,
    stageForProfileEviction,
    takeOverSaveOwnership,
    reloadLatestSave,
    rollForKey,
    acceptDetectedEvent,
    unlockContent,
    performRitual,
    performGambit,
    performCartographer,
    levelUpSkill,
    toggleAnimations,
    toggleAdvisors,
    toggleRevealAll,
    completeOnboarding,
    resolveFateCompensation,
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
    completeQuest,
    completeDiaryTask,
    completeDiaryTier,
    completeCATask,
    completeCATier,
    logCollectionItem,
    getExportData,
    setLoadoutSlot,
    setLinkedAccount,
    setRival,
    clearRival,
    ackRival
  }), [
    state,
    saveStatus,
    saveOwnershipStatus,
    saveOwnershipBlockReason,
    hasPendingChanges,
    retrySave,
    stageForProfileEviction,
    takeOverSaveOwnership,
    reloadLatestSave,
    rollForKey,
    acceptDetectedEvent,
    unlockContent,
    performRitual,
    performGambit,
    performCartographer,
    levelUpSkill,
    toggleAnimations,
    toggleAdvisors,
    toggleRevealAll,
    completeOnboarding,
    resolveFateCompensation,
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
    completeQuest,
    completeDiaryTask,
    completeDiaryTier,
    completeCATask,
    completeCATier,
    logCollectionItem,
    getExportData,
    setLoadoutSlot,
    setLinkedAccount,
    setRival,
    clearRival,
    ackRival
  ]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
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
