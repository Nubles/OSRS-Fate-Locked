import { describe, expect, it } from 'vitest';
import { DropSource } from '../types';
import { gameReducer, initialState, prepareKeyRollAction } from '../context/GameContext';
import { CHUNK_EXPLORE_ROLLS } from '../config/economy';
import { DROP_RATES } from '../config/rules';
import { validateAndMigrateSave } from './saveSchema';
import { chunksToExplore, exploreBlocker, exploreRollsLeft, exploreThings, exploreWaiting, withExploreStart } from './chunkExplore';
import { mercyBlocker } from './chunkedFate';

// 49,50 (west of the Lumbridge Castle start chunk) has something to fight,
// Hunter and Thieving from tier 2, and Woodcutting from tier 1.
const WEST = '49,50';

const run = (over: Record<string, unknown> = {}) => ({
  ...initialState,
  runRevision: 0,
  lastEvent: null,
  gameModeId: 'chunked',
  keys: 0,
  specialKeys: 0,
  chaosKeys: 0,
  unlocks: {
    ...initialState.unlocks,
    chunks: [WEST],
    skills: { Hitpoints: 1, Woodcutting: 1 },
  },
  chunkExplore: { from: 0, done: {} as Record<string, string[]> },
  ...over,
});

describe('Chunked exploring rolls', () => {
  it('lists what a chunk offers and holds at most three rolls', () => {
    expect(exploreThings(WEST).map(thing => [thing.label, thing.tier])).toEqual([
      ['Fought something', 1], ['Trained Hunter', 2], ['Trained Thieving', 2], ['Trained Woodcutting', 1],
    ]);
    expect(CHUNK_EXPLORE_ROLLS).toBe(3);
    expect(DROP_RATES[DropSource.CHUNK_EXPLORE]).toBe(10);
    expect(exploreRollsLeft(run(), WEST)).toBe(3);
    // A chunk offering one thing holds one roll.
    expect(exploreRollsLeft(run({ unlocks: { ...run().unlocks, chunks: ['17,43'] } }), '17,43')).toBe(1);
  });

  it('rolls only things the run can do, once each, and only in chunks unlocked since the rule', () => {
    const state = run();
    expect(exploreBlocker(state, WEST, '@monster')).toBeNull();
    expect(exploreBlocker(state, WEST, 'Hunter')).toBe('Needs Hunter tier 2.');
    expect(exploreBlocker(state, WEST, 'Mining')).toBe('That isn’t something this chunk offers.');
    expect(exploreBlocker({ ...state, chunkExplore: { from: 1, done: {} } }, WEST, '@monster')).toBe('This chunk has no exploring rolls left.');
    expect(exploreBlocker({ ...state, gameModeId: 'vanilla' }, WEST, '@monster')).toBe('This chunk has no exploring rolls left.');

    const once = gameReducer(state, { type: 'CHUNK_EXPLORE', payload: { chunk: WEST, fact: '@monster' } });
    expect(once.chunkExplore).toEqual({ from: 0, done: { [WEST]: ['@monster'] } });
    expect(gameReducer(once, { type: 'CHUNK_EXPLORE', payload: { chunk: WEST, fact: '@monster' } })).toBe(once);
    expect(gameReducer(once, { type: 'CHUNK_EXPLORE', payload: { chunk: WEST, fact: 'Hunter' } })).toBe(once);

    const full = { ...state, unlocks: { ...state.unlocks, skills: { ...state.unlocks.skills, Hunter: 2, Thieving: 2 } }, chunkExplore: { from: 0, done: { [WEST]: ['@monster', 'Hunter', 'Woodcutting'] } } };
    expect(exploreRollsLeft(full, WEST)).toBe(0);
    expect(chunksToExplore(full)).toEqual([]);
    expect(gameReducer(full, { type: 'CHUNK_EXPLORE', payload: { chunk: WEST, fact: 'Thieving' } })).toBe(full);
  });

  it('starts a run’s record on its next chunk, so chunks it already held pay nothing', () => {
    const old = run({ chunkExplore: undefined, keys: 1 });
    const grown = { ...old, unlocks: { ...old.unlocks, chunks: [WEST, '50,49'] } };
    expect(withExploreStart(old, grown).chunkExplore).toEqual({ from: 1, done: {} });
    expect(chunksToExplore(withExploreStart(old, grown))).toEqual(['50,49']);
    // A brand-new run starts at nothing; Vanilla never gets a record; an existing record stays.
    const fresh = { ...old, unlocks: { ...old.unlocks, chunks: [] } };
    expect(withExploreStart(fresh, old).chunkExplore).toEqual({ from: 0, done: {} });
    expect(withExploreStart({ ...old, gameModeId: 'vanilla' }, { ...grown, gameModeId: 'vanilla' }).chunkExplore).toBeUndefined();
    expect(withExploreStart(old, run()).chunkExplore).toEqual({ from: 0, done: {} });

    // Through the reducer: a Key spent on a chunk starts the record.
    const spent = gameReducer(old, { type: 'UNLOCK', payload: { table: 'Chunks' as never, item: '50,49', costType: 'key', cost: 1 } });
    expect(spent.unlocks.chunks).toEqual([WEST, '50,49']);
    expect(spent.chunkExplore).toEqual({ from: 1, done: {} });
  });

  it('rolls a 10% Key through the normal roll engine', () => {
    const action = prepareKeyRollAction(run(), DropSource.CHUNK_EXPLORE, DROP_RATES[DropSource.CHUNK_EXPLORE], 1, () => 1);
    expect(action?.payload).toMatchObject({ source: DropSource.CHUNK_EXPLORE, baseThreshold: 10, success: true });
  });

  it("keeps Fate's Mercy shut while an exploring roll can be taken", () => {
    const capped = run({ unlocks: { ...run().unlocks, skills: { Hitpoints: 1 }, levels: { ...initialState.unlocks.levels, Hitpoints: 10 } }, chunkedBreakthroughs: { Hitpoints: 2 } });
    expect(exploreWaiting(capped)).toBe(true);
    expect(mercyBlocker(capped)).toBe('explore');
    const explored = { ...capped, chunkExplore: { from: 0, done: { [WEST]: ['@monster'] } } };
    // Hunter, Thieving and Woodcutting are all locked, so nothing else can be explored yet.
    expect(exploreWaiting(explored)).toBe(false);
    expect(mercyBlocker(explored)).not.toBe('explore');
  });

  it('saves and loads the record, and rejects a broken one', () => {
    const save = (chunkExplore: unknown) => {
      const { lastEvent: _event, ...saved } = run();
      return validateAndMigrateSave({ ...saved, chunkExplore } as never, initialState);
    };
    expect(save({ from: 0, done: {} }).ok).toBe(true);
    const ok = save({ from: 2, done: { [WEST]: ['@monster', 'Woodcutting'] } });
    expect(ok.ok && ok.state.chunkExplore).toEqual({ from: 2, done: { [WEST]: ['@monster', 'Woodcutting'] } });
    expect(save({ from: -1, done: {} }).ok).toBe(false);
    expect(save({ from: 0, done: { [WEST]: ['Sneezing'] } }).ok).toBe(false);
    expect(save({ from: 0, done: { [WEST]: ['@monster', '@monster'] } }).ok).toBe(false);
    expect(save({ from: 0, done: { [WEST]: ['@monster', 'Hunter', 'Thieving', 'Woodcutting'] } }).ok).toBe(false);
    expect(save({ from: 0, done: { lumbridge: [] } }).ok).toBe(false);
  });
});
