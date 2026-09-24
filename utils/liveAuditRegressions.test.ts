import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { analyzeRequirement } from '../components/StrategyGuide';
import { STRATEGY_DATABASE } from '../data/requirements';
import { QUEST_DATA } from '../data/questData';
import { TableType } from '../types';
import { getActivityReq } from '../data/activityRequirements';
import { evaluateActivityReadiness } from './activityReadiness';
import { getUtilityActivityReq } from './utilityReadiness';
import { BANKS, BANK_IDS } from '../data/banks';
import { randomUnlockPool, isRandomUnlockEligible, randomUnlockTables, checkUnlockAvailability } from './gameEngine';
import { suggestTables } from './goalRoute';
import { completionPercent, playerUnlockPoints } from './completion';
import { ALL_CHUNK_KEYS, CHUNKED_START_KEY } from './chunkAdjacency';
import { SKILLS_LIST, EQUIPMENT_SLOTS, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST, SLAYER_UNLOCKS_LIST } from '../data/items';
import { EQUIPMENT_TIER_MAX } from '../config/rules';
import { calculateSupplyChain } from './supplyChain';
import { RESOURCE_MAP } from '../data/resourceData';
import { collogReachability } from './collogReach';
import { copyLegacyResourcePlanning, hasLegacyResourcePlanning, readResourceQuantities, resourcePlanningKey } from './resourcePlanningStorage';

const fresh = () => createFreshState();
describe('live audit requirement regressions', () => {
  it('uses canonical quest eligibility even if old strategy requirements are supplied', () => {
    const u = fresh().unlocks;
    const analysis = analyzeRequirement(STRATEGY_DATABASE['Dragon Slayer I'], u, 'vanilla');
    expect(analysis.isFullyPlayable).toBe(false);
    expect(analysis.missingQuests).toContain('Quest Points 32');
  });
  it('requires the parent guild unlock and completed reward diary', () => {
    const u = fresh().unlocks;
    u.skills = Object.fromEntries(SKILLS_LIST.map(s => [s, 10]));
    u.levels = Object.fromEntries(SKILLS_LIST.map(s => [s, 99]));
    u.regions = [...REGIONS_LIST];
    expect(analyzeRequirement(STRATEGY_DATABASE["Warriors' Guild (Cyclopes)"], u).isCategoryUnlocked).toBe(false);
    const ring = STRATEGY_DATABASE["Explorer's Ring (Alchemy)"];
    expect(analyzeRequirement(ring, u).isFullyPlayable).toBe(false);
    expect(analyzeRequirement(ring, u).missingChecks).toContain('Lumbridge Elite diary');
    u.diaries = ['Lumbridge Elite'];
    expect(analyzeRequirement(ring, u).isFullyPlayable).toBe(true);
  });
  it('accepts either bank route without making an optional diary mandatory', () => {
    const u = fresh().unlocks;
    u.regions = [...REGIONS_LIST]; u.guilds = ['Crafting Guild'];
    u.skills.Crafting = 10; u.levels.Crafting = 40;
    const bank = STRATEGY_DATABASE['Crafting Guild Bank'];
    expect(analyzeRequirement(bank, u).isFullyPlayable).toBe(false);
    u.diaries = ['Falador Hard'];
    expect(analyzeRequirement(bank, u).isFullyPlayable).toBe(true);
    u.diaries = []; u.levels.Crafting = 99;
    expect(analyzeRequirement(bank, u).isFullyPlayable).toBe(true);
  });
  it('enforces structured guild gates and exposes external activity checks', () => {
    const u = fresh().unlocks;
    u.regions = [...REGIONS_LIST];
    for (const name of ["Champions' Guild", "Warriors' Guild"]) expect(evaluateActivityReadiness(true, getActivityReq(name), u).status).toBe('NOT_READY');
    expect(evaluateActivityReadiness(true, getActivityReq('Nex'), u).status).toBe('NOT_READY');
    for (const name of ['Nightmare Zone', 'Skotizo']) expect(evaluateActivityReadiness(true, getActivityReq(name), u).status).toBe('NEEDS_CONFIRMATION');
    expect(evaluateActivityReadiness(true, undefined, u).status).toBe('NEEDS_CONFIRMATION');
  });
  it('does not label a bank or Farming Guild ready in locked geography', () => {
    const u = fresh().unlocks;
    const bank = BANKS.find(b => b.name === 'Zanaris bank')!;
    u.banks = [bank.id];
    u.skills.Farming = 5; u.levels.Farming = 45;
    for (const req of [getUtilityActivityReq(bank.id, TableType.BANKS), getActivityReq('Farming Guild')]) expect(evaluateActivityReadiness(true, req, u).status).not.toBe('READY');
  });
  it('keeps corrected data and alternate acquisition routes', () => {
    expect(getActivityReq('Rigour')?.skills?.Defence).toBe(70);
    expect(getActivityReq('Augury')?.skills?.Defence).toBe(70);
    expect(getActivityReq('Seed Vault')?.quests).toBeUndefined();
    expect(getActivityReq('Seed Vault')?.requiredAreas).toEqual(['Farming Guild']);
    expect(getActivityReq('Magic Carpets')?.quests).toBeUndefined();
    expect(getActivityReq('Fairy Rings')?.quests).toBeUndefined();
    expect(getActivityReq('Vinery')?.skills?.Farming).toBe(36);
    expect(getActivityReq('Jewellery Box')?.skills?.Construction).toBe(81);
    expect(getActivityReq('Slayer Ring')?.skills?.Slayer).toBeUndefined();
  });
});

