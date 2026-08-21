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

describe('Wave 1 The Restless Ghost RuneProof pack', () => {
  it('keeps the exact seven-action reviewed Restless Ghost journey', () => {
    expect(actionSummary('The Restless Ghost')).toEqual([
      ['the-restless-ghost:start-with-aereck', '50,50', 'Talk to Father Aereck in Lumbridge church to start the quest.'],
      ['the-restless-ghost:get-amulet', '49,49', 'Talk to Father Urhney in the western Lumbridge Swamp and take the ghostspeak amulet.'],
      ['the-restless-ghost:talk-to-ghost', '50,49', 'Equip the ghostspeak amulet and talk to the ghost in Lumbridge graveyard.'],
      ['the-restless-ghost:take-skull', '48,49', "Search the altar in the Wizards' Tower basement for the ghost's skull, then leave without fighting the skeleton."],
      ['the-restless-ghost:return-to-ghost', '50,49', 'Return to the restless ghost with its skull.'],
      ['the-restless-ghost:use-skull', '50,49', "Use the ghost's skull on the coffin in Lumbridge graveyard."],
      ['the-restless-ghost:complete', '50,49', 'The Restless Ghost complete.'],
    ]);
  });

  it('preserves the selected source coverage, task edges, aliases, and quest-provided flow', () => {
    const strategy = strategyFor('The Restless Ghost');

    expect(strategy.source).toMatchObject({
      wikiRevision: '15070492',
      wikiUrl: 'https://oldschool.runescape.wiki/w/The_Restless_Ghost/Quick_guide?oldid=15070492',
    });
    expect(Object.fromEntries(strategy.actions.map(action => [action.id, action.rawWikiLineIds]))).toEqual({
      'the-restless-ghost:start-with-aereck': [],
      'the-restless-ghost:get-amulet': ['the-restless-ghost-getting-started-1'],
      'the-restless-ghost:talk-to-ghost': [
        'the-restless-ghost-ghostspeak-amulet-2',
        'the-restless-ghost-ghostspeak-amulet-3',
      ],
      'the-restless-ghost:take-skull': ['the-restless-ghost-the-skull-4'],
      'the-restless-ghost:return-to-ghost': [],
      'the-restless-ghost:use-skull': ['the-restless-ghost-the-skull-5'],
      'the-restless-ghost:complete': ['the-restless-ghost-the-skull-6'],
    });
    expect(strategy.actions.flatMap(action => action.rawWikiLineIds).sort())
      .toEqual(strategy.sourceLines.map(line => line.id).sort());
    expect(strategy.actions.map(action => ({
      id: action.id,
      sourceOrder: action.sourceOrder,
      task: action.chunkPickerTaskId,
      dependsOn: action.dependsOn,
      location: action.location.kind === 'REVIEWED_ALIAS'
        ? { alias: action.location.alias, chunks: action.location.chunks }
        : action.location,
    }))).toEqual([
      {
        id: 'the-restless-ghost:start-with-aereck',
        sourceOrder: 1,
        task: 't_7683',
        dependsOn: [],
        location: { alias: 'Lumbridge church', chunks: ['50,50'] },
      },
      {
        id: 'the-restless-ghost:get-amulet',
        sourceOrder: 2,
        task: 't_7684',
        dependsOn: ['the-restless-ghost:start-with-aereck'],
        location: { alias: "Father Urhney's house", chunks: ['49,49'] },
      },
      {
        id: 'the-restless-ghost:talk-to-ghost',
        sourceOrder: 3,
        task: 't_7685',
        dependsOn: ['the-restless-ghost:get-amulet'],
        location: { alias: 'Lumbridge graveyard', chunks: ['50,49'] },
      },
      {
        id: 'the-restless-ghost:take-skull',
        sourceOrder: 4,
        task: 't_7686',
        dependsOn: ['the-restless-ghost:talk-to-ghost'],
        location: { alias: "Wizards' Tower", chunks: ['48,49'] },
      },
      {
        id: 'the-restless-ghost:return-to-ghost',
        sourceOrder: 5,
        task: undefined,
        dependsOn: ['the-restless-ghost:take-skull'],
        location: { alias: 'Lumbridge graveyard', chunks: ['50,49'] },
      },
      {
        id: 'the-restless-ghost:use-skull',
        sourceOrder: 6,
        task: 't_7687',
        dependsOn: ['the-restless-ghost:return-to-ghost', 'the-restless-ghost:take-skull'],
        location: { alias: 'Lumbridge graveyard', chunks: ['50,49'] },
      },
      {
        id: 'the-restless-ghost:complete',
        sourceOrder: 7,
        task: 't_7688',
        dependsOn: ['the-restless-ghost:use-skull'],
        location: { alias: 'Lumbridge graveyard', chunks: ['50,49'] },
      },
    ]);
    expect(strategy.actions.map(action => ({
      id: action.id,
      items: action.items,
      consumes: action.coach.consumes,
      fulfils: action.coach.fulfils,
      completion: action.coach.completion,
      fallbackPolicy: action.coach.fallbackPolicy,
    }))).toEqual([
      {
        id: 'the-restless-ghost:start-with-aereck',
        items: [], consumes: [], fulfils: [], completion: { kind: 'MANUAL' }, fallbackPolicy: 'NONE',
      },
      {
        id: 'the-restless-ghost:get-amulet',
        items: [],
        consumes: [],
        fulfils: [{
          item: { key: 'ghostspeak amulet', name: 'Ghostspeak amulet' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'the-restless-ghost:talk-to-ghost',
        items: [{
          item: { key: 'ghostspeak amulet', name: 'Ghostspeak amulet' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        consumes: [],
        fulfils: [],
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'the-restless-ghost:take-skull',
        items: [],
        consumes: [],
        fulfils: [{
          item: { key: "ghost's skull", name: "Ghost's skull" },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'the-restless-ghost:return-to-ghost',
        items: [], consumes: [], fulfils: [], completion: { kind: 'MANUAL' }, fallbackPolicy: 'NONE',
      },
      {
        id: 'the-restless-ghost:use-skull',
        items: [],
        consumes: [{
          item: { key: "ghost's skull", name: "Ghost's skull" },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        fulfils: [],
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'the-restless-ghost:complete',
        items: [], consumes: [], fulfils: [],
        completion: { kind: 'QUEST_COMPLETED', questId: 'The Restless Ghost' },
        fallbackPolicy: 'NONE',
      },
    ]);
  });
});

describe('Wave 1 Rune Mysteries RuneProof pack', () => {
  it('keeps the exact five-action reviewed Rune Mysteries journey', () => {
    expect(actionSummary('Rune Mysteries')).toEqual([
      ['rune-mysteries:start-with-duke', '50,50', 'Ask Duke Horacio in Lumbridge Castle for a quest and take the air talisman.'],
      ['rune-mysteries:take-talisman-to-sedridor', '48,49', "Give the air talisman to Archmage Sedridor in the Wizards' Tower basement."],
      ['rune-mysteries:take-package-to-aubury', '50,53', "Take Sedridor's research package to Aubury in the Varrock rune shop."],
      ['rune-mysteries:return-notes-to-sedridor', '48,49', "Return Aubury's research notes to Sedridor in the Wizards' Tower basement."],
      ['rune-mysteries:complete', '48,49', 'Rune Mysteries complete.'],
    ]);
  });

  it('preserves every selected line, direct task edge, reviewed alias, and quest-provided hand-off', () => {
    const strategy = strategyFor('Rune Mysteries');

    expect(strategy.source).toMatchObject({
      wikiRevision: '15205463',
      wikiUrl: 'https://oldschool.runescape.wiki/w/Rune_Mysteries/Quick_guide?oldid=15205463',
    });
    expect(Object.fromEntries(strategy.actions.map(action => [action.id, action.rawWikiLineIds]))).toEqual({
      'rune-mysteries:start-with-duke': ['rune-mysteries-walkthrough-1'],
      'rune-mysteries:take-talisman-to-sedridor': ['rune-mysteries-walkthrough-2'],
      'rune-mysteries:take-package-to-aubury': ['rune-mysteries-walkthrough-3'],
      'rune-mysteries:return-notes-to-sedridor': ['rune-mysteries-walkthrough-4'],
      'rune-mysteries:complete': ['rune-mysteries-walkthrough-5'],
    });
    expect(strategy.actions.flatMap(action => action.rawWikiLineIds).sort())
      .toEqual(strategy.sourceLines.map(line => line.id).sort());
    expect(strategy.actions.map(action => ({
      id: action.id,
      sourceOrder: action.sourceOrder,
      task: action.chunkPickerTaskId,
      dependsOn: action.dependsOn,
      location: action.location.kind === 'REVIEWED_ALIAS'
        ? { alias: action.location.alias, chunks: action.location.chunks }
        : action.location,
    }))).toEqual([
      {
        id: 'rune-mysteries:start-with-duke',
        sourceOrder: 1,
        task: 't_7697',
        dependsOn: [],
        location: { alias: 'Lumbridge Castle', chunks: ['50,50'] },
      },
      {
        id: 'rune-mysteries:take-talisman-to-sedridor',
        sourceOrder: 2,
        task: 't_7698',
        dependsOn: ['rune-mysteries:start-with-duke'],
        location: { alias: "Wizards' Tower basement", chunks: ['48,49'] },
      },
      {
        id: 'rune-mysteries:take-package-to-aubury',
        sourceOrder: 3,
        task: 't_7699',
        dependsOn: ['rune-mysteries:take-talisman-to-sedridor'],
        location: { alias: "Aubury's rune shop", chunks: ['50,53'] },
      },
      {
        id: 'rune-mysteries:return-notes-to-sedridor',
        sourceOrder: 4,
        task: 't_7700',
        dependsOn: ['rune-mysteries:take-package-to-aubury'],
        location: { alias: "Wizards' Tower basement", chunks: ['48,49'] },
      },
      {
        id: 'rune-mysteries:complete',
        sourceOrder: 5,
        task: 't_7701',
        dependsOn: ['rune-mysteries:return-notes-to-sedridor'],
        location: { alias: "Wizards' Tower basement", chunks: ['48,49'] },
      },
    ]);
    expect(strategy.actions.map(action => ({
      id: action.id,
      items: action.items,
      consumes: action.coach.consumes,
      fulfils: action.coach.fulfils,
      completion: action.coach.completion,
      fallbackPolicy: action.coach.fallbackPolicy,
    }))).toEqual([
      {
        id: 'rune-mysteries:start-with-duke',
        items: [],
        consumes: [],
        fulfils: [{
          item: { key: 'air talisman', name: 'Air talisman' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'rune-mysteries:take-talisman-to-sedridor',
        items: [],
        consumes: [{
          item: { key: 'air talisman', name: 'Air talisman' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        fulfils: [{
          item: { key: 'research package', name: 'Research package' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'rune-mysteries:take-package-to-aubury',
        items: [],
        consumes: [{
          item: { key: 'research package', name: 'Research package' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        fulfils: [{
          item: { key: 'research notes', name: 'Research notes' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'rune-mysteries:return-notes-to-sedridor',
        items: [],
        consumes: [{
          item: { key: 'research notes', name: 'Research notes' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
        fulfils: [],
        completion: { kind: 'MANUAL' },
        fallbackPolicy: 'NONE',
      },
      {
        id: 'rune-mysteries:complete',
        items: [],
        consumes: [],
        fulfils: [],
        completion: { kind: 'QUEST_COMPLETED', questId: 'Rune Mysteries' },
        fallbackPolicy: 'NONE',
      },
    ]);
  });
});
