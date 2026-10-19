/**
 * Achievement Diary progress counted in tasks, the one count every Journal
 * surface shows (the progress rings, the OSRS header, the Diaries filter bar
 * and the home summary). A tier marked complete counts all of its tasks, and
 * each task logged by hand counts once, so a save with tasks logged but no
 * tier finished no longer reads 0%.
 */
import { ALL_DIARY_TASKS, type DiaryTask } from '../data/diaryTasks';
import type { UnlockState } from '../types';

export interface DiaryTaskProgress {
  done: number;
  total: number;
}

export const diaryTaskProgress = (
  unlocks: Pick<UnlockState, 'diaries' | 'completedTasks'>,
  tasks: readonly Pick<DiaryTask, 'id' | 'tierId'>[] = ALL_DIARY_TASKS,
): DiaryTaskProgress => {
  const tiers = new Set(unlocks.diaries);
  const logged = new Set(unlocks.completedTasks);
  const done = tasks.filter(task => tiers.has(task.tierId) || logged.has(task.id)).length;
  return { done, total: tasks.length };
};
