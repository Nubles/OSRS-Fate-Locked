import { describe, expect, it } from 'vitest';
import { questStrategyFor, questWalkthroughFor } from '../../data/questWalkthroughs.public';
import type { UnlockState } from '../../types';
import { analyzeQuest, type QuestRouteAnalysisSnapshot } from '../questRoutes/analyzeQuest';
import { materializeRuneProofAccount } from '../questRoutes/goalPlannerRuneProof';
import { buildRuneProofCoachModel } from './coach';
import { guideNeeds } from './guideNeeds';

const questId = 'Sheep Shearer';
const spinId = 'sheep-shearer:spin-wool';
const preparationIds = ['sheep-shearer:start-with-fred', 'sheep-shearer:shear-wool'];

const account = (craftingTier: number): UnlockState => ({
  equipment: {}, skills: { Crafting: craftingTier }, levels: { Crafting: 99 },
  regions: [], chunks: [], quests: [], guilds: [], merchants: [], minigames: [],
  mobility: [], slayerUnlocks: [], arcana: [], housing: [], bosses: [], storage: [],
  farming: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

const modelFor = (craftingTier: number, confirmedItems: string[] = [], confirmedActions: string[] = preparationIds) => {
  const snapshot: QuestRouteAnalysisSnapshot = {
    ...materializeRuneProofAccount(account(craftingTier), 'vanilla'),
    chunkDataVersion: 1,
    itemSourceRecords: [], recipes: [], entityLocations: [], stationRequirements: [],
    sourceCoverage: [{ itemKey: 'ball of wool', direct: 'COMPLETE', transformation: 'COMPLETE' }],
    connectGraph: {},
  };
  const analysis = analyzeQuest(questId, snapshot, questWalkthroughFor(questId)!);
  return {
    analysis,
    model: buildRuneProofCoachModel({
      strategy: questStrategyFor(questId)!, analysis, account: snapshot,
      confirmedActionIds: new Set(confirmedActions),
      confirmedItemKeys: new Set(confirmedItems), completedQuestIds: new Set(),
    }),
  };
};

describe('Sheep Shearer spinning permission in the Vanilla guide', () => {
  it('blocks the actual spinning action with Crafting locked despite a recorded level of 99', () => {
    const { analysis, model } = modelFor(0);
    expect(analysis.walkthrough.actions.find(action => action.definition.id === spinId)?.blockers)
      .toContainEqual(expect.objectContaining({ kind: 'GATE', gate: expect.objectContaining({ type: 'SKILL', skill: 'Crafting', level: 1 }) }));
    expect(model.actions.find(action => action.id === spinId))
      .toMatchObject({ state: 'BLOCKED', confirmationAllowed: false,
        ownedItemConfirmation: { itemKey: 'ball of wool', label: '20 × Ball of wool' },
      });
    expect(guideNeeds(model)).toContainEqual(expect.objectContaining({
      id: 'skill:Crafting:1', visual: { type: 'SKILL', skill: 'Crafting' }, actionIds: [spinId],
    }));
  });

  it('allows the same spinning action after Crafting T1 is unlocked', () => {
    const { model } = modelFor(1);
    expect(model.nextAction).toMatchObject({ id: spinId, state: 'DO_NOW', confirmationAllowed: true });
    expect(guideNeeds(model).some(need => need.id === 'skill:Crafting:1')).toBe(false);
  });

  it('skips the preparation actions when the player confirms already obtained balls of wool', () => {
    const { analysis, model } = modelFor(0, ['ball of wool'], []);
    expect(analysis.items.find(item => item.requirement.item.key === 'ball of wool')?.state).toBe('NO_CURRENT_SOURCE');
    for (const id of [...preparationIds, spinId]) {
      expect(model.actions.find(action => action.id === id)?.state).toBe('COMPLETED');
    }
    expect(model.nextAction).toMatchObject({ id: 'sheep-shearer:return-to-fred', confirmationAllowed: true });
    expect(model.actions.find(action => action.id === 'sheep-shearer:complete')?.state).not.toBe('COMPLETED');
    expect(model.actions.find(action => action.id === spinId)?.ownedItemConfirmation).toBeUndefined();
    expect(guideNeeds(model).some(need => need.id === 'skill:Crafting:1')).toBe(false);
  });
});
