import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { gameReducer, initialState, prepareLevelUpActions } from '../context/GameContext';
import { historyFilterMatches } from '../components/LogViewer';
import { chunkLabelWithCoords } from './chunkLabelWithCoords';
import { BREAKTHROUGH_CHANCE } from '../config/economy';
import { validateAndMigrateSave } from './saveSchema';
import { replayInvariants } from './integrity';
import { breakthroughTier, chunkedSkillHasRoom, levelPastTierCap, MERCY_QUIET_MS, mercyBlocker, mercyEnablers, mercyPool, mercyQuietLeft, mercyRitualInReach, pendingBreakthroughs } from './chunkedFate';
import { FARMING_PATCH_LIST, SKILLS_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { ALL_CHUNK_KEYS, CHUNKED_START_KEY, getChunkFrontier } from './chunkAdjacency';
import { drawFloat, seededContext } from './seededRng';
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
    // Hitpoints starts at its tier 1 cap of 10, but only a combat style trains it.
    expect(pendingBreakthroughs(state)).toEqual(['Woodcutting']);
    const fighter = { ...state, unlocks: { ...state.unlocks, skills: { ...state.unlocks.skills, Magic: 1 } } };
    expect(pendingBreakthroughs(fighter)).toEqual(expect.arrayContaining(['Hitpoints', 'Woodcutting']));
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

  it('a free Cartographer with no frontier chunk to chart does not hold Mercy shut (dead end 8)', () => {
    const everywhere = { ...open(), freeRituals: ['CARTOGRAPHER'], unlocks: { ...open().unlocks, chunks: ALL_CHUNK_KEYS.filter(k => k !== CHUNKED_START_KEY) } };
    expect(getChunkFrontier(everywhere.unlocks.chunks, everywhere.unlocks)).toEqual([]);
    expect(mercyRitualInReach(everywhere)).toBeNull();
    // The ritual could do nothing: the reducer refuses it.
    const s = { ...everywhere, cartographerOffer: ['49,50'] };
    expect(gameReducer(s, { type: 'RITUAL_CARTOGRAPHER', payload: { chunkKey: '49,50', label: '' } })).toBe(s);
    // With a frontier, a free Cartographer still counts; with none, Fate for Chaos still does.
    expect(mercyRitualInReach({ ...open(), freeRituals: ['CARTOGRAPHER'] })).toEqual({ id: 'CARTOGRAPHER', cost: 0, free: true });
    expect(mercyRitualInReach({ ...everywhere, freeRituals: [], fatePoints: 45 })?.id).toBe('CHAOS');
  });

  it('takes only the seeded draw on a seeded run, so a caller cannot pick the entry (audit V3)', () => {
    const call = (roll: number) => ({ type: 'CALL_ON_FATE' as const, payload: { roll, revealId: 'r', doableQuests: [] } });
    const s = { ...open(), rngSeed: 'FATE-2026-W42', rngVersion: 2 as const };
    const pool = mercyPool(s);
    expect(pool.length).toBeGreaterThan(1);
    const fair = drawFloat('FATE-2026-W42', seededContext(s), 'mercy');
    const wanted = (Math.floor(fair * pool.length) + 1) % pool.length;
    expect(gameReducer(s, call(wanted / pool.length))).toBe(s);
    expect(gameReducer(s, call(fair)).pendingUnlock?.item).toBe(pool[Math.floor(fair * pool.length)].item);
    // A roll outside [0, 1) is refused on any run.
    const unseeded = open();
    for (const roll of [1, -0.1, Number.NaN]) expect(gameReducer(unseeded, call(roll))).toBe(unseeded);
  });

  it('stays shut while a quest is doable, and the reducer refuses a call without the quest list', () => {
    expect(mercyBlocker(open(), ["Cook's Assistant"])).toBe('quest');
    expect(gameReducer(open(), { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'r', doableQuests: ["Cook's Assistant"] } })).toEqual(open());
    const noList = { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'r' } } as unknown as Parameters<typeof gameReducer>[1];
    expect(gameReducer(open(), noList)).toEqual(open());
    expect(mercyShutReason(open(), ["Cook's Assistant", 'Sheep Shearer'])).toBe("Fate's Mercy waits while 2 quests are doable in your chunks. If you can't, and nothing new comes for 3 days, it opens anyway.");
  });

  it('names the skill with room, says nothing while a Standard Key is held, and nothing when open', () => {
    const room = { ...open(), unlocks: { ...open().unlocks, levels: { ...open().unlocks.levels, Woodcutting: 15 } } };
    expect(mercyShutReason(room)).toBe("Fate's Mercy waits while Woodcutting can still level in your chunks: level 15 of its tier cap 20. If you can't, and nothing new comes for 3 days, it opens anyway.");
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

// The full-run sim (chunked-audit sim, October 2026) ended runs that owned
// every chunk, with every skill at 99 but Herblore, and no Herb patch type:
// patch types come only from the Farming Patches table, Mercy drew only
// Chunks and Skills, so its pool was empty and it said everything was open.
describe("Fate's Mercy: the patch type or guild a skill needs", () => {
  const endgame = (herbloreTier: number, over: Record<string, unknown> = {}) => {
    const skills: Record<string, number> = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10]));
    const levels = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99]));
    skills.Herblore = herbloreTier; levels.Herblore = 1;
    return { ...dry(), fatePoints: 0, unlocks: {
      // Every skill trains to 99 here, so Breakthroughs no longer apply.
      ...dry().unlocks, skills, levels,
      chunks: ALL_CHUNK_KEYS.filter(key => key !== CHUNKED_START_KEY),
      quests: Object.keys(QUEST_DATA),
      farming: FARMING_PATCH_LIST.filter(patch => patch !== 'Herb'),
      ...over,
    } };
  };

  it.each([0, 1])('draws the Herb patch type when it alone keeps Herblore (tier %i) at level 1', tier => {
    const s = endgame(tier);
    expect(getChunkFrontier(s.unlocks.chunks, s.unlocks)).toEqual([]);
    expect(mercyEnablers(s)).toEqual([{ table: TableType.FARMING_LAYERS, item: 'Herb' }]);
    expect(mercyPool(s)).toEqual([{ table: TableType.FARMING_LAYERS, item: 'Herb' }]);
    expect(mercyBlocker(s, [])).toBeNull();
    const drawn = gameReducer(s, { type: 'CALL_ON_FATE', payload: { roll: 0.5, revealId: 'm', doableQuests: [] } });
    expect(drawn.unlocks.farming).toContain('Herb');
    expect(drawn.pendingUnlock).toMatchObject({ table: TableType.FARMING_LAYERS, item: 'Herb', costType: 'mercy', cost: 0 });
    expect(drawn.history.at(-1)?.message).toBe("Unlocked Herb patches · Fate's Mercy");
    // The reveal survives a reload.
    const { lastEvent: _lastEvent, ...persisted } = drawn;
    const saved = validateAndMigrateSave(persisted, initialState);
    if (saved.ok === false) throw new Error(`${saved.code} ${saved.path}`);
    expect(saved.state.pendingUnlock?.item).toBe("Herb");
  });

  it('says what is still unfinished instead of claiming everything is open', () => {
    // Herblore waits on Druidic Ritual, which no patch type or guild opens.
    const stuck = endgame(1, { farming: [...FARMING_PATCH_LIST], quests: Object.keys(QUEST_DATA).filter(quest => quest !== 'Druidic Ritual') });
    expect(mercyBlocker(stuck, [])).toBe('nothing_left');
    expect(mercyShutReason(stuck, [])).toBe("Fate's Mercy has nothing it can draw for you: no chunk, skill tier, patch type or guild it could open would let you train Herblore further.");
    const done = endgame(10, { farming: [...FARMING_PATCH_LIST], levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])) });
    expect(mercyBlocker(done, [])).toBe('nothing_left');
    expect(mercyShutReason(done, [])).toBe("Fate's Mercy has nothing left to draw: every chunk and skill tier it could open is open.");
  });
});

