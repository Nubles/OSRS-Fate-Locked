import { describe, expect, it } from 'vitest';
import { gameReducer, initialState, prepareKeyRollAction, type Action } from './GameContext';
import { TableType, type GameState, type LogEntry } from '../types';
import { replayInvariants } from '../utils/runAudit';
import { validateAndMigrateSave } from '../utils/saveSchema';
import { resolveModeRules } from '../config/gameModes';
import { SACRIFICE_MIN_ROLLS } from '../config/economy';
import { BOSSES_LIST } from '../data/items';
import { wardUsable } from '../utils/ritualWard';
import { ritualAvailability } from '../utils/ritualEffects';

/**
 * The newer Void Altar rituals end to end through the reducer: what they cost,
 * what they do to the next rolls, and that the history they leave replays to
 * the same Fate and Keys.
 */

type S = Parameters<typeof gameReducer>[0];
const base = (over: Partial<GameState> = {}): S => ({ ...initialState, runId: 'ritual-run', runRevision: 0, lastEvent: null, ...over });
const rules = resolveModeRules('vanilla');
/** A run holding `fate` Fate, earned by a recorded miss so the replay starts from the same place. */
const funded = (fate: number, over: Partial<GameState> = {}): S => base({
  fatePoints: fate,
  history: [{ id: 'seed', timestamp: 0, type: 'ROLL_FAIL', message: 'No Key.', details: 'Seed', meta: { fatePointsEarned: fate } }],
  ...over,
});

/** Dice for prepareKeyRollAction: the roll's units (1-1000), then fixed dice for Omni, Verac and Karil. */
const dice = (rollUnits: number, extra: { omni?: number; verac?: number; karil?: number } = {}) =>
  (_purpose: string, index = 0) => index <= 1 ? rollUnits : index === 2 ? extra.omni ?? 100 : index === 3 ? extra.verac ?? 100 : extra.karil ?? 100;

/** A roll at `threshold`% that lands when `rollUnits / 10` is at or under it. */
const rollAt = (s: S, rollUnits: number, threshold = 20, extra: Parameters<typeof dice>[1] = {}, failureFate: 1 | 2 | 3 = 1): S =>
  gameReducer(s, prepareKeyRollAction(s, 'Test', threshold, failureFate, dice(rollUnits, extra))) as S;
const MISS = 900;
const HIT = 100;

const cast = (s: S, action: Action): S => gameReducer(s, action) as S;

/** The replay of a run's history must end where the reducer did. */
const expectReplayMatches = (s: S) => {
  const { violations, final } = replayInvariants(s.history, initialState.keys, rules);
  expect(violations).toEqual([]);
  expect(final.fatePoints).toBe(s.fatePoints);
  expect(final.keys).toBe(s.keys);
  expect(final.specialKeys).toBe(s.specialKeys);
};

describe("Zamorak's Pact", () => {
  it('is free, boosts 3 rolls by 15%, then takes the next 40 Fate even across a success', () => {
    let s = cast(base({ fatePoints: 0 }), { type: 'RITUAL_PACT' });
    expect(s.fatePoints).toBe(0);
    expect(s.rituals).toEqual({ pactRollsLeft: 3 });

    // 30.0 misses a 20% roll, but lands at 35% with the Pact.
    s = rollAt(s, 300);
    expect(s.history.at(-1)?.type).toBe('ROLL_SUCCESS');
    expect(s.history.at(-1)?.threshold).toBe(35);
    // A miss during the boosted rolls still pays Fate: the debt has not started.
    s = rollAt(s, MISS);
    expect(s.fatePoints).toBe(1);
    s = rollAt(s, MISS);
    expect(s.rituals).toEqual({ pactDebt: 40 });

    // Now every Fate a miss would give goes to Zamorak.
    for (let i = 0; i < 13; i++) s = rollAt(s, MISS, 20, {}, 3);
    expect(s.fatePoints).toBe(2);
    expect(s.rituals).toEqual({ pactDebt: 1 });
    s = rollAt(s, HIT);
    expect(s.rituals).toEqual({ pactDebt: 1 });
    s = rollAt(s, MISS, 20, {}, 3);
    expect(s.rituals).toBeUndefined();
    expect(s.fatePoints).toBe(2);
    expectReplayMatches(s);
  });

  it('cannot be cast again while the debt stands', () => {
    const s = base({ fatePoints: 10, rituals: { pactDebt: 12 } });
    expect(cast(s, { type: 'RITUAL_PACT' })).toBe(s);
  });
});

