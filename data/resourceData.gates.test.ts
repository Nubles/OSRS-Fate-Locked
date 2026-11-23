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

describe('Catacombs dragons (resource-a.d3[4])', () => {
  // Wiki 'Catacombs of Kourend': the Dragon's Den holds brutal red dragons
  // (no Slayer level) and brutal black dragons (77 Slayer); no black dragons.
  const kourend = areasOf('Kourend & Kebos');
  it('no Dragon Bones row puts black dragons in Kourend', () => {
    expect(rows('Dragon Bones', 'Black Dragon').some(r => r.regions.some(x => x.includes('Kourend')))).toBe(false);
  });
  it('brutal red dragons need no Slayer level', () => {
    expect(anyOpen('Dragon Bones', 'Brutal Red Dragon', state(kourend, { levels: { Slayer: 1 } }))).toBe(true);
  });
  it('brutal black dragons need 77 Slayer', () => {
    expect(anyOpen('Dragon Bones', 'Brutal Black Dragon', state(kourend, { levels: { Slayer: 76 } }))).toBe(false);
    expect(anyOpen('Dragon Bones', 'Brutal Black Dragon', state(kourend, { levels: { Slayer: 77 } }))).toBe(true);
  });
});

describe('uncut zenyte (resource-a.d3[6])', () => {
  // Wiki 'Uncut zenyte': fused at the wall of flame beneath the Temple of
  // Marimbo; needs Monkey Madness II and 70 Crafting.
  it('names the wall of flame and Monkey Madness II', () => {
    const [fuse] = curated('Uncut Zenyte').filter(r => r.inputs?.['Zenyte Shard']);
    expect(fuse.name).toBe('Wall of flame (Ape Atoll)');
    expect(fuse.quests).toEqual(['Monkey Madness II']);
    expect(fuse.skills).toEqual({ Crafting: 70 });
  });
});

describe('spawns behind a quest (resource-a.d4[1])', () => {
  // Wiki 'Black dragon': the only Tirannwn spawn is Mynydd (Song of the
  // Elves). 'Kurask': the only Tirannwn spawn is the Iorwerth Dungeon (Song of
  // the Elves). 'Gold rocks': the Tirannwn rocks are Mynydd and Trahaearn mine.
  // 'Baby blue dragon': the only Kandarin spawn is the Myths' Guild basement
  // (Dragon Slayer II).
  const tirannwn = areasOf('Tirannwn');
  const cases = [
    ['Black Dragonhide', 'Black Dragon'],
    ['Dragon Bones', 'Black Dragon'],
    ['Dwarf Weed', 'Kurask'],
    ['White Berries', 'Kurask'],
    ['Flax', 'Kurask'],
    ['Nature Rune', 'Kurask'],
    ['Leaf-Bladed Sword', 'Kurask'],
    ['Leaf-Bladed Battleaxe', 'Kurask'],
    ['Gold Ore', 'Mining Rocks'],
  ] as const;
  it.each(cases)('%s from %s in Tirannwn needs Song of the Elves', (item, name) => {
    expect(anyOpen(item, name, state(tirannwn, { quests: [] }))).toBe(false);
    expect(anyOpen(item, name, state(tirannwn, { quests: ['Song of the Elves'] }))).toBe(true);
  });

  it('baby blue dragons in Kandarin need Dragon Slayer II', () => {
    expect(anyOpen('Babydragon Bones', 'Baby Blue Dragon', state(areasOf('Kandarin'), { quests: [] }))).toBe(false);
    expect(anyOpen('Babydragon Bones', 'Baby Blue Dragon', state(areasOf('Kandarin'), { quests: ['Dragon Slayer II'] }))).toBe(true);
    expect(anyOpen('Babydragon Bones', 'Baby Blue Dragon', state(areasOf('Asgarnia'), { quests: [] }))).toBe(true);
  });
});

describe('altars and Plank Make need their quest (resource-a.d4[2])', () => {
  // Wiki 'Law Altar': 54 Runecraft and Troll Stronghold. 'Cosmic Altar': 27
  // Runecraft and Lost City. 'Plank Make': 86 Magic and Dream Mentor.
  const missingFor = (item: string, name: string, s: ReturnType<typeof state>, note?: string) =>
    calculateSupplyChain(item, s)!.sources
      .filter(r => r.source.name === name && !r.source.requirementsUnverified && (!note || r.source.notes?.includes(note)))
      .flatMap(r => r.status.missing);

  it('the Law Altar needs Troll Stronghold', () => {
    expect(missingFor('Law Rune', 'Runecraft Altar', state(areasOf('Asgarnia'), { quests: [] }), 'Entrana'))
      .toContain('Quest: Troll Stronghold');
  });
  it('the Cosmic Altar needs Lost City', () => {
    expect(missingFor('Cosmic Rune', 'Runecraft Altar', state([], { quests: [] }), 'Zanaris'))
      .toContain('Quest: Lost City');
  });
  it.each(['Oak Plank', 'Teak Plank', 'Mahogany Plank'])('Plank Make for %s needs Dream Mentor', item => {
    expect(missingFor(item, 'Plank Make', state(areasOf('Fremennik'), { quests: ['Lunar Diplomacy'] })))
      .toContain('Quest: Dream Mentor');
  });
});

