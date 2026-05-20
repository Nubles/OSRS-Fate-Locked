import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from './GameContext';
import { TableType, LogEntry } from '../types';

/**
 * Tests for the core game reducer — every roll, unlock, ritual, level-up and
 * game-mode transition resolves here. RNG is lifted into the action creators
 * (the reducer just consumes pre-rolled values), so every case is deterministic.
 */

const base = () => ({ ...initialState, lastEvent: null });

const roll = (over: Partial<{ success: boolean; omni: boolean; pity: boolean; roll: number; threshold: number; source: string }>) =>
  ({ type: 'ROLL_RESULT' as const, payload: { success: false, omni: false, pity: false, roll: 50, threshold: 50, source: 'Test', ...over } });

// --- ROLL_RESULT ------------------------------------------------------------

describe('ROLL_RESULT', () => {
  it('a successful roll grants a key and clears fate', () => {
    const s = gameReducer({ ...base(), fatePoints: 12 }, roll({ success: true }));
    expect(s.keys).toBe(initialState.keys + 1);
    expect(s.fatePoints).toBe(0);
    expect(s.history).toHaveLength(1);
  });

  it('a failed roll accumulates a fate point and grants no key', () => {
    const s = gameReducer(base(), roll({ success: false }));
    expect(s.fatePoints).toBe(initialState.fatePoints + 1);
    expect(s.keys).toBe(initialState.keys);
  });

  it('an omni roll grants both a special key and a standard key', () => {
    const s = gameReducer(base(), roll({ success: true, omni: true }));
    expect(s.specialKeys).toBe(initialState.specialKeys + 1);
    expect(s.keys).toBe(initialState.keys + 1);
    expect(s.fatePoints).toBe(0);
  });

  it('a pity key is granted on a failed roll flagged as pity', () => {
    const s = gameReducer({ ...base(), fatePoints: 49 }, roll({ success: false, pity: true }));
    expect(s.keys).toBe(initialState.keys + 1);
    expect(s.fatePoints).toBe(0);
  });

  it('a Greed-buffed success grants two keys', () => {
    const s = gameReducer({ ...base(), activeBuff: 'GREED' as const }, roll({ success: true }));
    expect(s.keys).toBe(initialState.keys + 2);
  });

  it('clears the LUCK / GREED buff after a roll', () => {
    expect(gameReducer({ ...base(), activeBuff: 'LUCK' as const }, roll({ success: false })).activeBuff).toBe('NONE');
    expect(gameReducer({ ...base(), activeBuff: 'GREED' as const }, roll({ success: true })).activeBuff).toBe('NONE');
  });
});

// --- UNLOCK -----------------------------------------------------------------

describe('UNLOCK', () => {
  it('adds a region and deducts a standard key', () => {
    const s = gameReducer(base(), { type: 'UNLOCK', payload: { table: TableType.REGIONS, item: 'Karamja', costType: 'key', cost: 1 } });
    expect(s.unlocks.regions).toContain('Karamja');
    expect(s.keys).toBe(initialState.keys - 1);
  });

  it('spends a special key when costType is specialKey', () => {
    const s = gameReducer({ ...base(), specialKeys: 2 }, { type: 'UNLOCK', payload: { table: TableType.BOSSES, item: 'Zulrah', costType: 'specialKey', cost: 1 } });
    expect(s.unlocks.bosses).toContain('Zulrah');
    expect(s.specialKeys).toBe(1);
  });

  it('increments an equipment tier rather than appending', () => {
    const s = gameReducer(base(), { type: 'UNLOCK', payload: { table: TableType.EQUIPMENT, item: 'Head', costType: 'key', cost: 1 } });
    expect(s.unlocks.equipment['Head']).toBe(1);
  });

  it('does not duplicate an array unlock when the same item is unlocked twice', () => {
    const once = gameReducer(base(), { type: 'UNLOCK', payload: { table: TableType.REGIONS, item: 'Karamja', costType: 'key', cost: 1 } });
    const twice = gameReducer(once, { type: 'UNLOCK', payload: { table: TableType.REGIONS, item: 'Karamja', costType: 'key', cost: 1 } });
    expect(twice.unlocks.regions.filter((r) => r === 'Karamja')).toHaveLength(1);
  });

  it('caps the skill tier at 10 even if dispatched past the cap', () => {
    let s = base();
    for (let i = 0; i < 15; i++) {
      s = gameReducer(s, { type: 'UNLOCK', payload: { table: TableType.SKILLS, item: 'Mining', costType: 'key', cost: 1 } });
    }
    expect(s.unlocks.skills['Mining']).toBe(10);
  });

  it('caps the equipment tier at EQUIPMENT_TIER_MAX', () => {
    let s = base();
    for (let i = 0; i < 20; i++) {
      s = gameReducer(s, { type: 'UNLOCK', payload: { table: TableType.EQUIPMENT, item: 'Head', costType: 'key', cost: 1 } });
    }
    // EQUIPMENT_TIER_MAX is 9 (see config/rules.ts); the reducer must not exceed it.
    expect(s.unlocks.equipment['Head']).toBeLessThanOrEqual(9);
  });
});

// --- Void Altar rituals -----------------------------------------------------

