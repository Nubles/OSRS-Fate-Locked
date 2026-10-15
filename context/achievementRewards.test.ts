import { describe, expect, it } from 'vitest';
import { createFreshState, gameReducer, initialState } from './GameContext';
import { PETS } from '../data/pets';
import type { FailureFateAward, GameState } from '../types';
import { replayInvariants } from '../utils/integrity';
import { CURRENT_SAVE_VERSION, validateAndMigrateSave } from '../utils/saveSchema';
import { achievementById, achievementPayouts } from '../utils/achievements';
import { freeRitualPool, pickFreeRitual } from '../utils/achievementRewards';

/**
 * Achievements pay their reward once: Fate (filled up to the pity line at
 * most), free rituals fate picks, and a title to wear. A run from before
 * rewards records what it has already earned and gets one back pay for it.
 * Each case checks the history still replays to the run's Fate.
 */

const RUN_ID = '123e4567-e89b-42d3-a456-426614174000';

type Run = GameState & { lastEvent: null | NonNullable<ReturnType<typeof gameReducer>['lastEvent']> };

const fresh = (over: Partial<GameState> = {}): Run => ({
  ...createFreshState(),
  runId: RUN_ID,
  lastEvent: null,
  ...over,
});
/** A run from before achievement rewards: no achievementsClaimed. */
const legacy = (over: Partial<GameState> = {}): Run => ({
  ...initialState,
  runId: RUN_ID,
  runRevision: 0,
  lastEvent: null,
  ...over,
});
const settle = (state: Run) => gameReducer(state, { type: 'SETTLE_ACHIEVEMENTS', payload: achievementPayouts(state) });
const fail = (state: Run, times: number): Run => {
  let next = state;
  for (let i = 0; i < times; i++) {
    next = gameReducer(next, {
      type: 'ROLL_RESULT',
      payload: { success: false, omni: false, pity: false, roll: 99, baseThreshold: 50, threshold: 50, source: 'Test', failureFate: 1 as FailureFateAward },
    });
  }
  return next;
};
const withPets = (state: Run, count: number): Run => ({ ...state, petsClaimed: PETS.slice(0, count).map((pet) => pet.id) });
const replayFate = (state: Run) => replayInvariants(state.history, 3, { pityEnabled: true, pityThreshold: 50 });

