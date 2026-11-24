import { describe, it, expect } from 'vitest';
import { attackBonuses, blowpipeDarts, sumBonuses, hasNoBonuses, ZERO_BONUSES, GearItem, GearBonuses } from './gearStats';

const bonuses = (over: Partial<GearBonuses>): GearBonuses => ({ ...ZERO_BONUSES, ...over });
const item = (id: number, over: Partial<GearBonuses>): GearItem => ({
  id, name: `item${id}`, slot: 'Weapon', imageFile: 'x.png', speed: 4, twoHanded: false,
  bonuses: bonuses(over),
});

describe('gear stats', () => {
  it('an empty loadout sums to all zero', () => {
    expect(sumBonuses([])).toEqual(ZERO_BONUSES);
  });

  it('sums bonuses field-by-field', () => {
    const total = sumBonuses([
      item(1, { slash: 80, meleeStr: 82 }),
      item(2, { slash: 5, defSlash: 100, prayer: 3 }),
    ]);
    expect(total.slash).toBe(85);
    expect(total.meleeStr).toBe(82);
    expect(total.defSlash).toBe(100);
    expect(total.prayer).toBe(3);
    expect(total.ranged).toBe(0);
  });

  it('detects cosmetics with no bonuses', () => {
    expect(hasNoBonuses(ZERO_BONUSES)).toBe(true);
    expect(hasNoBonuses(bonuses({ prayer: 1 }))).toBe(false);
    expect(hasNoBonuses(bonuses({ defMagic: -5 }))).toBe(false);
  });
});

