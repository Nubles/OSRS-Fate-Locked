import { describe, it, expect } from 'vitest';
import { SKILLS_LIST } from '../constants';
import { QUEST_CAPE_QUEST_IDS, QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { MISTHALIN_AREAS, REGION_GROUPS } from '../data/items';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { planForTarget, listGoalTargets, questPointsForEntry } from './goalPlanner';
import { getQuestStatus } from './journalStatus';
import { isAreaReachable } from './reachability';
import { TableType } from '../types';

// All skills unlocked & maxed, levels at 99 — so only regions, prereq quests,
// and quest points gate availability. Mirrors the advisor test fixture.
function maxedUnlocks(over: Record<string, any> = {}) {
  return {
    equipment: {},
    skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 10])),
    levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 99])),
    regions: [],
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [],
    diaries: [],
    cas: [],
    completedTasks: [],
    collectionLog: {},
    ...over,
  };
}

describe('Goal Planner quest-point classification', () => {
  it('awards no Quest Points for a nonzero-point miniquest record', () => {
    expect(questPointsForEntry({ kind: 'miniquest', points: 7 })).toBe(0);
  });
});

describe('planForTarget — quests', () => {
  it('plans the highest required equipment tier once across the incomplete prerequisite chain', () => {
    const first = '__equipment_prerequisite__';
    const target = '__equipment_target__';
    QUEST_DATA[first] = {
      ...QUEST_DATA['The Restless Ghost'], id: first, name: first,
      regions: ['Misthalin'], locations: [], accessPolicy: 'regions',
      equipmentRequirements: [{ slot: 'Neck', tier: 1, reason: 'First amulet' }],
    };
    QUEST_DATA[target] = {
      ...QUEST_DATA[first], id: target, name: target, prereqs: [first],
      equipmentRequirements: [{ slot: 'Neck', tier: 4, reason: 'Later amulet' }],
    };
    try {
      const plan = planForTarget('quest', target, maxedUnlocks())!;
      expect(plan.equipmentSteps).toEqual([expect.objectContaining({
        kind: 'equipment', id: 'Neck', label: 'Neck T4', requiredTier: 4,
        unlockTable: TableType.EQUIPMENT, done: false,
      })]);
      expect(plan.equipmentSteps[0].detail).toContain('First amulet');
      expect(plan.equipmentSteps[0].detail).toContain('Later amulet');
      expect(plan.steps.indexOf(plan.equipmentSteps[0])).toBeLessThan(plan.steps.indexOf(plan.questSteps[0]));
      expect(planForTarget('quest', target, maxedUnlocks({ equipment: { Neck: 3 } }))!.equipmentSteps).toHaveLength(1);
      expect(planForTarget('quest', target, maxedUnlocks({ equipment: { Neck: 4 } }))!.equipmentSteps).toEqual([]);
      expect(planForTarget('quest', target, maxedUnlocks({ quests: [target] }))!.equipmentSteps).toEqual([]);
    } finally {
      delete QUEST_DATA[first];
      delete QUEST_DATA[target];
    }
  });
  it('orders quest steps so prereqs come before the quests that need them', () => {
    const base = maxedUnlocks();
    for (const q of Object.values(QUEST_DATA)) {
      const plan = planForTarget('quest', q.id, base)!;
      const positions = new Map(plan.questSteps.map((s, i) => [s.id, i]));
      for (const step of plan.questSteps) {
        for (const pre of QUEST_DATA[step.id].prereqs) {
          if (positions.has(pre)) {
            expect(positions.get(pre)!).toBeLessThan(positions.get(step.id)!);
          }
        }
      }
    }
  });

  it('lists the target quest last among quest steps', () => {
    const base = maxedUnlocks();
    for (const q of Object.values(QUEST_DATA)) {
      const plan = planForTarget('quest', q.id, base)!;
      const last = plan.questSteps[plan.questSteps.length - 1];
      expect(last.id).toBe(q.id);
    }
  });

  it('never lists an already-completed quest as a step', () => {
    // Complete a handful of no-prereq quests, then plan something downstream.
    const noPrereq = Object.values(QUEST_DATA)
      .filter((q) => q.prereqs.length === 0)
      .slice(0, 5)
      .map((q) => q.id);
    const base = maxedUnlocks({ quests: noPrereq });
    for (const q of Object.values(QUEST_DATA)) {
      const plan = planForTarget('quest', q.id, base)!;
      for (const step of plan.questSteps) {
        expect(noPrereq).not.toContain(step.id);
      }
    }
  });

  it('an AVAILABLE quest needs only itself (no region/skill backlog)', () => {
    const base = maxedUnlocks();
    const available = Object.values(QUEST_DATA).filter(
      (q) => getQuestStatus(q, base) === 'AVAILABLE' && !q.manualRequirements?.length,
    );
    expect(available.length).toBeGreaterThan(0);
    for (const q of available) {
      const plan = planForTarget('quest', q.id, base)!;
      expect(plan.alreadyReachable).toBe(true);
      expect(plan.regionSteps).toHaveLength(0);
      expect(plan.questSteps.map((s) => s.id)).toEqual([q.id]);
    }
  });

  it('a completed quest yields an empty, done plan', () => {
    const target = Object.values(QUEST_DATA).find((q) => q.prereqs.length === 0)!;
    const base = maxedUnlocks({ quests: [target.id] });
    const plan = planForTarget('quest', target.id, base)!;
    expect(plan.alreadyDone).toBe(true);
    expect(plan.remaining).toBe(0);
    expect(plan.questSteps).toHaveLength(0);
  });

  it('surfaces region gates for region-locked quests', () => {
    const base = maxedUnlocks(); // regions: []
    // Find a quest gated purely on a non-Misthalin region.
    const regionLocked = Object.values(QUEST_DATA).find(
      (q) => getQuestStatus(q, base) === 'LOCKED_REGION',
    );
    if (!regionLocked) return; // dataset-dependent; skip if none
    const plan = planForTarget('quest', regionLocked.id, base)!;
    expect(plan.regionSteps.length).toBeGreaterThan(0);
    for (const r of plan.regionSteps) expect(r.done).toBe(false);
  });
  it('does not mark a cap-blocked skill requirement complete', () => {
    const plan = planForTarget('quest', 'Elemental Workshop I', maxedUnlocks({
      regions: ["Seers' Village"],
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? 1 : 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? 20 : 99])),
    }))!;

    expect(plan.skillSteps).toEqual([
      expect.objectContaining({
        id: 'Mining',
        done: false,
        detail: expect.stringContaining('method cap 10'),
      }),
    ]);
    expect(plan.alreadyReachable).toBe(false);
  });

  it('suggests a Skills key only while the tier caps the skill below the level needed', () => {
    const mining = (quest: string, tier: number, level: number) => planForTarget('quest', quest, maxedUnlocks({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? tier : 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Mining' ? level : 99])),
    }))!.skillSteps.find(step => step.id === 'Mining')!;

    // The Knight's Sword needs Mining 10: tier 3 caps at 30, so only XP is missing.
    expect(mining("The Knight's Sword", 3, 5)).toMatchObject({ detail: 'Lv 10 (have 5)' });
    expect(mining("The Knight's Sword", 3, 5).unlockTable).toBeUndefined();
    expect(mining("The Knight's Sword", 0, 5).unlockTable).toBe(TableType.SKILLS);
    // Elemental Workshop I needs Mining 20, above tier 1's cap of 10.
    expect(mining('Elemental Workshop I', 1, 20).unlockTable).toBe(TableType.SKILLS);
    expect(mining('Elemental Workshop I', 2, 15).unlockTable).toBeUndefined();
  });

  it('lists skill steps alphabetically', () => {
    const plan = planForTarget('quest', "Legends' Quest", maxedUnlocks({
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 1])),
    }))!;
    const ids = plan.skillSteps.map(step => step.id);

    expect(ids.length).toBeGreaterThan(3);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it('includes a Quest Point step for a quest requirement', () => {
    const plan = planForTarget('quest', 'Black Knights\' Fortress', maxedUnlocks())!;

    expect(plan.qpStep).toEqual(expect.objectContaining({
      kind: 'qp',
      id: 'Quest Points',
      detail: expect.stringContaining('12 QP'),
      done: false,
    }));
    expect(plan.questSteps.map(step => step.id)).not.toContain('Quest Points 12');
  });

  it("does not count a gated quest's own points toward its Quest Point gate", () => {
    const tenQuestPoints = ["Cook's Assistant", 'Sheep Shearer', 'Rune Mysteries', 'Romeo & Juliet', 'Imp Catcher', "Witch's Potion"];
    const plan = planForTarget('quest', "Black Knights' Fortress", maxedUnlocks({ quests: tenQuestPoints }))!;

    expect(plan.questSteps.map(step => step.id)).toEqual(["Black Knights' Fortress"]);
    expect(plan.qpStep?.detail).toBe('12 QP — plan yields 10, need more quests');
  });

  it('does not count quests that need the gated quest first', () => {
    const nineQuestPoints = ['Druidic Ritual', "Cook's Assistant", 'Sheep Shearer', 'Rune Mysteries', 'Imp Catcher', "Witch's Potion"];
    const plan = planForTarget('quest', 'Recruitment Drive', maxedUnlocks({ quests: nineQuestPoints }))!;

    expect(plan.questSteps.map(step => step.id)).toEqual(["Black Knights' Fortress", 'Recruitment Drive']);
    expect(plan.qpStep?.detail).toBe('12 QP — plan yields 9, need more quests');
  });
  it('surfaces an actionable alternative-access step for oneOf quests', () => {
    const plan = planForTarget('quest', 'Enter the Abyss', maxedUnlocks({
      quests: ['Rune Mysteries'],
      regions: ['Wilderness'],
    }))!;

    expect(plan.regionSteps).toEqual([]);
    expect(plan.alternativeSteps).toEqual([
      expect.objectContaining({
        done: false,
        label: "One of: East Ardougne or Tree Gnome Stronghold or Wizards' Guild + Magic 66",
        routes: expect.arrayContaining([
          expect.objectContaining({ label: 'East Ardougne' }),
          expect.objectContaining({ label: "Wizards' Guild + Magic 66" }),
        ]),
      }),
    ]);
    expect(plan.alreadyReachable).toBe(false);
  });
  it("plans a route's own skill level, such as the Wizards' Guild's Magic 66", () => {
    const plan = planForTarget('quest', 'Enter the Abyss', maxedUnlocks({
      quests: ['Rune Mysteries'],
      regions: ['Wilderness'],
      skills: { ...maxedUnlocks().skills, Magic: 3 },
      levels: { ...maxedUnlocks().levels, Magic: 12 },
    }))!;

    const guildRoute = plan.alternativeSteps[0].routes!
      .find(route => route.label === "Wizards' Guild + Magic 66")!;
    expect(guildRoute.blockers).toEqual([
      expect.objectContaining({ kind: 'region', id: "Wizards' Guild", unlockTable: TableType.GUILDS }),
      expect.objectContaining({
        kind: 'skill', id: 'Magic', label: 'Magic',
        detail: 'Lv 66 (have 12)', unlockTable: TableType.SKILLS,
      }),
    ]);
    expect(plan.alternativeSteps[0].routes!
      .find(route => route.label === 'East Ardougne')!.blockers
      .some(blocker => blocker.kind === 'skill')).toBe(false);
  });
});

