import type { DeepReadonly, RuneProofRouteAnalysis } from '../questRoutes/analyzeQuest';
import type { ConnectGraph } from '../../services/ChunkContentService';
import type { ChunkKey, ItemRoute } from '../questRoutes/model';
import { rankFallbackRoutes } from '../questRoutes/ranker';
import {
  presentQuestAnalysis,
  type PresentedRoute,
} from '../questRoutes/presenter';
import type {
  EvaluatedWalkthroughAction,
  QuestWalkthroughAnalysis,
  WalkthroughBlocker,
} from '../questWalkthroughs/model';
import type { QuestStrategyDefinition } from './model';

export type RuneProofCoachActionState =
  | 'COMPLETED'
  | 'DO_NOW'
  | 'AVAILABLE_NEXT'
  | 'BLOCKED'
  | 'NEEDS_CONFIRMATION';

export interface RuneProofCoachAction {
  readonly id: string;
  readonly instruction: string;
  readonly state: RuneProofCoachActionState;
  readonly locationLabel?: string;
  readonly mapChunks: readonly ChunkKey[];
  readonly blockerText?: string;
  readonly preferredMethodLabel?: string;
  readonly confirmationAllowed: boolean;
  readonly confirmationLabel?: string;
}

export interface RuneProofAlternativeSourceGroup {
  readonly itemKey: string;
  readonly itemName: string;
  readonly routes: readonly RuneProofAlternativeRoute[];
}

export interface RuneProofAlternativeRoute extends PresentedRoute {
  readonly variantCount: number;
}

export interface RuneProofCoachModel {
  readonly questId: string;
  readonly recommendationReason: string;
  readonly progress: Readonly<{ completed: number; total: number }>;
  readonly nextAction?: RuneProofCoachAction;
  readonly actions: readonly RuneProofCoachAction[];
  readonly alternativeSources: readonly RuneProofAlternativeSourceGroup[];
  /** Reviewed instructions only; diagnostics and generic routes belong outside the main journey. */
  readonly mainJourneyText: string;
  readonly proof: Readonly<{
    source: QuestWalkthroughAnalysis['source'];
    sourceLines: QuestWalkthroughAnalysis['sourceLines'];
    diagnostics: readonly string[];
  }>;
}

export interface RuneProofCoachInput {
  readonly strategy: QuestStrategyDefinition;
  readonly analysis: RuneProofRouteAnalysis;
  readonly connectGraph?: ConnectGraph;
  readonly confirmedItemKeys: ReadonlySet<string>;
  readonly confirmedActionIds: ReadonlySet<string>;
  readonly completedQuestIds: ReadonlySet<string>;
}

type StrategyAction = QuestStrategyDefinition['actions'][number];
type KnownBlocker = Exclude<WalkthroughBlocker, { readonly kind: 'DEPENDENCY' | 'LOCATION' }>;

const orderedActions = (strategy: QuestStrategyDefinition): readonly StrategyAction[] => (
  strategy.actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => left.action.sourceOrder - right.action.sourceOrder || left.index - right.index)
    .map(({ action }) => action)
);

const actionIsDirectlyProven = (
  action: StrategyAction,
  input: RuneProofCoachInput,
): boolean => {
  if (input.confirmedActionIds.has(action.id)) return true;
  if (input.completedQuestIds.has(input.strategy.questId)) return true;

  switch (action.coach.completion.kind) {
    case 'MANUAL':
      return false;
    case 'ITEM_CONFIRMED':
      return input.confirmedItemKeys.has(action.coach.completion.itemKey);
    case 'QUEST_COMPLETED':
      return input.completedQuestIds.has(action.coach.completion.questId);
  }
};

const completeActions = (
  ordered: readonly StrategyAction[],
  input: RuneProofCoachInput,
): ReadonlySet<string> => {
  const actionById = new Map(ordered.map(action => [action.id, action]));
  const completed = new Set(ordered
    .filter(action => actionIsDirectlyProven(action, input))
    .map(action => action.id));

  const closeDependencies = (actionId: string): void => {
    const action = actionById.get(actionId);
    if (!action) return;

    action.dependsOn.forEach((dependencyId) => {
      if (completed.has(dependencyId)) return;
      completed.add(dependencyId);
      closeDependencies(dependencyId);
    });
  };

  [...completed].forEach(closeDependencies);
  return completed;
};

