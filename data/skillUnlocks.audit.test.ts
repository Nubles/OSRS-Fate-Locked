import { describe, expect, it } from 'vitest';
import { SKILL_UNLOCK_DATA } from './skillUnlocks';

// S01–S04: independently reviewed OSRS Wiki revisions and Jagex 12-Aug-2026
// patch notes, retained in the 22-Sep-2026 skill-reference audit.
const rowsFor = (skill: string) => Object.entries(SKILL_UNLOCK_DATA[skill])
  .flatMap(([tier, texts]) => texts.map(text => ({ tier: Number(tier), level: Number(text.match(/^Lvl (\d+):/)?.[1]), text })));

describe('reviewed skill-reference facts', () => {
  it.each([
    ['Agility', 'Hallowed Sepulchre (Floor 4)', 77],
    ['Agility', 'Hallowed Sepulchre (Floor 5)', 87],
    ['Attack', 'Mystic Staves', 40],
    ['Construction', 'Kitchen', 5],
    ['Construction', 'Combat Room', 32],
    ['Construction', 'Costume Room', 42],
    ['Construction', 'Spirit Tree (Farming 83)', 75],
    ['Cooking', 'Roasted Bird Meat', 11],
    ['Crafting', 'Hardleather Body', 28],
    ['Crafting', 'Amethyst Bolt Tips', 83],
    ['Crafting', 'Amethyst Arrowtips', 85],
    ['Crafting', 'Amethyst Javelin Tips', 87],
    ['Crafting', 'Amethyst Dart Tips', 89],
    ['Defence', 'Void Knight', 42],
    ['Fletching', 'Ogre Arrows', 5],
    ['Fletching', 'Redwood Shields', 92],
    ['Herblore', 'Divine Super Combat', 97],
    ['Magic', 'Blood Blitz', 80],
    ['Magic', 'Vengeance Other', 93],
    ['Ranged', '3rd Age Bow', 65],
    ['Sailing', 'Linen Trawling Net', 65],
    ['Sailing', 'Hemp Trawling Net', 76],
  ] as const)('%s: %s appears only at its reviewed level and tier', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.text.includes(name));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
  });

  it('names the Brimhaven level-40 obstacles and zenyte products accurately', () => {
    expect(SKILL_UNLOCK_DATA.Agility[4]).toContain('Lvl 40: Brimhaven Arena (High Obstacles)');
    expect(SKILL_UNLOCK_DATA.Crafting[10]).toContain('Lvl 92: Zenyte Necklace (Anguish)');
    expect(SKILL_UNLOCK_DATA.Crafting[10]).toContain('Lvl 98: Zenyte Amulet (Torture)');
  });

  it('keeps the valid neighbors when splitting different thresholds', () => {
    for (const [skill, name, level] of [
      ['Attack', 'Battlestaves', 30], ['Construction', 'Games Room', 30],
      ['Construction', 'Menagerie', 37], ['Construction', 'Study', 40],
      ['Construction', 'Gilded Altar', 75], ['Cooking', 'Trout', 15],
      ['Crafting', 'Coifs', 38], ['Defence', 'Fighter Torso', 40],
      ['Fletching', 'Shortbows, Ogre Arrows', 5], ['Herblore', 'Divine Super Attack', 70],
      ['Magic', 'Entangle', 79], ['Magic', 'Dream', 79], ['Magic', 'Blood Barrage', 92],
      ['Ranged', "Ava's Accumulator", 50], ['Ranged', 'Dragon Thrown', 60],
      ['Sailing', 'Advanced Chum Station', 68], ['Sailing', 'Dock Drumstick Isle', 79],
      ['Sailing', 'Gale Catcher', 79],
    ] as const) {
      expect(rowsFor(skill).some(row => row.level === level && row.text.includes(name)), `${skill}: ${name}`).toBe(true);
    }
  });

  it('does not attribute Iban staff to Ranged or fletching to the unfletchable ogre bow', () => {
    expect(rowsFor('Ranged').some(row => row.text.includes("Iban's Staff"))).toBe(false);
    expect(rowsFor('Attack').some(row => row.level === 50 && row.text.includes("Iban's Staff"))).toBe(true);
    expect(rowsFor('Magic').some(row => row.level === 50 && row.text.includes('Iban Blast'))).toBe(true);
    expect(rowsFor('Fletching').some(row => row.text.includes('Ogre Bows'))).toBe(false);
    expect(rowsFor('Construction').some(row => row.level === 37 && row.text.includes('Spirit Tree'))).toBe(false);
  });

  it('keeps numeric benefits inside their displayed Fate tier', () => {
    for (const skill of Object.keys(SKILL_UNLOCK_DATA)) {
      for (const row of rowsFor(skill).filter(row => Number.isFinite(row.level))) {
        expect(row.tier, `${skill}: ${row.text}`).toBe(Math.ceil(row.level / 10));
      }
    }
  });

  it('preserves the earlier cape fix and excludes unresolved audit candidates', () => {
    expect(SKILL_UNLOCK_DATA.Agility[10]).toContain('Lvl 99: Agility Cape (Graceful substitute; daily energy restore + 1-minute stamina)');
    expect(SKILL_UNLOCK_DATA.Slayer[4]).toContain('Lvl 35: Wall Beasts, Slayer Helmet');
    expect(SKILL_UNLOCK_DATA.Fletching[3]).toContain('Lvl 30: Steel Arrows, Composite Bows');
    expect(SKILL_UNLOCK_DATA.Thieving[3]).toContain('Lvl 30: The Feud (Blackjack)');
  });
});

