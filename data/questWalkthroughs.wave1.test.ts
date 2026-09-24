import { describe, expect, it } from 'vitest';
import type { QuestPreparationRouteAnalysis } from '../utils/questRoutes/analyzeQuest';
import { buildRuneProofCoachModel } from '../utils/questStrategies/coach';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import { questStrategyFor } from './questWalkthroughs.preview-boundary';
import { questWalkthroughFor as importedWalkthroughFor } from './questWalkthroughs';

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
      { id: 'sheep-shearer:start-with-fred', chunk: '49,51', instruction: 'Ask Fred the Farmer, north of Lumbridge, for work.' },
      { id: 'sheep-shearer:shear-wool', chunk: '49,51', instruction: "Use Fred's shears on nearby sheep until you have 20 wool." },
      { id: 'sheep-shearer:spin-wool', chunk: '50,50', instruction: 'Spin the 20 wool into 20 balls of wool upstairs in Lumbridge Castle.' },
      { id: 'sheep-shearer:return-to-fred', chunk: '49,51', instruction: 'Take 20 unnoted balls of wool back to Fred.' },
      { id: 'sheep-shearer:complete', chunk: '49,51', instruction: 'Sheep Shearer is complete.' },
    ]);
    expect(actionSummary('Sheep Shearer')).toEqual([
      ['sheep-shearer:start-with-fred', '49,51', 'Ask Fred the Farmer, north of Lumbridge, for work.'],
      ['sheep-shearer:shear-wool', '49,51', "Use Fred's shears on nearby sheep until you have 20 wool."],
      ['sheep-shearer:spin-wool', '50,50', 'Spin the 20 wool into 20 balls of wool upstairs in Lumbridge Castle.'],
      ['sheep-shearer:return-to-fred', '49,51', 'Take 20 unnoted balls of wool back to Fred.'],
      ['sheep-shearer:complete', '49,51', 'Sheep Shearer is complete.'],
    ]);
    expect(strategy.actions.map(action => action.sourceOrder)).toEqual([1, 2, 3, 4, 5]);
    expect(strategy.actions.map(action => action.dependsOn)).toEqual([
      [],
      ['sheep-shearer:start-with-fred'],
      ['sheep-shearer:shear-wool'],
      ['sheep-shearer:spin-wool'],
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

  it('preserves imported source coverage and the public Sheep item, method, and completion contract', () => {
    const strategy = strategyFor('Sheep Shearer');

    const imported = importedWalkthroughFor(strategy.questId)!;
    expect(imported.sourceLines.length).toBeGreaterThan(0);
    expect(Object.fromEntries(imported.actions.map(action => [action.id, action.rawWikiLineIds]))).toEqual({
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
    expect(imported.actions.flatMap(action => action.rawWikiLineIds).sort())
      .toEqual(imported.sourceLines.map(line => line.id).sort());
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
        items: [{ item: { key: 'ball of wool', name: 'Ball of wool' }, quantity: 20, supplyPolicy: 'PLAYER_OBTAINED' }],
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
      ['the-restless-ghost:start-with-aereck', '50,50', 'Talk to Father Aereck in Lumbridge church to begin.'],
      ['the-restless-ghost:get-amulet', '49,49', 'Visit Father Urhney in western Lumbridge Swamp and take the ghostspeak amulet.'],
      ['the-restless-ghost:talk-to-ghost', '50,49', 'Wear the ghostspeak amulet and speak to the ghost in Lumbridge graveyard.'],
      ['the-restless-ghost:take-skull', '48,49', "Search the altar in the Wizards' Tower basement for the ghost's skull, then leave without fighting the skeleton."],
      ['the-restless-ghost:return-to-ghost', '50,49', 'Return to the restless ghost in Lumbridge graveyard with the skull.'],
      ['the-restless-ghost:use-skull', '50,49', "Use the skull on the graveyard coffin."],
      ['the-restless-ghost:complete', '50,49', 'The Restless Ghost is complete.'],
    ]);
  });

  it('preserves imported source coverage and the public action dependencies, chunks, and quest-provided flow', () => {
    const strategy = strategyFor('The Restless Ghost');

    expect(strategy.source).toMatchObject({
      wikiRevision: '15070492',
      wikiUrl: 'https://oldschool.runescape.wiki/w/The_Restless_Ghost/Quick_guide?oldid=15070492',
    });
    const imported = importedWalkthroughFor(strategy.questId)!;
    expect(imported.sourceLines.length).toBeGreaterThan(0);
    expect(Object.fromEntries(imported.actions.map(action => [action.id, action.rawWikiLineIds]))).toEqual({
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
    expect(imported.actions.flatMap(action => action.rawWikiLineIds).sort())
      .toEqual(imported.sourceLines.map(line => line.id).sort());
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
        task: undefined,
        dependsOn: [],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['50,50'] },
      },
      {
        id: 'the-restless-ghost:get-amulet',
        sourceOrder: 2,
        task: undefined,
        dependsOn: ['the-restless-ghost:start-with-aereck'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['49,49'] },
      },
      {
        id: 'the-restless-ghost:talk-to-ghost',
        sourceOrder: 3,
        task: undefined,
        dependsOn: ['the-restless-ghost:get-amulet'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['50,49'] },
      },
      {
        id: 'the-restless-ghost:take-skull',
        sourceOrder: 4,
        task: undefined,
        dependsOn: ['the-restless-ghost:talk-to-ghost'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['48,49'] },
      },
      {
        id: 'the-restless-ghost:return-to-ghost',
        sourceOrder: 5,
        task: undefined,
        dependsOn: ['the-restless-ghost:take-skull'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['50,49'] },
      },
      {
        id: 'the-restless-ghost:use-skull',
        sourceOrder: 6,
        task: undefined,
        dependsOn: ['the-restless-ghost:return-to-ghost'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['50,49'] },
      },
      {
        id: 'the-restless-ghost:complete',
        sourceOrder: 7,
        task: undefined,
        dependsOn: ['the-restless-ghost:use-skull'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['50,49'] },
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
        items: [{ item: { key: "ghost's skull", name: "Ghost's skull" }, quantity: 1, supplyPolicy: 'QUEST_PROVIDED' }],
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
      ['rune-mysteries:start-with-duke', '50,50', 'Ask Duke Horacio in Lumbridge Castle about a quest and take the air talisman.'],
      ['rune-mysteries:take-talisman-to-sedridor', '48,49', "Give the air talisman to Archmage Sedridor in the Wizards' Tower basement."],
      ['rune-mysteries:take-package-to-aubury', '50,53', "Deliver Sedridor's research package to Aubury in Varrock."],
      ['rune-mysteries:return-notes-to-sedridor', '48,49', "Bring Aubury's research notes back to Sedridor."],
      ['rune-mysteries:complete', '48,49', 'Rune Mysteries is complete.'],
    ]);
  });

  it('preserves imported source coverage and the public action dependencies, chunks, and quest-provided hand-off', () => {
    const strategy = strategyFor('Rune Mysteries');

    expect(strategy.source).toMatchObject({
      wikiRevision: '15205463',
      wikiUrl: 'https://oldschool.runescape.wiki/w/Rune_Mysteries/Quick_guide?oldid=15205463',
    });
    const imported = importedWalkthroughFor(strategy.questId)!;
    expect(imported.sourceLines.length).toBeGreaterThan(0);
    expect(Object.fromEntries(imported.actions.map(action => [action.id, action.rawWikiLineIds]))).toEqual({
      'rune-mysteries:start-with-duke': ['rune-mysteries-walkthrough-1'],
      'rune-mysteries:take-talisman-to-sedridor': ['rune-mysteries-walkthrough-2'],
      'rune-mysteries:take-package-to-aubury': ['rune-mysteries-walkthrough-3'],
      'rune-mysteries:return-notes-to-sedridor': ['rune-mysteries-walkthrough-4'],
      'rune-mysteries:complete': ['rune-mysteries-walkthrough-5'],
    });
    expect(imported.actions.flatMap(action => action.rawWikiLineIds).sort())
      .toEqual(imported.sourceLines.map(line => line.id).sort());
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
        task: undefined,
        dependsOn: [],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['50,50'] },
      },
      {
        id: 'rune-mysteries:take-talisman-to-sedridor',
        sourceOrder: 2,
        task: undefined,
        dependsOn: ['rune-mysteries:start-with-duke'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['48,49'] },
      },
      {
        id: 'rune-mysteries:take-package-to-aubury',
        sourceOrder: 3,
        task: undefined,
        dependsOn: ['rune-mysteries:take-talisman-to-sedridor'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['50,53'] },
      },
      {
        id: 'rune-mysteries:return-notes-to-sedridor',
        sourceOrder: 4,
        task: undefined,
        dependsOn: ['rune-mysteries:take-package-to-aubury'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['48,49'] },
      },
      {
        id: 'rune-mysteries:complete',
        sourceOrder: 5,
        task: undefined,
        dependsOn: ['rune-mysteries:return-notes-to-sedridor'],
        location: { kind: 'EXPLICIT_CHUNKS', chunks: ['48,49'] },
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
        items: [{ item: { key: 'air talisman', name: 'Air talisman' }, quantity: 1, supplyPolicy: 'QUEST_PROVIDED' }],
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
        items: [{ item: { key: 'research package', name: 'Research package' }, quantity: 1, supplyPolicy: 'QUEST_PROVIDED' }],
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
        items: [{ item: { key: 'research notes', name: 'Research notes' }, quantity: 1, supplyPolicy: 'QUEST_PROVIDED' }],
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

describe('Wave 1 Imp Catcher RuneProof pack', () => {
  it('keeps the exact six-action reviewed Imp Catcher journey', () => {
    expect(actionSummary('Imp Catcher')).toEqual([
      ['imp-catcher:get-black-bead', '48,50', 'Kill imps around Draynor Village until you receive a black bead.'],
      ['imp-catcher:get-red-bead', '48,50', 'Kill imps around Draynor Village until you receive a red bead.'],
      ['imp-catcher:get-white-bead', '48,50', 'Kill imps around Draynor Village until you receive a white bead.'],
      ['imp-catcher:get-yellow-bead', '48,50', 'Kill imps around Draynor Village until you receive a yellow bead.'],
      ['imp-catcher:give-beads-to-mizgog', '48,49', "Take all four beads to Wizard Mizgog at the Wizards' Tower."],
      ['imp-catcher:complete', '48,49', 'Imp Catcher is complete.'],
    ]);
  });

  it('keeps the independently authored Imp guide free of imported task provenance', () => {
    const strategy = strategyFor('Imp Catcher');

    expect(strategy.actions.map(action => [action.id, action.chunkPickerTaskId])).toEqual([
      ['imp-catcher:get-black-bead', undefined],
      ['imp-catcher:get-red-bead', undefined],
      ['imp-catcher:get-white-bead', undefined],
      ['imp-catcher:get-yellow-bead', undefined],
      ['imp-catcher:give-beads-to-mizgog', undefined],
      ['imp-catcher:complete', undefined],
    ]);
  });

  it('keeps each bead independent before the reviewed Mizgog hand-off', () => {
    const strategy = strategyFor('Imp Catcher');

    expect(strategy.source).toMatchObject({
      wikiRevision: '14649872',
      wikiUrl: 'https://oldschool.runescape.wiki/w/Imp_Catcher/Quick_guide?oldid=14649872',
    });
    expect(strategy.actions.map(action => ({
      id: action.id,
      dependsOn: action.dependsOn,
      consumes: action.coach.consumes,
      fulfils: action.coach.fulfils,
      completion: action.coach.completion,
      preferredMethod: action.coach.preferredMethod,
      fallbackPolicy: action.coach.fallbackPolicy,
    }))).toEqual([
      {
        id: 'imp-catcher:get-black-bead',
        dependsOn: [],
        consumes: [],
        fulfils: [{ item: { key: 'black bead', name: 'Black bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
        completion: { kind: 'ITEM_CONFIRMED', itemKey: 'black bead' },
        preferredMethod: undefined,
        fallbackPolicy: 'INTERCHANGEABLE',
      },
      {
        id: 'imp-catcher:get-red-bead',
        dependsOn: [],
        consumes: [],
        fulfils: [{ item: { key: 'red bead', name: 'Red bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
        completion: { kind: 'ITEM_CONFIRMED', itemKey: 'red bead' },
        preferredMethod: undefined,
        fallbackPolicy: 'INTERCHANGEABLE',
      },
      {
        id: 'imp-catcher:get-white-bead',
        dependsOn: [],
        consumes: [],
        fulfils: [{ item: { key: 'white bead', name: 'White bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
        completion: { kind: 'ITEM_CONFIRMED', itemKey: 'white bead' },
        preferredMethod: undefined,
        fallbackPolicy: 'INTERCHANGEABLE',
      },
      {
        id: 'imp-catcher:get-yellow-bead',
        dependsOn: [],
        consumes: [],
        fulfils: [{ item: { key: 'yellow bead', name: 'Yellow bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
        completion: { kind: 'ITEM_CONFIRMED', itemKey: 'yellow bead' },
        preferredMethod: undefined,
        fallbackPolicy: 'INTERCHANGEABLE',
      },
      {
        id: 'imp-catcher:give-beads-to-mizgog',
        dependsOn: [
          'imp-catcher:get-black-bead',
          'imp-catcher:get-red-bead',
          'imp-catcher:get-white-bead',
          'imp-catcher:get-yellow-bead',
        ],
        consumes: [
          { item: { key: 'black bead', name: 'Black bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
          { item: { key: 'red bead', name: 'Red bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
          { item: { key: 'white bead', name: 'White bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
          { item: { key: 'yellow bead', name: 'Yellow bead' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
        ],
        fulfils: [],
        completion: { kind: 'MANUAL' },
        preferredMethod: undefined,
        fallbackPolicy: 'NONE',
      },
      {
        id: 'imp-catcher:complete',
        dependsOn: ['imp-catcher:give-beads-to-mizgog'],
        consumes: [],
        fulfils: [],
        completion: { kind: 'QUEST_COMPLETED', questId: 'Imp Catcher' },
        preferredMethod: undefined,
        fallbackPolicy: 'NONE',
      },
    ]);
  });
});


describe('Wave 1 public source boundary', () => {
  it.each(['Sheep Shearer', 'The Restless Ghost', 'Rune Mysteries', 'Imp Catcher'])(
    '%s retains independent authorship and pinned Wiki attribution', questId => {
      const strategy = strategyFor(questId);
      expect(strategy.source).toMatchObject({ kind: 'INDEPENDENT_REVIEW', author: 'Fate Locked' });
      expect(strategy.source.wikiUrl).toContain(`oldid=${strategy.source.wikiRevision}`);
      expect(strategy.sourceLines).toEqual([]);
      for (const action of strategy.actions) {
        expect(action.rawWikiLineIds).toEqual([]);
        expect(action.chunkPickerTaskId).toBeUndefined();
      }
    },
  );
});
