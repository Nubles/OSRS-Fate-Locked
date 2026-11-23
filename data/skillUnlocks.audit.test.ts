import { describe, expect, it } from 'vitest';
import { SKILL_UNLOCK_DATA } from './skillUnlocks';
import { STRATEGY_DATABASE } from './requirements';

// S01–S04: independently reviewed OSRS Wiki revisions and Jagex 12-Aug-2026
// patch notes, retained in the 22-Sep-2026 skill-reference audit.
const rowsFor = (skill: string) => Object.entries(SKILL_UNLOCK_DATA[skill])
  .flatMap(([tier, texts]) => texts.map(text => ({ tier: Number(tier), level: Number(text.match(/^Lvl (\d+):/)?.[1]), text })));

describe('reviewed skill-reference facts', () => {
  it.each([
    ['Agility', 'Hallowed Sepulchre (Floor 4; Sins of the Father)', 77],
    ['Agility', 'Hallowed Sepulchre (Floor 5; Sins of the Father)', 87],
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
      ['Ranged', "Ava's Accumulator", 50], ['Ranged', 'Dragon Darts, Dragon Knives', 60],
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
    ['Fletching', 'Wasp Darts (The Birds and the Wasps)', 1], ['Fletching', 'Killer Wasp Darts', 15],
    ['Hunter', 'Honey Buzzards, Wasps', 1], ['Hunter', 'Killer Wasps', 12], ['Hunter', 'Black Honey Buzzards', 17],
    ['Hunter', 'Pyre Foxes', 57], ['Hunter', 'Letvek', 76], ['Hunter', 'Stymphikes', 82],
    ['Magic', 'Teleport to Boat', 67],
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

  // The Fractured Archive (20 Oct 2026): read from each skill's level-up table on 22 Nov 2026.
  it.each([
    ['Attack', 'Obligator', 85], ['Defence', 'Rondache', 80], ['Ranged', 'Ascension Crossbows', 80],
    ['Magic', "Zorya's Tome", 85], ['Prayer', 'Zeal (Attack 75, Strength 75, Defence 70; Horn of Bran)', 84],
    ['Mining', 'Ascension Shards (While Guthix Sleeps)', 80], ['Fletching', 'Ascension Bolts (Diamond, Onyx)', 86],
  ] as const)('%s: %s from The Fractured Archive is listed at its Wiki level', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.level === level && row.text.includes(name));
    expect(matches, `${skill}: ${name}`).toHaveLength(1);
    expect(matches[0].tier).toBe(Math.ceil(level / 10));
  });

  // The game renamed the metal swords to shortswords on 3 November 2026 (Wiki: Shortsword, Changes).
  it('uses the shortsword names for the smithed swords and the wyrm drop', () => {
    const oldName = /\b(Bronze|Iron|Steel|Black|White|Mithril|Adamant|Rune|Dragon) Sword\b/i;
    for (const skill of Object.keys(SKILL_UNLOCK_DATA)) {
      for (const row of rowsFor(skill)) expect(row.text, `${skill}: ${row.text}`).not.toMatch(oldName);
    }
    for (const [metal, level] of [['Bronze', 4], ['Iron', 19], ['Steel', 34], ['Mithril', 54], ['Adamant', 74], ['Rune', 89]] as const) {
      expect(rowsFor('Smithing').some(row => row.level === level && row.text.includes(`${metal} Shortsword`)), metal).toBe(true);
    }
    expect(STRATEGY_DATABASE.Wyrms.description).toBe('Source of Dragon Shortsword/Harpoon.');
  });

  it('names items as the Wiki titles them', () => {
    expect(SKILL_UNLOCK_DATA.Runecraft[8]).toContain('Lvl 77: 8 Air Runes, Blood Runes, Bloodbark Gauntlets/Boots');
    expect(SKILL_UNLOCK_DATA.Defence[1]).toContain('Lvl 10: Hard Leather Shield');
    expect(SKILL_UNLOCK_DATA.Attack[8]).toContain("Lvl 80: Ghrazi Rapier, Blade of Saeldor, Inquisitor's Mace");
    expect(SKILL_UNLOCK_DATA.Defence[5]).toContain('Lvl 45: Berserker/Warrior/Archer/Farseer Helms');
    expect(SKILL_UNLOCK_DATA.Slayer[4]).toContain('Lvl 33: Harpie Bug Swarms (Lit Bug Lantern)');
  });

  it('gives each dragon thrown weapon and decorative sword its own level', () => {
    for (const [skill, name, level] of [
      ['Ranged', 'Dragon Darts, Dragon Knives', 60], ['Ranged', 'Dragon Thrownaxes', 61],
      ['Attack', 'Decorative Sword (Red)', 5], ['Attack', 'Decorative Sword (White)', 20], ['Attack', 'Decorative Sword (Gold)', 30],
    ] as const) {
      const matches = rowsFor(skill).filter(row => row.text.includes(name));
      expect(matches, `${skill}: ${name}`).toHaveLength(1);
      expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
    }
    expect(rowsFor('Ranged').some(row => row.text.includes('Dragon Thrown,') || row.text.endsWith('Dragon Thrown'))).toBe(false);
    expect(rowsFor('Attack').some(row => row.text.includes('Decorative Swords'))).toBe(false);
  });

  it('lists all nine house locations at their Construction levels', () => {
    const moves = rowsFor('Construction').filter(row => row.text.includes('Move to')).map(row => [row.text.match(/Move to (\w+)/)?.[1], row.level]);
    expect(moves).toEqual([
      ['Rimmington', 1], ['Taverley', 10], ['Pollnivneach', 20], ['Hosidius', 25], ['Rellekka', 30],
      ['Aldarin', 35], ['Brimhaven', 40], ['Yanille', 50], ['Prifddinas', 70],
    ]);
  });
});

