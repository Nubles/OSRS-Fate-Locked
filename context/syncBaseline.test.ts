import { describe, expect, it } from 'vitest';
import { createFreshState, gameReducerForTest, migrateSaveForTest, prepareLevelUpActions } from './GameContext';
import { validateAndMigrateSave } from '../utils/saveSchema';
import { SKILLS_LIST } from '../data/items';
import { planSkillSync, skillBaseline } from '../utils/syncBaseline';
import { baselineFromReading, type HiscoreLevel, type HiscoreReading } from '../utils/hiscoreReading';
import { randomUnlockPool, pickRandomPoolEntry } from '../utils/gameEngine';
import { TableType, type GameState } from '../types';

// Critique GP-1 (October 2026): Sync & Roll paid out every level a linked
// account already had. The run now keeps the account's levels at link time
// as a baseline (utils/syncBaseline.ts) and rolls only levels above it,
// inside each skill's tier band.

type Run = Parameters<typeof gameReducerForTest>[0];
const run = (overrides: Partial<GameState> = {}): Run => ({
  ...migrateSaveForTest({ history: [] }),
  gameModeId: 'vanilla',
  lastEvent: null,
  ...overrides,
});
const allAt = (level: number): HiscoreReading => ({
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, level as HiscoreLevel])),
  overall: level * SKILLS_LIST.length,
});

describe('the run takes its baseline when it links an OSRS name', () => {
  it('waits for the first reading, then keeps it', () => {
    let state = gameReducerForTest(run(), { type: 'SET_LINKED_ACCOUNT', payload: 'Maxed' });
    expect(state.syncBaseline).toEqual({ account: 'Maxed' });
    expect(skillBaseline(state.syncBaseline, state.linkedAccount, 'Attack')).toBeNull();

    state = gameReducerForTest(state, { type: 'RECORD_SYNC_BASELINE', payload: { account: 'maxed', levels: baselineFromReading(allAt(99)) } });
    expect(skillBaseline(state.syncBaseline, state.linkedAccount, 'Attack')).toBe(99);

    // A later reading doesn't move it.
    const again = gameReducerForTest(state, { type: 'RECORD_SYNC_BASELINE', payload: { account: 'Maxed', levels: baselineFromReading(allAt(50)) } });
    expect(again).toBe(state);
  });

  it('takes a new baseline for a new name', () => {
    let state = gameReducerForTest(run(), { type: 'SET_LINKED_ACCOUNT', payload: 'Old Name' });
    state = gameReducerForTest(state, { type: 'RECORD_SYNC_BASELINE', payload: { account: 'Old Name', levels: baselineFromReading(allAt(10)) } });
    state = gameReducerForTest(state, { type: 'RENAME_LINKED_ACCOUNT', payload: { from: 'Old Name', to: 'Maxed Main' } });
    expect(state.syncBaseline).toEqual({ account: 'Maxed Main' });
    state = gameReducerForTest(state, { type: 'RECORD_SYNC_BASELINE', payload: { account: 'Maxed Main', levels: baselineFromReading(allAt(99)) } });
    expect(skillBaseline(state.syncBaseline, state.linkedAccount, 'Attack')).toBe(99);

    // Fixing only the capitals of the same name keeps the baseline.
    const recased = gameReducerForTest(state, { type: 'RENAME_LINKED_ACCOUNT', payload: { from: 'Maxed Main', to: 'maxed main' } });
    expect(recased.syncBaseline).toBe(state.syncBaseline);
  });

  it('leaves a run linked before baselines without one, so its honest gains still roll', () => {
    const legacy = run({ linkedAccount: 'Old Run' });
    expect(gameReducerForTest(legacy, { type: 'RECORD_SYNC_BASELINE', payload: { account: 'Old Run', levels: baselineFromReading(allAt(99)) } })).toBe(legacy);
    expect(skillBaseline(legacy.syncBaseline, legacy.linkedAccount, 'Attack')).toBeUndefined();
  });
});

