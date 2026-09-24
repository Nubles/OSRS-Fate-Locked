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
