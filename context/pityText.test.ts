import { describe, expect, it } from 'vitest';
import { createFreshState, gameReducerForTest as reduce, prepareKeyRollAction } from './GameContext';
import type { GameState } from '../types';

/** One missed Key roll (the highest die) in the given mode. */
const missIn = (modeId: string) => {
  let s = { ...createFreshState(), lastEvent: null } as GameState;
  s = reduce(s, { type: 'SET_GAME_MODE', payload: { modeId } } as never) as GameState;
  s = reduce(s, prepareKeyRollAction(s, 'Novice', 1, 3, (_p: string, _i = 0, max = 100) => max)) as GameState;
  return s.history.at(-1)!;
};

describe("a missed roll's history entry", () => {
  it('shows no pity bar when the mode has pity off', () => {
    const entry = missIn('hardcore');
    expect(entry.type).toBe('ROLL_FAIL');
    expect(entry.details).toMatch(/Fate: 3(?!\/)/);
    expect(entry.details).not.toContain('/50');
  });

  it('keeps the pity bar when pity is on', () => {
    expect(missIn('vanilla').details).toContain('Fate: 3/50');
  });
});