describe('rituals', () => {
  it('Clarity costs 15 Fate and applies the LUCK buff (Vanilla)', () => {
    const s = gameReducer({ ...base(), fatePoints: 20 }, { type: 'RITUAL_LUCK' });
    expect(s.fatePoints).toBe(5);
    expect(s.activeBuff).toBe('LUCK');
  });

  it('Greed costs 30 Fate and applies the GREED buff (Vanilla)', () => {
    const s = gameReducer({ ...base(), fatePoints: 40 }, { type: 'RITUAL_GREED' });
    expect(s.fatePoints).toBe(10);
    expect(s.activeBuff).toBe('GREED');
  });

  it('Chaos costs 25 Fate and grants a chaos key (Vanilla)', () => {
    const s = gameReducer({ ...base(), fatePoints: 30 }, { type: 'RITUAL_CHAOS' });
    expect(s.fatePoints).toBe(5);
    expect(s.chaosKeys).toBe(initialState.chaosKeys + 1);
  });

  it('Transmutation converts 5 keys into 1 special key', () => {
    const s = gameReducer({ ...base(), keys: 10 }, { type: 'RITUAL_TRANSMUTE' });
    expect(s.keys).toBe(5);
    expect(s.specialKeys).toBe(initialState.specialKeys + 1);
  });

  it('ritual cost scales with the game mode (Casual = 0.6x)', () => {
    const s = gameReducer({ ...base(), gameModeId: 'casual', fatePoints: 20 }, { type: 'RITUAL_LUCK' });
    expect(s.fatePoints).toBe(20 - Math.round(15 * 0.6)); // 20 - 9 = 11
  });
});

// --- LEVEL_UP ---------------------------------------------------------------

describe('LEVEL_UP', () => {
  it('increments the skill level', () => {
    const state = { ...base(), unlocks: { ...initialState.unlocks, levels: { ...initialState.unlocks.levels, Attack: 5 } } };
    const s = gameReducer(state, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.unlocks.levels['Attack']).toBe(6);
  });

  it('awards no chaos key when the roll is above the 2% chance', () => {
    const s = gameReducer(base(), { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.chaosKeys).toBe(initialState.chaosKeys);
  });

  it('caps the skill level at 99 and is idempotent past the cap', () => {
    const at99 = { ...base(), unlocks: { ...initialState.unlocks, levels: { ...initialState.unlocks.levels, 'Mining': 99 } } };
    const s = gameReducer(at99, { type: 'LEVEL_UP', payload: { skill: 'Mining', chaosRoll: 0.99 } });
    expect(s.unlocks.levels['Mining']).toBe(99);
  });

  it('awards a chaos key when the roll lands under 2%', () => {
    const s = gameReducer(base(), { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.01 } });
    expect(s.chaosKeys).toBe(initialState.chaosKeys + 1);
  });
});

// --- SET_GAME_MODE ----------------------------------------------------------

describe('LOAD_SAVE migration', () => {
  it('dedupes unlock arrays from a corrupted save', () => {
    const corrupted: any = {
      keys: 0,
      unlocks: {
        regions: ['Karamja', 'Karamja', 'Falador'],
        bosses: ['Zulrah', 'Zulrah'],
      },
    };
    const s = gameReducer(base(), { type: 'LOAD_SAVE', payload: corrupted });
    expect(s.unlocks.regions).toEqual(['Karamja', 'Falador']);
    expect(s.unlocks.bosses).toEqual(['Zulrah']);
  });
});

describe('SET_GAME_MODE', () => {
  it('applies the chosen mode and locks it', () => {
    const s = gameReducer(base(), { type: 'SET_GAME_MODE', payload: { modeId: 'hardcore' } });
    expect(s.gameModeId).toBe('hardcore');
    expect(s.gameModeLocked).toBe(true);
  });

  it('is rejected once the mode is already locked', () => {
    const locked = { ...base(), gameModeId: 'vanilla', gameModeLocked: true };
    const s = gameReducer(locked, { type: 'SET_GAME_MODE', payload: { modeId: 'hardcore' } });
    expect(s.gameModeId).toBe('vanilla');
  });

  it('is rejected once the run has history', () => {
    const entry: LogEntry = { id: 'x', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.' };
    const started = { ...base(), history: [entry] };
    const s = gameReducer(started, { type: 'SET_GAME_MODE', payload: { modeId: 'hardcore' } });
    expect(s.gameModeId).toBe(initialState.gameModeId);
  });
});

// --- lifecycle --------------------------------------------------------------

describe('lifecycle actions', () => {
  it('RESET returns to the initial state', () => {
    const dirty = { ...base(), keys: 99, fatePoints: 40, specialKeys: 5 };
    const s = gameReducer(dirty, { type: 'RESET' });
    expect(s.keys).toBe(initialState.keys);
    expect(s.fatePoints).toBe(0);
    expect(s.history).toEqual([]);
  });

  it('COMPLETE_ONBOARDING sets the flag', () => {
    expect(gameReducer(base(), { type: 'COMPLETE_ONBOARDING' }).hasSeenOnboarding).toBe(true);
  });
});

// --- purity -----------------------------------------------------------------

describe('reducer purity', () => {
  it('does not mutate the input state', () => {
    const state = base();
    const snapshot = JSON.stringify(state);
    gameReducer(state, roll({ success: true }));
    gameReducer(state, { type: 'UNLOCK', payload: { table: TableType.REGIONS, item: 'Karamja', costType: 'key', cost: 1 } });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
