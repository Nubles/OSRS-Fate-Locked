import { describe, expect, it } from 'vitest';
import { GAME_MODES, getGameMode } from './gameModes';
import { BREAKTHROUGH_CHANCE } from './economy';

describe('the game modes a player can pick', () => {
  it('share the values the Rules page lists for both modes', () => {
    const [first] = GAME_MODES;
    for (const mode of GAME_MODES) {
      expect(mode.rules.pityEnabled, mode.id).toBe(first.rules.pityEnabled);
      expect(mode.rules.pityThreshold, mode.id).toBe(first.rules.pityThreshold);
      expect(mode.rules.omniChanceBase, mode.id).toBe(first.rules.omniChanceBase);
      expect(mode.rules.ritualCostMultiplier, mode.id).toBe(first.rules.ritualCostMultiplier);
      expect(mode.rules.regionModifiers, mode.id).toBe(false);
      expect(mode.rules.bankLocks, mode.id).toBe(true);
    }
  });

  it('describe Chunked as in Chunk Locked, with no guaranteed start-chunk Keys', () => {
    const chunked = getGameMode('chunked');
    expect(chunked.description).toMatch(/^One chunk at a time, as in Chunk Locked ironman\./);
    expect(chunked.description).not.toMatch(/guaranteed Key|total levels/);
    expect(chunked.description).toContain(
      `A skill at its cap gets one ${BREAKTHROUGH_CHANCE * 100}% Breakthrough roll to open its next tier`,
    );
    expect(chunked.description).not.toMatch(/Chunked Ironman|classic|documented/);
  });
});
