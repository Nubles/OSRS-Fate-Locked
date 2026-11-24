/**
 * Types + bonus summation for real-gear loadouts.
 *
 * `GearItem` is our normalised shape for an equippable OSRS item (built by
 * GearService from the weirdgloop dps-calc dataset). `GearBonuses` mirrors the
 * standard equipment-stats groups shown in the OSRS DPS tool. Pure + tested.
 */

import type { RangedDamageType } from './rangedDamage';

export interface GearBonuses {
  // Attack (offensive)
  stab: number;
  slash: number;
  crush: number;
  magic: number;
  ranged: number;
  // Defence
  defStab: number;
  defSlash: number;
  defCrush: number;
  defMagic: number;
  defRanged: number;
  // Other
  meleeStr: number;
  rangedStr: number;
  magicStr: number; // magic damage %
  prayer: number;
}

export interface GearItem {
  id: number;
  name: string;
  /** One of our 11 EQUIPMENT_SLOTS. */
  slot: string;
  /** OSRS Wiki image filename (spaces → underscores when building the URL). */
  imageFile: string;
  speed: number;
  twoHanded: boolean;
  /** Reviewed upstream combat category; absent means attack options are unknown. */
  category?: string;
  rangedDamageType?: RangedDamageType;
  bonuses: GearBonuses;
}

export const ZERO_BONUSES: GearBonuses = {
  stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0,
  defStab: 0, defSlash: 0, defCrush: 0, defMagic: 0, defRanged: 0,
  meleeStr: 0, rangedStr: 0, magicStr: 0, prayer: 0,
};

/** True when an item carries no equipment bonuses at all (a pure cosmetic). */
export const hasNoBonuses = (b: GearBonuses): boolean =>
  (Object.keys(ZERO_BONUSES) as (keyof GearBonuses)[]).every((k) => b[k] === 0);

/** Sum the bonuses of a set of equipped items. */
export const sumBonuses = (items: GearItem[]): GearBonuses => {
  const total: GearBonuses = { ...ZERO_BONUSES };
  for (const it of items) {
    (Object.keys(total) as (keyof GearBonuses)[]).forEach((k) => {
      total[k] += it.bonuses[k] || 0;
    });
  }
  return total;
};

// Bows that draw charges or make their own arrows; their ammo slot never
// fires. The venator bow is not one: its charges power the bounce, and it
// still fires arrows. No items can be brought into the Gauntlet, so its
// corrupted bow never has arrows either.
const NO_AMMO_BOW = /^(crystal bow|bow of faerdhinen|craw's bow|webweaver bow|starter bow|corrupted bow)\b/i;
const ARROW = /\barrows?\b|\bbrutal\b/i;
const BOLT = /\bbolts?\b|\bbolt rack\b/i;
const OGRE_AMMO = /^ogre arrow|\bbrutal\b/i;

// Ammunition strength ladders: a weapon fires every rung up to its own cap.
// Ammo with no rung (ice arrows, gem-tipped bolts and so on) is not capped,
// except by a weapon whose Wiki page says it fires only the listed kinds.
const ARROW_RUNG = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'amethyst', 'dragon'];
const arrowRung = (name: string): number | undefined => {
  const m = /^(?:seeking )?(bronze|iron|steel|mithril|adamant|rune|amethyst|dragon)\b/i.exec(name);
  return m ? ARROW_RUNG.indexOf(m[1].toLowerCase()) + 1 : undefined;
};
// Wiki pages, Nov 2026: Dragon bolts and "X dragon bolts" (Ranged 64, as the
// dragon crossbow) only from dragon-bolt crossbows; Broad and Amethyst broad
// bolts only from the rune crossbow and up; Blurite bolts from a blurite
// crossbow or better; Silver bolts from an iron crossbow or better; Barbed
// bolts from any standard crossbow; Emerald bolts need a level 36 crossbow.
const boltRung = (name: string): number | undefined => {
  if (/dragon bolts/i.test(name)) return 7;
  if (/broad bolts/i.test(name)) return 6;
  const m = /^(bronze|iron|steel|mithril|adamant|runite) bolts/i.exec(name);
  if (m) return ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'runite'].indexOf(m[1].toLowerCase()) + 1;
  if (/^barbed bolts/i.test(name)) return 1;
  if (/^blurite bolts/i.test(name)) return 1.5;
  if (/^silver bolts/i.test(name)) return 2;
  if (/^emerald bolts/i.test(name)) return 4;
  return undefined;
};

