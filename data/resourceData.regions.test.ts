import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { QUEST_DATA } from './questData';
import { REGION_GROUPS, SKILLS_LIST } from './items';
import { RESOURCE_MAP, type ResourceSource } from './resourceData';
import { calculateSupplyChain } from '../utils/supplyChain';

// Hand-written RESOURCE_MAP rows whose areas once disagreed with the OSRS Wiki
// (November 2026 deep audit). Each block names the Wiki page it was read from.
// The availability checks run in Vanilla, where Misthalin is free from the start.
const allQuests = Object.values(QUEST_DATA as Record<string, { name: string }>).map(q => q.name);
const groups = REGION_GROUPS as Record<string, string[]>;
const areasOf = (...continents: string[]) => continents.flatMap(c => groups[c]);

const state = (regions: string[], opts: { quests?: string[]; merchants?: string[] } = {}) => {
  const base = createFreshState();
  base.gameModeId = 'vanilla';
  base.unlocks.regions = regions;
  base.unlocks.quests = opts.quests ?? allQuests;
  base.unlocks.merchants = opts.merchants ?? [];
  base.unlocks.skills = Object.fromEntries(SKILLS_LIST.map(s => [s, 10]));
  base.unlocks.levels = Object.fromEntries(SKILLS_LIST.map(s => [s, 99]));
  return base;
};
const curated = (item: string): ResourceSource[] =>
  (RESOURCE_MAP[item] ?? []).filter(s => !s.requirementsUnverified);
const rows = (item: string, name: string) => curated(item).filter(s => s.name === name);
const row = (item: string, name: string) => {
  const found = rows(item, name);
  expect(found, `${item} <- ${name}`).toHaveLength(1);
  return found[0];
};
/** Availability of the curated rows called `name` on `item` (one entry per row). */
const avail = (item: string, name: string, s: ReturnType<typeof state>) =>
  calculateSupplyChain(item, s)!.sources
    .filter(r => r.source.name === name && !r.source.requirementsUnverified)
    .map(r => r.status.isAvailable);

describe('monster and activity areas (resource-a.d1[3])', () => {
  it('dark fishing bait drops only in the Wilderness', () => {
    // Wiki Dark fishing bait / Ankou: only in the Forgotten Cemetery; Zombie (Wilderness).
    expect(row('Dark Fishing Bait', 'Ankou').regions).toEqual(['Wilderness']);
    expect(row('Dark Fishing Bait', 'Zombie (Wilderness)').regions).toEqual(['Wilderness']);
    expect(avail('Dark Fishing Bait', 'Ankou', state([]))).toEqual([false]);
    expect(avail('Dark Fishing Bait', 'Zombie (Wilderness)', state([]))).toEqual([false]);
  });

  it('cave horrors are in Morytania (Mos Le\'Harmless)', () => {
    expect(row('Black Mask', 'Cave Horror').regions).toEqual(['Morytania']);
    expect(avail('Black Mask', 'Cave Horror', state(areasOf('Morytania')))).toEqual([true]);
  });

  it('killerwatts are reached from Draynor Manor after Ernest the Chicken', () => {
    const r = row('Soda Ash', 'Killerwatt');
    expect(r.regions).toEqual(['Misthalin']);
    expect(r.quests).toEqual(['Ernest the Chicken']);
    expect(avail('Soda Ash', 'Killerwatt', state([]))).toEqual([true]);
    expect(avail('Soda Ash', 'Killerwatt', state([], { quests: [] }))).toEqual([false]);
  });

  it.each([
    ['Adamantite Bar', 'Aviansie'], ['Runite Limbs', 'Aviansie'],
    ['Soul Rune', 'Spiritual Mage'], ['Dragon Boots', 'Spiritual Mage'],
  ])('%s from %s is in the God Wars Dungeons', (item, monster) => {
    expect(row(item, monster).regions).toEqual(['Asgarnia', 'Wilderness']);
  });

  it('zamorak warriors are in the Ourania Cave', () => {
    const r = row('Rune Scimitar', 'Zamorak Warrior');
    expect(r.regions).toEqual(['Kandarin']);
    expect(r.notes).toBe('Ourania Cave');
  });

  it("Giants' Foundry is in the Kharidian Desert", () => {
    expect(row('Smithing Catalyst', "Giants' Foundry").regions).toEqual(['Kharidian Desert']);
  });

  it.each(['Pure Essence', 'Abyssal Whip'])('%s from abyssal demons: the Abyssal Area needs Fairytale II', item => {
    // Wiki Abyssal demon: Abyssal Area, Catacombs of Kourend, Slayer Tower, Wilderness Slayer Cave.
    // The tracker files the Abyssal Area (fairy ring ALR) under Misthalin, as data/requirements.ts does.
    expect(row(item, 'Abyssal Demon').regions).toEqual(['Morytania', 'Kourend & Kebos', 'Wilderness']);
    const alr = row(item, 'Abyssal Demon (Abyssal Area)');
    expect(alr.regions).toEqual(['Misthalin']);
    expect(alr.quests).toEqual(['Fairytale II - Cure a Queen']);
    const open = (s: ReturnType<typeof state>) => calculateSupplyChain(item, s)!.sources
      .filter(r => r.source.name.startsWith('Abyssal Demon') && !r.source.requirementsUnverified && r.status.isAvailable)
      .map(r => r.source.name);
    expect(open(state([], { quests: [] }))).toEqual([]);
    expect(open(state([], { quests: ['Fairytale II - Cure a Queen'] }))).toEqual(['Abyssal Demon (Abyssal Area)']);
    expect(open(state(areasOf('Wilderness'), { quests: [] }))).toEqual(['Abyssal Demon']);
  });
});
