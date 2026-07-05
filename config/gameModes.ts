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
    id: 'casual',
    name: 'Casual',
    description: 'A gentler run: pity arrives sooner, Omni-keys are more common, and rituals are cheaper.',
    tagline: 'Forgiving — good for a first run',
    rules: {
      pityEnabled: true,
      pityThreshold: 30,
      omniChanceBase: 4,
      ritualCostMultiplier: 0.6,
      regionModifiers: false,
      bankLocks: true,
    },
  },
  {
    id: 'hardcore',
    name: 'Hardcore',
    description: 'No safety net: the pity system is disabled, Omni-keys are rare, and rituals cost dearly.',
    tagline: 'No pity — for veterans',
    rules: {
      pityEnabled: false,
      pityThreshold: 50,
      omniChanceBase: 1,
      ritualCostMultiplier: 1.5,
      regionModifiers: false,
      bankLocks: true,
    },
  },
  {
    id: 'region-rush',
    name: 'Region Rush',
    description: 'Region passives are active — every unlocked region grants a bonus, making the unlock chase the core mechanic.',
    tagline: 'Region passives ON',
    rules: {
      pityEnabled: true,
      pityThreshold: 45,
      omniChanceBase: 2,
      ritualCostMultiplier: 1,
      regionModifiers: true,
      bankLocks: true,
    },
  },
  {
    id: 'xtreme',
    name: 'Xtreme Start',
    description: 'Begin with only Lumbridge unlocked — the rest of Misthalin (Varrock, Draynor, Edgeville…) must be earned like any other region. The hardest possible opening.',
    tagline: 'Lumbridge only at the start',
    rules: {
      pityEnabled: true,
      pityThreshold: 50,
      omniChanceBase: 2,
      ritualCostMultiplier: 1,
      regionModifiers: false,
      startArea: 'lumbridge',
      bankLocks: true,
    },
  },
  {
    id: 'chunked',
    name: 'Chunked',
    description: 'The classic "Chunked Ironman" format: you start in a single Lumbridge chunk and can only unlock a chunk that borders one you already hold. No named regions — Fate hands you a random adjacent tile of the map, one at a time.',
    tagline: 'One chunk at a time, adjacent only',
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
  {
    id: 'custom',
    name: 'Custom',
    description: 'Build your own ruleset. Every value below is yours to tune before the run begins.',
    tagline: 'Your rules, your run',
    rules: { ...VANILLA_RULES },
  },
];

export const DEFAULT_MODE_ID = 'vanilla';

const MODE_BY_ID: Record<string, GameMode> = Object.fromEntries(
  GAME_MODES.map(m => [m.id, m]),
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
