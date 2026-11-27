import { describe, expect, it } from 'vitest';
import { SKILL_UNLOCK_DATA } from './skillUnlocks';

// Rows of the OSRS Wiki "<Skill>/Level up table" pages (Attack, Strength,
// Prayer, Slayer), read 22 Nov 2026, that the lists lacked before the audit.
const rowsFor = (skill: string) => Object.entries(SKILL_UNLOCK_DATA[skill])
  .flatMap(([tier, texts]) => texts.map(text => ({ tier: Number(tier), level: Number(text.match(/^Lvl (\d+):/)?.[1]), text })));

describe('combat skill lists follow the Wiki level-up tables', () => {
  it.each([
    ['Attack', 'Bone Spear & Mjolnirs', 1],
    ['Attack', 'Blurite & Shadow Swords, Blessed Axe, Dark Dagger', 1],
    ['Attack', 'Darklight, Gadderhammer', 1],
    ['Attack', "Bryophyta's Staff", 30],
    ['Attack', 'Fremennik Blades', 30],
    ['Attack', 'Barronite Mace & Katanas', 40],
    ['Attack', 'Ivandis Flail', 40],
    ['Attack', 'Ancient Sceptre', 50],
    ['Attack', 'Blisterwood Sickle & Flail', 50],
    ['Attack', 'Bone Mace', 50],
    ['Attack', 'Hallowed Flail & Sunspear', 50],
    ['Attack', 'Keris (Contact!)', 50],
    ['Attack', 'Purging Staff', 50],
    ['Attack', 'Glacial Temotli & Earthbound Tecpatl', 55],
    ['Attack', 'Arkan Blade', 60],
    ['Attack', 'Burning Claws & Colossal Blade', 60],
    ['Attack', 'Crimson Kisten', 60],
    ['Attack', 'Red Salamander', 60],
    ['Attack', "Belle's Folly", 65],
    ['Attack', 'Keris Partisan (Beneath Cursed Sands)', 65],
    ['Attack', 'Avernic Defender', 70],
    ['Attack', 'Black Salamander', 70],
    ['Attack', 'Blue Moon Spear', 70],
    ['Attack', 'Dual Macuahuitl', 70],
    ['Attack', 'Ursine Chainmace', 70],
    ['Attack', 'Zamorakian Hasta', 70],
    ['Attack', "Dinh's Bulwark", 75],
    ['Attack', 'Elder Maul', 75],
    ['Attack', 'Hallowfell', 75],
    ['Attack', "Saradomin's Blessed Sword", 75],
    ['Attack', 'Staves of the Dead (& Toxic), Light & Balance', 75],
    ['Attack', 'Emberlight', 77],
    ['Attack', 'Dragon Hunter Lance', 78],
    ['Attack', 'Keris Partisans (Amascut, Breaching, Corruption, Sun)', 80],
    ['Attack', 'Noxious Halberd', 80],
    ['Attack', 'Tecu Salamander', 80],
    ['Strength', 'Lumbridge Raft Grapple', 19],
    ['Strength', 'Karamja Volcano Grapple', 21],
    ['Strength', 'Taverley Dungeon Grapple', 22],
    ['Strength', "Hunter's Spear", 30],
    ['Strength', 'Yanille Grapple', 38],
    ['Strength', 'Dorgesh-Kaan Cave Crossing', 70],
    ['Strength', 'Dual Macuahuitl', 75],
    ['Strength', "Statius’s Warhammer", 75],
    ['Strength', 'Crimson Kisten', 85],
    ['Prayer', 'Vestment Robe Tops & Legs', 20],
    ['Prayer', 'Ectoplasmators', 40],
    ['Prayer', "Bologa's Blessings", 50],
    ['Prayer', 'Croziers', 60],
    ['Prayer', 'Sunfire Fanatic Armour', 60],
    ['Prayer', 'Bonecrusher & Dragonbone Necklaces', 70],
    ['Slayer', 'Boots of Brimstone', 44],
    ['Slayer', "Slayer's Staff & Magic Dart", 55],
    ['Slayer', "V's Shield", 60],
  ] as const)('%s: %s appears only at level %i and its tier', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.text.includes(name));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
  });

  it.each(['Attack', 'Strength', 'Prayer', 'Slayer'])('%s keeps every level line in its tier and in level order', skill => {
    for (const texts of Object.values(SKILL_UNLOCK_DATA[skill])) {
      const levels = texts.map(text => Number(text.match(/^Lvl (\d+):/)?.[1])).filter(Number.isFinite);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
    for (const row of rowsFor(skill).filter(r => Number.isFinite(r.level))) {
      expect(row.tier, row.text).toBe(Math.ceil(row.level / 10));
    }
  });
});
