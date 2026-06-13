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
      ['Fishing spot (small net, bait)', 'Fishing', 1],
      ['Fishing spot (barbarian)', 'Fishing', 48],
      ['Fishing spot (anglerfish)', 'Fishing', 82],
    ];
    for (const [name, skill, level] of cases) {
      const req = resourceReqFor(name);
      expect(req?.skill ?? null, name).toBe(skill);
      if (skill) expect(req!.level, name).toBe(level);
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
  const yew = resourceReqFor('Yew tree')!;
  it('requires both the tier upgrade AND the level', () => {
    expect(resourceUsable(yew, u({ Woodcutting: 0 }, { Woodcutting: 99 }))).toBe(false); // tier not bought
    expect(resourceUsable(yew, u({ Woodcutting: 6 }, { Woodcutting: 45 }))).toBe(false); // level too low
    expect(resourceUsable(yew, u({ Woodcutting: 7 }, { Woodcutting: 60 }))).toBe(true);
  });
  it('defaults a missing level to 1', () => {
    const tree = resourceReqFor('Tree')!;
    expect(resourceUsable(tree, u({ Woodcutting: 1 }, {}))).toBe(true);
  });
});
