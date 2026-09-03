import { describe, expect, it } from 'vitest';
import { QUEST_DATA, QuestData } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { DropSource, UnlockState } from '../types';
import { REGION_GROUPS } from '../data/items';
import { combatLevel } from './slayerReach';
import {
  countDoableDiaryTasks, countDoableTasks, countMetSkillRequirements,
  evaluateDiaryTaskEligibility, evaluateQuestEligibility, getDiaryStatus, getQuestStatus,
  meetsSkillRequirement,
} from './journalStatus';

const unlocked = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: { Slayer: 10 }, levels: { Slayer: 99 },
  regions: [], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...over,
});

const questIdsWorthAtLeast = (points: number): string[] => {
  let total = 0;
  const questIds: string[] = [];
  for (const quest of Object.values(QUEST_DATA)) {
    if (quest.points <= 0) continue;
    questIds.push(quest.id);
    total += quest.points;
    if (total >= points) return questIds;
  }
  throw new Error(`Not enough Quest Points to reach ${points}`);
};

const unlocksReadyForPryingTimes = (): UnlockState => unlocked({
  regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
  quests: ['Pandemonium', "The Knight's Sword"],
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
});

describe('manual journal readiness', () => {
  it('allows a broad Wilderness task with any one Wilderness child area', () => {
    const task = ALL_DIARY_TASKS.find(({ id }) => id === 'wild_easy_8')!;

    const blocked = evaluateDiaryTaskEligibility(task, unlocked());
    expect(blocked.blockers).toContainEqual(expect.objectContaining({
      kind: 'alternative',
      blockerKinds: ['region'],
    }));

    const reachable = evaluateDiaryTaskEligibility(task, unlocked({
      regions: [REGION_GROUPS.Wilderness[0]],
    }));
    expect(reachable).toMatchObject({
      machineEligible: true,
      eligible: true,
      blockers: [],
    });
  });

  it("gates Sarah's farm shop on Falador rather than Port Sarim", () => {
    const task = ALL_DIARY_TASKS.find(({ id }) => id === 'fal_easy_3')!;

    expect(evaluateDiaryTaskEligibility(task, unlocked({ regions: ['Port Sarim'] })).blockers)
      .toContainEqual({ kind: 'region', label: 'Falador' });
    expect(evaluateDiaryTaskEligibility(task, unlocked({ regions: ['Falador'] })).eligible)
      .toBe(true);
  });

  it('requires 32 canonical Quest Points for the Champions Guild task', () => {
    const task = ALL_DIARY_TASKS.find(({ id }) => id === 'var_med_2')!;
    const low = evaluateDiaryTaskEligibility(task, unlocked({
      quests: ['Cook\'s Assistant'],
      regions: ['Varrock'],
    }));
    expect(low.machineEligible).toBe(false);
    expect(low.blockers).toContainEqual({
      kind: 'quest',
      label: 'Quest Points 32',
    });

    const enough = evaluateDiaryTaskEligibility(task, unlocked({
      quests: questIdsWorthAtLeast(32),
      regions: ['Varrock'],
    }));
    expect(enough).toMatchObject({
      machineEligible: true,
      eligible: true,
      confirmable: true,
      manualChecks: [],
    });
  });

  it('makes 153 Kudos confirmable but not automatically doable', () => {
    const result = evaluateDiaryTaskEligibility(
      ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!,
      unlocked({ regions: ['Varrock'] }),
    );
    expect(result).toMatchObject({
      machineEligible: true,
      eligible: false,
      confirmable: true,
      manualChecks: ['153 Varrock Museum Kudos'],
      blockers: [],
    });
  });

  it('prefers an eligible alternative over an earlier confirmable alternative', () => {
    const result = evaluateDiaryTaskEligibility({
      id: 'manual-route-preference',
      oneOf: [
        { label: 'Manual route', manualRequirements: ['Manual check'] },
        { label: 'Automatic route', items: ['Test item'] },
      ],
    }, unlocked());

    expect(result).toMatchObject({
      eligible: true,
      confirmable: true,
      manualChecks: [],
      blockers: [],
    });
    expect(result.evidence).toContain('Automatic route: Test item');
  });

  it('keeps machine blockers ahead of manual confirmation', () => {
    const result = evaluateDiaryTaskEligibility(
      ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!,
      unlocked(), 'chunked',
    );
    expect(result.machineEligible).toBe(false);
    expect(result.confirmable).toBe(false);
    expect(result.manualChecks).toEqual(['153 Varrock Museum Kudos']);
  });

  it('activates Prying Times manual metadata', () => {
    const result = evaluateQuestEligibility(
      QUEST_DATA['Prying Times'],
      unlocksReadyForPryingTimes(),
    );
    expect(result).toMatchObject({
      machineEligible: true,
      eligible: false,
      confirmable: true,
      manualChecks: ['One open Sailing task slot'],
    });
  });

  it('keeps a legacy Wanted completion manual until a complete Slug Menace altar route is attested', () => {
    const result = evaluateQuestEligibility(
      QUEST_DATA['The Slug Menace'],
      unlocked({
        regions: ['Kandarin', 'Asgarnia'],
        quests: ['Sea Slug', 'Wanted!'],
        skills: { Crafting: 30, Runecraft: 30, Slayer: 30, Thieving: 30 },
        levels: { Crafting: 30, Runecraft: 30, Slayer: 30, Thieving: 30 },
      }),
    );

    expect(result).toMatchObject({
      status: 'AVAILABLE',
      machineEligible: true,
      eligible: false,
      confirmable: true,
      manualChecks: [
        'Access to all required elemental altars through one route: surface altars with Misthalin and Kharidian Desert; the Abyss through Edgeville with Enter the Abyss completed; or Guardians of the Rift with Misthalin and Temple of the Eye completed',
      ],
    });
  });
});

