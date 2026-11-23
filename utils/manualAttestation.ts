import type { DiaryTask } from '../data/diaryTasks';
import type { QuestData } from '../data/questData';
import type { UnlockState } from '../types';
import { evaluateQuestEligibility } from './journalStatus';
import { diaryTaskLoggingEligibility, type CompletionAttestation } from './journalCompletion';

export interface ManualAttestationEligibility {
  machineEligible: boolean;
  manualChecks: string[];
}

export const requestManualAttestation = (
  label: string,
  eligibility: ManualAttestationEligibility,
  confirm: (message: string) => boolean,
): CompletionAttestation | null => {
  if (!eligibility.machineEligible || eligibility.manualChecks.length === 0) {
    return {};
  }
  const message = `Confirm ${label}\n\n${eligibility.manualChecks
    .map(check => `- ${check}`)
    .join('\n')}`;
  return confirm(message) ? { manualConfirmed: true } : null;
};

// Completing by hand asks about exactly what the engine checks
// (questCompletionDecision, diaryTaskCompletionDecision): no walking routes,
// so "No route to ..." never hides the confirm box the engine then needs.

/** The confirm box for completing a quest by hand, in both layouts. */
export const requestQuestAttestation = (
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  confirm: (message: string) => boolean,
): CompletionAttestation | null => (
  requestManualAttestation(quest.name, evaluateQuestEligibility(quest, unlocks, gameModeId), confirm)
);

/** The confirm box for logging a Diary task by hand, in both layouts. */
export const requestDiaryTaskAttestation = (
  task: DiaryTask,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  confirm: (message: string) => boolean,
): CompletionAttestation | null => (
  requestManualAttestation(task.description, diaryTaskLoggingEligibility(task, unlocks, gameModeId), confirm)
);
