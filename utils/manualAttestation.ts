import type { CompletionAttestation } from './journalCompletion';

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
