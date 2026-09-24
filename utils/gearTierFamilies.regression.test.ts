import { describe, expect, it } from 'vitest';
import { canonicalTierFromName } from './gearTiers';
import { TIER_LABELS } from './combatPower';

// Equivalence evidence and intentional Fate placements are recorded in
// docs/reviews/2026-09-23-equipment-catalogue-audit.md. OSRS itself has no Fate tiers.
const gods = ['Ancient', 'Armadyl', 'Bandos', 'Guthix', 'Saradomin', 'Zamorak'];
const elements = ['air', 'water', 'earth', 'fire'];
const combinations = ['lava', 'mud', 'steam', 'smoke', 'mist', 'dust'];
const groups: [string, number, string[]][] = [
  ['zero-bonus quest props and cosmetics', 1, ['Armadyl pendant', 'Robe of Elidinis (top)', 'Dark bow tie', 'Dragon necklace', 'Rune dragon mask', 'Rune staff of collection', 'Zenyte bracelet', 'Ring of 3rd Age', 'Masori assembler max hood', 'Trailblazer reloaded steel trophy', 'Collection log (rune)']],
  ['basic staves', 1, ['Staff', 'Magic staff', 'Staff of Bob the Cat', ...elements.map(e => `Staff of ${e}`)]],
  ['elemental battlestaves', 4, [...elements, ...combinations].flatMap(e => [`${e} battlestaff`, ...(e === 'lava' || e === 'steam' ? [`${e} battlestaff (or)`] : [])])],
  ['mystic staves', 4, [...elements, ...combinations].map(e => `Mystic ${e} staff`)],
  ['god rune armour', 5, gods.flatMap(g => ['full helm', 'platebody', 'platelegs', 'plateskirt', 'kiteshield'].map(p => `${g} ${p}`))],
  ['blessed dragonhide', 7, gods.flatMap(g => ["d'hide body", "d'hide boots", "d'hide shield", 'coif', 'chaps', 'bracers'].map(p => `${g} ${p}`))],
  ['god vestments', 3, gods.flatMap(g => ['robe top', 'robe legs', 'cloak', 'mitre', 'stole'].map(p => `${g} ${p}`))],
  ['god croziers', 4, gods.map(g => `${g} crozier`)],
  ['god halos and damaged books', 1, gods.flatMap(g => [`${g} halo`, `Damaged book (${g})`])],
  ['gilded dragonhide', 4, ["Gilded d'hide body", "Gilded d'hide chaps", "Gilded d'hide vambraces"]],
  ['rune reskins', 5, ['Gilded platebody', 'Gilded pickaxe', 'Dragonstone full helm', 'Dragonstone platebody', 'Dragonstone platelegs', 'Dragonstone boots', 'Rock-shell helm', 'Rock-shell plate', 'Rock-shell legs']],
  ['green ranged family', 4, ['Spined helm', 'Spined body', 'Spined chaps', 'Green spiky vambraces']],
  ['mystic reskins', 4, ['Enchanted hat', 'Enchanted top', 'Enchanted robe', 'Hood of darkness', 'Robe top of darkness', 'Robe bottom of darkness', 'Gloves of darkness', 'Boots of darkness']],
  ['Justiciar set', 9, ['Justiciar faceguard', 'Justiciar chestguard', 'Justiciar legguards']],
  ['Glory variants', 4, ['Amulet of glory', 'Amulet of glory (t)', 'Amulet of eternal glory']],
  ['Strength variants', 3, ['Amulet of strength', 'Strength amulet (t)']],
  ['Assembler variants', 7, ["Ava's assembler", 'Assembler max cape', 'Masori assembler', 'Masori assembler max cape']],
  ['endgame quivers', 9, ["Dizana's quiver", "Blessed Dizana's quiver", "Dizana's max cape"]],
  ['Infernal variants', 9, ['Infernal cape', 'Infernal max cape', 'Infernal max cape (l)']],
  ['god cape variants', 8, ['Saradomin cape', 'Saradomin max cape', 'Guthix max cape', 'Zamorak max cape', 'Imbued saradomin max cape']],
  ['accomplishment capes', 6, ['Attack cape', 'Attack cape (t)', 'Construct. cape', 'Runecraft cape', 'Sailing cape', 'Quest point cape', 'Max cape', 'Mythical cape', 'Mythical max cape', 'Ardougne max cape']],
  ['Oathplate cosmetics', 8, ['Oathplate helm', 'Radiant oathplate helm', 'Oathplate chest', 'Radiant oathplate chest', 'Oathplate legs', 'Radiant oathplate legs']],
  ['Slayer helmet cosmetics', 6, ['Slayer helmet', 'Black slayer helmet', 'Oathplate slayer helmet']],
  ['imbued Slayer helmet cosmetics', 7, ['Slayer helmet (i)', 'Oathplate slayer helmet (i)', 'Black mask (i)']],
  ['cosmetics and utility gear', 1, ['Black flowers', 'Black cape', 'Fremennik black cloak', 'Dragon candle dagger', 'Gilded spade', 'Anti-dragon shield', 'Blue wizard hat (g)', 'Black wizard robe (t)']],
  ['Obsidian family', 7, ['Obsidian cape', 'Cape of skulls', 'Tzhaar-ket-om']],
];

