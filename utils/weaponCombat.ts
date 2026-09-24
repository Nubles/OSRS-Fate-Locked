import type { AttackType, Style } from './dps';

export interface WeaponCombatOption {
  style: Style;
  attackType: AttackType;
  stanceId: string;
  /** Ordinary spell casting is five ticks, independent of melee weapon speed. */
  speedTicks?: number;
}

type Option = readonly [AttackType, string];
const crush: readonly Option[] = [['crush', 'accurate'], ['crush', 'aggressive'], ['crush', 'defensive']];
const slashCrush: readonly Option[] = [['slash', 'accurate'], ['slash', 'aggressive'], ['crush', 'aggressive'], ['slash', 'defensive']];
const slashStab: readonly Option[] = [['slash', 'accurate'], ['slash', 'aggressive'], ['stab', 'controlled'], ['slash', 'defensive']];
const stabCrush: readonly Option[] = [['stab', 'accurate'], ['stab', 'aggressive'], ['crush', 'aggressive'], ['stab', 'defensive']];
const ranged: readonly Option[] = [['ranged', 'accurate'], ['ranged', 'rapid'], ['ranged', 'longrange']];
const powered: readonly Option[] = [['magic', 'accurate'], ['magic', 'longrange']];

// Category facts reviewed against the Wiki weapon tables and its DPS calculator:
// https://oldschool.runescape.wiki/w/Weapons/Categories
// https://github.com/weirdgloop/osrs-dps-calc/blob/main/src/utils.ts#getCombatStylesForCategory
// Empty/unknown categories intentionally have no inferred weapon attacks.
const OPTIONS: Readonly<Record<string, readonly Option[]>> = {
  '2h sword': slashCrush, axe: slashCrush, scythe: slashCrush,
  'slash sword': slashStab, claw: slashStab,
  'stab sword': [['stab', 'accurate'], ['stab', 'aggressive'], ['slash', 'aggressive'], ['stab', 'defensive']],
  pickaxe: stabCrush, partisan: stabCrush,
  'multi-melee': [['stab', 'accurate'], ['slash', 'aggressive'], ['crush', 'aggressive'], ['slash', 'defensive']],
  banner: [['stab', 'accurate'], ['slash', 'aggressive'], ['crush', 'controlled'], ['stab', 'defensive']],
  spear: [['stab', 'controlled'], ['slash', 'controlled'], ['crush', 'controlled'], ['stab', 'defensive']],
  polearm: [['stab', 'controlled'], ['slash', 'aggressive'], ['stab', 'defensive']],
  spiked: [...crush, ['stab', 'controlled']],
  whip: [['slash', 'accurate'], ['slash', 'controlled'], ['slash', 'defensive']],
  flail: [['slash', 'accurate'], ['slash', 'aggressive'], ['slash', 'defensive']],
  blunt: crush, polestaff: crush, unarmed: crush, staff: crush,
  bludgeon: [['crush', 'aggressive']], bulwark: [['crush', 'accurate']],
  'bladed staff': [['stab', 'accurate'], ['slash', 'aggressive'], ['crush', 'defensive']],
  bow: ranged, crossbow: ranged, thrown: ranged, chinchompas: ranged,
  'powered staff': powered, 'powered wand': powered,
  salamander: [['slash', 'aggressive'], ['ranged', 'rapid'], ['magic', 'defensive']],
};

export function weaponCombatOptions(category?: string): readonly WeaponCombatOption[] {
  const options = OPTIONS[(category ?? '').trim().toLowerCase()];
  if (!options) return [];
  return options.map(([attackType, stanceId]) => ({
    style: attackType === 'ranged' ? 'ranged' : attackType === 'magic' ? 'magic' : 'melee',
    attackType,
    stanceId,
  }));
}

/** Manual spell casting remains possible with ordinary weapons; it is not melee. */
export function dpsCombatOptions(category?: string): readonly WeaponCombatOption[] {
  const options = weaponCombatOptions(category);
  if (!options.length) return [];
  return [...options, { style: 'magic', attackType: 'magic', stanceId: 'standard', speedTicks: 5 }];
}
