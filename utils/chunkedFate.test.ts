import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { gameReducer, initialState, prepareLevelUpActions } from '../context/GameContext';
import { historyFilterMatches } from '../components/LogViewer';
import { chunkLabelWithCoords } from './chunkLabelWithCoords';
import { BREAKTHROUGH_CHANCE } from '../config/economy';
import { validateAndMigrateSave } from './saveSchema';
import { replayInvariants } from './integrity';
import { breakthroughTier, chunkedSkillHasRoom, levelPastTierCap, mercyBlocker, mercyPool, pendingBreakthroughs } from './chunkedFate';
import { mercyShutReason } from './chunkedMercyText';

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

    const drawn = gameReducer(state, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'reveal-1', doableQuests: [] } });
    const pick = pool[0];
    expect(drawn.pendingUnlock).toMatchObject({ id: 'reveal-1', table: pick.table, item: pick.item });
    expect(drawn.history.at(-1)).toMatchObject({ type: 'UNLOCK', meta: { item: pick.item, costType: 'mercy', cost: 0 } });
    expect(drawn.keys).toBe(0);
    // Not dry any more while the reveal is pending.
    expect(gameReducer(drawn, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'reveal-2', doableQuests: [] } })).toBe(drawn);
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
    expect(gameReducer(state, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'x', doableQuests: [] } })).toBe(state);
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
    const drawn = gameReducer(settled, { type: 'CALL_ON_FATE', payload: { roll: 0.5, revealId: 'r', doableQuests: [] } });
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