describe('reviewed equipment family consistency', () => {
  it('keeps slot upgrade labels aligned with the actual material tiers', () => {
    for (const metal of ['Bronze', 'Iron', 'Steel', 'Black', 'White', 'Mithril', 'Adamant', 'Rune', 'Dragon']) {
      const tier = canonicalTierFromName(`${metal} platebody`)!;
      expect(TIER_LABELS[tier - 1], metal).toContain(metal);
    }
  });
  it.each(groups)('%s follows one reviewed Fate placement', (_family, tier, names) => {
    for (const name of names) expect(canonicalTierFromName(name), name).toBe(tier);
  });

  it.each([['Steel', 2], ['Adamant', 4], ['Rune', 5]] as const)('%s heraldry cannot change its metal tier', (metal, tier) => {
    for (const crest of ['Dragon', 'Saradomin', 'Bandos', 'Guthix', 'Armadyl']) {
      for (const piece of ['heraldic helm', 'kiteshield']) {
        expect(canonicalTierFromName(`${metal} ${piece} (${crest})`)).toBe(tier);
      }
    }
  });

  it.each([['red', 2], ['white', 3], ['gold', 4]] as const)('Castle Wars %s melee set follows its metal equivalent', (colour, tier) => {
    for (const piece of ['platebody', 'platelegs', 'plateskirt']) {
      expect(canonicalTierFromName(`Decorative armour (${colour} ${piece})`)).toBe(tier);
    }
    for (const piece of ['full helm', 'helm', 'shield', 'boots', 'sword']) {
      expect(canonicalTierFromName(`Decorative ${piece} (${colour})`)).toBe(tier);
    }
  });

  it('keeps mechanic-based ranged families on a deliberate progression', () => {
    const ordered: [string, number][] = [['Chinchompa', 5], ['Red chinchompa', 6], ['Black chinchompa', 7], ['Swamp lizard', 3], ['Orange salamander', 4], ['Red salamander', 6], ['Black salamander', 7], ['Tecu salamander', 8]];
    for (const [name, tier] of ordered) expect(canonicalTierFromName(name), name).toBe(tier);
  });

  it('keeps tipped and enchanted ammunition in the underlying metal band', () => {
    const bolts: [string, number][] = [['Opal', 1], ['Jade', 1], ['Pearl', 1], ['Topaz', 2], ['Sapphire', 3], ['Emerald', 3], ['Ruby', 4], ['Diamond', 4], ['Dragonstone', 5], ['Onyx', 5]];
    for (const [gem, tier] of bolts) {
      for (const enchantment of ['', ' (e)']) {
        expect(canonicalTierFromName(`${gem} bolts${enchantment}`)).toBe(tier);
        expect(canonicalTierFromName(`${gem} dragon bolts${enchantment}`)).toBe(6);
      }
    }
    expect(canonicalTierFromName('Broad bolts')).toBe(4);
    expect(canonicalTierFromName('Amethyst broad bolts')).toBe(5);
    for (const type of ['arrow', 'fire arrow', 'dart', 'javelin']) {
      expect(canonicalTierFromName(`Amethyst ${type}`)).toBe(6);
    }
  });

  it('does not mistake unrelated names or partial equivalences for reviewed gear', () => {
    for (const name of ['Merfolk trident', 'Gilded coif', 'Dragonstone gauntlets', 'Rock-shell gloves', 'Spined boots', 'Decorative armour (magic top)']) {
      expect(canonicalTierFromName(name), name).toBeNull();
    }
    expect(canonicalTierFromName('Trident of the Seas')).toBe(8);
    expect(canonicalTierFromName('Trident of the Swamp (e)')).toBe(8);
    expect(canonicalTierFromName('Armadyl chestplate')).toBe(8);
    expect(canonicalTierFromName('Bandos boots')).toBe(8);
    expect(canonicalTierFromName('Mystic smoke staff')).toBe(4);
    expect(canonicalTierFromName('White magic staff')).toBe(2);
    expect(canonicalTierFromName('Lightbearer')).toBe(9);
    expect(canonicalTierFromName("Ahrim's robetop")).toBe(7);
  });
});
