import { describe, it, expect } from 'vitest';
import { SKILLS_LIST } from '../constants';
import { QUEST_CAPE_QUEST_IDS, QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { REGION_GROUPS } from '../data/items';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { planForTarget, listGoalTargets } from './goalPlanner';
import { getQuestStatus } from './journalStatus';

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

describe('planForTarget — quests', () => {
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
      (q) => getQuestStatus(q, base) === 'AVAILABLE',
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
    const plan = planForTarget('quest', 'Doric\'s Quest', maxedUnlocks({
      regions: ['Asgarnia'],
      skills: { Mining: 1 },
      levels: { Mining: 15 },
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
  it('surfaces an actionable alternative-access step for oneOf quests', () => {
    const plan = planForTarget('quest', 'Enter the Abyss', maxedUnlocks({
      quests: ['Rune Mysteries'],
      regions: ['Wilderness'],
    }))!;

    expect(plan.regionSteps).toEqual([]);
    expect(plan.alternativeSteps).toEqual([
      expect.objectContaining({
        done: false,
        label: "One of: East Ardougne or Tree Gnome Stronghold or Wizards' Guild",
        routes: expect.arrayContaining([
          expect.objectContaining({ label: 'East Ardougne' }),
          expect.objectContaining({ label: "Wizards' Guild" }),
        ]),
      }),
    ]);
    expect(plan.alreadyReachable).toBe(false);
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
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => task.regions ?? []))],
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

  it('does not require miniquests for the Quest cape diary task', () => {
    const plan = planForTarget('diary', 'Lumbridge Elite', maxedUnlocks({
      regions: ['Draynor Village'],
      quests: [...QUEST_CAPE_QUEST_IDS],
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Lumbridge Elite' || task.id !== 'lum_elite_6')
        .map(task => task.id),
    }))!;

    expect(plan.alreadyReachable).toBe(true);
    expect(plan.questSteps).toEqual([]);
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
      regions: ['The Open Seas'],
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
