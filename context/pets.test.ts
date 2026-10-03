import { describe, expect, it } from 'vitest';
import { gameReducer, initialState } from './GameContext';
import { petById, PETS } from '../data/pets';
import { DropSource, type FailureFateAward, type GameState, type LogEntry, type PetCompensationChoice } from '../types';
import { PET_COMPENSATION_ID } from '../utils/petCompensation';
import { replayInvariants } from '../utils/integrity';
import { CURRENT_SAVE_VERSION, validateAndMigrateSave } from '../utils/saveSchema';

/**
 * Pets give an Omni-Key, once per pet, and runs that rolled pets before get a
 * one-time offer to even it out. Every case checks the history still replays
 * to the run's balances, as the save check does.
 */

const RUN_ID = '123e4567-e89b-42d3-a456-426614174000';

type Run = GameState & { lastEvent: null | NonNullable<ReturnType<typeof gameReducer>['lastEvent']> };

const base = (over: Partial<GameState> = {}): Run => ({
  ...initialState,
  runId: RUN_ID,
  runRevision: 0,
  lastEvent: null,
  ...over,
});
const vorki = PETS.find((pet) => pet.name === 'Vorki')!;
const [first, second, third] = PETS;

const nameOf = (petId: number) => petById(petId)?.name ?? 'Not a pet';
const claim = (state: Run, petId: number) =>
  gameReducer(state, { type: 'CLAIM_PET', payload: { petId, petName: nameOf(petId) } });
const resolve = (state: Run, choice: PetCompensationChoice, petIds: number[]) =>
  gameReducer(state, { type: 'RESOLVE_PET_COMPENSATION', payload: { choice, petIds, petNames: petIds.map(nameOf) } });
const rolled = (state: Run, success: boolean) => gameReducer(state, {
  type: 'ROLL_RESULT',
  payload: {
    success, omni: false, pity: false, roll: success ? 1 : 99, baseThreshold: 50, threshold: 50,
    source: 'Test', failureFate: 1 as FailureFateAward,
  },
});
const win = (state: Run) => rolled(state, true);
/** Fate from failed rolls, so the history accounts for it. */
const fail = (state: Run, times: number): Run =>
  Array.from({ length: times }).reduce<Run>((run) => rolled(run, false), state);

/** The save check replays history from the starting Keys; it must land on the run's balances. */
const replaysTo = (state: Run) => {
  const { violations, final } = replayInvariants(state.history, initialState.keys, {
    pityEnabled: true,
    pityThreshold: 50,
  });
  expect(violations).toEqual([]);
  expect({ keys: final.keys, specialKeys: final.specialKeys, fatePoints: final.fatePoints })
    .toEqual({ keys: state.keys, specialKeys: state.specialKeys, fatePoints: state.fatePoints });
};

describe('claiming a pet', () => {
  it('gives an Omni-Key and records the pet, without touching Keys, Fate or an active ritual', () => {
    const before = base({ fatePoints: 12, activeBuff: 'GREED' });
    const next = claim(before, vorki.id);
    expect(next).toMatchObject({
      keys: before.keys,
      specialKeys: 1,
      fatePoints: 12,
      activeBuff: 'GREED',
      petsClaimed: [vorki.id],
    });
    expect(next.history.at(-1)).toMatchObject({
      type: 'PET',
      message: 'Vorki: Omni-Key Found!',
      source: DropSource.PET,
      meta: { petId: vorki.id, specialKeysAwarded: 1 },
    });
    expect(next.lastEvent).toMatchObject({ type: 'PET' });
    expect(next.runRevision).toBe(1);
  });

  it('counts each pet once and ignores what is not a pet', () => {
    const once = claim(base(), vorki.id);
    expect(claim(once, vorki.id)).toBe(once);
    expect(claim(base(), 157004)).toEqual(base());
    const two = claim(once, first.id);
    expect(two.specialKeys).toBe(2);
    expect(two.petsClaimed).toEqual([vorki.id, first.id]);
  });

  it('replays to the same balances', () => {
    replaysTo(claim(claim(win(base({ fatePoints: 7 })), vorki.id), first.id));
  });
});