describe('recording the baseline level before the first new one rolls', () => {
  const linked = (overrides: Partial<GameState> = {}) => run({
    linkedAccount: 'Linked',
    syncBaseline: { account: 'Linked', levels: { Attack: 40 }, takenAt: 1 },
    unlocks: { ...run().unlocks, skills: { ...run().unlocks.skills, Attack: 5 }, levels: { ...run().unlocks.levels, Attack: 3 } },
    ...overrides,
  });

  it('records it without a roll, a Key or a Chaos Key, and says so in History', () => {
    const state = linked();
    const next = gameReducerForTest(state, { type: 'SYNC_CATCH_UP_LEVEL', payload: { skill: 'Attack', level: 40 } });
    expect(next.unlocks.levels.Attack).toBe(40);
    expect([next.keys, next.specialKeys, next.chaosKeys]).toEqual([state.keys, state.specialKeys, state.chaosKeys]);
    expect(next.history.at(-1)).toMatchObject({ type: 'LEVEL_UP', message: 'Attack Level 40: already had', meta: { chaosKeysAwarded: 0 } });
  });

  it('never goes past the baseline, nor for a locked skill or a run without a baseline', () => {
    const state = linked();
    for (const level of [41, 3, 2]) {
      expect(gameReducerForTest(state, { type: 'SYNC_CATCH_UP_LEVEL', payload: { skill: 'Attack', level } })).toBe(state);
    }
    const locked = linked({ unlocks: { ...state.unlocks, skills: { ...state.unlocks.skills, Attack: 0 } } });
    expect(gameReducerForTest(locked, { type: 'SYNC_CATCH_UP_LEVEL', payload: { skill: 'Attack', level: 40 } })).toBe(locked);
    const legacy = linked({ syncBaseline: undefined });
    expect(gameReducerForTest(legacy, { type: 'SYNC_CATCH_UP_LEVEL', payload: { skill: 'Attack', level: 40 } })).toBe(legacy);
  });

  it("pays no Xtreme start-area milestone Key for levels the account already had", () => {
    const state = linked({ gameModeId: 'xtreme', xtremeMilestoneClaimed: 0 });
    const caughtUp = gameReducerForTest(state, { type: 'SYNC_CATCH_UP_LEVEL', payload: { skill: 'Attack', level: 40 } });
    const prepared = prepareLevelUpActions(caughtUp, 'Attack', 0.99, () => 100);
    const next = gameReducerForTest(caughtUp, prepared.levelAction);
    expect(next.history.some(entry => entry.type === 'XTREME_MILESTONE')).toBe(false);
    expect(next.keys).toBe(state.keys);
  });
});

describe('the baseline in saves', () => {
  it('survives export and import', () => {
    const baseline = { account: 'Linked', levels: { Attack: 40, Sailing: null }, takenAt: 5 };
    const { lastEvent: _event, ...save } = run({ linkedAccount: 'Linked', syncBaseline: baseline });
    const loaded = migrateSaveForTest(save);
    expect(loaded.syncBaseline).toEqual(baseline);
    expect(migrateSaveForTest({ history: [], syncBaseline: { account: 'Linked' } }).syncBaseline).toEqual({ account: 'Linked' });
  });

  it('loads a save from before baselines with none', () => {
    expect(migrateSaveForTest({ history: [], linkedAccount: 'Old Run' }).syncBaseline).toBeUndefined();
  });

  it('refuses a broken baseline rather than dropping it (dropping it would pay out the account)', () => {
    for (const syncBaseline of [
      { account: 'A', levels: { Attack: 0 } },
      { account: 'A', levels: { Attack: 100 } },
      { account: 'A', levels: { NotASkill: 5 } },
      { levels: {} },
      { account: 'A', extra: 1 },
    ]) {
      expect(validateAndMigrateSave({ history: [], syncBaseline }, createFreshState()).ok).toBe(false);
    }
  });
});

