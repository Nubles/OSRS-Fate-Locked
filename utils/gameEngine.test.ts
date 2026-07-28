import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { REGION_GROUPS } from '../data/items';
import { getPoolAndStateKey } from './gameEngine';

describe('canonical Regions unlock pool', () => {
  it('offers Iorwerth Camp once and never offers the legacy Elf Camp name', () => {
    const { pool, stateKey } = getPoolAndStateKey(TableType.REGIONS);
    expect(stateKey).toBe('region');
    expect(pool.filter((name) => name === 'Iorwerth Camp')).toHaveLength(1);
    expect(pool).not.toContain('Elf Camp');
    expect(REGION_GROUPS.Tirannwn).toEqual([
      'Prifddinas',
      'Lletya',
      'Tyras Camp',
      'Isafdar',
      'Zul-Andra',
      'Arandar',
      'Gwenith',
      'Iorwerth Camp',
      'Poison Waste',
    ]);
  });
});
