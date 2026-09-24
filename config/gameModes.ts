// Game modes — preset (and custom) rulesets chosen at the start of a run.
//
// A run's mode is LOCKED once the first action is logged (see GameContext's
// SET_GAME_MODE handler), so the ruleset a run was played under is fixed and
// the integrity/verification chain stays meaningful.

export interface GameModeRules {
  /** Whether the pity system (guaranteed key after enough failed rolls) is on. */
  pityEnabled: boolean;
  /** Fate points at which a failed roll is converted to a guaranteed pity key. */
  pityThreshold: number;
  /** Base % chance a successful roll is upgraded to an Omni-key. */
  omniChanceBase: number;
  /** Multiplier applied to Void Altar ritual fate costs (1 = vanilla). */
  ritualCostMultiplier: number;
  /** Whether per-region passive modifiers are active. */
  regionModifiers: boolean;
  /**
   * Which NAMED areas are free at the start. 'misthalin' (default) frees the
   * whole starter region; 'lumbridge' frees only Lumbridge — the Xtreme start;
   * 'none' frees no named area — required for 'chunked' mode, whose free
   * baseline is a single map-region chunk (chunkGranularity), not a name.
   */
  startArea?: 'misthalin' | 'lumbridge' | 'none';
  /**
   * Chunked mode only: unlocking happens one map-region chunk at a time,
   * adjacent to the unlocked set (TableType.CHUNKS), instead of whole named
   * regions/sub-areas. See utils/chunkAdjacency.ts for the frontier logic and
   * CHUNKED_START for the fixed (free) starting chunk.
   */
  chunkGranularity?: boolean;
  /**
   * When true, every bankable location (bank/deposit box) must be individually
   * unlocked (TableType.BANKS) before it can be used — a OneChunkMan-style
   * restriction. ON in every built-in mode; Custom mode can turn it off.
   * See utils/reachability.ts isBankReachable.
   */
  bankLocks?: boolean;
}

export interface GameMode {
  id: string;
  name: string;
  description: string;
  /** Short flavor line shown under the name in the picker. */
  tagline: string;
  rules: GameModeRules;
}

// Vanilla mirrors the values that were previously hardcoded in GameContext.
const VANILLA_RULES: GameModeRules = {
  pityEnabled: true,
  pityThreshold: 50,
  omniChanceBase: 2,
  ritualCostMultiplier: 1,
  regionModifiers: false,
  // Every bank/deposit box is its own unlock (TableType.BANKS) in all modes.
  bankLocks: true,
};

export const GAME_MODES: GameMode[] = [
  {
    id: 'vanilla',
    name: 'Vanilla',
    description: 'The standard Fate Locked ruleset — balanced for a full-length run.',
    tagline: 'The original experience',
    rules: { ...VANILLA_RULES },
  },
  {
    id: 'chunked',
    name: 'Chunked',
    description: 'The classic "Chunked Ironman" format: you start in a single Lumbridge chunk and unlock adjacent land one chunk at a time. After completing Pandemonium and unlocking Sailing, the frontier also includes land reached across open sea from your coast and documented boat landings. Ocean navigation does not cost a land unlock.',
    tagline: 'Adjacent land and Sailing frontiers',
    rules: {
      pityEnabled: true,
      pityThreshold: 50,
      omniChanceBase: 2,
      ritualCostMultiplier: 1,
      regionModifiers: false,
      startArea: 'none',
      chunkGranularity: true,
      // Banking is a privilege in Chunked: every bank/deposit box is its own
      // unlock (TableType.BANKS), the same one-at-a-time spirit as chunks.
      bankLocks: true,
    },
  },
  // NOTE: Casual / Hardcore / Region Rush / Xtreme Start / Custom were removed
  // from the picker "for now" — VANILLA_RULES and the Custom-editor machinery
  // (GameModePicker) are intact, so restoring any of them is just re-adding the
  // object here.
];

export const DEFAULT_MODE_ID = 'vanilla';

// Retired picker entries remain resolvable for existing saves. Definitions from 8b9eb2c^.
const LEGACY_MODES: GameMode[] = [
  { id: 'casual', name: 'Casual', description: 'Legacy Casual run.', tagline: 'Forgiving � good for a first run',
    rules: { ...VANILLA_RULES, pityThreshold: 30, omniChanceBase: 4, ritualCostMultiplier: 0.6 } },
  { id: 'hardcore', name: 'Hardcore', description: 'Legacy Hardcore run.', tagline: 'No pity � for veterans',
    rules: { ...VANILLA_RULES, pityEnabled: false, omniChanceBase: 1, ritualCostMultiplier: 1.5 } },
  { id: 'region-rush', name: 'Region Rush', description: 'Legacy Region Rush run.', tagline: 'Region passives ON',
    rules: { ...VANILLA_RULES, pityThreshold: 45, regionModifiers: true } },
  { id: 'xtreme', name: 'Xtreme Start', description: 'Legacy Xtreme Start run.', tagline: 'Lumbridge only at the start',
    rules: { ...VANILLA_RULES, startArea: 'lumbridge' } },
  { id: 'custom', name: 'Custom', description: 'Your saved custom rules.', tagline: 'Your rules, your run',
    rules: { ...VANILLA_RULES } },
];

const MODE_BY_ID: Record<string, GameMode> = Object.fromEntries(
  [...GAME_MODES, ...LEGACY_MODES].map(m => [m.id, m]),
);

export const getGameMode = (id?: string): GameMode =>
  MODE_BY_ID[id ?? DEFAULT_MODE_ID] ?? MODE_BY_ID[DEFAULT_MODE_ID];

/**
 * Resolve the active ruleset for a run. For the 'custom' mode the run carries
 * its own `customRules`; presets use their built-in rules.
 */
export const resolveModeRules = (id?: string, customRules?: GameModeRules): GameModeRules => {
  if (id === 'custom' && customRules) return customRules;
  return getGameMode(id).rules;
};

// Bounds for the Custom editor sliders.
export const CUSTOM_RULE_BOUNDS = {
  pityThreshold: { min: 10, max: 100, step: 5 },
  omniChanceBase: { min: 0, max: 25, step: 1 },
  ritualCostMultiplier: { min: 0.25, max: 2.5, step: 0.05 },
} as const;