// Deep pass of 23 November 2026 (skills-b.d1, skills-b.d2), each row from a fresh Wiki fetch of the item's own
// page: Little crack, Clay fireplace, Remote Island, Red Rock, Barracuda Trials, Moss lizard, Cooked moss lizard,
// Rocks (Catherby), Strong Tree (Karamja volcano), Rogues' Den, Leaping trout/salmon/sturgeon.
describe('unlocks corrected in the 23 November 2026 deep pass', () => {
  it.each([
    ['Agility', 'God Wars Dungeon Access (Little Crack)', 60],
    ['Construction', 'Crude Furniture', 1],
    ['Construction', 'Clay Fireplace', 3],
    ['Sailing', 'Remote Island', 45],
    ['Sailing', 'Dock Red Rock (The Red Reef)', 52],
    ['Sailing', 'Barracuda Trials (The Tempor Tantrum)', 30],
    ['Sailing', 'Barracuda Trials (The Jubbly Jive)', 55],
    ['Sailing', 'Barracuda Trials (The Gwenith Glide; Regicide)', 72],
    ['Hunter', 'Moss Lizards (Perilous Moons)', 20],
    ['Cooking', 'Moss Lizards (Perilous Moons)', 30],
    ['Agility', 'Catherby Grapple (Strength 35, Ranged 35)', 32],
    ['Agility', 'Catherby Rocks (No Grapple)', 68],
    ['Agility', 'Karamja Strong Tree (Grapple; Strength 21, Ranged 42)', 53],
    ['Agility', 'Karamja Strong Tree (No Grapple)', 78],
    ['Agility', 'Rogues\' Den Minigame Access (Thieving 50)', 50],
    ['Agility', 'Catch Leaping Trout (Fishing 48, Strength 15; Barbarian Fishing)', 15],
    ['Agility', 'Catch Leaping Salmon (Fishing 58, Strength 30)', 30],
    ['Agility', 'Catch Leaping Sturgeon (Fishing 70, Strength 45)', 45],
  ] as const)('%s: %s is listed at its Wiki level', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.text.includes(name));
    expect(matches, `${skill}: ${name}`).toHaveLength(1);
    expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
  });

  it('no longer names the Strength boulder in Agility or fireplaces at Construction 1', () => {
    expect(rowsFor('Agility').some(row => row.text.includes('Boulder'))).toBe(false);
    expect(rowsFor('Construction').some(row => row.level === 1 && /fireplace/i.test(row.text))).toBe(false);
    expect(rowsFor('Sailing').filter(row => row.text.includes('Barracuda Trials')).map(row => row.level)).toEqual([30, 55, 72]);
  });
});

