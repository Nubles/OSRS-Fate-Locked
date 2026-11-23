import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { RESOURCE_MAP, RESOURCE_CATEGORIES, RENAMED_RESOURCES, currentResourceName } from './resourceData';
import { calculateEngineItemProgress } from '../utils/supplyChain';
import { buildGoalRoute } from '../utils/goalRoute';

// Resource items listed under a name the game does not use (November 2026
// deep audit). Saves can hold the old name as a pinned goal or in the
// calculator's stored lists, so each old name must still resolve.
const oldSave = (pinnedGoals: string[]): GameState => ({
  keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0,
  unlocks: {
    equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  },
  history: [], pinnedGoals, userNotes: {}, activeBuff: 'NONE',
  animationsEnabled: true, hasSeenOnboarding: true,
  gameModeId: 'standard', gameModeLocked: false, customMode: undefined, version: 1,
} as GameState);

const categorised = Object.values(RESOURCE_CATEGORIES).flat();
const renames = (pairs: [string, string][]) => {
  it.each(pairs)('%s is now %s', (oldName, newName) => {
    expect(RESOURCE_MAP[oldName]).toBeUndefined();
    expect(RESOURCE_MAP[newName]?.length).toBeGreaterThan(0);
    expect(RENAMED_RESOURCES[oldName]).toBe(newName);
    expect(currentResourceName(oldName)).toBe(newName);
    expect(categorised).toContain(newName);
    expect(categorised).not.toContain(oldName);
    for (const sources of Object.values(RESOURCE_MAP)) {
      for (const s of sources) expect(Object.keys(s.inputs ?? {})).not.toContain(oldName);
    }
  });
  it.each(pairs)('a goal pinned as %s keeps its route', (oldName, newName) => {
    const save = oldSave([oldName]);
    expect(calculateEngineItemProgress(oldName, save)).toEqual(calculateEngineItemProgress(newName, save));
    const route = buildGoalRoute(oldName, save);
    expect(route?.kind).toBe('engine-item');
    expect(route?.sources.length).toBeGreaterThan(0);
  });
};

describe('game item names (resource-a.d1[7])', () => {
  // Wiki 'Steel cannonball': renamed from Cannonball on 5 November 2025.
  // Wiki 'Elemental metal': the bar's name; 'Elemental bar' is a redirect.
  renames([['Cannonball', 'Steel Cannonball'], ['Elemental Bar', 'Elemental Metal']]);
});