const previousCompletedOrigin = (
  ordered: readonly StrategyAction[],
  completed: ReadonlySet<string>,
  primaryActionId: string | undefined,
  evaluatedById: ReadonlyMap<string, EvaluatedWalkthroughAction>,
): ChunkKey | undefined => {
  const primaryIndex = primaryActionId === undefined
    ? ordered.length
    : ordered.findIndex(action => action.id === primaryActionId);

  for (let index = primaryIndex - 1; index >= 0; index -= 1) {
    const action = ordered[index];
    if (!completed.has(action.id)) continue;

    const location = evaluatedById.get(action.id)?.location;
    if (
      (location?.confidence === 'EXACT' || location?.confidence === 'REVIEWED')
      && location.chunks[0]
    ) {
      return location.chunks[0];
    }
  }

  return undefined;
};

const instructionLocationLabel = (instruction: string): string | undefined => {
  const match = /\b(?:outside|in|at|from)\s+(?:the\s+)?(.+?)(?=\s+and\b|[.!?]|$)/i.exec(instruction);
  const label = match?.[1]?.trim();
  return label || undefined;
};

const locationLabelFor = (
  action: StrategyAction,
): string | undefined => {
  const instructionLabel = instructionLocationLabel(action.displayText);
  if (instructionLabel) return instructionLabel;
  if (action.location.kind === 'REVIEWED_ALIAS') return action.location.alias;
  return undefined;
};

const preferredMethodLabelFor = (
  action: StrategyAction,
): string | undefined => {
  const method = action.coach.preferredMethod;
  if (!method) return undefined;
  if (method.kind === 'DIRECT_SOURCE') return method.sourceLabel;
  return instructionLocationLabel(action.displayText) ?? locationLabelFor(action);
};

const isKnownBlocker = (blocker: WalkthroughBlocker): blocker is KnownBlocker => (
  blocker.kind === 'CHUNK' || blocker.kind === 'GATE' || blocker.kind === 'ITEM'
);

const directBlockersFor = (
  evaluatedAction: EvaluatedWalkthroughAction | undefined,
): readonly KnownBlocker[] => evaluatedAction?.blockers.filter(isKnownBlocker) ?? [];

const needsConfirmation = (evaluatedAction: EvaluatedWalkthroughAction | undefined): boolean => (
  evaluatedAction === undefined
  || evaluatedAction.state === 'LOCATION_NEEDS_REVIEW'
  || evaluatedAction.state === 'ITEM_EVIDENCE_INCOMPLETE'
  || evaluatedAction.blockers.some(blocker => blocker.kind === 'LOCATION')
);

const blockerTextFor = (
  blocker: KnownBlocker,
  action: StrategyAction,
): string => {
  switch (blocker.kind) {
    case 'CHUNK': {
      const methodLabel = preferredMethodLabelFor(action)
        ?? locationLabelFor(action);
      return methodLabel
        ? `Unlock chunk ${blocker.chunk} to use ${methodLabel}.`
        : `Unlock chunk ${blocker.chunk} before this step.`;
    }
    case 'GATE':
      return `${blocker.label} is required before this step.`;
    case 'ITEM':
      return `Get ${blocker.label} before this step.`;
  }
};

const stateFor = (
  isPrimary: boolean,
  evaluatedAction: EvaluatedWalkthroughAction | undefined,
): RuneProofCoachActionState => {
  if (!isPrimary) return 'AVAILABLE_NEXT';
  if (directBlockersFor(evaluatedAction).length > 0) return 'BLOCKED';
  if (needsConfirmation(evaluatedAction)) return 'NEEDS_CONFIRMATION';
  return 'DO_NOW';
};