// Deep pass of 23 November 2026 (skills-b.d3[0]): lines that hid the quest the game needs, while the same list or its
// twin list notes that quest on matching lines. Each row from a fresh Wiki fetch of the item's or activity's own page
// and its skill's level-up table: Chinchompa (Hunter), Carnivorous chinchompa, Black chinchompa (Hunter), Magic Stall,
// Pyramid Plunder, Hallowed Sepulchre, Crystal helm, Bronze dart tip, Bronze brutal, Crew Management.
describe('quest notes added in the 23 November 2026 deep pass', () => {
  it.each([
    ['Hunter', 'Grey Chinchompas (Eagles\' Peak)', 53],
    ['Hunter', 'Red Chinchompas (Eagles\' Peak)', 63],
    ['Hunter', 'Black Chinchompas (Eagles\' Peak)', 73],
    ['Thieving', 'Magic Stalls (Monkey Madness I)', 65],
    ['Thieving', 'Pyramid Plunder (Room 1; Icthlarin\'s Little Helper)', 21],
    ['Thieving', 'Pyramid Plunder (Room 2; Icthlarin\'s Little Helper)', 31],
    ['Thieving', 'Pyramid Plunder (Room 3; Icthlarin\'s Little Helper)', 41],
    ['Thieving', 'Pyramid Plunder (Room 4; Icthlarin\'s Little Helper)', 51],
    ['Thieving', 'Pyramid Plunder (Room 5; Icthlarin\'s Little Helper)', 61],
    ['Thieving', 'Pyramid Plunder (Room 6; Icthlarin\'s Little Helper)', 71],
    ['Thieving', 'Pyramid Plunder (Room 7; Icthlarin\'s Little Helper)', 81],
    ['Thieving', 'Pyramid Plunder (Room 8; Icthlarin\'s Little Helper)', 91],
    ['Agility', 'Hallowed Sepulchre (Floor 1; Sins of the Father)', 52],
    ['Agility', 'Hallowed Sepulchre (Floor 2; Sins of the Father)', 62],
    ['Agility', 'Hallowed Sepulchre (Floor 3; Sins of the Father)', 72],
    ['Smithing', 'Crystal Helm, Celestial Signet (Crafting 70; Song of the Elves)', 70],
    ['Smithing', 'Crystal Legs (Crafting 72; Song of the Elves)', 72],
    ['Smithing', 'Crystal Body (Crafting 74; Song of the Elves)', 74],
    ['Smithing', 'Crystal Tools (Crafting 76; Song of the Elves)', 76],
    ['Smithing', 'Crystal Weapon/Shield (Crafting 78; Song of the Elves)', 78],
    ['Smithing', 'Crystal Key/Teleport (Crafting 80; Song of the Elves)', 80],
    ['Smithing', 'Bronze Darts (The Tourist Trap)', 4],
    ['Smithing', 'Iron Darts (The Tourist Trap)', 19],
    ['Smithing', 'Steel Darts (The Tourist Trap)', 34],
    ['Smithing', 'Mithril Darts (The Tourist Trap)', 54],
    ['Smithing', 'Adamant Darts (The Tourist Trap)', 74],
    ['Smithing', 'Rune Darts (The Tourist Trap)', 89],
    ['Fletching', 'Bronze Brutal Arrows (Zogre Flesh Eaters)', 7],
    ['Fletching', 'Iron Brutal Arrows (Zogre Flesh Eaters)', 18],
    ['Fletching', 'Steel Brutal Arrows (Zogre Flesh Eaters)', 33],
    ['Fletching', 'Black Brutal Arrows (Zogre Flesh Eaters)', 38],
    ['Fletching', 'Mithril Brutal Arrows (Zogre Flesh Eaters)', 49],
    ['Fletching', 'Adamant Brutal Arrows (Zogre Flesh Eaters)', 62],
    ['Fletching', 'Rune Brutal Arrows (Zogre Flesh Eaters)', 77],
    ['Sailing', 'Recruit Captain Siad (The Tourist Trap)', 50],
    ['Sailing', 'Recruit Cabin Boy Jenkins (Dragon Slayer I; The Restless Ghost)', 60],
    ['Sailing', 'Recruit Oarswoman Olga (In Aid of the Myreque)', 65],
    ['Sailing', 'Recruit Bosun Zarah (Royal Trouble; Hard Fremennik Diary)', 80],
  ] as const)('%s: %s is listed with its quest at its Wiki level', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.text.includes(name));
    expect(matches, `${skill}: ${name}`).toHaveLength(1);
    expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
  });

  it('notes the quest on every chinchompa, Pyramid Plunder, Sepulchre floor, dart tip and brutal arrow line', () => {
    const bare = (skill: string, pattern: RegExp, note: string) => rowsFor(skill)
      .filter(row => pattern.test(row.text) && !row.text.includes(note)).map(row => row.text);
    expect(bare('Hunter', /Chinchompas/, '(Eagles\' Peak)')).toEqual([]);
    expect(bare('Thieving', /Pyramid Plunder/, 'Icthlarin\'s Little Helper')).toEqual([]);
    expect(bare('Agility', /Hallowed Sepulchre \(Floor/, 'Sins of the Father')).toEqual([]);
    expect(bare('Smithing', /Darts/, '(The Tourist Trap)')).toEqual([]);
    expect(bare('Fletching', /Brutal Arrows/, '(Zogre Flesh Eaters)')).toEqual([]);
    expect(bare('Smithing', /Crystal (Helm|Legs|Body|Tools|Weapon|Key)/, 'Song of the Elves)')).toEqual([]);
  });
});
