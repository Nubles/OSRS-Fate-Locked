import { describe, expect, it } from 'vitest';
import { createFreshState, gameReducer, type Action } from './GameContext';
import { QUEST_DATA } from '../data/questData';
import { mercyQuietLeft } from '../utils/chunkedFate';
import type { GameState } from '../types';

const DAY = 24 * 60 * 60 * 1000;
// A Chunked run that has gone 3 quiet days: Fate's Mercy's quiet spell is over.
const quiet = (): GameState => ({ ...createFreshState(), gameModeId: 'chunked', chunkedProgressAt: Date.now() - 3 * DAY - 1000, lastEvent: null });
const after = (...actions: Action[]) => actions.reduce(gameReducer, quiet());

// The Codex: "if 3 days pass with no new Key, unlock or level, Mercy opens anyway".
describe("Fate's Mercy's quiet spell counts only a Key, an unlock or a level (audit context-b 0)", () => {
  it('is not restarted by logging a collection log item, new or a duplicate', () => {
    expect(mercyQuietLeft(quiet())).toBe(0);
    expect(mercyQuietLeft(after({ type: 'LOG_ITEM', payload: 4151 } as Action))).toBe(0);
    expect(mercyQuietLeft(after({ type: 'LOG_ITEM', payload: 4151 } as Action, { type: 'LOG_ITEM', payload: 4151 } as Action))).toBe(0);
  });

  it('is not restarted by ticking a quest, diary, Combat Achievement or task', () => {
    expect(mercyQuietLeft(after({ type: 'COMPLETE_QUEST', payload: Object.keys(QUEST_DATA)[0] } as Action))).toBe(0);
    expect(mercyQuietLeft(after({ type: 'COMPLETE_DIARY', payload: 'Ardougne Easy' } as Action))).toBe(0);
    expect(mercyQuietLeft(after({ type: 'COMPLETE_CA', payload: 'Easy' } as Action))).toBe(0);
    expect(mercyQuietLeft(after({ type: 'COMPLETE_TASK', payload: 'some-task' } as Action))).toBe(0);
  });

  it('is restarted by a level', () => {
    expect(mercyQuietLeft(after({ type: 'LEVEL_UP', payload: { skill: 'Attack' } } as Action))).toBeGreaterThan(2 * DAY);
  });
});
