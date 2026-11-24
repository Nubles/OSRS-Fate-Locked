// Gates the Resource Engine must check before it calls a source obtainable:
// the boss or minigame of its loot, the merchant category of a shop, the
// farming patch of a crop, the quest of a quest reward, and (Chunked) the
// chunks the source's NPC stands in.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import full from '../public/chunk-content.json';
import { chunkContentService } from '../services/ChunkContentService';
import { createFreshState } from '../context/GameContext';
import { CURATED_RESOURCE_SOURCES, RESOURCE_MAP, resourceUnlockDependency } from '../data/resourceData';
import { BOSSES_LIST, FARMING_PATCH_LIST, MINIGAMES_LIST, SKILLS_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { setStartArea } from './freeAreas';
import { calculateSupplyChain, isItemAvailable } from './supplyChain';
import type { GameState } from '../types';

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => structuredClone(full) })));
  await chunkContentService.init();
  setStartArea('none');
});

const state = (mode: 'vanilla' | 'chunked', patch: Partial<GameState['unlocks']> = {}): GameState => {
  const base = createFreshState();
  base.gameModeId = mode;
  base.unlocks = {
    ...base.unlocks, chunks: [],
    skills: Object.fromEntries(SKILLS_LIST.map(s => [s, 10])),
    levels: Object.fromEntries(SKILLS_LIST.map(s => [s, 99])),
    ...patch,
  };
  return base;
};
const route = (item: string, source: string, gs: GameState) => {
  const row = calculateSupplyChain(item, gs)!.sources.find(entry => entry.source.name === source && !entry.source.requirementsUnverified);
  expect(row, `${item} <- ${source}`).toBeDefined();
  return row!.status;
};

describe('boss and minigame loot needs the boss or minigame', () => {
  // Names a curated row uses for a boss or minigame on BOSSES_LIST/MINIGAMES_LIST.
  const ALIASES: Record<string, string> = {
    'Barrows Chest': 'Barrows Brothers', 'Blast Furnace Shop': 'Blast Furnace',
    'LMS Shop': 'Last Man Standing', 'Forestry Shop': 'Forestry',
  };
  const activities = new Set<string>([...BOSSES_LIST, ...MINIGAMES_LIST, 'Barrows Brothers']);

  it('every hand-written boss or minigame row names an unlock the engine can check', () => {
    const ungated: string[] = [];
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      for (const s of sources) {
        if (!CURATED_RESOURCE_SOURCES.includes(s)) continue;
        const activity = ALIASES[s.name] ?? s.name;
        if (!activities.has(activity)) continue;
        const dep = resourceUnlockDependency(s);
        if (!dep || dep.id !== activity) ungated.push(`${item} <- ${s.name}`);
      }
    }
    expect(ungated).toEqual([]);
  });

  it('a spirit shield, void top and fighter torso need their boss or minigame', () => {
    const gs = state('vanilla', { regions: ['Wilderness', "Void Knights' Outpost", 'Kandarin', 'Asgarnia'] });
    expect(route('Spirit Shield', 'Corporeal Beast', gs).missing).toContain('Unlock: Corporeal Beast');
    expect(route('Void Knight Top', 'Pest Control', gs).missing).toContain('Unlock: Pest Control');
    expect(route('Fighter Torso', 'Barbarian Assault', gs).missing).toContain('Unlock: Barbarian Assault');
    gs.unlocks.bosses = ['Corporeal Beast'];
    expect(route('Spirit Shield', 'Corporeal Beast', gs).isAvailable).toBe(true);
  });
});

