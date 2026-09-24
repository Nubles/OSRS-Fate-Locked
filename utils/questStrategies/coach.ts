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
import type { QuestGuideArticle } from '../../data/questGuideArticles';
import type { QuestStrategyDefinition } from './model';
import { guideTravelFor, type GuideTravelAccount, type GuideTravelLeg } from './travel';
import { closeProvenActions } from './proofClosure';

export type RuneProofCoachActionState =
  | 'COMPLETED'
  | 'DO_NOW'
  | 'AVAILABLE_NEXT'
  | 'BLOCKED'
  | 'NEEDS_CONFIRMATION';

export interface RuneProofCoachAction {
  readonly manualChecks?: readonly string[];
  readonly id: string;
  readonly instruction: string;
  readonly state: RuneProofCoachActionState;
  readonly locationLabel?: string;
  readonly mapChunks: readonly ChunkKey[];
  readonly chunkAccess?: readonly {
    readonly chunk: ChunkKey;
    readonly status: 'UNLOCKED' | 'LOCKED' | 'UNKNOWN';
  }[];
  readonly blockers?: readonly WalkthroughBlocker[];
  readonly section?: 'PREPARE' | 'QUEST';
  readonly supplies?: readonly string[];
  readonly locationExplanation?: string;
  readonly blockerText?: string;
  readonly preferredMethodLabel?: string;
  readonly usesAlternative?: boolean;
  readonly travel?: GuideTravelLeg;
  readonly ownedItemConfirmation?: { readonly itemKey: string; readonly label: string };
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
  readonly article?: QuestGuideArticle;
  readonly previewNotes?: readonly string[];
  readonly questId: string;
  readonly guideRevision?: string;
  readonly equipmentBlockers?: readonly string[];
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
  readonly account?: GuideTravelAccount;
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
  const proven = new Set(ordered
    .filter(action => actionIsDirectlyProven(action, input))
    .map(action => action.id));
  return closeProvenActions(ordered, proven, action => (
    action.coach.completion.kind === 'ITEM_CONFIRMED'
    && !input.confirmedActionIds.has(action.id)
    && !input.completedQuestIds.has(input.strategy.questId)
  ));
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

const alternativeResolvesBlocker = (
  blocker: WalkthroughBlocker,
  route: ItemRoute,
): boolean => (
  blocker.kind === 'CHUNK'
  || blocker.kind === 'LOCATION'
  || (blocker.kind === 'ITEM' && blocker.itemKey === route.item.key)
);

const locationFor = (
  action: StrategyAction,
  evaluatedAction: EvaluatedWalkthroughAction | undefined,
  alternative: ItemRoute | undefined,
): Pick<RuneProofCoachAction, 'mapChunks' | 'chunkAccess' | 'locationExplanation'> => {
  const location = evaluatedAction?.location;
  const assessedLocation = location?.confidence === 'EXACT' || location?.confidence === 'REVIEWED';
  const chunks = alternative?.chunks ?? (
    location?.chunks.length ? location.chunks
      : location?.candidateChunks.length ? location.candidateChunks
        : action.mapChunks
  );
  const lockedChunks = new Set(evaluatedAction?.blockers.flatMap(blocker => (
    blocker.kind === 'CHUNK' ? [blocker.chunk] : []
  )));
  const explanation = alternative
    ? `Available item source: ${alternative.sourceLabel}.`
    : location?.explanation ?? 'This step location has not been checked against your run.';
  return {
    mapChunks: [...chunks],
    chunkAccess: chunks.map(chunk => ({
      chunk,
      status: alternative ? 'UNLOCKED'
        : !assessedLocation || !location?.chunks.includes(chunk) ? 'UNKNOWN'
          : lockedChunks.has(chunk) ? 'LOCKED' : 'UNLOCKED',
    })),
    locationExplanation: explanation,
  };
};

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
  blockers: readonly WalkthroughBlocker[],
  hasAvailableAlternative: boolean,
): RuneProofCoachActionState => {
  if (blockers.some(isKnownBlocker)) return 'BLOCKED';
  if (!isPrimary) return 'AVAILABLE_NEXT';
  const alternativeReplacesUnknownLocation = hasAvailableAlternative
    && evaluatedAction?.state !== 'ITEM_EVIDENCE_INCOMPLETE'
    && evaluatedAction?.blockers.some(blocker => blocker.kind === 'LOCATION');
  if (needsConfirmation(evaluatedAction) && !alternativeReplacesUnknownLocation) return 'NEEDS_CONFIRMATION';
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
          && route.steps.every(step => (
            !step.requiresChunkUnlock && !step.hasDataGap && !step.blockers?.length
          ))
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
): boolean => {
  if (completed.has(action.id) || blockers.length > 0) return false;
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
    readonly usableRoutes: ItemRoute[];
    readonly chunkLockedRoutes: ItemRoute[];
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
      usableRoutes: [],
      chunkLockedRoutes: [],
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
        (presentedRoute.requiresChunkUnlock ? group.chunkLockedRoutes : group.usableRoutes).push(route);
        group.presentedRoutesById.set(route.id, presentedRoute);
      });
    routesByItemKey.set(itemKey, group);
  });

  return eligibleItems.flatMap(({ key, name }) => {
    const group = routesByItemKey.get(key);
    // The fallback rank has no chunk-access term, so rank the groups apart, as
    // the presenter does: a source behind a locked chunk never outranks a usable one.
    const rankedRoutes = group && [
      ...rankFallbackRoutes(group.usableRoutes, connectGraph, { origin }),
      ...rankFallbackRoutes(group.chunkLockedRoutes, connectGraph, { origin }),
    ]
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
  if (!nextAction) return 'All guide checks are complete.';
  if (nextAction.state === 'BLOCKED') {
    return 'Recommended because this quest has a clear next unblock step.';
  }
  if (nextAction.state === 'NEEDS_CONFIRMATION') {
    return 'Recommended because its reviewed route needs confirmation before continuing.';
  }
  return 'The next step is available with your current unlocks.';
};

/** Projects reviewed quest strategy, independent route evidence, and bounded progress into one coach model. */
export function buildRuneProofCoachModel(input: RuneProofCoachInput): RuneProofCoachModel {
  const ordered = orderedActions(input.strategy);
  const completed = completeActions(ordered, input);
  const equipmentBlockers = input.completedQuestIds.has(input.strategy.questId)
    ? []
    : 'equipmentBlockers' in input.analysis
      ? input.analysis.equipmentBlockers?.map(blocker => blocker.label) ?? []
      : [];
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

  const baseActions = ordered.map((action): RuneProofCoachAction => {
    const evaluatedAction = evaluatedById.get(action.id);
    const isPrimary = action.id === primaryActionId;
    const availableAlternative = availableAlternativeFor(
      action,
      input.analysis,
      input.connectGraph,
      alternativeOrigin,
    );
    const originalBlockers = evaluatedAction?.blockers.filter(blocker =>
      blocker.kind !== 'DEPENDENCY'
      && !(blocker.kind === 'ITEM' && input.confirmedItemKeys.has(blocker.itemKey)),
    ) ?? [];
    const useAvailableAlternative = availableAlternative !== undefined
      && originalBlockers.some(blocker => alternativeResolvesBlocker(blocker, availableAlternative));
    // A replacement source proves only the replaced acquisition and location.
    // Action-level skill, quest, and equipment gates still apply.
    const blockers = useAvailableAlternative
      ? originalBlockers.filter(blocker => !alternativeResolvesBlocker(blocker, availableAlternative))
      : originalBlockers;
    const knownBlockers = blockers.filter(isKnownBlocker);
    const equipmentBlocksCompletion = !completed.has(action.id)
      && action.coach.completion.kind === 'QUEST_COMPLETED'
      && action.coach.completion.questId === input.strategy.questId
      && equipmentBlockers.length > 0;
    const state = completed.has(action.id)
      ? 'COMPLETED'
      : equipmentBlocksCompletion
        ? 'BLOCKED'
        : stateFor(isPrimary, evaluatedAction, blockers, useAvailableAlternative);

    const completion = action.coach.completion;
    const ownedItem = completion.kind === 'ITEM_CONFIRMED'
      ? action.coach.fulfils.find(item => item.item.key === completion.itemKey && item.supplyPolicy === 'PLAYER_OBTAINED')
      : undefined;
    return {
      id: action.id,
      ownedItemConfirmation: ownedItem && !completed.has(action.id) ? {
        itemKey: ownedItem.item.key,
        label: `${ownedItem.quantity > 1 ? `${ownedItem.quantity} × ` : ''}${ownedItem.item.name}`,
      } : undefined,
      instruction: useAvailableAlternative
        ? promotedInstruction(action, availableAlternative)
        : action.displayText,
      state: state !== 'COMPLETED' && state !== 'BLOCKED' && action.manualChecks?.length ? 'NEEDS_CONFIRMATION' : state,
      manualChecks: action.manualChecks,
      locationLabel: useAvailableAlternative
        ? promotedLocationLabel(availableAlternative)
        : locationLabelFor(action),
      ...locationFor(action, evaluatedAction, useAvailableAlternative ? availableAlternative : undefined),
      blockers,
      section: action.section,
      supplies: action.items.map(({ item, quantity }) => (
        quantity > 1 ? `${quantity} × ${item.name}` : item.name
      )),
      blockerText: equipmentBlocksCompletion
        ? equipmentBlockers.join('; ')
        : state === 'BLOCKED' && knownBlockers[0]
          ? knownBlockers.map(blocker => blockerTextFor(blocker, action)).join(' ')
          : undefined,
      preferredMethodLabel: useAvailableAlternative
        ? availableAlternative.sourceLabel
        : preferredMethodLabelFor(action),
      usesAlternative: useAvailableAlternative,
      confirmationAllowed: !equipmentBlocksCompletion && confirmationAllowedFor(
        action,
        completed,
        knownBlockers,
        isPrimary,
      ),
      confirmationLabel: action.coach.completion.kind === 'QUEST_COMPLETED'
        ? 'Confirm quest complete'
        : undefined,
    };
  });
  const travel = input.account && !input.strategy.vanillaPreview
    ? guideTravelFor(input.strategy.questId, input.strategy.revision, baseActions, input.account)
    : undefined;
  const actions = baseActions.map((action, index): RuneProofCoachAction => {
    const leg = travel?.[index];
    return {
      ...action,
      travel: leg,
      // A known destination alone must not label the next journey available.
      // Manual checks can still record an action reached by another travel method.
      state: action.state === 'DO_NOW' && leg?.fromStep && leg.status !== 'AVAILABLE'
        ? 'NEEDS_CONFIRMATION' : action.state,
    };
  });
  const nextAction = primaryActionId === undefined
    ? undefined
    : actions.find(action => action.id === primaryActionId);

  return {
    questId: input.strategy.questId,
    article: input.strategy.article,
    previewNotes: input.strategy.previewNotes,
    guideRevision: input.strategy.revision,
    equipmentBlockers,
    recommendationReason: equipmentBlockers.length > 0
      ? 'This quest needs an equipment unlock before it can be completed.'
      : recommendationReasonFor(nextAction),
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
