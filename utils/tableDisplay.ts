import { TableType } from '../types';

export const COMBAT_POWERS_LABEL = 'Combat Powers' as const;
export const COMBAT_POWERS_DESCRIPTION =
  'Spellbooks, prayers, and special combat systems.' as const;

export const tableDisplayName = (table: string): string =>
  table === TableType.ARCANA ? COMBAT_POWERS_LABEL : table;
