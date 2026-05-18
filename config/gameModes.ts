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
