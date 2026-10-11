import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { gameReducer, initialState } from '../context/GameContext';
import { getGameMode, F2P_MODE_ID } from '../config/gameModes';
import { BREAKTHROUGH_CHANCE } from '../config/economy';
import {
  BOSSES_LIST, EQUIPMENT_SLOTS, GUILDS_LIST, MERCHANTS_LIST, MINIGAMES_LIST, MISTHALIN_AREAS, MOBILITY_LIST, REGIONS_LIST, SKILLS_LIST,
} from '../data/items';
import { BANK_IDS } from '../data/banks';
import { F2P_AREAS, F2P_BANK_IDS, F2P_EQUIPMENT_TIER_MAX, F2P_SKILLS, F2P_START_AREAS, F2P_TABLE_ITEMS } from '../data/f2pContent';
import { f2pQuestMembership } from '../data/f2pQuestMembership';
import { checkUnlockAvailability, getPoolAndStateKey, isOmniDirectUnlockAvailable, randomUnlockPool, randomUnlockTables } from './gameEngine';
import { freeAreasFor, setStartArea, unlockableAreas } from './freeAreas';
import { completionDenominator, completionPercent } from './completion';
import { breakthroughTier, mercyBlocker, mercyPool } from './chunkedFate';
import { questsForMode } from './questScope';

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

  it('stop gear at rune', () => {
    const state = f2p();
    const atRune = { ...state.unlocks, equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, F2P_EQUIPMENT_TIER_MAX])) };
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
    expect(completionDenominator(F2P_MODE_ID)).toBe(15 * 10 + EQUIPMENT_SLOTS.length * 5 + lists.reduce((total, list) => total + list.length, 0));
    const done = {
      ...initialState.unlocks,
      skills: Object.fromEntries(F2P_SKILLS.map(skill => [skill, 10])),
      equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 5])),
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