it('uses actual random eligibility for every mode and suppresses inaccessible goal odds', () => {
  const u = fresh().unlocks;
  for (const mode of ['vanilla', 'xtreme', 'chunked']) {
    for (const table of randomUnlockTables(mode)) {
      for (const candidate of randomUnlockPool(u, mode, 'key', table)) expect(isRandomUnlockEligible(table, candidate.item, u, mode)).toBe(true);
    }
  }
  expect(randomUnlockTables('chunked')).toContain(TableType.CHUNKS);
  expect(randomUnlockTables('chunked')).not.toContain(TableType.REGIONS);
  expect(randomUnlockTables('vanilla')).toContain(TableType.BANKS);
  expect(suggestTables([{ table: TableType.BOSSES, id: 'The Gauntlet' }], u, 'vanilla')).toEqual([]);
  u.regions = ['Prifddinas'];
  expect(suggestTables([{ table: TableType.BOSSES, id: 'The Gauntlet' }], u, 'vanilla')[0].odds).toBeGreaterThan(0);
});

it('counts rolled chunks, excludes the free start, and reaches exactly 100% when complete', () => {
  const u = fresh().unlocks;
  const start = playerUnlockPoints(u, 'chunked');
  u.chunks = [CHUNKED_START_KEY];
  expect(playerUnlockPoints(u, 'chunked')).toBe(start);
  u.chunks = ['49,50'];
  expect(playerUnlockPoints(u, 'chunked')).toBe(start + 1);
  Object.assign(u, {
    skills: Object.fromEntries(SKILLS_LIST.map(s => [s, 10])), equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(s => [s, EQUIPMENT_TIER_MAX])),
    mobility: [...MOBILITY_LIST], arcana: [...ARCANA_LIST], housing: [...POH_LIST], merchants: [...MERCHANTS_LIST],
    minigames: [...MINIGAMES_LIST], bosses: [...BOSSES_LIST], storage: [...STORAGE_LIST], guilds: [...GUILDS_LIST],
    farming: [...FARMING_PATCH_LIST], slayerUnlocks: [...SLAYER_UNLOCKS_LIST], banks: [...BANK_IDS], chunks: [...ALL_CHUNK_KEYS], regions: [],
  });
  expect(completionPercent(u, 'chunked')).toBe(100);
  u.chunks = ALL_CHUNK_KEYS.filter(k => k !== CHUNKED_START_KEY);
  expect(checkUnlockAvailability(u).chunks).toBe(false);
  expect(completionPercent(u, 'chunked')).toBe(100);
  u.chunks = ALL_CHUNK_KEYS.filter(k => k !== '49,50');
  expect(completionPercent(u, 'chunked')).toBe(99);
});

it('keeps all unverified enriched routes unavailable and never grants a fresh profile a whip', () => {
  const state = fresh();
  expect(calculateSupplyChain('Abyssal Whip', state)!.sources.some(s => s.status.isAvailable)).toBe(false);
  for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
    if (!sources.some(s => s.requirementsUnverified)) continue;
    for (const route of calculateSupplyChain(item, state)!.sources.filter(s => s.source.requirementsUnverified)) expect(route.status.isAvailable).toBe(false);
  }
});

it('maps all five Collection Log aliases without granting their slots at baseline', () => {
  const u = fresh().unlocks;
  expect(collogReachability(u).tabs.find(t => t.tab === 'Bosses')!.obtainable).toBe(4); // Brutus only
  const before = collogReachability(u).obtainable;
  u.bosses = ['Callisto', 'TzHaar Fight Cave', 'Thermonuclear Smoke Devil', 'Venenatis', "Vet'ion"];
  expect(collogReachability(u).obtainable - before).toBe(25);
});

it('isolates each run and copies legacy planning only into the chosen run', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) } as unknown as Storage;
  storage.setItem('FATE_RESOURCE_INVENTORY', '{"Logs":12}');
  storage.setItem('FATE_RESOURCE_PLAN', '{"Oak Plank":20}');
  expect(readResourceQuantities(storage, resourcePlanningKey('inventory', 'audit'))).toEqual({});
  expect(hasLegacyResourcePlanning(storage)).toBe(true);
  expect(copyLegacyResourcePlanning(storage, 'main')).toBe(true);
  expect(readResourceQuantities(storage, resourcePlanningKey('inventory', 'main'))).toEqual({ Logs: 12 });
  expect(copyLegacyResourcePlanning(storage, 'audit')).toBe(false);
  expect(readResourceQuantities(storage, resourcePlanningKey('plan', 'audit'))).toEqual({});
  expect(storage.getItem('FATE_RESOURCE_INVENTORY')).toBe('{"Logs":12}');
});
