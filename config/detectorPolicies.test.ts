import { describe, expect, it } from 'vitest';
import { policyFor } from './detectorPolicies';

describe('detector policies', () => {
  it.each([
    'slayer-task-v1',
    'diary-task-v1',
    'pet-drop-v1',
    'minigame-completion-v1',
    'boss-kill-v2',
  ])('%s starts confirmation-only', (detectorId) => {
    expect(policyFor(detectorId)?.handling).toBe('CONFIRMATION');
  });

  it('fails closed for unknown detectors', () => {
    expect(policyFor('future-detector')).toBeNull();
  });
});
