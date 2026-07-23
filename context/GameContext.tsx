
import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, LogEntry, UnlockState, DropSource, TableType, RivalState } from '../types';
import { EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST } from '../data/items';
import { DROP_RATES, EQUIPMENT_TIER_MAX } from '../config/rules';
import { resolveModeRules, DEFAULT_MODE_ID } from '../config/gameModes';
import { setStartArea } from '../utils/freeAreas';
import { migrateClogIds } from '../utils/clogIdMigrations';
import type { GameModeRules } from '../config/gameModes';
import { getActiveRegionBonuses } from '../config/regionModifiers';
import { getRitual, XTREME_MILESTONE_INTERVAL, CHUNKED_MILESTONE_INTERVAL, GREED_REFUND_FRACTION, GAMBIT_KEYS_PER } from '../config/economy';
import { BANK_BY_ID } from '../data/banks';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { QUEST_DATA } from '../data/questData';
import { UNLOCK_COST } from '../utils/gameEngine';
import { drawFloat } from '../utils/seededRng';
import { hashEntry, ensureChain } from '../utils/integrity';
import { pushBackup, listBackups as readBackups, getBackupData, BackupMeta } from '../utils/backups';
import { showToast } from '../utils/toast';
import {
  canEarnDiaryTier,
  diaryTaskCompletionDecision,
  questCompletionDecision,
  withJournalCompletion,
} from '../utils/journalCompletion';
import type { CompletionResult } from '../utils/journalCompletion';

// --- Types ---
const CURRENT_VERSION = 1;
const SAVE_DEBOUNCE_MS = 500;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
};

const completionFailure = (reason: string): CompletionResult => {
  showToast(reason);
  return { ok: false, reason };
};