describe('ammo that applies to an attack', () => {
  const weapon = (name: string, category: string, rangedStr = 0): GearItem => ({
    id: 1, name, slot: 'Weapon', imageFile: 'x.png', speed: 4, twoHanded: true, category,
    bonuses: bonuses({ rangedStr }),
  });
  const ammo = (name: string, rangedStr: number): GearItem => ({
    id: 2, name, slot: 'Ammo', imageFile: 'x.png', speed: 0, twoHanded: false,
    bonuses: bonuses({ rangedStr, prayer: 1 }),
  });
  const rangedStr = (w: GearItem, a: GearItem) => attackBonuses([w, a]).rangedStr;

  it('counts ammunition the weapon fires', () => {
    expect(rangedStr(weapon('Magic shortbow', 'Bow'), ammo('Rune arrow', 49))).toBe(49);
    expect(rangedStr(weapon('Comp ogre bow', 'Bow'), ammo('Rune brutal', 60))).toBe(60);
    expect(rangedStr(weapon('Armadyl crossbow', 'Crossbow'), ammo('Dragon bolts', 122))).toBe(122);
    expect(rangedStr(weapon("Karil's crossbow", 'Crossbow'), ammo('Bolt rack', 55))).toBe(55);
    expect(rangedStr(weapon('Heavy ballista', 'Crossbow', 15), ammo('Dragon javelin', 150))).toBe(165);
    expect(rangedStr(weapon('Eclipse atlatl', 'Bow'), ammo('Atlatl dart', 20))).toBe(20);
    expect(rangedStr(weapon('Black salamander', 'Salamander'), ammo('Irit tar', 60))).toBe(60);
    // The venator bow's charges power its bounce; it still fires arrows.
    expect(rangedStr(weapon('Venator bow', 'Bow', 25), ammo('Dragon arrow', 60))).toBe(85);
  });

  it('ignores ammunition the weapon does not fire', () => {
    expect(rangedStr(weapon('Dragon dart', 'Thrown', 35), ammo('Dragon arrow', 60))).toBe(35);
    expect(rangedStr(weapon('Toxic blowpipe', 'Thrown', 20), ammo('Dragon arrow', 60))).toBe(20);
    expect(rangedStr(weapon('Black chinchompa', 'Chinchompas', 30), ammo('Rune arrow', 49))).toBe(30);
    expect(rangedStr(weapon('Crystal bow', 'Bow', 78), ammo('Rune arrow', 49))).toBe(78);
    expect(rangedStr(weapon('Bow of Faerdhinen', 'Bow', 106), ammo('Dragon arrow', 60))).toBe(106);
    expect(rangedStr(weapon('Starter bow', 'Bow', 7), ammo('Dragon arrow', 60))).toBe(7); // fires its own ammunition
    expect(rangedStr(weapon('Armadyl crossbow', 'Crossbow'), ammo('Dragon arrow', 60))).toBe(0);
    expect(rangedStr(weapon('Heavy ballista', 'Crossbow', 15), ammo('Runite bolts', 115))).toBe(15);
  });

  it('ignores ammunition above what the bow or crossbow can fire (each weapon\'s Wiki page)', () => {
    // "can use arrows up to steel" (Oak shortbow); "up to iron" (Shortbow).
    expect(rangedStr(weapon('Oak shortbow', 'Bow'), ammo('Rune arrow', 49))).toBe(0);
    expect(rangedStr(weapon('Oak shortbow', 'Bow'), ammo('Steel arrow', 16))).toBe(16);
    expect(rangedStr(weapon('Shortbow', 'Bow'), ammo('Steel arrow', 16))).toBe(0);
    expect(rangedStr(weapon('Willow comp bow', 'Bow'), ammo('Mithril fire arrow', 22))).toBe(22);
    expect(rangedStr(weapon('Maple longbow', 'Bow'), ammo('Seeking rune arrow', 49))).toBe(0);
    expect(rangedStr(weapon('Yew shortbow', 'Bow'), ammo('Rune arrow', 49))).toBe(49);
    expect(rangedStr(weapon('Yew shortbow', 'Bow'), ammo('Amethyst arrow', 55))).toBe(0);
    expect(rangedStr(weapon('Magic shortbow', 'Bow'), ammo('Amethyst arrow', 55))).toBe(55);
    expect(rangedStr(weapon('Rain bow', 'Bow'), ammo('Ice arrows', 16))).toBe(0); // "can only fire bronze and iron arrows"
    // Dragon arrows: only the bows whose page says so.
    expect(rangedStr(weapon('Magic shortbow', 'Bow'), ammo('Dragon arrow', 60))).toBe(0);
    expect(rangedStr(weapon('Twisted bow', 'Bow', 20), ammo('Dragon arrow', 60))).toBe(80);
    expect(rangedStr(weapon("Nature's recurve", 'Bow'), ammo('Dragon arrow', 60))).toBe(60);
    // Ogre and brutal arrows only from ogre bows; ogre bows only those.
    expect(rangedStr(weapon('Ogre bow', 'Bow'), ammo('Rune brutal', 60))).toBe(0);
    expect(rangedStr(weapon('Ogre bow', 'Bow'), ammo('Mithril brutal', 34))).toBe(34);
    expect(rangedStr(weapon('Magic longbow', 'Bow'), ammo('Rune brutal', 60))).toBe(0);
    expect(rangedStr(weapon('Comp ogre bow', 'Bow'), ammo('Rune arrow', 49))).toBe(0);
    // The Gauntlet's bow: no items can be brought in.
    expect(rangedStr(weapon('Corrupted bow (perfected)', 'Bow'), ammo('Rune arrow', 49))).toBe(0);
    // Crossbows: "can only fire bronze bolts", "up to and including runite bolts".
    expect(rangedStr(weapon('Bronze crossbow', 'Crossbow'), ammo('Runite bolts', 115))).toBe(0);
    expect(rangedStr(weapon('Phoenix crossbow', 'Crossbow'), ammo('Barbed bolts', 12))).toBe(12);
    expect(rangedStr(weapon('Blurite crossbow', 'Crossbow'), ammo('Blurite bolts', 28))).toBe(28);
    expect(rangedStr(weapon('Blurite crossbow', 'Crossbow'), ammo('Iron bolts', 46))).toBe(0);
    expect(rangedStr(weapon('Rune crossbow', 'Crossbow'), ammo('Dragon bolts', 122))).toBe(0);
    expect(rangedStr(weapon('Rune crossbow (or)', 'Crossbow'), ammo('Runite bolts', 115))).toBe(115);
    expect(rangedStr(weapon('Rune crossbow', 'Crossbow'), ammo('Ruby dragon bolts (e)', 122))).toBe(0);
    expect(rangedStr(weapon('Adamant crossbow', 'Crossbow'), ammo('Broad bolts', 100))).toBe(0);
    expect(rangedStr(weapon('Dragon crossbow', 'Crossbow'), ammo('Dragon bolts', 122))).toBe(122);
    expect(rangedStr(weapon("King's barrage", 'Crossbow'), ammo('Dragon bolts', 122))).toBe(122);
    expect(rangedStr(weapon('Rune crossbow', 'Crossbow'), ammo('Bolt rack', 55))).toBe(0);
    expect(rangedStr(weapon('Rune crossbow', 'Crossbow'), ammo('Bone bolts', 49))).toBe(0);
    expect(rangedStr(weapon('Dorgeshuun crossbow', 'Crossbow'), ammo('Bone bolts', 49))).toBe(49);
    // "can only be fired from a dragon crossbow, Armadyl crossbow, dragon hunter crossbow, or Zaryte crossbow".
    expect(rangedStr(weapon('Dorgeshuun crossbow', 'Crossbow'), ammo('Dragon bolts', 122))).toBe(0);
    expect(rangedStr(weapon("Karil's crossbow", 'Crossbow'), ammo('Runite bolts', 115))).toBe(0);
    expect(rangedStr(weapon("Hunters' crossbow", 'Crossbow'), ammo('Runite bolts', 115))).toBe(0);
    expect(rangedStr(weapon("Hunters' crossbow", 'Crossbow'), ammo('Long kebbit bolts', 38))).toBe(38);
    expect(rangedStr(weapon("Hunters' sunlight crossbow", 'Crossbow'), ammo('Kebbit bolts', 28))).toBe(0);
  });

  it('keeps the ammo slot\'s other bonuses and the raw stats-screen total', () => {
    const items = [weapon('Dragon dart', 'Thrown', 35), ammo('Dragon arrow', 60)];
    expect(attackBonuses(items).prayer).toBe(1);
    expect(sumBonuses(items).rangedStr).toBe(95);
  });
});

