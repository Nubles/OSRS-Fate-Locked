import { describe, it, expect } from 'vitest';
import { classifyShop } from './merchantShops';
import { MERCHANTS_LIST } from '../constants';
import chunkContent from '../public/chunk-content.json';
import { STRATEGY_DATABASE } from '../data/requirements';
import { TableType } from '../types';

describe('classifyShop', () => {
  it('classifies real shop names into the right merchant categories', () => {
    const cases: [string, string][] = [
      ['Lumbridge General Store', 'General Stores'],
      ['Varrock General Store', 'General Stores'],
      ["Aaron's Archery Appendages.", 'Archery Shops'],
      ["Lowe's Archery Emporium", 'Archery Shops'],
      ['Varrock Swordshop', 'Sword Shops'],
      ["Zeke's Superior Scimitars.", 'Scimitar Shops'],
      ["Aubury's Rune Shop.", 'Magic Shops'],
      ["Scavvo's Rune Store", 'Chainbody Shops'],
      ["Bob's Brilliant Axes", 'Axe Shops'],
      ["Nurmof's Pickaxe Shop", 'Mining Shops'],
      ["Horvik's Armour Shop.", 'Platebody Shops'],
      ['The Blue Moon Inn', 'Bars & Inns'],
      ['The Sheared Ram', 'Bars & Inns'], // a Varrock pub — now matched by name
      ["Wydin's Food Store", 'Food Shops'],
      ['Gem Trader', 'Gem Shops'],
      ["Pelters' Veg Stall", 'Vegetable Shops'],
      ["Thessalia's Fine Clothes.", 'Clothes Shops'],
      ["Agelus' Farm Shop", 'Farming Shops'],
      ['Crossbow Shop', 'Crossbow Shops'],
      ["Harry's Fishing Shop.", 'Fishing Shops'],
      ['Kebab seller', 'Kebab Sellers'],
      // ── newly covered categories ──
      ['Slayer Equipment (shop)', 'Slayer Equipment'],
      ["Briget's Weapons", 'Weapon Shops'],
      ['Soul Wars Reward Shop', 'Reward Shops'],
      ["Ian's Wilderness Cape Shop", 'Clothes Shops'],
      ['Stonecutter Supplies', 'Stonemasons'],
      ['Razmire Builders Merchants', 'Real Estate Agents'],
      ["Ranael's Super Skirt Store", 'Plateskirt Shops'],
      ['Garden Centre', 'Farming Shops'],
      ["Rufus' Meat Emporium", 'Food Shops'],
      ["Aemad's Adventuring Supplies", 'General Stores'],
      ["Durrik's Goods", 'General Stores'],
      ["Gunslik's Assorted Items", 'General Stores'],
      ["Bob's Brilliant Axes", 'Axe Shops'],
    ];
    for (const [name, want] of cases) {
      expect(classifyShop(name), name).toBe(want ?? null);
    }
  });

  it('uses reviewed categories for misleading and non-descriptive shop names', () => {
    const cases: [string, string][] = [
      // Armour and equipment specialities.
      ['Armour Shop (Jatizso)', 'Chainbody Shops'],
      ['Armoury', 'Archery Shops'],
      ["Ava's Odds and Ends", 'Archery Shops'],
      ["Brian's Battleaxe Bazaar", 'Axe Shops'],
      ["Filamina's Wares", 'Staff Shops'],
      ["Happy Heroes' H'emporium", 'Weapon Shops'],
      ["Imia's Supplies", 'Hunter Shops'],
      ['Magic Guild Store (Runes and Staves)', 'Magic Shops'],
      ["Seddu's Adventurer's Store", 'Platelegs Shops'],
      ["Skulgrimen's Battle Gear", 'Helmet Shops'],
      ["Spike's Spikes", 'Mace Shops'],
      ["Valaine's Shop of Champions", 'Platebody Shops'],
      ['Warrior Guild Armoury', 'Weapon Shops'],
      // Ore sellers and mining suppliers are separate unlocks.
      ['Deepfin Point Ore Exchange', 'Ore Merchants'],
      ['Ore store', 'Ore Merchants'],
      ["Petrified Pete's Ore Shop", 'Ore Merchants'],
      ['Port Roberts Ore Stall', 'Ore Merchants'],
      ["Thirus Urkar's Fine Dynamite Store", 'Mining Shops'],
      // Names which previously overrode their actual stock or service.
      ['Bounty Hunter Store', 'Reward Shops'],
      ['Construction supplies', 'Sawmill Operators'],
      ['Forestry Shop', 'Reward Shops'],
      ["Honest Jimmy's House of Stuff", 'Reward Shops'],
      ['Shop of Distaste', 'Vegetable Shops'],
      ['The Shrimp and Parrot', 'Food Shops'],
      ["Worm Tounge's Wares", 'Reward Shops'],
      // Pubs with misleading names and clothing stores called reward shops.
      ['Garlic Cocktail Supply', 'Bars & Inns'],
      ["Myreque's Rest", 'Bars & Inns'],
      ['Stick Your Ore Inn', 'Bars & Inns'],
      ["Sunlight's Sanctum", 'Bars & Inns'],
      ['The Crypt', 'Bars & Inns'],
      ['The Deeper Lode', 'Bars & Inns'],
      ['The Flaming Arrow', 'Bars & Inns'],
      ["Ian's Wilderness Cape Shop", 'Clothes Shops'],
      ['Mythical Cape Store', 'Clothes Shops'],
      ["Trader Sven's Black-market Goods", 'Clothes Shops'],
      ["Yrsa's Accoutrements", 'Clothes Shops'],
      // Inventory-only sources still need a deterministic merchant gate.
      ["Culinaromancer's Chest#Full", 'Cooking Shops'],
      ["Fairy Fixit's Fairy Enchantment", 'Magic Shops'],
      ['Irksol (shop)', 'Gem Shops'],
      ["Iwan's Maces", 'Mace Shops'],
      ["Mairin's Market", 'Fishing Shops'],
      ["Miltog's Lamps", 'Candle Shops'],
      ['Mysterious Hallowed Goods', 'Reward Shops'],
      ["The Esoterican Arms", 'Bars & Inns'],
      ["Yarnio's Baked Goods", 'Food Shops'],
    ];
    for (const [name, want] of cases) {
      expect(classifyShop(name), name).toBe(want);
    }
  });

  it('normalizes punctuation, whitespace, case, and stock snapshot fragments', () => {
    expect(classifyShop("  SCAVVO'S RUNE STORE.  ")).toBe('Chainbody Shops');
    expect(classifyShop("Scavvo's Rune Store.#Stock")).toBe('Chainbody Shops');
    expect(classifyShop("Culinaromancer's Chest#Food")).toBe('Food Shops');
    expect(classifyShop("Culinaromancer's Chest#8 Subquests")).toBe('Cooking Shops');
    expect(classifyShop('Battle Runes#Post-miniquest')).toBe('Magic Shops');
    expect(classifyShop('Odd Shop')).toBeNull();
  });

  it('classifies every placed shop and inventory source into a real merchant category', () => {
    const placed = Object.values(chunkContent.chunks)
      .flatMap(entry => 's' in entry ? entry.s : []);
    const names = new Set<string>([
      ...placed,
      ...Object.keys(chunkContent.shopItems),
    ]);
    const valid = new Set(MERCHANTS_LIST);
    const invalid = [...names]
      .map(name => [name, classifyShop(name)] as const)
      .filter(([, category]) => category === null || !valid.has(category))
      .sort(([a], [b]) => a.localeCompare(b));

    expect(invalid).toEqual([]);
  });

  it('only splits a normalized shop name when its stock snapshot genuinely changes category', () => {
    const placed = Object.values(chunkContent.chunks)
      .flatMap(entry => 's' in entry ? entry.s : []);
    const names = new Set<string>([
      ...placed,
      ...Object.keys(chunkContent.shopItems),
    ]);
    const categoriesByBase = new Map<string, Set<string>>();

    for (const name of names) {
      const base = name.trim().toLowerCase().replace(/#.*$/, '').replace(/\.$/, '');
      const category = classifyShop(name);
      if (!category) continue;
      const categories = categoriesByBase.get(base) ?? new Set<string>();
      categories.add(category);
      categoriesByBase.set(base, categories);
    }

    const categorySplits = [...categoriesByBase]
      .filter(([, categories]) => categories.size > 1)
      .map(([base, categories]) => ({ base, categories: [...categories].sort() }))
      .sort((a, b) => a.base.localeCompare(b.base));

    expect(categorySplits).toEqual([
      {
        base: "culinaromancer's chest",
        categories: ['Cooking Shops', 'Food Shops'],
      },
    ]);
  });

  it('keeps bespoke merchant requirements aligned with the shared classifier', () => {
    const placed = Object.values(chunkContent.chunks)
      .flatMap(entry => 's' in entry ? entry.s : []);
    const names = new Set<string>([
      ...placed,
      ...Object.keys(chunkContent.shopItems),
    ]);
    const mismatches = [...names]
      .flatMap(name => {
        const requirement = STRATEGY_DATABASE[name];
        if (
          !requirement
          || requirement.category !== TableType.MERCHANTS
          || !MERCHANTS_LIST.includes(requirement.id)
        ) return [];
        const category = classifyShop(name);
        return category === requirement.id ? [] : [{ name, category, requirement: requirement.id }];
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    expect(mismatches).toEqual([]);
  });

  it('only ever returns categories the Merchants table actually has', () => {
    const valid = new Set(MERCHANTS_LIST);
    const probes = [
      'General Store', 'Archery Shop', 'Sword Shop', 'Magic Shop', 'Fishing Shop',
      'Pickaxe Shop', 'Axe Shop', 'Gem Stall', 'Herb Shop', 'Candle Shop',
      'Fur Trader', 'Hunter Shop', 'Farm Shop', 'Crafting Shop', 'Clothes Shop',
      'Cooking Shop', 'Food Shop', 'Vegetable Stall', 'Spice Shop', 'Wine Shop',
      'Kebab Shop', 'Silk Stall', 'Silver Stall', 'Jewellery Shop', 'Amulet Shop',
      'Crossbow Shop', 'Staff Shop', 'Mace Shop', 'Shield Shop', 'Helmet Shop',
      'Platebody Shop', 'Platelegs Shop', 'Plateskirt Shop', 'Chainbody Shop',
      'Scimitar Shop', 'The Rusty Anchor Inn', 'Dye Trader',
    ];
    for (const p of probes) {
      const got = classifyShop(p);
      if (got !== null) expect(valid.has(got), `${p} -> ${got}`).toBe(true);
    }
  });
});
