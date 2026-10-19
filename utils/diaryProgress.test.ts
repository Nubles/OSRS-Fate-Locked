import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { diaryTaskProgress } from './diaryProgress';
import { journalRingStats } from '../components/JournalProgressRings';
import type { UnlockState } from '../types';

/**
 * A save with 34 diary tasks logged and no tier finished showed 0% on the
 * Journal's diary ring and filter bar, which counted tiers. Every surface
 * now counts tasks with diaryTaskProgress.
 */
const unlocks = (diaries: string[], completedTasks: string[]): Pick<UnlockState, 'diaries' | 'completedTasks'> => (
  { diaries, completedTasks }
);
const tasksOf = (tierId: string) => ALL_DIARY_TASKS.filter(task => task.tierId === tierId).map(task => task.id);

describe('diaryTaskProgress', () => {
  it('counts logged tasks when no tier is finished', () => {
    const logged = ALL_DIARY_TASKS.slice(0, 34).map(task => task.id);
    expect(diaryTaskProgress(unlocks([], logged))).toEqual({ done: 34, total: ALL_DIARY_TASKS.length });
  });

  it('counts every task of a tier marked complete', () => {
    expect(diaryTaskProgress(unlocks(['Ardougne Easy'], [])).done).toBe(tasksOf('Ardougne Easy').length);
  });

  it('counts a task once when it is logged and its tier is complete', () => {
    const easy = tasksOf('Ardougne Easy');
    const medium = tasksOf('Ardougne Medium');
    expect(diaryTaskProgress(unlocks(['Ardougne Easy'], [...easy, medium[0], medium[0]])).done)
      .toBe(easy.length + 1);
  });

  it('ignores ids that are not diary tasks, such as combat achievements', () => {
    expect(diaryTaskProgress(unlocks(['Not a tier'], ['not_a_task'])).done).toBe(0);
  });

  it('reaches the total when every tier is complete', () => {
    const progress = diaryTaskProgress(unlocks(Object.keys(DIARY_DATA), []));
    expect(progress.done).toBe(progress.total);
  });

  it('is what the Journal rings show', () => {
    const state = {
      ...unlocks(['Ardougne Easy'], ALL_DIARY_TASKS.slice(40, 74).map(task => task.id)),
      quests: [], cas: [],
    } as unknown as UnlockState;
    const rings = journalRingStats(state);
    expect({ done: rings.diaryDone, total: rings.diaryTotal }).toEqual(diaryTaskProgress(state));
    expect(rings.diaryDone).toBeGreaterThan(0);
  });
});