describe('darts loaded in a blowpipe', () => {
  const weapon = (name: string, rangedStr: number): GearItem => ({
    id: 1, name, slot: 'Weapon', imageFile: 'x.png', speed: 2, twoHanded: true, category: 'Thrown',
    bonuses: bonuses({ ranged: 30, rangedStr }),
  });
  const dart = (id: number, name: string, rangedStr: number): GearItem => ({
    id, name, slot: 'Weapon', imageFile: 'x.png', speed: 3, twoHanded: false, category: 'Thrown',
    bonuses: bonuses({ ranged: 18, rangedStr }),
  });
  const DARTS = [dart(11, 'Dragon dart', 35), dart(12, 'Rune dart', 26), dart(13, 'Amethyst dart', 28),
    dart(14, 'Adamant dart', 17), dart(15, 'Dragon dart', 35), dart(16, 'Atlatl dart', 0), dart(17, 'Black dart', 6)];

  it('adds the dart\'s ranged strength to the blowpipe\'s', () => {
    // Wiki Toxic blowpipe: "using dragon darts on the charged blowpipe will increase its Ranged strength to +55".
    const pipe = weapon('Toxic blowpipe', 20);
    expect(attackBonuses([pipe], DARTS[0]).rangedStr).toBe(55);
    expect(attackBonuses([pipe], DARTS[0]).ranged).toBe(30); // only the strength stacks
    expect(attackBonuses([pipe]).rangedStr).toBe(20);
  });

  it('offers each dart kind once, weakest first, up to what the blowpipe takes', () => {
    expect(blowpipeDarts(weapon('Toxic blowpipe', 20), DARTS).map(d => d.name))
      .toEqual(['Black dart', 'Adamant dart', 'Rune dart', 'Amethyst dart', 'Dragon dart']);
    expect(blowpipeDarts(weapon('Rosewood blowpipe', 6), DARTS).map(d => d.name)).toEqual(['Black dart', 'Adamant dart', 'Rune dart']);
    expect(blowpipeDarts(weapon('Ironwood blowpipe', 4), DARTS).map(d => d.name)).toEqual(['Black dart', 'Adamant dart']);
    expect(blowpipeDarts(weapon('Magic shortbow', 0), DARTS)).toEqual([]);
  });

  it('ignores a dart the weapon cannot take', () => {
    expect(attackBonuses([weapon('Camphor blowpipe', 2)], DARTS[0]).rangedStr).toBe(2);
    expect(attackBonuses([weapon('Dragon dart', 35)], DARTS[0]).rangedStr).toBe(35);
  });
});