describe('planForTarget — Chunked area steps', () => {
  const chunkedUnlocks = () => maxedUnlocks({ chunks: [] });

  it('plans an area as any one of its chunks, not an Areas unlock', () => {
    const plan = planForTarget('region', 'Falador', chunkedUnlocks(), 'chunked')!;

    expect(plan.regionSteps).toEqual([expect.objectContaining({
      kind: 'region', id: 'Falador', unlockTable: TableType.CHUNKS,
      detail: 'Unlock any chunk in this area',
    })]);
    const chunks = plan.regionSteps[0].relatedIds!;
    expect(chunks.length).toBeGreaterThan(0);
    // Unlocking any one of those chunks reaches the area.
    expect(isAreaReachable('Falador', { ...chunkedUnlocks(), chunks: [chunks[0]] } as any, 'chunked')).toBe(true);
    expect(planForTarget('region', 'Falador', chunkedUnlocks())!.regionSteps[0])
      .toMatchObject({ unlockTable: TableType.REGIONS });
  });

  it("plans a quest route's areas as chunks in Chunked", () => {
    const plan = planForTarget('quest', 'Enter the Abyss', maxedUnlocks({
      chunks: [],
      quests: ['Rune Mysteries'],
    }), 'chunked')!;

    const routes = plan.alternativeSteps
      .find(step => step.label.includes('East Ardougne'))!.routes;
    expect(routes.find(route => route.label === 'East Ardougne')!.blockers).toEqual([
      expect.objectContaining({ id: 'East Ardougne', unlockTable: TableType.CHUNKS }),
    ]);
    expect(plan.steps.some(step => 'unlockTable' in step && step.unlockTable === TableType.REGIONS)).toBe(false);
  });
});

