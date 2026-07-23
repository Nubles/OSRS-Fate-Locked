import { describe, it, expect } from 'vitest';
import { SKILLS_LIST } from '../constants';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { REGION_GROUPS } from '../data/items';
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

  it('surfaces an actionable alternative-access step for oneOf quests', () => {
    const plan = planForTarget('quest', 'Enter the Abyss', maxedUnlocks({
      quests: ['Rune Mysteries'],
    }))!;

    expect(plan.regionSteps).toEqual([
      expect.objectContaining({
        done: false,
        label: "One of: East Ardougne or Tree Gnome Stronghold or Wizards' Guild",
        detail: 'Unlock any listed route',
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
      // Every gating quest (if incomplete) should appear in the quest steps.
      const stepIds = new Set(plan.questSteps.map((s) => s.id));
      for (const qid of d.quests) {
        if (QUEST_DATA[qid] && !base.quests.includes(qid)) {
          expect(stepIds.has(qid)).toBe(true);
        }
      }
    }
  });
  it('delegates diary skill gates and omits requirements already met', () => {
    const diary = Object.values(DIARY_DATA).find(candidate =>
      Object.keys(candidate.skills).length > 0)!;
    const plan = planForTarget('diary', diary.id, maxedUnlocks())!;

    expect(plan.skillSteps).toEqual([]);
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