describe('a pet from RuneLite', () => {
  const expected = { runId: RUN_ID, account: 'Nubles', runRevision: 0 };
  const accept = (state: Run, preparedRevision = state.runRevision) => gameReducer(state, {
    type: 'ACCEPT_DETECTED_PET',
    payload: {
      petId: vorki.id,
      petName: 'Vorki',
      meta: { fateEventId: 'evt-pet', detectorId: 'pet-drop-v1', detectorVersion: 1 },
      expected,
      preparedRevision,
    },
  });

  it('is claimed on the state the player confirmed it on, and remembers the event', () => {
    const next = accept(base());
    expect(next.specialKeys).toBe(1);
    expect(next.history.at(-1)).toMatchObject({ type: 'PET', meta: { fateEventId: 'evt-pet', petId: vorki.id } });
  });

  it('lands nowhere else', () => {
    const moved = win(base());
    expect(accept(moved, 0)).toBe(moved);
    const otherRun = base({ runId: 'other-run' });
    expect(accept(otherRun)).toBe(otherRun);
  });
});

describe('the pet compensation', () => {
  /** 4 Keys, 1 Omni-Key and some Fate, every one of them earned in the history. */
  const pending = (fate = 10, over: Partial<GameState> = {}): Run => ({
    ...fail(claim(win(base()), PETS[40].id), fate),
    petCompensation: { releaseId: PET_COMPENSATION_ID, status: 'pending', keyOnlyPets: 2, omniPets: 1 },
    ...over,
  });

  it("'owe' gives the Omni-Keys and owes the Keys; later Keys pay them first", () => {
    const resolved = resolve(pending(), 'owe', [first.id, second.id, third.id]);
    expect(resolved).toMatchObject({
      keys: 4, specialKeys: 3, fatePoints: 10, keysOwed: 2,
      petsClaimed: [PETS[40].id, first.id, second.id, third.id],
      petCompensation: { status: 'owe' },
    });
    expect(resolved.history.at(-1)).toMatchObject({
      type: 'COMPENSATION',
      message: 'Pet compensation: 2 Omni-Keys. The next 2 Standard Keys you earn are owed.',
      meta: { releaseId: PET_COMPENSATION_ID, choice: 'owe', specialKeysAwarded: 2, keysOwedAdded: 2 },
    });

    const paidOnce = win(resolved);
    expect(paidOnce).toMatchObject({ keys: 4, keysOwed: 1, fatePoints: 0 });
    expect(paidOnce.history.at(-1)).toMatchObject({
      type: 'COMPENSATION',
      message: 'A Standard Key went to the pet compensation you chose.',
      details: '1 still owed.',
      meta: { releaseId: PET_COMPENSATION_ID, keysWithheld: 1 },
    });
    const paid = win(paidOnce);
    expect(paid).toMatchObject({ keys: 4, keysOwed: 0 });
    expect(win(paid).keys).toBe(5);
    replaysTo(win(paid));
  });

  it('a won Void Gambit pays what is owed too, and spending owes nothing', () => {
    const owing = resolve(pending(30), 'owe', [first.id, second.id, third.id]);
    const gambit = gameReducer(owing, { type: 'RITUAL_GAMBIT', payload: { won: true, stake: 30, keysWon: 2 } });
    expect(gambit).toMatchObject({ keys: 4, keysOwed: 0, fatePoints: 0 });
    replaysTo(gambit);
  });

  it("'gamble' adds the Gambit stake of Fate for each Key-only pet", () => {
    const resolved = resolve(pending(), 'gamble', [first.id, second.id, third.id]);
    expect(resolved).toMatchObject({ keys: 4, specialKeys: 3, fatePoints: 40, keysOwed: 2 });
    expect(resolved.history.at(-1)?.message)
      .toBe('Pet compensation: 2 Omni-Keys and 30 Fate towards a Void Gambit. The next 2 Standard Keys you earn are owed.');
    replaysTo(resolved);
  });

  it("'gamble' Fate past the pity line pays a Pity Key, which settles an owed Key at once", () => {
    const resolved = resolve(pending(45), 'gamble', [first.id, second.id, third.id]);
    // 45 + 30 = 75: one Pity Key and 25 carried; the Pity Key settles one of the two owed.
    expect(resolved).toMatchObject({ keys: 4, fatePoints: 25, keysOwed: 1 });
    replaysTo(resolved);
  });

  it("'free' gives only the Omni-Keys", () => {
    const resolved = resolve(pending(), 'free', [first.id, second.id, third.id]);
    expect(resolved).toMatchObject({ keys: 4, specialKeys: 3, fatePoints: 10, petCompensation: { status: 'free' } });
    expect(resolved.keysOwed ?? 0).toBe(0);
    expect(win(resolved).keys).toBe(5);
    replaysTo(resolved);
  });

  it('a run whose pets all brought an Omni-Key only names them', () => {
    const resolved = resolve(
      pending(10, { petCompensation: { releaseId: PET_COMPENSATION_ID, status: 'pending', keyOnlyPets: 0, omniPets: 1 } }),
      'free',
      [vorki.id],
    );
    expect(resolved).toMatchObject({ specialKeys: 1, petsClaimed: [PETS[40].id, vorki.id] });
    expect(resolved.history.at(-1)?.message).toBe('Pets named for the Omni-Key change.');
  });

  it('refuses names that do not fit the offer, and an offer that is not pending', () => {
    const offer = pending();
    expect(resolve(offer, 'free', [first.id, second.id])).toBe(offer);
    expect(resolve(offer, 'free', [first.id, first.id, second.id])).toBe(offer);
    const claimedAlready = pending(10, { petsClaimed: [first.id] });
    expect(resolve(claimedAlready, 'free', [first.id, second.id, third.id])).toBe(claimedAlready);
    const settled = resolve(offer, 'free', [first.id, second.id, third.id]);
    expect(resolve(settled, 'owe', [vorki.id, PETS[10].id, PETS[11].id])).toBe(settled);
  });

  it('a pet named in the offer cannot be claimed again', () => {
    const resolved = resolve(pending(), 'free', [first.id, second.id, third.id]);
    expect(claim(resolved, first.id)).toBe(resolved);
  });
});

