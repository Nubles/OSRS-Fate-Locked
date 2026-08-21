import { describe, expect, it } from 'vitest';
import type { QuestPreparationRouteAnalysis } from '../utils/questRoutes/analyzeQuest';
import { buildRuneProofCoachModel } from '../utils/questStrategies/coach';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import { questStrategyFor } from './questWalkthroughs.preview-boundary';

const strategyFor = (questId: string): QuestStrategyDefinition => {
  const strategy = questStrategyFor(questId);
  if (!strategy) throw new Error(`Missing Wave 1 strategy: ${questId}`);
  return strategy;
};

const actionSummary = (questId: string): [string, string, string][] =>
  strategyFor(questId).actions.map(action => [
    action.id,
    action.mapChunks[0],
    action.displayText,
  ]);

const emptyAnalysisFor = (
  strategy: QuestStrategyDefinition,
): QuestPreparationRouteAnalysis => ({
  questId: strategy.questId,
  status: 'READY_NOW',
  items: [],
  generatedFrom: {
    chunkDataVersion: 1,
    questRevision: strategy.source.wikiRevision,
    accountFingerprint: 'wave-1-sheep-shearer',
  },
});

describe('Wave 1 Sheep Shearer RuneProof pack', () => {
  it('keeps the exact five-action reviewed Sheep Shearer journey', () => {
    const strategy = strategyFor('Sheep Shearer');

    expect(strategy.actions.map(action => ({
      id: action.id,
      chunk: action.mapChunks[0],
      instruction: action.displayText,
    }))).toEqual([
      { id: 'sheep-shearer:start-with-fred', chunk: '49,51', instruction: 'Talk to Fred the Farmer north of Lumbridge and ask for a quest.' },
      { id: 'sheep-shearer:shear-wool', chunk: '49,51', instruction: "Use Fred's shears to collect 20 wool from the sheep in his pen." },
      { id: 'sheep-shearer:spin-wool', chunk: '50,50', instruction: 'Spin the 20 wool into 20 balls of wool upstairs in Lumbridge Castle.' },
      { id: 'sheep-shearer:return-to-fred', chunk: '49,51', instruction: 'Return to Fred the Farmer with 20 unnoted balls of wool.' },
      { id: 'sheep-shearer:complete', chunk: '49,51', instruction: 'Sheep Shearer complete.' },
    ]);
    expect(actionSummary('Sheep Shearer')).toEqual([
      ['sheep-shearer:start-with-fred', '49,51', 'Talk to Fred the Farmer north of Lumbridge and ask for a quest.'],
      ['sheep-shearer:shear-wool', '49,51', "Use Fred's shears to collect 20 wool from the sheep in his pen."],
      ['sheep-shearer:spin-wool', '50,50', 'Spin the 20 wool into 20 balls of wool upstairs in Lumbridge Castle.'],
      ['sheep-shearer:return-to-fred', '49,51', 'Return to Fred the Farmer with 20 unnoted balls of wool.'],
      ['sheep-shearer:complete', '49,51', 'Sheep Shearer complete.'],
    ]);
    expect(strategy.actions.map(action => action.sourceOrder)).toEqual([1, 2, 3, 4, 5]);
    expect(strategy.actions.map(action => action.dependsOn)).toEqual([
      [],
      ['sheep-shearer:start-with-fred'],
      ['sheep-shearer:shear-wool'],
      ['sheep-shearer:spin-wool', 'sheep-shearer:start-with-fred'],
      ['sheep-shearer:return-to-fred'],
    ]);
    expect(buildRuneProofCoachModel({
      strategy,
      analysis: emptyAnalysisFor(strategy),
      confirmedActionIds: new Set(),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
    }).progress).toEqual({ completed: 0, total: 5 });
  });

  it('preserves all source lines and the exact Sheep item, method, and completion contract', () => {
    const strategy = strategyFor('Sheep Shearer');

    expect(Object.fromEntries(strategy.actions.map(action => [action.id, action.rawWikiLineIds]))).toEqual({
      'sheep-shearer:start-with-fred': ['sheep-shearer-if-you-dont-have-the-balls-of-wool-3'],
      'sheep-shearer:shear-wool': [
        'sheep-shearer-if-you-dont-have-the-balls-of-wool-4',
        'sheep-shearer-if-you-dont-have-the-balls-of-wool-5',
        'sheep-shearer-if-you-dont-have-the-balls-of-wool-6',
      ],
      'sheep-shearer:spin-wool': [
        'sheep-shearer-if-you-dont-have-the-balls-of-wool-7',
        'sheep-shearer-if-you-dont-have-the-balls-of-wool-8',
      ],
      'sheep-shearer:return-to-fred': [
        'sheep-shearer-if-you-already-have-the-20-unnoted-balls-of-wool-1',
        'sheep-shearer-if-you-dont-have-the-balls-of-wool-9',
        'sheep-shearer-if-you-dont-have-the-balls-of-wool-10',
      ],
      'sheep-shearer:complete': [
        'sheep-shearer-if-you-already-have-the-20-unnoted-balls-of-wool-2',
        'sheep-shearer-if-you-dont-have-the-balls-of-wool-11',
      ],
    });
    expect(strategy.actions.flatMap(action => action.rawWikiLineIds).sort())
      .toEqual(strategy.sourceLines.map(line => line.id).sort());
    expect(strategy.actions.map(action => ({
      id: action.id,
      items: action.items,
      consumes: action.coach.consumes,
      fulfils: action.coach.fulfils,
      preferredMethod: action.coach.preferredMethod,
      completion: action.coach.completion,
      fallbackPolicy: action.coach.fallbackPolicy,
    }))).toEqual([
      {
        id: 'sheep-shearer:start-with-fred',
        items: [],
        consumes: [],
        fulfils: [{
          item: { key: 'shears', name: 'Shears' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        preferredMethod: undefined,
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'sheep-shearer:shear-wool',
        items: [{
          item: { key: 'shears', name: 'Shears' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        consumes: [],
        fulfils: [{
          item: { key: 'wool', name: 'Wool' },
          quantity: 20,
          supplyPolicy: 'PLAYER_OBTAINED',
        }],
        preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'shear-sheep' },
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'sheep-shearer:spin-wool',
        items: [],
        consumes: [{
          item: { key: 'wool', name: 'Wool' },
          quantity: 20,
          supplyPolicy: 'PLAYER_OBTAINED',
        }],
        fulfils: [{
          item: { key: 'ball of wool', name: 'Ball of wool' },
          quantity: 20,
          supplyPolicy: 'PLAYER_OBTAINED',
        }],
        preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'spin-wool' },
        completion: { kind: 'ITEM_CONFIRMED', itemKey: 'ball of wool' },
        fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES',
      },
      {
        id: 'sheep-shearer:return-to-fred',
        items: [],
        consumes: [{
          item: { key: 'ball of wool', name: 'Ball of wool' },
          quantity: 20,
          supplyPolicy: 'PLAYER_OBTAINED',
        }],
        fulfils: [],
        preferredMethod: undefined,
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'sheep-shearer:complete',
        items: [],
        consumes: [],
        fulfils: [],
        preferredMethod: undefined,
        completion: { kind: 'QUEST_COMPLETED', questId: 'Sheep Shearer' },
        fallbackPolicy: 'NONE',
      },
    ]);
    expect(strategy.actions.filter(action => action.coach.completion.kind === 'QUEST_COMPLETED')
      .map(action => action.id)).toEqual(['sheep-shearer:complete']);
  });
});
