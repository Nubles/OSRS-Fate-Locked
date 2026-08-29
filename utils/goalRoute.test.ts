import { describe, it, expect } from 'vitest';
import { buildGoalRoute, expandQuestChain, tierForLevel, suggestTables } from './goalRoute';
import { QUEST_DATA } from '../data/questData';
import { GameState, TableType } from '../types';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { REGION_GROUPS } from '../constants';

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
      regions: [...REGION_GROUPS['Kharidian Desert']],
      skills: { Cooking: 7 },
      levels: { Cooking: 70 },
    }))!;
    expect(route.quests.find(q => q.name === 'Desert Treasure I')!.met).toBe(true);
    expect(route.regions.find(r => r.name === 'Kharidian Desert')!.met).toBe(true);
    expect(route.skills.find(s => s.skill === 'Cooking')!.met).toBe(true);
    // an unlocked region is no longer "needed" by any table suggestion
    for (const t of route.tables) {
      for (const child of REGION_GROUPS['Kharidian Desert']) {
        expect(t.needed).not.toContain(child);
      }
    }
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

  it('retains direct and transitive quest alternative routes', () => {
    const direct = buildGoalRoute('Enter the Abyss', stateWith({ quests: ['Rune Mysteries'] }))!;
    expect(direct.regions.map(region => region.name)).not.toContain('One of:');
    expect(direct.alternatives).toEqual([
      expect.objectContaining({
        routes: expect.arrayContaining([
          expect.objectContaining({ name: 'East Ardougne' }),
          expect.objectContaining({ name: "Wizards' Guild" }),
        ]),
      }),
    ]);

    const transitive = buildGoalRoute('Temple of the Eye', stateWith())!;
    expect(transitive.alternatives).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.stringContaining('East Ardougne') }),
    ]));
  });

  it('retains canonical alternatives for strategy-backed quest goals', () => {
    const route = buildGoalRoute('Desert Treasure II', stateWith())!;

    expect(route.kind).toBe('strategy');
    expect(route.description).toContain('Unlocks 4 new bosses');
    expect(route.alternatives).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.stringContaining('East Ardougne') }),
    ]));
  });

  it.each([
    'Dragon Slayer II',
    'While Guthix Sleeps',
    "Myths' Guild Bank",
    "Myth's Guild Green Dragons",
    "Myth's Guild Blue Dragons",
    'Plank Make',
    'Ferocious Gloves',
  ])('inherits Dream Mentor combat 85 for the %s strategy route', (goalId) => {
    const route = buildGoalRoute(goalId, stateWith())!;

    expect(route.quests).toContainEqual(expect.objectContaining({
      name: 'Dream Mentor',
    }));
    expect(route.skills).toContainEqual(expect.objectContaining({
      skill: 'Combat level',
      needLevel: 85,
      haveLevel: 3,
      unlocked: true,
      tierNeeded: 0,
      tierHave: 0,
      met: false,
    }));
    expect(route.tables.flatMap(table => table.needed)).not.toContain('Combat level');
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

describe('buildGoalRoute — geographic area aliases', () => {
  it('routes Kandarin Medium Ranging Guild through canonical Areas, never Guilds', () => {
    const route = buildGoalRoute('Kandarin Medium', stateWith({
      skills: { Ranged: 10 },
      levels: { Ranged: 99 },
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Kandarin Medium' || task.id !== 'kan_med_3')
        .map(task => task.id),
    }))!;

    expect(route.regions).toContainEqual(expect.objectContaining({
      name: 'Hemenster \u00b7 Ranging Guild',
      met: false,
    }));
    expect(route.tables).toContainEqual(expect.objectContaining({
      table: TableType.REGIONS,
      needed: ['Hemenster'],
    }));
    expect(route.tables).not.toContainEqual(expect.objectContaining({
      table: TableType.GUILDS,
      needed: expect.arrayContaining(['Ranging Guild']),
    }));
  });

  it('suggests only the Regions table for the Mage Arena area, never the unrelated minigame name', () => {
    const route = buildGoalRoute('Wilderness Hard', stateWith({
      skills: { Smithing: 10 },
      levels: { Smithing: 99 },
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Wilderness Hard' || task.id !== 'wild_hard_4')
        .map(task => task.id),
    }))!;

    expect(route.regions).toContainEqual(expect.objectContaining({
      name: 'Mage Arena · Resource Area',
      met: false,
    }));
    expect(route.tables).toContainEqual(expect.objectContaining({
      table: TableType.REGIONS,
      needed: ['Mage Arena'],
    }));
    expect(route.tables).not.toContainEqual(expect.objectContaining({
      table: TableType.MINIGAMES,
      needed: expect.arrayContaining(['Mage Arena']),
    }));
  });
});

describe('suggestTables', () => {
  it('computes odds as needed/remaining and ranks descending', () => {
    const unlocks = stateWith().unlocks;
    const tables = suggestTables([
      { table: TableType.REGIONS, id: 'Falador' },
      { table: TableType.SKILLS, id: 'Cooking' },
    ], unlocks);
    expect(tables.length).toBeGreaterThanOrEqual(2);
    const regions = tables.find(t => t.table === TableType.REGIONS)!;
    expect(regions.needed).toEqual(['Falador']);
    expect(regions.odds).toBeCloseTo(1 / regions.poolRemaining, 10);
    for (let i = 1; i < tables.length; i++) {
      expect(tables[i - 1].odds).toBeGreaterThanOrEqual(tables[i].odds);
    }
  });

  it('keeps real guild requirements in the Guilds table', () => {
    const tables = suggestTables([
      { table: TableType.GUILDS, id: "Heroes' Guild" },
      { table: TableType.GUILDS, id: 'Ranging Guild' },
    ], stateWith().unlocks);

    expect(tables).toContainEqual(expect.objectContaining({
      table: TableType.GUILDS,
      needed: ["Heroes' Guild", 'Ranging Guild'],
    }));
  });

  it('returns nothing when nothing is needed', () => {
    expect(suggestTables([], stateWith().unlocks)).toEqual([]);
  });
});
