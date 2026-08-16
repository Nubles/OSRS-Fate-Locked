import { describe, it, expect } from 'vitest';
import { resourceReqFor, resourceUsable } from './chunkResources';
import type { UnlockState } from '../types';

const u = (skills: Record<string, number>, levels: Record<string, number>): UnlockState =>
  ({ skills, levels } as unknown as UnlockState);

describe('resourceReqFor', () => {
  it('maps real chunk-object names to the right skill + level', () => {
    const cases: [string, string | null, number][] = [
      ['Oak tree', 'Woodcutting', 15],
      ['Willow tree', 'Woodcutting', 30],
      ['Yew tree', 'Woodcutting', 60],
      ['Magic tree', 'Woodcutting', 75],
      ['Evergreen tree', 'Woodcutting', 1],
      ['Dead tree', 'Woodcutting', 1],
      ['Iron rocks', 'Mining', 15],
      ['Coal rocks', 'Mining', 30],
      ['Runite rocks', 'Mining', 85],
      ['Amethyst crystals', 'Mining', 92],
      ['Sunstone rocks', 'Mining', 53],
      ['Sunstone monolith', 'Mining', 53],
      ['Fishing spot (small net, bait)', 'Fishing', 1],
      ['Fishing spot (barbarian)', 'Fishing', 48],
      ['Fishing spot (anglerfish)', 'Fishing', 82],
      ['Silk stall', 'Thieving', 20],
      ['Gem stall', 'Thieving', 75],
      ['Nickel rocks', 'Mining', 74],
      ['Volcanic sulphur rock', 'Mining', 42],
      ['Lead rocks', 'Mining', 25],
      ['Blood Altar (Kourend)', 'Runecraft', 77],
      ['Soul Altar', 'Runecraft', 90],
      ['Astral Altar', 'Runecraft', 40],
      ['Dark Altar', 'Runecraft', 1],
      ['Mysterious ruins', 'Runecraft', 1],
    ];
    for (const [name, skill, level] of cases) {
      const req = resourceReqFor(name);
      expect(req?.skill ?? null, name).toBe(skill);
      if (skill) expect(req!.level, name).toBe(level);
    }
  });

  it('excludes Prayer altars and travel portals from Runecrafting', () => {
    for (const name of ['Chaos altar (Prayer)', 'Altar of Guthix', 'Altar of Zamorak', 'Exposed altar', 'Saradomin Portal', 'Portal of Cadarn']) {
      expect(resourceReqFor(name), name).toBeNull();
    }
  });

  it('leaves inert scenery, stations and transport nodes ungated', () => {
    for (const name of ['Bank booth', 'Anvil', 'Furnace', 'Cooking range', 'Altar',
      'Rocks', 'Rock', 'Loose rocks', 'Rocky handholds', 'Spirit tree', 'Magic Mushtree']) {
      expect(resourceReqFor(name), name).toBeNull();
    }
  });

  it('most-specific rule wins (ore before bare rock, magic before tree)', () => {
    expect(resourceReqFor('Coal rocks')!.level).toBe(30);
    expect(resourceReqFor('Magic tree')!.level).toBe(75);
  });
});

describe('resourceUsable', () => {
  const yew = resourceReqFor('Yew tree')!; // level 60 → needs tier 6 (cap model)

  it('locks a node when the TIER does not reach the level, even at 99', () => {
    // The headline case: 99 Woodcutting but only tier 3 unlocked → no yews.
    expect(resourceUsable(yew, u({ Woodcutting: 3 }, { Woodcutting: 99 }))).toBe(false);
  });

  it('unlocks once the tier reaches the level (tier 6 for a 60 node)', () => {
    expect(resourceUsable(yew, u({ Woodcutting: 5 }, { Woodcutting: 99 }))).toBe(false); // tier 5 caps at 50
    expect(resourceUsable(yew, u({ Woodcutting: 6 }, { Woodcutting: 60 }))).toBe(true);
  });

  it('still requires the current level, not just the tier', () => {
    expect(resourceUsable(yew, u({ Woodcutting: 10 }, { Woodcutting: 55 }))).toBe(false); // tier ok, level too low
  });

  it('defaults a missing level to 1', () => {
    const tree = resourceReqFor('Tree')!; // level 1 → tier 1
    expect(resourceUsable(tree, u({ Woodcutting: 1 }, {}))).toBe(true);
  });
});
