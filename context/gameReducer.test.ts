import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from './GameContext';
import { TableType, LogEntry } from '../types';
import { isRollEntry } from '../utils/logEntry';
import { XTREME_MILESTONE_INTERVAL, CHUNKED_MILESTONE_INTERVAL } from '../config/economy';
import { isValidUnlock } from '../utils/gameEngine';
import { ALL_CHUNKS, CHUNKED_START, chunkKey } from '../utils/chunkAdjacency';

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

  it('every roll branch produces a log entry that isRollEntry recognises', () => {
    // Regression test: StatsModal and scribe.ts used to filter for type === 'ROLL'
    // (which the reducer never emitted) and silently computed everything from an
    // empty array. isRollEntry is the new canonical check.
    const ok = gameReducer(base(), roll({ success: true })).history.at(-1)!;
    const omni = gameReducer(base(), roll({ success: true, omni: true })).history.at(-1)!;
    const fail = gameReducer(base(), roll({ success: false })).history.at(-1)!;
    const pity = gameReducer({ ...base(), fatePoints: 49 }, roll({ success: false, pity: true })).history.at(-1)!;
    expect(isRollEntry(ok)).toBe(true);
    expect(isRollEntry(omni)).toBe(true);
    expect(isRollEntry(fail)).toBe(true);
    expect(isRollEntry(pity)).toBe(true);
    // All four shapes must carry rollValue + threshold so stats can read them.
    for (const e of [ok, omni, fail, pity]) {
      expect(e.rollValue).toBeDefined();
      expect(e.threshold).toBeDefined();
    }
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

// --- UNLOCK — Chunked mode ---------------------------------------------------

describe('UNLOCK — Banks (bank-locked modes)', () => {
  it('unlocking a bank adds its chunk id and names it in history', () => {
    const s = gameReducer(base(), { type: 'UNLOCK', payload: { table: TableType.BANKS, item: '13618', costType: 'key', cost: 1 } });
    expect(s.unlocks.banks).toContain('13618');
    // History message resolves the id to the place name, not the raw number.
    expect(s.history[s.history.length - 1].message).toBe('Unlocked Abandoned Mine');
    expect(s.keys).toBe(initialState.keys - 1);
  });
});

describe('UNLOCK — Chunks (Chunked mode)', () => {
  it('adds a chunk key and deducts a standard key', () => {
    const target = chunkKey({ cx: CHUNKED_START.cx + 1, cy: CHUNKED_START.cy });
    const s = gameReducer(base(), { type: 'UNLOCK', payload: { table: TableType.CHUNKS, item: target, costType: 'key', cost: 1 } });
    expect(s.unlocks.chunks).toContain(target);
    expect(s.keys).toBe(initialState.keys - 1);
  });

  it('does not duplicate a chunk unlocked twice', () => {
    const target = chunkKey({ cx: CHUNKED_START.cx + 1, cy: CHUNKED_START.cy });
    const once = gameReducer(base(), { type: 'UNLOCK', payload: { table: TableType.CHUNKS, item: target, costType: 'key', cost: 1 } });
    const twice = gameReducer(once, { type: 'UNLOCK', payload: { table: TableType.CHUNKS, item: target, costType: 'key', cost: 1 } });
    expect(twice.unlocks.chunks!.filter((c) => c === target)).toHaveLength(1);
  });

  it('isValidUnlock only allows chunks in the current frontier', () => {
    const notAdjacent = ALL_CHUNKS.find(c => Math.abs(c.cx - CHUNKED_START.cx) > 20 || Math.abs(c.cy - CHUNKED_START.cy) > 20)!;
    const adjacent = chunkKey({ cx: CHUNKED_START.cx + 1, cy: CHUNKED_START.cy });
    expect(isValidUnlock(TableType.CHUNKS, chunkKey(notAdjacent), initialState.unlocks)).toBe(false);
    expect(isValidUnlock(TableType.CHUNKS, adjacent, initialState.unlocks)).toBe(true);
  });
});

// --- Void Altar rituals -----------------------------------------------------

describe('rituals', () => {
  it('Clarity costs 8 Fate and applies the LUCK buff (Vanilla)', () => {
    const s = gameReducer({ ...base(), fatePoints: 20 }, { type: 'RITUAL_LUCK' });
    expect(s.fatePoints).toBe(12);
    expect(s.activeBuff).toBe('LUCK');
  });

  it('Greed costs 15 Fate and applies the GREED buff (Vanilla)', () => {
    const s = gameReducer({ ...base(), fatePoints: 40 }, { type: 'RITUAL_GREED' });
    expect(s.fatePoints).toBe(25);
    expect(s.activeBuff).toBe('GREED');
  });

  it('a failed roll under GREED refunds half the ritual cost (plus the normal fate point)', () => {
    const armed = gameReducer({ ...base(), fatePoints: 15 }, { type: 'RITUAL_GREED' }); // 0 left
    const s = gameReducer(armed, roll({ success: false }));
    // +1 normal fail fate, +8 refund (ceil(15 × 0.5)); buff consumed.
    expect(s.fatePoints).toBe(9);
    expect(s.activeBuff).toBe('NONE');
    expect(s.keys).toBe(initialState.keys);
  });

  it('a successful roll under GREED pays double and consumes the buff', () => {
    const armed = gameReducer({ ...base(), fatePoints: 15 }, { type: 'RITUAL_GREED' });
    const s = gameReducer(armed, roll({ success: true }));
    expect(s.keys).toBe(initialState.keys + 2);
    expect(s.activeBuff).toBe('NONE');
  });

  it('Void Gambit: a win pays the pre-rolled keys and zeroes fate', () => {
    const s = gameReducer({ ...base(), fatePoints: 45 },
      { type: 'RITUAL_GAMBIT', payload: { won: true, stake: 45, keysWon: 3 } });
    expect(s.keys).toBe(initialState.keys + 3);
    expect(s.fatePoints).toBe(0);
    expect(s.history[s.history.length - 1].message).toContain('WON');
  });

  it('Void Gambit: a loss zeroes fate and pays nothing', () => {
    const s = gameReducer({ ...base(), fatePoints: 45 },
      { type: 'RITUAL_GAMBIT', payload: { won: false, stake: 45, keysWon: 3 } });
    expect(s.keys).toBe(initialState.keys);
    expect(s.fatePoints).toBe(0);
  });

  it('Cartographer unlocks the chosen chunk for 40 Fate (Chunked)', () => {
    const start = { ...base(), gameModeId: 'chunked', fatePoints: 50,
      unlocks: { ...initialState.unlocks, chunks: [] } };
    const s = gameReducer(start, { type: 'RITUAL_CARTOGRAPHER', payload: { chunkKey: '46,51', label: 'Falador' } });
    expect(s.fatePoints).toBe(10);
    expect(s.unlocks.chunks).toContain('46,51');
    expect(s.history[s.history.length - 1].message).toContain('Falador');
  });

  it('Cartographer refuses when fate is short or the chunk is already owned', () => {
    const poor = gameReducer({ ...base(), gameModeId: 'chunked', fatePoints: 10 },
      { type: 'RITUAL_CARTOGRAPHER', payload: { chunkKey: '46,51', label: 'Falador' } });
    expect(poor.unlocks.chunks ?? []).not.toContain('46,51');

    const owned = { ...base(), gameModeId: 'chunked', fatePoints: 50,
      unlocks: { ...initialState.unlocks, chunks: ['46,51'] } };
    const s = gameReducer(owned, { type: 'RITUAL_CARTOGRAPHER', payload: { chunkKey: '46,51', label: 'Falador' } });
    expect(s.fatePoints).toBe(50); // untouched
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

  it('ritual cost scales with the ritual-cost multiplier (Custom 0.6x)', () => {
    const custom = { pityEnabled: true, pityThreshold: 50, omniChanceBase: 2, ritualCostMultiplier: 0.6, regionModifiers: false };
    const s = gameReducer({ ...base(), gameModeId: 'custom', customMode: custom, fatePoints: 20 }, { type: 'RITUAL_LUCK' });
    expect(s.fatePoints).toBe(20 - Math.round(8 * 0.6)); // 20 - 5 = 15
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

// --- Xtreme Start milestone insurance ---------------------------------------

describe('LEVEL_UP — Xtreme milestone insurance', () => {
  const xtremeIsolated = () => ({ ...base(), gameModeId: 'xtreme', unlocks: { ...initialState.unlocks, regions: [] } });

  it('does nothing outside Xtreme mode, even with no regions unlocked', () => {
    const state = { ...base(), gameModeId: 'vanilla', unlocks: { ...initialState.unlocks, regions: [] } };
    const s = gameReducer(state, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.keys).toBe(initialState.keys);
    expect(s.xtremeMilestoneClaimed ?? 0).toBe(0);
  });

  it('does nothing in Xtreme mode once a region has been unlocked', () => {
    const state = { ...xtremeIsolated(), unlocks: { ...initialState.unlocks, regions: ['Varrock'] } };
    const s = gameReducer(state, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.keys).toBe(initialState.keys);
  });

  it('grants a guaranteed key the instant total level crosses the interval, isolated in Xtreme', () => {
    const startingTotal = Object.values(initialState.unlocks.levels).reduce((a, b) => a + b, 0);
    // One level below the first milestone — the single Attack level-up should cross it.
    const state = {
      ...xtremeIsolated(),
      unlocks: { ...xtremeIsolated().unlocks, levels: { ...xtremeIsolated().unlocks.levels, Attack: XTREME_MILESTONE_INTERVAL - startingTotal } },
    };
    const s = gameReducer(state, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.keys).toBe(initialState.keys + 1);
    expect(s.xtremeMilestoneClaimed).toBe(1);
  });

  it('does not re-grant the same milestone on a level-up that does not cross a new threshold', () => {
    const already = { ...xtremeIsolated(), xtremeMilestoneClaimed: 1, keys: 10 };
    const s = gameReducer(already, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.keys).toBe(10);
    expect(s.xtremeMilestoneClaimed).toBe(1);
  });
});

// --- Chunked milestone insurance ---------------------------------------------

describe('LEVEL_UP — Chunked milestone insurance', () => {
  const chunkedIsolated = () => ({ ...base(), gameModeId: 'chunked', unlocks: { ...initialState.unlocks, chunks: [] } });

  it('does nothing outside Chunked mode, even with no chunks unlocked', () => {
    const state = { ...base(), gameModeId: 'vanilla', unlocks: { ...initialState.unlocks, chunks: [] } };
    const s = gameReducer(state, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.keys).toBe(initialState.keys);
    expect(s.chunkedMilestoneClaimed ?? 0).toBe(0);
  });

  it('does nothing in Chunked mode once a chunk has been unlocked', () => {
    const target = chunkKey({ cx: CHUNKED_START.cx + 1, cy: CHUNKED_START.cy });
    const state = { ...chunkedIsolated(), unlocks: { ...initialState.unlocks, chunks: [target] } };
    const s = gameReducer(state, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.keys).toBe(initialState.keys);
  });

  it('grants a guaranteed key the instant total level crosses the (tighter) interval, isolated in Chunked', () => {
    const startingTotal = Object.values(initialState.unlocks.levels).reduce((a, b) => a + b, 0);
    const state = {
      ...chunkedIsolated(),
      unlocks: { ...chunkedIsolated().unlocks, levels: { ...chunkedIsolated().unlocks.levels, Attack: CHUNKED_MILESTONE_INTERVAL - startingTotal } },
    };
    const s = gameReducer(state, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.keys).toBe(initialState.keys + 1);
    expect(s.chunkedMilestoneClaimed).toBe(1);
  });

  it('does not re-grant the same milestone on a level-up that does not cross a new threshold', () => {
    const already = { ...chunkedIsolated(), chunkedMilestoneClaimed: 1, keys: 10 };
    const s = gameReducer(already, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 } });
    expect(s.keys).toBe(10);
    expect(s.chunkedMilestoneClaimed).toBe(1);
  });

  it('the two modes\' milestone counters are independent', () => {
    const state = { ...chunkedIsolated(), xtremeMilestoneClaimed: 3 };
    const s = gameReducer(state, {
      type: 'LEVEL_UP',
      payload: { skill: 'Attack', chaosRoll: 0.5 },
    });
    expect(s.xtremeMilestoneClaimed).toBe(3); // untouched — this run is Chunked, not Xtreme
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

// --- journal completion -----------------------------------------------------

describe('journal completion actions', () => {
  it.each([
    ['COMPLETE_QUEST', 'quests', 'Cook\'s Assistant'],
    ['COMPLETE_DIARY', 'diaries', 'Falador Easy'],
    ['COMPLETE_TASK', 'completedTasks', 'fal_easy_1'],
  ] as const)('%s appends once and never removes historical completion',
    (type, field, id) => {
      const once = gameReducer(base(), { type, payload: id });
      const twice = gameReducer(once, { type, payload: id });

      expect(once.unlocks[field]).toContain(id);
      expect(twice.unlocks[field].filter(value => value === id)).toHaveLength(1);
    });

  it('preserves unrelated journal completion fields', () => {
    const start = gameReducer(base(), { type: 'COMPLETE_QUEST', payload: 'Cook\'s Assistant' });
    const next = gameReducer(start, { type: 'COMPLETE_DIARY', payload: 'Falador Easy' });

    expect(next.unlocks.quests).toContain('Cook\'s Assistant');
    expect(next.unlocks.diaries).toContain('Falador Easy');
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
