import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { QUEST_DATA } from './questData';
import { REGION_GROUPS, SKILLS_LIST } from './items';
import { RESOURCE_MAP, type ResourceSource } from './resourceData';
import { calculateSupplyChain } from '../utils/supplyChain';

// Hand-written RESOURCE_MAP rows whose quest, skill or unlock gates once
// disagreed with the OSRS Wiki (November 2026 deep audit, resource-a d3 and d4).
// Each block names the Wiki page it was read from. Vanilla, where Misthalin is
// free from the start.
const allQuests = Object.values(QUEST_DATA as Record<string, { name: string }>).map(q => q.name);
const groups = REGION_GROUPS as Record<string, string[]>;
const areasOf = (...continents: string[]) => continents.flatMap(c => groups[c]);
const allAreas = Object.values(groups).flat();

const state = (regions: string[], opts: { quests?: string[]; levels?: Record<string, number> } = {}) => {
  const base = createFreshState();
  base.gameModeId = 'vanilla';
  base.unlocks.regions = regions;
  base.unlocks.quests = opts.quests ?? allQuests;
  base.unlocks.skills = Object.fromEntries(SKILLS_LIST.map(s => [s, 10]));
  base.unlocks.levels = { ...Object.fromEntries(SKILLS_LIST.map(s => [s, 99])), ...opts.levels };
  return base;
};
const curated = (item: string): ResourceSource[] =>
  (RESOURCE_MAP[item] ?? []).filter(s => !s.requirementsUnverified);
const rows = (item: string, name: string) => curated(item).filter(s => s.name === name);
/** Status of each curated row called `name` on `item`, in map order. */
const statuses = (item: string, name: string, s: ReturnType<typeof state>) =>
  calculateSupplyChain(item, s)!.sources
    .filter(r => r.source.name === name && !r.source.requirementsUnverified)
    .map(r => r.status);
const anyOpen = (item: string, name: string, s: ReturnType<typeof state>) =>
  statuses(item, name, s).some(st => st.isAvailable);

describe('seed nests (resource-a.d3[1])', () => {
  // Wiki 'Bird nest (seeds)': tree and fruit-tree seeds only (yew 27/1011,
  // magic 5/1011). 'Bird nest (Wyson)': ranarr, snapdragon, torstol 4/684.
  it.each(['Ranarr Seed', 'Snapdragon Seed', 'Torstol Seed'])('%s has no ordinary bird nest route', item => {
    expect(rows(item, 'Bird Nest')).toEqual([]);
    const fresh = createFreshState();
    fresh.gameModeId = 'vanilla';
    expect(anyOpen(item, 'Bird Nest', fresh)).toBe(false);
  });

  it.each(['Ranarr Seed', 'Snapdragon Seed', 'Torstol Seed'])('%s comes from Wyson nests behind the Giant Mole', item => {
    const [wyson] = rows(item, 'Bird Nest (Wyson)');
    expect(wyson).toMatchObject({ type: 'DROP', unlockId: 'Giant Mole', rarity: '4/684' });
    const fresh = createFreshState();
    fresh.gameModeId = 'vanilla';
    expect(anyOpen(item, 'Bird Nest (Wyson)', fresh)).toBe(false);
  });

  it.each([['Yew Seed', '27/1011'], ['Magic Seed', '5/1011']])('%s needs a bird nest first', (item, rarity) => {
    const [nest] = rows(item, 'Bird Nest');
    expect(nest).toMatchObject({ inputs: { 'Bird Nest': 1 }, rarity });
    const fresh = createFreshState();
    fresh.gameModeId = 'vanilla';
    expect(anyOpen(item, 'Bird Nest', fresh)).toBe(false);
  });
});

describe('aviansie (resource-a.d3[2])', () => {
  // Wiki 'God Wars Dungeon': aviansie live in the shared central chamber; the
  // 70-stat gates are for the generals' bases. Entry needs Troll Stronghold
  // progress. 'Aviansie': also in the Wilderness God Wars Dungeon.
  it.each(['Adamantite Bar', 'Runite Limbs'])('%s from aviansie is not blocked by Agility', item => {
    expect(rows(item, 'Aviansie').every(r => !r.skills?.Agility)).toBe(true);
    expect(anyOpen(item, 'Aviansie', state(allAreas, { levels: { Agility: 1 } }))).toBe(true);
  });

  it.each(['Adamantite Bar', 'Runite Limbs'])('%s from the main dungeon needs Troll Stronghold', item => {
    const s = state(areasOf('Asgarnia'), { quests: [] });
    expect(anyOpen(item, 'Aviansie', s)).toBe(false);
    expect(statuses(item, 'Aviansie', s).flatMap(st => st.missing)).toContain('Quest: Troll Stronghold');
    expect(anyOpen(item, 'Aviansie', state(areasOf('Asgarnia'), { quests: ['Troll Stronghold'] }))).toBe(true);
  });

  it.each(['Adamantite Bar', 'Runite Limbs'])('%s from the Wilderness dungeon needs no quest', item => {
    expect(anyOpen(item, 'Aviansie', state(areasOf('Wilderness'), { quests: [] }))).toBe(true);
  });
});

describe('dense essence (resource-a.d3[3])', () => {
  // Wiki 'Dense runestone': 38 Mining and 38 Crafting; the Kourend favour
  // requirement was removed on 10 January 2024. No quest.
  it('mines with 38 Mining and 38 Crafting and no quest', () => {
    const s = state(areasOf('Kourend & Kebos'), { quests: [], levels: { Mining: 38, Crafting: 38 } });
    const [st] = statuses('Dense Essence Block', 'Mining', s);
    expect(st.missing).toEqual([]);
    expect(st.isAvailable).toBe(true);
  });
});