const confirmationAllowedFor = (
  action: StrategyAction,
  completed: ReadonlySet<string>,
  blockers: readonly KnownBlocker[],
  isPrimary: boolean,
): boolean => {
  if (completed.has(action.id) || blockers.length > 0) return false;
  if (!action.dependsOn.every(dependencyId => completed.has(dependencyId))) return false;
  if (isPrimary) return true;
  return action.coach.completion.kind === 'ITEM_CONFIRMED';
};

const mutableFallbackRoute = (route: DeepReadonly<ItemRoute>): ItemRoute => ({
  ...route,
  item: { ...route.item },
  chunks: [...route.chunks],
  steps: route.steps.map(step => ({
    ...step,
    gates: step.gates.map(gate => ({ ...gate })),
    blockers: step.blockers?.map(blocker => ({ ...blocker })),
  })),
  blockers: route.blockers.map(blocker => ({ ...blocker })),
});

const normalizedPresentationValue = (value: string | undefined): string => (
  value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB') ?? ''
);

const alternativeRouteSignature = (route: PresentedRoute): string => JSON.stringify([
  normalizedPresentationValue(route.label),
  normalizedPresentationValue(route.sourceKind),
  route.deterministic,
  normalizedPresentationValue(route.probabilityText),
  route.requiresChunkUnlock,
  [...route.blockers]
    .map(blocker => [
      normalizedPresentationValue(blocker.category),
      normalizedPresentationValue(blocker.label),
    ])
    .sort((left, right) => (
      left[0].localeCompare(right[0], 'en-GB')
      || left[1].localeCompare(right[1], 'en-GB')
    )),
  normalizedPresentationValue(route.dataNote),
]);

const coalesceAlternativeRoutes = (
  rankedRoutes: readonly PresentedRoute[],
): readonly RuneProofAlternativeRoute[] => {
  const groups = new Map<string, { readonly route: PresentedRoute; count: number }>();

  rankedRoutes.forEach((route) => {
    const signature = alternativeRouteSignature(route);
    const existing = groups.get(signature);
    if (existing) {
      existing.count += 1;
      return;
    }
    groups.set(signature, { route, count: 1 });
  });

  return [...groups.values()].map(({ route, count }, index) => ({
    ...route,
    isBest: index === 0,
    variantCount: count,
  }));
};

const alternativeSourcesFor = (
  ordered: readonly StrategyAction[],
  analysis: RuneProofRouteAnalysis,
  connectGraph: ConnectGraph | undefined,
  origin: ChunkKey | undefined,
): readonly RuneProofAlternativeSourceGroup[] => {
  const eligibleItems: { readonly key: string; readonly name: string }[] = [];
  const eligibleItemKeys = new Set<string>();
  ordered.forEach((action) => {
    if (action.coach.fallbackPolicy === 'NONE') return;
    action.coach.fulfils.forEach(({ item }) => {
      if (eligibleItemKeys.has(item.key)) return;
      eligibleItemKeys.add(item.key);
      eligibleItems.push({ key: item.key, name: item.name });
    });
  });

  // Presentation only reads item routes, which both analysis shapes carry. A full
  // walkthrough analysis is used separately when it is available for action proof.
  const presented = presentQuestAnalysis(analysis as Parameters<typeof presentQuestAnalysis>[0]);
  const routesByItemKey = new Map<string, {
    readonly routeIds: Set<string>;
    readonly routes: ItemRoute[];
    readonly presentedRoutesById: Map<string, PresentedRoute>;
  }>();

  analysis.items.forEach((item, index) => {
    if (item.requirement.supplyPolicy !== 'PLAYER_OBTAINED') return;
    const itemKey = item.requirement.item.key;
    if (!eligibleItemKeys.has(itemKey)) return;

    const presentedRoutesById = new Map<string, PresentedRoute>();
    (presented.items[index]?.routes ?? []).forEach((route) => {
      if (!presentedRoutesById.has(route.id)) presentedRoutesById.set(route.id, route);
    });
    const group = routesByItemKey.get(itemKey) ?? {
      routeIds: new Set<string>(),
      routes: [],
      presentedRoutesById: new Map<string, PresentedRoute>(),
    };
    // Presenter route IDs are stable identities, so they safely deduplicate merged evidence.
    [...item.currentRoutes, ...item.missingChunkRoutes]
      .map(mutableFallbackRoute)
      .forEach((route) => {
        if (group.routeIds.has(route.id)) return;
        const presentedRoute = presentedRoutesById.get(route.id);
        if (!presentedRoute) return;
        group.routeIds.add(route.id);
        group.routes.push(route);
        group.presentedRoutesById.set(route.id, presentedRoute);
      });
    routesByItemKey.set(itemKey, group);
  });

  return eligibleItems.flatMap(({ key, name }) => {
    const group = routesByItemKey.get(key);
    const rankedRoutes = group && rankFallbackRoutes(group.routes, connectGraph, { origin })
      .map(route => group.presentedRoutesById.get(route.id))
      .filter((route): route is PresentedRoute => route !== undefined);
    const routes = rankedRoutes && coalesceAlternativeRoutes(rankedRoutes);
    return routes?.length ? [{
      itemKey: key,
      itemName: name,
      routes,
    }] : [];
  });
};