// The critique's sim (critique/sims/sync.sim.test.ts), on the real reducer:
// a fresh run linked to an all-99 account, Sync & Roll repeated until nothing
// changes, every Key spent at random. Before the baseline it opened 24/24
// skills and all 240 tiers in zero minutes of play.
describe('a fresh run linked to an already-levelled account', () => {
  let seed = 7;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const dice = (_purpose: string, _index = 0, max = 100) => Math.floor(rng() * max) + 1;

  const syncUntilStill = (state: Run, reading: HiscoreReading): { state: Run; rolled: number } => {
    let rolled = 0;
    const startKeys = state.keys;
    const startChaos = state.chaosKeys;
    for (let round = 0; round < 60; round++) {
      let did = false;
      for (const skill of SKILLS_LIST) {
        const plan = planSkillSync({
          tracker: state.unlocks.levels[skill] ?? 1,
          tier: state.unlocks.skills[skill] ?? 0,
          hiscore: reading.skills[skill],
          baseline: skillBaseline(state.syncBaseline, state.linkedAccount, skill),
        });
        if (plan.catchUpTo) state = gameReducerForTest(state, { type: 'SYNC_CATCH_UP_LEVEL', payload: { skill, level: plan.catchUpTo } });
        for (let n = 0; n < plan.count; n++) {
          const prepared = prepareLevelUpActions(state, skill, rng(), dice);
          state = gameReducerForTest(state, prepared.levelAction);
          if (prepared.rewardAction) state = gameReducerForTest(state, prepared.rewardAction);
          rolled++; did = true;
        }
      }
      // Keys this round paid (not the run's starting Keys) are spent as the app would.
      for (let guard = 0; state.keys > startKeys && guard < 500; guard++) {
        const pick = pickRandomPoolEntry(randomUnlockPool(state.unlocks, 'vanilla', 'key', TableType.SKILLS), rng);
        if (!pick) break;
        state = gameReducerForTest(state, { type: 'UNLOCK', payload: { ...pick, costType: 'key', cost: 1 } });
      }
      for (let guard = 0; state.chaosKeys > startChaos && guard < 500; guard++) {
        const pick = pickRandomPoolEntry(randomUnlockPool(state.unlocks, 'vanilla', 'chaosKey'), rng);
        if (!pick) break;
        state = gameReducerForTest(state, { type: 'UNLOCK', payload: { ...pick, costType: 'chaosKey', cost: 1 } });
      }
      if (!did) break;
    }
    return { state, rolled };
  };
  const tiers = (state: Run) => SKILLS_LIST.reduce((sum, skill) => sum + (state.unlocks.skills[skill] ?? 0), 0);

  for (const level of [99, 70, 50]) {
    it(`opens nothing at all-${level}: the levels it had when linked never roll`, () => {
      let state = run({ history: [] });
      state = gameReducerForTest(state, { type: 'SET_LINKED_ACCOUNT', payload: 'Levelled' });
      state = gameReducerForTest(state, { type: 'RECORD_SYNC_BASELINE', payload: { account: 'Levelled', levels: baselineFromReading(allAt(level)) } });
      const before = { tiers: tiers(state), regions: state.unlocks.regions.length, keys: state.keys, chaos: state.chaosKeys };
      const after = syncUntilStill(state, allAt(level));
      expect(after.rolled).toBe(0);
      expect({ tiers: tiers(after.state), regions: after.state.unlocks.regions.length, keys: after.state.keys, chaos: after.state.chaosKeys }).toEqual(before);
    });
  }

  it('rolls the levels gained after linking, and only those', () => {
    let state = run({ history: [] });
    state = gameReducerForTest(state, { type: 'SET_LINKED_ACCOUNT', payload: 'Levelled' });
    state = gameReducerForTest(state, { type: 'RECORD_SYNC_BASELINE', payload: { account: 'Levelled', levels: baselineFromReading(allAt(30)) } });
    const plan = planSkillSync({
      tracker: state.unlocks.levels.Hitpoints ?? 10,
      tier: state.unlocks.skills.Hitpoints ?? 0,
      hiscore: 34,
      baseline: skillBaseline(state.syncBaseline, state.linkedAccount, 'Hitpoints'),
    });
    expect(plan).toMatchObject({ catchUpTo: 30, from: 30, to: 34, count: 4 });
  });
});
