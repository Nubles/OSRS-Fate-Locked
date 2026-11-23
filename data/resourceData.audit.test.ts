import { describe, expect, it } from 'vitest';
import { RESOURCE_MAP, RESOURCE_CATEGORIES, currentResourceName, type ResourceSource } from './resourceData';
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

  it('Wiki adamant dragon rows still borrow Dragon Slayer II from a curated row', () => {
    // The superior bones row was the only curated Adamant Dragon row; the
    // adamantite bar drop (2, always) now carries it.
    const wiki = (RESOURCE_MAP['Adamant Javelin Tips'] ?? []).find(s => s.name === 'Adamant Dragon');
    expect(wiki?.requirementsUnverified).toBe(true);
    expect(wiki?.quests).toEqual(['Dragon Slayer II']);
    expect(wiki?.regions).not.toEqual(['Any']);
  });

  it('places every curated adamant and rune dragon row in Lithkren', () => {
    // Both dragons live only in the Lithkren Vault (Dragon Slayer II).
    const rows = Object.values(RESOURCE_MAP).flat()
      .filter(s => !s.requirementsUnverified && (s.name === 'Rune Dragon' || s.name === 'Adamant Dragon'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.regions).toEqual(['Lithkren']);
      expect(row.quests).toEqual(['Dragon Slayer II']);
    }
    const wiki = (RESOURCE_MAP['Adamant Javelin Tips'] ?? []).find(s => s.name === 'Adamant Dragon');
    expect(wiki?.regions).toEqual(['Lithkren']);
  });

  // outputYield is the Wiki drop quantity; a range uses its low end.
  it.each([
    ['Flax', 'Zulrah', 1000],
    ['Raw Shark', 'Zulrah', 35],
    ['Pure Essence', 'Twisted Banshee', 65],
    ['Mithril Ore', 'Zalcano', 56],
    ['Adamantite Ore', 'Zalcano', 51],
    ['Runite Ore', 'Zalcano', 3],
    ['Steel Bar', 'Zalcano', 16],
    ['Manta Ray', 'Zulrah', 35],
    ['Manta Ray', 'Vorkath', 35],
    ['Dragonstone', 'Vorkath', 2],
    ['Antidote++', 'Zulrah', 10],
  ] as const)('%s from %s yields %d per drop', (item, monster, qty) => {
    expect(curated(item).find(s => s.name === monster)?.outputYield).toBe(qty);
  });

  it('counts the Zulrah Antidote++ drop in 4-dose bottles', () => {
    expect(curated('Antidote++').find(s => s.name === 'Zulrah')?.outputDoses).toBe(4);
  });

  it.each([
    ["Executioner's Axe Head", 'Vardorvis', '1/1088'],
    ['Eye of the Duke', 'Duke Sucellus', '1/720'],
    ['Leviathan Lure', 'The Leviathan', '1/768'],
    ["Siren's Staff", 'The Whisperer', '1/512'],
    ['Dragon Harpoon', 'Wyrm', '1/10000 (1/2000 on task)'],
    // Imps always drop fiendish ashes; regular ashes are 6/128.
    ['Ashes', 'Imp', '6/128'],
    // Unsired 1/100 x 62/128 per piece: 1/206 per kill (1/198 with the pet).
    ['Bludgeon Axon', 'Abyssal Sire', '1/206'],
    ['Bludgeon Claw', 'Abyssal Sire', '1/206'],
    ['Bludgeon Spine', 'Abyssal Sire', '1/206'],
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

// Sources the Wiki item and monster pages do not list for the item.
const has = (item: string, name: string, type?: ResourceSource['type']) =>
  curated(item).some(s => s.name === name && (!type || s.type === type));

describe('curated sources the game does not have', () => {
  it.each([
    ['Godsword Shard 1', 'Nex'], ['Godsword Shard 2', 'Nex'], ['Godsword Shard 3', 'Nex'],
    ['Nihil Shard', 'Tombs of Amascut'],
    ['Lava Scale', 'Vorkath'],
    ['Ancient Essence', 'Duke Sucellus'], ['Ancient Essence', 'The Leviathan'],
    ['Ancient Essence', 'The Whisperer'], ['Ancient Essence', 'Vardorvis'],
    ['Vial of Blood', 'Vyrewatch Sentinel'],
    ['Dragon Axe', 'Volcanic Mine'],
    ['Potato Cactus', 'Dust Devil'],
    ["Toad's Legs", 'Giant Frog'],
    ['Garlic', "Wydin's Food Store"],
    ['Coconut', 'Grand Tree Groceries'],
    ['Yew Seed', 'Master Farmer'],
    ['Guam Leaf', 'Master Farmer'], ['Marrentill', 'Master Farmer'], ['Tarromin', 'Master Farmer'],
  ] as const)('%s is not offered from %s', (item, name) => {
    expect(has(item, name)).toBe(false);
  });

  it("toad's legs have no Zanaris ground spawn", () => {
    expect(curated("Toad's Legs").some(s => s.type === 'SPAWN' && /Zanaris/.test(s.notes ?? ''))).toBe(false);
  });
});

describe('curated sources the game does have', () => {
  it.each([
    ['Nihil Shard', 'Nex', 'DROP'],
    ['Lava Scale', 'Lava Dragon', 'DROP'],
    ['Ancient Essence', 'Phantom Muspah', 'DROP'],
    ['Vial of Blood', 'Theatre of Blood', 'DROP'],
    ['Potato Cactus', 'Kalphite Queen', 'DROP'],
    ["Toad's Legs", 'Gnome', 'PICKPOCKET'],
    ['Garlic', 'Ardougne Spice Stall', 'SHOP'],
    ['Coconut', "Cobado's Groceries", 'SHOP'],
  ] as const)('%s comes from %s', (item, name, type) => {
    expect(has(item, name, type)).toBe(true);
  });

  it('gates ancient essence mining on 75 Mining and Secrets of the North', () => {
    const row = curated('Ancient Essence').find(s => s.type === 'SKILL');
    expect(row).toMatchObject({ skills: { Mining: 75 }, quests: ['Secrets of the North'] });
  });

  it('gates gnome pickpocketing for toad legs on 75 Thieving', () => {
    expect(curated("Toad's Legs").find(s => s.name === 'Gnome')?.skills).toEqual({ Thieving: 75 });
  });

  it('places the jangerberry spawn in Kandarin', () => {
    const spawn = curated('Jangerberries').find(s => s.type === 'SPAWN');
    expect(spawn?.regions).toEqual(['Kandarin']);
  });

  it('gates star flowers on 49 Farming and Fairytale II', () => {
    const [row] = curated('Star Flower');
    expect(row).toMatchObject({ skills: { Farming: 49 }, quests: ['Fairytale II - Cure a Queen'] });
  });

  // Wiki rows borrow region and skill data from the curated row of the same
  // name, so each of these needs one curated row on an item it really gives.
  it.each([
    ['Adamant Axe', 'Dust Devil', 'DROP'],
    ['Steel Arrow', 'Giant Frog', 'DROP'],
    ['Chocolate Dust', 'Grand Tree Groceries', 'SHOP'],
    ['Adamantite Bar', 'Adamant Dragon', 'DROP'],
    ['Cadantine', 'Greater Nechryael', 'DROP'],
    ['Manta Ray', 'Zulrah', 'DROP'],
    ['Manta Ray', 'Vorkath', 'DROP'],
    ['Dragonstone', 'Vorkath', 'DROP'],
    ['Antidote++', 'Zulrah', 'DROP'],
  ] as const)('keeps a %s template row for %s', (item, name, type) => {
    expect(has(item, name, type)).toBe(true);
  });
});

describe('metal shortswords (renamed in game on 3 November 2026)', () => {
  const metals = ['Bronze', 'Iron', 'Steel', 'Mithril', 'Adamant', 'Rune'];
  it.each(metals)('%s Shortsword replaces %s Sword', (metal) => {
    expect(RESOURCE_MAP[`${metal} Sword`]).toBeUndefined();
    expect(curated(`${metal} Shortsword`).length).toBeGreaterThan(0);
    expect(Object.values(RESOURCE_CATEGORIES).flat()).toContain(`${metal} Shortsword`);
    expect(currentResourceName(`${metal} Sword`)).toBe(`${metal} Shortsword`);
  });

  it('keeps the Wiki routes generated under the old names', () => {
    expect(RESOURCE_MAP['Steel Shortsword'].some(s => s.requirementsUnverified)).toBe(true);
  });

  it('leaves current names alone', () => {
    expect(currentResourceName('Dragon Sword')).toBe('Dragon Sword');
    expect(currentResourceName('constructor')).toBe('constructor');
    expect(currentResourceName('__proto__')).toBe('__proto__');
  });
});

// Hand-written DROP rows for monsters whose Wiki drop table has no such item
// (checked against the item and monster pages, November 2026).
describe('curated drops the monster does not have', () => {
  it.each([
    ["Snapdragon", "Nechryael"],
    ["Torstol", "Commander Zilyana"],
    ["Torstol", "Thermonuclear Smoke Devil"],
    ["Cadantine", "Gargoyle"],
    ["Dwarf Weed", "Gargoyle"],
    ["Lantadyme", "Zulrah"],
    ["Lantadyme", "Steel Dragon"],
    ["Prayer Potion", "Wyrm"],
    ["Saradomin Brew", "Giant Mole"],
    ["Wine of Zamorak", "Zamorak Warrior"],
    ["Eye of Newt", "Chaos Druid"],
    ["Magic Logs", "Zulrah"],
    ["Teak Plank", "Callisto"],
    ["Mahogany Plank", "Callisto"],
    ["Mahogany Plank", "Zulrah"],
    ["Black D'hide Body", "Magpie Impling"],
    ["Coal", "Gargoyle"],
    ["Adamantite Ore", "Aviansie"],
    ["Adamantite Ore", "Skeletal Wyvern"],
    ["Mithril Pickaxe", "Blue Dragon"],
    ["Adamant Pickaxe", "Wyrm"],
    ["Rune Pickaxe", "Chaos Elemental"],
    ["Gold Bar", "Spiritual Mage"],
    ["Adamantite Bar", "Rune Dragon"],
    ["Raw Sea Turtle", "Mithril Dragon"],
    ["Harpoon", "Wyrm"],
    ["Soul Rune", "Vorkath"],
    ["Rune Crossbow", "Deranged Archaeologist"],
    ["Rune Crossbow", "Iron Dragon"],
    // Deep pass, 23 Nov 2026.
    ["Toadflax", "Cave Horror"], // herb table stops at dwarf weed, no toadflax
    ["Cadantine", "Nechryael"], // greater nechryael and the nechryarch only
    ["Limpwurt Root", "Kurask"], // kurask drop limpwurt seeds now
    ["Blue Dragon Scale", "Blue Dragon"], // brutal blue dragons and Zaros rangers
    ["Runite Ore", "Wyrm"],
    ["Crushed Nest", "Callisto"], // removed 22 November 2018
    ["Ranging Potion", "Tarn Razorlor"], // Tarn has no drop table
    ["Uncut Dragonstone", "Zulrah"], // the rare drop table gives a cut dragonstone
    ["Uncut Dragonstone", "Vorkath"],
    ["Uncut Dragonstone", "Rune Dragon"],
    ["Raw Manta Ray", "Vorkath"], // both drop cooked manta rays
    ["Raw Manta Ray", "Zulrah"],
    ["Anti-venom", "Zulrah"], // Zulrah drops antidote++
  ] as const)('%s is not a drop from %s', (item, monster) => {
    expect(has(item, monster, 'DROP')).toBe(false);
  });

  it("keeps Sarachnis for red spiders' eggs, from the giant egg sac it drops", () => {
    expect(curated("Red Spiders' Eggs").find(s => s.name === 'Sarachnis')?.notes).toMatch(/giant egg sac/i);
  });

  // A Wiki row borrows region and unlock data from the curated row of the
  // same name, but a curated note describes one item and must not follow it.
  it.each([
    ['Red Dragonhide', 'Sarachnis', "Red Spiders' Eggs"],
    ['Big Bones', 'Giant Mole', 'Crushed Nest'],
  ] as const)('the Wiki %s row from %s does not show the %s note', (item, monster, from) => {
    const note = curated(from).find(s => s.name === monster)?.notes;
    expect(note).toBeTruthy();
    const wiki = (RESOURCE_MAP[item] ?? []).find(s => s.name === monster && s.requirementsUnverified);
    expect(wiki).toBeDefined();
    expect(wiki?.unlockId).toBe(monster);
    expect(wiki?.notes).not.toBe(note);
  });
});

describe('curated shops that do not sell the item', () => {
  it.each([
    ['Limestone', 'Stonemason'],
    ['Black Pickaxe', 'Pickaxe Shop'],
    ['Rune Pickaxe', "Lliann's Wares"],
    ['Blood Rune', 'Mage Arena Shop'],
    ['Soul Rune', 'Mage Arena Shop'],
    ['Rune Scimitar', "Daga's Scimitar Smithy"],
    ['Amulet of Power', 'Quartermaster'],
    // Davon has no stock of his own, so ironmen can only sell there.
    ['Amulet of Power', "Davon's Amulet Store"],
  ] as const)('%s is not sold by %s', (item, shop) => {
    expect(has(item, shop, 'SHOP')).toBe(false);
  });

  it.each([
    ['Limestone', 'Razmire Builders Merchants', ['Morytania']],
    ['Rune Pickaxe', "Gwyn's Mining Emporium", ['Tirannwn']],
  ] as const)('%s is sold by %s', (item, shop, regions) => {
    expect(curated(item).find(s => s.type === 'SHOP' && s.name === shop)?.regions).toEqual(regions);
  });

  it("gates Razmire Builders Merchants on Shades of Mort'ton", () => {
    expect(curated('Limestone').find(s => s.name === 'Razmire Builders Merchants')?.quests).toEqual(["Shades of Mort'ton"]);
  });

  it('keeps Mage Arena Shop nature runes', () => {
    expect(has('Nature Rune', 'Mage Arena Shop', 'SHOP')).toBe(true);
  });
});

describe('curated activity and spawn sources that do not give the item', () => {
  it.each([
    ['Toadflax', 'Brimstone Chest', 'MINIGAME'],
    ['Gold Bar', 'Zalcano', 'MINIGAME'],
    ['Raw Shark', 'Temple Trekking', 'MINIGAME'],
    ['Giant Seaweed', 'Ground Spawn', 'SPAWN'],
    ['Rune Pickaxe', 'Zalcano', 'MINIGAME'], // Zalcano's loot has no pickaxe
    ['Dragonstone', 'Crystal Chest', 'MINIGAME'], // the chest gives an uncut one
  ] as const)('%s does not come from %s', (item, name, type) => {
    expect(has(item, name, type)).toBe(false);
  });
});