describe('Tears of Guthix', () => {
  it('doubles the Fate of the next failed rolls, ends on a success, and works once per dry spell', () => {
    let s = cast(base({ fatePoints: 10 }), { type: 'RITUAL_TEARS' });
    expect(s.fatePoints).toBe(0);
    s = rollAt(s, MISS, 20, {}, 2);
    expect(s.fatePoints).toBe(4);
    expect(s.rituals).toMatchObject({ tearsFailsLeft: 9, tearsSpent: true });
    s = { ...s, fatePoints: 20 };
    expect(cast(s, { type: 'RITUAL_TEARS' })).toBe(s);
    s = rollAt(s, HIT);
    expect(s.rituals).toBeUndefined();
    expect(cast({ ...s, fatePoints: 10 }, { type: 'RITUAL_TEARS' }).rituals).toMatchObject({ tearsFailsLeft: 10 });
  });
});

describe('the gods', () => {
  it("don't share: only one of Saradomin, Guthix or Zamorak at a time", () => {
    const warded = cast(base({ fatePoints: 60 }), { type: 'RITUAL_WARD' });
    expect(warded.rituals).toEqual({ ward: true, wardCooldown: 25 });
    expect(cast(warded, { type: 'RITUAL_TEARS' })).toBe(warded);
    expect(cast(warded, { type: 'RITUAL_PACT' })).toBe(warded);
    expect(cast(warded, { type: 'RITUAL_WARD' })).toBe(warded);
  });
});

describe('roll rituals', () => {
  it('stop Clarity, Greed and each other from stacking on the same rolls', () => {
    const s = cast(base({ fatePoints: 60 }), { type: 'RITUAL_BARROWS', payload: { brother: 'AHRIM' } });
    expect(cast(s, { type: 'RITUAL_LUCK' })).toBe(s);
    expect(cast(s, { type: 'RITUAL_GREED' })).toBe(s);
    expect(cast(s, { type: 'RITUAL_INVOCATIONS', payload: { ids: ['WALK_THE_PATH'] } })).toBe(s);
    expect(cast(s, { type: 'RITUAL_PACT' })).toBe(s);
    const lucky = cast(base({ fatePoints: 60 }), { type: 'RITUAL_LUCK' });
    expect(cast(lucky, { type: 'RITUAL_BARROWS', payload: { brother: 'AHRIM' } })).toBe(lucky);
  });
});

