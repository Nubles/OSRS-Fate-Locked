import { describe, it, expect } from 'vitest';
import { buildGoalRoute, expandQuestChain, tierForLevel, suggestTables } from './goalRoute';
import { QUEST_DATA } from '../data/questData';
import { GameState, TableType } from '../types';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';

/** Minimal game state with the bits the route builder reads. */
const stateWith = (over: Partial<any> = {}): GameState => ({
  unlocks: {
    regions: [], skills: {}, levels: {}, quests: [], diaries: [],
    bosses: [], minigames: [], guilds: [], mobility: [], arcana: [],
    storage: [], housing: [], merchants: [], farming: [], slayerUnlocks: [], equipment: {},
    completedTasks: [], cas: [],
    ...over,
  },
} as unknown as GameState);

describe('tierForLevel', () => {
  it('maps levels to the tier that caps them', () => {
    expect(tierForLevel(1)).toBe(1);
    expect(tierForLevel(10)).toBe(1);
    expect(tierForLevel(11)).toBe(2);
    expect(tierForLevel(65)).toBe(7);
    expect(tierForLevel(70)).toBe(7);
    expect(tierForLevel(91)).toBe(10);
    expect(tierForLevel(99)).toBe(10);
  });
});

describe('expandQuestChain', () => {
  it('orders prerequisites before dependents, transitively', () => {
    const chain = expandQuestChain(["Legends' Quest"]);
    expect(chain[chain.length - 1]).toBe("Legends' Quest");
    // every prereq of every quest in the chain appears earlier in the chain
    for (let i = 0; i < chain.length; i++) {
      for (const p of QUEST_DATA[chain[i]].prereqs) {
        if (!QUEST_DATA[p]) continue;
        expect(chain.indexOf(p), `${p} should precede ${chain[i]}`).toBeLessThan(i);
      }
    }
    // transitivity: Legends' requires Shilo Village somewhere upstream
    expect(chain).toContain('Shilo Village');
  });

  it('dedupes shared prerequisites', () => {
    const chain = expandQuestChain(['Desert Treasure I', "Legends' Quest"]);
    const unique = new Set(chain);
    expect(unique.size).toBe(chain.length);
  });
});

describe('buildGoalRoute — strategy goal (Recipe for Disaster ≈ Barrows Gloves)', () => {
  it('produces the full transitive route on a fresh run', () => {
    const route = buildGoalRoute('Recipe for Disaster', stateWith())!;
    expect(route).not.toBeNull();
    expect(route.kind).toBe('strategy');

    // transitive quest chain, far deeper than the 4 direct prereqs
    expect(route.quests.length).toBeGreaterThan(10);
    const names = route.quests.map(q => q.name);
    expect(names).toContain('Desert Treasure I');
    expect(names).toContain('Shilo Village'); // via Legends' Quest
    expect(route.quests.every(q => !q.met)).toBe(true);

    // aggregated skills include chain demands, with tier mapping
    const cooking = route.skills.find(s => s.skill === 'Cooking')!;
    expect(cooking.needLevel).toBeGreaterThanOrEqual(70);
    expect(cooking.tierNeeded).toBe(tierForLevel(cooking.needLevel));
    expect(cooking.met).toBe(false);

    // regions aggregated from the chain (Desert Treasure pulls in the desert)
    expect(route.regions.some(r => r.name === 'Kharidian Desert')).toBe(true);

    // table suggestions exist and point at the Regions/Skills tables
    expect(route.tables.length).toBeGreaterThan(0);
    for (const t of route.tables) {
      expect(t.needed.length).toBeGreaterThan(0);
      expect(t.odds).toBeGreaterThan(0);
      expect(t.odds).toBeLessThanOrEqual(1);
    }

    expect(route.percentage).toBeLessThan(20);
  });

  it('marks met requirements as the run progresses', () => {
    const route = buildGoalRoute('Recipe for Disaster', stateWith({
      quests: ['Desert Treasure I'],
      regions: ['Al Kharid'],
      skills: { Cooking: 7 },
      levels: { Cooking: 70 },
    }))!;
    expect(route.quests.find(q => q.name === 'Desert Treasure I')!.met).toBe(true);
    expect(route.regions.find(r => r.name === 'Kharidian Desert')!.met).toBe(true);
    expect(route.skills.find(s => s.skill === 'Cooking')!.met).toBe(true);
    // an unlocked region is no longer "needed" by any table suggestion
    for (const t of route.tables) expect(t.needed).not.toContain('Al Kharid');
  });
});

describe('buildGoalRoute — quest and engine-item goals', () => {
  it('includes the quest itself at the end of its own chain', () => {
    // Dragon Slayer I has a strategy entry AND is a quest — the chain should
    // still end with the goal quest itself.
    const route = buildGoalRoute('Dragon Slayer I', stateWith())!;
    expect(route.quests[route.quests.length - 1].name).toBe('Dragon Slayer I');
    // a pure quest goal (no strategy entry) resolves as kind 'quest'
    const pureQuest = buildGoalRoute("Cook's Assistant", stateWith())!;
    expect(pureQuest.kind === 'quest' || pureQuest.kind === 'strategy').toBe(true);
    expect(pureQuest.quests[pureQuest.quests.length - 1].name).toBe("Cook's Assistant");
  });

  it('routes Resource Engine items through their sources', () => {
    const route = buildGoalRoute('Ranarr Weed', stateWith())!;
    expect(route.kind).toBe('engine-item');
    expect(route.sources.length).toBeGreaterThan(0);
    expect(route.sources.some(s => s.name === 'Chaos Druid')).toBe(true);
  });

  it('returns null for unknown goals', () => {
    expect(buildGoalRoute('Not A Real Goal', stateWith())).toBeNull();
  });
});

describe('buildGoalRoute — diary alternatives', () => {
  it('does not present a blocked one-of skill route as a fake region', () => {
    const route = buildGoalRoute('Karamja Hard', stateWith({
      regions: ['Shilo Village'],
      quests: ['Shilo Village'],
      skills: { Slayer: 5 },
      levels: {
        Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10,
        Ranged: 1, Prayer: 1, Magic: 1, Slayer: 50,
      },
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Karamja Hard' || task.id !== 'kar_hard_9')
        .map(task => task.id),
    }))!;

    expect(route.regions).toEqual([]);
    expect(route.alternatives).toEqual([
      expect.objectContaining({
        routes: expect.arrayContaining([
          expect.objectContaining({ detail: expect.stringContaining('Combat level 100') }),
          expect.objectContaining({ detail: expect.stringContaining('Slayer 99') }),
        ]),
      }),
    ]);
  });
});
describe('suggestTables', () => {
  it('computes odds as needed/remaining and ranks descending', () => {
    const unlocks = stateWith().unlocks;
    const tables = suggestTables(new Set(['Falador', 'Cooking']), unlocks);
    expect(tables.length).toBeGreaterThanOrEqual(2);
    const regions = tables.find(t => t.table === TableType.REGIONS)!;
    expect(regions.needed).toEqual(['Falador']);
    expect(regions.odds).toBeCloseTo(1 / regions.poolRemaining, 10);
    for (let i = 1; i < tables.length; i++) {
      expect(tables[i - 1].odds).toBeGreaterThanOrEqual(tables[i].odds);
    }
  });

  it('returns nothing when nothing is needed', () => {
    expect(suggestTables(new Set(), stateWith().unlocks)).toEqual([]);
  });
});
