import { describe, expect, it } from 'vitest';
import { GameState, TableType } from '../types';
import { RESOURCE_MAP, RESOURCE_UNLOCK_TABLES } from '../data/resourceData';
import { buildGoalRoute } from './goalRoute';
import { getPoolAndStateKey } from './gameEngine';
import { calculateSupplyChain } from './supplyChain';

const stateWith = (): GameState => ({
  unlocks: {
    regions: [], skills: {}, levels: {}, quests: [], diaries: [],
    bosses: [], minigames: [], guilds: [], mobility: [], arcana: [],
    storage: [], housing: [], merchants: [], farming: [], slayerUnlocks: [], equipment: {},
    completedTasks: [], cas: [], collectionLog: {},
  },
} as unknown as GameState);

const routeFor = (goalId: string, source: Record<string, unknown>) => {
  RESOURCE_MAP[goalId] = [source as any];
  try {
    return buildGoalRoute(goalId, stateWith())!;
  } finally {
    delete RESOURCE_MAP[goalId];
  }
};

describe('Supply Chain typed unlock blockers', () => {
  it.each([
    ['boss', 'Zulrah', TableType.BOSSES],
    ['minigame', 'Pest Control', TableType.MINIGAMES],
    ['farming', 'Herb', TableType.FARMING_LAYERS],
    ['guild', "Cooks' Guild", TableType.GUILDS],
    ['arcana', 'Piety', TableType.ARCANA],
    ['storage', 'Rune Pouch', TableType.STORAGE],
    ['housing', 'Chapel Altar', TableType.POH],
  ])('routes a typed %s blocker to its own gacha table', (_kind, unlockId, table) => {
    const goalId = `__typed_supply_${table}_${unlockId}`;
    const route = routeFor(goalId, {
      type: 'DROP',
      name: 'Typed source fixture',
      regions: ['Any'],
      unlockId,
      unlockTable: table,
    });

    expect(route.tables).toHaveLength(1);
    expect(route.tables[0]).toMatchObject({ table, needed: [unlockId] });
  });

  it.each([
    ['merchant', { type: 'SHOP', name: 'General Store', regions: ['Any'] }, TableType.MERCHANTS, 'General Stores'],
    ['mobility', { type: 'SHOP', name: 'Charter Ships', regions: ['Any'] }, TableType.MOBILITY, 'Charter Ships'],
  ])('preserves the existing %s tag route', (_kind, source, table, unlockId) => {
    const route = routeFor(`__tagged_supply_${table}`, source);

    expect(route.tables).toHaveLength(1);
    expect(route.tables[0]).toMatchObject({ table, needed: [unlockId] });
  });

  it('uses declared legacy provenance for existing untyped resource IDs', () => {
    const route = routeFor('__legacy_supply_zulrah', {
      type: 'DROP',
      name: 'Legacy boss source fixture',
      regions: ['Any'],
      unlockId: 'Zulrah',
    });

    expect(route.tables).toHaveLength(1);
    expect(route.tables[0]).toMatchObject({
      table: TableType.BOSSES,
      needed: ['Zulrah'],
    });
  });

  it('fails closed for an ambiguous source without table provenance', () => {
    const route = routeFor('__untyped_supply_mage_arena', {
      type: 'DROP',
      name: 'Ambiguous source fixture',
      regions: ['Any'],
      unlockId: 'Mage Arena',
    });

    expect(route.sources[0].missing).toEqual(['Unlock: Mage Arena']);
    expect(route.tables).toEqual([]);
  });
  it('keeps Mage Arena Resource Area as a Regions blocker, never a Minigame', () => {
    const route = routeFor('__resource_area_region_guard', {
      type: 'DROP',
      name: 'Resource Area fixture',
      regions: ['Resource Area'],
    });

    expect(route.tables).toHaveLength(1);
    expect(route.tables[0]).toMatchObject({
      table: TableType.REGIONS,
      needed: ['Mage Arena'],
    });
  });

  it('declares table provenance for every shipped legacy resource unlock', () => {
    const untypedUnlockIds = [
      ...new Set(
        Object.values(RESOURCE_MAP)
          .flat()
          .flatMap(source => (!source.unlockTable && source.unlockId ? [source.unlockId] : [])),
      ),
    ];
    expect(untypedUnlockIds).toHaveLength(66);
    expect(untypedUnlockIds.filter(id => !RESOURCE_UNLOCK_TABLES[id])).toEqual([]);
  });

  it('maps every declared legacy provenance entry to a pool containing that ID', () => {
    const invalid = Object.entries(RESOURCE_UNLOCK_TABLES)
      .filter(([id, table]) => !getPoolAndStateKey(table).pool.includes(id));
    expect(invalid).toEqual([]);
  });

  it('fails closed rather than treating untyped Mage Arena as a Minigame', () => {
    const goalId = '__untyped_mage_arena_cross_table_guard';
    RESOURCE_MAP[goalId] = [{
      type: 'DROP',
      name: 'Ambiguous source fixture',
      regions: ['Any'],
      unlockId: 'Mage Arena',
    }];
    const state = stateWith();
    state.unlocks.minigames = ['Mage Arena'];
    try {
      const chain = calculateSupplyChain(goalId, state)!;
      expect(chain.sources[0].status).toMatchObject({
        isAvailable: false,
        missing: ['Unlock: Mage Arena'],
        unlockDependencies: [],
      });
    } finally {
      delete RESOURCE_MAP[goalId];
    }
  });
});
