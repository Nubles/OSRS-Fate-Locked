import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { gameReducer, initialState } from '../context/GameContext';
import { getGameMode, F2P_MODE_ID } from '../config/gameModes';
import { BREAKTHROUGH_CHANCE } from '../config/economy';
import {
  BOSSES_LIST, EQUIPMENT_SLOTS, GUILDS_LIST, MERCHANTS_LIST, MINIGAMES_LIST, MISTHALIN_AREAS, MOBILITY_LIST, REGIONS_LIST, SKILLS_LIST,
} from '../data/items';
import { BANK_IDS } from '../data/banks';
import {
  F2P_AREAS, F2P_BANK_IDS, F2P_CA_TASK_IDS, F2P_EQUIPMENT_TIER_CAPS, F2P_SKILLS, F2P_START_AREAS, F2P_TABLE_ITEMS,
} from '../data/f2pContent';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { ALL_CA_TASKS } from '../data/caTasks';
import { PETS } from '../data/pets';
import content from '../public/chunk-content.json';
import { f2pQuestMembership } from '../data/f2pQuestMembership';
import { checkUnlockAvailability, getPoolAndStateKey, isOmniDirectUnlockAvailable, randomUnlockPool, randomUnlockTables } from './gameEngine';
import { freeAreasFor, setStartArea, unlockableAreas } from './freeAreas';
import { completionDenominator, completionPercent } from './completion';
import { breakthroughTier, mercyBlocker, mercyPool } from './chunkedFate';
import { caTasksForMode, equipmentTierMaxFor, questsForMode } from './modeContent';
import { evaluateQuestEligibility } from './journalStatus';
import { diaryTaskCompletionDecision, questCompletionDecision } from './journalCompletion';
import { caTaskCompletionDecision } from './caProgress';
import { rankAvailableQuests } from './questAdvisor';
import { runProgress } from './runProgress';
import { buildProgressSnapshot } from './progressSnapshot';
import { evaluateAchievements } from './achievements';
import { listGoalTargets } from './goalPlanner';
import { computeAreaRoutes } from './areaRoutes';
import { loadWalkSections } from './walkSections';

const f2p = () => ({
  ...initialState,
  runId: initialState.runId,
  runRevision: 0,
  lastEvent: null,
  gameModeId: F2P_MODE_ID,
  gameModeLocked: true,
  keys: 0,
  specialKeys: 0,
  chaosKeys: 0,
  unlocks: { ...initialState.unlocks, skills: { Hitpoints: 1, Woodcutting: 2 }, levels: { ...initialState.unlocks.levels, Woodcutting: 20 } },
});

beforeEach(() => setStartArea('f2p'));
afterEach(() => setStartArea('misthalin'));

describe('Free-to-play content lists', () => {
  it('only name entries the game already has', () => {
    const known: Partial<Record<TableType, readonly string[]>> = {
      [TableType.SKILLS]: SKILLS_LIST, [TableType.REGIONS]: REGIONS_LIST, [TableType.MOBILITY]: MOBILITY_LIST,
      [TableType.MERCHANTS]: MERCHANTS_LIST, [TableType.MINIGAMES]: MINIGAMES_LIST, [TableType.BOSSES]: BOSSES_LIST,
      [TableType.GUILDS]: GUILDS_LIST, [TableType.BANKS]: BANK_IDS,
    };
    for (const [table, items] of Object.entries(F2P_TABLE_ITEMS)) {
      for (const item of items) expect(known[table as TableType] ?? [], `${table} ${item}`).toContain(item);
    }
    for (const area of F2P_START_AREAS) expect(MISTHALIN_AREAS).toContain(area);
    expect(new Set([...F2P_START_AREAS, ...F2P_AREAS]).size).toBe(F2P_START_AREAS.length + F2P_AREAS.length);
  });

  it('leave out members content on free-to-play land', () => {
    const all = Object.values(F2P_TABLE_ITEMS).flat();
    for (const members of ["Rogues' Castle", 'Chaos Altar', 'Entrana', 'Scurrius', "Wizards' Guild", 'Wilderness Obelisks']) {
      expect(all).not.toContain(members);
    }
    expect(F2P_SKILLS).toHaveLength(15);
    expect(F2P_BANK_IDS).not.toContain('11571'); // the Crafting Guild bank is members only
  });

  it('match the wiki: no Lost Property, Herblore Shops in, 18 Combat Achievement tasks', () => {
    const merchants = F2P_TABLE_ITEMS[TableType.MERCHANTS]!;
    expect(merchants).not.toContain('Lost Property');
    expect(merchants).not.toContain('Jewellery Shops');
    expect(merchants).toContain('Herblore Shops');
    expect(F2P_CA_TASK_IDS).toHaveLength(18);
    const tasks = ALL_CA_TASKS.filter(task => (F2P_CA_TASK_IDS as readonly string[]).includes(task.id));
    expect(tasks).toHaveLength(18);
    expect(tasks.map(task => task.id)).not.toContain('ca_40'); // A Slow Death needs poison or venom
    expect(Object.keys(F2P_EQUIPMENT_TIER_CAPS).sort()).toEqual([...EQUIPMENT_SLOTS].sort());
  });

  it('cover the 24 free-to-play quests', () => {
    expect(questsForMode(F2P_MODE_ID).map(quest => quest.id).sort()).toEqual(f2pQuestMembership.map(quest => quest.questId).sort());
  });
});

