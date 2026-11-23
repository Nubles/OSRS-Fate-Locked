import { describe, expect, it } from 'vitest';
import { MINIGAMES_LIST, BOSSES_LIST, REGION_GROUPS } from '../data/items';
import { enrichResourceSource, RESOURCE_MAP } from '../data/resourceData';
import {
  UNLOCK_ALIAS, buildPlaceIndex, curatedRows, isClueSource, isQuestRewardSource, isSkillingSource,
  leagueRegions, makeUnlockResolver, pickDrops, rarityRank, shopLocationRegion, shopRegionOverride,
} from './sourceEnrichmentRules';

describe('enrichment unlock aliases', () => {
  // Wiki: the Monumental chest is the Theatre of Blood reward chest, and
  // extra supply crates come from Ignisia at Wintertodt.
  it.each([
    ['monumental chest', 'Theatre of Blood'],
    ['extra supply crate', 'Wintertodt'],
    ['reward cart', 'Wintertodt'],
    ['ancient chest', 'Chambers of Xeric'],
  ])('%s resolves to %s', (name, unlock) => {
    expect(UNLOCK_ALIAS[name]).toBe(unlock);
  });

  it('only names Tombs of Amascut for its own bosses', () => {
    const toa = Object.entries(UNLOCK_ALIAS).filter(([, u]) => u === 'Tombs of Amascut').map(([k]) => k).sort();
    expect(toa).toEqual(['akkha', 'ba-ba', 'kephri', 'zebak']);
  });
});

describe('leagueRegions', () => {
  it.each([
    ['Morytania', ['Morytania']],
    ['morytania', ['Morytania']],
    ['kourend', ['Kourend & Kebos']],
    ['Desert', ['Kharidian Desert']],
    ['asgarnia,wilderness', ['Asgarnia', 'Wilderness']],
    ['general,kourend,morytania', ['Kourend & Kebos', 'Morytania']],
    ['misthalin&fremennik', ['Misthalin', 'Fremennik']],
    ['fremennik,no', ['Fremennik']],
    [' Kandarin , tirannwn ', ['Kandarin', 'Tirannwn']],
    ['kandarin,kandarin', ['Kandarin']],
  ] as const)('maps %j to %j', (raw, regions) => {
    expect(leagueRegions(raw)).toEqual(regions);
  });

  it.each(['General', 'No', 'n/a,no', '', undefined, null, 3])('maps %j to no region', (raw) => {
    expect(leagueRegions(raw)).toEqual([]);
  });
});

describe('rarityRank (commonest first)', () => {
  // The generator keeps the six commonest drop sources. '21/128' was once
  // read as 1/128 and '4/128' or '8/100' not read at all, ranking them with
  // 1/2000 and behind 'Rare'.
  const order = (xs: string[]) => [...xs].sort((a, b) => rarityRank(a) - rarityRank(b));
  it('reads the whole fraction', () => {
    expect(rarityRank('21/128')).toBeLessThan(rarityRank('1/128'));
    expect(rarityRank('22/128')).toBeLessThan(rarityRank('21/128'));
    expect(rarityRank('4/128')).toBeLessThan(rarityRank('1/1,000'));
    expect(rarityRank('8/100')).toBeLessThan(rarityRank('1/128'));
    expect(rarityRank('1/1,000')).toBeLessThan(rarityRank('1/5,000'));
    expect(rarityRank('1/2,000')).toBe(rarityRank('1/2000'));
  });
  it('orders words and fractions on one scale', () => {
    expect(order(['Very rare', '1/128', 'Rare', 'Unknown', '10/128', 'Common', 'Always', '1/1'])).toEqual(
      ['Always', '1/1', '10/128', 'Common', '1/128', 'Rare', 'Very rare', 'Unknown']);
    expect(rarityRank('Varies')).toBeLessThan(rarityRank('Rare'));
    expect(rarityRank('Uncommon')).toBeLessThan(rarityRank('Varies'));
    expect(rarityRank('Once')).toBe(rarityRank('Unknown'));
    expect(rarityRank('1/1,000')).toBeLessThan(rarityRank('Once'));
  });
});

describe('skilling, clue and quest sources', () => {
  // Monsters named like a skilling node are combat drops and must be kept.
  it.each(['Tree Spirit', 'Rock Crab', 'Giant Rock Crab', 'Rock Lobster', 'Dagannoth Spawn'])('keeps the combat drops of %s', (name) => {
    expect(isSkillingSource(name, 'combat')).toBe(false);
  });
  it.each([['Rune Rocks', 'mining'], ['Magic Tree', 'woodcutting'], ['Herb Patch', 'farming'], ['Iron Ore Vein', undefined]] as const)(
    'drops the %s %s table', (name, type) => {
      expect(isSkillingSource(name, type)).toBe(true);
    });
  it('only files Treasure Trail caskets as clue sources', () => {
    expect(isClueSource('Reward Casket (hard)')).toBe(true);
    expect(isClueSource('Clue Scroll (elite)')).toBe(true);
    expect(isClueSource('Casket (Reward Pool)')).toBe(false);
    expect(isClueSource("Casket (Pirate's Treasure)")).toBe(false);
  });
  it("leaves out the one-time Pirate's Treasure casket", () => {
    expect(isQuestRewardSource("Casket (Pirate's Treasure)")).toBe(true);
    expect(isQuestRewardSource('Casket (Reward Pool)')).toBe(false);
  });
});

