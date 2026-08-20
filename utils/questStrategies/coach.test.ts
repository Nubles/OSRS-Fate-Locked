import { describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import type { QuestRouteAnalysis } from '../questRoutes/analyzeQuest';
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
};

const route = (
  id: string,
  itemName: string,
  sourceLabel: string,
  sourceKind: SourceKind,
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

const earlierThanGrain = (): readonly string[] => cookStrategy().actions
  .filter(action => action.sourceOrder < 6)
  .map(action => action.id);

describe('buildRuneProofCoachModel', () => {
  it('starts with the reviewed Cook instruction and keeps analysis wording out of the journey', () => {
    const model = buildModel();

    expect(model.nextAction?.id).toBe('cooks-assistant:start-quest');
    expect(model.nextAction?.instruction).toBe('Talk to the Cook in Lumbridge Castle.');
    expect(model.nextAction?.state).toBe('DO_NOW');
    expect(model.mainJourneyText).not.toMatch(/route budget|source wording|Black Knight/i);
    expect(model.proof.diagnostics).toContain('Route budget and source wording are retained for proof.');
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

  it('uses quest completion as conservative proof for the whole reviewed strategy', () => {
    const model = buildModel({ completedQuestIds: ["Cook's Assistant"] });

    expect(model.progress).toEqual({ completed: 9, total: 9 });
    expect(model.nextAction).toBeUndefined();
    expect(model.actions.every(action => action.state === 'COMPLETED')).toBe(true);
  });
});