const walkthroughFor = (
  analysis: RuneProofRouteAnalysis,
): QuestWalkthroughAnalysis | undefined => (
  'walkthrough' in analysis ? analysis.walkthrough : undefined
);

const recommendationReasonFor = (
  nextAction: RuneProofCoachAction | undefined,
): string => {
  if (!nextAction) return 'This reviewed quest is complete.';
  if (nextAction.state === 'BLOCKED') {
    return 'Recommended because this quest has a clear next unblock step.';
  }
  if (nextAction.state === 'NEEDS_CONFIRMATION') {
    return 'Recommended because its reviewed route needs confirmation before continuing.';
  }
  return 'Recommended because this local quest is ready with your current unlocks.';
};

/** Projects reviewed quest strategy, independent route evidence, and bounded progress into one coach model. */
export function buildRuneProofCoachModel(input: RuneProofCoachInput): RuneProofCoachModel {
  const ordered = orderedActions(input.strategy);
  const completed = completeActions(ordered, input);
  const walkthrough = walkthroughFor(input.analysis);
  const evaluatedById = new Map(
    walkthrough?.actions.map(action => [action.definition.id, action]) ?? [],
  );
  const primaryActionId = ordered.find(action => !completed.has(action.id))?.id;
  const alternativeOrigin = previousCompletedOrigin(
    ordered,
    completed,
    primaryActionId,
    evaluatedById,
  );

  const actions = ordered.map((action): RuneProofCoachAction => {
    const evaluatedAction = evaluatedById.get(action.id);
    const isPrimary = action.id === primaryActionId;
    const state = completed.has(action.id)
      ? 'COMPLETED'
      : stateFor(isPrimary, evaluatedAction);
    const blockers = directBlockersFor(evaluatedAction);

    return {
      id: action.id,
      instruction: action.displayText,
      state,
      locationLabel: locationLabelFor(action),
      mapChunks: [...(evaluatedAction?.location.chunks ?? [])],
      blockerText: state === 'BLOCKED' && blockers[0]
        ? blockerTextFor(blockers[0], action)
        : undefined,
      preferredMethodLabel: preferredMethodLabelFor(action),
      confirmationAllowed: confirmationAllowedFor(action, completed, blockers, isPrimary),
      confirmationLabel: action.coach.completion.kind === 'QUEST_COMPLETED'
        ? 'Confirm quest complete'
        : undefined,
    };
  });
  const nextAction = primaryActionId === undefined
    ? undefined
    : actions.find(action => action.id === primaryActionId);

  return {
    questId: input.strategy.questId,
    recommendationReason: recommendationReasonFor(nextAction),
    progress: { completed: completed.size, total: ordered.length },
    nextAction,
    actions,
    alternativeSources: alternativeSourcesFor(
      ordered,
      input.analysis,
      input.connectGraph,
      alternativeOrigin,
    ),
    mainJourneyText: ordered.map(action => action.displayText).join(' '),
    proof: {
      source: walkthrough?.source ?? input.strategy.source,
      sourceLines: walkthrough?.sourceLines ?? input.strategy.sourceLines,
      diagnostics: input.analysis.items.flatMap(item => item.dataNotes),
    },
  };
}
