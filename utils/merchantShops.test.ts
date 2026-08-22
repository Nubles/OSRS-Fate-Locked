import { describe, it, expect } from 'vitest';
import { classifyShop } from './merchantShops';
import { MERCHANTS_LIST } from '../constants';

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
      ["Ian's Wilderness Cape Shop", 'Reward Shops'],
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