describe('reported quest access', () => {
  const rimmington = {
    id: 'rimmington',
    label: 'Rimmington',
    standardAreas: ['Rimmington'],
    chunkOptions: [{ cx: 46, cy: 50 }],
  };
  const malformedQuest = (overrides: Partial<QuestData>): QuestData => ({
    id: 'Malformed policy quest',
    name: 'Malformed policy quest',
    kind: 'quest',
    accessPolicy: 'regions',
    regions: ['Asgarnia'],
    skills: {},
    prereqs: [],
    points: 0,
    difficulty: DropSource.QUEST_NOVICE,
    ...overrides,
  });

  it.each([
    {
      name: 'locations policy with missing locations',
      quest: malformedQuest({
        accessPolicy: 'locations',
        oneOf: [{ regions: ['Misthalin'] }],
      }),
      error: 'locations policy requires at least one base location',
    },
    {
      name: 'locations policy with empty locations',
      quest: malformedQuest({ accessPolicy: 'locations', locations: [] }),
      error: 'locations policy requires at least one base location',
    },
    {
      name: 'regions-and-locations policy with missing locations',
      quest: malformedQuest({ accessPolicy: 'regions-and-locations' }),
      error: 'regions-and-locations policy requires at least one base location',
    },
    {
      name: 'regions-and-locations policy with empty locations',
      quest: malformedQuest({ accessPolicy: 'regions-and-locations', locations: [] }),
      error: 'regions-and-locations policy requires at least one base location',
    },
    {
      name: 'regions-and-locations policy with empty regions',
      quest: malformedQuest({
        accessPolicy: 'regions-and-locations',
        regions: [],
        locations: [rimmington],
      }),
      error: 'regions-and-locations policy requires at least one region',
    },
  ])('fails closed for $name', ({ quest, error }) => {
    expect(evaluateQuestEligibility(quest, unlocked())).toMatchObject({
      status: 'LOCKED_QUEST',
      machineEligible: false,
      eligible: false,
      confirmable: false,
      blockers: [{
        kind: 'quest',
        label: `Invalid quest access configuration: ${error}`,
      }],
    });
  });

  it('preserves completed identity before structural validation', () => {
    const quest = malformedQuest({
      accessPolicy: 'locations',
      oneOf: [{ regions: ['Misthalin'] }],
    });

    expect(evaluateQuestEligibility(
      quest,
      unlocked({ quests: [quest.id] }),
    )).toEqual({
      status: 'COMPLETED',
      machineEligible: true,
      eligible: true,
      confirmable: true,
      manualChecks: [],
      blockers: [],
      evidence: ['Completed'],
    });
  });
  it("requires Rimmington, not all Asgarnia, for Witch's Potion", () => {
    const quest = QUEST_DATA["Witch's Potion"];

    expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Asgarnia'] })).status)
      .toBe('LOCKED_REGION');
    expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Rimmington'] })).status)
      .toBe('AVAILABLE');
    expect(evaluateQuestEligibility(quest, unlocked({ chunks: ['46,50'] }), 'chunked').status)
      .toBe('AVAILABLE');
  });

  it("requires Sinclair Mansion and Seers' Village, not all Kandarin, for Murder Mystery", () => {
    const quest = QUEST_DATA['Murder Mystery'];

    expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Kandarin'] })).status)
      .toBe('LOCKED_REGION');
    expect(evaluateQuestEligibility(quest, unlocked({ regions: ["Seers' Village"] })).status)
      .toBe('AVAILABLE');
    expect(evaluateQuestEligibility(quest, unlocked({ chunks: ['42,55'] }), 'chunked').status)
      .toBe('LOCKED_REGION');
    expect(evaluateQuestEligibility(
      quest,
      unlocked({ chunks: ['42,55', '42,54'] }),
      'chunked',
    ).status).toBe('AVAILABLE');
  });

  it('uses exact locations instead of descriptive regions under locations policy', () => {
    const quest = {
      id: 'Exact quest',
      name: 'Exact quest',
      kind: 'quest',
      accessPolicy: 'locations',
      regions: ['Asgarnia'],
      locations: [{
        id: 'rimmington',
        label: 'Rimmington',
        standardAreas: ['Rimmington'],
        chunkOptions: [{ cx: 46, cy: 50 }],
      }],
      skills: {},
      prereqs: [],
      points: 1,
      difficulty: DropSource.QUEST_NOVICE,
    } satisfies QuestData;
    expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Asgarnia'] })))
      .toMatchObject({ status: 'LOCKED_REGION' });
    expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Rimmington'] })))
      .toMatchObject({ status: 'AVAILABLE' });
  });

  it('requires both sources under regions-and-locations policy', () => {
    const quest = {
      id: 'Combined quest',
      name: 'Combined quest',
      kind: 'quest',
      accessPolicy: 'regions-and-locations',
      regions: ['Asgarnia'],
      locations: [{
        id: 'rimmington',
        label: 'Rimmington',
        standardAreas: ['Rimmington'],
        chunkOptions: [{ cx: 46, cy: 50 }],
      }],
      skills: {},
      prereqs: [],
      points: 1,
      difficulty: DropSource.QUEST_NOVICE,
    } satisfies QuestData;
    expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Rimmington'] })).status)
      .toBe('LOCKED_REGION');
    expect(evaluateQuestEligibility(
      quest,
      unlocked({ regions: ['Rimmington', 'Asgarnia'] }),
    ).status).toBe('AVAILABLE');
  });

  it('requires the exact South Falador Farm chunk in Chunked mode', () => {
    const q = QUEST_DATA['A Porcine of Interest'];
    const near = unlocked({ chunks: ['46,51', '48,50'] });
    const exact = unlocked({ chunks: ['47,51', '48,50'] });
    expect(evaluateQuestEligibility(q, near, 'chunked').status).toBe('LOCKED_REGION');
    expect(evaluateQuestEligibility(q, exact, 'chunked').status).toBe('AVAILABLE');
  });

  it('calculates Dream Mentor combat instead of reading a pseudo-skill', () => {
    const q = QUEST_DATA['Dream Mentor'];
    const base = {
      regions: ['Fremennik'], quests: ['Lunar Diplomacy', "Eadgar's Ruse"],
      skills: { Attack: 10, Strength: 10, Defence: 10, Hitpoints: 10, Prayer: 10, Ranged: 10, Magic: 10 },
    };
    const lowLevels = { Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60, Prayer: 60, Ranged: 60, Magic: 60 };
    const highLevels = { Attack: 70, Strength: 70, Defence: 70, Hitpoints: 70, Prayer: 70, Ranged: 70, Magic: 70 };
    const low = unlocked({ ...base, levels: lowLevels });
    const high = unlocked({ ...base, levels: highLevels });

    expect(combatLevel(lowLevels)).toBeLessThan(85);
    expect(evaluateQuestEligibility(q, low).blockers).toContainEqual({
      kind: 'combat', label: 'Combat level 85',
    });
    expect(combatLevel(highLevels)).toBeGreaterThanOrEqual(85);
    expect(evaluateQuestEligibility(q, high).blockers).not.toContainEqual({
      kind: 'combat', label: 'Combat level 85',
    });
    expect(evaluateQuestEligibility(q, high).status).toBe('AVAILABLE');
  });

  it.each([
    ['East Ardougne', { regions: ['Wilderness', 'East Ardougne'] }],
    ['Tree Gnome Stronghold', { regions: ['Wilderness', 'Tree Gnome Stronghold'] }],
    ["Wizards' Guild", { regions: ['Wilderness'], guilds: ["Wizards' Guild"] }],
  ])('allows Enter the Abyss through %s', (_name, route) => {
    expect(getQuestStatus(QUEST_DATA['Enter the Abyss'], unlocked({
      quests: ['Rune Mysteries'], ...route,
    }))).toBe('AVAILABLE');
  });

  it('locks Enter the Abyss without a third provider', () => {
    expect(getQuestStatus(QUEST_DATA['Enter the Abyss'],
      unlocked({ quests: ['Rune Mysteries'], regions: ['Wilderness'] }))).toBe('LOCKED_REGION');
  });

  it('checks and labels location-based alternative routes', () => {
    const quest: QuestData = {
      ...QUEST_DATA['A Porcine of Interest'],
      id: 'alternative-location', name: 'Alternative location',
      accessPolicy: 'regions',
      regions: [], locations: [], skills: {}, prereqs: [],
      oneOf: [{ locations: [{
        id: 'test-crossing', label: 'Test crossing',
        standardAreas: ['Falador'], chunkOptions: [{ cx: 47, cy: 51 }],
      }] }],
    };
    expect(evaluateQuestEligibility(
      quest, unlocked({ chunks: ['46,51'] }), 'chunked',
    ).blockers).toContainEqual({ kind: 'region', label: 'Test crossing' });
    expect(evaluateQuestEligibility(
      quest, unlocked({ chunks: ['47,51'] }), 'chunked',
    ).status).toBe('AVAILABLE');
  });

  it('treats an empty alternative list as no alternative requirement', () => {
    const quest: QuestData = {
      ...QUEST_DATA['A Porcine of Interest'],
      accessPolicy: 'regions',
      regions: ['Misthalin'],
      locations: [],
      oneOf: [],
    };
    expect(getQuestStatus(quest, unlocked())).toBe('AVAILABLE');
  });
});