// October 2026 review fixes (economy.md 3, 4, 5, 10, 11; play.md 7; plugin-discord.md 3; screens B1, C1, C4).
describe('Chunked tier caps: levels past the cap are logged but roll nothing', () => {
  const capped = (gameModeId: string) => ({
    ...dry(), gameModeId, chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 },
    unlocks: { ...dry().unlocks, skills: { Hitpoints: 1, Woodcutting: 1 }, levels: { ...dry().unlocks.levels, Woodcutting: 10 } },
  });

  it('marks only Chunked levels past the cap', () => {
    const { unlocks } = capped('chunked');
    expect(levelPastTierCap('chunked', unlocks, 'Woodcutting', 10)).toBe(false);
    expect(levelPastTierCap('chunked', unlocks, 'Woodcutting', 11)).toBe(true);
    expect(levelPastTierCap('vanilla', unlocks, 'Woodcutting', 11)).toBe(false);
    expect(levelPastTierCap('chunked', { skills: { Woodcutting: 10 } }, 'Woodcutting', 99)).toBe(false);
  });

  it('logs a Chunked level past the cap with no Key roll and no Chaos Key, and Vanilla as before', () => {
    const chunked = { ...capped('chunked'), unlocks: { ...capped('chunked').unlocks, levels: { ...capped('chunked').unlocks.levels, Woodcutting: 29 } } };
    const dice = () => 0;
    const prepared = prepareLevelUpActions(chunked, 'Woodcutting', 0, dice);
    expect(prepared.rewardAction).toBeNull();
    // chaosRoll 0 would win the 2% chance, and 30 is a guaranteed Chaos milestone: neither pays past the cap.
    const leveled = gameReducer(chunked, prepared.levelAction);
    expect(leveled.unlocks.levels.Woodcutting).toBe(30);
    expect(leveled.chaosKeys).toBe(0);
    expect(leveled.history.find(e => e.type === 'LEVEL_UP' && e.meta?.skill === 'Woodcutting'))
      .toMatchObject({ message: 'Woodcutting Level 30: no roll', meta: { pastTierCap: 10, chaosKeysAwarded: 0 } });
    expect(replayInvariants(leveled.history, 0).violations).toEqual([]);

    const vanilla = { ...chunked, gameModeId: 'vanilla' };
    const vanillaPrepared = prepareLevelUpActions(vanilla, 'Woodcutting', 0, dice);
    expect(vanillaPrepared.rewardAction).not.toBeNull();
    expect(gameReducer(vanilla, vanillaPrepared.levelAction).chaosKeys).toBe(2);
  });

  it('treats a skill past its cap as capped: no room, one Breakthrough per tier', () => {
    const state = { ...capped('chunked'), chunkedBreakthroughs: { Hitpoints: 2 }, unlocks: { ...capped('chunked').unlocks, levels: { ...capped('chunked').unlocks.levels, Woodcutting: 60 } } };
    expect(chunkedSkillHasRoom('Woodcutting', state.unlocks)).toBe(false);
    expect(breakthroughTier(state, 'Woodcutting')).toBe(2);
    const lost = gameReducer(state, { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Woodcutting', roll: 0.99 } });
    expect(breakthroughTier(lost, 'Woodcutting')).toBeNull();
    expect(lost.history.at(-1)?.details).toBe('Fate kept Woodcutting at tier 1 (methods to level 10). Levels past 10 roll nothing until a Key opens levels 11-20.');
  });
});

describe("Fate's Mercy: Fate, quests and the shut reason", () => {
  const open = () => ({ ...dry(), fatePoints: 0, chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 } });

  it('stays shut while the run has Fate for the Ritual of Chaos or a free Chaos or Cartographer ritual', () => {
    expect(mercyBlocker({ ...open(), fatePoints: 24 })).toBeNull();
    expect(mercyBlocker({ ...open(), fatePoints: 25 })).toBe('fate');
    expect(mercyBlocker({ ...open(), fatePoints: 45 })).toBe('fate');
    expect(mercyBlocker({ ...open(), freeRituals: ['CARTOGRAPHER'] })).toBe('fate');
    expect(mercyBlocker({ ...open(), freeRituals: ['LUCK'] })).toBeNull();
    const rich = { ...open(), fatePoints: 45 };
    expect(gameReducer(rich, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'r', doableQuests: [] } })).toBe(rich);
    expect(mercyShutReason(rich)).toBe("Fate's Mercy waits while you have 45 Fate: enough for the Ritual of Chaos (25 Fate) at the Void Altar.");
  });

  it('stays shut while a quest is doable, and the reducer refuses a call without the quest list', () => {
    expect(mercyBlocker(open(), ["Cook's Assistant"])).toBe('quest');
    expect(gameReducer(open(), { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'r', doableQuests: ["Cook's Assistant"] } })).toEqual(open());
    const noList = { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'r' } } as unknown as Parameters<typeof gameReducer>[1];
    expect(gameReducer(open(), noList)).toEqual(open());
    expect(mercyShutReason(open(), ["Cook's Assistant", 'Sheep Shearer'])).toBe("Fate's Mercy waits while 2 quests are doable in your chunks.");
  });

  it('names the skill with room, says nothing while a Standard Key is held, and nothing when open', () => {
    const room = { ...open(), unlocks: { ...open().unlocks, levels: { ...open().unlocks.levels, Woodcutting: 15 } } };
    expect(mercyShutReason(room)).toBe("Fate's Mercy waits while Woodcutting can still level in your chunks: level 15 of its tier cap 20.");
    expect(mercyShutReason({ ...room, keys: 1 })).toBeNull();
    expect(mercyShutReason({ ...open(), chaosKeys: 1 })).toBe("Fate's Mercy waits while you hold a Chaos Key. Spend it first.");
    expect(mercyShutReason(open(), [])).toBeNull();
  });

  it('records a Mercy draw as free, names what it drew, and keeps old and new saves valid', () => {
    const drawn = gameReducer(open(), { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'reveal-1', doableQuests: [] } });
    expect(drawn.pendingUnlock).toMatchObject({ costType: 'mercy', cost: 0 });
    const pick = drawn.pendingUnlock!;
    const entry = drawn.history.at(-1)!;
    expect(entry.message).toBe(pick.table === TableType.CHUNKS
      ? `Unlocked ${chunkLabelWithCoords(pick.item)} · Fate's Mercy`
      : `Unlocked ${pick.item} tier ${drawn.unlocks.skills[pick.item]} · Fate's Mercy`);
    const { lastEvent: _e, ...persisted } = drawn;
    const loaded = validateAndMigrateSave(persisted, initialState);
    expect(loaded.ok && loaded.state.pendingUnlock).toEqual(drawn.pendingUnlock);
    // A save from before free draws stored Mercy as 1 Key: still valid.
    const legacy = validateAndMigrateSave({ ...persisted, pendingUnlock: { ...pick, costType: 'key', cost: 1 } }, initialState);
    expect(legacy.ok).toBe(true);
    // A free draw costs nothing, and only on the tables fate draws from.
    expect(validateAndMigrateSave({ ...persisted, pendingUnlock: { ...pick, costType: 'mercy', cost: 1 } }, initialState).ok).toBe(false);
    expect(validateAndMigrateSave({ ...persisted, pendingUnlock: { id: 'x', table: TableType.BOSSES, item: 'Obor', costType: 'mercy', cost: 0 } }, initialState).ok).toBe(false);
    expect(validateAndMigrateSave({ ...persisted, pendingUnlock: { id: 'x', table: TableType.CHUNKS, item: '49,50', costType: 'breakthrough', cost: 0 } }, initialState).ok).toBe(false);
  });

  it('labels a Mercy chunk with its own name and coordinates', () => {
    const chunkOnly = { ...open(), unlocks: { ...open().unlocks, skills: {} } };
    const pool = mercyPool(chunkOnly);
    const at = pool.findIndex(({ table, item }) => table === TableType.CHUNKS && item === '49,50');
    expect(at).toBeGreaterThanOrEqual(0);
    const drawn = gameReducer(chunkOnly, { type: 'CALL_ON_FATE', payload: { roll: (at + 0.5) / pool.length, revealId: 'r', doableQuests: [] } });
    expect(drawn.history.at(-1)?.message).toBe("Unlocked Lumbridge (49, 50) · Fate's Mercy");
  });
});