describe('planForTarget — diaries', () => {
  it('merges gating quests and required regions into the plan', () => {
    const base = maxedUnlocks();
    for (const d of Object.values(DIARY_DATA)) {
      const plan = planForTarget('diary', d.id, base)!;
      // Every shared canonical task quest (if incomplete) should appear.
      const stepIds = new Set(plan.questSteps.map((s) => s.id));
      const taskQuests = ALL_DIARY_TASKS
        .filter(task => task.tierId === d.id)
        .flatMap(task => task.allQuests ? [...QUEST_CAPE_QUEST_IDS] : (task.quests ?? []));
      for (const qid of taskQuests) {
        if (QUEST_DATA[qid] && !base.quests.includes(qid)) {
          expect(stepIds.has(qid)).toBe(true);
        }
      }
    }
  });
  it('includes the canonical 32 Quest Point step for Varrock Medium', () => {
    const plan = planForTarget('diary', 'Varrock Medium', maxedUnlocks({
      regions: ['Varrock'],
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Varrock Medium' || task.id !== 'var_med_2')
        .map(task => task.id),
    }))!;

    expect(plan.qpStep).toEqual(expect.objectContaining({
      kind: 'qp',
      id: 'Quest Points',
      detail: expect.stringContaining('32 QP'),
      done: false,
    }));
  });
  it('delegates diary skill gates and omits requirements already met', () => {
    const diary = Object.values(DIARY_DATA).find(candidate =>
      Object.keys(candidate.skills).length > 0)!;
    const plan = planForTarget('diary', diary.id, maxedUnlocks())!;

    expect(plan.skillSteps).toEqual([]);
  });

  it('plans canonical remaining task gates instead of stale aggregate gates', () => {
    const plan = planForTarget('diary', 'Ardougne Easy', maxedUnlocks({
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => [
        ...(task.regions ?? []), ...(task.anyOfRegions ?? []),
      ]))],
      quests: Object.keys(QUEST_DATA).filter(quest => quest !== 'Biohazard'),
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Ardougne Easy' || task.id !== 'ard_easy_6')
        .map(task => task.id),
    }))!;

    expect(plan.alreadyReachable).toBe(false);
    expect(plan.questSteps.map(step => step.id)).toContain('Biohazard');
    expect(plan.questSteps.map(step => step.id)).not.toContain('Plague City');
  });
  it('keeps a stored completed diary done with no reconstructed backlog', () => {
    const diary = Object.values(DIARY_DATA)[0];
    const plan = planForTarget('diary', diary.id, maxedUnlocks({
      diaries: [diary.id],
    }))!;

    expect(plan.alreadyDone).toBe(true);
    expect(plan.remaining).toBe(0);
    expect(plan.steps).toEqual([]);
  });
  it('keeps blocked one-of requirements as nested alternative routes', () => {
    const plan = planForTarget('diary', 'Karamja Hard', maxedUnlocks({
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

    expect(plan.regionSteps).toEqual([]);
    expect(plan.skillSteps).toEqual([]);
    expect(plan.alternativeSteps).toEqual([
      expect.objectContaining({
        label: expect.stringContaining('Combat level 100'),
        routes: [
          expect.objectContaining({
            blockers: [expect.objectContaining({ kind: 'skill', id: 'Combat level' })],
          }),
          expect.objectContaining({
            blockers: [expect.objectContaining({ kind: 'skill', id: 'Slayer' })],
          }),
        ],
      }),
    ]);
  });

  it('keeps combined and limited-any routes tied to their real skills', () => {
    const plan = planForTarget('diary', 'Falador Hard', maxedUnlocks({
      regions: ["Warriors' Guild"],
      skills: { Attack: 6, Strength: 6 },
      levels: { Attack: 60, Strength: 60 },
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Falador Hard' || task.id !== 'fal_hard_10')
        .map(task => task.id),
    }))!;

    expect(plan.alternativeSteps).toEqual([
      expect.objectContaining({
        routes: [
          expect.objectContaining({
            blockers: [expect.objectContaining({
              relatedIds: ['Attack', 'Strength'],
              detail: expect.stringContaining('have 120'),
            })],
          }),
          expect.objectContaining({
            blockers: [expect.objectContaining({
              relatedIds: ['Attack', 'Strength'],
              detail: expect.stringContaining('Attack 60'),
            })],
          }),
        ],
      }),
    ]);
  });

  it('suggests a Skills key for combined and limited-any routes only when tiers cap them', () => {
    const routes = (tier: number) => planForTarget('diary', 'Falador Hard', maxedUnlocks({
      regions: ["Warriors' Guild"],
      skills: { Attack: tier, Strength: tier },
      levels: { Attack: 60, Strength: 60 },
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Falador Hard' || task.id !== 'fal_hard_10')
        .map(task => task.id),
    }))!.alternativeSteps[0].routes.map(route => route.blockers[0].unlockTable);

    // Caps of 60 + 60 fall short of 130 combined and of 99 in either.
    expect(routes(6)).toEqual([TableType.SKILLS, TableType.SKILLS]);
    // At tier 10 only XP is missing.
    expect(routes(10)).toEqual([undefined, undefined]);
  });

  it('does not require miniquests for the Quest cape diary task', () => {
    const plan = planForTarget('diary', 'Lumbridge Elite', maxedUnlocks({
      equipment: { Cape: 6 },
      regions: ['Draynor Village'],
      quests: [...QUEST_CAPE_QUEST_IDS],
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Lumbridge Elite' || task.id !== 'lum_elite_6')
        .map(task => task.id),
    }))!;

    expect(plan.alreadyReachable).toBe(true);
    expect(plan.questSteps).toEqual([]);
  });

  it.each([
    ['Falador Easy', 'fal_easy_7', 'Ice Mountain', 'Goblin Village'],
    ['Falador Hard', 'fal_hard_7', "Heroes' Guild", 'Taverley'],
    ['Kandarin Medium', 'kan_med_3', 'Ranging Guild', 'Hemenster'],
    ['Wilderness Hard', 'wild_hard_4', 'Resource Area', 'Mage Arena'],
  ])('canonicalizes %s geographic blocker %s to %s with recognizable copy', (
    tierId,
    taskId,
    alias,
    canonical,
  ) => {
    const plan = planForTarget('diary', tierId, maxedUnlocks({
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== tierId || task.id !== taskId)
        .map(task => task.id),
    }))!;

    const step = plan.regionSteps.find(regionStep => regionStep.id === canonical);
    expect(step?.label).toContain(canonical);
    expect(step?.label).toContain(alias);
  });
});