describe('skill-method caps', () => {
  const quest: QuestData = {
    id: 'cap', name: 'cap', kind: 'quest', accessPolicy: 'regions',
    regions: ['Misthalin'],
    skills: { Woodcutting: 15 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE,
  };

  it('requires level and method cap', () => {
    const tier1 = unlocked({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    });
    const tier2LowLevel = unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 14 },
    });
    const tier2 = unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    });
    expect(meetsSkillRequirement(tier1, 'Woodcutting', 15)).toBe(false);
    expect(getQuestStatus(quest, tier1)).toBe('LOCKED_SKILL');
    expect(meetsSkillRequirement(tier2LowLevel, 'Woodcutting', 15)).toBe(false);
    expect(getQuestStatus(quest, tier2LowLevel)).toBe('LOCKED_SKILL');
    expect(meetsSkillRequirement(tier2, 'Woodcutting', 15)).toBe(true);
    expect(getQuestStatus(quest, tier2)).toBe('AVAILABLE');
  });

  it('applies the same cap to diary tasks', () => {
    const tasks = [{ id: 'wc15', skills: { Woodcutting: 15 } }];
    expect(countDoableTasks(tasks, unlocked({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    }))).toBe(0);
    expect(countDoableTasks(tasks, unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    }))).toBe(1);
  });

  it('blocks lum_easy_7 at cap 10 and permits level 15 in the next method band', () => {
    const task = ALL_DIARY_TASKS.find(({ id }) => id === 'lum_easy_7')!;
    const common = {
      regions: ['Lumbridge'],
      levels: { Woodcutting: 15, Firemaking: 15 },
    };

    expect(evaluateDiaryTaskEligibility(task, unlocked({
      ...common,
      skills: { Woodcutting: 1, Firemaking: 1 },
    }))).toMatchObject({
      machineEligible: false,
      eligible: false,
    });

    expect(evaluateDiaryTaskEligibility(task, unlocked({
      ...common,
      skills: { Woodcutting: 2, Firemaking: 2 },
    }))).toMatchObject({
      machineEligible: true,
      eligible: true,
    });
  });

  it('applies method caps to diary consumer counts', () => {
    const tasks = [{
      id: 'wc15', tierId: 'Test Diary',
      skills: { Woodcutting: 15 },
    }];
    const tier1 = unlocked({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    });
    const tier2 = unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    });

    expect(countDoableDiaryTasks(tasks, tier1)).toBe(0);
    expect(countMetSkillRequirements(tasks[0].skills, tier1)).toBe(0);
    expect(countDoableDiaryTasks(tasks, tier2)).toBe(1);
    expect(countMetSkillRequirements(tasks[0].skills, tier2)).toBe(1);
  });

  it('excludes completed diary tasks and completed diary tiers', () => {
    const tasks = [{
      id: 'wc15', tierId: 'Test Diary',
      skills: { Woodcutting: 15 },
    }];
    const eligible = {
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    };

    expect(countDoableDiaryTasks(tasks, unlocked({
      ...eligible, completedTasks: ['wc15'],
    }))).toBe(0);
    expect(countDoableDiaryTasks(tasks, unlocked({
      ...eligible, diaries: ['Test Diary'],
    }))).toBe(0);
  });
});
describe('diary alternative requirement routes', () => {
  it('accepts either skill route without requiring both', () => {
    const task = {
      id: 'gwd-entry',
      oneOf: [
        { skills: { Agility: 60 } },
        { skills: { Strength: 60 } },
      ],
    };

    expect(evaluateDiaryTaskEligibility(task as any, unlocked()).blockers)
      .toEqual([expect.objectContaining({
        kind: 'alternative', label: 'Agility 60 or Strength 60',
        blockerKinds: ['skill'],
      })]);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      skills: { Agility: 6 },
      levels: { Agility: 60 },
    })).eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      skills: { Strength: 6 },
      levels: { Strength: 60 },
    })).eligible).toBe(true);
  });

  it('accepts either a quest or completed Combat Achievement tier', () => {
    const task = {
      id: 'trollheim-entry',
      oneOf: [
        { quests: ['Troll Stronghold'] },
        { cas: ['Easy'] },
      ],
    };

    expect(evaluateDiaryTaskEligibility(task as any, unlocked()).eligible).toBe(false);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      quests: ['Troll Stronghold'],
    })).eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      cas: ['Easy'],
    })).eligible).toBe(true);
  });

  it('keeps common requirements mandatory when an untracked route is non-blocking', () => {
    const task = {
      id: 'hardwood',
      skills: { Woodcutting: 35 },
      quests: ['Jungle Potion'],
      oneOf: [
        { label: 'Hardwood Grove' },
        {
          label: 'Kharazi Jungle',
          skills: { Agility: 79 },
          quests: ["Legends' Quest"],
        },
      ],
    };
    const common = {
      skills: { Woodcutting: 4 },
      levels: { Woodcutting: 35 },
      quests: ['Jungle Potion'],
    };

    expect(evaluateDiaryTaskEligibility(task as any, unlocked()).eligible).toBe(false);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked(common)).eligible).toBe(true);
  });

  it('supports combined and limited-any skill alternatives', () => {
    const task = {
      id: 'warriors-guild',
      oneOf: [
        { combinedSkillLevel: { skills: ['Attack', 'Strength'], level: 130 } },
        { anyOfSkillsLevel: { skills: ['Attack', 'Strength'], level: 99 } },
      ],
    };

    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      skills: { Attack: 7, Strength: 7 }, levels: { Attack: 65, Strength: 65 },
    })).eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      skills: { Attack: 10, Strength: 1 }, levels: { Attack: 99, Strength: 1 },
    })).eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      skills: { Attack: 6, Strength: 6 }, levels: { Attack: 60, Strength: 60 },
    })).eligible).toBe(false);
  });

  it('keeps common and route item requirements visible but non-blocking', () => {
    const task = {
      id: 'muddy-chest',
      items: ['Muddy key'],
      oneOf: [
        { label: 'Slashing route', items: ['Knife or slashing weapon'] },
        { skills: { Agility: 82 } },
      ],
    };

    const result = evaluateDiaryTaskEligibility(task as any, unlocked());

    expect(result.eligible).toBe(true);
    expect(result.evidence).toContain('Muddy key');
    expect(result.evidence).toContain('Slashing route: Knife or slashing weapon');
  });
});
describe('manual diary task requirements', () => {
  it('checks combat-level gates through the canonical combat formula', () => {
    const task = { id: 'combat-task', combatLevel: 70 };
    const low = unlocked({
      skills: {
        Attack: 4, Strength: 4, Defence: 4, Hitpoints: 4,
        Prayer: 4, Ranged: 4, Magic: 4,
      },
      levels: {
        Attack: 40, Strength: 40, Defence: 40, Hitpoints: 40,
        Prayer: 40, Ranged: 40, Magic: 40,
      },
    });
    const high = unlocked({
      skills: {
        Attack: 6, Strength: 6, Defence: 6, Hitpoints: 6,
        Prayer: 6, Ranged: 6, Magic: 6,
      },
      levels: {
        Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60,
        Prayer: 60, Ranged: 60, Magic: 60,
      },
    });

    expect(combatLevel(low.levels)).toBeLessThan(70);
    expect(evaluateDiaryTaskEligibility(task as any, low).blockers)
      .toContainEqual({ kind: 'combat', label: 'Combat level 70' });
    expect(combatLevel(high.levels)).toBeGreaterThanOrEqual(70);
    expect(evaluateDiaryTaskEligibility(task as any, high).eligible).toBe(true);
  });

  it('uses real combat levels even when combat method tiers are lower', () => {
    const combatSkills = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Prayer', 'Ranged', 'Magic'];
    const combat51 = unlocked({
      skills: Object.fromEntries(combatSkills.map(skill => [skill, 1])),
      levels: Object.fromEntries(combatSkills.map(skill => [skill, 40])),
      regions: ['Edgeville'],
    });
    const vannaka = ALL_DIARY_TASKS.find(task => task.id === 'var_med_9')!;

    expect(combatLevel(combat51.levels)).toBe(51);
    expect(evaluateDiaryTaskEligibility(vannaka, combat51)).toMatchObject({
      machineEligible: true,
      eligible: true,
    });
  });

  it.each([
    ['mor_easy_3', ['Priest in Peril'], ['Canifis']],
    ['var_med_9', [], ['Edgeville']],
    ['lum_med_10', ['Lost City'], ['Zanaris']],
  ] as const)('accepts the Slayer cape route for %s', (id, quests, regions) => {
    const task = ALL_DIARY_TASKS.find(candidate => candidate.id === id)!;
    const result = evaluateDiaryTaskEligibility(task, unlocked({
      skills: { Slayer: 10 },
      levels: { Slayer: 99 },
      quests: [...quests],
      regions: [...regions],
    }));

    expect(result).toMatchObject({ machineEligible: true, eligible: true });
  });

  it('requires Priest in Peril for both Mazchna combat and Slayer cape routes', () => {
    const task = ALL_DIARY_TASKS.find(candidate => candidate.id === 'mor_easy_3')!;
    const combatSkills = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Prayer', 'Ranged', 'Magic'];
    const combatRoute = {
      skills: Object.fromEntries(combatSkills.map(skill => [skill, 1])),
      levels: {
        ...Object.fromEntries(combatSkills.map(skill => [skill, 20])),
        Slayer: 1,
      },
      regions: ['Canifis'],
    };
    const capeRoute = {
      skills: { Slayer: 10 },
      levels: { Slayer: 99 },
      regions: ['Canifis'],
    };

    for (const route of [combatRoute, capeRoute]) {
      expect(evaluateDiaryTaskEligibility(task, unlocked(route)).blockers)
        .toContainEqual({ kind: 'quest', label: 'Priest in Peril' });
      expect(evaluateDiaryTaskEligibility(task, unlocked({
        ...route,
        quests: ['Priest in Peril'],
      }))).toMatchObject({ machineEligible: true, eligible: true });
    }
  });

  it('checks all-quests and any-skill routes without pseudo quest ids', () => {
    const task = {
      id: 'cape-emote',
      oneOf: [
        { allQuests: true },
        { label: 'Skillcape', anySkillLevel: 99 },
      ],
    };

    expect(evaluateDiaryTaskEligibility(task as any, unlocked({ skills: {}, levels: {} })).eligible).toBe(false);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      quests: Object.keys(QUEST_DATA),
    })).eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task as any, unlocked({
      skills: { Cooking: 10 },
      levels: { Cooking: 99 },
    })).eligible).toBe(true);
  });
});

  it('does not require optional miniquests for all-quests gates', () => {
    const questCapeQuests = Object.values(QUEST_DATA)
      .filter(quest => quest.points > 0)
      .map(quest => quest.id);
    const result = evaluateDiaryTaskEligibility(
      { id: 'quest-cape', allQuests: true },
      unlocked({ quests: questCapeQuests }),
    );

    expect(result.eligible).toBe(true);
  });

