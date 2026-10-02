import { TableType } from '../types';

export const COMBAT_POWERS_LABEL = 'Combat Powers' as const;
export const COMBAT_POWERS_DESCRIPTION =
  'Spellbooks, prayers, and special combat systems.' as const;

/** The tables whose Spend Keys label differs from their saved type name. */
const DISPLAY_NAMES: Partial<Record<string, string>> = {
  [TableType.ARCANA]: COMBAT_POWERS_LABEL,
  [TableType.REGIONS]: 'Areas',
  [TableType.FARMING_LAYERS]: 'Farming',
  [TableType.SLAYER_UNLOCKS]: 'Slayer',
};

/** A table's name as players see it on Spend Keys. Saves and history keep the type name. */
export const tableDisplayName = (table: string): string => DISPLAY_NAMES[table] ?? table;
