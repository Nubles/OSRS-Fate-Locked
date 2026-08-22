import { describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import { questStrategyFor } from '../../data/questWalkthroughs.preview-boundary';
import type { ConnectGraph } from '../../services/ChunkContentService';
import type { QuestPreparationRouteAnalysis, QuestRouteAnalysis } from '../questRoutes/analyzeQuest';
import type { ChunkKey, ItemRef, ItemRoute, SourceKind } from '../questRoutes/model';
import type {
  EvaluatedWalkthroughAction,
  QuestWalkthroughAnalysis,
  ResolvedWalkthroughLocation,
} from '../questWalkthroughs/model';
import { questStrategyFromWalkthrough, type QuestStrategyDefinition } from './model';
import { buildRuneProofCoachModel } from './coach';

const item = (name: string): ItemRef => ({ key: name.toLocaleLowerCase('en-GB'), name });

const actionChunks: Readonly<Record<string, readonly ChunkKey[]>> = {
  'cooks-assistant:start-quest': ['50,50'],
  'cooks-assistant:take-pot': ['50,50'],
  'cooks-assistant:take-bucket': ['50,50'],
  'cooks-assistant:milk-cow': ['50,51'],
  'cooks-assistant:take-egg': ['50,51'],
  'cooks-assistant:pick-grain': ['49,51'],
  'cooks-assistant:make-flour': ['49,51'],
  'cooks-assistant:return-to-cook': ['50,50'],
  'cooks-assistant:complete': ['50,50'],
  'the-restless-ghost:start-with-aereck': ['50,50'],
  'the-restless-ghost:get-amulet': ['49,49'],
  'the-restless-ghost:talk-to-ghost': ['50,49'],
  'the-restless-ghost:take-skull': ['48,49'],
  'the-restless-ghost:return-to-ghost': ['50,49'],
  'the-restless-ghost:use-skull': ['50,49'],
  'the-restless-ghost:complete': ['50,49'],
  'imp-catcher:get-black-bead': ['47,51'],
  'imp-catcher:get-red-bead': ['47,51'],
  'imp-catcher:get-white-bead': ['47,51'],
  'imp-catcher:get-yellow-bead': ['47,51'],
  'imp-catcher:give-beads-to-mizgog': ['48,49'],
  'imp-catcher:complete': ['48,49'],
};

const route = (
  id: string,
  itemName: string,
  sourceLabel: string,
  sourceKind: SourceKind,
  overrides: Partial<ItemRoute> = {},
): ItemRoute => ({
  id,
  item: item(itemName),
  outputQuantity: 1,
  sourceKind,
  sourceLabel,
  chunks: ['50,50'],
  steps: [],
  blockers: [],
  deterministic: sourceKind !== 'DROP',
  probability: sourceKind === 'DROP' ? 0.25 : undefined,
  recursiveCost: 0,
  consumedIngredientCost: 0,
  skillUnlockCost: 0,
  skillLevelCost: 0,
  travelCost: 0,
  hasDataGap: false,
  ...overrides,
});

const routeAt = (
  id: string,
  itemName: string,
  sourceLabel: string,
  sourceKind: SourceKind,
  chunk: ChunkKey,
  overrides: Partial<ItemRoute> = {},
): ItemRoute => route(id, itemName, sourceLabel, sourceKind, {
  chunks: [chunk],
  steps: [{
    id: `${id}:source`,
    label: sourceLabel,
    chunk,
    gates: [],
    requiresChunkUnlock: false,
    hasDataGap: false,
  }],
  ...overrides,
});

const resolvedLocationFor = (
  action: QuestStrategyDefinition['actions'][number],
): ResolvedWalkthroughLocation => {
  const chunks = actionChunks[action.id];
  if (!chunks) throw new Error(`Missing Cook's Assistant test chunks for ${action.id}.`);

  switch (action.location.kind) {
    case 'REVIEWED_ALIAS':
      return {
        confidence: 'REVIEWED',
        evidenceKind: 'REVIEWED_ALIAS',
        chunks,
        candidateChunks: [],
        explanation: action.location.alias,
      };
    case 'EXACT_ENTITY':
      return {
        confidence: 'EXACT',
        evidenceKind: 'EXACT_ENTITY',
        chunks,
        candidateChunks: [],
        explanation: action.location.entity.name,
      };
    case 'EXPLICIT_CHUNKS':
      return {
        confidence: 'EXACT',
        evidenceKind: 'EXPLICIT_CHUNK',
        chunks,
        candidateChunks: [],
        explanation: chunks.join(', '),
      };
    default:
      throw new Error(`Unexpected Cook's Assistant location kind: ${action.location.kind}.`);
  }
};

const evaluatedAction = (
  action: QuestStrategyDefinition['actions'][number],
  millLocked: boolean,
): EvaluatedWalkthroughAction => {
  const location = resolvedLocationFor(action);
  const blocked = millLocked && location.chunks.includes('49,51');

  return {
    definition: action,
    location,
    state: blocked ? 'CHUNK_LOCKED' : 'READY_HERE',
    blockers: blocked ? [{
      kind: 'CHUNK',
      chunk: '49,51',
      label: action.displayText,
    }] : [],
    itemPreparation: [],
  };
};

const walkthroughAnalysisFor = (
  strategy: QuestStrategyDefinition,
  millLocked: boolean,
): QuestWalkthroughAnalysis => {
  const actions = strategy.actions.map(action => evaluatedAction(action, millLocked));
  return {
    questId: strategy.questId,
    releaseStatus: 'PREVIEW_ONLY',
    status: millLocked ? 'BLOCKED' : 'READY',
    actions,
    blockers: actions.flatMap(action => action.blockers),
    hasIncompleteEvidence: false,
    sourceLines: strategy.sourceLines,
    source: strategy.source,
  };
};

const itemAnalysis = (
  itemName: string,
  currentRoutes: readonly ItemRoute[],
  dataNotes: readonly string[] = [],
): QuestRouteAnalysis['items'][number] => ({
  requirement: {
    item: item(itemName),
    quantity: 1,
    supplyPolicy: 'PLAYER_OBTAINED',
  },
  state: 'OBTAINABLE_NOW',
  currentRoutes,
  missingChunkRoutes: [],
  missingChunkOptions: [],
  dataNotes,
});

const analysisFor = (
  strategy: QuestStrategyDefinition,
  millLocked: boolean,
): QuestRouteAnalysis => ({
  questId: strategy.questId,
  status: millLocked ? 'CANNOT_COMPLETE_YET' : 'READY_NOW',
  items: [
    itemAnalysis('Egg', [route('egg-spawn', 'Egg', 'Egg', 'SPAWN')]),
    itemAnalysis('Bucket of milk', [route('milk-cow', 'Bucket of milk', 'Dairy cow', 'GATHER')]),
    itemAnalysis('Pot of flour', [
      route('mill-flour', 'Pot of flour', 'Mill Lane Mill', 'RECIPE'),
      route('black-knight-flour', 'Pot of flour', 'Black Knight', 'DROP'),
    ], ['Route budget and source wording are retained for proof.']),
  ],
  generatedFrom: {
    chunkDataVersion: 1,
    questRevision: strategy.revision,
    walkthroughRevision: strategy.revision,
    accountFingerprint: 'coach-test-account',
  },
  walkthrough: walkthroughAnalysisFor(strategy, millLocked),
});

const cookStrategy = (): QuestStrategyDefinition => {
  const walkthrough = questWalkthroughFor("Cook's Assistant");
  const strategy = walkthrough && questStrategyFromWalkthrough(walkthrough);
  if (!strategy) throw new Error("Cook's Assistant strategy fixture did not load.");
  return strategy;
};

const buildModel = ({
  confirmedActionIds = [],
  confirmedItemKeys = [],
  completedQuestIds = [],
  millLocked = false,
}: {
  confirmedActionIds?: readonly string[];
  confirmedItemKeys?: readonly string[];
  completedQuestIds?: readonly string[];
  millLocked?: boolean;
} = {}) => {
  const strategy = cookStrategy();
  return buildRuneProofCoachModel({
    strategy,
    analysis: analysisFor(strategy, millLocked),
    confirmedActionIds: new Set(confirmedActionIds),
    confirmedItemKeys: new Set(confirmedItemKeys),
    completedQuestIds: new Set(completedQuestIds),
  });
};

const sheepStrategy = (): QuestStrategyDefinition => {
  const strategy = questStrategyFor('Sheep Shearer');
  if (!strategy) throw new Error('Sheep Shearer strategy fixture did not load.');
  return strategy;
};

const restlessStrategy = (): QuestStrategyDefinition => {
  const strategy = questStrategyFor('The Restless Ghost');
  if (!strategy) throw new Error('The Restless Ghost strategy fixture did not load.');
  return strategy;
};

const runeMysteriesStrategy = (): QuestStrategyDefinition => {
  const strategy = questStrategyFor('Rune Mysteries');
  if (!strategy) throw new Error('Rune Mysteries strategy fixture did not load.');
  return strategy;
};

const impStrategy = (): QuestStrategyDefinition => {
  const strategy = questStrategyFor('Imp Catcher');
  if (!strategy) throw new Error('Imp Catcher strategy fixture did not load.');
  return strategy;
};

const emptyAnalysisFor = (
  strategy: QuestStrategyDefinition,
): QuestPreparationRouteAnalysis => ({
  questId: strategy.questId,
  status: 'READY_NOW',
  items: [],
  generatedFrom: {
    chunkDataVersion: 1,
    questRevision: strategy.source.wikiRevision,
    accountFingerprint: 'sheep-coach-test-account',
  },
});

const impAnalysisFor = (
  strategy: QuestStrategyDefinition,
  southFaladorLocked = false,
  blackBeadCurrentRoutes: readonly ItemRoute[] = [
    routeAt('other-legal-imp-source', 'Black bead', 'Other legal Imps', 'DROP', '50,50'),
  ],
): QuestRouteAnalysis => {
  const actions = strategy.actions.map(action => {
    const chunks = actionChunks[action.id] ?? [];
    const blocked = southFaladorLocked && chunks.includes('47,51');
    return {
      definition: action,
      location: {
        confidence: 'REVIEWED' as const,
        evidenceKind: 'REVIEWED_ALIAS' as const,
        chunks,
        candidateChunks: [],
        explanation: action.location.kind === 'REVIEWED_ALIAS'
          ? action.location.alias
          : action.mapChunks.join(', '),
      },
      state: blocked ? 'CHUNK_LOCKED' as const : 'READY_HERE' as const,
      blockers: blocked ? [{
        kind: 'CHUNK' as const,
        chunk: '47,51' as ChunkKey,
        label: action.displayText,
      }] : [],
      itemPreparation: [],
    };
  });

  return {
    questId: strategy.questId,
    status: southFaladorLocked ? 'CANNOT_COMPLETE_YET' : 'READY_NOW',
    items: [
      itemAnalysis('Black bead', blackBeadCurrentRoutes),
    ],
    generatedFrom: {
      chunkDataVersion: 1,
      questRevision: strategy.source.wikiRevision,
      walkthroughRevision: strategy.source.wikiRevision,
      accountFingerprint: 'imp-catcher-coach-test-account',
    },
    walkthrough: {
      questId: strategy.questId,
      releaseStatus: 'PREVIEW_ONLY',
      status: southFaladorLocked ? 'BLOCKED' : 'READY',
      actions,
      blockers: actions.flatMap(action => action.blockers),
      hasIncompleteEvidence: false,
      sourceLines: strategy.sourceLines,
      source: strategy.source,
    },
  };
};

const buildImpCoach = ({
  confirmedItemKeys = new Set<string>(),
  confirmedActionIds = new Set<string>(),
  completedQuestIds = new Set<string>(),
  analysis,
  connectGraph,
}: {
  confirmedItemKeys?: ReadonlySet<string>;
  confirmedActionIds?: ReadonlySet<string>;
  completedQuestIds?: ReadonlySet<string>;
  analysis?: QuestRouteAnalysis;
  connectGraph?: ConnectGraph;
} = {}) => {
  const strategy = impStrategy();
  return buildRuneProofCoachModel({
    strategy,
    analysis: analysis ?? impAnalysisFor(strategy),
    confirmedItemKeys,
    confirmedActionIds,
    completedQuestIds,
    connectGraph,
  });
};

const restlessBlockedAnalysisFor = (
  strategy: QuestStrategyDefinition,
): QuestRouteAnalysis => {
  const actions = strategy.actions.map(action => {
    const blocked = action.id === 'the-restless-ghost:take-skull';
    return {
      definition: action,
      location: {
        confidence: 'REVIEWED' as const,
        evidenceKind: 'REVIEWED_ALIAS' as const,
        chunks: actionChunks[action.id] ?? [],
        candidateChunks: [],
        explanation: action.location.kind === 'REVIEWED_ALIAS'
          ? action.location.alias
          : action.mapChunks.join(', '),
      },
      state: blocked ? 'CHUNK_LOCKED' as const : 'READY_HERE' as const,
      blockers: blocked ? [{
        kind: 'CHUNK' as const,
        chunk: '48,49' as ChunkKey,
        label: action.displayText,
      }] : [],
      itemPreparation: [],
    };
  });
  return {
    questId: strategy.questId,
    status: 'CANNOT_COMPLETE_YET',
    items: [],
    generatedFrom: {
      chunkDataVersion: 1,
      questRevision: strategy.source.wikiRevision,
      walkthroughRevision: strategy.source.wikiRevision,
      accountFingerprint: 'restless-ghost-coach-test-account',
    },
    walkthrough: {
      questId: strategy.questId,
      releaseStatus: 'PREVIEW_ONLY',
      status: 'BLOCKED',
      actions,
      blockers: actions.flatMap(action => action.blockers),
      hasIncompleteEvidence: false,
      sourceLines: strategy.sourceLines,
      source: strategy.source,
    },
  };
};

const buildFromAnalysis = (
  strategy: QuestStrategyDefinition,
  analysis: QuestRouteAnalysis,
) => buildRuneProofCoachModel({
  strategy,
  analysis,
  confirmedActionIds: new Set(),
  confirmedItemKeys: new Set(),
  completedQuestIds: new Set(),
});

const withPrimaryAction = (
  analysis: QuestRouteAnalysis,
  overrides: Pick<EvaluatedWalkthroughAction, 'state' | 'blockers'>,
): QuestRouteAnalysis => ({
  ...analysis,
  walkthrough: {
    ...analysis.walkthrough,
    actions: analysis.walkthrough.actions.map((action, index) => (
      index === 0 ? { ...action, ...overrides } : action
    )),
  },
});

const earlierThanGrain = (): readonly string[] => cookStrategy().actions
  .filter(action => action.sourceOrder < 6)
  .map(action => action.id);

const fallbackTravelGraph: ConnectGraph = {
  '12850': ['12851'],
  '12851': ['12850', '12852'],
  '12852': ['12851', '12853'],
  '12853': ['12852'],
};

const analysisWithOutOfOrderFlourFallbacks = (
  strategy: QuestStrategyDefinition,
): QuestRouteAnalysis => {
  const analysis = analysisFor(strategy, false);
  return {
    ...analysis,
    items: analysis.items.map(item => (
      item.requirement.item.key === 'pot of flour'
        ? {
          ...item,
          currentRoutes: [
            routeAt('far-flour-spawn', 'Pot of flour', 'Far flour', 'SPAWN', '50,53'),
            routeAt('nearby-flour-spawn', 'Pot of flour', 'Nearby flour', 'SPAWN', '50,51'),
          ],
        }
        : item
    )),
  };
};

describe('buildRuneProofCoachModel', () => {
  it('keeps Rune Mysteries hand-offs manual until the final quest confirmation', () => {
    const strategy = runeMysteriesStrategy();
    const beforeFinalConfirmation = buildRuneProofCoachModel({
      strategy,
      analysis: emptyAnalysisFor(strategy),
      confirmedActionIds: new Set([
        'rune-mysteries:start-with-duke',
        'rune-mysteries:take-talisman-to-sedridor',
        'rune-mysteries:take-package-to-aubury',
        'rune-mysteries:return-notes-to-sedridor',
      ]),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
    });

    expect(beforeFinalConfirmation.progress).toEqual({ completed: 4, total: 5 });
    expect(beforeFinalConfirmation.nextAction).toMatchObject({
      id: 'rune-mysteries:complete',
      state: 'NEEDS_CONFIRMATION',
      confirmationAllowed: true,
      confirmationLabel: 'Confirm quest complete',
    });

    const afterFinalConfirmation = buildRuneProofCoachModel({
      strategy,
      analysis: emptyAnalysisFor(strategy),
      confirmedActionIds: new Set([
        'rune-mysteries:start-with-duke',
        'rune-mysteries:take-talisman-to-sedridor',
        'rune-mysteries:take-package-to-aubury',
        'rune-mysteries:return-notes-to-sedridor',
        'rune-mysteries:complete',
      ]),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
    });

    expect(afterFinalConfirmation.progress).toEqual({ completed: 5, total: 5 });
    expect(afterFinalConfirmation.nextAction).toBeUndefined();
  });

  it('blocks the Restless Ghost skull step by chunk without requiring a skeleton kill', () => {
    const strategy = restlessStrategy();
    const model = buildRuneProofCoachModel({
      strategy,
      analysis: restlessBlockedAnalysisFor(strategy),
      confirmedActionIds: new Set([
        'the-restless-ghost:start-with-aereck',
        'the-restless-ghost:get-amulet',
        'the-restless-ghost:talk-to-ghost',
      ]),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
    });

    expect(model.nextAction).toMatchObject({
      id: 'the-restless-ghost:take-skull',
      state: 'BLOCKED',
    });
    expect(model.nextAction?.blockerText).toContain('Unlock chunk 48,49');
    expect(model.nextAction?.blockerText).toContain('leave without fighting the skeleton');
    expect(model.nextAction?.instruction).toBe(
      "Search the altar in the Wizards' Tower basement for the ghost's skull, then leave without fighting the skeleton.",
    );
    expect(model.nextAction?.instruction).not.toMatch(/must kill|kill the skeleton/i);
  });

  it('uses ball-of-wool confirmation only to complete Sheep Shearer spin-wool', () => {
    const strategy = sheepStrategy();
    const model = buildRuneProofCoachModel({
      strategy,
      analysis: emptyAnalysisFor(strategy),
      confirmedActionIds: new Set(),
      confirmedItemKeys: new Set(['ball of wool']),
      completedQuestIds: new Set(),
    });

    expect(model.progress).toEqual({ completed: 3, total: 5 });
    expect(model.actions.find(action => action.id === 'sheep-shearer:spin-wool')?.state)
      .toBe('COMPLETED');
    expect(model.actions.find(action => action.id === 'sheep-shearer:return-to-fred')?.state)
      .not.toBe('COMPLETED');
    expect(model.actions.find(action => action.id === 'sheep-shearer:complete')?.state)
      .not.toBe('COMPLETED');
    expect(model.nextAction?.id).toBe('sheep-shearer:return-to-fred');
  });

  it('marks an Imp Catcher bead from item evidence without ordering the other beads', () => {
    const yellowOnly = buildImpCoach({ confirmedItemKeys: new Set(['yellow bead']) });

    expect(yellowOnly.actions.find(action => action.id === 'imp-catcher:get-yellow-bead')?.state)
      .toBe('COMPLETED');
    expect(yellowOnly.actions.find(action => action.id === 'imp-catcher:get-black-bead')?.state)
      .not.toBe('COMPLETED');
  });

  it('allows only ready independent Imp bead confirmations out of order', () => {
    const model = buildImpCoach();

    expect(model.actions.map(action => [action.id, action.confirmationAllowed])).toEqual([
      ['imp-catcher:get-black-bead', true],
      ['imp-catcher:get-red-bead', true],
      ['imp-catcher:get-white-bead', true],
      ['imp-catcher:get-yellow-bead', true],
      ['imp-catcher:give-beads-to-mizgog', false],
      ['imp-catcher:complete', false],
    ]);
  });

  it('permits only the matching Imp bead through an unlocked alternative when the reviewed chunk is locked', () => {
    const strategy = impStrategy();
    const model = buildImpCoach({ analysis: impAnalysisFor(strategy, true) });

    expect(model.actions.map(action => action.confirmationAllowed)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('withholds a locked Imp bead when its matching alternative is still blocked', () => {
    const strategy = impStrategy();
    const model = buildImpCoach({ analysis: impAnalysisFor(strategy, true, [
      routeAt('blocked-other-legal-imps', 'Black bead', 'Other legal Imps', 'DROP', '50,50', {
        blockers: [{
          type: 'QUEST',
          questId: 'Priest in Peril',
          label: 'Priest in Peril',
        }],
      }),
    ]) });

    expect(model.actions.slice(0, 4).map(action => action.confirmationAllowed)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('promotes an unlocked equivalent Imp source into the main bead step', () => {
    const strategy = impStrategy();
    const model = buildImpCoach({ analysis: impAnalysisFor(strategy, true) });

    expect(model.nextAction).toMatchObject({
      id: 'imp-catcher:get-black-bead',
      state: 'DO_NOW',
      mapChunks: ['50,50'],
      preferredMethodLabel: 'Other legal Imps',
    });
    expect(model.nextAction?.instruction).toContain('Kill imps');
    expect(model.nextAction?.instruction).toContain('Lumbridge');
    expect(model.nextAction?.instruction).toContain('black bead');
    expect(model.nextAction?.blockerText).toBeUndefined();
    expect(model.alternativeSources).toEqual([
      expect.objectContaining({
        itemKey: 'black bead',
        routes: [expect.objectContaining({
          id: 'other-legal-imp-source',
          requiresChunkUnlock: false,
        })],
      }),
    ]);
  });

  it('starts with the reviewed Cook instruction and keeps analysis wording out of the journey', () => {
    const model = buildModel();

    expect(model.nextAction?.id).toBe('cooks-assistant:start-quest');
    expect(model.nextAction?.instruction).toBe('Talk to the Cook in Lumbridge Castle.');
    expect(model.nextAction?.state).toBe('DO_NOW');
    expect(model.mainJourneyText).not.toMatch(/route budget|source wording|Black Knight/i);
    expect(model.proof.diagnostics).toContain('Route budget and source wording are retained for proof.');
  });

  it('keeps resolver explanations out of player-facing location labels', () => {
    const strategy = cookStrategy();
    const analysis = analysisFor(strategy, false);
    const withResolverExplanations: QuestRouteAnalysis = {
      ...analysis,
      walkthrough: {
        ...analysis.walkthrough,
        actions: analysis.walkthrough.actions.map(action => {
          if (action.definition.id === 'cooks-assistant:return-to-cook') {
            return {
              ...action,
              location: {
                ...action.location,
                explanation: 'Cook (Lumbridge) has one exact canonical chunk.',
              },
            };
          }
          if (action.definition.id === 'cooks-assistant:complete') {
            return {
              ...action,
              location: {
                ...action.location,
                explanation: 'Explicit source chunks are authoritative.',
              },
            };
          }
          return action;
        }),
      },
    };

    const model = buildFromAnalysis(strategy, withResolverExplanations);

    expect(model.actions.find(action => action.id === 'cooks-assistant:return-to-cook')?.locationLabel)
      .toBe('Lumbridge Castle');
    expect(model.actions.find(action => action.id === 'cooks-assistant:complete')?.locationLabel)
      .toBeUndefined();
    expect(model.actions.map(action => action.locationLabel).join(' '))
      .not.toMatch(/canonical chunk|source chunks are authoritative/i);
  });

  it('uses a generic chunk blocker when no reviewed location label exists', () => {
    const strategy = cookStrategy();
    const analysis = analysisFor(strategy, false);
    const blockedCompletion: QuestRouteAnalysis = {
      ...analysis,
      walkthrough: {
        ...analysis.walkthrough,
        actions: analysis.walkthrough.actions.map(action => (
          action.definition.id === 'cooks-assistant:complete'
            ? {
              ...action,
              state: 'CHUNK_LOCKED' as const,
              location: {
                ...action.location,
                explanation: 'Explicit source chunks are authoritative.',
              },
              blockers: [{
                kind: 'CHUNK' as const,
                chunk: '50,50' as ChunkKey,
                label: action.definition.displayText,
              }],
            }
            : action
        )),
      },
    };
    const model = buildRuneProofCoachModel({
      strategy,
      analysis: blockedCompletion,
      confirmedActionIds: new Set(
        strategy.actions
          .filter(action => action.id !== 'cooks-assistant:complete')
          .map(action => action.id),
      ),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
    });

    expect(model.nextAction?.id).toBe('cooks-assistant:complete');
    expect(model.nextAction?.blockerText).toBe('Unlock chunk 50,50 before this step.');
  });

  it('preserves location labels authored in reviewed instructions and aliases', () => {
    const model = buildModel({ confirmedActionIds: earlierThanGrain() });

    expect(model.actions.find(action => action.id === 'cooks-assistant:start-quest')?.locationLabel)
      .toBe('Lumbridge Castle');
    expect(model.actions.find(action => action.id === 'cooks-assistant:take-bucket')?.locationLabel)
      .toBe('Lumbridge Castle cellar');
    expect(model.actions.find(action => action.id === 'cooks-assistant:pick-grain')?.locationLabel)
      .toBe('Mill Lane Mill');
  });

  it('advances to the first unconfirmed reviewed action', () => {
    const model = buildModel({
      confirmedActionIds: [
        'cooks-assistant:start-quest',
        'cooks-assistant:take-pot',
      ],
    });

    expect(model.nextAction?.id).toBe('cooks-assistant:take-bucket');
    expect(model.actions.filter(action => action.state === 'DO_NOW')).toHaveLength(1);
  });

  it('lets the current item-backed action be confirmed from the coach', () => {
    const model = buildModel({
      confirmedActionIds: [
        'cooks-assistant:start-quest',
        'cooks-assistant:take-pot',
        'cooks-assistant:take-bucket',
      ],
    });

    expect(model.nextAction?.id).toBe('cooks-assistant:milk-cow');
    expect(model.nextAction?.state).toBe('DO_NOW');
    expect(model.nextAction?.confirmationAllowed).toBe(true);
  });

  it('keeps a locked reviewed mill step primary while exposing flour alternatives secondarily', () => {
    const model = buildModel({
      confirmedActionIds: earlierThanGrain(),
      millLocked: true,
    });

    expect(model.nextAction?.id).toBe('cooks-assistant:pick-grain');
    expect(model.nextAction?.state).toBe('BLOCKED');
    expect(model.nextAction?.blockerText).toBe('Unlock chunk 49,51 to use Mill Lane Mill.');
    expect(model.alternativeSources
      .find(source => source.itemKey === 'pot of flour')
      ?.routes.some(route => route.label === 'Black Knight')).toBe(true);
  });

  it('keeps every later incomplete action available when the primary mill step is locked', () => {
    const model = buildModel({
      confirmedActionIds: earlierThanGrain(),
      millLocked: true,
    });

    expect(model.actions.filter(action => (
      action.state === 'DO_NOW'
      || action.state === 'BLOCKED'
      || action.state === 'NEEDS_CONFIRMATION'
    )).map(action => action.id))
      .toEqual(['cooks-assistant:pick-grain']);
    expect(model.actions.find(action => action.id === 'cooks-assistant:make-flour')?.state)
      .toBe('AVAILABLE_NEXT');
  });

  it('merges duplicate eligible flour requirements and ranks each unique alternative group', () => {
    const strategy = cookStrategy();
    const analysis = analysisFor(strategy, false);
    const duplicateFlourRequirement = itemAnalysis('Pot of flour', [
      route('black-knight-flour', 'Pot of flour', 'Black Knight', 'DROP'),
      route('windmill-flour', 'Pot of flour', 'Windmill', 'RECIPE'),
    ]);
    const model = buildRuneProofCoachModel({
      strategy,
      analysis: { ...analysis, items: [...analysis.items, duplicateFlourRequirement] },
      confirmedActionIds: new Set(),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
    });

    const flourGroups = model.alternativeSources
      .filter(source => source.itemKey === 'pot of flour');
    expect(model.alternativeSources.map(source => source.itemKey))
      .toEqual(['bucket of milk', 'egg', 'pot of flour']);
    expect(flourGroups).toHaveLength(1);
    expect(flourGroups[0]?.routes.map(candidate => ({
      id: candidate.id,
      variantCount: candidate.variantCount,
    }))).toEqual([
      { id: 'mill-flour', variantCount: 2 },
      { id: 'black-knight-flour', variantCount: 1 },
    ]);
  });

  it('coalesces equivalent ranked alternatives while retaining secondary Black Knight evidence', () => {
    const strategy = cookStrategy();
    const analysis = analysisFor(strategy, false);
    const hopperRoutes = Array.from({ length: 32 }, (_, index) => route(
      `hopper-${String(index).padStart(2, '0')}`,
      'Pot of flour',
      'grain-to-flour',
      'RECIPE',
      {
        steps: [{
          id: `hopper-${index}:station`,
          label: 'Use Hopper',
          chunk: '49,51',
          gates: [],
          sourceKind: 'RECIPE',
          requiresChunkUnlock: false,
          hasDataGap: false,
        }],
      },
    ));
    const blackKnightRoutes = Array.from({ length: 4 }, (_, index) => route(
      `black-knight-${index}`,
      'Pot of flour',
      'Black Knight',
      'DROP',
    ));
    const model = buildRuneProofCoachModel({
      strategy,
      analysis: {
        ...analysis,
        items: analysis.items.map(entry => (
          entry.requirement.item.key === 'pot of flour'
            ? itemAnalysis('Pot of flour', [...hopperRoutes, ...blackKnightRoutes])
            : entry
        )),
      },
      confirmedActionIds: new Set(),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
    });

    const routes = model.alternativeSources
      .find(source => source.itemKey === 'pot of flour')?.routes;
    expect(routes?.map(candidate => ({
      id: candidate.id,
      label: candidate.label,
      variantCount: candidate.variantCount,
    }))).toEqual([
      { id: 'hopper-00', label: 'Use Hopper', variantCount: 32 },
      { id: 'black-knight-0', label: 'Black Knight', variantCount: 4 },
    ]);
  });

  it('does not merge otherwise equivalent alternatives across current and locked access states', () => {
    const strategy = cookStrategy();
    const analysis = analysisFor(strategy, false);
    const current = route('current-flour', 'Pot of flour', 'Flour spawn', 'SPAWN');
    const locked = route('locked-flour', 'Pot of flour', 'Flour spawn', 'SPAWN', {
      chunks: ['49,51'],
      steps: [{
        id: 'locked-flour:source',
        label: 'Flour spawn',
        chunk: '49,51',
        gates: [],
        sourceKind: 'SPAWN',
        requiresChunkUnlock: true,
        hasDataGap: false,
      }],
    });
    const model = buildRuneProofCoachModel({
      strategy,
      analysis: {
        ...analysis,
        items: analysis.items.map(entry => (
          entry.requirement.item.key === 'pot of flour'
            ? {
              ...itemAnalysis('Pot of flour', [current]),
              state: 'ROUTE_BLOCKED' as const,
              missingChunkRoutes: [locked],
              missingChunkOptions: [{
                chunks: ['49,51'] as ChunkKey[],
                routeIds: [locked.id],
                remainingGates: [],
              }],
            }
            : entry
        )),
      },
      confirmedActionIds: new Set(),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
    });

    const routes = model.alternativeSources
      .find(source => source.itemKey === 'pot of flour')?.routes;
    expect(routes?.map(candidate => ({
      requiresChunkUnlock: candidate.requiresChunkUnlock,
      variantCount: candidate.variantCount,
    }))).toEqual([
      { requiresChunkUnlock: false, variantCount: 1 },
      { requiresChunkUnlock: true, variantCount: 1 },
    ]);
  });

  it('ranks fallback alternatives from the previous completed reviewed location without replacing the current action', () => {
    const strategy = cookStrategy();
    const model = buildRuneProofCoachModel({
      strategy,
      analysis: analysisWithOutOfOrderFlourFallbacks(strategy),
      confirmedActionIds: new Set(['cooks-assistant:start-quest']),
      confirmedItemKeys: new Set(),
      completedQuestIds: new Set(),
      connectGraph: fallbackTravelGraph,
    });

    expect(model.nextAction?.id).toBe('cooks-assistant:take-pot');
    expect(model.alternativeSources
      .find(source => source.itemKey === 'pot of flour')
      ?.routes.map(route => route.id))
      .toEqual(['nearby-flour-spawn', 'far-flour-spawn']);
  });

  it('renders exact gate and item blockers for the primary reviewed action', () => {
    const strategy = cookStrategy();
    const gateModel = buildFromAnalysis(strategy, withPrimaryAction(analysisFor(strategy, false), {
      state: 'REQUIREMENT_MISSING',
      blockers: [{
        kind: 'GATE',
        gate: { type: 'SKILL', skill: 'Mining', level: 30, label: 'Mining level 30' },
        label: 'Mining level 30',
      }],
    }));
    const itemModel = buildFromAnalysis(strategy, withPrimaryAction(analysisFor(strategy, false), {
      state: 'REQUIREMENT_MISSING',
      blockers: [{ kind: 'ITEM', itemKey: 'bucket', label: 'Bucket' }],
    }));

    expect(gateModel.nextAction?.blockerText).toBe('Mining level 30 is required before this step.');
    expect(itemModel.nextAction?.blockerText).toBe('Get Bucket before this step.');
  });

  it('ignores dependency-only evaluator blockers when choosing the current action state', () => {
    const strategy = cookStrategy();
    const model = buildFromAnalysis(strategy, withPrimaryAction(analysisFor(strategy, false), {
      state: 'REQUIREMENT_MISSING',
      blockers: [{
        kind: 'DEPENDENCY',
        actionId: 'cooks-assistant:take-pot',
        label: 'Take the pot first.',
      }],
    }));

    expect(model.nextAction?.state).toBe('DO_NOW');
    expect(model.nextAction?.blockerText).toBeUndefined();
  });

  it('requires confirmation when the evaluator has no proof for the primary action', () => {
    const strategy = cookStrategy();
    const analysis = analysisFor(strategy, false);
    const model = buildFromAnalysis(strategy, {
      ...analysis,
      walkthrough: {
        ...analysis.walkthrough,
        actions: analysis.walkthrough.actions
          .filter(action => action.definition.id !== 'cooks-assistant:start-quest'),
      },
    });

    expect(model.nextAction?.state).toBe('NEEDS_CONFIRMATION');
    expect(model.nextAction?.confirmationAllowed).toBe(true);
  });

  it('excludes fallback-NONE strategy outputs from alternative sources', () => {
    const originalStrategy = cookStrategy();
    const strategy: QuestStrategyDefinition = {
      ...originalStrategy,
      actions: originalStrategy.actions.map(action => (
        action.id === 'cooks-assistant:make-flour'
          ? { ...action, coach: { ...action.coach, fallbackPolicy: 'NONE' } }
          : action
      )),
    };
    const model = buildFromAnalysis(strategy, analysisFor(strategy, false));

    expect(model.alternativeSources.map(source => source.itemKey)).not.toContain('pot of flour');
  });

  it('is deterministic across calls without mutating reviewed strategy or analysis inputs', () => {
    const strategy = cookStrategy();
    const analysis = analysisFor(strategy, false);
    const inputBefore = JSON.stringify({ strategy, analysis });

    const first = buildFromAnalysis(strategy, analysis);
    const second = buildFromAnalysis(strategy, analysis);

    expect(second).toEqual(first);
    expect(JSON.stringify({ strategy, analysis })).toBe(inputBefore);
  });

  it('uses the reviewed mill instruction and label when the mill is available', () => {
    const model = buildModel({ confirmedActionIds: earlierThanGrain() });

    expect(model.actions.find(action => action.id === 'cooks-assistant:make-flour')?.preferredMethodLabel)
      .toBe('Mill Lane Mill');
    expect(model.nextAction?.instruction).toBe('Pick grain outside Mill Lane Mill.');
  });

  it('closes transitive dependencies when a later confirmed item proves its action complete', () => {
    const model = buildModel({ confirmedItemKeys: ['pot of flour'] });

    expect(model.actions.slice(0, 7).every(action => action.state === 'COMPLETED')).toBe(true);
    expect(model.nextAction?.id).toBe('cooks-assistant:return-to-cook');
  });

  it('lets RuneProof confirm the final quest-completed step without canonical quest proof', () => {
    const strategy = cookStrategy();
    const earlierActionIds = strategy.actions
      .filter(action => action.id !== 'cooks-assistant:complete')
      .map(action => action.id);
    const beforeConfirmation = buildModel({ confirmedActionIds: earlierActionIds });

    expect(beforeConfirmation.progress).toEqual({ completed: 8, total: 9 });
    expect(beforeConfirmation.nextAction).toMatchObject({
      id: 'cooks-assistant:complete',
      state: 'DO_NOW',
      confirmationAllowed: true,
      confirmationLabel: 'Confirm quest complete',
    });

    const afterConfirmation = buildModel({
      confirmedActionIds: [...earlierActionIds, 'cooks-assistant:complete'],
    });
    expect(afterConfirmation.progress).toEqual({ completed: 9, total: 9 });
    expect(afterConfirmation.nextAction).toBeUndefined();
  });

  it('uses quest completion as conservative proof for the whole reviewed strategy', () => {
    const model = buildModel({ completedQuestIds: ["Cook's Assistant"] });

    expect(model.progress).toEqual({ completed: 9, total: 9 });
    expect(model.nextAction).toBeUndefined();
    expect(model.actions.every(action => action.state === 'COMPLETED')).toBe(true);
  });
});