type RollEventMeta = { roll: number; threshold: number };
type UnlockEventMeta = { item: string; cost: number; category?: TableType };
type RitualEventMeta = { type: 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE' | 'GAMBIT' | 'CARTOGRAPHER'; won?: boolean; chunk?: string };
type LevelUpEventMeta = { skill: string; level: number; totalLevel: number; chaosKeyAwarded: boolean };

type GameEventMeta = RollEventMeta | UnlockEventMeta | RitualEventMeta | LevelUpEventMeta;

type GameEvent = {
  id: string;
  type: 'ROLL_SUCCESS' | 'ROLL_FAIL' | 'ROLL_OMNI' | 'ROLL_PITY' | 'UNLOCK' | 'RITUAL' | 'LEVEL_UP';
  x?: number;
  y?: number;
  meta?: GameEventMeta;
};

interface GameContextType extends GameState {
  lastEvent: GameEvent | null;
  rollForKey: (source: string, threshold: number, x?: number, y?: number) => void;
  unlockContent: (table: TableType, item: string, costType: 'key' | 'specialKey' | 'chaosKey', cost: number) => void;
  performRitual: (type: 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE') => void;
  performGambit: () => void;
  performCartographer: (chunkKey: string, label: string) => void;
  levelUpSkill: (skill: string) => void;
  toggleAnimations: () => void;
  toggleAdvisors: () => void;
  toggleRevealAll: () => void;
  completeOnboarding: () => void;
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
  importSave: (data: Partial<GameState>) => void;
  resetGame: () => void;
  /** Snapshot the current run before something overwrites it. */
  createBackup: (reason: string) => void;
  /** Backups for the active profile, newest first. */
  listBackups: () => BackupMeta[];
  /** Restore a backup by timestamp (snapshots the current run first). */
  restoreBackup: (ts: number) => void;
  togglePin: (id: string) => void;
  saveNote: (id: string, text: string) => void;
  completeQuest: (id: string, x?: number, y?: number) => CompletionResult;
  completeDiaryTask: (id: string, x?: number, y?: number) => CompletionResult;
  completeDiaryTier: (id: string) => CompletionResult;
  toggleCA: (id: string) => void;
  /** Transitional CA task action; additive even though the legacy name remains. */
  toggleTask: (id: string) => void;
  logCollectionItem: (itemId: number) => void;
  getExportData: () => string | null;
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
  version: CURRENT_VERSION,
  keys: 3,
  specialKeys: 0,
  chaosKeys: 0,
  fatePoints: 0,
  activeBuff: 'NONE',
  unlocks: getInitialUnlocks(),
  history: [],
  animationsEnabled: true,
  advisorsEnabled: false,
  hasSeenOnboarding: false,
  pinnedGoals: [],
  userNotes: {},
  gameModeId: DEFAULT_MODE_ID,
  gameModeLocked: false,
  loadout: {},
};

// --- Save Validation ---
const isValidSaveData = (data: unknown): data is Partial<GameState> => {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Validate key numeric fields if present
  if ('keys' in obj && typeof obj.keys !== 'number') return false;
  if ('specialKeys' in obj && typeof obj.specialKeys !== 'number') return false;
  if ('chaosKeys' in obj && typeof obj.chaosKeys !== 'number') return false;
  if ('fatePoints' in obj && typeof obj.fatePoints !== 'number') return false;

  // Validate history is an array if present
  if ('history' in obj && !Array.isArray(obj.history)) return false;

  // Validate unlocks is an object if present
  if ('unlocks' in obj && (typeof obj.unlocks !== 'object' || obj.unlocks === null)) return false;

  return true;
};

// --- Migration & Safety Logic ---
const migrateSave = (saveData: Partial<GameState>): GameState => {
  // 1. Create a clean base state to ensure all expected top-level keys exist
  const baseState = { ...initialState };

  // 2. Extract unlocks for special handling
  const { unlocks: saveUnlocks, ...saveMeta } = saveData;

  // 3. Merge meta properties (keys, history, etc) onto base
  // This ensures if new properties are added to GameState in future, they aren't lost or undefined
  const mergedState = { ...baseState, ...saveMeta };

  // 4. Handle Unlocks Migration specifically
  const defaultUnlocks = getInitialUnlocks();
  const loadedUnlocks: Record<string, any> = saveUnlocks || {};

  // MIGRATION FIXES:
  // Handle 'power' -> 'arcana' rename from very old saves
  if (loadedUnlocks.power) {
      loadedUnlocks.arcana = [...(loadedUnlocks.arcana || []), ...loadedUnlocks.power];
      delete loadedUnlocks.power;
  }

  // Handle hypothetical 'poh' -> 'housing' rename (or vice versa)
  // Current app uses 'housing'. If save comes in with 'poh', map it.
  if (loadedUnlocks.poh && (!loadedUnlocks.housing || loadedUnlocks.housing.length === 0)) {
       loadedUnlocks.housing = loadedUnlocks.poh;
       delete loadedUnlocks.poh;
  }

  // 5. Deep merge unlocks
  // This ensures that if we add a new table (e.g. "Sailing") in the code,
  // old saves won't crash the app with undefined arrays.
  mergedState.unlocks = {
      ...defaultUnlocks,
      ...loadedUnlocks,
      // Deep merge nested objects to preserve user progress while adding new keys if they don't exist
      equipment: { ...defaultUnlocks.equipment, ...(loadedUnlocks.equipment || {}) },
      skills: { ...defaultUnlocks.skills, ...(loadedUnlocks.skills || {}) },
      levels: { ...defaultUnlocks.levels, ...(loadedUnlocks.levels || {}) },
      collectionLog: migrateClogIds({ ...defaultUnlocks.collectionLog, ...(loadedUnlocks.collectionLog || {}) })
  };

  // Defensive: dedupe unlock arrays so a corrupted import can't load the
  // same region/boss/etc. twice.
  const ARRAY_KEYS = ['regions', 'chunks', 'mobility', 'arcana', 'housing', 'merchants',
    'minigames', 'bosses', 'storage', 'guilds', 'farming', 'slayerUnlocks', 'banks',
    'quests', 'diaries',
    'cas', 'completedTasks'] as const;
  for (const k of ARRAY_KEYS) {
    const arr = (mergedState.unlocks as any)[k];
    if (Array.isArray(arr)) (mergedState.unlocks as any)[k] = Array.from(new Set(arr));
  }

  // 6. Ensure logical consistency
  if (mergedState.hasSeenOnboarding === undefined) {
       mergedState.hasSeenOnboarding = (mergedState.history && mergedState.history.length > 0);
  }

  // 7. Stamp with current version
  mergedState.version = CURRENT_VERSION;

  return mergedState;
};

// --- Reducer ---
export type Action =
  | { type: 'LOAD_SAVE'; payload: Partial<GameState> }
  | { type: 'RESET' }
  | { type: 'TOGGLE_ANIMATIONS' }
  | { type: 'TOGGLE_ADVISORS' }
  | { type: 'TOGGLE_REVEAL_ALL' }
  | { type: 'SET_SEED'; payload: string }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'ROLL_RESULT'; payload: { success: boolean; omni: boolean; pity: boolean; roll: number; threshold: number; source: string; x?: number; y?: number } }
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
  | { type: 'TOGGLE_CA'; payload: string }
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
export const prepareKeyRollAction = (
  state: GameState,
  source: string,
  threshold: number,
  nextDice: DiceRoller,
  x?: number,
  y?: number,
): RollResultAction => {
  let roll = nextDice('roll', 0);
  const advantageRoll = nextDice('roll', 1);

  if (state.activeBuff === 'LUCK') {
    roll = Math.min(roll, advantageRoll);
  }

  const mode = resolveModeRules(state.gameModeId, state.customMode);
  let omniBonus = 0;
  let effectiveThreshold = threshold;
  if (mode.regionModifiers) {
    const bonuses = getActiveRegionBonuses(state.unlocks.regions);
    effectiveThreshold = Math.max(1, Math.min(100, threshold + bonuses.successBonus));
    omniBonus = bonuses.omniBonus;
  }

  const success = roll <= effectiveThreshold;
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

    if (nextDice('roll', 2) <= omniChance) omni = true;
  } else if (mode.pityEnabled && state.fatePoints + 1 >= mode.pityThreshold) {
    pity = true;
  }

  return {
    type: 'ROLL_RESULT',
    payload: { success, omni, pity, roll, threshold: effectiveThreshold, source, x, y },
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
  const rollChance = Math.ceil(newLevel / 5);
  return {
    levelAction: { type: 'LEVEL_UP', payload: { skill, chaosRoll } },
    rewardAction: prepareKeyRollAction(
      state,
      `${skill} Level ${newLevel}`,
      rollChance,
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
    case 'LOAD_SAVE': {
      const migratedState = migrateSave(action.payload);
      return {
        ...state,
        ...migratedState,
        lastEvent: null
      };
    }

    case 'RESET':
      return { ...initialState, lastEvent: null };

    case 'TOGGLE_ANIMATIONS':
      return { ...state, animationsEnabled: !state.animationsEnabled };
    case 'TOGGLE_ADVISORS':
      return { ...state, advisorsEnabled: !state.advisorsEnabled };
    case 'TOGGLE_REVEAL_ALL':
      return { ...state, revealAllFeatures: !state.revealAllFeatures };

    case 'COMPLETE_ONBOARDING':
      return { ...state, hasSeenOnboarding: true };

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

    case 'ROLL_RESULT': {
      const { success, omni, pity, roll, threshold, source, x, y } = action.payload;
      const isGreed = state.activeBuff === 'GREED';

      let newState = { ...state, activeBuff: state.activeBuff === 'LUCK' || state.activeBuff === 'GREED' ? 'NONE' : state.activeBuff } as GameState & { lastEvent: GameEvent | null };
      const newHistory = [...state.history];

      if (success) {
        if (omni) {
          newState.specialKeys += 1;
          newState.keys += 1;

          newHistory.push({
             id: generateId(),
             timestamp: now,
             type: 'ROLL_OMNI',
             message: 'LEGENDARY DROP! You found an Omni-Key!',
             details: `Critical Success! Rolled ${roll} vs ${threshold}.`,
             meta: { roll, threshold, source },
             result: 'SUCCESS',
             source,
             rollValue: roll,
             threshold
          });
          newState.lastEvent = { id: generateId(), type: 'ROLL_OMNI', x, y, meta: { roll, threshold } };
        } else {
          const amount = isGreed ? 2 : 1;
          newState.keys += amount;

          newHistory.push({
             id: generateId(),
             timestamp: now,
             type: 'ROLL_SUCCESS',
             message: `Key Found!${isGreed ? ' (Doubled)' : ''}`,
             details: `Rolled ${roll} (≤ ${threshold}).`,
             meta: { roll, threshold, source },
             result: 'SUCCESS',
             source,
             rollValue: roll,
             threshold
          });
          newState.lastEvent = { id: generateId(), type: 'ROLL_SUCCESS', x, y, meta: { roll, threshold } };
        }
        newState.fatePoints = 0;
      } else {
         if (pity) {
            newState.keys += 1;
            newState.fatePoints = 0;
            newHistory.push({
                id: generateId(),
                timestamp: now,
                type: 'PITY',
                message: 'MAX FATE REACHED! Pity Key granted.',
                details: `Rolled ${roll} but Fate intervened.`,
                meta: { roll, threshold, source },
                result: 'SUCCESS',
                source,
                rollValue: roll,
                threshold
            });
            newState.lastEvent = { id: generateId(), type: 'ROLL_PITY', x, y, meta: { roll, threshold } };
         } else {
            newState.fatePoints += 1;
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
                details: `Rolled ${roll} (> ${threshold}). Fate: ${newState.fatePoints}/${resolveModeRules(state.gameModeId, state.customMode).pityThreshold}`,
                meta: { roll, threshold, source },
                result: 'FAIL',
                source,
                rollValue: roll,
                threshold
            });
            newState.lastEvent = { id: generateId(), type: 'ROLL_FAIL', x, y, meta: { roll, threshold } };
         }
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
      else if (table === TableType.REGIONS) newUnlocks.regions = pushOnce(newUnlocks.regions);
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
      let chaosKeys = state.chaosKeys;
      let chaosKeyAwarded = false;

      // RNG Chaos Key Check (2% Chance)
      // chaosRoll is pre-computed in the action creator to keep the reducer pure
      const RNG_CHAOS_CHANCE = 0.02;

      if (chaosRoll < RNG_CHAOS_CHANCE) {
          chaosKeys += 1;
          chaosKeyAwarded = true;
          logs.push({
              id: generateId(),
              timestamp: now,
              type: 'LEVEL_UP',
              message: `Chaos Key Drop! (RNG)`,
              details: `Fate smiled upon you at Total Level ${totalLevel}.`,
              meta: { totalLevel, reward: 'Chaos Key' }
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

      const eventMeta: LevelUpEventMeta = { skill, level: newLevel, totalLevel, chaosKeyAwarded };

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

    case 'TOGGLE_CA': {
      const id = action.payload;
      const isCompleted = state.unlocks.cas.includes(id);
      const newCAs = isCompleted
        ? state.unlocks.cas.filter(c => c !== id)
        : [...state.unlocks.cas, id];
      return { ...state, unlocks: { ...state.unlocks, cas: newCAs } };
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
  const next = rawReducer(state, action);
  if (next.history === state.history) return next;
  return { ...next, history: chainAppendedHistory(state.history, next.history) };
};

/**
 * Computes reducer work once, including generated event IDs, timestamps, and
 * history hashes. React later receives this exact state instead of replaying
 * the transition against a potentially stale render snapshot.
 */
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

export const GameProvider: React.FC<{ children: React.ReactNode; storageKey: string }> = ({ children, storageKey }) => {
  // Load the save synchronously in the reducer initializer so the very first
  // render already reflects the persisted run. This matters for the reveal
  // hooks (useUnlockReveal / useAchievementReveal), which capture their
  // baseline on mount — if the save arrived later via an effect, every page
  // reload would diff against an empty baseline and spam "unlocked!" reveals.
  const [state, dispatch] = useReducer(
    gameReducer,
    storageKey,
    (key): GameState & { lastEvent: GameEvent | null } => {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (isValidSaveData(parsed)) return { ...migrateSave(parsed), lastEvent: null };
          console.warn('Save data failed validation, starting fresh');
        }
      } catch (e) { console.error('Failed to load save', e); }
      return { ...initialState, lastEvent: null };
    },
  );
  const saveTimeoutRef = useRef<number | null>(null);

  // Keep the free-area baseline in sync with the run's mode, synchronously so
  // the unlock helpers (chunkUnlocked, journal status, …) read the right set on
  // this render. Xtreme start frees only Lumbridge; every other mode frees all
  // of Misthalin.
  setStartArea(resolveModeRules(state.gameModeId, state.customMode).startArea);

  // Always-current snapshot of state so backup/reset callbacks can read the
  // latest persisted shape without re-creating on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;
  const serializeCurrent = useCallback((): string => {
    const { lastEvent, ...persist } = stateRef.current;
    return JSON.stringify(persist);
  }, []);

  // Debounced persistence - saves all persistent state fields
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      const { lastEvent, ...persistState } = state;
      localStorage.setItem(storageKey, JSON.stringify(persistState));
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state, storageKey]);

  // One automatic snapshot per session (per profile mount), so "the run was
  // fine yesterday" is always recoverable from the ring — not just the
  // pre-import/pre-reset moments. pushBackup no-ops when nothing changed
  // since the newest entry, so idle reloads don't churn the ring.
  useEffect(() => {
    if (stateRef.current.history.length > 0) {
      pushBackup(storageKey, serializeCurrent(), 'Session start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

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

  const rollForKey = useCallback((source: string, threshold: number, x?: number, y?: number) => {
    const current = stateRef.current;
    commitAction(prepareKeyRollAction(current, source, threshold, nextDice, x, y));
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
    commitAction(prepared.levelAction);
    commitAction(prepared.rewardAction);
  }, [commitAction, nextDice, nextFloat]);

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
  const setGameMode = useCallback((modeId: string, customRules?: GameModeRules) =>
    commitAction({ type: 'SET_GAME_MODE', payload: { modeId, customRules } }), [commitAction]);
  const toggleAnimations = useCallback(() => commitAction({ type: 'TOGGLE_ANIMATIONS' }), [commitAction]);
  const toggleAdvisors = useCallback(() => commitAction({ type: 'TOGGLE_ADVISORS' }), [commitAction]);
  const toggleRevealAll = useCallback(() => commitAction({ type: 'TOGGLE_REVEAL_ALL' }), [commitAction]);
  const importSave = useCallback((data: Partial<GameState>) => {
    if (isValidSaveData(data)) {
      commitAction({ type: 'LOAD_SAVE', payload: data });
    } else {
      console.error('Import rejected: invalid save data');
      showToast('Import failed — save data is malformed');
    }
  }, [commitAction]);
  const createBackup = useCallback((reason: string) => {
    pushBackup(storageKey, serializeCurrent(), reason);
  }, [storageKey, serializeCurrent]);

  const listBackups = useCallback(() => readBackups(storageKey), [storageKey]);

  const restoreBackup = useCallback((ts: number) => {
    const data = getBackupData(storageKey, ts);
    if (!data) return;
    // Snapshot the run we're about to replace so a restore is itself undoable.
    pushBackup(storageKey, serializeCurrent(), 'Before restore');
    try {
      commitAction({ type: 'LOAD_SAVE', payload: JSON.parse(data) });
    } catch {
      console.error('Restore failed: backup data was unreadable');
    }
  }, [commitAction, storageKey, serializeCurrent]);

  const resetGame = useCallback(() => {
    // Auto-snapshot so an accidental reset is recoverable.
    pushBackup(storageKey, serializeCurrent(), 'Before reset');
    commitAction({ type: 'RESET' });
  }, [commitAction, storageKey, serializeCurrent]);
  const togglePin = useCallback((id: string) => commitAction({ type: 'TOGGLE_PIN', payload: id }), [commitAction]);
  const saveNote = useCallback((id: string, text: string) =>
    commitAction({ type: 'UPDATE_NOTE', payload: { id, text } }), [commitAction]);
  const completeQuest = useCallback((id: string, x?: number, y?: number): CompletionResult => {
    const snapshot = stateRef.current;
    const quest = QUEST_DATA[id];
    if (!quest) return completionFailure('Unknown quest');

    const result = questCompletionDecision(quest, snapshot.unlocks, snapshot.gameModeId);
    if (result.ok === false) return completionFailure(result.reason);

    commitAction({ type: 'COMPLETE_QUEST', payload: id });
    rollForKey(quest.difficulty, DROP_RATES[quest.difficulty], x, y);
    return result;
  }, [commitAction, rollForKey]);

  const completeDiaryTask = useCallback((
    id: string,
    x?: number,
    y?: number,
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
    );
    if (result.ok === false) return completionFailure(result.reason);

    commitAction({ type: 'COMPLETE_TASK', payload: id });
    rollForKey(diary.difficulty, DROP_RATES[diary.difficulty], x, y);

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

  const toggleCA = useCallback((id: string) => commitAction({ type: 'TOGGLE_CA', payload: id }), [commitAction]);
  const toggleTask = useCallback((id: string) => commitAction({ type: 'COMPLETE_TASK', payload: id }), [commitAction]);

  const getExportData = useCallback((): string | null => {
    return localStorage.getItem(storageKey);
  }, [storageKey]);

  const contextValue = useMemo(() => ({
    ...state,
    rollForKey,
    unlockContent,
    performRitual,
    performGambit,
    performCartographer,
    levelUpSkill,
    toggleAnimations,
    toggleAdvisors,
    toggleRevealAll,
    completeOnboarding,
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
    toggleCA,
    toggleTask,
    logCollectionItem,
    getExportData,
    setLoadoutSlot,
    setLinkedAccount,
    setRival,
    clearRival,
    ackRival
  }), [
    state,
    rollForKey,
    unlockContent,
    performRitual,
    performGambit,
    performCartographer,
    levelUpSkill,
    toggleAnimations,
    toggleAdvisors,
    toggleRevealAll,
    completeOnboarding,
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
    toggleCA,
    toggleTask,
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
