import { describe, it, expect } from 'vitest';
import {
  gameReducer,
  initialState,
  prepareGameTransition,
  prepareLevelUpActions,
  prepareKeyRollAction,
  prepareCATaskCompletionActions,
} from './GameContext';
import { drawDice } from '../utils/seededRng';
import { TableType, LogEntry, type FailureFateAward } from '../types';
import { isRollEntry } from '../utils/logEntry';
import { XTREME_MILESTONE_INTERVAL, CHUNKED_MILESTONE_INTERVAL } from '../config/economy';
import { isValidUnlock } from '../utils/gameEngine';
import { ALL_CHUNKS, CHUNKED_START, chunkKey } from '../utils/chunkAdjacency';
import { ALL_CA_TASKS } from '../data/caTasks';
import type { KeyRollContext } from '../config/vanillaKeyEconomy';

/**
 * Tests for the core game reducer — every roll, unlock, ritual, level-up and
 * game-mode transition resolves here. RNG is lifted into the action creators
 * (the reducer just consumes pre-rolled values), so every case is deterministic.
 */

const base = () => ({ ...initialState, runId: 'test-run', runRevision: 0, lastEvent: null });

const roll = (over: Partial<{
  success: boolean;
  omni: boolean;
  pity: boolean;
  roll: number;
  baseThreshold: number;
  threshold: number;
  source: string;
  failureFate: FailureFateAward;
  context: KeyRollContext;
}>) => ({
  type: 'ROLL_RESULT' as const,
  payload: {
    success: false,
    omni: false,
    pity: false,
    roll: 50,
    baseThreshold: 50,
    threshold: 50,
    source: 'Test',
    failureFate: 1 as FailureFateAward,
    ...over,
  },
});

// --- ROLL_RESULT ------------------------------------------------------------

