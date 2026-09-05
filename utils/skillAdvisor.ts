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
 *               every canonical task gate met).
 *
 * Pure & side-effect-free — safe inside useMemo.
 */

import { SKILLS_LIST } from '../constants';
import { hasCompletedQuestCapeRequirements, QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { computeUnlockImpact, prepareUnlockImpactContext } from './unlockImpact';
import { EligibilityBlocker, evaluateDiaryTierEligibility, getDiaryStatus } from './journalStatus';
import { actualCombatLevel } from './slayerReach';
import { actualSkillLevel } from './skillLevels';

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

/**
 * Returns skills ranked by the impact of training to their next gating level.
 * Skills whose next threshold unlocks nothing are omitted. Sorted by cascade
 * score, then direct score, then lower target level, then name.
 */
export function rankSkillBottlenecks(unlocks: any, gameModeId?: string): RankedSkill[] {
  const allDiaries = Object.values(DIARY_DATA);
  const impactContext = prepareUnlockImpactContext(unlocks, gameModeId);
  const baseDiaryEligibility = new Map(allDiaries.map(diary => [
    diary.id,
    evaluateDiaryTierEligibility(diary, unlocks, gameModeId),
  ]));
  const isOpen = (status: string | undefined) => (
    status === 'AVAILABLE' || status === 'COMPLETED'
  );

  const combatSkillNames = [
    'Attack', 'Strength', 'Defence', 'Hitpoints', 'Prayer', 'Ranged', 'Magic',
  ] as const;
  const combatSkills = new Set<string>(combatSkillNames);
  const combatRequirements = new Set<number>();

  // Build the threshold index once. The previous skill-first scan revisited
  // all 492 tasks and all quest requirements for every skill.
  const thresholdsBySkill = new Map<string, Set<number>>(
    SKILLS_LIST.map(skill => [skill, new Set<number>()]),
  );
  const addThreshold = (skill: string, level: number) => {
    const current = unlocks.levels[skill] ?? (skill === 'Hitpoints' ? 10 : 1);
    if (level > current && level <= 99) thresholdsBySkill.get(skill)?.add(level);
  };
  for (const quest of Object.values(QUEST_DATA)) {
    for (const [skill, level] of Object.entries(quest.skills)) addThreshold(skill, level);
    if (quest.combatLevel !== undefined) combatRequirements.add(quest.combatLevel);
  }
  for (const task of ALL_DIARY_TASKS) {
    for (const requirement of [task, ...(task.oneOf ?? [])]) {
      for (const [skill, level] of Object.entries(requirement.skills ?? {})) {
        addThreshold(skill, level);
      }
      if (requirement.anySkillLevel) {
        for (const skill of SKILLS_LIST) {
          addThreshold(skill, requirement.anySkillLevel);
        }
      }
      if (requirement.anyOfSkillsLevel) {
        for (const skill of requirement.anyOfSkillsLevel.skills) {
          addThreshold(skill, requirement.anyOfSkillsLevel.level);
        }
      }
      if (requirement.combinedSkillLevel) {
        for (const skill of requirement.combinedSkillLevel.skills) {
          const otherLevels = requirement.combinedSkillLevel.skills
            .filter(candidate => candidate !== skill)
            .reduce((sum, candidate) => sum + actualSkillLevel(unlocks, candidate), 0);
          addThreshold(skill, requirement.combinedSkillLevel.level - otherLevels);
        }
      }
      if (requirement.combatLevel !== undefined) {
        combatRequirements.add(requirement.combatLevel);
      }
    }
  }

  for (const requiredCombatLevel of combatRequirements) {
    if (actualCombatLevel(unlocks) >= requiredCombatLevel) continue;
    for (const skill of combatSkillNames) {
      const current = unlocks.levels[skill] ?? (skill === 'Hitpoints' ? 10 : 1);
      const candidateTier = Math.max(unlocks.skills[skill] ?? 0, 1);
      for (let level = current + 1; level <= 99; level += 1) {
        const simulated = {
          ...unlocks,
          levels: { ...unlocks.levels, [skill]: level },
          skills: { ...unlocks.skills, [skill]: candidateTier },
        };
        if (actualCombatLevel(simulated) >= requiredCombatLevel) {
          addThreshold(skill, level);
          break;
        }
      }
    }
  }
  const blockerCanChange = (
    blocker: EligibilityBlocker,
    skill: string,
    newQuestIds: Set<string>,
    completesQuestCape: boolean,
  ): boolean => {
    if (blocker.kind === 'skill') {
      return blocker.label.startsWith('Any skill ')
        || blocker.label.includes(skill);
    }
    if (blocker.kind === 'combat') {
      return blocker.label.startsWith('Combat level ') && combatSkills.has(skill);
    }
    if (blocker.kind === 'quest') {
      return newQuestIds.has(blocker.label)
        || (blocker.label === 'All quests' && completesQuestCape);
    }
    if (blocker.kind === 'region') return false;
    return blocker.routes.some(route => route.blockers.every(routeBlocker => (
      blockerCanChange(routeBlocker, skill, newQuestIds, completesQuestCape)
    )));
  };
  const candidateDiaryIds = (
    skill: string,
    newQuestIds: Set<string>,
    completesQuestCape: boolean,
  ): string[] => allDiaries
    .filter(diary => !isOpen(impactContext.baseDiaryStatus.get(diary.id)))
    .filter(diary => baseDiaryEligibility.get(diary.id)!.blockers.every(blocker => (
      blockerCanChange(blocker, skill, newQuestIds, completesQuestCape)
    )))
    .map(diary => diary.id);

  const ranked: RankedSkill[] = [];
  for (const skill of SKILLS_LIST) {
    const current = unlocks.levels[skill] ?? 1;
    const sorted = [...(thresholdsBySkill.get(skill) ?? [])].sort((a, b) => a - b);
    let chosen: RankedSkill | null = null;

    for (const target of sorted) {
      const simulated = {
        ...unlocks,
        levels: { ...unlocks.levels, [skill]: target },
        skills: { ...unlocks.skills, [skill]: Math.max(unlocks.skills[skill] ?? 0, 1) },
      };
      // Quest cascade work is shared, while diary checks are limited below to
      // tiers this skill can affect (and broadened only when new quests cascade).
      const impact = computeUnlockImpact(unlocks, simulated, gameModeId, {
        context: impactContext,
        diaryIds: [],
      });

      const directDiaryIds = candidateDiaryIds(skill, new Set(), false).filter(id => {
        const diary = DIARY_DATA[id];
        return diary && isOpen(getDiaryStatus(diary, simulated, gameModeId));
      });

      let cascadeDiaryIds = directDiaryIds;
      if (impact.cascadeQuestNames.length > 0) {
        const cascadeSnap = { ...simulated, quests: impact.finalQuestIds };
        const newQuestIds = new Set(impact.finalQuestIds.filter(
          id => !unlocks.quests.includes(id),
        ));
        cascadeDiaryIds = candidateDiaryIds(
          skill,
          newQuestIds,
          hasCompletedQuestCapeRequirements(impact.finalQuestIds),
        ).filter(id => {
          const diary = DIARY_DATA[id];
          return diary && isOpen(getDiaryStatus(diary, cascadeSnap, gameModeId));
        });
      }

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
