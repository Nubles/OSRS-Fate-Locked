/**
 * Pure (side-effect-free) status computation for Journal items.
 * Mirrors the logic inside QuestLog / DiaryLog but accepts an explicit
 * `unlocks` snapshot so callers can diff two snapshots (e.g. before/after
 * a quest completion) without needing component context.
 */

import { QuestData, QUEST_DATA } from '../data/questData';
import { DiaryTier } from '../data/diaryData';
import { isFreeArea } from './freeAreas';

export type QuestStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_SKILL' | 'LOCKED_QUEST';
export type DiaryStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED_REGION' | 'LOCKED_QUEST';

export function getQuestStatus(quest: QuestData, unlocks: any): QuestStatus {
  if (unlocks.quests.includes(quest.id)) return 'COMPLETED';

  const missingRegion = quest.regions.some(r => {
    if (isFreeArea(r)) return false;
    return !unlocks.regions.includes(r);
  });
  if (missingRegion) return 'LOCKED_REGION';

  const currentQP: number = (unlocks.quests as string[]).reduce(
    (acc, qid) => acc + (QUEST_DATA[qid]?.points ?? 0), 0,
  );
  const missingSkill = Object.entries(quest.skills as Record<string, number>).some(([skill, lvl]) => {
    if (skill === 'Quest Points') return currentQP < lvl;
    const current: number = unlocks.levels[skill] ?? 1;
    const isUnlocked: boolean = (unlocks.skills[skill] ?? 0) > 0;
    return !isUnlocked || current < lvl;
  });
  if (missingSkill) return 'LOCKED_SKILL';

  const missingPrereq = quest.prereqs.some((qid: string) => !unlocks.quests.includes(qid));
  if (missingPrereq) return 'LOCKED_QUEST';

  return 'AVAILABLE';
}

export function getDiaryStatus(diary: DiaryTier, unlocks: any): DiaryStatus {
  if (unlocks.diaries.includes(diary.id)) return 'COMPLETED';

  const missingRegion = diary.requiredRegions.some(r => {
    return !isFreeArea(r) && !unlocks.regions.includes(r);
  });
  if (missingRegion) return 'LOCKED_REGION';

  const missingQuest = diary.quests.some((qid: string) => !unlocks.quests.includes(qid));
  if (missingQuest) return 'LOCKED_QUEST';

  return 'AVAILABLE';
}

/**
 * Counts how many of `tasks` the player can complete right now:
 *   • not yet done
 *   • all skill reqs met (skill unlocked AND level reached)
 *   • all quest reqs met
 *   • all region reqs unlocked (Misthalin is always free)
 * "Closest first" ranking and the diary insights both use this, so a tier
 * with few-but-blocked tasks never outranks one the player can finish today.
 */
export interface DoableTask {
  id: string;
  skills?: Record<string, number>;
  quests?: string[];
  regions?: string[];
}

export function countDoableTasks(tasks: DoableTask[], unlocks: any): number {
  return tasks.filter(task => {
    if (unlocks.completedTasks.includes(task.id)) return false;
    if (task.skills && !Object.entries(task.skills).every(
      ([skill, lvl]) => (unlocks.skills[skill] || 0) > 0 && (unlocks.levels[skill] || 1) >= (lvl as number),
    )) return false;
    if (task.quests && !task.quests.every(q => unlocks.quests.includes(q))) return false;
    if (task.regions && !task.regions.every(
      r => isFreeArea(r) || unlocks.regions.includes(r),
    )) return false;
    return true;
  }).length;
}