describe('the save format', () => {
  it('keeps claimed pets, owed Keys and the settled offer through a save', () => {
    const resolved = resolve(base({
      petCompensation: { releaseId: PET_COMPENSATION_ID, status: 'pending', keyOnlyPets: 1, omniPets: 0 },
    }), 'owe', [vorki.id]);
    const { lastEvent: _lastEvent, ...saved } = resolved;
    const loaded = validateAndMigrateSave(JSON.parse(JSON.stringify(saved)), initialState);
    expect(loaded.ok).toBe(true);
    if (loaded.ok === false) return;
    expect(loaded.state).toMatchObject({
      version: CURRENT_SAVE_VERSION,
      petsClaimed: [vorki.id],
      keysOwed: 1,
      petCompensation: { status: 'owe', keyOnlyPets: 1, omniPets: 0 },
    });
  });

  it('works out the offer for a save from before pets gave an Omni-Key', () => {
    const petRoll = (type: LogEntry['type'], id: string): LogEntry => ({
      id, timestamp: 1, type, source: DropSource.PET, message: 'Key Found!', result: 'SUCCESS',
    });
    const { lastEvent: _lastEvent, petCompensation: _offer, ...older } = base({
      keys: 6,
      specialKeys: 1,
      history: [petRoll('ROLL_SUCCESS', 'a'), petRoll('ROLL_SUCCESS', 'b'), petRoll('ROLL_OMNI', 'c')],
    });
    const loaded = validateAndMigrateSave({ ...older, version: 4 }, initialState);
    expect(loaded.ok).toBe(true);
    if (loaded.ok === false) return;
    expect(loaded.state.petCompensation).toEqual({
      releaseId: PET_COMPENSATION_ID, status: 'pending', keyOnlyPets: 2, omniPets: 1,
    });
  });

  it('rejects a current save without its pet offer, or with pets it cannot know', () => {
    const { lastEvent: _lastEvent, ...saved } = base();
    const { petCompensation: _offer, ...withoutOffer } = saved;
    expect(validateAndMigrateSave(withoutOffer, initialState)).toMatchObject({ ok: false, path: 'petCompensation' });
    expect(validateAndMigrateSave({ ...saved, petsClaimed: [157004] }, initialState))
      .toMatchObject({ ok: false, path: 'petsClaimed' });
    expect(validateAndMigrateSave({ ...saved, petsClaimed: [vorki.id, vorki.id] }, initialState))
      .toMatchObject({ ok: false, path: 'petsClaimed' });
    expect(validateAndMigrateSave({ ...saved, keysOwed: -1 }, initialState)).toMatchObject({ ok: false });
    expect(validateAndMigrateSave({
      ...saved,
      petCompensation: { ...saved.petCompensation, releaseId: '2026-08-02-weighted-fate' },
    }, initialState)).toMatchObject({ ok: false, path: 'petCompensation.releaseId' });
  });
});
