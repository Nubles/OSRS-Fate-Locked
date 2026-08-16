/**
 * Curated Slayer-master access rules that are not represented by the
 * generated assignment tables. Assignment requirements remain in the Chunk
 * Picker data; these rules determine whether a master can assign any task.
 */
export interface SlayerMasterRequirementOption {
  label: string;
  skills?: Record<string, number>;
  combatLevel?: number;
}

export interface SlayerMasterRequirement {
  areas?: string[];
  quests?: string[];
  oneOf?: SlayerMasterRequirementOption[];
}

export const SLAYER_MASTER_REQUIREMENTS: Record<string, SlayerMasterRequirement> = {
  Mortimer: {
    areas: ['Wyrmscraig'],
    quests: ['Fallen From Grace'],
    oneOf: [
      { label: 'Slayer 99', skills: { Slayer: 99 } },
      { label: 'Slayer 70 + Combat 100', skills: { Slayer: 70 }, combatLevel: 100 },
    ],
  },
};
