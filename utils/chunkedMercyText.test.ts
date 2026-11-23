import { describe, expect, it } from 'vitest';
import { MERCY_QUIET_MS, mercyBlocker, skillsWithRoom, type FateState } from './chunkedFate';
import { mercyOpenText } from './chunkedMercyText';
import { initialState } from '../context/GameContext';
import { TableType } from '../types';

const now = Date.UTC(2026, 10, 22);

/** A fresh Chunked run with no Keys or Fate, Attack at tier 1 and level 3 (room to level). */
const run = (progressAgo: number): FateState => {
  const unlocks = structuredClone(initialState.unlocks);
  unlocks.skills = { ...unlocks.skills, Attack: 1 };
  unlocks.levels = { ...unlocks.levels, Attack: 3 };
  return {
    ...initialState, gameModeId: 'chunked', unlocks, keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0,
    chunkedBreakthroughs: {}, chunkedProgressAt: now - progressAgo, history: [],
  } as unknown as FateState;
};

describe("the line shown while Fate's Mercy is open", () => {
  it('says the quiet spell opened it, not that every skill is capped, when a skill still has room', () => {
    const quiet = run(MERCY_QUIET_MS + 1000);
    expect(skillsWithRoom(quiet)).toContain('Attack');
    expect(mercyBlocker(quiet, [], now)).toBeNull();
    const text = mercyOpenText(quiet, now, [{ table: TableType.CHUNKS, item: '50,50' }]);
    expect(text).toBe('You have no Keys, not enough Fate for a ritual, and nothing new has come for 3 days. Fate draws one neighbouring chunk or skill tier for you, free.');
    expect(text).not.toContain('tier cap');
  });

  it('says every skill is capped when that is why it opened', () => {
    const capped = run(0);
    capped.unlocks.levels = { ...capped.unlocks.levels, Attack: 10 };
    expect(skillsWithRoom(capped)).toEqual([]);
    expect(mercyOpenText(capped, now, [{ table: TableType.SKILLS, item: 'Attack' }]))
      .toBe('You have no Keys, not enough Fate for a ritual, and every skill you can train is at its tier cap. Fate draws one neighbouring chunk or skill tier for you, free.');
  });

  it('names the patch type, guild, merchant or gear slot draw once no chunk or skill tier is left', () => {
    expect(mercyOpenText(run(0), now, [{ table: TableType.GUILDS, item: 'Crafting Guild' }]))
      .toContain('No chunk or skill tier is left to draw, so Fate draws the patch type, guild, merchant or gear slot a skill needs, free.');
  });
});
