import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { gameReducer, initialState } from '../context/GameContext';
import { BREAKTHROUGH_CHANCE } from '../config/economy';
import { validateAndMigrateSave } from './saveSchema';
import { replayInvariants } from './integrity';
import { breakthroughTier, chunkedSkillHasRoom, mercyBlocker, mercyPool, pendingBreakthroughs } from './chunkedFate';

// A Chunked run on the Lumbridge Castle start chunk with no Keys left.
const dry = () => ({
  ...initialState,
  runId: initialState.runId,
  runRevision: 0,
  lastEvent: null,
  gameModeId: 'chunked',
  keys: 0,
  specialKeys: 0,
  chaosKeys: 0,
  unlocks: {
    ...initialState.unlocks,
    chunks: [] as string[],
    skills: { Hitpoints: 1, Woodcutting: 2 },
    levels: { ...initialState.unlocks.levels, Woodcutting: 20 },
  },
});

describe('Chunked Breakthrough', () => {
  it('waits on a skill at its cap whose next tier the chunks can train', () => {
    const state = dry();
    expect(breakthroughTier(state, 'Woodcutting')).toBe(3);
    // Hitpoints starts at its tier 1 cap of 10, and every chunk with a monster trains it.
    expect(pendingBreakthroughs(state)).toEqual(expect.arrayContaining(['Hitpoints', 'Woodcutting']));
  });

  it('does not wait below the cap, outside Chunked, or once rolled for that tier', () => {
    const below = { ...dry(), unlocks: { ...dry().unlocks, levels: { ...dry().unlocks.levels, Woodcutting: 19 } } };
    expect(breakthroughTier(below, 'Woodcutting')).toBeNull();
    expect(breakthroughTier({ ...dry(), gameModeId: 'vanilla' }, 'Woodcutting')).toBeNull();
    expect(breakthroughTier({ ...dry(), chunkedBreakthroughs: { Woodcutting: 3 } }, 'Woodcutting')).toBeNull();
    // A skill the chunks cannot train never waits, even at its cap: no rocks in Lumbridge Castle.
    const mining = { ...dry(), unlocks: { ...dry().unlocks, skills: { ...dry().unlocks.skills, Mining: 1 }, levels: { ...dry().unlocks.levels, Mining: 10 } } };
    expect(breakthroughTier(mining, 'Mining')).toBeNull();
  });

  it('opens the next tier on a roll under the chance and records the roll either way', () => {
    const won = gameReducer(dry(), { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Woodcutting', roll: BREAKTHROUGH_CHANCE - 0.01 } });
    expect(won.unlocks.skills.Woodcutting).toBe(3);
    expect(won.chunkedBreakthroughs).toEqual({ Woodcutting: 3 });
    expect(won.history.at(-1)).toMatchObject({ type: 'UNLOCK', meta: { item: 'Woodcutting', costType: 'breakthrough', cost: 0 } });
    expect(won.keys).toBe(0);

    const lost = gameReducer(dry(), { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Woodcutting', roll: BREAKTHROUGH_CHANCE } });
    expect(lost.unlocks.skills.Woodcutting).toBe(2);
    expect(lost.chunkedBreakthroughs).toEqual({ Woodcutting: 3 });
    expect(lost.history.at(-1)?.message).toBe('No Breakthrough for Woodcutting');
    // One roll per tier: a second dispatch changes nothing.
    expect(gameReducer(lost, { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Woodcutting', roll: 0 } })).toBe(lost);
  });
});

describe("Fate's Mercy", () => {
  it('stays shut while the run has a Key, a skill with room, or a Breakthrough waiting', () => {
    expect(mercyBlocker({ ...dry(), keys: 1 })).toBe('keys');
    expect(mercyBlocker({ ...dry(), chaosKeys: 1 })).toBe('keys');
    const room = { ...dry(), unlocks: { ...dry().unlocks, levels: { ...dry().unlocks.levels, Woodcutting: 15 } } };
    expect(chunkedSkillHasRoom('Woodcutting', room.unlocks)).toBe(true);
    expect(mercyBlocker(room)).toBe('skill_room');
    expect(mercyBlocker(dry())).toBe('breakthrough');
    expect(mercyBlocker({ ...dry(), gameModeId: 'vanilla' })).toBe('not_chunked');
  });

  it('opens once every Breakthrough is rolled, and draws only frontier chunks and trainable skills', () => {
    const state = { ...dry(), chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 } };
    expect(mercyBlocker(state)).toBeNull();
    const pool = mercyPool(state);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every(({ table }) => table === TableType.CHUNKS || table === TableType.SKILLS)).toBe(true);
    expect(pool.map(({ item }) => item)).not.toContain('Sailing');

    const drawn = gameReducer(state, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'reveal-1' } });
    const pick = pool[0];
    expect(drawn.pendingUnlock).toMatchObject({ id: 'reveal-1', table: pick.table, item: pick.item });
    expect(drawn.history.at(-1)).toMatchObject({ type: 'UNLOCK', meta: { item: pick.item, costType: 'mercy', cost: 0 } });
    expect(drawn.keys).toBe(0);
    // Not dry any more while the reveal is pending.
    expect(gameReducer(drawn, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'reveal-2' } })).toBe(drawn);
  });

  it('is not held shut by a skill the run cannot really train (play review 1 and 2)', () => {
    const settled = { ...dry(), chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 } };
    const withSkill = (skill: string, over: Record<string, unknown> = {}) => ({
      ...settled,
      unlocks: { ...settled.unlocks, ...over, skills: { ...settled.unlocks.skills, [skill]: 1 } },
    });
    // Herblore from Falador's herb patch, with the Herb patch and Farming open but no Druidic Ritual.
    const opened = withSkill('Herblore', { chunks: ['47,51'], farming: ['Herb'], levels: { ...settled.unlocks.levels, Farming: 10 } });
    const herblore = { ...opened, unlocks: { ...opened.unlocks, skills: { ...opened.unlocks.skills, Farming: 1 } } };
    expect(chunkedSkillHasRoom('Herblore', herblore.unlocks)).toBe(false);
    expect(mercyBlocker(herblore)).not.toBe('skill_room');
    const ritual = { ...herblore, unlocks: { ...herblore.unlocks, quests: ['Druidic Ritual'] } };
    expect(chunkedSkillHasRoom('Herblore', ritual.unlocks)).toBe(true);
    expect(mercyBlocker(ritual)).toBe('skill_room');
    // Smithing at the castle furnace with no ore anywhere.
    const smithing = withSkill('Smithing');
    expect(chunkedSkillHasRoom('Smithing', smithing.unlocks)).toBe(false);
    expect(mercyBlocker(smithing)).toBeNull();
    // Firemaking with Woodcutting open has logs to burn.
    expect(chunkedSkillHasRoom('Firemaking', withSkill('Firemaking').unlocks)).toBe(true);
    // Sailing before Pandemonium.
    const sailing = withSkill('Sailing', { chunks: ['47,50'] });
    expect(chunkedSkillHasRoom('Sailing', sailing.unlocks)).toBe(false);
    expect(chunkedSkillHasRoom('Sailing', { ...sailing.unlocks, quests: ['Pandemonium'] })).toBe(true);
  });

  it('refuses a call when the run is not dry', () => {
    const state = { ...dry(), keys: 1, chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 } };
    expect(gameReducer(state, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'x' } })).toBe(state);
  });
});