describe('recipes behind a quest (resource-b.d1[0])', () => {
  // Wiki {{Recipe}} notes on each item page. 'Partial completion' is held as
  // the whole quest, like Superglass Make. Amulets keep their quest-free
  // Crafting route; only the String Jewellery (Magic 80) route is gated.
  const metals = ['Bronze', 'Iron', 'Steel', 'Mithril', 'Adamant', 'Rune'];
  const cases: [string, string, string][] = [
    ...metals.map(m => [`${m} Claws`, 'Anvil', 'Death Plateau'] as [string, string, string]),
    ...metals.map(m => [`${m} Dart Tip`, 'Anvil', 'The Tourist Trap'] as [string, string, string]),
    ...metals.map(m => [`${m} Keel Parts`, 'Anvil', 'Pandemonium'] as [string, string, string]),
    ['Iron Sheet', 'Metal Press', 'Swan Song'],
    ...['Emerald', 'Gold', 'Jade', 'Onyx', 'Opal', 'Ruby', 'Sapphire', 'Topaz']
      .map(g => [`${g} Amulet`, 'Magic', 'Lunar Diplomacy'] as [string, string, string]),
    ['Serum 207', 'Herblore', "Shades of Mort'ton"],
    ['Serum 208', 'Herblore', "Shades of Mort'ton"],
    ['Sacred Oil', 'Herblore', "Shades of Mort'ton"],
    ['Guthix Rest', 'Herblore', 'One Small Favour'],
    ['Goblin Potion', 'Herblore', 'Land of the Goblins'],
    ["Relicym's Balm", 'Herblore', 'Zogre Flesh Eaters'],
    ['Sanfew Serum', 'Herblore', 'Zogre Flesh Eaters'],
    ['Guthix Balance', 'Herblore', 'In Aid of the Myreque'],
    ['Super Antifire Potion', 'Herblore', 'Dragon Slayer II'],
    ['Extended Super Antifire', 'Herblore', 'Dragon Slayer II'],
    ['Anti-poison Supermix', 'Herblore', 'Barbarian Training'],
    ['Zamorakian Hasta', 'Otto Godblessed', 'Barbarian Training'],
  ];
  it.each(cases)('%s (%s) needs %s', (item, name, quest) => {
    expect(rows(item, name).length).toBeGreaterThan(0);
    const s = state(allAreas, { quests: allQuests.filter(q => q !== quest) });
    const routes = calculateSupplyChain(item, s)!.sources
      .filter(r => r.source.name === name && !r.source.requirementsUnverified);
    for (const r of routes) {
      expect(r.status.isAvailable).toBe(false);
      expect(r.status.missing).toContain(`Quest: ${quest}`);
    }
  });
  it('amulets keep the quest-free Crafting route', () => {
    expect(anyOpen('Emerald Amulet', 'Crafting', state(allAreas, { quests: [] }))).toBe(true);
  });
});

describe('gem rocks (resource-b.d2[0])', () => {
  // Wiki 'Gem rocks': mined at Shilo Village after Shilo Village, at the Lunar
  // Isle mine after Lunar Diplomacy, or on The Onyx Crest with 47 Sailing.
  const gems = ['Gem Rock', 'Uncut Jade', 'Uncut Opal', 'Uncut Red Topaz'];
  const noGemQuests = allQuests.filter(q => q !== 'Shilo Village' && q !== 'Lunar Diplomacy');
  it.each(gems)('%s needs Shilo Village or Lunar Diplomacy', item => {
    expect(anyOpen(item, 'Mining Rocks', state(areasOf('Karamja', 'Fremennik'), { quests: noGemQuests }))).toBe(false);
    expect(anyOpen(item, 'Mining Rocks', state(['Shilo Village'], { quests: ['Shilo Village'] }))).toBe(true);
    expect(anyOpen(item, 'Mining Rocks', state(['Lunar Isle'], { quests: ['Lunar Diplomacy'] }))).toBe(true);
  });
  it.each(gems)('%s can be mined on The Onyx Crest with 47 Sailing', item => {
    // Sailing itself needs Pandemonium.
    expect(anyOpen(item, 'Mining Rocks', state(['The Onyx Crest'], { quests: ['Pandemonium'] }))).toBe(true);
    expect(anyOpen(item, 'Mining Rocks', state(['The Onyx Crest'], { quests: ['Pandemonium'], levels: { Sailing: 46 } }))).toBe(false);
  });
});
