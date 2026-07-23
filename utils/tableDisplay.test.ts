import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import {
  COMBAT_POWERS_DESCRIPTION,
  COMBAT_POWERS_LABEL,
  tableDisplayName,
} from './tableDisplay';

describe('Combat Powers presentation', () => {
  it('maps only the persistent Arcana table to Combat Powers', () => {
    expect(TableType.ARCANA).toBe('Arcana');
    expect(tableDisplayName(TableType.ARCANA)).toBe('Combat Powers');
    expect(tableDisplayName(TableType.BOSSES)).toBe('Bosses');
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