describe('Breakthrough and Mercy in saves and the audit', () => {
  it('round-trips the Breakthrough record and keeps the Key balance clean', () => {
    const won = gameReducer(dry(), { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Woodcutting', roll: 0 } });
    // Woodcutting trained to its new cap and lost its next roll; Hitpoints lost its roll.
    const settled = {
      ...won,
      chunkedBreakthroughs: { Woodcutting: 4, Hitpoints: 2 },
      unlocks: { ...won.unlocks, levels: { ...won.unlocks.levels, Woodcutting: 30 } },
    };
    const drawn = gameReducer(settled, { type: 'CALL_ON_FATE', payload: { roll: 0.5, revealId: 'r' } });
    expect(drawn.pendingUnlock?.id).toBe('r');
    const { lastEvent: _lastEvent, ...persisted } = drawn;
    const loaded = validateAndMigrateSave(persisted, initialState);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.state.chunkedBreakthroughs).toEqual({ Woodcutting: 4, Hitpoints: 2 });
    expect(replayInvariants(drawn.history, 0).violations).toEqual([]);
  });

  it('rejects a Breakthrough record for an unknown skill or tier', () => {
    const { lastEvent: _lastEvent, ...persisted } = dry();
    expect(validateAndMigrateSave({ ...persisted, chunkedBreakthroughs: { Dancing: 3 } }, initialState).ok).toBe(false);
    expect(validateAndMigrateSave({ ...persisted, chunkedBreakthroughs: { Woodcutting: 11 } }, initialState).ok).toBe(false);
  });
});
