import { describe, it, expect } from 'vitest';
import { visibleFeatures, isFeatureVisible, ALL_FEATURE_IDS } from './featureGates';
import type { GateInput } from './featureGates';
import type { UnlockState } from '../types';

function emptyUnlocks(): UnlockState {
  return {
    equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    banks: [], quests: [], diaries: [], cas: [], completedTasks: [],
    collectionLog: {},
  } as UnlockState;
}

const fresh: GateInput = { history: [], unlocks: emptyUnlocks(), fatePoints: 0 };

// Progressive disclosure is retired: every surface is visible from the first
// render, on every run state. These tests pin that un-gated behavior.
describe('featureGates (retired — always open)', () => {
  it('a fresh run sees every feature', () => {
    expect(visibleFeatures(fresh).size).toBe(ALL_FEATURE_IDS.length);
  });

  it('every individual feature id reads as visible', () => {
    for (const id of ALL_FEATURE_IDS) {
      expect(isFeatureVisible(id, fresh), id).toBe(true);
    }
  });
});