describe("Fate's Mercy after a quiet spell (chunked-audit dead ends)", () => {
  // A skill the tracker thinks has room, which the real game may not let the run train.
  const stuck = (progressAt: number) => ({
    ...dry(), chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 }, chunkedProgressAt: progressAt,
    unlocks: { ...dry().unlocks, levels: { ...dry().unlocks.levels, Woodcutting: 15 } },
  });
  const t0 = 1_700_000_000_000;

  it("opens after 3 days with no new Key, unlock or level, past the tracker's guesses", () => {
    expect(mercyBlocker(stuck(t0), ['Cook\'s Assistant'], t0 + MERCY_QUIET_MS - 1)).toBe('skill_room');
    expect(mercyBlocker(stuck(t0), ['Cook\'s Assistant'], t0 + MERCY_QUIET_MS)).toBeNull();
    expect(mercyQuietLeft(stuck(t0), t0 + MERCY_QUIET_MS - 3_600_000)).toBe(3_600_000);
    expect(mercyShutReason(stuck(t0), [], t0 + MERCY_QUIET_MS - 3_600_000)).toMatch(/nothing new comes for 1 hour, it opens anyway\.$/);
  });

  it('still waits on what always works: Keys, Fate for a ritual and Breakthroughs', () => {
    const late = t0 + 10 * MERCY_QUIET_MS;
    expect(mercyBlocker({ ...stuck(t0), keys: 1 }, [], late)).toBe('keys');
    expect(mercyBlocker({ ...stuck(t0), fatePoints: 25 }, [], late)).toBe('fate');
    const capped = stuck(t0);
    expect(mercyBlocker({ ...capped, chunkedBreakthroughs: {}, unlocks: { ...capped.unlocks, levels: { ...capped.unlocks.levels, Woodcutting: 20 } } }, [], late)).toBe('breakthrough');
  });

  it('falls back to the newest log entry on saves without a stamp, and never opens on an empty one', () => {
    const old = { ...stuck(t0), chunkedProgressAt: undefined, history: [{ id: 'h', timestamp: t0, type: 'LEVEL_UP', message: 'x' }] as never };
    expect(mercyBlocker(old, [], t0 + MERCY_QUIET_MS)).toBeNull();
    expect(mercyBlocker({ ...old, history: [] }, [], t0 + 10 * MERCY_QUIET_MS)).toBe('skill_room');
  });

  it('is restarted by the reducer whenever a Chunked run gains a Key, an unlock or a level, and survives a save', () => {
    const before = stuck(Date.now() - 1000);
    const next = gameReducer(before, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'r', doableQuests: [] } });
    expect(next).toBe(before); // still shut: not quiet yet
    const levelled = gameReducer(before, { type: 'LEVEL_UP', payload: { skill: 'Woodcutting', chaosRoll: 0.99 } });
    expect(levelled.chunkedProgressAt).toBeGreaterThan(before.chunkedProgressAt);
    const { lastEvent: _lastEvent, ...persisted } = levelled;
    const saved = validateAndMigrateSave(persisted, initialState);
    expect(saved.ok && saved.state.chunkedProgressAt).toBe(levelled.chunkedProgressAt);
  });
});
