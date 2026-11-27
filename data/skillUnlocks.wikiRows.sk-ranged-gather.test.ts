import { describe, expect, it } from 'vitest';
import { SKILL_UNLOCK_DATA } from './skillUnlocks';

// Lines added or extended in the 22 Nov 2026 fill of the Ranged, Mining, Fishing and
// Woodcutting lists. Each one comes from a row of that skill's "<Skill>/Level up table"
// on the OSRS Wiki (all four tables fetched on 22 Nov 2026), checked against the
// table at the row's level.
const rowsFor = (skill: string) => Object.entries(SKILL_UNLOCK_DATA[skill])
  .flatMap(([tier, texts]) => texts.map(text => ({ tier: Number(tier), level: Number(text.match(/^Lvl (\d+):/)?.[1]), text })));

describe('Wiki level-up rows in the Ranged and gathering lists', () => {
  it.each([
    // Ranged
    ['Ranged', 'Training Bows', 1], ['Ranged', 'Hard Leather Shield', 20], ['Ranged', 'Willow Comp Bow', 20],
    ['Ranged', 'Yanille Wall Shortcut', 21], ['Ranged', 'Frog-Leather Armour', 25], ['Ranged', 'Comp Ogre Bow', 30],
    ['Ranged', 'Swamp Lizard', 30], ['Ranged', 'Catherby Rocks Shortcut', 35], ['Ranged', 'Broken Raft Shortcut', 37],
    ['Ranged', 'Taverley Dungeon Rocks', 39], ['Ranged', "Gilded D'hide", 40], ['Ranged', 'Robin Hood Hat', 40],
    ['Ranged', 'Yew Comp Bow', 40], ['Ranged', 'Karamja Volcano Rocks', 42], ['Ranged', 'Adamant Crossbow', 46],
    ['Ranged', 'Magic Comp Bow', 50], ['Ranged', 'Seercull, Bone Shortbow', 50], ['Ranged', 'Orange Salamander', 50],
    ['Ranged', "Hunter's Spear", 55], ['Ranged', 'Toktz-Xil-Ul', 60], ['Ranged', 'Mixed Hide Armour', 60],
    ['Ranged', 'Penance Skirt', 60], ['Ranged', 'Red Salamander', 60], ['Ranged', 'Pillar Grapples', 62],
    ['Ranged', 'Black Chinchompas', 65], ['Ranged', 'Sunlight Crossbow', 66], ['Ranged', 'Armadyl Crossbow', 70],
    ['Ranged', "Armadyl's Eyrie", 70], ['Ranged', 'Hueycoatl Hide', 70], ['Ranged', 'Black Salamander', 70],
    ['Ranged', 'Boots of Brimstone', 70], ['Ranged', 'Dragonfire Ward', 70], ['Ranged', 'Heavy Ballista', 75],
    ['Ranged', 'Eclipse Moon Armour', 75], ['Ranged', 'Eclipse Atlatl', 75], ['Ranged', 'Scorching Bow', 77],
    ['Ranged', 'Avernic Treads', 80], ['Ranged', 'Tecu Salamander', 80], ['Ranged', 'Zaryte Vambraces', 80],
    // Mining
    ['Mining', 'Bronze & Iron Pickaxes', 1], ['Mining', 'Size-1 Crashed Stars', 10], ['Mining', 'Size-2 Crashed Stars', 20],
    ['Mining', 'Size-3 Crashed Stars', 30], ['Mining', 'Size-4 Crashed Stars', 40], ['Mining', 'Size-5 Crashed Stars', 50],
    ['Mining', 'Size-6 Crashed Stars', 60], ['Mining', 'Size-7 Crashed Stars', 70], ['Mining', 'Size-8 Crashed Stars', 80],
    ['Mining', 'Size-9 Crashed Stars', 90], ['Mining', 'Daeyalt Ore', 20], ['Mining', 'Elemental Ore', 20],
    ['Mining', 'Volcanic Ash (2 per', 37], ['Mining', 'Volcanic Ash (3 per', 52], ['Mining', 'Volcanic Ash (4 per', 67],
    ['Mining', 'Volcanic Ash (5 per', 82], ['Mining', 'Volcanic Ash (6 per', 97], ['Mining', 'Gilded Pickaxe', 41],
    ['Mining', 'Rubium Splinters', 48], ['Mining', '3rd Age Pickaxe', 61], ['Mining', 'Tainted Essence', 64],
    ['Mining', 'Expert Mining Gloves', 70], ['Mining', 'Soft Clay Rocks', 70], ['Mining', 'Salt Deposits (4', 70],
    ['Mining', 'Salt Deposits (5', 75], ['Mining', 'Salt Deposits (6', 80], ['Mining', 'Infernal Shale', 78],
    ['Mining', 'Meiyerditch Lab Shortcut', 78], ['Mining', 'Urt Salt (3-5', 81], ['Mining', 'Urt Salt (4-6', 90],
    ['Mining', 'Urt Salt (5-7', 99], ['Mining', "Het's Seal +7", 85], ['Mining', "Het's Seal +9", 99],
    ['Mining', "Mac's Island Rockslide", 99],
    // Fishing
    ['Fishing', 'Suphi Fish', 15], ['Fishing', 'Caskets', 16], ['Fishing', 'Leckish Fish', 30],
    ['Fishing', 'Brawk Fish', 45], ['Fishing', 'Fish Shoals', 47], ['Fishing', 'Common Tench', 56],
    ['Fishing', 'Shimmering Shoals', 69], ['Fishing', 'Barehanded Swordfish', 70], ['Fishing', 'Roqed Fish', 75],
    ['Fishing', 'Glistening Shoals', 76], ['Fishing', 'Vibrant Shoals', 86],
    // Woodcutting
    ['Woodcutting', 'Normal & Achey Trees', 1], ['Woodcutting', 'Kharidian Cactus', 1], ['Woodcutting', 'Up to 1 Kindling', 1],
    ['Woodcutting', 'Up to 2 Kindling', 24], ['Woodcutting', 'Up to 3 Kindling', 36], ['Woodcutting', 'Up to 4 Kindling', 48],
    ['Woodcutting', 'Up to 5 Kindling', 60], ['Woodcutting', 'Up to 6 Kindling', 72], ['Woodcutting', 'Up to 7 Kindling', 84],
    ['Woodcutting', 'Up to 8 Kindling', 96], ['Woodcutting', 'Steel Axes & Felling Axes', 6], ['Woodcutting', 'Black Axes & Felling Axes', 11],
    ['Woodcutting', 'Mithril Axes & Felling Axes', 21], ['Woodcutting', 'Adamant Axes & Felling Axes', 31], ['Woodcutting', 'Dense Jungle', 35],
    ['Woodcutting', 'Secateurs Attachment', 35], ['Woodcutting', 'Rune Felling Axes', 41], ['Woodcutting', 'Neitiznot Shield', 56],
    ['Woodcutting', 'Dragon/3rd Age Felling Axes', 61], ['Woodcutting', 'Nature Offerings', 68], ['Woodcutting', 'Crystal Axes & Felling Axes', 71],
    ['Woodcutting', 'Evergreen Tree', 99],
  ] as const)('%s: %s appears once, at level %i and its tier', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.text.includes(name));
    expect(matches, `${skill}: ${name}`).toHaveLength(1);
    expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
  });

  it('keeps each of these lists in level order inside every tier', () => {
    for (const skill of ['Ranged', 'Mining', 'Fishing', 'Woodcutting']) {
      for (const [tier, texts] of Object.entries(SKILL_UNLOCK_DATA[skill])) {
        const levels = texts.map(text => Number(text.match(/^Lvl (\d+):/)?.[1]));
        expect(levels, `${skill} tier ${tier}`).toEqual([...levels].sort((a, b) => a - b));
      }
    }
  });
});