describe('ROLL_RESULT', () => {
  it('a successful roll grants a key and clears fate', () => {
    const s = gameReducer({ ...base(), fatePoints: 12 }, roll({ success: true }));
    expect(s.keys).toBe(initialState.keys + 1);
    expect(s.fatePoints).toBe(0);
    expect(s.history).toHaveLength(1);
    expect(s.history.at(-1)?.meta?.fatePointsEarned).toBe(0);
  });

  it('a failed roll accumulates a fate point and grants no key', () => {
    const previous = base();
    const s = gameReducer(previous, roll({ success: false }));
    expect(s.history.at(-1)).toMatchObject({
      type: 'ROLL_FAIL',
      meta: { fatePointsEarned: 1 },
    });
    expect(s.fatePoints).toBe(previous.fatePoints + 1);
    expect(s.keys).toBe(initialState.keys);
  });

  it('adds the prepared weighted Fate award on failure', () => {
    const previous = { ...base(), fatePoints: 10 };
    const failed = gameReducer(previous, roll({
      success: false,
      failureFate: 3,
    }));
    expect(failed.fatePoints).toBe(13);
    expect(failed.history.at(-1)?.meta?.fatePointsEarned).toBe(3);
  });

  it('an omni roll grants both a special key and a standard key', () => {
    const s = gameReducer(base(), roll({ success: true, omni: true }));
    expect(s.specialKeys).toBe(initialState.specialKeys + 1);
    expect(s.keys).toBe(initialState.keys + 1);
    expect(s.fatePoints).toBe(0);
    expect(s.history.at(-1)?.meta?.fatePointsEarned).toBe(0);
  });

  it('a pity key is granted on a failed roll flagged as pity', () => {
    const s = gameReducer({ ...base(), fatePoints: 49 }, roll({ success: false, pity: true }));
    expect(s.keys).toBe(initialState.keys + 1);
    expect(s.fatePoints).toBe(0);
    expect(s.history.at(-1)).toMatchObject({
      type: 'PITY',
      meta: { fatePointsEarned: 1 },
    });
  });


  it('preserves weighted Fate overflow after a pity key', () => {
    const pity = gameReducer({ ...base(), fatePoints: 49 }, roll({
      success: false,
      pity: true,
      failureFate: 3,
    }));
    expect(pity.keys).toBe(initialState.keys + 1);
    expect(pity.fatePoints).toBe(2);
    expect(pity.history.at(-1)?.meta?.fatePointsEarned).toBe(3);
  });
  it('a Greed-buffed success grants two keys', () => {
    const s = gameReducer({ ...base(), activeBuff: 'GREED' as const }, roll({ success: true }));
    expect(s.keys).toBe(initialState.keys + 2);
  });

  it('preserves decimal roll, base chance, and effective chance in every result shape', () => {
    const cases = [
      {
        state: gameReducer(base(), roll({
          success: true, roll: 8.2, baseThreshold: 8.2, threshold: 9.2,
        })),
        expectedRoll: 8.2,
      },
      {
        state: gameReducer(base(), roll({
          success: true, omni: true, roll: 8.2, baseThreshold: 8.2, threshold: 9.2,
        })),
        expectedRoll: 8.2,
      },
      {
        state: gameReducer(base(), roll({
          roll: 9.3, baseThreshold: 8.2, threshold: 9.2,
        })),
        expectedRoll: 9.3,
      },
      {
        state: gameReducer({ ...base(), fatePoints: 49 }, roll({
          pity: true, roll: 9.3, baseThreshold: 8.2, threshold: 9.2,
        })),
        expectedRoll: 9.3,
      },
    ];

    for (const { state, expectedRoll } of cases) {
      const entry = state.history.at(-1)!;
      expect(entry.rollValue).toBe(expectedRoll);
      expect(entry.baseThreshold).toBe(8.2);
      expect(entry.threshold).toBe(9.2);
      expect(entry.meta).toMatchObject({ baseThreshold: 8.2, threshold: 9.2 });
    }
  });

  it('shows a matching threshold once in every roll result sentence', () => {
    const cases = [
      {
        state: gameReducer(base(), roll({
          success: true, omni: true, roll: 1, baseThreshold: 2.2, threshold: 2.2,
        })),
        expected: 'Critical Success! Rolled 1.0 vs 2.2%.',
      },
      {
        state: gameReducer(base(), roll({
          success: true, roll: 1, baseThreshold: 2.2, threshold: 2.2,
        })),
        expected: 'Rolled 1.0 (≤ 2.2%).',
      },
      {
        state: gameReducer(base(), roll({
          roll: 84.7, baseThreshold: 2.2, threshold: 2.2,
        })),
        expected: 'Rolled 84.7 (> 2.2%). Fate: 1/50',
      },
      {
        state: gameReducer({ ...base(), fatePoints: 49 }, roll({
          pity: true, roll: 84.7, baseThreshold: 2.2, threshold: 2.2,
        })),
        expected: 'Rolled 84.7 at 2.2%, but Fate intervened.',
      },
    ];

    for (const { state, expected } of cases) {
      expect(state.history.at(-1)?.details).toBe(expected);
    }
  });

  it('names differing effective and base thresholds once in every roll result sentence', () => {
    const cases = [
      {
        state: gameReducer(base(), roll({
          success: true, omni: true, roll: 1, baseThreshold: 2.2, threshold: 3.2,
        })),
        expected: 'Critical Success! Rolled 1.0 vs 3.2% effective; 2.2% base.',
      },
      {
        state: gameReducer(base(), roll({
          success: true, roll: 1, baseThreshold: 2.2, threshold: 3.2,
        })),
        expected: 'Rolled 1.0 (≤ 3.2% effective; 2.2% base).',
      },
      {
        state: gameReducer(base(), roll({
          roll: 84.7, baseThreshold: 2.2, threshold: 3.2,
        })),
        expected: 'Rolled 84.7 (> 3.2% effective; 2.2% base). Fate: 1/50',
      },
      {
        state: gameReducer({ ...base(), fatePoints: 49 }, roll({
          pity: true, roll: 84.7, baseThreshold: 2.2, threshold: 3.2,
        })),
        expected: 'Rolled 84.7 at 3.2% effective (2.2% base), but Fate intervened.',
      },
    ];

    for (const { state, expected } of cases) {
      expect(state.history.at(-1)?.details).toBe(expected);
    }
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

  it('consumes one Luck buff on the first of two queued rolls', () => {
    const dice = (_purpose: string, index = 0, max = 100) =>
      index === 1 ? max / 10 : max * 0.9;
    const start = { ...base(), activeBuff: 'LUCK' as const };

    const firstAction = prepareKeyRollAction(start, 'First queued roll', 20, 1, dice);
    const first = prepareGameTransition(start, firstAction).state;
    const secondAction = prepareKeyRollAction(first, 'Second queued roll', 20, 1, dice);
    const second = prepareGameTransition(first, secondAction).state;

    expect(first.history.at(-1)?.type).toBe('ROLL_SUCCESS');
    expect(first.activeBuff).toBe('NONE');
    expect(second.history.at(-1)?.type).toBe('ROLL_FAIL');
  });

  it('grants only one pity when two queued failures start at the pity boundary', () => {
    const dice = (_purpose: string, _index = 0, max = 100) => max;
    const start = { ...base(), fatePoints: 49 };

    const firstAction = prepareKeyRollAction(start, 'First queued failure', 20, 1, dice);
    const first = prepareGameTransition(start, firstAction).state;
    const secondAction = prepareKeyRollAction(first, 'Second queued failure', 20, 1, dice);
    const second = prepareGameTransition(first, secondAction).state;

    expect(first.history.at(-1)?.type).toBe('PITY');
    expect(first.fatePoints).toBe(0);
    expect(second.history.at(-1)?.type).toBe('ROLL_FAIL');
    expect(second.fatePoints).toBe(1);
    expect(second.keys).toBe(start.keys + 1);
  });

  it('sets pity when a weighted award reaches the threshold, but not below it', () => {
    const dice = (_purpose: string, _index = 0, max = 100) => max;
    const reachesPity = prepareKeyRollAction(
      { ...base(), fatePoints: 49 }, 'Weighted failure', 20, 3, dice,
    );
    const belowPity = prepareKeyRollAction(
      { ...base(), fatePoints: 46 }, 'Weighted failure', 20, 3, dice,
    );

    expect(reachesPity.payload.pity).toBe(true);
    expect(reachesPity.payload.failureFate).toBe(3);
    expect(belowPity.payload.pity).toBe(false);
  });

  it('replays the same next seeded roll from identical restored state', () => {
    const snapshot = {
      ...base(),
      rngSeed: 'FATE-ATOMIC',
      history: [],
    };
    const restored = {
      ...snapshot,
      unlocks: { ...snapshot.unlocks },
      history: [...snapshot.history],
    };
    const reset = {
      ...snapshot,
      unlocks: { ...snapshot.unlocks },
      history: [...snapshot.history],
    };
    const diceFor = (state: typeof snapshot) =>
      (purpose: string, index = 0, max = 100) =>
        drawDice(
          state.rngSeed,
          state.history.at(-1)?.hash ?? 'genesis',
          purpose,
          index,
          max,
        );

    const restoredAction = prepareKeyRollAction(
      restored,
      'Seeded replay',
      50,
      1,
      diceFor(restored),
    );
    const resetAction = prepareKeyRollAction(
      reset,
      'Seeded replay',
      50,
      1,
      diceFor(reset),
    );

    expect(restoredAction).toEqual(resetAction);
  });
  it('queues the exact prepared state without regenerating event fields', () => {
    const start = base();
    const prepared = prepareGameTransition(start, roll({ success: true }));
    const committed = gameReducer(start, prepared.commit);

    expect(committed).toBe(prepared.state);
    expect(committed.lastEvent?.id).toBe(prepared.state.lastEvent?.id);
    expect(committed.history.at(-1)?.timestamp)
      .toBe(prepared.state.history.at(-1)?.timestamp);
  });

  it('prepares seeded level-up reward draws from the pre-level history tip', () => {
    const seed = 'FATE-LEVEL-8';
    const start = {
      ...base(),
      rngSeed: seed,
      unlocks: {
        ...base().unlocks,
        levels: { ...base().unlocks.levels, Attack: 98 },
      },
    };
    let currentContext = start.history.at(-1)?.hash ?? 'genesis';
    const drawContexts: Array<{ context: string; index: number }> = [];
    const dice = (purpose: string, index = 0, max = 100) => {
      drawContexts.push({ context: currentContext, index });
      return drawDice(seed, currentContext, purpose, index, max);
    };

    const prepared = prepareLevelUpActions(
      start,
      'Attack',
      0.01,
      dice,
    );

    expect(drawContexts).toEqual([
      { context: 'genesis', index: 0 },
      { context: 'genesis', index: 1 },
      { context: 'genesis', index: 2 },
    ]);
    expect(prepared.rewardAction.payload).toMatchObject({
      roll: 5.7,
      baseThreshold: 19.8,
      threshold: 19.8,
      source: 'Attack Level 99',
      success: true,
    });

    const afterLevel = prepareGameTransition(start, prepared.levelAction).state;
    const levelTip = afterLevel.history.at(-1)?.hash;
    expect(levelTip).toBeTruthy();
    expect(levelTip).not.toBe('genesis');
    currentContext = levelTip!;

    const finished = prepareGameTransition(afterLevel, prepared.rewardAction).state;
    expect(finished.history.map(entry => entry.type))
      .toEqual(['LEVEL_UP', 'ROLL_SUCCESS']);
    expect(drawContexts).toHaveLength(3);
  });
});

describe('ROLL_RESULT — Vanilla key safety valve', () => {
  const bossContext = {
    kind: 'boss' as const,
    bossName: 'Zulrah',
    bossClass: 'mid' as const,
  };
  const clueContext = { kind: 'clue' as const, clueTier: 'Elite' };
  const vanillaState = () => ({ ...base(), gameModeId: 'vanilla' });

  it('uses each boss reserve stage as the exact contextual base chance', () => {
    const draws: Array<{ purpose: string; index: number; max: number }> = [];
    const state = {
      ...vanillaState(),
      bossStandardKeysAwarded: { Zulrah: 1 },
    };
    const action = prepareKeyRollAction(
      state,
      'Zulrah',
      99,
      1,
      (purpose, index = 0, max = 100) => {
        draws.push({ purpose, index, max });
        return index === 0 ? 1500 : max;
      },
      undefined,
      undefined,
      undefined,
      bossContext,
    );

    expect(action).not.toBeNull();
    expect(action?.payload).toMatchObject({
      baseThreshold: 15,
      threshold: 15,
      roll: 15,
      success: true,
      context: bossContext,
    });
    expect(draws).toEqual([
      { purpose: 'roll:boss:Zulrah:1', index: 0, max: 10_000 },
      { purpose: 'roll:boss:Zulrah:1', index: 1, max: 10_000 },
      { purpose: 'roll:boss:Zulrah:1', index: 2, max: 100 },
    ]);
  });

  it('returns before any draw after a Vanilla boss reserve is capped', () => {
    let draws = 0;
    const action = prepareKeyRollAction(
      { ...vanillaState(), bossStandardKeysAwarded: { Zulrah: 2 } },
      'Zulrah',
      30,
      1,
      () => {
        draws += 1;
        return 1;
      },
      undefined,
      undefined,
      undefined,
      bossContext,
    );

    expect(action).toBeNull();
    expect(draws).toBe(0);
  });

  it('clamps a Greed success to the one remaining boss allowance', () => {
    const next = gameReducer(
      {
        ...vanillaState(),
        activeBuff: 'GREED',
        bossStandardKeysAwarded: { Zulrah: 1 },
      },
      roll({ success: true, context: bossContext }),
    );

    expect(next.keys).toBe(initialState.keys + 1);
    expect(next.bossStandardKeysAwarded?.Zulrah).toBe(2);
    expect(next.history.at(-1)?.meta).toMatchObject({
      standardKeysAwarded: 1,
      outcome: 'greed',
      exhausted: true,
    });
  });

  it('keeps Omni currency independent while consuming one Standard boss allowance', () => {
    const next = gameReducer(vanillaState(), roll({
      success: true,
      omni: true,
      context: bossContext,
    }));

    expect(next.keys).toBe(initialState.keys + 1);
    expect(next.specialKeys).toBe(initialState.specialKeys + 1);
    expect(next.bossStandardKeysAwarded?.Zulrah).toBe(1);
  });

  it('tracks the actual Standard Key award for a Greed clue result', () => {
    const next = gameReducer(
      { ...vanillaState(), activeBuff: 'GREED' },
      roll({ success: true, context: clueContext }),
    );

    expect(next.keys).toBe(initialState.keys + 2);
    expect(next.clueStandardKeysAwarded).toBe(2);
  });

  it('rejects a stale capped action without mutating roll state', () => {
    const capped = {
      ...vanillaState(),
      keys: 11,
      fatePoints: 49,
      activeBuff: 'GREED' as const,
      bossStandardKeysAwarded: { Zulrah: 2 },
      history: [{ id: 'prior', timestamp: 1, type: 'ROLL_FAIL' as const, message: 'No Key.' }],
    };

    expect(gameReducer(capped, roll({ success: false, pity: true, context: bossContext }))).toBe(capped);
  });

  it('records the exact boss identity and reserve accounting in history metadata', () => {
    const next = gameReducer(
      { ...vanillaState(), bossStandardKeysAwarded: { Zulrah: 1 } },
      roll({ success: true, baseThreshold: 15, threshold: 15, context: bossContext }),
    );

    expect(next.history.at(-1)?.meta).toMatchObject({
      context: bossContext,
      bossName: 'Zulrah',
      bossClass: 'mid',
      effectiveRate: 15,
      standardKeysAwarded: 1,
      currentStage: 1,
      remainingStage: 0,
      remainingReserve: 0,
      outcome: 'normal',
      exhausted: true,
    });
  });

  it('leaves counters unchanged outside Vanilla mode', () => {
    const next = gameReducer(
      {
        ...base(),
        gameModeId: 'hardcore',
        bossStandardKeysAwarded: { Zulrah: 1 },
        clueStandardKeysAwarded: 4,
      },
      roll({ success: true, context: bossContext }),
    );

    expect(next.bossStandardKeysAwarded).toEqual({ Zulrah: 1 });
    expect(next.clueStandardKeysAwarded).toBe(4);
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
    const expectedGreedRefund = 8;
    // +1 normal fail fate, +8 refund (ceil(15 × 0.5)); buff consumed.
    expect(s.fatePoints).toBe(9);
    expect(s.history.at(-1)?.meta?.fatePointsEarned).toBe(1 + expectedGreedRefund);
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

  it('guarantees one Chaos Key at a skill milestone', () => {
    const state = {
      ...base(),
      unlocks: {
        ...initialState.unlocks,
        levels: { ...initialState.unlocks.levels, Attack: 29 },
      },
    };
    const milestone = gameReducer(state, {
      type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 },
    });

    expect(milestone.chaosKeys).toBe(initialState.chaosKeys + 1);
    expect(milestone.lastEvent?.meta).toMatchObject({
      chaosKeysAwarded: 1,
      chaosKeyAwarded: true,
    });
  });

  it('stacks the random and guaranteed Chaos Key awards', () => {
    const state = {
      ...base(),
      unlocks: {
        ...initialState.unlocks,
        levels: { ...initialState.unlocks.levels, Attack: 29 },
      },
    };
    const doubleDrop = gameReducer(state, {
      type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.01 },
    });

    expect(doubleDrop.chaosKeys).toBe(initialState.chaosKeys + 2);
    expect(doubleDrop.lastEvent?.meta).toMatchObject({
      chaosKeysAwarded: 2,
      chaosKeyAwarded: true,
    });
  });

  it('does not guarantee a Chaos Key outside a skill milestone', () => {
    const state = {
      ...base(),
      unlocks: {
        ...initialState.unlocks,
        levels: { ...initialState.unlocks.levels, Attack: 30 },
      },
    };
    const nonMilestone = gameReducer(state, {
      type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 0.5 },
    });

    expect(nonMilestone.chaosKeys).toBe(initialState.chaosKeys);
    expect(nonMilestone.lastEvent?.meta).toMatchObject({
      chaosKeysAwarded: 0,
      chaosKeyAwarded: false,
    });
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

describe('LOAD_SAVE normalized replacement', () => {
  it('replaces the whole accepted state without retaining current-only fields', () => {
    const current = {
      ...base(),
      rival: {
        mode: 'sim' as const,
        personaId: 'old-rival',
        name: 'Old rival',
        emoji: '!',
        keysPerDay: 1,
        seed: 1,
        startedAt: 1,
      },
    };
    const accepted = { ...structuredClone(initialState), keys: 8 };

    const replaced = gameReducer(current, { type: 'LOAD_SAVE', payload: accepted });

    expect(replaced.keys).toBe(8);
    expect(replaced.rival).toBeUndefined();
    expect(replaced.lastEvent).toBeNull();
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

  it('COMPLETE_CA appends once and never removes a historical tier', () => {
    const once = gameReducer(base(), { type: 'COMPLETE_CA', payload: 'Easy' });
    const twice = gameReducer(once, { type: 'COMPLETE_CA', payload: 'Easy' });

    expect(once.unlocks.cas).toEqual(['Easy']);
    expect(twice.unlocks.cas).toEqual(['Easy']);
  });

  it('prepares one task roll and every newly crossed sticky CA tier', () => {
    const easyTasks = ALL_CA_TASKS.filter(task => task.tierId === 'Easy');
    const mediumTasks = ALL_CA_TASKS.filter(task => task.tierId === 'Medium');
    const candidate = easyTasks.at(-1)!;
    const start = {
      ...base(),
      unlocks: {
        ...base().unlocks,
        completedTasks: [
          ...easyTasks.slice(0, -1).map(task => task.id),
          ...mediumTasks.map(task => task.id),
        ],
      },
    };
    const drawIndexes: number[] = [];
    const prepared = prepareCATaskCompletionActions(
      start,
      candidate,
      (_purpose, index = 0) => {
        drawIndexes.push(index);
        return 100;
      },
    );

    expect(prepared.result).toEqual({ ok: true });
    expect(prepared.actions.map(action => action.type)).toEqual([
      'COMPLETE_TASK',
      'ROLL_RESULT',
      'COMPLETE_CA',
      'COMPLETE_CA',
    ]);
    expect(prepared.actions[1]).toMatchObject({
      payload: {
        source: 'Combat Achievement (Easy)',
        threshold: 8,
      },
    });
    expect(drawIndexes).toEqual([0, 1]);

    const finished = prepared.actions.reduce(
      (state, action) => prepareGameTransition(state, action).state,
      start,
    );
    expect(finished.unlocks.completedTasks).toContain(candidate.id);
    expect(finished.unlocks.cas).toEqual(['Easy', 'Medium']);
    expect(finished.history.filter(entry => entry.type === 'ROLL_FAIL')).toHaveLength(1);

    const repeated = prepareCATaskCompletionActions(
      finished,
      candidate,
      () => 1,
    );
    expect(repeated.result).toEqual({ ok: false, reason: 'Already completed' });
    expect(repeated.actions).toEqual([]);
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
