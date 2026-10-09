import { describe, expect, it } from 'vitest';
import { GAME_MODES, getGameMode } from './gameModes';
import { CHUNKED_MILESTONE_INTERVAL } from './economy';

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

  it('describe Chunked as in Chunk Locked, with its all-game milestone Keys and Skills rule', () => {
    const chunked = getGameMode('chunked');
    expect(chunked.description).toMatch(/^One chunk at a time, as in Chunk Locked ironman\./);
    expect(chunked.description).toContain(
      `Every ${CHUNKED_MILESTONE_INTERVAL} total levels gives you a guaranteed Key, all game, and a Skills Key only rolls skills your chunks can train.`,
    );
    expect(chunked.description).not.toMatch(/Chunked Ironman|classic|documented/);
  });
});
