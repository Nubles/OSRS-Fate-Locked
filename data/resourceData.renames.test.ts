import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { RESOURCE_MAP, RESOURCE_CATEGORIES, RENAMED_RESOURCES, currentResourceList, currentResourceName, currentResourceQuantities } from './resourceData';
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

describe('names that were only Wiki redirects (resource-b.d1[3])', () => {
  // Wiki infobox names: 'Goat horn' (dropped by goats, Always), "Leviathan's
  // lure", 'Araxyte venom sac', 'Gorak claws'.
  renames([
    ['Desert Goat Horn', 'Goat Horn'], ['Leviathan Lure', "Leviathan's Lure"],
    ['Araxyte Venom Sack', 'Araxyte Venom Sac'], ['Gorak Claw', 'Gorak Claws'],
  ]);
  it('goat horn drops from goats every kill', () => {
    expect(RESOURCE_MAP['Goat Horn'][0]).toMatchObject({ type: 'DROP', name: 'Goat', rarity: 'Always' });
  });
});

describe('one vial (resource-b.d4[2])', () => {
  // Wiki 'Empty vial': an untradeable Lunar Diplomacy quest item. The shop and
  // glassblowing item is 'Vial' ('An empty glass vial.').
  renames([['Empty Vial', 'Vial']]);
  it('the vial card holds the shop and glassblowing routes', () => {
    const names = RESOURCE_MAP['Vial'].filter(s => !s.requirementsUnverified).map(s => s.name);
    expect(names).toEqual(expect.arrayContaining(['Glassblowing', 'Herblore Shop', 'General Store']));
    expect(RESOURCE_CATEGORIES['Tools & Containers']).toContain('Vial');
    expect(categorised.filter(n => n === 'Vial')).toHaveLength(1);
  });
  it('filling a vial at a fountain needs a vial', () => {
    const fountain = RESOURCE_MAP['Vial of Water'].find(s => s.name === 'Use Vial on Fountain');
    expect(fountain?.inputs).toEqual({ Vial: 1 });
  });
  it('stored quantities under both names add up', () => {
    expect(currentResourceQuantities({ 'Empty Vial': 5, Vial: 3, Logs: 2 }, true)).toEqual({ Vial: 8, Logs: 2 });
    expect(currentResourceQuantities({ 'Empty Vial': 5, Nope: 1, Bad: -1 }, false)).toEqual({ Vial: 5, Nope: 1 });
  });
  it('stored lists keep one entry per item', () => {
    expect(currentResourceList(['Empty Vial', 'Vial', 'Logs', 7, 'Nope'])).toEqual(['Vial', 'Logs']);
  });
});
