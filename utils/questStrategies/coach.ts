import type { DeepReadonly, RuneProofRouteAnalysis } from '../questRoutes/analyzeQuest';
import type { ConnectGraph } from '../../services/ChunkContentService';
import type { ChunkKey, ItemRoute } from '../questRoutes/model';
import { placeOf } from '../chunkLocations';
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
import {
  activeRuneProofConfirmations,
  rankRuneProofBranches,
  resolveRuneProofBranch,
  type RuneProofBranchEvaluation,
  type ResolvedRuneProofBranch,
} from './branches';
import { replayRuneProofConfirmedItemLedger } from './itemLedger';
import {
  requirementAll,
  type RequirementExpression,
  type ReviewedLocationReference,
  type RuneProofAction,
  type RuneProofBranch,
  type RuneProofCompiledPack,
  type RuneProofProofState,
} from './packModel';
import {
  isRuneProofActionComplete,
  isRuneProofRouteComplete,
  selectRuneProofManualObligations,
  type RuneProofQuestProgressV2,
} from './progress';
import {
  evaluateRequirementExpression,
  type RuneProofRequirementResult,
  type RuneProofRequirementSnapshot,
} from './requirements';

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
  hasAvailableAlternative: boolean,
): RuneProofCoachActionState => {
  if (!isPrimary) return 'AVAILABLE_NEXT';
  if (directBlockersFor(evaluatedAction).length > 0 && !hasAvailableAlternative) return 'BLOCKED';
  if (needsConfirmation(evaluatedAction)) return 'NEEDS_CONFIRMATION';
  return 'DO_NOW';
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

const availableAlternativeFor = (
  action: StrategyAction,
  analysis: RuneProofRouteAnalysis,
  connectGraph: ConnectGraph | undefined,
  origin: ChunkKey | undefined,
): ItemRoute | undefined => {
  if (
    action.coach.completion.kind !== 'ITEM_CONFIRMED'
    || action.coach.fallbackPolicy !== 'INTERCHANGEABLE'
  ) return undefined;

  const itemKey = action.coach.completion.itemKey;
  const fulfilledQuantity = action.coach.fulfils
    .filter(item => item.item.key === itemKey)
    .reduce((total, item) => total + item.quantity, 0);
  if (fulfilledQuantity <= 0) return undefined;

  const candidates = analysis.items.flatMap(item => (
    item.requirement.item.key === itemKey
      && item.requirement.supplyPolicy === 'PLAYER_OBTAINED'
      ? item.currentRoutes
        .filter(route => (
          route.item.key === itemKey
          && route.outputQuantity >= fulfilledQuantity
          && route.blockers.length === 0
          && !route.hasDataGap
        ))
        .map(mutableFallbackRoute)
      : []
  ));

  return rankFallbackRoutes(candidates, connectGraph, { origin })[0];
};

const promotedLocationLabel = (route: ItemRoute): string | undefined => {
  const chunk = route.chunks[0];
  if (!chunk) return undefined;
  const [cx, cy] = chunk.split(',').map(Number);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return `chunk ${chunk}`;
  return placeOf(cx, cy).label.split(' · ')[0];
};

const promotedInstruction = (
  action: StrategyAction,
  route: ItemRoute,
): string => {
  const location = promotedLocationLabel(route) ?? `chunk ${route.chunks[0]}`;
  if (route.sourceKind === 'DROP' && action.displayText.toLocaleLowerCase('en-GB').includes('imps')) {
    const itemName = route.item.name.toLocaleLowerCase('en-GB');
    return `Kill imps in ${location} until you obtain a ${itemName}.`;
  }
  return `Obtain ${route.item.name} from ${route.sourceLabel} in ${location}.`;
};

const confirmationAllowedFor = (
  action: StrategyAction,
  completed: ReadonlySet<string>,
  blockers: readonly KnownBlocker[],
  isPrimary: boolean,
  hasAvailableAlternative: boolean,
): boolean => {
  if (completed.has(action.id) || (blockers.length > 0 && !hasAvailableAlternative)) return false;
  if (!action.dependsOn.every(dependencyId => completed.has(dependencyId))) return false;
  if (isPrimary) return true;
  return action.coach.completion.kind === 'ITEM_CONFIRMED';
};

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
    const availableAlternative = availableAlternativeFor(
      action,
      input.analysis,
      input.connectGraph,
      alternativeOrigin,
    );
    const blockers = directBlockersFor(evaluatedAction);
    const useAvailableAlternative = blockers.length > 0 && availableAlternative !== undefined;
    const state = completed.has(action.id)
      ? 'COMPLETED'
      : stateFor(isPrimary, evaluatedAction, useAvailableAlternative);

    return {
      id: action.id,
      instruction: useAvailableAlternative
        ? promotedInstruction(action, availableAlternative)
        : action.displayText,
      state,
      locationLabel: useAvailableAlternative
        ? promotedLocationLabel(availableAlternative)
        : locationLabelFor(action),
      mapChunks: useAvailableAlternative
        ? [...availableAlternative.chunks]
        : [...(evaluatedAction?.location.chunks ?? [])],
      blockerText: state === 'BLOCKED' && blockers[0]
        ? blockerTextFor(blockers[0], action)
        : undefined,
      preferredMethodLabel: useAvailableAlternative
        ? availableAlternative.sourceLabel
        : preferredMethodLabelFor(action),
      confirmationAllowed: confirmationAllowedFor(
        action,
        completed,
        blockers,
        isPrimary,
        availableAlternative !== undefined,
      ),
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

export const buildLegacyRuneProofCoachModel = buildRuneProofCoachModel;

export interface RuneProofPackCoachInput {
  readonly pack: RuneProofCompiledPack;
  readonly progress: RuneProofQuestProgressV2;
  readonly requirementSnapshot: RuneProofRequirementSnapshot;
  readonly completedQuestIds: ReadonlySet<string>;
  readonly legacyProjection?: Readonly<{
    strategy: QuestStrategyDefinition;
    analysis: RuneProofRouteAnalysis;
    connectGraph?: ConnectGraph;
  }>;
}

export interface RuneProofCoachBranchModel {
  readonly selectedBranchId?: string;
  readonly recommendedBranchId?: string;
  readonly recommendationReason: string;
  readonly pinned: boolean;
  readonly options: readonly RuneProofBranchOptionModel[];
}

export interface RuneProofBranchOptionModel {
  readonly id: string;
  readonly label: string;
  readonly state: 'READY' | 'CONFIRM' | 'BLOCKED' | 'NEEDS_REVIEW';
  readonly evidenceComplete: boolean;
  readonly recommended: boolean;
  readonly recommendationReason: string;
  readonly selected: boolean;
  readonly pinned: boolean;
  readonly progress: Readonly<{ completed: number; total: number }>;
  readonly switchConsequence: Readonly<{
    sharedRetained: number;
    inactive: number;
    reactivated: number;
  }>;
}

export interface RuneProofCombatReadinessModel {
  readonly actionId: string;
  readonly id: string;
  readonly title: string;
  readonly encounterSummary: string;
  readonly phases: readonly string[];
  readonly mandatoryMechanics: readonly string[];
  readonly recommendedCapabilities: readonly string[];
  readonly recommendedSupplies: readonly string[];
  readonly deathEscapeReentryNotes: readonly string[];
  readonly deterministicBlockers: readonly string[];
  readonly confirmationId: string;
  readonly confirmed: boolean;
}

export interface RuneProofReviewedAlternativeModel {
  readonly id: string;
  readonly label: string;
  readonly state: 'READY' | 'CONFIRM' | 'BLOCKED' | 'NEEDS_REVIEW';
  readonly blockerReasons: readonly string[];
  readonly unblockActions: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly reviewedLocation?: RuneProofCoachLocationModel;
  readonly manualConfirmations: readonly RuneProofManualConfirmationModel[];
}

export interface RuneProofManualConfirmationModel {
  readonly id: string;
  readonly prompt: string;
  readonly scopes: readonly ('PREFLIGHT' | 'BRANCH' | 'ACTION' | 'ALTERNATIVE')[];
  readonly evidenceIds: readonly string[];
  readonly confirmed: boolean;
}

export interface RuneProofInitialItemOptionModel {
  readonly itemKey: string;
  readonly label: string;
  readonly confirmed: boolean;
}

export interface RuneProofInitialItemModel {
  readonly canonicalItemKey: string;
  readonly label: string;
  readonly quantity: number;
  readonly provenQuantity: number;
  readonly evidenceIds: readonly string[];
  readonly options: readonly RuneProofInitialItemOptionModel[];
}

export type RuneProofCoachCompletionTarget =
  | { readonly kind: 'ACTION'; readonly id: string }
  | { readonly kind: 'ITEM'; readonly id: string }
  | { readonly kind: 'MANUAL'; readonly id: string }
  | { readonly kind: 'CHECKPOINT'; readonly id: string };

export type RuneProofCoachLocationModel =
  | {
      readonly kind: 'SURFACE';
      readonly label: string;
      readonly plane: number;
      readonly mapChunks: readonly ChunkKey[];
    }
  | {
      readonly kind: 'INSTANCE';
      readonly label: string;
      readonly instanceId: string;
      readonly plane: number;
      readonly entranceChunks: readonly ChunkKey[];
      readonly mapChunks: readonly ChunkKey[];
    };

export type RuneProofPackCoachAction = RuneProofCoachAction & {
  readonly current: boolean;
  readonly completionTarget: RuneProofCoachCompletionTarget;
  readonly reviewedLocation: RuneProofCoachLocationModel;
  readonly unblockActions: readonly string[];
  readonly requirementAdvisories: readonly string[];
};

export interface RuneProofConfirmationProjection {
  readonly actionIds: readonly string[];
  readonly itemKeys: readonly string[];
  readonly manualIds: readonly string[];
  readonly checkpointIds: readonly string[];
}

export interface RuneProofPackCoachModel {
  readonly questId: string;
  readonly proofState: RuneProofProofState;
  readonly branch: RuneProofCoachBranchModel;
  readonly progress: Readonly<{
    completed: number;
    total: number;
    activeConfirmations: RuneProofConfirmationProjection;
    inactiveConfirmations: RuneProofConfirmationProjection;
  }>;
  readonly doNow?: RuneProofPackCoachAction;
  readonly actions: readonly RuneProofPackCoachAction[];
  readonly initialItems: readonly RuneProofInitialItemModel[];
  readonly manualConfirmations: readonly RuneProofManualConfirmationModel[];
  readonly currentCombatCards: readonly RuneProofCombatReadinessModel[];
  readonly reviewedAlternatives: readonly RuneProofReviewedAlternativeModel[];
  readonly alternativeSources: readonly RuneProofAlternativeSourceGroup[];
  readonly mainJourneyText: string;
  readonly proof: Readonly<{
    sources: RuneProofCompiledPack['sources'];
    evidence: RuneProofCompiledPack['evidence'];
    diagnostics: readonly string[];
  }>;
}

type ActiveConfirmations = ReturnType<typeof activeRuneProofConfirmations>;
type ManualScope = RuneProofManualConfirmationModel['scopes'][number];

interface RuneProofRouteEvidence {
  readonly ordered: readonly RuneProofAction[];
  readonly activeConfirmed: ActiveConfirmations;
  readonly activeProgress: RuneProofQuestProgressV2;
  readonly completedActionIds: ReadonlySet<string>;
  readonly snapshot: RuneProofRequirementSnapshot;
}

const compareIds = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

const detachedRequirementAll = (
  ...requirements: readonly RequirementExpression[]
): Extract<RequirementExpression, { kind: 'ALL' }> => (
  requirementAll(...structuredClone(requirements))
);

const stableUniqueStrings = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  return values.filter(value => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const normalizedRequirementState = (
  result: RuneProofRequirementResult,
): Exclude<RuneProofProofState, 'COMPLETE'> => (
  result.state === 'COMPLETE' ? 'READY' : result.state
);

const toBranchEvaluation = (
  result: RuneProofRequirementResult,
): RuneProofBranchEvaluation => ({
  state: normalizedRequirementState(result),
  evidenceComplete: result.unresolvedEvidenceIds.length === 0,
});

const activeProgressFor = (
  progress: RuneProofQuestProgressV2,
  branchId: string,
  active: ActiveConfirmations,
): RuneProofQuestProgressV2 => ({
  ...progress,
  selectedBranchId: branchId,
  confirmedActionIds: [...active.actionIds],
  confirmedItemKeys: [...active.itemKeys],
  manualConfirmationIds: [...active.manualIds],
  confirmedCheckpointIds: [...active.checkpointIds],
});

const itemAliasesFor = (
  pack: RuneProofCompiledPack,
): Readonly<Record<string, string>> => Object.fromEntries(
  pack.initialItems.flatMap(root => (
    root.alternatives?.map(alternative => [alternative.key, root.item.key] as const) ?? []
  )),
);

const withActiveRouteProgress = (input: {
  readonly base: RuneProofRequirementSnapshot;
  readonly pack: RuneProofCompiledPack;
  readonly branch: RuneProofBranch;
  readonly ordered: readonly RuneProofAction[];
  readonly activeConfirmed: ActiveConfirmations;
  readonly progress: RuneProofQuestProgressV2;
}): RuneProofRouteEvidence => {
  const activeProgress = activeProgressFor(
    input.progress,
    input.branch.id,
    input.activeConfirmed,
  );
  const completedActionIds = new Set(input.ordered
    .filter(candidate => isRuneProofActionComplete(candidate, activeProgress))
    .map(candidate => candidate.id));
  const itemQuantities = replayRuneProofConfirmedItemLedger({
    initialItems: input.pack.initialItems,
    actions: input.ordered,
    confirmedInitialItemKeys: input.activeConfirmed.itemKeys,
    completedActionIds,
  });
  return {
    ordered: input.ordered,
    activeConfirmed: input.activeConfirmed,
    activeProgress,
    completedActionIds,
    snapshot: {
      ...input.base,
      observedCanonicalCompletion: false,
      selectedBranchId: input.branch.id,
      confirmedManualIds: input.activeConfirmed.manualIds,
      branchCheckpointIds: input.activeConfirmed.checkpointIds,
      itemAliases: itemAliasesFor(input.pack),
      itemQuantities,
    },
  };
};

const confirmationProjection = (
  progress: RuneProofQuestProgressV2,
  active: ActiveConfirmations,
  includeActive: boolean,
): RuneProofConfirmationProjection => {
  const keep = (id: string, values: ReadonlySet<string>): boolean => (
    includeActive ? values.has(id) : !values.has(id)
  );
  return {
    actionIds: progress.confirmedActionIds.filter(id => keep(id, active.actionIds)),
    itemKeys: progress.confirmedItemKeys.filter(id => keep(id, active.itemKeys)),
    manualIds: progress.manualConfirmationIds.filter(id => keep(id, active.manualIds)),
    checkpointIds: progress.confirmedCheckpointIds.filter(id => keep(id, active.checkpointIds)),
  };
};

const namespacedProofIds = (active: ActiveConfirmations): ReadonlySet<string> => new Set([
  ...[...active.actionIds].map(id => `action:${id}`),
  ...[...active.itemKeys].map(id => `item:${id}`),
  ...[...active.manualIds].map(id => `manual:${id}`),
  ...[...active.checkpointIds].map(id => `checkpoint:${id}`),
]);

const switchConsequenceFor = (
  current: ActiveConfirmations,
  target: ActiveConfirmations,
): RuneProofBranchOptionModel['switchConsequence'] => {
  const currentIds = namespacedProofIds(current);
  const targetIds = namespacedProofIds(target);
  return {
    sharedRetained: [...currentIds].filter(id => targetIds.has(id)).length,
    inactive: [...currentIds].filter(id => !targetIds.has(id)).length,
    reactivated: [...targetIds].filter(id => !currentIds.has(id)).length,
  };
};

const reviewedLocationFor = (
  location: ReviewedLocationReference,
): RuneProofCoachLocationModel => location.kind === 'SURFACE'
  ? {
      kind: 'SURFACE',
      label: location.label,
      plane: location.plane,
      mapChunks: [...location.chunks],
    }
  : {
      kind: 'INSTANCE',
      label: location.label,
      instanceId: location.instanceId,
      plane: location.plane,
      entranceChunks: [...location.entranceChunks],
      mapChunks: [...location.entranceChunks],
    };

const completionTargetFor = (
  action: RuneProofAction,
): RuneProofCoachCompletionTarget => {
  switch (action.completion.kind) {
    case 'ACTION_CONFIRMED':
    case 'CANONICAL_QUEST_COMPLETED':
      return { kind: 'ACTION', id: action.id };
    case 'ITEM_CONFIRMED':
      return { kind: 'ITEM', id: action.completion.itemKey };
    case 'MANUAL':
      return { kind: 'MANUAL', id: action.completion.confirmationId };
    case 'BRANCH_CHECKPOINT':
      return { kind: 'CHECKPOINT', id: action.completion.checkpointId };
  }
};

const manualConfirmationsFor = (
  entries: readonly Readonly<{
    expression: RequirementExpression;
    scope: ManualScope;
  }>[],
  confirmedIds: ReadonlySet<string>,
  activeEntries: readonly Readonly<{
    expression: RequirementExpression;
    scope: ManualScope;
  }>[] = entries,
): readonly RuneProofManualConfirmationModel[] => {
  const models = new Map<string, {
    id: string;
    prompt: string;
    scopes: ManualScope[];
    evidenceIds: readonly string[];
    confirmed: boolean;
  }>();
  activeEntries.forEach(({ expression, scope }) => {
    const selection = selectRuneProofManualObligations(expression, confirmedIds);
    selection.requirements.forEach(requirement => {
      const existing = models.get(requirement.confirmationId);
      if (existing) {
        if (!existing.scopes.includes(scope)) existing.scopes.push(scope);
        return;
      }
      models.set(requirement.confirmationId, {
        id: requirement.confirmationId,
        prompt: requirement.prompt,
        scopes: [scope],
        evidenceIds: [...requirement.evidenceIds],
        confirmed: confirmedIds.has(requirement.confirmationId),
      });
    });
  });
  const selectedIds = stableUniqueStrings(entries.flatMap(({ expression }) => (
    selectRuneProofManualObligations(expression, confirmedIds)
      .requirements.map(requirement => requirement.confirmationId)
  )));
  return selectedIds.flatMap(id => {
    const model = models.get(id);
    return model ? [model] : [];
  });
};

const initialItemsFor = (
  pack: RuneProofCompiledPack,
  active: ActiveConfirmations,
  quantities: Readonly<Record<string, number>>,
): readonly RuneProofInitialItemModel[] => pack.initialItems.map(root => ({
  canonicalItemKey: root.item.key,
  label: root.item.name,
  quantity: root.quantity,
  provenQuantity: quantities[root.item.key] ?? 0,
  evidenceIds: [...root.evidenceIds],
  options: [root.item, ...(root.alternatives ?? [])].map(option => ({
    itemKey: option.key,
    label: option.name,
    confirmed: active.itemKeys.has(option.key),
  })),
}));

const routeIsComplete = (
  pack: RuneProofCompiledPack,
  branch: RuneProofBranch,
  evidence: RuneProofRouteEvidence,
): boolean => isRuneProofRouteComplete(pack, branch, evidence.activeProgress);

const actionStateFor = (
  action: RuneProofAction,
  completed: boolean,
  current: boolean,
  proofState: RuneProofProofState,
): RuneProofCoachActionState => {
  if (completed || proofState === 'COMPLETE') return 'COMPLETED';
  if (!current) return 'AVAILABLE_NEXT';
  if (proofState === 'BLOCKED') return 'BLOCKED';
  if (proofState === 'CONFIRM' || proofState === 'NEEDS_REVIEW') {
    return 'NEEDS_CONFIRMATION';
  }
  return 'DO_NOW';
};

const packActionFor = (input: {
  readonly action: RuneProofAction;
  readonly completed: boolean;
  readonly current: boolean;
  readonly proofState: RuneProofProofState;
  readonly requirementResult?: RuneProofRequirementResult;
  readonly legacyAction?: RuneProofCoachAction;
}): RuneProofPackCoachAction => {
  const reviewedLocation = reviewedLocationFor(input.action.location);
  const useLegacyAlternative = Boolean(
    input.legacyAction
    && input.action.alternatives.some(alternative => (
      alternative.id === `legacy-alternative:${input.action.id}`
    )),
  );
  const currentFailure = input.current
    && (input.proofState === 'BLOCKED' || input.proofState === 'NEEDS_REVIEW');
  return {
    id: input.action.id,
    instruction: useLegacyAlternative
      ? input.legacyAction!.instruction
      : input.action.instruction,
    state: actionStateFor(
      input.action,
      input.completed,
      input.current,
      input.proofState,
    ),
    locationLabel: reviewedLocation.kind === 'INSTANCE'
      ? `${reviewedLocation.label} entrance`
      : useLegacyAlternative
        ? input.legacyAction?.locationLabel ?? reviewedLocation.label
        : reviewedLocation.label,
    mapChunks: useLegacyAlternative && input.legacyAction!.mapChunks.length > 0
      ? [...input.legacyAction!.mapChunks]
      : [...reviewedLocation.mapChunks],
    blockerText: currentFailure
      ? input.requirementResult?.reasons.join(' ')
      : undefined,
    preferredMethodLabel: useLegacyAlternative
      ? input.legacyAction?.preferredMethodLabel ?? input.action.preferredMethod?.label
      : input.action.preferredMethod?.label,
    confirmationAllowed: input.current
      && input.proofState !== 'BLOCKED'
      && input.proofState !== 'NEEDS_REVIEW'
      && input.proofState !== 'COMPLETE',
    confirmationLabel: input.action.completion.kind === 'CANONICAL_QUEST_COMPLETED'
      ? 'Confirm quest complete'
      : undefined,
    current: input.current,
    completionTarget: completionTargetFor(input.action),
    reviewedLocation,
    unblockActions: input.current
      ? [...(input.requirementResult?.unblockActions ?? [])]
      : [],
    requirementAdvisories: input.current
      ? [...(input.requirementResult?.advisories ?? [])]
      : [],
  };
};

const combatCardFor = (
  action: RuneProofAction,
  active: ActiveConfirmations,
  deterministicBlockers: readonly string[],
): RuneProofCombatReadinessModel | undefined => {
  const combat = action.combat;
  if (!combat) return undefined;
  return {
    actionId: action.id,
    id: combat.id,
    title: combat.encounter,
    encounterSummary: combat.encounter,
    phases: [...combat.phases],
    mandatoryMechanics: [...combat.mandatoryMechanics],
    recommendedCapabilities: [...combat.equipmentCapabilities],
    recommendedSupplies: [...combat.recommendedSupplies],
    deathEscapeReentryNotes: [combat.deathAndEscape, combat.reentry],
    deterministicBlockers,
    confirmationId: combat.confirmationId,
    confirmed: active.manualIds.has(combat.confirmationId),
  };
};

const atomicRequirementsFor = (
  expression: RequirementExpression,
): readonly Exclude<RequirementExpression, { kind: 'ALL' | 'ANY' }>[] => (
  expression.kind === 'ALL' || expression.kind === 'ANY'
    ? expression.requirements.flatMap(atomicRequirementsFor)
    : [expression]
);

const deterministicRequirementBlockersFor = (
  expression: RequirementExpression,
  snapshot: RuneProofRequirementSnapshot,
): readonly string[] => {
  const selected = evaluateRequirementExpression(expression, snapshot);
  const selectedBlockerIds = new Set(selected.blockerIds);
  return stableUniqueStrings(atomicRequirementsFor(expression).flatMap(requirement => {
    if (!selectedBlockerIds.has(requirement.id)) return [];
    const atomic = evaluateRequirementExpression(requirement, snapshot);
    return normalizedRequirementState(atomic) === 'BLOCKED' ? atomic.reasons : [];
  }));
};

const combatEvidenceDiagnosticFor = (
  pack: RuneProofCompiledPack,
  action: RuneProofAction,
): string | undefined => {
  if (!action.combat) return undefined;
  if (!Array.isArray(action.combat.evidenceIds) || action.combat.evidenceIds.length === 0) {
    return `Combat action "${action.id}" has no reviewed evidence IDs.`;
  }
  const knownEvidenceIds = new Set(pack.evidence.map(value => value.id));
  const missingEvidenceIds = stableUniqueStrings(
    action.combat.evidenceIds.filter(id => !knownEvidenceIds.has(id)),
  );
  return missingEvidenceIds.length > 0
    ? `Combat action "${action.id}" references missing evidence: ${missingEvidenceIds.join(', ')}.`
    : undefined;
};

const combatEvidenceComplete = (
  pack: RuneProofCompiledPack,
  action: RuneProofAction,
): boolean => combatEvidenceDiagnosticFor(pack, action) === undefined;

const reviewedAlternativesFor = (
  action: RuneProofAction | undefined,
  snapshot: RuneProofRequirementSnapshot | undefined,
  active: ActiveConfirmations,
  activeManualEntries: readonly Readonly<{
    expression: RequirementExpression;
    scope: ManualScope;
  }>[],
): readonly RuneProofReviewedAlternativeModel[] => {
  if (!action || !snapshot) return [];
  return action.alternatives.map(alternative => {
    const result = evaluateRequirementExpression(alternative.requirements, snapshot);
    const state = normalizedRequirementState(result);
    return {
      id: alternative.id,
      label: alternative.label,
      state,
      blockerReasons: state === 'BLOCKED' || state === 'NEEDS_REVIEW'
        ? [...result.reasons]
        : [],
      unblockActions: [...result.unblockActions],
      evidenceIds: [...alternative.evidenceIds],
      reviewedLocation: alternative.location
        ? reviewedLocationFor(alternative.location)
        : undefined,
      manualConfirmations: manualConfirmationsFor([{
        expression: alternative.requirements,
        scope: 'ALTERNATIVE',
      }], active.manualIds, activeManualEntries),
    };
  });
};

const branchModelFor = (input: {
  readonly pack: RuneProofCompiledPack;
  readonly progress: RuneProofQuestProgressV2;
  readonly selection: ResolvedRuneProofBranch;
  readonly evaluations: Readonly<Record<string, RuneProofBranchEvaluation>>;
  readonly routeEvidence: ReadonlyMap<string, RuneProofRouteEvidence>;
}): RuneProofCoachBranchModel => {
  const ranked = rankRuneProofBranches({
    pack: input.pack,
    evaluations: input.evaluations,
  });
  const rankedById = new Map(ranked.map(value => [value.branchId, value]));
  const currentActive = activeRuneProofConfirmations({
    pack: input.pack,
    progress: input.progress,
    branchId: input.selection.branchId,
  });
  return {
    selectedBranchId: input.selection.branchId,
    recommendedBranchId: input.selection.recommendedBranchId,
    recommendationReason: ranked.find(value => value.recommended)?.recommendationReason
      ?? 'No reviewed route is currently playable.',
    pinned: input.selection.pinned,
    options: input.pack.branches.map(branch => {
      const evaluation = input.evaluations[branch.id] ?? {
        state: 'NEEDS_REVIEW' as const,
        evidenceComplete: false,
      };
      const rankedBranch = rankedById.get(branch.id);
      const evidence = input.routeEvidence.get(branch.id)!;
      const selected = branch.id === input.selection.branchId;
      return {
        id: branch.id,
        label: branch.label,
        state: evaluation.state,
        evidenceComplete: evaluation.evidenceComplete,
        recommended: rankedBranch?.recommended ?? false,
        recommendationReason: rankedBranch?.recommendationReason
          ?? 'Needs review before this route can be selected.',
        selected,
        pinned: selected && input.selection.pinned,
        progress: {
          completed: evidence.completedActionIds.size,
          total: evidence.ordered.length,
        },
        switchConsequence: switchConsequenceFor(
          currentActive,
          evidence.activeConfirmed,
        ),
      };
    }),
  };
};

const legacyProjectionFor = (
  input: RuneProofPackCoachInput,
  active: ActiveConfirmations,
  action: RuneProofAction | undefined,
): RuneProofCoachModel | undefined => {
  const projection = input.legacyProjection;
  if (!projection || !action) return undefined;
  if (
    projection.strategy.questId !== input.pack.questId
    || projection.analysis.questId !== input.pack.questId
  ) return undefined;
  if (
    'walkthrough' in projection.analysis
    && (
      projection.analysis.walkthrough.questId !== input.pack.questId
      || !projection.analysis.walkthrough.actions.some(candidate => (
        candidate.definition.id === action.id
      ))
    )
  ) return undefined;
  if (!projection.strategy.actions.some(candidate => candidate.id === action.id)) {
    return undefined;
  }
  if (!action.alternatives.some(alternative => (
    alternative.id === `legacy-alternative:${action.id}`
  ))) return undefined;
  const model = buildLegacyRuneProofCoachModel({
    ...projection,
    confirmedItemKeys: active.itemKeys,
    confirmedActionIds: active.actionIds,
    completedQuestIds: input.completedQuestIds,
  });
  return model.nextAction?.id === action.id && model.nextAction.state === 'DO_NOW'
    ? model
    : undefined;
};

/** Projects a compiled pack, isolated route proof, and V2 progress into one branch-aware coach. */
export function buildRuneProofPackCoachModel(
  input: RuneProofPackCoachInput,
): RuneProofPackCoachModel {
  const routeEvidence = new Map(input.pack.branches.map(branch => {
    const ordered = [...input.pack.sharedActions, ...branch.actions]
      .sort((left, right) => left.sourceOrder - right.sourceOrder
        || compareIds(left.id, right.id));
    const activeConfirmed = activeRuneProofConfirmations({
      pack: input.pack,
      progress: input.progress,
      branchId: branch.id,
    });
    const evidence = withActiveRouteProgress({
      base: input.requirementSnapshot,
      pack: input.pack,
      branch,
      ordered,
      activeConfirmed,
      progress: input.progress,
    });
    return [branch.id, evidence] as const;
  }));
  const branchResults = Object.fromEntries(input.pack.branches.map(branch => [
    branch.id,
    evaluateRequirementExpression(
      detachedRequirementAll(input.pack.preflight, branch.requirements),
      routeEvidence.get(branch.id)!.snapshot,
    ),
  ]));
  const branchEvaluations = Object.fromEntries(input.pack.branches.map(branch => [
    branch.id,
    toBranchEvaluation(branchResults[branch.id]),
  ]));
  const selection = resolveRuneProofBranch({
    pack: input.pack,
    evaluations: branchEvaluations,
    progress: input.progress,
  });
  const selectedBranch = selection.branchId === undefined
    ? undefined
    : input.pack.branches.find(value => value.id === selection.branchId);
  const selectedEvidence = selectedBranch
    ? routeEvidence.get(selectedBranch.id)
    : undefined;
  const fallbackActive = activeRuneProofConfirmations({
    pack: input.pack,
    progress: input.progress,
    branchId: selection.branchId,
  });
  const active = selectedEvidence?.activeConfirmed ?? fallbackActive;
  const canonicalComplete = input.completedQuestIds.has(input.pack.questId);
  const isolatedComplete = Boolean(
    selectedBranch
    && selectedEvidence
    && routeIsComplete(input.pack, selectedBranch, selectedEvidence),
  );
  const pinnedNeedsReview = Boolean(
    selectedBranch
    && branchEvaluations[selectedBranch.id]?.state === 'NEEDS_REVIEW',
  );
  const noPlayableRoute = selectedBranch === undefined;
  const ordered = selectedEvidence?.ordered ?? [];
  const currentAction = canonicalComplete || isolatedComplete || pinnedNeedsReview
    ? undefined
    : ordered.find(candidate => !selectedEvidence!.completedActionIds.has(candidate.id));
  const routeRequirementsOnly = Boolean(
    selectedBranch && selectedEvidence && !currentAction
    && !canonicalComplete && !isolatedComplete && !pinnedNeedsReview,
  );
  const coachRequirementExpression = selectedBranch
    ? currentAction
      ? detachedRequirementAll(
          input.pack.preflight,
          selectedBranch.requirements,
          currentAction.requirements,
        )
      : detachedRequirementAll(input.pack.preflight, selectedBranch.requirements)
    : undefined;
  const requirementResult = coachRequirementExpression && selectedEvidence
    ? evaluateRequirementExpression(coachRequirementExpression, selectedEvidence.snapshot)
    : undefined;
  const pendingCurrentManualTarget = Boolean(
    currentAction?.completion.kind === 'MANUAL'
    && !active.manualIds.has(currentAction.completion.confirmationId),
  );
  const pendingCombat = Boolean(
    currentAction?.combat
    && !active.manualIds.has(currentAction.combat.confirmationId),
  );
  const currentCombatEvidenceDiagnostic = currentAction
    ? combatEvidenceDiagnosticFor(input.pack, currentAction)
    : undefined;
  let proofState: RuneProofProofState;
  if (canonicalComplete || isolatedComplete) proofState = 'COMPLETE';
  else if (noPlayableRoute || pinnedNeedsReview) proofState = 'NEEDS_REVIEW';
  else {
    const requirementState = requirementResult
      ? normalizedRequirementState(requirementResult)
      : 'READY';
    if (currentAction && !combatEvidenceComplete(input.pack, currentAction)) {
      proofState = 'NEEDS_REVIEW';
    } else if (requirementState === 'NEEDS_REVIEW') {
      proofState = 'NEEDS_REVIEW';
    } else if (requirementState === 'BLOCKED') {
      proofState = 'BLOCKED';
    } else if (
      requirementState === 'CONFIRM'
      || pendingCurrentManualTarget
      || pendingCombat
    ) {
      proofState = 'CONFIRM';
    } else proofState = 'READY';
  }

  const playableCurrent = !routeRequirementsOnly
    ? currentAction
    : undefined;
  const legacyAlternative = playableCurrent?.alternatives.find(alternative => (
    alternative.id === `legacy-alternative:${playableCurrent.id}`
  ));
  const legacyAlternativeState = legacyAlternative && selectedEvidence
    ? normalizedRequirementState(evaluateRequirementExpression(
        legacyAlternative.requirements,
        selectedEvidence.snapshot,
      ))
    : undefined;
  const legacyPlayableAction = proofState === 'READY'
    && legacyAlternativeState === 'READY'
    ? playableCurrent
    : undefined;
  const legacy = legacyProjectionFor(input, active, legacyPlayableAction);
  const legacyAction = legacyPlayableAction
    ? legacy?.actions.find(value => value.id === legacyPlayableAction.id)
    : undefined;
  const legacyStrategyAction = legacyPlayableAction
    ? input.legacyProjection?.strategy.actions.find(value => (
        value.id === legacyPlayableAction.id
      ))
    : undefined;
  const legacySourceItemKeys = new Set(
    legacyStrategyAction?.coach.fulfils.map(value => value.item.key) ?? [],
  );
  const actions = ordered.map(candidate => packActionFor({
    action: candidate,
    completed: canonicalComplete
      || Boolean(selectedEvidence?.completedActionIds.has(candidate.id)),
    current: candidate.id === playableCurrent?.id,
    proofState,
    requirementResult: candidate.id === currentAction?.id ? requirementResult : undefined,
    legacyAction: candidate.id === legacyPlayableAction?.id ? legacyAction : undefined,
  }));
  const doNow = playableCurrent
    ? actions.find(candidate => candidate.id === playableCurrent.id)
    : undefined;

  const manualEntries: { expression: RequirementExpression; scope: ManualScope }[] = [];
  if (selectedBranch) {
    manualEntries.push(
      { expression: input.pack.preflight, scope: 'PREFLIGHT' },
      { expression: selectedBranch.requirements, scope: 'BRANCH' },
    );
    if (currentAction) {
      manualEntries.push({ expression: currentAction.requirements, scope: 'ACTION' });
    }
  }
  const alternativeManualEntries = doNow && currentAction
    ? currentAction.alternatives.map(alternative => ({
        expression: alternative.requirements,
        scope: 'ALTERNATIVE' as const,
      }))
    : [];
  const activeManualEntries = [...manualEntries, ...alternativeManualEntries];
  const manualConfirmations = manualConfirmationsFor(
    manualEntries,
    active.manualIds,
    activeManualEntries,
  );
  const currentCombatCard = doNow && currentAction
    && coachRequirementExpression && selectedEvidence
    && currentCombatEvidenceDiagnostic === undefined
    ? combatCardFor(
        currentAction,
        active,
        deterministicRequirementBlockersFor(
          coachRequirementExpression,
          selectedEvidence.snapshot,
        ),
      )
    : undefined;
  const quantities = selectedEvidence?.snapshot.itemQuantities
    ?? replayRuneProofConfirmedItemLedger({
      initialItems: input.pack.initialItems,
      actions: [],
      confirmedInitialItemKeys: active.itemKeys,
      completedActionIds: new Set(),
    });
  const activeProjection = confirmationProjection(input.progress, active, true);
  const inactiveProjection = confirmationProjection(input.progress, active, false);
  const branch = branchModelFor({
    pack: input.pack,
    progress: input.progress,
    selection,
    evaluations: branchEvaluations,
    routeEvidence,
  });
  const diagnosticReasons = proofState === 'NEEDS_REVIEW'
    ? noPlayableRoute
      ? input.pack.branches.flatMap(value => branchResults[value.id]?.reasons ?? [])
      : requirementResult?.reasons ?? branchResults[selectedBranch!.id]?.reasons ?? []
    : [];
  const completed = canonicalComplete
    ? ordered.length
    : selectedEvidence?.completedActionIds.size ?? 0;

  return {
    questId: input.pack.questId,
    proofState,
    branch,
    progress: {
      completed,
      total: ordered.length,
      activeConfirmations: activeProjection,
      inactiveConfirmations: inactiveProjection,
    },
    doNow,
    actions,
    initialItems: initialItemsFor(input.pack, active, quantities),
    manualConfirmations,
    currentCombatCards: currentCombatCard ? [currentCombatCard] : [],
    reviewedAlternatives: reviewedAlternativesFor(
      doNow ? currentAction : undefined,
      selectedEvidence?.snapshot,
      active,
      activeManualEntries,
    ),
    alternativeSources: legacy?.alternativeSources.filter(source => (
      legacySourceItemKeys.has(source.itemKey)
    )) ?? [],
    mainJourneyText: ordered.map(candidate => candidate.instruction).join(' '),
    proof: {
      sources: input.pack.sources,
      evidence: input.pack.evidence,
      diagnostics: stableUniqueStrings([
        ...input.pack.findings.map(finding => finding.message),
        ...(legacy?.proof.diagnostics ?? []),
        ...(currentCombatEvidenceDiagnostic ? [currentCombatEvidenceDiagnostic] : []),
        ...diagnosticReasons,
      ]),
    },
  };
}