describe('planForTarget — quest locations', () => {
  const unlockableAreas = new Set([
    ...Object.keys(REGION_GROUPS), ...Object.values(REGION_GROUPS).flat(), 'Misthalin', ...MISTHALIN_AREAS,
  ]);
  const fresh = () => maxedUnlocks({ skills: {}, levels: {} });

  it('plans the areas that unlock a location, never its place label', () => {
    // Druidic Ritual needs "North Taverley" and "South Taverley", both in Taverley.
    expect(planForTarget('quest', 'Druidic Ritual', fresh(), 'vanilla')!.regionSteps.map(step => step.id)).toEqual(['Taverley']);
  });

  it('plans only areas the Areas table can grant, for every quest', () => {
    const notAreas = Object.keys(QUEST_DATA).flatMap(id => {
      const plan = planForTarget('quest', id, fresh(), 'vanilla')!;
      return [...plan.regionSteps, ...plan.alternativeSteps.flatMap(step => step.routes.flatMap(route => route.blockers))]
        .filter(step => step.unlockTable === TableType.REGIONS && !unlockableAreas.has(step.id))
        .map(step => `${id}: ${step.id}`);
    });
    expect(notAreas).toEqual([]);
  });

  it('plans a location as a choice of its exact chunks in Chunked mode', () => {
    const plan = planForTarget('quest', 'Druidic Ritual', fresh(), 'chunked')!;
    expect(plan.regionSteps).toEqual([]);
    expect(plan.alternativeSteps.map(step => [step.label, step.routes.map(route => route.blockers)])).toEqual([
      ['One of: North Taverley', [[expect.objectContaining({ kind: 'region', id: '45,54', unlockTable: TableType.CHUNKS })]]],
      ['One of: South Taverley', [[expect.objectContaining({ kind: 'region', id: '45,53', unlockTable: TableType.CHUNKS })]]],
    ]);
  });

  it('builds one-of routes from a location’s areas, or its chunks in Chunked mode', () => {
    const id = '__location_route__';
    QUEST_DATA[id] = {
      ...QUEST_DATA['Druidic Ritual'], id, name: id, accessPolicy: 'regions', regions: [], locations: [],
      oneOf: [
        { locations: [{ id: 'crossing', label: 'Test crossing', standardAreas: ['Falador'], chunkOptions: [{ cx: 47, cy: 51 }, { cx: 46, cy: 51 }] }] },
        { regions: ['Catherby'] },
      ],
    };
    try {
      expect(planForTarget('quest', id, fresh(), 'vanilla')!.alternativeSteps[0].routes[0].blockers).toEqual([
        expect.objectContaining({ kind: 'region', id: 'Falador', unlockTable: TableType.REGIONS }),
      ]);
      expect(planForTarget('quest', id, fresh(), 'chunked')!.alternativeSteps[0].routes[0].blockers).toEqual([
        expect.objectContaining({ kind: 'region', id: '47,51', relatedIds: ['47,51', '46,51'], unlockTable: TableType.CHUNKS }),
      ]);
    } finally {
      delete QUEST_DATA[id];
    }
  });
});