describe('Free-to-play rolls', () => {
  it('skip the tables with no free-to-play entries', () => {
    const tables = randomUnlockTables(F2P_MODE_ID);
    for (const table of [TableType.ARCANA, TableType.POH, TableType.STORAGE, TableType.FARMING_LAYERS, TableType.SLAYER_UNLOCKS]) {
      expect(tables).not.toContain(table);
    }
    expect(tables).toEqual(expect.arrayContaining([TableType.EQUIPMENT, TableType.SKILLS, TableType.REGIONS, TableType.BOSSES, TableType.BANKS]));
  });

  it('draw only free-to-play entries, and skills the run can train', () => {
    const state = f2p();
    const pool = randomUnlockPool(state.unlocks, F2P_MODE_ID);
    expect(pool.length).toBeGreaterThan(0);
    for (const { table, item } of pool) expect(F2P_TABLE_ITEMS[table] ?? EQUIPMENT_SLOTS, `${table} ${item}`).toContain(item);
    expect(pool.some(({ table }) => table === TableType.SKILLS)).toBe(true);
    expect(pool.filter(({ table }) => table === TableType.SKILLS).map(({ item }) => item)).not.toContain('Agility');
    expect(getPoolAndStateKey(TableType.REGIONS, F2P_MODE_ID).pool).toEqual([...F2P_AREAS]);
    expect(unlockableAreas(F2P_MODE_ID)).toEqual([...F2P_AREAS]);
    expect(freeAreasFor(F2P_MODE_ID)).toEqual(['Tutorial Island', ...F2P_START_AREAS]);
  });

  it("stop gear at each slot's best free-to-play tier", () => {
    const state = f2p();
    expect(equipmentTierMaxFor(F2P_MODE_ID, 'Body')).toBe(5);
    expect(equipmentTierMaxFor(F2P_MODE_ID, 'Cape')).toBe(1);
    const capeAtOne = { ...state.unlocks, equipment: { Cape: 1 } };
    expect(randomUnlockPool(capeAtOne, F2P_MODE_ID, 'key', TableType.EQUIPMENT).map(({ item }) => item)).not.toContain('Cape');
    const atRune = { ...state.unlocks, equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, F2P_EQUIPMENT_TIER_CAPS[slot]])) };
    expect(randomUnlockPool(atRune, F2P_MODE_ID, 'key', TableType.EQUIPMENT)).toEqual([]);
    expect(checkUnlockAvailability(atRune, F2P_MODE_ID).equipment).toBe(false);
    expect(randomUnlockPool(atRune, 'vanilla', 'key', TableType.EQUIPMENT).length).toBe(EQUIPMENT_SLOTS.length);
  });

  it('refuse an Omni-Key on members content', () => {
    const state = { ...f2p(), specialKeys: 1 };
    expect(isOmniDirectUnlockAvailable(TableType.SKILLS, 'Agility', state.unlocks, F2P_MODE_ID)).toBe(false);
    expect(gameReducer(state, { type: 'UNLOCK', payload: { table: TableType.SKILLS, item: 'Agility', costType: 'specialKey', cost: 1 } })).toBe(state);
    const mining = gameReducer(state, { type: 'UNLOCK', payload: { table: TableType.SKILLS, item: 'Mining', costType: 'specialKey', cost: 1 } });
    expect(mining.unlocks.skills.Mining).toBe(1);
    expect(mining.specialKeys).toBe(0);
  });
});

