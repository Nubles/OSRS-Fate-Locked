import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { hopeKey, hopeLine, hopeOdds, hopeParts, hopesInPool, isHoped } from './hopes';

describe('hope list', () => {
  it('keys an entry by its table and id', () => {
    expect(hopeKey(TableType.BOSSES, 'Vorkath')).toBe('Bosses|Vorkath');
    expect(hopeParts('Banks|12850')).toEqual({ table: 'Banks', id: '12850' });
    expect(hopeParts('Bosses|A|B')).toEqual({ table: 'Bosses', id: 'A|B' });
    expect(isHoped(['Bosses|Vorkath'], TableType.BOSSES, 'Vorkath')).toBe(true);
    expect(isHoped(['Bosses|Vorkath'], TableType.MINIGAMES, 'Vorkath')).toBe(false);
    expect(isHoped(undefined, TableType.BOSSES, 'Vorkath')).toBe(false);
  });

  it('counts only hopes a Key on that table could draw now', () => {
    const hopes = ['Bosses|Vorkath', 'Bosses|Zulrah', 'Regions|Morytania'];
    expect(hopesInPool(hopes, TableType.BOSSES, ['Vorkath', 'Obor'])).toEqual(['Vorkath']);
    expect(hopesInPool(hopes, TableType.REGIONS, ['Morytania'])).toEqual(['Morytania']);
    expect(hopesInPool(undefined, TableType.BOSSES, ['Vorkath'])).toEqual([]);
  });

  it('words the odds per Key', () => {
    expect(hopeOdds(2, 66)).toBe('1 in 33');
    expect(hopeOdds(3, 3)).toBe('every draw');
    expect(hopeOdds(0, 10)).toBe('');
    expect(hopeLine(1, 10)).toBe('1 of your hopes is on this table: 1 in 10 per Key.');
    expect(hopeLine(2, 66)).toBe('2 of your hopes are on this table: 1 in 33 per Key.');
  });
});
