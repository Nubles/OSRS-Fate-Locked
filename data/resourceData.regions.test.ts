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

describe('shop areas (resource-a.d1[4])', () => {
  const shops = { merchants: ['Fishing Shops', 'Herblore Shops', 'General Stores'] };

  it.each([
    ['Small Fishing Net', 'Fishing Shop', ['Asgarnia', 'Kandarin', 'Fremennik']],
    ['Fishing Rod', 'Fishing Shop', ['Asgarnia', 'Kandarin', 'Karamja', 'Fremennik']],
    ['Fly Fishing Rod', 'Fishing Shop', ['Asgarnia', 'Kandarin', 'Karamja', 'Fremennik']],
    ['Harpoon', 'Fishing Shop', ['Asgarnia', 'Kandarin', 'Fremennik']],
    ['Eye of Newt', 'Herblore Shop', ['Asgarnia', 'Kandarin']],
    ['Iron Ore', 'Ore Seller', ['Fremennik']],
    ['Cosmic Rune', "Ali's Discount Wares", ['Kharidian Desert']],
  ] as const)('%s <- %s sells only in %o', (item, shop, regions) => {
    expect(row(item, shop).regions).toEqual(regions);
  });

  it.each([
    ['Small Fishing Net', 'Fishing Shop'], ['Fishing Rod', 'Fishing Shop'],
    ['Fly Fishing Rod', 'Fishing Shop'], ['Eye of Newt', 'Herblore Shop'],
  ])('%s <- %s is not buyable on the free Misthalin start', (item, shop) => {
    expect(avail(item, shop, state([], shops))).toEqual([false]);
    expect(avail(item, shop, state(areasOf('Asgarnia'), shops))).toEqual([true]);
  });

  it('names the shops where they are', () => {
    expect(row('Harpoon', 'Fishing Shop').notes).toBe('Port Sarim / Catherby');
    expect(row('Eye of Newt', 'Herblore Shop').notes).toBe("Port Sarim / Taverley / Gu'Tanoth");
    expect(row('Cosmic Rune', "Ali's Discount Wares").notes).toBe('Al Kharid');
  });
});

describe('farming patch areas (resource-a.d2[5])', () => {
  const herb = ['Falador', 'Catherby', 'East Ardougne', 'Port Phasmatys', 'Hosidius', 'Farming Guild', 'Weiss', 'Harmony Island', 'Civitas illa Fortis'];
  it.each([
    ['Ranarr Weed', 'Herb Patch', herb],
    ['Snapdragon', 'Herb Patch', herb],
    ['Torstol', 'Herb Patch', herb],
    ['Snape Grass', 'Allotment Patch', ['Falador', 'Catherby', 'East Ardougne', 'Port Phasmatys', 'Hosidius', 'Farming Guild', 'Prifddinas', 'Harmony Island', 'Civitas illa Fortis']],
    ['Limpwurt Root', 'Flower Patch', ['Falador', 'Catherby', 'East Ardougne', 'Port Phasmatys', 'Hosidius', 'Farming Guild', 'Prifddinas', 'Civitas illa Fortis', 'Varlamore']],
    ['White Berries', 'Bush Patch', ['Misthalin', 'Rimmington', 'East Ardougne', 'Miscellania & Etceteria', 'Farming Guild']],
  ] as const)('%s <- %s lists the patch areas', (item, patch, regions) => {
    const r = curated(item).filter(s => s.name === patch && s.regions[0] !== 'Any');
    expect(r).toHaveLength(1);
    expect(r[0].regions).toEqual(regions);
  });

  it.each([
    ['Ranarr Weed', 'Herb Patch'], ['Snape Grass', 'Allotment Patch'], ['Limpwurt Root', 'Flower Patch'],
  ])('%s <- %s needs a patch area, not the free Misthalin start', (item, patch) => {
    const fresh = calculateSupplyChain(item, state([]))!.sources
      .filter(r => r.source.name === patch && !r.source.requirementsUnverified && r.source.regions[0] !== 'Any');
    expect(fresh.map(r => r.status.isAvailable)).toEqual([false]);
    const falador = calculateSupplyChain(item, state(['Falador']))!.sources
      .filter(r => r.source.name === patch && !r.source.requirementsUnverified && r.source.regions[0] !== 'Any');
    expect(falador.map(r => r.status.isAvailable)).toEqual([true]);
  });
});