// [weapon, highest rung, fires only laddered ammo]. From each weapon's Wiki
// page ("can use arrows up to steel", "can only fire bronze bolts"). A bow not
// listed tops out below dragon arrows, which the Dragon arrow page allows only
// from the bows in the last row (plus Nature's recurve, whose page says so).
const BOW_CAP: [RegExp, number, boolean?][] = [
  [/^rain bow\b/i, 2, true],
  [/^(shortbow|longbow|cursed goblin bow)\b/i, 2],
  [/^(oak shortbow|oak longbow|signed oak bow)\b/i, 3],
  [/^willow (shortbow|longbow|comp bow)\b/i, 4],
  [/^maple (shortbow|longbow)\b/i, 5],
  [/^yew (shortbow|longbow)\b/i, 6],
  [/^(dark bow|twisted bow|venator bow|echo venator bow|scorching bow|3rd age bow|nature's recurve)\b/i, 8],
];
const CROSSBOW_CAP: [RegExp, number, boolean?][] = [
  [/^(crossbow|bronze crossbow|phoenix crossbow)\b/i, 1, true],
  [/^blurite crossbow\b/i, 1.5, true],
  [/^iron crossbow\b/i, 2],
  [/^steel crossbow\b/i, 3],
  [/^mithril crossbow\b/i, 4],
  [/^adamant crossbow\b/i, 5],
  [/^rune crossbow\b/i, 6],
  [/^(dragon crossbow|armadyl crossbow|dragon hunter crossbow|zaryte crossbow|king's barrage)\b/i, 7],
];
const withinCap = (caps: [RegExp, number, boolean?][], weaponName: string, rung: number | undefined, fallbackCap: number): boolean => {
  const [, cap, strict] = caps.find(([re]) => re.test(weaponName)) ?? [null, fallbackCap, false];
  return rung === undefined ? !strict : rung <= cap;
};

const bowFires = (bow: string, ammo: string): boolean => {
  if (NO_AMMO_BOW.test(bow) || !ARROW.test(ammo)) return false;
  if (/^training (short)?bow\b/i.test(bow) || /^training arrows/i.test(ammo)) return /^training (short)?bow\b/i.test(bow) && /^training arrows/i.test(ammo);
  // "ogre arrows as well as brutal arrows up to mithril brutals" (Ogre bow);
  // "any type of brutal arrow, as well as ogre arrows" (Comp ogre bow).
  const ogreBow = /^(comp ogre bow|ogre bow)\b/i.test(bow);
  if (ogreBow || OGRE_AMMO.test(ammo)) {
    if (!ogreBow || !OGRE_AMMO.test(ammo)) return false;
    if (/^comp/i.test(bow) || !/brutal/i.test(ammo)) return true;
    // Black brutals sit below mithril on the brutal ladder; left as fired.
    return /^black brutal/i.test(ammo) || (arrowRung(ammo) ?? Infinity) <= 4;
  }
  return withinCap(BOW_CAP, bow, arrowRung(ammo), 7);
};

const crossbowFires = (crossbow: string, ammo: string): boolean => {
  if (/ballista/i.test(crossbow)) return /javelin/i.test(ammo);
  if (!BOLT.test(ammo)) return false;
  // Exclusive pairs: "exclusively used by the Karil's crossbow" (Bolt rack);
  // "can only be used with the Dorgeshuun crossbow" (Bone bolts); the hunters'
  // crossbow "can only use kebbit bolts and long kebbit bolts", and the
  // sunlight one "cannot be used to fire kebbit or long kebbit bolts".
  if (/bolt rack/i.test(ammo)) return /^karil's crossbow/i.test(crossbow);
  if (/^bone bolts/i.test(ammo)) return /^dorgeshuun crossbow/i.test(crossbow);
  const kebbit = /kebbit bolts/i.test(ammo);
  if (/^hunters' crossbow/i.test(crossbow)) return kebbit;
  if (kebbit) return false;
  // Runite, broad and dragon bolts each list every crossbow that fires them,
  // so a crossbow not in the table stops below them.
  return withinCap(CROSSBOW_CAP, crossbow, boltRung(ammo), 5);
};

/**
 * Does the weapon fire the ammunition in the Ammo slot? Only then does the
 * ammo's ranged strength count toward an attack: darts, knives, blowpipes,
 * chinchompas and crystal bows ignore it, and bows need arrows they can fire,
 * crossbows bolts they can fire, ballistas javelins, the atlatl its darts and
 * salamanders tar.
 */
export const weaponFiresAmmo = (weapon: GearItem | undefined, ammo: GearItem): boolean => {
  if (!weapon) return false;
  const name = ammo.name;
  switch (weapon.category) {
    case 'Bow':
      if (/^eclipse atlatl\b/i.test(weapon.name)) return /atlatl dart/i.test(name);
      return bowFires(weapon.name, name);
    case 'Crossbow':
      return crossbowFires(weapon.name, name);
    case 'Salamander':
      return /\btar\b/i.test(name);
    default:
      return false;
  }
};

/**
 * Bonuses that apply to an attack. The in-game stats screen (and sumBonuses)
 * still includes the ammo slot, but its ranged strength only adds damage when
 * the weapon fires that ammunition.
 */
export const attackBonuses = (items: GearItem[]): GearBonuses => {
  const total = sumBonuses(items);
  const weapon = items.find(item => item.slot === 'Weapon');
  const ammo = items.find(item => item.slot === 'Ammo');
  if (ammo && !weaponFiresAmmo(weapon, ammo)) total.rangedStr -= ammo.bonuses.rangedStr || 0;
  return total;
};

/** Display grouping for the stats panel. */
export const BONUS_GROUPS: { label: string; rows: { key: keyof GearBonuses; label: string; pct?: boolean }[] }[] = [
  {
    label: 'Attack bonus',
    rows: [
      { key: 'stab', label: 'Stab' },
      { key: 'slash', label: 'Slash' },
      { key: 'crush', label: 'Crush' },
      { key: 'magic', label: 'Magic' },
      { key: 'ranged', label: 'Ranged' },
    ],
  },
  {
    label: 'Defence bonus',
    rows: [
      { key: 'defStab', label: 'Stab' },
      { key: 'defSlash', label: 'Slash' },
      { key: 'defCrush', label: 'Crush' },
      { key: 'defMagic', label: 'Magic' },
      { key: 'defRanged', label: 'Ranged' },
    ],
  },
  {
    label: 'Other bonus',
    rows: [
      { key: 'meleeStr', label: 'Melee str' },
      { key: 'rangedStr', label: 'Ranged str' },
      { key: 'magicStr', label: 'Magic dmg', pct: true },
      { key: 'prayer', label: 'Prayer' },
    ],
  },
];
