import type { FateEventType } from '../services/fateEventProtocol';

export interface DetectorPolicy {
  detectorId: string;
  maxApprovedVersion: number;
  handling: 'CONFIRMATION' | 'EXACT';
  eventTypes: FateEventType[];
}

export const DETECTOR_POLICIES: DetectorPolicy[] = [
  { detectorId: 'skill-level-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['SKILL_LEVEL'] },
  { detectorId: 'quest-widget-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['QUEST'] },
  { detectorId: 'combat-achievement-chat-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['COMBAT_ACHIEVEMENT'] },
  { detectorId: 'collection-log-chat-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['COLLECTION_LOG'] },
  { detectorId: 'clue-casket-loot-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['CLUE_CASKET'] },
  { detectorId: 'boss-loot-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['BOSS_KILL'] },
  { detectorId: 'raid-loot-v1', maxApprovedVersion: 1, handling: 'EXACT', eventTypes: ['RAID_COMPLETION'] },
  { detectorId: 'slayer-task-v1', maxApprovedVersion: 1, handling: 'CONFIRMATION', eventTypes: ['SLAYER_TASK'] },
  { detectorId: 'diary-task-v1', maxApprovedVersion: 1, handling: 'CONFIRMATION', eventTypes: ['DIARY_TASK'] },
  { detectorId: 'pet-drop-v1', maxApprovedVersion: 1, handling: 'CONFIRMATION', eventTypes: ['PET_DROP'] },
  { detectorId: 'minigame-completion-v1', maxApprovedVersion: 1, handling: 'CONFIRMATION', eventTypes: ['MINIGAME_COMPLETION'] },
  { detectorId: 'boss-kill-v2', maxApprovedVersion: 2, handling: 'CONFIRMATION', eventTypes: ['BOSS_KILL'] },
];

const BY_ID = new Map(DETECTOR_POLICIES.map((policy) => [policy.detectorId, policy]));

export const policyFor = (detectorId: string): DetectorPolicy | null =>
  BY_ID.get(detectorId) ?? null;