import { describe, expect, it } from 'vitest';
import { DropSource } from '../types';
import { gameReducer, initialState, prepareKeyRollAction } from '../context/GameContext';
import { CHUNK_EXPLORE_ROLLS } from '../config/economy';
import { DROP_RATES } from '../config/rules';
import { validateAndMigrateSave } from './saveSchema';
import { chunksToExplore, exploreBlocker, exploreRollsLeft, exploreThings, exploreWaiting, withExploreStart } from './chunkExplore';
import { mercyBlocker } from './chunkedFate';

// 49,50 (west of the Lumbridge Castle start chunk) has something to fight,
// a tree patch (Farming from tier 2, oak at 15), Thieving from tier 2, and
// Woodcutting from tier 1.
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
    skills: { Hitpoints: 1, Attack: 1, Woodcutting: 1 },
  },
  chunkExplore: { from: 0, done: {} as Record<string, string[]> },
  ...over,
});

describe('Chunked exploring rolls', () => {
  it('lists what a chunk offers and holds at most three rolls', () => {
    expect(exploreThings(WEST).map(thing => [thing.label, thing.tier])).toEqual([
      ['Fought something', 1], ['Trained Farming', 2], ['Trained Thieving', 2], ['Trained Woodcutting', 1],
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
    expect(exploreBlocker(state, WEST, 'Thieving')).toBe('Needs Thieving tier 2.');
    expect(exploreBlocker(state, WEST, 'Mining')).toBe('That isn’t something this chunk offers.');
    expect(exploreBlocker({ ...state, chunkExplore: { from: 1, done: {} } }, WEST, '@monster')).toBe('This chunk has no exploring rolls left.');
    expect(exploreBlocker({ ...state, gameModeId: 'vanilla' }, WEST, '@monster')).toBe('This chunk has no exploring rolls left.');

    const once = gameReducer(state, { type: 'CHUNK_EXPLORE', payload: { chunk: WEST, fact: '@monster' } });
    expect(once.chunkExplore).toEqual({ from: 0, done: { [WEST]: ['@monster'] } });
    expect(gameReducer(once, { type: 'CHUNK_EXPLORE', payload: { chunk: WEST, fact: '@monster' } })).toBe(once);
    expect(gameReducer(once, { type: 'CHUNK_EXPLORE', payload: { chunk: WEST, fact: 'Thieving' } })).toBe(once);

    const full = { ...state, unlocks: { ...state.unlocks, skills: { ...state.unlocks.skills, Farming: 2, Thieving: 2 }, levels: { ...state.unlocks.levels, Farming: 15, Thieving: 11 }, farming: ['Wood Tree'] }, chunkExplore: { from: 0, done: { [WEST]: ['@monster', 'Thieving', 'Woodcutting'] } } };
    expect(exploreRollsLeft(full, WEST)).toBe(0);
    expect(chunksToExplore(full)).toEqual([]);
    expect(gameReducer(full, { type: 'CHUNK_EXPLORE', payload: { chunk: WEST, fact: 'Farming' } })).toBe(full);
  });

  it('needs the patch type unlocked before a patch can be explored (economy review 6)', () => {
    // 49,50's only patch is a tree patch.
    const farmer = run({ unlocks: { ...run().unlocks, skills: { Hitpoints: 1, Farming: 2 }, levels: { ...initialState.unlocks.levels, Farming: 15 }, farming: [] } });
    expect(exploreBlocker(farmer, WEST, 'Farming')).toBe('Needs the Wood Tree patch unlocked.');
    expect(exploreBlocker({ ...farmer, unlocks: { ...farmer.unlocks, farming: ['Wood Tree'] } }, WEST, 'Farming')).toBeNull();
    // An oak sapling needs Farming 15, not just tier 2 (deadlock audit, dead end 2).
    const sapling = { ...farmer, unlocks: { ...farmer.unlocks, farming: ['Wood Tree'], levels: initialState.unlocks.levels } };
    expect(exploreBlocker(sapling, WEST, 'Farming')).toBe('Needs Farming level 15.');
    expect(exploreBlocker({ ...farmer, unlocks: { ...farmer.unlocks, farming: ['Herb'] } }, WEST, 'Farming')).toBe('Needs the Wood Tree patch unlocked.');

    // Falador's allotment patches (47,51): the herb patch needs the Herb unlock, whatever else is open.
    // Its herb patch needs Farming 9 (guam), its allotments Farming 1.
    const falador = run({ unlocks: { ...run().unlocks, chunks: ['47,51'], skills: { Hitpoints: 1, Farming: 1 }, levels: { ...initialState.unlocks.levels, Farming: 9 }, farming: ['Allotment'] } });
    expect(exploreBlocker(falador, '47,51', '@herb')).toBe('Needs the Herb patch unlocked.');
    expect(exploreBlocker(falador, '47,51', 'Farming')).toBeNull();
    expect(exploreBlocker({ ...falador, unlocks: { ...falador.unlocks, farming: ['Herb'] } }, '47,51', '@herb')).toBeNull();
    expect(exploreBlocker({ ...falador, unlocks: { ...falador.unlocks, farming: ['Herb'], levels: initialState.unlocks.levels } }, '47,51', '@herb')).toBe('Needs Farming level 9.');

    // Port Sarim's only patch is the spirit tree patch, which needs 83 Farming (tier 9).
    const sarim = run({ unlocks: { ...run().unlocks, chunks: ['47,50'], skills: { Hitpoints: 1, Farming: 1 }, farming: ['Spirit Tree'] } });
    expect(exploreBlocker(sarim, '47,50', 'Farming')).toBe('Needs Farming tier 9.');
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
    const spent = gameReducer(old, { type: 'UNLOCK', payload: { table: 'Chunks' as never, item: '50,49', costType: 'key', cost: 1, revealId: 'r' } });
    expect(spent.unlocks.chunks).toEqual([WEST, '50,49']);
    expect(spent.chunkExplore).toEqual({ from: 1, done: {} });
  });

  it('rolls a 10% Key through the normal roll engine', () => {
    const action = prepareKeyRollAction(run(), DropSource.CHUNK_EXPLORE, DROP_RATES[DropSource.CHUNK_EXPLORE], 1, () => 1);
    expect(action?.payload).toMatchObject({ source: DropSource.CHUNK_EXPLORE, baseThreshold: 10, success: true });
  });

  it("keeps Fate's Mercy shut while an exploring roll can be taken", () => {
    const capped = run({ unlocks: { ...run().unlocks, skills: { Hitpoints: 1, Attack: 1 }, levels: { ...initialState.unlocks.levels, Hitpoints: 10, Attack: 10 } }, chunkedBreakthroughs: { Hitpoints: 2, Attack: 2 } });
    expect(exploreWaiting(capped)).toBe(true);
    expect(mercyBlocker(capped)).toBe('explore');
    const explored = { ...capped, chunkExplore: { from: 0, done: { [WEST]: ['@monster'] } } };
    // Farming, Thieving and Woodcutting are all locked, so nothing else can be explored yet.
    expect(exploreWaiting(explored)).toBe(false);
    expect(mercyBlocker(explored)).not.toBe('explore');
  });

  it('needs a combat style the run can use to fight (fate review V5)', () => {
    const fighter = (skills: Record<string, number>, Weapon = 0) =>
      run({ unlocks: { ...run().unlocks, skills: { Hitpoints: 1, ...skills }, equipment: { ...initialState.unlocks.equipment, Weapon } } });
    expect(exploreBlocker(fighter({}), WEST, '@monster')).toBe('Needs a combat style (melee, Magic, or Ranged with a Weapon slot).');
    // Ranged with no Weapon slot can hold no bow.
    expect(exploreBlocker(fighter({ Ranged: 1 }), WEST, '@monster')).not.toBeNull();
    expect(exploreBlocker(fighter({ Ranged: 1 }, 1), WEST, '@monster')).toBeNull();
    expect(exploreBlocker(fighter({ Magic: 1 }), WEST, '@monster')).toBeNull();
    // A run that can't fight has nothing to explore here, so it doesn't hold Fate's Mercy shut.
    const unarmed = { ...fighter({}), chunkedBreakthroughs: { Hitpoints: 2 } };
    expect(exploreWaiting(unarmed)).toBe(false);
  });

  it('checks each thing as the Skills rolls do: entry quest, guild, opening quest, level, and the skill itself (deadlock audit, dead end 4)', () => {
    const at = (chunks: string[], skills: Record<string, number>, over: Record<string, unknown> = {}) =>
      run({ unlocks: { ...run().unlocks, chunks, skills: { Hitpoints: 1, Attack: 1, ...skills }, ...over } });
    // 53,50 joins the PvP Arena on the near bank of the Salve, but its monsters are past it, behind Priest in Peril.
    const salve = at(['51,50', '52,50', '53,50'], {}, { levels: { ...initialState.unlocks.levels, Attack: 10 } });
    const explored = { ...salve, chunkedBreakthroughs: { Hitpoints: 2, Attack: 2 }, chunkExplore: { from: 0, done: { '51,50': exploreThings('51,50').map(thing => thing.fact), '52,50': exploreThings('52,50').map(thing => thing.fact) } } };
    expect(exploreBlocker(explored, '53,50', '@monster')).toBe('Needs Priest in Peril to get in.');
    expect(exploreWaiting(explored)).toBe(false);
    expect(mercyBlocker(explored, [])).not.toBe('explore');
    expect(exploreBlocker({ ...explored, unlocks: { ...explored.unlocks, quests: ['Priest in Peril'] } }, '53,50', '@monster')).toBeNull();
    // The Fishing Guild's spots are inside the guild.
    const guild = at(['40,53'], { Fishing: 7 }, { levels: { ...initialState.unlocks.levels, Fishing: 68 } });
    expect(exploreBlocker(guild, '40,53', 'Fishing')).toBe('Needs the Fishing Guild unlocked.');
    expect(exploreBlocker({ ...guild, unlocks: { ...guild.unlocks, guilds: ['Fishing Guild'] } }, '40,53', 'Fishing')).toBeNull();
    // Sailing opens with Pandemonium.
    const port = at(['47,50'], { Sailing: 1 });
    expect(exploreBlocker(port, '47,50', 'Sailing')).toBe('Needs Pandemonium done.');
    expect(exploreBlocker({ ...port, unlocks: { ...port.unlocks, quests: ['Pandemonium'] } }, '47,50', 'Sailing')).toBeNull();
    // Draynor rooftop needs Agility 10, not just tier 1.
    const draynor = at(['49,50', '48,50', '48,51'], { Agility: 1 });
    expect(exploreBlocker(draynor, '48,51', 'Agility')).toBe('Needs Agility level 10.');
    // The Water altar needs essence as well as Runecraft 5.
    const water = at(['50,49', '49,49'], { Runecraft: 1 }, { levels: { ...initialState.unlocks.levels, Runecraft: 5 } });
    expect(exploreBlocker(water, '49,49', 'Runecraft')).toMatch(/^Needs essence: Rune Mysteries, Mining and an essence mine teleport/);
    const essence = { ...water, unlocks: { ...water.unlocks, chunks: ['50,49', '49,49', '50,53'], quests: ['Rune Mysteries'], skills: { ...water.unlocks.skills, Mining: 1 } } };
    expect(exploreBlocker(essence, '49,49', 'Runecraft')).toBeNull();
  });

  it('saves and loads the record, and rejects a broken one', () => {
    const save = (chunkExplore: unknown) => {
      const { lastEvent: _event, ...saved } = run();
      return validateAndMigrateSave({ ...saved, chunkExplore } as never, initialState);
    };
    expect(save({ from: 0, done: {} }).ok).toBe(true);
    const ok = save({ from: 1, done: { [WEST]: ['@monster', 'Woodcutting'] } });
    expect(ok.ok && ok.state.chunkExplore).toEqual({ from: 1, done: { [WEST]: ['@monster', 'Woodcutting'] } });
    // run() holds 1 chunk. A start past the chunk count would turn exploring
    // off for good (October 2026 review), so it is clamped to the count.
    const far = save({ from: 999, done: {} });
    expect(far.ok && far.state.chunkExplore?.from).toBe(1);
    expect(save({ from: -1, done: {} }).ok).toBe(false);
    expect(save({ from: 0, done: { [WEST]: ['Sneezing'] } }).ok).toBe(false);
    expect(save({ from: 0, done: { [WEST]: ['@monster', '@monster'] } }).ok).toBe(false);
    expect(save({ from: 0, done: { [WEST]: ['@monster', 'Hunter', 'Thieving', 'Woodcutting'] } }).ok).toBe(false);
    expect(save({ from: 0, done: { lumbridge: [] } }).ok).toBe(false);
  });
});