describe('Free-to-play fate rules', () => {
  it('give a capped skill its Breakthrough roll', () => {
    const state = f2p();
    expect(breakthroughTier(state, 'Woodcutting')).toBe(3);
    const won = gameReducer(state, { type: 'CHUNKED_BREAKTHROUGH', payload: { skill: 'Woodcutting', roll: BREAKTHROUGH_CHANCE - 0.01 } });
    expect(won.unlocks.skills.Woodcutting).toBe(3);
  });

  it("draw Fate's Mercy from free-to-play areas and skills once the run is dry", () => {
    const state = { ...f2p(), chunkedBreakthroughs: { Hitpoints: 2, Woodcutting: 3 } };
    expect(mercyBlocker(state)).toBeNull();
    const pool = mercyPool(state);
    expect(pool.some(({ table }) => table === TableType.REGIONS)).toBe(true);
    for (const { table, item } of pool) {
      expect([TableType.REGIONS, TableType.SKILLS]).toContain(table);
      expect(F2P_TABLE_ITEMS[table]).toContain(item);
    }
    const drawn = gameReducer(state, { type: 'CALL_ON_FATE', payload: { roll: 0, revealId: 'r' } });
    expect(drawn.history.at(-1)).toMatchObject({ type: 'UNLOCK', meta: { costType: 'mercy', cost: 0 } });
  });
});

describe('Free-to-play completion', () => {
  it('counts only free-to-play content', () => {
    const lists = [F2P_AREAS, F2P_TABLE_ITEMS[TableType.MOBILITY]!, F2P_TABLE_ITEMS[TableType.MERCHANTS]!, F2P_TABLE_ITEMS[TableType.MINIGAMES]!,
      F2P_TABLE_ITEMS[TableType.BOSSES]!, F2P_TABLE_ITEMS[TableType.GUILDS]!, F2P_BANK_IDS];
    const gear = Object.values(F2P_EQUIPMENT_TIER_CAPS).reduce((total, cap) => total + cap, 0);
    expect(completionDenominator(F2P_MODE_ID)).toBe(15 * 10 + gear + lists.reduce((total, list) => total + list.length, 0));
    const done = {
      ...initialState.unlocks,
      skills: Object.fromEntries(F2P_SKILLS.map(skill => [skill, 10])),
      equipment: { ...F2P_EQUIPMENT_TIER_CAPS },
      regions: [...F2P_AREAS],
      mobility: [...F2P_TABLE_ITEMS[TableType.MOBILITY]!],
      merchants: [...F2P_TABLE_ITEMS[TableType.MERCHANTS]!],
      minigames: [...F2P_TABLE_ITEMS[TableType.MINIGAMES]!],
      bosses: [...F2P_TABLE_ITEMS[TableType.BOSSES]!],
      guilds: [...F2P_TABLE_ITEMS[TableType.GUILDS]!],
      banks: [...F2P_BANK_IDS],
    };
    expect(completionPercent(done, F2P_MODE_ID)).toBe(100);
    expect(completionPercent(done, 'vanilla')).toBeLessThan(50);
  });

  it('describes its areas and Breakthrough chance in the picker', () => {
    const { description } = getGameMode(F2P_MODE_ID);
    expect(description).toContain(`${F2P_AREAS.length} areas`);
    expect(description).toContain(`one ${BREAKTHROUGH_CHANCE * 100}% Breakthrough roll`);
  });
});