describe('planForTarget — skills gated by an unlocking quest', () => {
  // Reported Vanilla run with no quests: Taverley is locked, and Herblore,
  // Agility and Thieving are at tiers 1/1/3 with Agility 10 and Thieving 25.
  const reported = (quests: string[] = []) => maxedUnlocks({
    quests,
    skills: { ...Object.fromEntries(SKILLS_LIST.map(skill => [skill, 0])), Herblore: 1, Agility: 1, Thieving: 3 },
    levels: {
      ...Object.fromEntries(SKILLS_LIST.map(skill => [skill, skill === 'Hitpoints' ? 10 : 1])),
      Agility: 10, Thieving: 25,
    },
  });

  it('plans Druidic Ritual and its Taverley access before The Dig Site', () => {
    const plan = planForTarget('quest', 'The Dig Site', reported(), 'vanilla')!;

    expect(plan.questSteps.map(step => step.id)).toEqual(['Druidic Ritual', 'The Dig Site']);
    expect(plan.regionSteps.map(step => step.id)).toEqual(['Taverley']);
    expect(plan.skillSteps).toEqual([expect.objectContaining({ id: 'Herblore', detail: 'Lv 10 (have 1)' })]);
    expect(plan.alreadyReachable).toBe(false);
  });

  it("plans Druidic Ritual and its Taverley access for Desert Medium's combat potion", () => {
    const plan = planForTarget('diary', 'Desert Medium', reported(), 'vanilla')!;

    expect(plan.questSteps.map(step => step.id)).toContain('Druidic Ritual');
    expect(plan.regionSteps.map(step => step.id)).toContain('Taverley');
    expect(planForTarget('diary', 'Desert Medium', reported(['Druidic Ritual']), 'vanilla')!
      .questSteps.map(step => step.id)).not.toContain('Druidic Ritual');
  });
});

