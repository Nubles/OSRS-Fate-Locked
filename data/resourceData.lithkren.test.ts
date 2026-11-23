import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { QUEST_DATA } from './questData';
import { REGION_GROUPS, SKILLS_LIST } from './items';
import { calculateSupplyChain } from '../utils/supplyChain';

// Adamant and rune dragons live only in the Lithkren Vault. In Vanilla their
// drops must open with the Lithkren area, not with Kandarin or Fremennik.
const allQuests = Object.values(QUEST_DATA as Record<string, { name: string }>).map(q => q.name);
const state = (regions: string[]) => {
  const base = createFreshState();
  base.gameModeId = 'vanilla';
  base.unlocks.regions = regions;
  base.unlocks.quests = allQuests;
  base.unlocks.skills = Object.fromEntries(SKILLS_LIST.map(s => [s, 10]));
  base.unlocks.levels = Object.fromEntries(SKILLS_LIST.map(s => [s, 99]));
  return base;
};
const dragonRow = (item: string, monster: string, regions: string[]) =>
  calculateSupplyChain(item, state(regions))!.sources.find(r => r.source.name === monster && !r.source.requirementsUnverified)!;

describe('Lithkren Vault dragon drops (Vanilla)', () => {
  const cases = [
    ['Adamantite Bar', 'Adamant Dragon'],
    ['Rune Bar', 'Rune Dragon'],
    ['Runite Ore', 'Rune Dragon'],
    ['Dragonstone', 'Rune Dragon'],
  ] as const;

  it.each(cases)('%s from %s opens with Lithkren alone', (item, monster) => {
    const row = dragonRow(item, monster, ['Lithkren']);
    expect(row.status.missing).toEqual([]);
    expect(row.status.isAvailable).toBe(true);
  });

  it.each(cases)('%s from %s stays shut with only Kandarin and Fremennik areas', (item, monster) => {
    const groups = REGION_GROUPS as Record<string, string[]>;
    const row = dragonRow(item, monster, [...groups['Kandarin'], ...groups['Fremennik']]);
    expect(row.status.isAvailable).toBe(false);
  });
});