describe("Amascut's Invocations", () => {
  it('Walk the Path and Blood Price: a miss gives no Fate and costs 5', () => {
    let s = cast(funded(30), { type: 'RITUAL_INVOCATIONS', payload: { ids: ['WALK_THE_PATH', 'BLOOD_PRICE'] } });
    expect(s.fatePoints).toBe(20);
    s = rollAt(s, MISS, 20, {}, 3);
    expect(s.fatePoints).toBe(15);
    expect(s.history.at(-1)?.meta).toMatchObject({ fatePointsEarned: 0, fatePointsLost: 5 });
    expectReplayMatches(s);
  });

  it('Blood Price needs 15 Fate left after the ritual, so it can\'t be dodged at 0 Fate', () => {
    const short = funded(24);
    expect(cast(short, { type: 'RITUAL_INVOCATIONS', payload: { ids: ['WALK_THE_PATH', 'BLOOD_PRICE'] } })).toBe(short);
    const s = cast(funded(25), { type: 'RITUAL_INVOCATIONS', payload: { ids: ['WALK_THE_PATH', 'BLOOD_PRICE'] } });
    expect(s.fatePoints).toBe(15);
    expect(s.rituals?.invocations?.ids).toEqual(['WALK_THE_PATH', 'BLOOD_PRICE']);
  });

  it('Hardcore: the first fail ends every invocation', () => {
    let s = cast(funded(30), { type: 'RITUAL_INVOCATIONS', payload: { ids: ['HARDCORE', 'WALK_THE_PATH'] } });
    s = rollAt(s, HIT, 20, {}, 3);
    expect(s.rituals?.invocations?.rollsLeft).toBe(2);
    s = rollAt(s, MISS, 20, {}, 3);
    expect(s.rituals?.invocations).toBeUndefined();
    expect(s.history.at(-1)?.details).toContain('Hardcore ended the invocations');
    // Walk the Path still applied to the fail that ended it.
    expect(s.history.at(-1)?.meta).toMatchObject({ fatePointsEarned: 0 });
    expectReplayMatches(s);
  });

  it('Overly Draining lowers the odds and every handicap raises the Omni-Key chance', () => {
    const s = cast(base({ fatePoints: 30 }), { type: 'RITUAL_INVOCATIONS', payload: { ids: ['WALK_THE_PATH', 'OVERLY_DRAINING', 'BLOOD_PRICE', 'HARDCORE'] } });
    const action = prepareKeyRollAction(s, 'Test', 20, 1, dice(HIT, { omni: 5 + rules.omniChanceBase }));
    expect(action.payload.threshold).toBe(15);
    // All four add 5% to the Omni-Key chance (1% each, plus 1% for the full set).
    expect(action.payload.omni).toBe(true);
    expect(prepareKeyRollAction(s, 'Test', 20, 1, dice(HIT, { omni: 6 + rules.omniChanceBase })).payload.omni).toBe(false);
  });

  it('wears off after 3 rolls', () => {
    let s = cast(base({ fatePoints: 30 }), { type: 'RITUAL_INVOCATIONS', payload: { ids: ['WALK_THE_PATH'] } });
    for (let i = 0; i < 3; i++) s = rollAt(s, MISS);
    expect(s.rituals).toBeUndefined();
    expect(s.fatePoints).toBe(20);
    s = rollAt(s, MISS);
    expect(s.fatePoints).toBe(21);
  });
});

describe('Barrows Chest', () => {
  it('Torag: +5% odds, and the 20 Fate comes back when all 3 rolls miss', () => {
    let s = cast(funded(20), { type: 'RITUAL_BARROWS', payload: { brother: 'TORAG' } });
    expect(prepareKeyRollAction(s, 'Test', 20, 1, dice(MISS)).payload.threshold).toBe(25);
    for (let i = 0; i < 3; i++) s = rollAt(s, MISS);
    expect(s.fatePoints).toBe(23);
    expect(s.rituals).toBeUndefined();
    expectReplayMatches(s);
  });

  it('Guthan: every miss heals 8 Fate', () => {
    let s = cast(base({ fatePoints: 20 }), { type: 'RITUAL_BARROWS', payload: { brother: 'GUTHAN' } });
    s = rollAt(s, MISS);
    expect(s.fatePoints).toBe(9);
  });

  it("Dharok: +1% for every 2 Fate held, up to 25%", () => {
    const s = cast(base({ fatePoints: 46 }), { type: 'RITUAL_BARROWS', payload: { brother: 'DHAROK' } });
    expect(prepareKeyRollAction(s, 'Test', 20, 1, dice(MISS)).payload.threshold).toBe(33);
    expect(prepareKeyRollAction({ ...s, fatePoints: 49 }, 'Test', 20, 1, dice(MISS)).payload.threshold).toBe(44);
  });

  it('Karil: a success can bring a second Key, which the replay counts', () => {
    let s = cast(funded(20), { type: 'RITUAL_BARROWS', payload: { brother: 'KARIL' } });
    const keys = s.keys;
    s = rollAt(s, HIT, 20, { karil: 50 });
    expect(s.keys).toBe(keys + 2);
    expect(s.history.at(-1)?.message).toBe('Key Found! (Second Key)');
    s = rollAt(s, HIT, 20, { karil: 51 });
    expect(s.keys).toBe(keys + 3);
    expectReplayMatches(s);
  });

  it('Verac: a miss can hit through and become a success', () => {
    let s = cast(funded(20), { type: 'RITUAL_BARROWS', payload: { brother: 'VERAC' } });
    const keys = s.keys;
    s = rollAt(s, MISS, 20, { verac: 15 });
    expect(s.history.at(-1)?.type).toBe('ROLL_SUCCESS');
    expect(s.history.at(-1)?.details).toMatch(/Verac hit through/);
    expect(s.keys).toBe(keys + 1);
    s = rollAt(s, MISS, 20, { verac: 16 });
    expect(s.history.at(-1)?.type).toBe('ROLL_FAIL');
    expectReplayMatches(s);
  });
});