describe('planForTarget — regions', () => {
  it('a locked region is a single-step plan', () => {
    const region = Object.keys(REGION_GROUPS)[0];
    const plan = planForTarget('region', region, maxedUnlocks())!;
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].kind).toBe('region');
    expect(plan.remaining).toBe(1);
  });

  it('an unlocked region is a done plan', () => {
    const region = Object.keys(REGION_GROUPS)[0];
    const plan = planForTarget('region', region, maxedUnlocks({ regions: [region] }))!;
    expect(plan.alreadyDone).toBe(true);
    expect(plan.remaining).toBe(0);
  });
});

describe('listGoalTargets', () => {
  it('includes every quest, diary tier, and region', () => {
    const targets = listGoalTargets();
    const counts = { quest: 0, diary: 0, region: 0 };
    for (const t of targets) counts[t.kind]++;
    expect(counts.quest).toBe(Object.keys(QUEST_DATA).length);
    expect(counts.diary).toBe(Object.keys(DIARY_DATA).length);
    expect(counts.region).toBe(Object.keys(REGION_GROUPS).length);
  });
});
  it('plans Prying Times as a manual confirmation followed by quest completion', () => {
    const plan = planForTarget('quest', 'Prying Times', maxedUnlocks({
      regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
      quests: ['Pandemonium', "The Knight's Sword"],
    }))!;

    expect(plan.alreadyReachable).toBe(false);
    expect(plan.needsConfirmation).toBe(true);
    expect(plan.manualSteps).toEqual([expect.objectContaining({
      kind: 'manual',
      label: 'Confirm: One open Sailing task slot',
      detail: 'Required for Prying Times',
      done: false,
    })]);
    expect(plan.steps.map(step => step.kind)).toEqual(['manual', 'quest']);
    expect(plan.remaining).toBe(2);
  });

  it('adds the remaining Varrock Kudos check to a diary plan', () => {
    const completedTasks = ALL_DIARY_TASKS
      .filter(task => task.tierId !== 'Varrock Hard' || task.id !== 'var_hard_2')
      .map(task => task.id);
    const plan = planForTarget('diary', 'Varrock Hard', maxedUnlocks({
      regions: ['Varrock'],
      completedTasks,
    }))!;

    expect(plan.manualSteps).toContainEqual(expect.objectContaining({
      kind: 'manual',
      label: 'Confirm: 153 Varrock Museum Kudos',
    }));
    expect(plan.alreadyReachable).toBe(false);
    expect(plan.needsConfirmation).toBe(true);
  });

  it('deduplicates identical manual checks across diary tasks', () => {
    const syntheticLength = ALL_DIARY_TASKS.length;
    const syntheticSharedTask = {
      id: 'goal_planner_shared_manual_a',
      tierId: 'Ardougne Easy',
      description: 'Synthetic shared check source A',
      regions: ['Ardougne'],
      manualRequirements: ['Shared manual check'],
    };
    const syntheticDuplicateTask = {
      id: 'goal_planner_shared_manual_b',
      tierId: 'Ardougne Easy',
      description: 'Synthetic shared check source B',
      regions: ['Ardougne'],
      manualRequirements: ['Shared manual check'],
    };
    const syntheticUniqueTask = {
      id: 'goal_planner_unique_manual',
      tierId: 'Ardougne Easy',
      description: 'Synthetic unique check source',
      regions: ['Ardougne'],
      manualRequirements: ['Unique manual check'],
    };

    ALL_DIARY_TASKS.push(syntheticSharedTask, syntheticDuplicateTask, syntheticUniqueTask);
    try {
      const plan = planForTarget('diary', 'Ardougne Easy', maxedUnlocks({
        regions: ['Ardougne'],
      }))!;

      const syntheticManual = plan.manualSteps.filter((step) =>
        step.detail?.startsWith('Required for Synthetic'),
      );
      expect(syntheticManual).toEqual([
        expect.objectContaining({
          kind: 'manual',
          label: 'Confirm: Shared manual check',
          detail: 'Required for Synthetic shared check source A',
          done: false,
        }),
        expect.objectContaining({
          kind: 'manual',
          label: 'Confirm: Unique manual check',
          detail: 'Required for Synthetic unique check source',
          done: false,
        }),
      ]);
    } finally {
      ALL_DIARY_TASKS.length = syntheticLength;
    }
  });
