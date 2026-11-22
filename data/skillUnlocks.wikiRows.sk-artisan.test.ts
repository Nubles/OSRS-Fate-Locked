import { describe, expect, it } from 'vitest';
import { SKILL_UNLOCK_DATA } from './skillUnlocks';

// 22 Nov 2026: the artisan skill lists were filled from each skill's level-up table on the
// OSRS Wiki (Smithing, Fletching, Crafting, Herblore, Thieving, Hunter, Construction, Sailing).
// Each fragment names one added or extended line and must appear once in its skill, at the
// Wiki level and in that level's Fate tier.
const rowsFor = (skill: string) => Object.entries(SKILL_UNLOCK_DATA[skill])
  .flatMap(([tier, texts]) => texts.map(text => ({ tier: Number(tier), level: Number(text.match(/^Lvl (\d+):/)?.[1]), text })));

describe('artisan skill lists hold the Wiki level-up table rows', () => {
  it.each([
    ['Smithing', 'Bronze Shortsword/Nails/Wire/Darts', 4], ['Smithing', 'Bronze Scimitar/Arrows/C-balls/Spear/Hasta', 5],
    ['Smithing', 'Bronze Longsword/Limbs/Javelin Tips', 6], ['Smithing', "Blurite Bolts (The Knight's Sword)", 8],
    ['Smithing', 'Iron Med Helm/Bolts', 18], ['Smithing', 'Iron Scimitar/Spear/Hasta', 20],
    ['Smithing', 'Iron Longsword/Javelin Tips', 21], ['Smithing', 'Steel Med Helm/Bolts', 33],
    ['Smithing', 'Steel Scimitar/Arrows/C-balls/Spear/Hasta', 35], ['Smithing', 'Secateurs Attachments (Woodcutting 35)', 35],
    ['Smithing', 'Steel Longsword/Limbs/Javelin Tips/Studs', 36], ['Smithing', 'Mithril Med Helm/Bolts', 53],
    ['Smithing', 'Mithril Scimitar/Arrows/C-balls/Spear/Hasta', 55], ['Smithing', 'Shayzien T2 Gloves', 55],
    ['Smithing', 'Purging Staff (While Guthix Sleeps)', 55], ['Smithing', 'Mithril Longsword/Limbs/Keel/Javelin Tips', 56],
    ['Smithing', 'Shayzien T2 Boots', 57], ['Smithing', 'Mith Grapple Tips', 59], ['Smithing', 'Shayzien T2 Helm', 59],
    ['Smithing', 'Aquanite Hoppers', 60], ['Smithing', 'Confliction Gauntlets (Crafting 83)', 70],
    ['Smithing', 'Zombie Axe/Helm Repair', 70], ['Smithing', "Belle's Folly Repair (Sleeping Giants)", 70],
    ['Smithing', 'Noxious Halberd (Crafting 72)', 72], ['Smithing', 'Adamant Med Helm/Bolts', 73],
    ['Smithing', 'Adamant Shortsword/Keel/Darts/Nails', 74], ['Smithing', 'Emberlight (While Guthix Sleeps)', 74],
    ['Smithing', 'Adamant Scimitar/Arrows/C-balls/Spear/Hasta', 75], ['Smithing', 'Shayzien T4 Gloves', 75],
    ['Smithing', 'Sturdy Harnesses (Woodcutting 75)', 75], ['Smithing', 'Adamant Longsword/Limbs/Javelin Tips', 76],
    ['Smithing', 'Adamant Full Helm/Knives', 77], ['Smithing', 'Shayzien T4 Helm', 79],
    ['Smithing', 'Oathplate Armour (A Kingdom Divided)', 83], ['Smithing', 'Shayzien T5 Gloves', 85],
    ['Smithing', 'Shayzien T5 Boots', 87], ['Smithing', 'Rune Med Helm/Bolts', 88],
    ['Smithing', 'Rune Shortsword/Nails/Darts', 89], ['Smithing', 'Shayzien T5 Helm', 89],
    ['Smithing', 'Rune Scimitar/Arrows/C-balls/Spear/Hasta', 90], ['Smithing', 'Rune Longsword/Limbs/Javelin Tips', 91],
    ['Smithing', 'Shayzien T5 Greaves', 91], ['Smithing', 'Dragon Nails', 92], ['Smithing', 'Shayzien T5 Body', 93],
    ['Smithing', 'Dragon Keel', 94],
    ['Fletching', 'Javelin Shafts, Bronze Javelins', 3], ['Fletching', 'Bronze Brutal Arrows', 7],
    ['Fletching', 'Steel Brutal Arrows', 33], ['Fletching', 'Willow Shortbows/Totems', 35],
    ['Fletching', 'Black Brutal Arrows', 38], ['Fletching', 'Silver Bolts', 43],
    ['Fletching', 'Mithril Javelins', 47], ['Fletching', 'Mithril Brutal Arrows', 49],
    ['Fletching', 'Maple Shortbows/Totems', 50], ['Fletching', 'Barbed Bolts', 51],
    ['Fletching', 'Emerald Bolts', 58], ['Fletching', "Hunters' Spears", 60],
    ['Fletching', 'Adamant Javelins/Brutal Arrows', 62], ['Fletching', 'Yew Shortbows/Totems', 65],
    ['Fletching', 'Scorching Bows (While Guthix Sleeps)', 74], ['Fletching', 'Rune Javelins/Brutal Arrows', 77],
    ['Fletching', 'Magic Shortbows/Totems', 80], ['Fletching', 'Webweaver Bows', 85],
    ['Fletching', 'Ascension Bolts (Diamond, Onyx)', 86], ['Fletching', 'Redwood Totems/Hiking Staff', 90],
    ['Crafting', 'Candle Lanterns', 4], ['Crafting', 'Pie Dishes', 7], ['Crafting', 'Bowls', 8],
    ['Crafting', 'Leather Cowls', 9], ['Crafting', 'Leather Vambraces', 11], ['Crafting', 'Oil Lamps', 12],
    ['Crafting', 'Xerician Hats', 14], ['Crafting', 'Crab Armour (Freeing Pirate Pete)', 15],
    ['Crafting', 'Opal Necklaces', 16], ['Crafting', 'Xerician Robes', 17], ['Crafting', 'Silver Sickles', 18],
    ['Crafting', 'Magic Strings', 19], ['Crafting', 'Silver Bolts (Unf)', 21], ['Crafting', 'Xerician Tops', 22],
    ['Crafting', 'Sapphire Amulets', 24], ['Crafting', 'Willow Bird Houses', 25], ['Crafting', 'Drift Nets', 26],
    ['Crafting', 'Opal Amulets', 27], ['Crafting', 'Jade Bracelets', 29], ['Crafting', 'Emerald Amulets', 31],
    ['Crafting', 'Spiky Vambraces', 32], ['Crafting', 'Jade Amulets', 34], ['Crafting', 'Broodoo Shields', 35],
    ['Crafting', 'Baskets', 36], ['Crafting', 'Heraldic Helms', 38], ['Crafting', 'Ruby Necklaces', 40],
    ['Crafting', 'Studded Bodies', 41], ['Crafting', 'Empty Fishbowls', 42],
    ['Crafting', 'Yak-hide Legs (The Fremennik Isles)', 43], ['Crafting', 'Studded Chaps', 44],
    ['Crafting', 'Snakeskin Boots', 45], ['Crafting', 'Yak-hide Top (The Fremennik Isles)', 46],
    ['Crafting', 'Snakeskin Vambraces', 47], ['Crafting', 'Snakeskin Bandanas', 48],
    ['Crafting', 'Lantern Lenses', 49], ['Crafting', 'Snakeskin Chaps', 51], ['Crafting', 'Serpentine Helms', 52],
    ['Crafting', 'Snakeskin Bodies', 53], ['Crafting', 'Dragonstone Rings', 55],
    ['Crafting', 'Snakeskin Shields', 56], ['Crafting', 'Earth Battlestaves', 58],
    ['Crafting', 'Toxic Staff of the Dead, Trident of the Swamp', 59], ['Crafting', 'Splitbark Gauntlets/Boots', 60],
    ['Crafting', 'Splitbark Helms', 61], ['Crafting', "Fire Battlestaves, Green D'hide Shields", 62],
    ['Crafting', "Splitbark Legs/Body, Bryophyta's Staff", 62], ['Crafting', 'Repair Gloves of Silence', 64],
    ['Crafting', "Blue D'hide Chaps, Mixed Hide Capes", 68],
    ['Crafting', "Blue D'hide Shields, Mixed Hide Boots", 69],
    ['Crafting', 'Celestial Signet (Smithing 70; Song of the Elves)', 70], ['Crafting', 'Mixed Hide Legs', 71],
    ['Crafting', 'Noxious Halberd (Smithing 72)', 72],
    ['Crafting', 'Crystal Legs (Smithing 72; Song of the Elves)', 72],
    ['Crafting', 'Purging Staff (While Guthix Sleeps)', 74],
    ['Crafting', 'Crystal Body (Smithing 74; Song of the Elves)', 74], ['Crafting', 'Divine Rune Pouches', 75],
    ['Crafting', 'Hueycoatl Hide Coif/Vambraces', 76],
    ['Crafting', 'Crystal Tools (Smithing 76; Song of the Elves)', 76], ['Crafting', 'Hueycoatl Hide Chaps', 77],
    ['Crafting', 'Hueycoatl Hide Body', 78],
    ['Crafting', 'Crystal Bow/Halberd/Shield (Smithing 78; Song of the Elves)', 78],
    ['Crafting', "Black D'hide Vambraces", 79], ['Crafting', 'Ancient Rings (Magic 90)', 80],
    ['Crafting', 'Crystal Key/Teleport (Smithing 80; Song of the Elves)', 80], ['Crafting', 'Onyx Necklaces', 82],
    ['Crafting', 'Saeldor/Faerdhinen (Smithing 82; Song of the Elves)', 82],
    ['Crafting', 'Confliction Gauntlets (Smithing 70)', 83], ['Crafting', 'Onyx Bracelets', 84],
    ['Crafting', 'Accursed Sceptres', 85], ['Crafting', 'Amulet of Rancour', 86],
    ['Crafting', 'Fortified Masori Armour, Armadylean Plates', 90],
    ['Herblore', 'Compost Potion', 22], ['Herblore', 'Moonlight Potion (Perilous Moons)', 38],
    ['Herblore', 'Goading Potion', 54], ['Herblore', 'Mastering Mixology', 60],
    ['Herblore', 'Sanfew Serum (Zogre Flesh Eaters)', 65], ['Herblore', 'Surge Potion', 81],
    ['Herblore', 'Menaphite Remedy', 88],
    // @next-skill
  ] as const)('%s: %s appears once, at its Wiki level and tier', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.text.includes(name));
    expect(matches, `${skill}: ${name}`).toHaveLength(1);
    expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
  });

  it('keeps each artisan list sorted by level inside every tier', () => {
    for (const skill of ['Smithing', 'Fletching', 'Crafting', 'Herblore', 'Thieving', 'Hunter', 'Construction', 'Sailing']) {
      for (const texts of Object.values(SKILL_UNLOCK_DATA[skill])) {
        const levels = texts.map(text => Number(text.match(/^Lvl (\d+):/)?.[1])).filter(Number.isFinite);
        expect(levels, skill).toEqual([...levels].sort((a, b) => a - b));
      }
    }
  });
});
