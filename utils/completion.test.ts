import { describe, expect, it } from 'vitest';
import { REGIONS_LIST } from '../data/items';
import { COMPLETION_DENOMINATOR, playerUnlockPoints } from './completion';

describe('canonical area completion accounting', () => {
  it('pins physical-overlap area count in the global denominator', () => {
    expect(REGIONS_LIST).toHaveLength(177);
    expect(REGIONS_LIST).not.toContain('Elf Camp');
    expect(COMPLETION_DENOMINATOR).toBe(975);
  });

  it('does not award completion for pending overlap refund markers', () => {
    const points = playerUnlockPoints({
      regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"],
      skills: {}, equipment: {}, mobility: [], arcana: [], housing: [], merchants: [],
      minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    } as any);

    expect(points).toBe(2);
  });
});
