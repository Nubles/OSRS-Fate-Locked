import { describe, expect, it, vi } from 'vitest';
import { requestManualAttestation } from './manualAttestation';

describe('requestManualAttestation', () => {
  it('returns an attestation only after the player confirms', () => {
    const confirm = vi.fn(() => true);
    expect(requestManualAttestation(
      'Varrock Hard task',
      { machineEligible: true, manualChecks: ['153 Varrock Museum Kudos'] },
      confirm,
    )).toEqual({ manualConfirmed: true });
    expect(confirm).toHaveBeenCalledWith(
      'Confirm Varrock Hard task\n\n- 153 Varrock Museum Kudos',
    );
  });

  it('cancels completion when the player declines', () => {
    expect(requestManualAttestation(
      'Prying Times',
      { machineEligible: true, manualChecks: ['One open Sailing task slot'] },
      () => false,
    )).toBeNull();
  });

  it('does not prompt when there is a machine blocker', () => {
    const confirm = vi.fn(() => true);
    expect(requestManualAttestation(
      'Blocked task',
      { machineEligible: false, manualChecks: ['Manual check'] },
      confirm,
    )).toEqual({});
    expect(confirm).not.toHaveBeenCalled();
  });
});
