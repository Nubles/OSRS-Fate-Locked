import { describe, expect, it } from 'vitest';
import { SKILL_UNLOCK_DATA } from './skillUnlocks';

// Magic rows added from the OSRS Wiki 'Magic/Level up table' (fetched 22 Nov 2026)
// in the second round of the skill-list audit. Each fragment names one line once.
const rowsFor = (skill: string) => Object.entries(SKILL_UNLOCK_DATA[skill])
  .flatMap(([tier, texts]) => texts.map(text => ({ tier: Number(tier), level: Number(text.match(/^Lvl (\d+):/)?.[1]), text })));

describe('Magic unlocks filled from the Wiki level-up table', () => {
  it.each([
    ['Magic', 'Arceuus Library Teleport', 6],
    ['Magic', 'Basic Reanimation', 16],
    ['Magic', 'Draynor Manor Teleport', 17],
    ['Magic', 'Battlefront Teleport', 23],
    ['Magic', 'Mind Altar Teleport', 28],
    ['Magic', "Bryophyta's Staff", 30],
    ['Magic', 'Respawn Teleport', 34],
    ['Magic', 'Ghostly Grasp', 35],
    ['Magic', 'Resurrect Lesser Thralls', 38],
    ['Magic', 'Salve Graveyard Teleport', 40],
    ['Magic', 'Elder Chaos Druid Robes', 40],
    ['Magic', 'Skeletal Armour', 40],
    ['Magic', 'Adept Reanimation', 41],
    ['Magic', 'Monster Inspect', 42],
    ['Magic', 'Inferior Demonbane', 44],
    ['Magic', 'Beginner Wand', 45],
    ['Magic', 'Shadow Veil', 47],
    ['Magic', 'Kourend Castle Teleport', 48],
    ['Magic', "Fenkenstrain's Castle Teleport", 48],
    ['Magic', 'Dark Lure', 50],
    ['Magic', 'Swampbark Armour', 50],
    ['Magic', 'Orange Salamander', 50],
    ['Magic', 'Tomes of Fire, Water and Earth', 50],
    ['Magic', 'Paddewwa Teleport', 54],
    ['Magic', 'Civitas illa Fortis Teleport', 54],
    ['Magic', 'Teacher Wand', 55],
    ['Magic', 'Summon Boat', 56],
    ['Magic', 'Skeletal Grasp', 56],
    ['Magic', 'Resurrect Superior Thralls', 57],
    ['Magic', 'Mark of Darkness', 59],
    ['Magic', 'Elemental Amulets', 59],
    ['Magic', 'God Staves, God Capes', 60],
    ['Magic', 'Charge Earth Orb', 60],
    ['Magic', 'Senntisten Teleport', 60],
    ['Magic', 'Bones to Peaches', 60],
    ['Magic', 'Twinflame Staff', 60],
    ['Magic', 'Toktz-Mej-Tal', 60],
    ['Magic', 'Craft Primordial', 60],
    ['Magic', 'West Ardougne Teleport', 61],
    ['Magic', 'Superior Demonbane', 62],
    ['Magic', 'Warped Sceptre', 62],
    ['Magic', 'Ape Atoll Teleport (Freeing King Awowogei for the teleport)', 64],
    ['Magic', 'Lesser Corruption', 64],
    ['Magic', 'Geomancy', 65],
    ['Magic', 'Harmony Island Teleport', 65],
    ['Magic', '3rd Age Wand', 65],
    ['Magic', 'Spectral Spirit Shields', 65],
    ['Magic', 'Kharyrll Teleport', 66],
    ['Magic', 'Monster Examine', 66],
    ['Magic', 'Forge Ancient Wyvern Shield', 66],
    ['Magic', 'Astral Contact', 67],
    ['Magic', 'Enchant Bolt (Dragonstone)', 68],
    ['Magic', 'Cure Other', 68],
    ['Magic', 'Moonclan Teleport', 69],
    ['Magic', 'Tele Group Moonclan', 70],
    ['Magic', 'Boots of Brimstone', 70],
    ['Magic', 'Accursed Sceptre', 70],
    ['Magic', 'Black Salamander', 70],
    ['Magic', 'Hunter Kit', 71],
    ['Magic', 'Lassar Teleport', 72],
    ['Magic', 'Expert Reanimation', 72],
    ['Magic', 'Ward of Arceuus', 73],
    ['Magic', 'Teleother Lumbridge', 74],
    ['Magic', 'Stat Spy', 75],
    ['Magic', 'Imbued God Capes', 75],
    ['Magic', 'Toxic Staff of the Dead', 75],
    ['Magic', 'Staff of Balance', 75],
    ['Magic', 'Tele Group Barbarian', 76],
    ['Magic', 'Resurrect Greater Thralls', 76],
    ['Magic', 'Purging Staff', 77],
    ['Magic', 'Virtus Robes', 78],
    ['Magic', 'Resurrect Crops', 78],
    ['Magic', 'Undead Grasp', 79],
    ['Magic', 'Death Charge', 80],
    ['Magic', 'Avernic Treads', 80],
    ['Magic', 'Stat Restore Pot Share', 81],
    ['Magic', 'Teleother Falador', 82],
    ['Magic', 'Dark Demonbane', 82],
    ['Magic', 'Volatile Nightmare Staves', 82],
    ['Magic', 'Eye of Ayak', 83],
    ['Magic', 'Boost Potion Share', 84],
    ['Magic', 'Demonic Offering', 84],
    ['Magic', 'Teleport to Target', 85],
    ['Magic', 'Greater Corruption', 85],
    ['Magic', 'Tele Group Fishing Guild', 86],
    ['Magic', 'Catherby Teleport', 87],
    ['Magic', 'Tele Group Catherby', 88],
    ['Magic', 'Recharge Dragonstone', 89],
    ['Magic', 'Annakarl Teleport', 90],
    ['Magic', 'Master Reanimation', 90],
    ['Magic', 'Ape Atoll Teleport (Arceuus', 90],
    ['Magic', 'Craft Ancient Rings', 90],
    ['Magic', 'Sinister Offering', 92],
    ['Magic', 'Heal Group', 95],
    ['Magic', 'Ghorrock Teleport', 96],
  ] as const)('%s: %s is listed once, at level %i and its tier', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.text.includes(name));
    expect(matches, `${skill}: ${name}`).toHaveLength(1);
    expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
  });

  it('keeps every Magic line in its tier and in level order', () => {
    for (const [tier, texts] of Object.entries(SKILL_UNLOCK_DATA.Magic)) {
      const levels = texts.map(text => Number(text.match(/^Lvl (\d+):/)?.[1]));
      expect(levels.every(level => Math.ceil(level / 10) === Number(tier)), `tier ${tier}`).toBe(true);
      expect([...levels].sort((a, b) => a - b), `tier ${tier}`).toEqual(levels);
    }
  });
});
