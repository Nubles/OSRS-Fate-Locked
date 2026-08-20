import type { RuneProofRouteAnalysis } from '../questRoutes/analyzeQuest';
import type { ChunkKey } from '../questRoutes/model';
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
}

export interface RuneProofAlternativeSourceGroup {
  readonly itemKey: string;
  readonly itemName: string;
  readonly routes: readonly PresentedRoute[];
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

const instructionLocationLabel = (instruction: string): string | undefined => {
  const match = /\b(?:outside|in|at|from)\s+(?:the\s+)?(.+?)(?=\s+and\b|[.!?]|$)/i.exec(instruction);
  const label = match?.[1]?.trim();
  return label || undefined;
};

const locationLabelFor = (
  action: StrategyAction,
  evaluatedAction: EvaluatedWalkthroughAction | undefined,
): string | undefined => {
  const instructionLabel = instructionLocationLabel(action.displayText);
  if (instructionLabel) return instructionLabel;
  if (action.location.kind === 'REVIEWED_ALIAS') return action.location.alias;
  return evaluatedAction?.location.explanation || undefined;
};

const preferredMethodLabelFor = (
  action: StrategyAction,
  evaluatedAction: EvaluatedWalkthroughAction | undefined,
): string | undefined => {
  const method = action.coach.preferredMethod;
  if (!method) return undefined;
  if (method.kind === 'DIRECT_SOURCE') return method.sourceLabel;
  return instructionLocationLabel(action.displayText) ?? locationLabelFor(action, evaluatedAction);
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
  evaluatedAction: EvaluatedWalkthroughAction | undefined,
): string => {
  switch (blocker.kind) {
    case 'CHUNK': {
      const methodLabel = preferredMethodLabelFor(action, evaluatedAction)
        ?? locationLabelFor(action, evaluatedAction);
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

const alternativeSourcesFor = (
  ordered: readonly StrategyAction[],
  analysis: RuneProofRouteAnalysis,
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
    readonly routes: PresentedRoute[];
  }>();

  analysis.items.forEach((item, index) => {
    if (item.requirement.supplyPolicy !== 'PLAYER_OBTAINED') return;
    const itemKey = item.requirement.item.key;
    if (!eligibleItemKeys.has(itemKey)) return;

    const routes = presented.items[index]?.routes ?? [];
    const group = routesByItemKey.get(itemKey) ?? {
      routeIds: new Set<string>(),
      routes: [],
    };
    // Presenter route IDs are stable identities, so they safely deduplicate merged evidence.
    routes.forEach((route) => {
      if (group.routeIds.has(route.id)) return;
      group.routeIds.add(route.id);
      group.routes.push(route);
    });
    routesByItemKey.set(itemKey, group);
  });

  return eligibleItems.flatMap(({ key, name }) => {
    const group = routesByItemKey.get(key);
    return group?.routes.length ? [{
      itemKey: key,
      itemName: name,
      routes: [...group.routes],
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

  const actions = ordered.map((action): RuneProofCoachAction => {
    const evaluatedAction = evaluatedById.get(action.id);
    const state = completed.has(action.id)
      ? 'COMPLETED'
      : stateFor(action.id === primaryActionId, evaluatedAction);
    const blockers = directBlockersFor(evaluatedAction);

    return {
      id: action.id,
      instruction: action.displayText,
      state,
      locationLabel: locationLabelFor(action, evaluatedAction),
      mapChunks: [...(evaluatedAction?.location.chunks ?? [])],
      blockerText: state === 'BLOCKED' && blockers[0]
        ? blockerTextFor(blockers[0], action, evaluatedAction)
        : undefined,
      preferredMethodLabel: preferredMethodLabelFor(action, evaluatedAction),
      confirmationAllowed: action.coach.completion.kind === 'MANUAL' || state === 'NEEDS_CONFIRMATION',
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
    alternativeSources: alternativeSourcesFor(ordered, input.analysis),
    mainJourneyText: ordered.map(action => action.displayText).join(' '),
    proof: {
      source: walkthrough?.source ?? input.strategy.source,
      sourceLines: walkthrough?.sourceLines ?? input.strategy.sourceLines,
      diagnostics: input.analysis.items.flatMap(item => item.dataNotes),
    },
  };
}
