import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import {
  COMBAT_POWERS_DESCRIPTION,
  COMBAT_POWERS_LABEL,
  tableDisplayName,
} from './tableDisplay';
import { SPEND_TABLES } from '../config/economy';

describe('Combat Powers presentation', () => {
  it('maps only the persistent Arcana table to Combat Powers', () => {
    expect(TableType.ARCANA).toBe('Arcana');
    expect(tableDisplayName(TableType.ARCANA)).toBe('Combat Powers');
    expect(tableDisplayName(TableType.BOSSES)).toBe('Bosses');
    expect(tableDisplayName(TableType.REGIONS)).toBe('Areas');
    expect(tableDisplayName(TableType.FARMING_LAYERS)).toBe('Farming');
    expect(tableDisplayName(TableType.SLAYER_UNLOCKS)).toBe('Slayer');
    // Every table on Spend Keys keeps the label its card shows.
    for (const table of SPEND_TABLES) expect(tableDisplayName(table.type)).toBe(table.label);
    expect(COMBAT_POWERS_LABEL).toBe('Combat Powers');
    expect(COMBAT_POWERS_DESCRIPTION).toBe(
      'Spellbooks, prayers, and special combat systems.',
    );
  });

  it('leaves the persisted save field named arcana', () => {
    const unlocks = { arcana: ['Dwarf Cannon'] };
    expect(unlocks.arcana).toEqual(['Dwarf Cannon']);
  });
});
