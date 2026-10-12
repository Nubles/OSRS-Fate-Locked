import { describe, expect, it } from 'vitest';
import { createFreshState, gameReducer, initialState } from './GameContext';
import { PETS } from '../data/pets';
import type { FailureFateAward, GameState } from '../types';
import { replayInvariants } from '../utils/integrity';
import { CURRENT_SAVE_VERSION, validateAndMigrateSave } from '../utils/saveSchema';
import { achievementById, achievementPayouts } from '../utils/achievements';

/**
 * Achievements pay their reward once: Fate (filled up to the pity line at
 * most), free Rituals of Clarity, and a title to wear. A run from before
 * rewards records what it has already earned and is paid nothing for it.
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

  it('records what a run from before rewards has already earned, and pays nothing for it', () => {
    const before = withPets(legacy({ fatePoints: 7 }), 5);
    const after = settle(before);

    expect(after.achievementsClaimed).toEqual(expect.arrayContaining(['pets-1', 'pets-5']));
    expect(after.fatePoints).toBe(7);
    expect(after.history).toEqual(before.history);
    // The next one it earns is paid.
    const later = settle(withPets(after, 25));
    expect(later.fatePoints).toBe(7 + 25);
    expect(later.achievementsClaimed).toContain('pets-25');
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

  it('gives a free Ritual of Clarity for the biggest ones, used before any Fate', () => {
    const before = withPets(fresh(), PETS.length);
    const after = settle(before);
    expect(after.freeClarity).toBe(1);
    expect(achievementById('pets-all')?.clarity).toBe(1);

    const fate = after.fatePoints;
    const ritual = gameReducer(after, { type: 'RITUAL_LUCK' });
    expect(ritual.activeBuff).toBe('LUCK');
    expect(ritual.fatePoints).toBe(fate);
    expect(ritual.freeClarity).toBe(0);
    expect(ritual.history.at(-1)).toMatchObject({ type: 'ALTAR', meta: { ritual: 'LUCK', fateCost: 0 } });
    expect(replayFate(ritual).final.fatePoints).toBe(ritual.fatePoints);
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
    expect(loaded.state.freeClarity).toBe(1);

    const { achievementsClaimed: _claimed, achievementTitle: _title, freeClarity: _free, ...old } = saved;
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
