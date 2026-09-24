import { beforeEach, describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import type { UnlockState } from '../../types';
import {
  analyzeQuest,
  analyzeQuestPreparation,
  clearQuestRouteAnalysisCache,
  type QuestRouteAnalysisSnapshot,
} from './analyzeQuest';
import {
  canonicalRuneProofAccountIdentity,
  materializeRuneProofAccount,
} from './goalPlannerRuneProof';
import { remainingQuestRouteAnalysis } from './confirmedItems';

const account = (equipment: Record<string, number> = {}): UnlockState => ({
  equipment, skills: {}, levels: {}, regions: ['Lumbridge'], chunks: [],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [],
  storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [],
  cas: [], completedTasks: [], collectionLog: {},
});

const snapshot = (unlocks = account()): QuestRouteAnalysisSnapshot => ({
  ...materializeRuneProofAccount(unlocks, 'chunked'),
  chunkDataVersion: 1,
  itemSourceRecords: [], recipes: [], entityLocations: [], stationRequirements: [],
  sourceCoverage: [], connectGraph: {},
});

// Isolate mandatory equipment from map evidence; the independent walkthrough tests
// cover the full reviewed route and its location blockers.
const ghostWalkthrough = {
  ...questWalkthroughFor('The Restless Ghost')!,
  actions: [],
};

describe('RuneProof mandatory equipment readiness', () => {
  beforeEach(clearQuestRouteAnalysisCache);

  it('captures equipment independently of the mutable player account', () => {
    const live = account({ Neck: 1 });
    const materialized = materializeRuneProofAccount(live, 'chunked');
    live.equipment.Neck = 2;
    expect(materialized.unlocks.equipment).toEqual({ Neck: 1 });
  });

  it('refreshes request identity on tier changes, with stable equipment ordering', () => {
    const identity = (equipment: Record<string, number>) => (
      canonicalRuneProofAccountIdentity(materializeRuneProofAccount(account(equipment), 'chunked'))
    );
    expect(identity({ Neck: 1 })).not.toEqual(identity({}));
    expect(identity({ Neck: 2 })).not.toEqual(identity({ Neck: 1 }));
    expect(identity({ Neck: 1, Head: 2 })).toEqual(identity({ Head: 2, Neck: 1 }));
  });

  it('blocks the quest for Neck tier 1 while leaving item preparation accurate', () => {
    const state = snapshot();
    const quest = analyzeQuest('The Restless Ghost', state, ghostWalkthrough);
    expect(quest.walkthrough.status).toBe('READY');
    expect(quest.status).toBe('CANNOT_COMPLETE_YET');
    expect(quest.equipmentBlockers).toEqual([
      expect.objectContaining({ kind: 'equipment', slot: 'Neck', tier: 1, label: expect.stringMatching(/ghostspeak/i) }),
    ]);
    expect(analyzeQuestPreparation('The Restless Ghost', state).status).toBe('READY_NOW');
    expect(remainingQuestRouteAnalysis(quest, new Set()).status).toBe('CANNOT_COMPLETE_YET');
  });

  it('clears only the equipment blocker and invalidates cached analysis on unlock', () => {
    const locked = analyzeQuest('The Restless Ghost', snapshot(), ghostWalkthrough);
    const unlocked = analyzeQuest('The Restless Ghost', snapshot(account({ Neck: 1 })), ghostWalkthrough);
    expect(unlocked).not.toBe(locked);
    expect(unlocked.generatedFrom.accountFingerprint).not.toBe(locked.generatedFrom.accountFingerprint);
    expect(unlocked.equipmentBlockers).toEqual([]);
    expect(unlocked.status).toBe('READY_NOW');
    expect(unlocked.items).toEqual(locked.items);
    expect(unlocked.walkthrough).toEqual(locked.walkthrough);
  });

  it('does not manufacture a new equipment blocker for an already completed quest', () => {
    const completed = account();
    completed.quests = ['The Restless Ghost'];
    const result = analyzeQuest('The Restless Ghost', snapshot(completed), ghostWalkthrough);
    expect(result.equipmentBlockers).toEqual([]);
    expect(result.status).toBe('READY_NOW');
  });
});
