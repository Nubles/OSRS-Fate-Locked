import type { FateEventType } from '../services/fateEventProtocol';

export interface DetectorPolicy {
  detectorId: string;
  maxApprovedVersion: number;
  handling: 'CONFIRMATION' | 'EXACT';
  eventTypes: FateEventType[];
}

// The detectors RuneLite ships since Stage 4. contracts/detected-events pins
// what each one emits. Retired ids are gone, so an event from one waits for
// the player's review instead of rolling.
export const DETECTOR_POLICIES: DetectorPolicy[] = [
  // One event per level gained, from real levels (version 2).
  { detectorId: 'skill-level-v1', maxApprovedVersion: 2, handling: 'EXACT', eventTypes: ['SKILL_LEVEL'] },
  // The game's own quest states, named by the app's quest ids.
  { detectorId: 'quest-state-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['QUEST'] },
  // The game's completion line or popup, by task name (version 2 adds the popup).
  { detectorId: 'combat-achievement-chat-v1', maxApprovedVersion: 2, handling: 'EXACT', eventTypes: ['COMBAT_ACHIEVEMENT'] },
  // The new-item line or popup, without colour tags (version 2).
  { detectorId: 'collection-log-chat-v1', maxApprovedVersion: 2, handling: 'EXACT', eventTypes: ['COLLECTION_LOG'] },
  // "You have completed 12 hard Treasure Trails.", by tier.
  { detectorId: 'clue-completion-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['CLUE_CASKET'] },
  // The game's kill-count line, through the bundle's boss table.
  { detectorId: 'boss-kill-count-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['BOSS_KILL', 'RAID_COMPLETION'] },
  // The game's Slayer variables; the player confirms the master's tier.
  { detectorId: 'slayer-task-varp-v1', maxApprovedVersion: 1, handling: 'CONFIRMATION', eventTypes: ['SLAYER_TASK'] },
  // A diary tier's varbit; the player picks the task (version 2 remembers per character).
  { detectorId: 'diary-task-v1', maxApprovedVersion: 2, handling: 'CONFIRMATION', eventTypes: ['DIARY_TASK'] },
  // Unchanged while the owner's poll on pet rewards runs; RuneLite doesn't copy pets yet.
  { detectorId: 'pet-drop-v1', maxApprovedVersion: 1, handling: 'CONFIRMATION', eventTypes: ['PET_DROP'] },
];

const BY_ID = new Map(DETECTOR_POLICIES.map((policy) => [policy.detectorId, policy]));

export const policyFor = (detectorId: string): DetectorPolicy | null =>
  BY_ID.get(detectorId) ?? null;
