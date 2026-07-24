/**
 * Skill Bottleneck Advisor — the third advisor.
 *
 * Answers "which skill should I train next, and to what level?" For every
 * skill it finds the next level threshold that actually gates content, then
 * measures how much that threshold opens up:
 *
 *   • QUESTS  — quests that go AVAILABLE once the level is reached (plus the
 *               full downstream cascade), via the shared unlock-impact engine.
 *   • DIARIES — diary tiers you can newly *fully complete* (regions + quests +
 *               every skill gate met). NOTE: getDiaryStatus deliberately
 *               ignores skill gates, so we evaluate them explicitly here.
 *
 * Pure & side-effect-free — safe inside useMemo.
 */

import { SKILLS_LIST } from '../constants';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA, DiaryTier } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { computeUnlockImpact } from './unlockImpact';
import { getDiaryStatus } from './journalStatus';

export interface RankedSkill {
  id: string;          // skill name
  currentLevel: number;
  targetLevel: number; // next gating threshold
  newQuestNames: string[];
  newDiaryIds: string[];
  cascadeQuestNames: string[];
  cascadeDiaryIds: string[];
  score: number;
  cascadeScore: number;
}

/** A diary tier is fully completable when its canonical remaining tasks have no blockers. */
function diaryFullyDoable(d: DiaryTier, unlocks: any, gameModeId?: string): boolean {
  const status = getDiaryStatus(d, unlocks, gameModeId);
  return status === 'AVAILABLE' || status === 'COMPLETED';
}

/**
 * Returns skills ranked by the impact of training to their next gating level.
 * Skills whose next threshold unlocks nothing are omitted. Sorted by cascade
 * score, then direct score, then lower target level, then name.
 */
export function rankSkillBottlenecks(unlocks: any, gameModeId?: string): RankedSkill[] {
  const allDiaries = Object.values(DIARY_DATA);

  const ranked: RankedSkill[] = [];

  for (const skill of SKILLS_LIST) {
    const current = unlocks.levels[skill] ?? 1;

    // Distinct level thresholds for this skill across quests + diaries,
    // above the current level. Ascending — we want the *nearest* useful one.
    const thresholds = new Set<number>();
    for (const q of Object.values(QUEST_DATA)) {
      const lvl = (q.skills as Record<string, number>)[skill];
      if (lvl && lvl > current) thresholds.add(lvl);
    }
    for (const task of ALL_DIARY_TASKS) {
      const sharedLevel = task.skills?.[skill];
      if (sharedLevel && sharedLevel > current) thresholds.add(sharedLevel);
      for (const option of task.oneOf ?? []) {
        const routeLevel = option.skills?.[skill];
        if (routeLevel && routeLevel > current) thresholds.add(routeLevel);
        if (option.anySkillLevel && option.anySkillLevel > current) {
          thresholds.add(option.anySkillLevel);
        }
      }
    }
    const sorted = Array.from(thresholds).sort((a, b) => a - b);
    if (sorted.length === 0) continue;

    // Walk thresholds and take the first that actually unlocks something.
    let chosen: RankedSkill | null = null;
    for (const target of sorted) {
      const simulated = {
        ...unlocks,
        levels: { ...unlocks.levels, [skill]: target },
        // Treat the skill as unlocked at the target so the simulation is valid
        // even for skills still on tier 0.
        skills: { ...unlocks.skills, [skill]: Math.max(unlocks.skills[skill] ?? 0, 1) },
      };

      const impact = computeUnlockImpact(unlocks, simulated, gameModeId);

      // Skill-aware diary tiers: newly fully-doable right now (regions+quests
      // already satisfied, this skill raise closes the last skill gap).
      const directDiaryIds = allDiaries
        .filter((d) => !diaryFullyDoable(d, unlocks, gameModeId) && diaryFullyDoable(d, simulated, gameModeId))
        .map((d) => d.id);

      // Cascade diaries: same check but on the post-cascade quest snapshot,
      // so quests the skill unblocks can in turn satisfy diary quest gates.
      const cascadeSnap = { ...simulated, quests: impact.finalQuestIds };
      const cascadeDiaryIds = allDiaries
        .filter((d) => !diaryFullyDoable(d, unlocks, gameModeId) && diaryFullyDoable(d, cascadeSnap, gameModeId))
        .map((d) => d.id);

      const unlocksSomething =
        impact.directQuestNames.length > 0 ||
        impact.cascadeQuestNames.length > 0 ||
        directDiaryIds.length > 0 ||
        cascadeDiaryIds.length > 0;

      if (!unlocksSomething) continue;

      const score = impact.directQuestNames.length * 2 + directDiaryIds.length;
      const cascadeScore = impact.cascadeQuestNames.length * 2 + cascadeDiaryIds.length;

      chosen = {
        id: skill,
        currentLevel: current,
        targetLevel: target,
        newQuestNames: impact.directQuestNames,
        newDiaryIds: directDiaryIds,
        cascadeQuestNames: impact.cascadeQuestNames,
        cascadeDiaryIds,
        score,
        cascadeScore,
      };
      break;
    }

    if (chosen) ranked.push(chosen);
  }

  return ranked.sort(
    (a, b) =>
      b.cascadeScore - a.cascadeScore ||
      b.score - a.score ||
      a.targetLevel - b.targetLevel ||
      a.id.localeCompare(b.id),
  );
}
