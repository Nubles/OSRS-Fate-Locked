import { DiaryTask } from '../data/diaryTasks';
import { FARMING_PATCH_LIST, GUILDS_LIST, POH_LIST, SLAYER_UNLOCKS_LIST } from '../data/items';
import { QuestData } from '../data/questData';
import { UnlockState } from '../types';
import type { AreaRoutes } from './areaRoutes';
import {
  evaluateDiaryTaskEligibility,
  evaluateQuestEligibility,
  ManualEligibility,
  type DiaryTaskEligibility,
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

export type CompletionResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface CompletionAttestation {
  manualConfirmed?: boolean;
}

/**
 * Guilds, farming patches, house rooms and Slayer rewards only decide whether
 * the Journal reads a Diary task as ready (owner, 2 October 2026). Logging a
 * task by hand never waits for them, so its checks count them all as unlocked.
 */
export const withStatusOnlyUnlocks = (unlocks: UnlockState): UnlockState => ({
  ...unlocks,
  guilds: [...GUILDS_LIST],
  farming: [...FARMING_PATCH_LIST],
  housing: [...POH_LIST],
  slayerUnlocks: [...SLAYER_UNLOCKS_LIST],
});

/** What logging a Diary task by hand checks: its requirements, less the status-only unlocks. */
export const diaryTaskLoggingEligibility = (
  task: DiaryTask,
  unlocks: UnlockState,
  gameModeId?: string,
  areaRoutes?: AreaRoutes | null,
): DiaryTaskEligibility => evaluateDiaryTaskEligibility(task, withStatusOnlyUnlocks(unlocks), gameModeId, areaRoutes);

const manualDecision = (
  result: Pick<ManualEligibility, 'machineEligible' | 'manualChecks' | 'confirmable'>,
  attestation: CompletionAttestation,
): CompletionResult | null => {
  if (!result.machineEligible) return null;
  if (result.manualChecks.length === 0) return { ok: true };
  return result.confirmable && attestation.manualConfirmed
    ? { ok: true }
    : { ok: false, reason: 'Confirm: ' + result.manualChecks.join(', ') };
};

export const questCompletionDecision = (
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
  attestation: CompletionAttestation = {},
): CompletionResult => {
  const result = evaluateQuestEligibility(quest, unlocks, gameModeId);
  if (result.status === 'COMPLETED') {
    return { ok: false, reason: 'Already completed' };
  }
  if (!result.machineEligible) {
    return {
      ok: false,
      reason: 'Requires: ' + result.blockers.map(blocker => blocker.label).join(', '),
    };
  }
  return manualDecision(result, attestation)!;
};

export const diaryTaskCompletionDecision = (
  task: DiaryTask,
  unlocks: UnlockState,
  gameModeId?: string,
  attestation: CompletionAttestation = {},
): CompletionResult => {
  if (unlocks.completedTasks.includes(task.id)) {
    return { ok: false, reason: 'Already completed' };
  }
  const result = diaryTaskLoggingEligibility(task, unlocks, gameModeId);
  if (!result.machineEligible) {
    return {
      ok: false,
      reason: 'Requires: ' + result.blockers.map(blocker => blocker.label).join(', '),
    };
  }
  return manualDecision(result, attestation)!;
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
