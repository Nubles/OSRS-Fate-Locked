import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { RESOURCE_MAP } from '../data/resourceData';
import { calculateEngineItemProgress } from './supplyChain';
import { buildGoalRoute } from './goalRoute';

// A save made before 3 November 2026 can hold a Resource Engine goal pinned
// under the item's old name. The goal must keep its card and route, so the
// player can still see it and unpin it.
const oldSave = (): GameState => ({
  keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0,
  unlocks: {
    equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  },
  history: [], pinnedGoals: ['Steel Sword', 'Rune Sword'], userNotes: {}, activeBuff: 'NONE',
  animationsEnabled: true, hasSeenOnboarding: true,
  gameModeId: 'standard', gameModeLocked: false, customMode: undefined, version: 1,
} as GameState);

describe('goals pinned under a renamed item', () => {
  it.each(['Steel Sword', 'Rune Sword'])('%s still has engine progress', (stored) => {
    const state = oldSave();
    expect(state.pinnedGoals).toContain(stored);
    expect(RESOURCE_MAP[stored]).toBeUndefined();
    const progress = calculateEngineItemProgress(stored, state);
    expect(progress).not.toBeNull();
    expect(progress).toEqual(calculateEngineItemProgress(stored.replace('Sword', 'Shortsword'), state));
  });

  it('still builds the route for the old id', () => {
    const route = buildGoalRoute('Steel Sword', oldSave());
    expect(route?.kind).toBe('engine-item');
    expect(route?.goalId).toBe('Steel Sword');
    expect(route?.sources.length).toBeGreaterThan(0);
  });

  it('still returns nothing for names the engine never had', () => {
    expect(calculateEngineItemProgress('No Such Item', oldSave())).toBeNull();
  });
});
