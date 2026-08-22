import type { PresentedQuestWalkthrough, PresentedWalkthroughAction } from '../questWalkthroughs/presenter';
import type { ChunkKey } from './model';
import type {
  PresentedBlocker,
  PresentedQuestAnalysis,
  PresentedQuestItem,
  PresentedRoute,
} from './presenter';

export type QuestRouteMapLayerId = 'QUEST_PATH' | 'PREPARATION';
export type QuestRouteMapMarkerState = 'USABLE' | 'BLOCKED' | 'INCOMPLETE';

interface QuestRouteMapStepBase {
  readonly id: string;
  readonly targetId: string;
  readonly sequence: number;
  readonly label: string;
  readonly chunk: ChunkKey;
  readonly state: QuestRouteMapMarkerState;
  readonly targetAnchor: string;
  readonly canOpenWorldChunk: true;
}

export type QuestRouteMapStep =
  | QuestRouteMapStepBase & {
      readonly kind: 'QUEST_ACTION';
      readonly statusText: PresentedWalkthroughAction['statusText'];
    }
  | QuestRouteMapStepBase & {
      readonly routeLabel: string;
      readonly kind: 'PREPARATION';
      readonly itemId: string;
      readonly itemName: string;
      readonly routeId: string;
      readonly sourceKind?: string;
      readonly requiresChunkUnlock: boolean;
      readonly blockers: readonly PresentedBlocker[];
    };

export interface QuestRouteMapChunk {
  readonly chunk: ChunkKey;
  readonly state: QuestRouteMapMarkerState;
  readonly steps: readonly QuestRouteMapStep[];
}

export interface QuestRouteMapLayer {
  readonly id: QuestRouteMapLayerId;
  readonly label: 'Quest path' | 'Preparation';
  readonly chunks: readonly QuestRouteMapChunk[];
  readonly unmappedTargetIds: readonly string[];
}

export interface QuestRouteMapModel {
  readonly questId: string;
  readonly defaultLayer: QuestRouteMapLayerId;
  readonly layers: readonly QuestRouteMapLayer[];
}

const routeState = (route: PresentedRoute): QuestRouteMapMarkerState => {
  if (route.dataNote) return 'INCOMPLETE';
  if (route.requiresChunkUnlock || route.blockers.length > 0) return 'BLOCKED';
  return 'USABLE';
};

const preparationStepState = (
  step: PresentedRoute['steps'][number],
): QuestRouteMapMarkerState => {
  if (step.hasDataGap) return 'INCOMPLETE';
  if (step.requiresChunkUnlock || step.blockers.length > 0) return 'BLOCKED';
  return 'USABLE';
};

const questActionState = (
  action: PresentedWalkthroughAction,
): QuestRouteMapMarkerState => {
  switch (action.statusText) {
    case 'Ready here':
      return 'USABLE';
    case 'Chunk locked':
    case 'Requirement missing':
      return 'BLOCKED';
    case 'Prepare first':
    case 'Location needs review':
    case 'Information':
      return 'INCOMPLETE';
  }
};

const selectMainRoute = (
  item: PresentedQuestItem,
): PresentedRoute | undefined =>
  item.routes.find(route => routeState(route) === 'USABLE' && !route.requiresChunkUnlock)
  ?? item.routes.find(route => !route.requiresChunkUnlock)
  ?? item.routes.find(route => route.requiresChunkUnlock);

const SHARED_STATE_ORDER: Record<QuestRouteMapMarkerState, number> = {
  USABLE: 0,
  BLOCKED: 1,
  INCOMPLETE: 2,
};

interface MutableChunk {
  chunk: ChunkKey;
  state: QuestRouteMapMarkerState;
  steps: QuestRouteMapStep[];
}

const appendStep = (
  chunksByKey: Map<ChunkKey, MutableChunk>,
  step: QuestRouteMapStep,
): void => {
  const existing = chunksByKey.get(step.chunk);
  if (existing) {
    existing.steps.push(step);
    if (SHARED_STATE_ORDER[step.state] > SHARED_STATE_ORDER[existing.state]) {
      existing.state = step.state;
    }
    return;
  }
  chunksByKey.set(step.chunk, {
    chunk: step.chunk,
    state: step.state,
    steps: [step],
  });
};