describe('Free-to-play members content', () => {
  it('locks members quests and diaries, and refuses to log them', () => {
    const { unlocks } = f2p();
    const cat = QUEST_DATA["Gertrude's Cat"];
    expect(evaluateQuestEligibility(cat, unlocks, 'vanilla').eligible).toBe(true);
    expect(evaluateQuestEligibility(cat, unlocks, F2P_MODE_ID)).toMatchObject({ eligible: false, status: 'LOCKED_QUEST' });
    expect(questCompletionDecision(cat, unlocks, F2P_MODE_ID, { manualConfirmed: true }).ok).toBe(false);
    expect(questCompletionDecision(QUEST_DATA["Cook's Assistant"], unlocks, F2P_MODE_ID, { manualConfirmed: true }).ok).toBe(true);
    const lumbridgeEasy = ALL_DIARY_TASKS.find(task => task.tierId === 'Lumbridge Easy')!;
    expect(diaryTaskCompletionDecision(lumbridgeEasy, unlocks, F2P_MODE_ID, { manualConfirmed: true }).ok).toBe(false);
    for (const quest of rankAvailableQuests(unlocks, F2P_MODE_ID)) expect(questsForMode(F2P_MODE_ID)).toContain(QUEST_DATA[quest.id]);
  });

  it('refuses members Combat Achievement tasks, pets and collection log items', () => {
    const state = f2p();
    const zulrah = ALL_CA_TASKS.find(task => task.monster === 'Zulrah')!;
    const obor = ALL_CA_TASKS.find(task => task.id === 'ca_129')!;
    expect(caTaskCompletionDecision(zulrah, [], F2P_MODE_ID).ok).toBe(false);
    expect(caTaskCompletionDecision(obor, [], F2P_MODE_ID).ok).toBe(true);
    expect(caTaskCompletionDecision(zulrah, [], 'vanilla').ok).toBe(true);
    expect(caTasksForMode(F2P_MODE_ID).map(task => task.id).sort()).toEqual([...F2P_CA_TASK_IDS].sort());
    const pet = PETS[0];
    expect(gameReducer(state, { type: 'CLAIM_PET', payload: { petId: pet.id, petName: pet.name } })).toBe(state);
    expect(gameReducer(state, { type: 'LOG_ITEM', payload: 154007 })).toBe(state); // Tanzanite fang
    expect(gameReducer(state, { type: 'LOG_ITEM', payload: 136001 }).unlocks.collectionLog[136001]).toBe(1); // Hill giant club
    expect(gameReducer(state, { type: 'LOG_ITEM', payload: 404031 })).toBe(state); // Castle Wars magic hat: members
  });
});

describe('Free-to-play counts', () => {
  it('count only free-to-play areas, quests and no diaries', () => {
    const { unlocks } = f2p();
    expect(runProgress(unlocks, F2P_MODE_ID)).toMatchObject({ unit: 'areas', total: F2P_START_AREAS.length + F2P_AREAS.length });
    expect(runProgress(unlocks, F2P_MODE_ID).unlocked).toBe(F2P_START_AREAS.length);
    const snapshot = buildProgressSnapshot({ unlocks, history: [], gameModeId: F2P_MODE_ID });
    expect(snapshot.quests.total).toBe(f2pQuestMembership.length);
    expect(snapshot.diaryTasks.total).toBe(0);
  });

  it('only offer achievements and goals a free-to-play run can reach', () => {
    const { unlocks } = f2p();
    const achievements = evaluateAchievements(unlocks, F2P_MODE_ID);
    expect(achievements.map(a => a.category)).not.toContain('Diaries');
    expect(achievements.map(a => a.category)).not.toContain('Combat');
    expect(achievements.find(a => a.title === 'Quest Cape')!.target).toBe(f2pQuestMembership.length);
    expect(achievements.find(a => a.title === 'Polymath')!.target).toBe(15);
    expect(achievements.find(a => a.title === 'Veteran')).toBeUndefined();
    expect(evaluateAchievements(unlocks, 'vanilla').find(a => a.title === 'Veteran')).toBeDefined();
    const goals = listGoalTargets(F2P_MODE_ID);
    expect(goals.filter(goal => goal.kind === 'diary')).toEqual([]);
    expect(goals.filter(goal => goal.kind === 'region').map(goal => goal.id)).toEqual([...F2P_AREAS]);
    expect(goals.filter(goal => goal.kind === 'quest')).toHaveLength(f2pQuestMembership.length);
  });

  it('reach every free-to-play area once they are all owned, Castle Wars through Ferox Enclave', () => {
    loadWalkSections();
    const connect = (content as unknown as { connect: Record<string, string[]> }).connect;
    const { unlocks } = f2p();
    const routes = computeAreaRoutes(connect, { ...unlocks, regions: [...F2P_AREAS] }, F2P_MODE_ID)!;
    expect([...routes.strandedAreas]).toEqual([]);
    const withoutFerox = computeAreaRoutes(connect, { ...unlocks, regions: F2P_AREAS.filter(area => area !== 'Ferox Enclave') }, F2P_MODE_ID)!;
    expect(withoutFerox.strandedAreas.has('Castle Wars')).toBe(true);
  });
});