describe('Breakthrough results', () => {
  it('shows a won Breakthrough as a free reveal that names the tier, and refuses while a reveal is open', () => {
    const won = gameReducer(dry(), { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Woodcutting', roll: 0, revealId: 'rv' } });
    expect(won.pendingUnlock).toEqual({ id: 'rv', table: TableType.SKILLS, item: 'Woodcutting', costType: 'breakthrough', cost: 0 });
    expect(won.history.at(-1)?.message).toBe('Unlocked Woodcutting tier 3 · Breakthrough');
    // Hitpoints is waiting too, but the reveal must be acknowledged first.
    expect(gameReducer(won, { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Hitpoints', roll: 0, revealId: 'rv2' } })).toBe(won);
    const { lastEvent: _e, ...persisted } = won;
    expect(validateAndMigrateSave(persisted, initialState).ok).toBe(true);
  });

  it('files a lost Breakthrough under Rolls, not Level', () => {
    const lost = gameReducer(dry(), { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Woodcutting', roll: 0.99 } });
    const entry = lost.history.at(-1)!;
    expect(historyFilterMatches(entry, 'ROLLS')).toBe(true);
    expect(historyFilterMatches(entry, 'PROGRESS')).toBe(false);
  });
});

describe('the reducer checks what the UI checks', () => {
  it('refuses Areas and Omni-Key chunks in Chunked, but not an Omni-Key area in Vanilla', () => {
    const omni = { ...dry(), specialKeys: 1 };
    expect(gameReducer(omni, { type: 'UNLOCK', payload: { table: TableType.REGIONS, item: 'Falador', costType: 'specialKey', cost: 1 } })).toBe(omni);
    expect(gameReducer(omni, { type: 'UNLOCK', payload: { table: TableType.CHUNKS, item: '49,50', costType: 'specialKey', cost: 1 } })).toBe(omni);
    const vanilla = { ...omni, gameModeId: 'vanilla' };
    expect(gameReducer(vanilla, { type: 'UNLOCK', payload: { table: TableType.REGIONS, item: 'Falador', costType: 'specialKey', cost: 1 } }).unlocks.regions).toContain('Falador');
  });

  it('logs a Key chunk unlock by name and coordinates, keeping the key in meta', () => {
    const state = { ...dry(), keys: 1 };
    const s = gameReducer(state, { type: 'UNLOCK', payload: { table: TableType.CHUNKS, item: '49,50', costType: 'key', cost: 1, revealId: 'r' } });
    expect(s.history.at(-1)).toMatchObject({ message: 'Unlocked Lumbridge (49, 50)', meta: { item: '49,50' } });
  });
});
