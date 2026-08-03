// Per-continent passive modifiers — active only when a run's game mode has
// `regionModifiers` enabled (e.g. the "Region Rush" mode).
//
// A continent's passive activates as soon as the player has unlocked at least
// one region inside it, so exploration is continuously rewarded. Bonuses stack
// across every touched continent.

import { REGION_GROUPS, MISTHALIN_AREAS } from '../data/items';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';

export interface RegionModifier {
  continent: string;
  /** Flavour name of the passive. */
  name: string;
  /** Short human-readable effect summary. */
  description: string;
  /** Flat percentage points added to a roll's success threshold. */
  successBonus: number;
  /** Flat percentage points added to the Omni-key chance. */
  omniBonus: number;
}

export const REGION_MODIFIERS: RegionModifier[] = [
  { continent: 'Misthalin',        name: 'Homeland Comfort',   description: '+2% roll success',            successBonus: 2,  omniBonus: 0 },
  { continent: 'Asgarnia',         name: 'Dwarven Fortune',    description: '+2% roll success',            successBonus: 2,  omniBonus: 0 },
  { continent: 'Kandarin',         name: "Seer's Insight",     description: '+1% success, +1% Omni',       successBonus: 1,  omniBonus: 1 },
  { continent: 'Karamja',          name: 'Volcanic Luck',      description: '+3% roll success',            successBonus: 3,  omniBonus: 0 },
  { continent: 'Kharidian Desert', name: 'Desert Mirage',      description: '+2% Omni chance',             successBonus: 0,  omniBonus: 2 },
  { continent: 'Morytania',        name: 'Cursed Bargain',     description: '+3% Omni, -1% success',       successBonus: -1, omniBonus: 3 },
  { continent: 'Fremennik',        name: 'Longhall Resolve',   description: '+2% roll success',            successBonus: 2,  omniBonus: 0 },
  { continent: 'Tirannwn',         name: 'Elven Precision',    description: '+2% Omni chance',             successBonus: 0,  omniBonus: 2 },
  { continent: 'Wilderness',       name: "Risk-Taker's Edge",  description: '+2% success, +2% Omni',       successBonus: 2,  omniBonus: 2 },
  { continent: 'Kourend & Kebos',  name: 'Favour of the Houses', description: '+2% roll success',          successBonus: 2,  omniBonus: 0 },
  { continent: 'Varlamore',        name: 'Sunlit Fortune',     description: '+1% success, +1% Omni',       successBonus: 1,  omniBonus: 1 },
  { continent: 'Islands & Others', name: "Explorer's Boon",    description: '+1% roll success',            successBonus: 1,  omniBonus: 0 },
  { continent: 'The Open Seas',    name: 'Pirate Plunder',     description: '+1% Omni chance',             successBonus: 0,  omniBonus: 1 },
];

const MODIFIER_BY_CONTINENT: Record<string, RegionModifier> = Object.fromEntries(
  REGION_MODIFIERS.map(m => [m.continent, m]),
);

/** Sub-regions belonging to a continent. */
const subRegionsOf = (continent: string): string[] =>
  continent === 'Misthalin' ? MISTHALIN_AREAS : (REGION_GROUPS[continent] ?? []);

/**
 * Resolve which continent passives are active for a given set of unlocked
 * regions, and the total stacked bonuses. Misthalin is always active (homeland).
 */
export const getActiveRegionBonuses = (unlockedRegions: string[]) => {
  const unlocked = new Set(visibleAreaUnlocks(unlockedRegions));
  let successBonus = 0;
  let omniBonus = 0;
  const active: RegionModifier[] = [];

  for (const mod of REGION_MODIFIERS) {
    const isActive =
      mod.continent === 'Misthalin' ||
      subRegionsOf(mod.continent).some(r => unlocked.has(r));
    if (isActive) {
      successBonus += mod.successBonus;
      omniBonus += mod.omniBonus;
      active.push(mod);
    }
  }

  return { successBonus, omniBonus, active };
};

export const getRegionModifier = (continent: string): RegionModifier | undefined =>
  MODIFIER_BY_CONTINENT[continent];
