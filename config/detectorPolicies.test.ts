import { describe, expect, it } from 'vitest';
import { policyFor } from './detectorPolicies';

describe('detector policies', () => {
  it.each([
    'skill-level-v1',
    'quest-state-v1',
    'combat-achievement-chat-v1',
    'collection-log-chat-v1',
    'clue-completion-v1',
    'boss-kill-count-v1',
  ])('%s rolls without review: the game names what happened', (detectorId) => {
    expect(policyFor(detectorId)?.handling).toBe('EXACT');
  });

  it.each([
    'slayer-task-varp-v1',
    'diary-task-v1',
    'pet-drop-v1',
  ])('%s stays confirmation-only', (detectorId) => {
    expect(policyFor(detectorId)?.handling).toBe('CONFIRMATION');
  });

  it('names bosses and raids from the one kill-count detector', () => {
    expect(policyFor('boss-kill-count-v1')?.eventTypes).toEqual(['BOSS_KILL', 'RAID_COMPLETION']);
  });

  it.each([
    'quest-widget-v1',
    'clue-casket-loot-v1',
    'boss-loot-v1',
    'raid-loot-v1',
    'slayer-task-v1',
    'minigame-completion-v1',
    'boss-kill-v2',
  ])('refuses the retired %s', (detectorId) => {
    expect(policyFor(detectorId)).toBeNull();
  });

  it('fails closed for unknown detectors', () => {
    expect(policyFor('future-detector')).toBeNull();
  });
});