describe('activity unlocks on reward rows', () => {
  const resolve = makeUnlockResolver([...BOSSES_LIST, ...MINIGAMES_LIST]);
  // Wiki: reward pool and its caskets after Tempoross; hallowed sacks hold
  // Sepulchre coffin loot; the Shade Catacombs chests; Temple Trekking tokens.
  it.each([
    ['Reward Pool', 'Tempoross'],
    ['Casket (Reward Pool)', 'Tempoross'],
    ['Hallowed Sack', 'Hallowed Sepulchre'],
    ['Grand Hallowed Coffin', 'Hallowed Sepulchre'],
    ['Coffin (Hallowed Sepulchre)', 'Hallowed Sepulchre'],
    ['Steel Chest (red)', "Shades of Mort'ton"],
    ['Gold Chest (crimson)', "Shades of Mort'ton"],
    ['Bronze Chest (brown)', "Shades of Mort'ton"],
    ['Reward Token', 'Temple Trekking'],
    ['Monumental Chest', 'Theatre of Blood'],
    ['Tempoross', 'Tempoross'],
  ])('%s unlocks with %s', (name, unlock) => {
    expect(resolve(name)).toBe(unlock);
    expect([...BOSSES_LIST, ...MINIGAMES_LIST]).toContain(unlock);
  });
  it('leaves plain monsters alone', () => {
    expect(resolve('Hobgoblin')).toBeUndefined();
    expect(resolve('Chest (Gold)')).toBeUndefined();
  });
});

describe('curatedRows', () => {
  // Wiki rows merged in under an old item name ('Steel Sword') once counted
  // as hand-written, so the generator skipped the shops they named.
  it('keeps only the hand-written rows of a merged entry', () => {
    const wiki = enrichResourceSource({ type: 'SHOP', name: 'Varrock Swordshop', regions: ['Misthalin'] });
    const merged = [...RESOURCE_MAP['Steel Shortsword'].filter((s) => !s.requirementsUnverified), wiki, wiki];
    expect(curatedRows(merged)).toEqual(merged.slice(0, -2));
    expect(curatedRows(RESOURCE_MAP['Steel Shortsword']).some((s) => s.name === 'Varrock Swordshop')).toBe(false);
    expect(curatedRows(RESOURCE_MAP['Steel Shortsword']).length).toBeGreaterThan(0);
  });
});

describe('shop regions', () => {
  const places = buildPlaceIndex([
    ...Object.entries(REGION_GROUPS).flatMap(([region, ps]) => ps.map((p) => [p, region] as const)),
    ['Lumbridge', 'Misthalin'],
    ["Champions' Guild", 'Misthalin'],
    ["Wizards' Guild", 'Kandarin'],
  ]);
  // Wiki infobox_shop locations.
  it.each([
    ['[[Blast Furnace]] in [[Keldagrim]]', 'Fremennik'],
    ['[[Shilo Village (location)|Shilo Village]]', 'Karamja'],
    ["[[Champions' Guild]]", 'Misthalin'],
    ["[[Wizards' Guild]]", 'Kandarin'],
    ['[[Lumbridge Castle]] basement', 'Misthalin'],
    ['[[Mor Ul Rek]]', 'Karamja'],
    ['[[Mistrock]]', 'Varlamore'],
    ['[[Tyras Camp]]', 'Tirannwn'],
  ])('%s is in %s', (location, region) => {
    expect(shopLocationRegion(location, places)).toBe(region);
  });
  it('names no region for an unknown place', () => {
    expect(shopLocationRegion('[[Nowhere]] in [[Elsewhere Land]]', places)).toBeUndefined();
  });
  it('overrides by the Wiki seller name in any case', () => {
    expect(shopRegionOverride('Mistrock Mining Supplies')).toBe('Varlamore');
    expect(shopRegionOverride("tzhaar-mej-roh's rune store")).toBe('Karamja');
    expect(shopRegionOverride('Mistrock')).toBeUndefined();
  });
});

describe('pickDrops', () => {
  const resolve = makeUnlockResolver([...BOSSES_LIST, ...MINIGAMES_LIST]);
  const d = (monster: string, rarity: string, isClue = false) => ({ monster, rarity, isClue, regions: [] });
  it('keeps the commonest sources, one row each, and skips hand-written ones', () => {
    // Wiki 'Limpwurt root': Hobgoblin 21/128 and 22/128 were left out for 1/128 rows.
    const drops = [d('Cave Bug', '1/128'), d('Hobgoblin', '21/128'), d('Hobgoblin', '22/128'), d('Hill Giant', '11/128'),
      d('Zombie', '1/512'), d('Imp', '1/1,000'), d('Chaos Druid', '4/128'), d('Ogre', '8/100'), d('Moss Giant', 'Uncommon')];
    const picked = pickDrops(drops, new Set(['hill giant']), resolve);
    expect(picked.map((x) => `${x.monster} ${x.rarity}`)).toEqual(
      ['Hobgoblin 22/128', 'Ogre 8/100', 'Chaos Druid 4/128', 'Moss Giant Uncommon', 'Cave Bug 1/128', 'Zombie 1/512']);
  });
  it("lists one Shade Catacombs chest, not one per colour", () => {
    const drops = ['red', 'brown', 'crimson', 'black', 'purple'].map((c) => d(`Bronze Chest (${c})`, '4/98.56'));
    const picked = pickDrops([...drops, d('Rusty Sword', '6/100'), d('White Knight', '1/128')], new Set(), resolve);
    expect(picked.map((x) => x.monster)).toEqual(['Rusty Sword', 'Bronze Chest (red)', 'White Knight']);
  });
});