describe('every shop row has a merchant category', () => {
  it('no hand-written shop or merchant row is left with no category', () => {
    const gs = state('vanilla');
    const unresolved: string[] = [];
    for (const item of Object.keys(RESOURCE_MAP)) {
      for (const row of calculateSupplyChain(item, gs)!.sources) {
        if (row.status.missing.includes('Shop category needs review') && CURATED_RESOURCE_SOURCES.includes(row.source)) {
          unresolved.push(`${item} <- ${row.source.name}`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('amylase crystals and stamina potions can be had from Grace', () => {
    const gs = state('vanilla', { regions: ['Asgarnia'], merchants: [] });
    expect(route('Amylase Crystal', 'Grace', gs).missing).toEqual(['Merchant: Reward Shops']);
    gs.unlocks.merchants = ['Reward Shops'];
    expect(route('Amylase Crystal', 'Grace', gs).isAvailable).toBe(true);
  });

  it("Bert's daily sand needs The Hand in the Sand, not a Crafting level of its own", () => {
    const gs = state('vanilla', { regions: ['Kandarin'] });
    expect(route('Bucket of Sand', 'The Hand in the Sand', gs).missing).toEqual(['Quest: The Hand in the Sand']);
    gs.unlocks.quests = ['The Hand in the Sand'];
    gs.unlocks.levels = { ...gs.unlocks.levels, Crafting: 49 };
    expect(route('Bucket of Sand', 'The Hand in the Sand', gs).isAvailable).toBe(true);
  });
});

describe('patch crops need the farming patch', () => {
  it('a herb patch route needs the Herb patch unlock', () => {
    const gs = state('vanilla', { regions: ['Asgarnia', 'Falador'], farming: [] });
    expect(route('Guam Leaf', 'Herb Patch', gs).missing).toContain('Unlock: Herb');
    gs.unlocks.farming = ['Herb'];
    expect(route('Guam Leaf', 'Herb Patch', gs).missing).toEqual([]);
    expect(route('Guam Leaf', 'Herb Patch', gs).isAvailable).toBe(true);
  });

  it('Chunked rolls patches too, so the herb patch route needs the Herb patch there as well', () => {
    const gs = state('chunked', { farming: [] });
    expect(route('Guam Leaf', 'Herb Patch', gs).missing).toContain('Unlock: Herb');
    gs.unlocks.farming = ['Herb'];
    expect(route('Guam Leaf', 'Herb Patch', gs).isAvailable).toBe(true);
  });

  it('every hand-written patch row names its patch', () => {
    const PATCH: Record<string, string> = {
      'Herb Patch': 'Herb', 'Allotment Patch': 'Allotment', 'Flower Patch': 'Flower', 'Bush Patch': 'Bush',
      'Hardwood Patch': 'Hardwood Tree', 'Seaweed Patch': 'Seaweed', 'Palm Tree Patch': 'Fruit Tree', 'Cactus Patch': 'Cactus',
    };
    const wrong = CURATED_RESOURCE_SOURCES.filter(s => / Patch$/.test(s.name))
      .filter(s => s.unlockId !== PATCH[s.name] || resourceUnlockDependency(s)?.id !== PATCH[s.name])
      .map(s => `${s.name}: ${s.unlockId}`);
    expect(wrong).toEqual([]);
    expect(Object.values(PATCH).filter(id => !FARMING_PATCH_LIST.includes(id))).toEqual([]);
  });
});

describe('quest rewards need the quest', () => {
  it('Silverlight needs Demon Slayer', () => {
    const gs = state('vanilla', { regions: ['Misthalin'], quests: [] });
    expect(route('Silverlight', 'Demon Slayer', gs).missing).toEqual(['Quest: Demon Slayer']);
    expect(isItemAvailable('Silverlight', gs)).toBe(false);
    gs.unlocks.quests = ['Demon Slayer'];
    expect(isItemAvailable('Silverlight', gs)).toBe(true);
  });

  it('Excalibur needs Merlin\'s Crystal in Chunked mode too', () => {
    const gs = state('chunked', { quests: [] });
    expect(route('Excalibur', "Merlin's Crystal", gs).missing).toContain("Quest: Merlin's Crystal");
  });

  it('every QUEST row is named after a quest', () => {
    const names = new Set(Object.keys(QUEST_DATA));
    const odd = CURATED_RESOURCE_SOURCES.filter(s => s.type === 'QUEST' && !names.has(s.name)).map(s => s.name);
    expect(odd).toEqual([]);
  });
});

describe('Chunked: the gnome pickpocket route', () => {
  it('counts in the Tree Gnome Stronghold, not in the Mourner Headquarters', () => {
    const stronghold = state('chunked', { chunks: ['38,53'] });
    expect(route("Toad's Legs", 'Gnome', stronghold).missing).not.toContain('Not in your chunks: Gnome');
    const hq = state('chunked', { chunks: ['39,51'] });
    expect(route("Toad's Legs", 'Gnome', hq).missing).toContain('Not in your chunks: Gnome');
  });
});
