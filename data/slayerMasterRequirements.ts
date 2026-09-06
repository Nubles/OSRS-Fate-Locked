/**
 * Curated Slayer-master access rules that are not represented by the
 * generated assignment tables. Assignment requirements remain in the Chunk
 * Picker data; these rules determine whether a master can assign any task.
 */
export interface SlayerMasterRequirementOption {
  label: string;
  skills?: Record<string, number>;
  combatLevel?: number;
  requiresSlayerCape?: boolean;
}

export interface SlayerMasterRequirement {
  areas?: string[];
  quests?: string[];
  oneOf?: SlayerMasterRequirementOption[];
}

export const SLAYER_MASTER_REQUIREMENTS: Record<string, SlayerMasterRequirement> = {
  Turael: {
    areas: ['Burthorpe'],
  },
  Spria: {
    areas: ['Draynor Village'],
    quests: ['A Porcine of Interest'],
  },
  Krystilia: {
    areas: ['Edgeville'],
  },
  Mazchna: {
    areas: ['Canifis'],
    quests: ['Priest in Peril'],
    oneOf: [
      { label: 'Slayer cape', skills: { Slayer: 99 }, requiresSlayerCape: true },
      { label: 'Combat level 20', combatLevel: 20 },
    ],
  },
  Vannaka: {
    areas: ['Edgeville'],
    oneOf: [
      { label: 'Slayer cape', skills: { Slayer: 99 }, requiresSlayerCape: true },
      { label: 'Combat level 40', combatLevel: 40 },
    ],
  },
  Chaeldar: {
    areas: ['Zanaris'],
    quests: ['Lost City'],
    oneOf: [
      { label: 'Slayer cape', skills: { Slayer: 99 }, requiresSlayerCape: true },
      { label: 'Combat level 70', combatLevel: 70 },
    ],
  },
  'Konar quo Maten': {
    areas: ['Mount Karuulm'],
    oneOf: [
      { label: 'Slayer cape', skills: { Slayer: 99 }, requiresSlayerCape: true },
      { label: 'Combat level 75', combatLevel: 75 },
    ],
  },
  Nieve: {
    areas: ['Tree Gnome Stronghold'],
    oneOf: [
      { label: 'Slayer cape', skills: { Slayer: 99 }, requiresSlayerCape: true },
      { label: 'Combat level 85', combatLevel: 85 },
    ],
  },
  Duradel: {
    areas: ['Shilo Village'],
    quests: ['Shilo Village'],
    oneOf: [
      { label: 'Slayer cape', skills: { Slayer: 99 }, requiresSlayerCape: true },
      { label: 'Slayer 50 + Combat level 100', skills: { Slayer: 50 }, combatLevel: 100 },
    ],
  },
  Mortimer: {
    areas: ['Wyrmscraig'],
    quests: ['Fallen From Grace'],
    oneOf: [
      { label: 'Slayer 99', skills: { Slayer: 99 } },
      { label: 'Slayer 70 + Combat 100', skills: { Slayer: 70 }, combatLevel: 100 },
    ],
  },
};
