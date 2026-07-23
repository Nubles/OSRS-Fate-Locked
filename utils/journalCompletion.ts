import { DiaryTask } from '../data/diaryTasks';
import { QuestData } from '../data/questData';
import { UnlockState } from '../types';
import {
  evaluateQuestEligibility,
  taskEligibilityBlockers,
} from './journalStatus';

export type JournalCompletionField = 'quests' | 'diaries' | 'completedTasks';

export const withJournalCompletion = (
  unlocks: UnlockState,
  field: JournalCompletionField,
  id: string,
): UnlockState => {
  const completed = unlocks[field];
  if (completed.includes(id)) return unlocks;
  return { ...unlocks, [field]: [...completed, id] };
};

export interface RollDrawCursor {
  context: string;
  rolls: number;
}

export const claimRollDrawBase = (
  cursor: RollDrawCursor,
  context: string,
): { baseIndex: number; cursor: RollDrawCursor } => {
  const rolls = cursor.context === context ? cursor.rolls : 0;
  return {
    baseIndex: rolls * 3,
    cursor: { context, rolls: rolls + 1 },
  };
};

export type CompletionResult =
  | { ok: true }
  | { ok: false; reason: string };

export const questCompletionDecision = (
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): CompletionResult => {
  const result = evaluateQuestEligibility(quest, unlocks, gameModeId);
  if (result.status === 'COMPLETED') {
    return { ok: false, reason: 'Already completed' };
  }
  return result.eligible
    ? { ok: true }
    : {
        ok: false,
        reason: 'Requires: ' + result.blockers.map(blocker => blocker.label).join(', '),
      };
};

export const diaryTaskCompletionDecision = (
  task: DiaryTask,
  unlocks: UnlockState,
  gameModeId?: string,
): CompletionResult => {
  if (unlocks.completedTasks.includes(task.id)) {
    return { ok: false, reason: 'Already completed' };
  }
  const blockers = taskEligibilityBlockers(task, unlocks, gameModeId);
  return blockers.length === 0
    ? { ok: true }
    : {
        ok: false,
        reason: 'Requires: ' + blockers.map(blocker => blocker.label).join(', '),
      };
};

export const canEarnDiaryTier = (
  tierId: string,
  completedTaskIds: readonly string[],
  tasks: readonly Pick<DiaryTask, 'id' | 'tierId'>[],
): boolean => {
  const tierTasks = tasks.filter(task => task.tierId === tierId);
  const done = new Set(completedTaskIds);
  return tierTasks.length > 0 && tierTasks.every(task => done.has(task.id));
};