describe('Sacrifice', () => {
  const rolls = (n: number): LogEntry[] => Array.from({ length: n }, (_, i) => ({
    id: `r${i}`, timestamp: 0, type: 'ROLL_FAIL', message: 'No Key.', details: 'x', meta: { fatePointsEarned: 0 },
  }));
  const ready = (over: Partial<GameState> = {}) => base({
    fatePoints: 30,
    history: rolls(SACRIFICE_MIN_ROLLS),
    unlocks: { ...initialState.unlocks, skills: { ...initialState.unlocks.skills, Woodcutting: 5, Fishing: 1 }, equipment: { ...initialState.unlocks.equipment, Body: 3 } },
    ...over,
  });
  const taken = [
    { table: 'skill' as const, name: 'Woodcutting', tier: 5 },
    { table: 'skill' as const, name: 'Fishing', tier: 1 },
    { table: 'gear' as const, name: 'Body', tier: 3 },
  ];

  it('takes the top tier of 3 skills or slots for an Omni-Key', () => {
    const s = cast(ready(), { type: 'RITUAL_SACRIFICE', payload: { taken } });
    expect(s.fatePoints).toBe(5);
    expect(s.specialKeys).toBe(1);
    expect(s.unlocks.skills).toEqual({ Hitpoints: 1, Woodcutting: 4 });
    expect(s.unlocks.equipment.Body).toBe(2);
    expect(s.rituals).toEqual({ sacrificesUsed: 1 });
    expect(s.lastEvent).toMatchObject({ type: 'RITUAL', meta: { type: 'SACRIFICE', taken, usesLeft: 2 } });
  });

  it(`waits for ${SACRIFICE_MIN_ROLLS} rolls, stops after 3 uses, and refuses tiers the run doesn't hold`, () => {
    const early = ready({ history: rolls(SACRIFICE_MIN_ROLLS - 1) });
    expect(cast(early, { type: 'RITUAL_SACRIFICE', payload: { taken } })).toBe(early);
    const spent = ready({ rituals: { sacrificesUsed: 3 } });
    expect(cast(spent, { type: 'RITUAL_SACRIFICE', payload: { taken } })).toBe(spent);
    const s = ready();
    expect(cast(s, { type: 'RITUAL_SACRIFICE', payload: { taken: [...taken.slice(0, 2), { table: 'gear', name: 'Body', tier: 4 }] } })).toBe(s);
    expect(cast(s, { type: 'RITUAL_SACRIFICE', payload: { taken: [taken[0], taken[0], taken[2]] } })).toBe(s);
  });
});