describe('achievement rewards', () => {
  it('a new run starts with an empty settled list and earns nothing yet', () => {
    const state = fresh();
    expect(state.achievementsClaimed).toEqual([]);
    expect(settle(state)).toBe(state);
  });

  it('pays a newly earned achievement once, with a log entry the replay accounts for', () => {
    const before = withPets(fail(fresh(), 3), 5);
    const after = settle(before);

    expect(after.achievementsClaimed).toEqual(expect.arrayContaining(['pets-1', 'pets-5', 'rolls-1']));
    // Pet Shop pays 5 Fate; Funny Feeling and Tempt Fate are titles only.
    expect(after.fatePoints).toBe(before.fatePoints + 5);
    const entries = after.history.slice(before.history.length);
    expect(entries.map((e) => e.meta?.achievementId)).toEqual(expect.arrayContaining(['pets-1', 'pets-5', 'rolls-1']));
    expect(entries.every((e) => e.type === 'ACHIEVEMENT')).toBe(true);
    expect(replayFate(after).final.fatePoints).toBe(after.fatePoints);
    expect(replayFate(after).violations).toEqual([]);

    // Nothing more is due, so a second settlement changes nothing.
    expect(settle(after)).toBe(after);
  });

  it('gives a run from before rewards one back pay for what it had already earned', () => {
    const before = withPets(legacy({ fatePoints: 7 }), 5);
    const after = settle(before);

    expect(after.achievementsClaimed).toEqual(expect.arrayContaining(['pets-1', 'pets-5']));
    // Pet Shop's 5 Fate, in one entry.
    expect(after.fatePoints).toBe(12);
    expect(after.history.slice(before.history.length)).toEqual([
      expect.objectContaining({ type: 'ACHIEVEMENT', message: 'Achievement back pay', meta: expect.objectContaining({ backPay: true, fateAwarded: 5, fatePointsAfter: 12 }) }),
    ]);
    expect(settle(after)).toBe(after);
    // The next one it earns is paid as usual.
    const later = settle(withPets(after, 25));
    expect(later.fatePoints).toBe(12 + 25);
    expect(later.achievementsClaimed).toContain('pets-25');
  });

  it("caps a back pay's Fate at the pity line and pays the free rituals in full", () => {
    const before = withPets(legacy({ fatePoints: 7 }), PETS.length);
    const after = settle(before);
    expect(after.fatePoints).toBe(50);
    expect(after.freeRituals).toEqual(['LUCK']);
    const pay = after.history.at(-1);
    expect(pay?.details).toMatch(/\+43 Fate \([0-9]+ earned; Fate fills to 50 at most\) · a free Ritual of Clarity/);
    expect(replayFate(after).violations).toEqual([]);
  });

  it('gives a run from before rewards nothing when it had earned nothing that pays', () => {
    const before = withPets(legacy({ fatePoints: 7 }), 1);
    const after = settle(before);
    expect(after.fatePoints).toBe(7);
    expect(after.history).toEqual(before.history);
  });

  it('fills Fate up to the pity line at most', () => {
    const before = withPets(fail(fresh(), 40), 25);
    expect(before.fatePoints).toBe(40);
    const after = settle(before);

    expect(after.fatePoints).toBe(50);
    const menagerie = after.history.find((e) => e.meta?.achievementId === 'pets-25');
    expect(menagerie?.details).toMatch(/Fate was full/);
    expect(replayFate(after).violations).toEqual([]);
  });

  /** Settle with fate's ritual picks given, as the provider draws them. */
  const settleWith = (state: Run, picks: string[]) => gameReducer(state, {
    type: 'SETTLE_ACHIEVEMENTS',
    payload: achievementPayouts(state).map((a) => (a.freeRituals > 0 ? { ...a, ritualPicks: picks } : a)),
  });

  it('gives a free random ritual for the biggest ones, used before any Fate', () => {
    expect(achievementById('pets-all')?.freeRituals).toBe(1);
    const after = settleWith(withPets(fresh(), PETS.length), ['BARROWS']);
    expect(after.freeRituals).toEqual(['BARROWS']);
    expect(after.history.find((e) => e.meta?.achievementId === 'pets-all')?.details).toMatch(/a free Barrows Chest/);

    const fate = after.fatePoints;
    const cast = gameReducer(after, { type: 'RITUAL_BARROWS', payload: { brother: 'AHRIM' } });
    expect(cast.rituals?.barrows).toMatchObject({ brother: 'AHRIM', fateCost: 0 });
    expect(cast.fatePoints).toBe(fate);
    expect(cast.freeRituals).toBeUndefined();
    expect(cast.history.at(-1)).toMatchObject({ type: 'ALTAR', meta: { ritual: 'BARROWS', fateCost: 0, freeRitual: true } });
    expect(replayFate(cast).final.fatePoints).toBe(cast.fatePoints);

    // Only a ritual of the kind fate picked is free.
    const clarity = gameReducer(after, { type: 'RITUAL_LUCK' });
    expect(clarity.fatePoints).toBe(fate - 8);
    expect(clarity.freeRituals).toEqual(['BARROWS']);
  });

  it('never gives Sacrifice, Transmutation, the Pact or the Gambit, and the Cartographer only in Chunked', () => {
    expect(freeRitualPool('vanilla')).toEqual(['LUCK', 'GREED', 'CHAOS', 'WARD', 'TEARS', 'INVOCATIONS', 'BARROWS']);
    expect(freeRitualPool('chunked')).toContain('CARTOGRAPHER');
    for (const draw of [0, 0.3, 0.6, 0.999]) expect(freeRitualPool('vanilla')).toContain(pickFreeRitual('vanilla', draw));
    // A pick outside the pool (a stale or forged payload) falls back to Clarity.
    expect(settleWith(withPets(fresh(), PETS.length), ['SACRIFICE']).freeRituals).toEqual(['LUCK']);
  });

  it('refunds nothing when a free Ritual of Greed misses', () => {
    const after = settleWith(withPets(fresh(), PETS.length), ['GREED']);
    const greed = gameReducer(after, { type: 'RITUAL_GREED' });
    expect(greed.activeBuff).toBe('GREED');
    expect(greed.fatePoints).toBe(after.fatePoints);
    const missed = fail(greed, 1);
    expect(missed.fatePoints).toBe(greed.fatePoints + 1);
    expect(replayFate(missed).final.fatePoints).toBe(missed.fatePoints);
  });

  it('keeps a free Ritual of Clarity while another roll ritual is running', () => {
    const after = settle(withPets(fresh(), PETS.length));
    expect(after.freeRituals).toEqual(['LUCK']);
    const pact = gameReducer(after, { type: 'RITUAL_PACT' });
    expect(pact.rituals?.pactRollsLeft).toBe(3);
    const blocked = gameReducer(pact, { type: 'RITUAL_LUCK' });
    expect(blocked.freeRituals).toEqual(['LUCK']);
    expect(blocked.activeBuff).toBe('NONE');
  });

  it('wears only an earned achievement as the title', () => {
    const state = settle(withPets(fresh(), 1));
    expect(gameReducer(state, { type: 'SET_ACHIEVEMENT_TITLE', payload: 'pets-5' })).toBe(state);
    expect(gameReducer(state, { type: 'SET_ACHIEVEMENT_TITLE', payload: 'not-an-achievement' })).toBe(state);

    const worn = gameReducer(state, { type: 'SET_ACHIEVEMENT_TITLE', payload: 'pets-1' });
    expect(worn.achievementTitle).toBe('pets-1');
    const off = gameReducer(worn, { type: 'SET_ACHIEVEMENT_TITLE', payload: null });
    expect(off.achievementTitle).toBeUndefined();
  });

  it('keeps the settled list, title and free rituals through a save, and leaves an old save without a list', () => {
    const state = gameReducer(settle(withPets(fresh(), PETS.length)), { type: 'SET_ACHIEVEMENT_TITLE', payload: 'pets-all' });
    const { lastEvent: _event, ...saved } = state;
    const loaded = validateAndMigrateSave(JSON.parse(JSON.stringify(saved)), createFreshState());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.achievementsClaimed).toEqual(state.achievementsClaimed);
    expect(loaded.state.achievementTitle).toBe('pets-all');
    expect(loaded.state.freeRituals).toEqual(['LUCK']);

    const preview = validateAndMigrateSave(JSON.parse(JSON.stringify({ ...saved, freeRituals: undefined, freeClarity: 2 })), createFreshState());
    expect(preview.ok && preview.state.freeRituals).toEqual(['LUCK', 'LUCK']);
    const forged = validateAndMigrateSave(JSON.parse(JSON.stringify({ ...saved, freeRituals: ['SACRIFICE'] })), createFreshState());
    expect(forged.ok).toBe(false);

    const { achievementsClaimed: _claimed, achievementTitle: _title, freeRituals: _free, ...old } = saved;
    const oldLoaded = validateAndMigrateSave(JSON.parse(JSON.stringify({ ...old, version: CURRENT_SAVE_VERSION })), createFreshState());
    expect(oldLoaded.ok).toBe(true);
    if (!oldLoaded.ok) return;
    expect(oldLoaded.state.achievementsClaimed).toBeUndefined();

    const emptyLoaded = validateAndMigrateSave(JSON.parse(JSON.stringify({ ...old, achievementsClaimed: [] })), createFreshState());
    expect(emptyLoaded.ok && emptyLoaded.state.achievementsClaimed).toEqual([]);
  });

  it('rejects a malformed settled list', () => {
    const { lastEvent: _event, ...saved } = fresh();
    const bad = validateAndMigrateSave(JSON.parse(JSON.stringify({ ...saved, achievementsClaimed: [1] })), createFreshState());
    expect(bad.ok).toBe(false);
  });
});