describe('canonical diary tier eligibility', () => {
  const canonicalUnlocks = () => {
    const taskSkills = ALL_DIARY_TASKS.flatMap(task => [
      ...Object.keys(task.skills ?? {}),
      ...(task.oneOf ?? []).flatMap(option => Object.keys(option.skills ?? {})),
    ]);
    const regions = [
      ...ALL_DIARY_TASKS.flatMap(task => task.regions ?? []),
      ...ALL_DIARY_TASKS.flatMap(task => task.anyOfRegions ?? []),
      ...Object.values(DIARY_DATA).flatMap(diary => [diary.region, ...diary.requiredRegions]),
    ];
    const quests = [
      ...Object.keys(QUEST_DATA),

      ...ALL_DIARY_TASKS.flatMap(task => task.quests ?? []),
      ...Object.values(DIARY_DATA).flatMap(diary => diary.quests),
    ];
    return unlocked({
      skills: Object.fromEntries(taskSkills.map(skill => [skill, 10])),
      levels: Object.fromEntries(taskSkills.map(skill => [skill, 99])),
      regions: [...new Set(regions)],
      quests: [...new Set(quests)],
      cas: ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'],
    });
  };

  it('treats an omitted completed-task list as no completed tasks in a status snapshot', () => {
    const { completedTasks, ...partialUnlocks } = canonicalUnlocks();
    void completedTasks;

    expect(getDiaryStatus(DIARY_DATA['Ardougne Easy'], partialUnlocks))
      .toBe('AVAILABLE');
  });

  it('treats an omitted CA tier list as no completed tiers in a status snapshot', () => {
    const { cas, ...partialUnlocks } = canonicalUnlocks();
    void cas;

    expect(getDiaryStatus(DIARY_DATA['Fremennik Easy'], {
      ...partialUnlocks,
      quests: partialUnlocks.quests.filter(quest => quest !== 'Troll Stronghold'),
    })).toBe('LOCKED_QUEST');
  });

  it('ignores all 48 stale aggregate requirement payloads', () => {
    const unlocks = canonicalUnlocks();

    for (const diary of Object.values(DIARY_DATA)) {
      expect(getDiaryStatus(diary, unlocks)).toBe('AVAILABLE');
      expect(getDiaryStatus({
        ...diary,
        region: 'Impossible aggregate region',
        skills: { NotASkill: 99 },
        quests: ['Impossible aggregate quest'],
        requiredRegions: ['Impossible aggregate region'],
      }, unlocks)).toBe('AVAILABLE');
    }
  });

  it('uses Biohazard and West Ardougne from ard_easy_6, not the stale aggregate', () => {
    const base = canonicalUnlocks();
    const withoutBiohazard = {
      ...base,
      quests: base.quests.filter(quest => quest !== 'Biohazard'),
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Ardougne Easy' || task.id !== 'ard_easy_6')
        .map(task => task.id),
    };

    expect(getDiaryStatus(DIARY_DATA['Ardougne Easy'], withoutBiohazard))
      .toBe('LOCKED_QUEST');
    expect(getDiaryStatus(DIARY_DATA['Ardougne Easy'], {
      ...withoutBiohazard,
      quests: [...withoutBiohazard.quests, 'Biohazard'],
    })).toBe('AVAILABLE');
  });
});

