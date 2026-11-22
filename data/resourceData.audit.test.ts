import { describe, expect, it } from 'vitest';
import { RESOURCE_MAP, RESOURCE_CATEGORIES, type ResourceSource } from './resourceData';
import { STRATEGY_DATABASE } from './requirements';

// Reviewed OSRS Wiki facts from the November 2026 resource audit. Each row
// pins a hand-written RESOURCE_MAP source that once disagreed with the Wiki.
// Wiki enrichment rows (requirementsUnverified) are left out on purpose: they
// are generated and have their own checks.
const curated = (item: string): ResourceSource[] =>
  (RESOURCE_MAP[item] ?? []).filter(s => !s.requirementsUnverified);
const curatedNames = (item: string) => curated(item).map(s => s.name);

describe('reviewed recipe levels', () => {
  it.each([
    // Toxic blowpipe: 78 Fletching since 8 May 2024 (was 53).
    ['Toxic Blowpipe', { Fletching: 78 }],
    // Smouldering stone recipes: each tool uses its own two skills.
    ['Infernal Pickaxe', { Mining: 61, Smithing: 85 }],
    ['Infernal Axe', { Woodcutting: 61, Firemaking: 85 }],
    ['Infernal Harpoon', { Fishing: 75, Cooking: 85 }],
    ['Bronze Arrowtips', { Smithing: 5 }],
    ['Maple Shield', { Fletching: 57 }],
    ['Yew Shield', { Fletching: 72 }],
  ] as const)('%s needs exactly %o', (item, skills) => {
    const recipes = curated(item).filter(s => s.type === 'SKILL');
    expect(recipes).toHaveLength(1);
    expect(recipes[0].skills).toEqual(skills);
  });

  it('names the blowpipe recipe after the skill it uses', () => {
    expect(curated('Toxic Blowpipe')[0].name).toBe('Fletching');
  });
});

describe('reviewed drop sources', () => {
  it('superior dragon bones come only from Vorkath among curated rows', () => {
    // Adamant and rune dragons lost the superior bones roll on 25 Jan 2018.
    expect(curatedNames('Superior Dragon Bones')).toEqual(['Vorkath']);
  });

  it.each([
    ["Executioner's Axe Head", 'Vardorvis', '1/1088'],
    ['Eye of the Duke', 'Duke Sucellus', '1/720'],
    ['Leviathan Lure', 'The Leviathan', '1/768'],
    ["Siren's Staff", 'The Whisperer', '1/512'],
    ['Dragon Harpoon', 'Wyrm', '1/10000 (1/2000 on task)'],
  ] as const)('%s from %s is %s', (item, monster, rarity) => {
    const row = curated(item).find(s => s.name === monster);
    expect(row?.rarity).toBe(rarity);
  });

  it('describes the KBD dragon pickaxe at its current 1/1,000 rate', () => {
    expect(STRATEGY_DATABASE['Dragon Pickaxe (KBD)'].description).toBe('1/1,000 drop from King Black Dragon.');
  });
});

describe('reviewed Treasure Trail rewards', () => {
  it.each([
    ['Ranger Boots', 'Clue Scroll (Medium)', '1/1133'],
    ['Holy Sandals', 'Clue Scroll (Medium)', '1/1133'],
    ['Robin Hood Hat', 'Clue Scroll (Hard)', '1/1625'],
  ] as const)('%s comes only from a %s at %s', (item, clue, rarity) => {
    const rows = curated(item);
    expect(rows.map(s => [s.type, s.name, s.rarity])).toEqual([['CLUE', clue, rarity]]);
  });
});

describe('items that do not exist in the game', () => {
  it('has no Bar Mould', () => {
    expect(RESOURCE_MAP['Bar Mould']).toBeUndefined();
    expect(Object.values(RESOURCE_CATEGORIES).flat()).not.toContain('Bar Mould');
  });
});
