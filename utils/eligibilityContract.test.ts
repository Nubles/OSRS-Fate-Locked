import { expect, it } from 'vitest';
import type { QuestEligibility, DiaryTierEligibility, ManualEligibility } from './journalStatus';

it('keeps status and compatibility flags constrained by the type contract', () => {
  const ready: QuestEligibility = { status: 'AVAILABLE', eligible: true, machineEligible: true, confirmable: true, manualChecks: [], blockers: [], evidence: [] };
  const pending: QuestEligibility = { status: 'NEEDS_CONFIRMATION', eligible: false, machineEligible: true, confirmable: true, manualChecks: ['Inventory'], blockers: [], evidence: [] };
  expect(ready.eligible).toBe(true);
  expect(pending.eligible).toBe(false);
  // These are compile-time regression cases: tsc must reject contradictory states.
  // @ts-expect-error AVAILABLE cannot be ineligible.
  const contradictoryQuest: QuestEligibility = { ...ready, eligible: false };
  // @ts-expect-error UNKNOWN cannot be eligible.
  const contradictoryDiary: DiaryTierEligibility = { status: 'UNKNOWN', eligible: true, blockers: [], evidence: [], manualChecks: [], unverifiedTaskIds: [] };
  // @ts-expect-error A machine-blocked result cannot be manually approved.
  const contradictoryManual: ManualEligibility = { eligible: false, machineEligible: false, confirmable: true, manualChecks: [] };
  void [contradictoryQuest, contradictoryDiary, contradictoryManual];
});
