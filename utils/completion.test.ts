import { describe, expect, it } from 'vitest';
import { REGIONS_LIST } from '../data/items';
import { COMPLETION_DENOMINATOR } from './completion';

describe('canonical area completion accounting', () => {
  it('pins physical-overlap area count in the global denominator', () => {
    expect(REGIONS_LIST).toHaveLength(176);
    expect(REGIONS_LIST).not.toContain('Elf Camp');
    expect(COMPLETION_DENOMINATOR).toBe(946);
  });
});
