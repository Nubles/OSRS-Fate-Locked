import { describe, expect, it } from 'vitest';
import { SKILL_UNLOCK_DATA } from './skillUnlocks';

const rowsFor = (skill: string) => Object.entries(SKILL_UNLOCK_DATA[skill])
  .flatMap(([tier, texts]) => texts.map(text => ({ tier: Number(tier), level: Number(text.match(/^Lvl (\d+):/)?.[1]), text })));

// 22 Nov 2026: Defence and Runecraft filled from 'Defence/Level up table' and
// 'Runecraft/Level up table' on the OSRS Wiki (fetched that day). Each fragment names
// one line the fill added or extended, at the level the table gives.
describe('Defence and Runecraft rows from the Wiki level-up tables', () => {
  it.each([
    ['Defence', 'Bronze & Iron Armour, Defenders', 1], ['Defence', 'Steel Defender', 5], ['Defence', 'Red Decorative Armour', 5],
    ['Defence', 'Black Mask (Strength 20, Combat 40)', 10], ['Defence', 'Oak Shield', 10],
    ['Defence', 'White Decorative Armour', 20], ['Defence', 'Robes of Darkness', 20], ['Defence', 'Yak-hide Armour', 20],
    ['Defence', 'Studded Body (Ranged 20)', 20], ['Defence', 'Neitiznot Shield', 25],
    ['Defence', '3rd Age Mage Robes (Magic 65)', 30], ['Defence', 'Gold Decorative Armour', 30],
    ['Defence', 'Fremennik Helm & Shield', 30], ['Defence', 'Ram Skull Helm (Rag and Bone Man II)', 30], ['Defence', 'Willow Shield', 30],
    ['Defence', 'Samurai Armour', 35], ['Defence', "Blessed D'hide Body, Coif, Boots & Shield", 40],
    ['Defence', "Blue/Red/Black D'hide Bodies", 40], ['Defence', "Dagon'hai Robes", 40], ['Defence', 'Penance Skirt & Gloves, Runner Boots', 40],
    ['Defence', "Green/Blue/Red/Black D'hide Shields", 40], ['Defence', 'Hueycoatl Hide Body & Coif', 40],
    ['Defence', 'Lunar Equipment (Magic 65, Lunar Diplomacy)', 40], ['Defence', 'Maple, Yew, Magic & Redwood Shields', 40],
    ['Defence', 'Rock-shell, Spined & Skeletal Armour', 40], ['Defence', 'Splitbark Armour', 40],
    ['Defence', 'Sunfire Fanatic Armour', 40], ['Defence', "V's Shield (Slayer 60", 40],
    ['Defence', '3rd Age Range Equipment', 45], ['Defence', 'Berserker/Warrior/Archer/Farseer Helms', 45],
    ['Defence', 'Fighter/Ranger/Healer/Runner Hats', 45], ['Defence', 'Zaryte Vambraces', 45],
    ['Defence', 'Dwarven Helmet (Grim Tales)', 50], ['Defence', 'Mixed Hide Armour', 50], ['Defence', 'Zombie Helmet', 50],
    ['Defence', 'Bloodbark Armour', 60], ['Defence', 'Odium & Malediction Wards', 60],
    ['Defence', '3rd Age Melee Equipment', 65], ['Defence', 'Chivalry (Prayer 60)', 65],
    ['Defence', 'Avernic Defender', 70], ['Defence', 'Blessed Spirit Shield', 70], ['Defence', 'Boots of Brimstone', 70],
    ['Defence', 'Neitiznot Faceguard', 70], ['Defence', 'Rigour (Prayer 74), Augury (Prayer 77)', 70],
    ['Defence', 'Arcane & Spectral Spirit Shields', 75], ['Defence', "Dinh's Bulwark", 75], ['Defence', 'Ancient Wyvern Shield', 75],
    ['Defence', 'Elysian Spirit Shield', 75], ['Defence', 'Guardian & Echo Boots', 75], ['Defence', 'Serpentine Helm', 75],
    ['Defence', 'Twisted Buckler', 75], ['Defence', 'Virtus Robes', 75], ['Defence', 'Oathplate Armour', 78],
    ['Defence', 'Avernic Treads', 80], ['Defence', "Rockslide to Mac's Island", 99],
    ['Runecraft', 'Air/Mind/Water/Earth/Fire/Body Tiaras', 1], ['Runecraft', 'Cosmic/Chaos/Nature/Law/Death/Blood/Wrath Tiaras', 1],
    ['Runecraft', 'Dark Essence Blocks', 1], ['Runecraft', 'Elemental & Catalytic Tiaras', 1],
    ['Runecraft', 'Rune Case 1 (Construction 41)', 14], ['Runecraft', 'Amulet of Air', 18], ['Runecraft', 'Amulet of Water', 19],
    ['Runecraft', 'Amulet of Earth', 20], ['Runecraft', 'Amulet of Fire', 21], ['Runecraft', 'Elemental Amulets', 30],
    ['Runecraft', 'Rune Case 2 (Construction 41)', 44], ['Runecraft', 'Reinvigorate Pages', 50],
    ['Runecraft', 'Rune Case 3 (Construction 41)', 90], ['Runecraft', '10 Air Runes', 99], ['Runecraft', '2 Death Runes', 99],
  ] as const)('%s: %s is listed once, at its Wiki level and tier', (skill, name, level) => {
    const matches = rowsFor(skill).filter(row => row.text.includes(name));
    expect(matches, `${skill}: ${name}`).toHaveLength(1);
    expect(matches[0]).toMatchObject({ level, tier: Math.ceil(level / 10) });
  });

  it('keeps each tier of both lists in level order', () => {
    for (const skill of ['Defence', 'Runecraft']) {
      for (const texts of Object.values(SKILL_UNLOCK_DATA[skill])) {
        const levels = texts.map(text => Number(text.match(/^Lvl (\d+):/)?.[1]));
        expect(levels, skill).toEqual([...levels].sort((a, b) => a - b));
      }
    }
  });
});