const finishLayer = (
  id: QuestRouteMapLayerId,
  label: QuestRouteMapLayer['label'],
  chunksByKey: ReadonlyMap<ChunkKey, MutableChunk>,
  unmappedTargetIds: readonly string[],
): QuestRouteMapLayer => ({
  id,
  label,
  chunks: [...chunksByKey.values()].map(chunk => ({
    chunk: chunk.chunk,
    state: chunk.state,
    steps: [...chunk.steps],
  })),
  unmappedTargetIds: [...unmappedTargetIds],
});

const buildQuestPathLayer = (
  walkthrough: PresentedQuestWalkthrough,
): QuestRouteMapLayer => {
  const chunksByKey = new Map<ChunkKey, MutableChunk>();
  const unmappedTargetIds: string[] = [];
  const actions = walkthrough.questActions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => (
      left.action.sourceOrder - right.action.sourceOrder || left.index - right.index
    ))
    .map(({ action }) => action);

  for (const action of actions) {
    if (!action.canShowOnMap || action.mapChunks.length === 0) {
      unmappedTargetIds.push(action.id);
      continue;
    }

    for (const chunk of action.mapChunks) {
      appendStep(chunksByKey, {
        kind: 'QUEST_ACTION',
        id: `${action.id}:${chunk}`,
        targetId: action.id,
        sequence: action.sourceOrder,
        label: action.instruction,
        chunk,
        state: questActionState(action),
        statusText: action.statusText,
        targetAnchor: action.anchorId,
        canOpenWorldChunk: true,
      });
    }
  }

  return finishLayer('QUEST_PATH', 'Quest path', chunksByKey, unmappedTargetIds);
};

const buildPreparationLayer = (
  analysis: PresentedQuestAnalysis,
): QuestRouteMapLayer => {
  const chunksByKey = new Map<ChunkKey, MutableChunk>();
  const unmappedTargetIds: string[] = [];
  let sequence = 0;

  for (const item of analysis.items) {
    if (item.supplyPolicy === 'QUEST_PROVIDED') continue;

    const route = selectMainRoute(item);
    if (!route) {
      unmappedTargetIds.push(item.id);
      continue;
    }

    let mappedStepCount = 0;
    for (let stepIndex = 0; stepIndex < route.steps.length; stepIndex += 1) {
      const presentedStep = route.steps[stepIndex];
      if (!presentedStep.chunk) continue;

      mappedStepCount += 1;
      sequence += 1;
      appendStep(chunksByKey, {
        kind: 'PREPARATION',
        id: `${item.id}:${route.id}:${stepIndex}`,
        targetId: item.id,
        sequence,
        label: presentedStep.label,
        itemId: item.id,
        routeLabel: presentedStep.label,
        itemName: item.itemName,
        routeId: route.id,
        sourceKind: presentedStep.sourceKind,
        chunk: presentedStep.chunk,
        state: preparationStepState(presentedStep),
        requiresChunkUnlock: presentedStep.requiresChunkUnlock,
        blockers: presentedStep.blockers.map(blocker => ({ ...blocker })),
        targetAnchor: item.anchorId,
        canOpenWorldChunk: true,
      });
    }

    if (mappedStepCount === 0) unmappedTargetIds.push(item.id);
  }

  return finishLayer('PREPARATION', 'Preparation', chunksByKey, unmappedTargetIds);
};

export const buildQuestRouteMapModel = (
  analysis: PresentedQuestAnalysis,
  walkthrough: PresentedQuestWalkthrough,
): QuestRouteMapModel => ({
  questId: analysis.questId,
  defaultLayer: 'QUEST_PATH',
  layers: [buildQuestPathLayer(walkthrough), buildPreparationLayer(analysis)],
});

export const buildPreparationRouteMapModel = (
  analysis: PresentedQuestAnalysis,
): QuestRouteMapModel => ({
  questId: analysis.questId,
  defaultLayer: 'PREPARATION',
  layers: [buildPreparationLayer(analysis)],
});