// 9 Nov 2026 review: every list was read against its skill's level-up table on the
// OSRS Wiki. No listed level was wrong; these unlocks from Sailing (19 Nov 2025),
// The Blood Moon Rises (30 Jun 2026) and other updates were missing, and each was
// confirmed twice (the table, then the table again or the item's own page).
describe('unlocks added in the 9 November 2026 review', () => {
  it.each([
    ['Construction', 'Move to Taverley', 10], ['Construction', 'Move to Pollnivneach', 20], ['Construction', 'Move to Aldarin', 35],
    ['Cooking', 'Swordtip Squid', 56], ['Cooking', 'Giant Krill', 69], ['Cooking', 'Jumbo Squid', 71], ['Cooking', 'Haddock', 73],
    ['Cooking', 'Yellowfin', 79], ['Cooking', 'Halibut', 83], ['Cooking', 'Bluefin', 87], ['Cooking', 'Marlin', 91],
    ['Crafting', 'Bolts of Linen', 12], ['Crafting', 'Bolts of Canvas', 39], ['Crafting', 'Bolts of Cotton', 73],
    ['Farming', 'Elkhorn Coral', 28], ['Farming', 'Hemp', 37], ['Farming', 'Pillar Coral', 52], ['Farming', 'Huasca', 65],
    ['Farming', 'Camphor Trees', 66], ['Farming', 'Cotton', 71], ['Farming', 'Umbral Coral', 77], ['Farming', 'Ironwood Trees', 80],
    ['Farming', 'Rosewood Trees', 92],
    ['Firemaking', 'Rosewood Pyre Logs/Ship', 97],
    ['Fishing', 'Giant Krill, Jumbo Squid', 69], ['Fishing', 'Haddock', 73], ['Fishing', 'Leechfin', 78], ['Fishing', 'Yellowfin, Sea Turtles', 79],
    ['Fishing', 'Halibut', 83], ['Fishing', 'Bluefin', 87], ['Fishing', 'Marlin', 91],
    ['Fletching', 'Vale Totems', 20], ['Fletching', 'Camphor Blowpipe', 58], ['Fletching', 'Blisterwood Stakes', 70],
    ['Fletching', 'Ironwood Blowpipe, Moonlight Antler Bolts', 72], ['Fletching', 'Rosewood Blowpipe', 84],
    ['Herblore', 'Haemostatic Dressing', 56], ['Herblore', 'Super Fishing Potion', 62], ['Herblore', 'Extreme Energy', 66],
    ['Herblore', 'Super Hunter Potion', 67], ['Herblore', 'Armadyl Brew', 89],
    ['Hitpoints', 'Heal +15 HP with Anglerfish', 75], ['Hitpoints', 'Necklace of Rupture', 90],
    ['Hunter', 'Pyre Foxes', 57], ['Hunter', 'Letvek', 76], ['Hunter', 'Stymphikes', 82],
    ['Mining', 'Nickel Ore', 74],
    ['Ranged', 'Bronze Cannon (Sailing 28), Iron Cannon (Sailing 35)', 1], ['Ranged', 'Steel Cannon (Sailing 47)', 5],
    ['Ranged', 'Mithril Cannon (Sailing 57)', 20], ['Ranged', 'Adamant Cannon (Sailing 69)', 30], ['Ranged', 'Rune Cannon (Sailing 80)', 40],
    ['Ranged', 'Camphor Blowpipe', 45], ['Ranged', 'Ironwood Blowpipe', 55], ['Ranged', 'Dragon Cannon (Sailing 92)', 60],
    ['Ranged', 'Rosewood Blowpipe', 65],
    ['Runecraft', 'Mist Runes', 6], ['Runecraft', 'Aether Runes', 90],
    ['Slayer', 'Witchwood Icon', 35], ['Slayer', 'Vyrewatch', 38], ['Slayer', 'Master: Mortimer', 70], ['Slayer', 'Venators', 74],
    ['Smithing', 'Cupronickel Bars', 74],
    ['Woodcutting', 'Bloodwood Trees', 77],
  ] as const)('%s: %s is listed at its Wiki level', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.level === level && row.text.includes(name));
    expect(matches, `${skill}: ${name}`).toHaveLength(1);
    expect(matches[0].tier).toBe(Math.ceil(level / 10));
  });

  it('gives each ship cannon the Sailing level the Sailing list gives it', () => {
    for (const [metal, sailing] of [['Bronze', 28], ['Iron', 35], ['Steel', 47], ['Mithril', 57], ['Adamant', 69], ['Rune', 80], ['Dragon', 92]] as const) {
      expect(rowsFor('Sailing').some(row => row.level === sailing && row.text.includes(`${metal} Cannon`)), `${metal} Cannon in Sailing`).toBe(true);
      expect(rowsFor('Ranged').some(row => row.text.includes(`${metal} Cannon (Sailing ${sailing})`)), `${metal} Cannon in Ranged`).toBe(true);
    }
  });

  it('keeps the black mask on the cave horror row beside the witchwood icon they need', () => {
    expect(SKILL_UNLOCK_DATA.Slayer[6]).toContain('Lvl 58: Cave Horrors (Witchwood Icon), Black Mask');
  });

  it('lists all nine house locations at their Construction levels', () => {
    const moves = rowsFor('Construction').filter(row => row.text.includes('Move to')).map(row => [row.text.match(/Move to (\w+)/)?.[1], row.level]);
    expect(moves).toEqual([
      ['Rimmington', 1], ['Taverley', 10], ['Pollnivneach', 20], ['Hosidius', 25], ['Rellekka', 30],
      ['Aldarin', 35], ['Brimhaven', 40], ['Yanille', 50], ['Prifddinas', 70],
    ]);
  });
});