describe('gathering areas (resource-a.d3[0])', () => {
  it.each(['Raw Lobster', 'Raw Tuna', 'Raw Swordfish', 'Raw Lava Eel', 'Maple Logs', 'Runite Ore'])(
    '%s cannot be gathered on the free Misthalin start', item => {
      const skill = curated(item).filter(s => s.type === 'SKILL');
      expect(skill).toHaveLength(1);
      expect(skill[0].regions).not.toContain('Misthalin');
      expect(avail(item, skill[0].name, state([]))).toEqual([false]);
    });

  it('keeps the free-to-play Wilderness cage and harpoon spot', () => {
    for (const item of ['Raw Lobster', 'Raw Tuna', 'Raw Swordfish']) {
      const skill = curated(item).find(s => s.type === 'SKILL')!;
      expect(skill.regions).toEqual(['Karamja', 'Kandarin', 'Wilderness', 'Kourend & Kebos', 'Fremennik', 'Tirannwn', 'Kharidian Desert', 'Varlamore', 'Islands & Others', 'The Open Seas']);
    }
  });

  it('lava eels are in Taverley Dungeon and the Lava Maze', () => {
    expect(row('Raw Lava Eel', 'Oily Rod Fishing').regions).toEqual(['Asgarnia', 'Wilderness']);
  });

  it('mithril and adamantite rocks are in Asgarnia and Misthalin too', () => {
    expect(avail('Mithril Ore', 'Mining Rocks', state([]))).toEqual([true]);
    expect(avail('Adamantite Ore', 'Mining Rocks', state(areasOf('Asgarnia')))).toEqual([true]);
    for (const item of ['Mithril Ore', 'Adamantite Ore']) {
      expect(row(item, 'Mining Rocks').regions).toEqual(expect.arrayContaining(['Asgarnia', 'Misthalin', 'Kandarin', 'Kharidian Desert', 'Morytania', 'Kourend & Kebos', 'Varlamore', 'Islands & Others', 'The Open Seas']));
    }
  });

  it('Kourend has magic trees but no teak trees', () => {
    const kourend = areasOf('Kourend & Kebos');
    expect(avail('Teak Logs', 'Woodcutting', state(kourend))).toEqual([false]);
    expect(avail('Magic Logs', 'Woodcutting', state(kourend))).toEqual([true]);
    expect(row('Magic Logs', 'Woodcutting').regions).not.toContain('Islands & Others');
  });

  it('drops areas with no clay rocks or fly fishing spots', () => {
    expect(row('Clay', 'Mining Rocks').regions).not.toEqual(expect.arrayContaining(['Karamja']));
    expect(row('Clay', 'Mining Rocks').regions).not.toContain('Wilderness');
    expect(row('Raw Trout', 'Fly Fishing').regions).not.toContain('Fremennik');
    expect(row('Raw Salmon', 'Fly Fishing').regions).not.toContain('Fremennik');
  });

  it('every gathering row names areas the tracker knows', () => {
    const known = new Set(['Any', 'Misthalin', ...Object.keys(groups), ...Object.values(groups).flat()]);
    for (const item of ['Teak Logs', 'Maple Logs', 'Magic Logs', 'Clay', 'Mithril Ore', 'Adamantite Ore', 'Runite Ore',
      'Raw Trout', 'Raw Salmon', 'Raw Tuna', 'Raw Lobster', 'Raw Swordfish', 'Raw Lava Eel']) {
      const skill = curated(item).find(s => s.type === 'SKILL')!;
      for (const r of skill.regions) expect(known.has(r), `${item}: ${r}`).toBe(true);
    }
  });
});

describe('needle spawns (resource-a.d3[5])', () => {
  it('has no needle spawn on the free Misthalin start', () => {
    expect(avail('Needle', 'Ground Spawn', state([]))).not.toContain(true);
    expect(avail('Needle', 'Ground Spawn', state(['Shayzien']))).toContain(true);
  });
});

describe('limestone and shrimps (resource-a.d4[3])', () => {
  it('limestone rocks are at the Silvarea and Arandar mines', () => {
    expect(row('Limestone', 'Mining Rocks').regions).toEqual(['Silvarea', 'Arandar']);
    expect(avail('Limestone', 'Mining Rocks', state([]))).toEqual([true]);
  });

  it('has no net fishing spot in Tirannwn', () => {
    expect(row('Raw Shrimps', 'Net Fishing').regions).not.toContain('Tirannwn');
  });
});

describe('kebbit teeth (resource-b.d2[2])', () => {
  it('sabre-toothed kebbits are in the Rellekka Hunter area', () => {
    expect(row('Kebbit Teeth', 'Hunter').regions).toEqual(['Rellekka']);
    expect(avail('Kebbit Teeth', 'Hunter', state(['Rellekka']))).toEqual([true]);
    expect(avail('Kebbit Teeth', 'Hunter', state(areasOf('Kandarin')))).toEqual([false]);
  });
});

describe('master farmers, cactus patches and dust devils (resource-b.d3[0])', () => {
  it('potato cactus grows in the Farming Guild', () => {
    expect(avail('Potato Cactus', 'Cactus Patch', state(['Farming Guild']))).toEqual([true]);
  });

  it.each(['Ranarr Seed', 'Snapdragon Seed', 'Torstol Seed'])('%s <- Master Farmer includes Kourend and Varlamore', item => {
    expect(row(item, 'Master Farmer').regions).toEqual(['Misthalin', 'Kandarin', 'Hosidius', 'Farming Guild', 'Varlamore']);
  });

  it('dust devils include the Wilderness Slayer Cave', () => {
    expect(row('Adamant Axe', 'Dust Devil').regions).toEqual(['Kharidian Desert', 'Kourend & Kebos', 'Wilderness']);
  });
});