describe("Saradomin's Ward", () => {
  // A Chunked run walked north to Varrock, whose sewer entrance (50,54) holds Scurrius and Bryophyta.
  const walked = { ...initialState.unlocks, chunks: ['50,51', '50,52', '50,53', '50,54'] };
  const far = BOSSES_LIST.find(b => !wardUsable(TableType.BOSSES, b, walked, 'chunked'))!;
  const near = BOSSES_LIST.find(b => wardUsable(TableType.BOSSES, b, walked, 'chunked'))!;
  const unlock = (item: string, table = TableType.BOSSES, ward = true): Action =>
    ({ type: 'UNLOCK', payload: { table, item, costType: 'key', cost: 1, revealId: 'reveal', ward } });

  it('tells a boss in reach from one that is not', () => {
    expect(far).toBeDefined();
    expect(near).toBeDefined();
    // Only the boss's own entrance chunk counts, not a foothold in its area.
    expect(BOSSES_LIST.filter(b => wardUsable(TableType.BOSSES, b, initialState.unlocks, 'chunked'))).toEqual([]);
  });

  it('refuses a spend drawn without the Ward, and is used up by one drawn with it', () => {
    const s = cast(base({ fatePoints: 30, keys: 5, gameModeId: 'chunked', unlocks: walked }), { type: 'RITUAL_WARD' });
    expect(cast(s, unlock(near, TableType.BOSSES, false))).toBe(s);
    const landed = cast(s, unlock(near));
    expect(landed.unlocks.bosses).toContain(near);
    expect(landed.rituals).toEqual({ wardCooldown: 25 });
    expect(landed.history.at(-1)?.meta).toMatchObject({ ward: true });
  });

  it('can only be cast again 25 rolls later', () => {
    let s = cast(base({ fatePoints: 30, keys: 5, gameModeId: 'chunked', unlocks: walked }), { type: 'RITUAL_WARD' });
    s = cast(s, unlock(near));
    s = { ...s, fatePoints: 60 };
    // The wait only holds back the Ward: Guthix is free once Saradomin's Key has landed.
    expect(ritualAvailability('TEARS', 'Guthix', s).ok).toBe(true);
    for (let i = 0; i < 24; i++) s = rollAt(s, MISS);
    expect(ritualAvailability('WARD', 'Saradomin', s)).toEqual({ ok: false, reason: 'Again in 1 roll' });
    expect(cast(s, { type: 'RITUAL_WARD' })).toBe(s);
    s = rollAt(s, MISS);
    expect(ritualAvailability('WARD', 'Saradomin', s).ok).toBe(true);
    expect(cast(s, { type: 'RITUAL_WARD' }).rituals?.ward).toBe(true);
  });

  it('keeps waiting through a Key spent on a table with no places', () => {
    const s = cast(base({ fatePoints: 30, keys: 5, gameModeId: 'chunked' }), { type: 'RITUAL_WARD' });
    expect(cast(s, unlock('Attack', TableType.SKILLS, false)).rituals).toEqual({ ward: true, wardCooldown: 25 });
  });

  it('leaves a Vanilla Chaos Key random and keeps waiting, but takes a Chunked one', () => {
    const chaos = (item: string, ward: boolean): Action =>
      ({ type: 'UNLOCK', payload: { table: TableType.BOSSES, item, costType: 'chaosKey', cost: 1, revealId: 'reveal', ward } });
    const vanilla = cast(base({ fatePoints: 30, chaosKeys: 1, gameModeId: 'vanilla' }), { type: 'RITUAL_WARD' });
    const landed = cast(vanilla, chaos('Giant Mole', false));
    expect(landed.unlocks.bosses).toContain('Giant Mole');
    expect(landed.rituals).toEqual({ ward: true, wardCooldown: 25 });

    const chunked = cast(base({ fatePoints: 30, chaosKeys: 1, gameModeId: 'chunked', unlocks: walked }), { type: 'RITUAL_WARD' });
    expect(cast(chunked, chaos(near, false))).toBe(chunked);
    expect(cast(chunked, chaos(near, true)).rituals).toEqual({ wardCooldown: 25 });
  });
});

describe('saves', () => {
  it('keep running rituals and refuse ones the Altar could never make', () => {
    const rituals = { tearsFailsLeft: 4, tearsSpent: true, pactDebt: 12, barrows: { brother: 'KARIL' as const, rollsLeft: 2, failed: 1, fateCost: 20 }, sacrificesUsed: 2, wardCooldown: 7 };
    const { lastEvent: _lastEvent, ...saved } = base({ runId: '0b6f6c1e-2d3a-4c5b-8e7f-9a0b1c2d3e4f' });
    const ok = validateAndMigrateSave(JSON.parse(JSON.stringify({ ...saved, rituals })), initialState);
    if (ok.ok === false) throw new Error(ok.message);
    expect(ok.state.rituals).toEqual(rituals);
    for (const bad of [{ pactDebt: 41 }, { wardCooldown: 26 }, { barrows: { brother: 'AKRISAE', rollsLeft: 1, failed: 0, fateCost: 20 } }, { invocations: { ids: [], rollsLeft: 3 } }, { mimic: true }]) {
      expect(validateAndMigrateSave(JSON.parse(JSON.stringify({ ...saved, rituals: bad })), initialState).ok).toBe(false);
    }
  });
});