describe('audited diary route eligibility', () => {
  const task = (id: string) => ALL_DIARY_TASKS.find(candidate => candidate.id === id)!;

  it('allows either Karamja tree location without requiring the other location', () => {
    const shared = {
      quests: ['Jungle Potion'],
      skills: { Woodcutting: 10 },
      levels: { Woodcutting: 50 },
    };

    expect(evaluateDiaryTaskEligibility(task('kar_med_8'), unlocked({
      ...shared,
      regions: ['Kharazi Jungle'],
    })).eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task('kar_med_9'), unlocked({
      ...shared,
      regions: ['Tai Bwo Wannai'],
      quests: ['Jungle Potion'],
    })).eligible).toBe(true);
  });

  it('allows Tai Bwo Wannai Cleanup without Shilo Village access', () => {
    expect(evaluateDiaryTaskEligibility(task('kar_med_19'), unlocked({
      skills: { Mining: 4 }, levels: { Mining: 40 },
      quests: ['Jungle Potion'], regions: ['Tai Bwo Wannai'],
    })).eligible).toBe(true);
  });

  it('does not require 79 Agility on the Kharazi machete route', () => {
    const result = evaluateDiaryTaskEligibility(task('kar_med_8'), unlocked({
      skills: { Woodcutting: 4, Agility: 1 },
      levels: { Woodcutting: 35, Agility: 1 },
      quests: ['Jungle Potion'],
      regions: ['Kharazi Jungle'],
    }));

    expect(result.eligible).toBe(true);
  });

  it('requires the higher Fishing and Strength levels on the bare-handed shark route', () => {
    const bareHandedTask = {
      ...task('kan_elite_3'),
      oneOf: [task('kan_elite_3').oneOf!.find(option => option.label === 'Bare-handed fishing')!],
    };
    const common = {
      quests: ['Family Crest'], regions: ['Catherby'],
      skills: { Cooking: 10, Fishing: 10, Strength: 10 },
    };
    expect(evaluateDiaryTaskEligibility(bareHandedTask, unlocked({
      ...common, levels: { Cooking: 80, Fishing: 95, Strength: 76 },
    })).eligible).toBe(false);
    expect(evaluateDiaryTaskEligibility(bareHandedTask, unlocked({
      ...common, levels: { Cooking: 80, Fishing: 96, Strength: 75 },
    })).eligible).toBe(false);
    const eligible = evaluateDiaryTaskEligibility(bareHandedTask, unlocked({
      ...common, levels: { Cooking: 80, Fishing: 96, Strength: 76 },
    }));
    expect(eligible.eligible).toBe(true);
    expect(eligible.blockers).not.toContainEqual({
      kind: 'quest', label: 'Barbarian Training',
    });
    expect(eligible.evidence.join(' ')).toContain('Access to Barbarian Fishing');
  });

  it('models Morytania bare-handed fishing access as evidence while retaining its gates', () => {
    const common = {
      quests: ['In Aid of the Myreque'], regions: ['Burgh de Rott'],
      skills: { Fishing: 10, Strength: 10 },
      levels: { Fishing: 96, Strength: 76 },
    };
    const eligible = evaluateDiaryTaskEligibility(task('mor_elite_1'), unlocked(common));

    expect(eligible.eligible).toBe(true);
    expect(eligible.blockers).not.toContainEqual({
      kind: 'quest', label: 'Barbarian Training',
    });
    expect(eligible.evidence).toContain('Access to Barbarian Fishing');

    const missingQuest = evaluateDiaryTaskEligibility(task('mor_elite_1'), unlocked({
      ...common, quests: [],
    }));
    expect(missingQuest.blockers).toContainEqual({
      kind: 'quest', label: 'In Aid of the Myreque',
    });

    const lowFishing = evaluateDiaryTaskEligibility(task('mor_elite_1'), unlocked({
      ...common, levels: { Fishing: 95, Strength: 76 },
    }));
    expect(lowFishing.blockers).toContainEqual(expect.objectContaining({
      kind: 'skill', label: 'Fishing 96',
    }));

    const lowStrength = evaluateDiaryTaskEligibility(task('mor_elite_1'), unlocked({
      ...common, levels: { Fishing: 96, Strength: 75 },
    }));
    expect(lowStrength.blockers).toContainEqual(expect.objectContaining({
      kind: 'skill', label: 'Strength 76',
    }));

    const missingRegion = evaluateDiaryTaskEligibility(task('mor_elite_1'), unlocked({
      ...common, regions: [],
    }));
    expect(missingRegion.blockers).toContainEqual({
      kind: 'region', label: 'Burgh de Rott',
    });
  });

  it('allows a pre-cooked oomlie wrap without the cooking route', () => {
    expect(evaluateDiaryTaskEligibility(task('kar_hard_3'), unlocked()).eligible)
      .toBe(true);
  });

  it('allows an existing or mounted Digsite pendant without crafting Magic', () => {
    expect(evaluateDiaryTaskEligibility(task('var_med_7'), unlocked({
      quests: ['The Dig Site'], regions: ['Digsite'],
      skills: { Magic: 1 }, levels: { Magic: 1 },
    })).eligible).toBe(true);
  });

  it('accepts each Warriors Guild skill route', () => {
    expect(evaluateDiaryTaskEligibility(task('fal_hard_10'), unlocked({
      regions: ["Warriors' Guild"],
      skills: { Attack: 7, Strength: 7 }, levels: { Attack: 65, Strength: 65 },
    })).eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task('fal_hard_10'), unlocked({
      regions: ["Warriors' Guild"],
      skills: { Attack: 10, Strength: 1 }, levels: { Attack: 99, Strength: 1 },
    })).eligible).toBe(true);
  });

  it('accepts every exact Raiments level route', () => {
    const cases = [
      ['fal_hard_1', 42], ['fal_elite_1', 55],
      ['lum_elite_5', 38], ['var_elite_5', 52],
    ] as const;
    for (const [id, level] of cases) {
      const diaryTask = task(id);
      expect(evaluateDiaryTaskEligibility(diaryTask, unlocked({
        skills: { Runecraft: 10 }, levels: { Runecraft: level },
        regions: diaryTask.regions ?? [], quests: diaryTask.quests ?? [],
      })).eligible, id).toBe(true);
    }
  });
});
