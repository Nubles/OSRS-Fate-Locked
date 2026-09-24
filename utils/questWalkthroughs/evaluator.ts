import type {
  QuestItemRouteAnalysis,
  QuestRouteAnalysisSnapshot,
} from '../questRoutes/analyzeQuest';
import { evaluateRouteGates } from '../questRoutes/accountRequirements';
import type {
  EvaluatedWalkthroughAction,
  QuestWalkthroughAnalysis,
  ResolvedQuestWalkthrough,
  ResolvedWalkthroughAction,
  WalkthroughBlocker,
  WalkthroughProofActionState,
} from './model';

interface ActionEvaluation {
  readonly value: EvaluatedWalkthroughAction;
  readonly knownFailure: boolean;
  readonly incompleteEvidence: boolean;
}

const compareSourceOrder = (
  left: ResolvedWalkthroughAction,
  right: ResolvedWalkthroughAction,
  sourceIndexes: ReadonlyMap<string, number>,
): number => (
  left.sourceOrder - right.sourceOrder
  || (sourceIndexes.get(left.id) ?? 0) - (sourceIndexes.get(right.id) ?? 0)
);

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(entry => deepFreeze(entry));
    Object.freeze(value);
  }
  return value;
};

const isNonSpatialInformation = (action: ResolvedWalkthroughAction): boolean => (
  action.kind === 'INFORMATION'
  && action.location.evidenceKind === 'NONE'
  && action.gates.length === 0
  && action.items.every(item => item.supplyPolicy === 'QUEST_PROVIDED')
);

export const evaluateQuestWalkthrough = (
  walkthrough: ResolvedQuestWalkthrough,
  snapshot: QuestRouteAnalysisSnapshot,
  itemAnalyses: readonly QuestItemRouteAnalysis[],
): QuestWalkthroughAnalysis => {
  const unlockedChunks = new Set(snapshot.unlockedChunks);
  const itemAnalysisByKey = new Map(
    itemAnalyses.map(analysis => [analysis.requirement.item.key, analysis]),
  );
  const actionById = new Map(walkthrough.actions.map(action => [action.id, action]));
  // Items an earlier step produces (a bucket, grain, a pot) have no route
  // analysis of their own; that step's readiness already gates this one.
  const producedByDependencies = (action: ResolvedWalkthroughAction): ReadonlySet<string> => {
    const produced = new Set<string>();
    const seen = new Set<string>();
    const visit = (id: string): void => {
      if (seen.has(id)) return;
      seen.add(id);
      const dependency = actionById.get(id);
      if (!dependency) return;
      dependency.coach?.fulfils.forEach(item => produced.add(item.item.key));
      dependency.dependsOn.forEach(visit);
    };
    action.dependsOn.forEach(visit);
    return produced;
  };
  const evaluations = new Map<string, ActionEvaluation>();
  const evaluating = new Set<string>();

  const evaluateAction = (action: ResolvedWalkthroughAction): ActionEvaluation => {
    const existing = evaluations.get(action.id);
    if (existing) return existing;
    if (evaluating.has(action.id)) {
      throw new Error('Walkthrough dependency cycle detected at ' + action.id + '.');
    }
    evaluating.add(action.id);

    const dependencyEvaluations = action.dependsOn.map((dependencyId) => {
      const dependency = actionById.get(dependencyId);
      return {
        dependencyId,
        dependency,
        evaluation: dependency ? evaluateAction(dependency) : undefined,
      };
    });

    if (isNonSpatialInformation(action)) {
      const informational: ActionEvaluation = {
        value: {
          definition: action.definition,
          location: action.location,
          state: 'INFORMATION',
          blockers: [],
          itemPreparation: [],
        },
        knownFailure: false,
        incompleteEvidence: false,
      };
      evaluating.delete(action.id);
      evaluations.set(action.id, informational);
      return informational;
    }

    const chunkBlockers: WalkthroughBlocker[] = (
      action.location.confidence === 'EXACT' || action.location.confidence === 'REVIEWED'
    ) ? action.location.chunks
      .filter(chunk => !unlockedChunks.has(chunk))
      .map(chunk => ({ kind: 'CHUNK' as const, chunk, label: action.displayText }))
      : [];

    const gateBlockers: WalkthroughBlocker[] = evaluateRouteGates(
      action.gates,
      snapshot.unlocks,
    ).blockers.map(gate => ({
      kind: 'GATE',
      gate,
      label: gate.label,
    }));

    const dependencyBlockers: WalkthroughBlocker[] = dependencyEvaluations
      .filter(({ evaluation }) => !evaluation || evaluation.knownFailure)
      .map(({ dependencyId, dependency }) => ({
        kind: 'DEPENDENCY',
        actionId: dependencyId,
        label: dependency?.displayText ?? dependencyId,
      }));
    const incompleteDependencyLocation = dependencyEvaluations.some(
      ({ evaluation }) => evaluation?.value.state === 'LOCATION_NEEDS_REVIEW',
    );
    const incompleteDependencyItem = dependencyEvaluations.some(
      ({ evaluation }) => evaluation?.value.state === 'ITEM_EVIDENCE_INCOMPLETE',
    );

    const itemBlockers: WalkthroughBlocker[] = [];
    const itemPreparation: EvaluatedWalkthroughAction['itemPreparation'][number][] = [];
    let incompleteItemEvidence = false;
    const producedEarlier = producedByDependencies(action);
    action.items.forEach((requirement) => {
      if (requirement.supplyPolicy === 'QUEST_PROVIDED') return;
      const analysis = itemAnalysisByKey.get(requirement.item.key);
      if (!analysis && producedEarlier.has(requirement.item.key)) {
        itemPreparation.push({
          itemKey: requirement.item.key,
          analysisState: 'PREPARED_BY_EARLIER_STEP',
          obtainableNow: false,
        });
        return;
      }
      const analysisState = analysis?.state ?? 'MISSING_ANALYSIS';
      const obtainableNow = analysis?.state === 'OBTAINABLE_NOW';
      itemPreparation.push({
        itemKey: requirement.item.key,
        analysisState,
        obtainableNow,
      });
      if (analysis?.state === 'ROUTE_BLOCKED' || analysis?.state === 'NO_CURRENT_SOURCE') {
        itemBlockers.push({
          kind: 'ITEM',
          itemKey: requirement.item.key,
          label: requirement.item.name,
        });
      } else if (!analysis || analysis.state === 'DATA_INCOMPLETE') {
        incompleteItemEvidence = true;
      }
    });

    const incompleteLocation = (
      action.location.confidence === 'AMBIGUOUS'
      || action.location.confidence === 'UNMAPPED'
    );
    const locationBlockers: WalkthroughBlocker[] = incompleteLocation
      ? [{ kind: 'LOCATION', label: action.location.explanation }]
      : [];
    const blockers = [
      ...chunkBlockers,
      ...gateBlockers,
      ...dependencyBlockers,
      ...itemBlockers,
      ...locationBlockers,
    ];

    let state: WalkthroughProofActionState;
    if (chunkBlockers.length > 0) {
      state = 'CHUNK_LOCKED';
    } else if (
      gateBlockers.length > 0
      || dependencyBlockers.length > 0
      || itemBlockers.length > 0
    ) {
      state = 'REQUIREMENT_MISSING';
    } else if (incompleteLocation || incompleteDependencyLocation) {
      state = 'LOCATION_NEEDS_REVIEW';
    } else if (incompleteItemEvidence || incompleteDependencyItem) {
      state = 'ITEM_EVIDENCE_INCOMPLETE';
    } else {
      state = 'READY_HERE';
    }

    const evaluation: ActionEvaluation = {
      value: {
        definition: action.definition,
        location: action.location,
        state,
        blockers,
        itemPreparation,
      },
      knownFailure: (
        chunkBlockers.length > 0
        || gateBlockers.length > 0
        || dependencyBlockers.length > 0
        || itemBlockers.length > 0
      ),
      incompleteEvidence: (
        incompleteLocation
        || incompleteItemEvidence
        || dependencyEvaluations.some(({ evaluation }) => evaluation?.incompleteEvidence)
      ),
    };
    evaluating.delete(action.id);
    evaluations.set(action.id, evaluation);
    return evaluation;
  };

  walkthrough.actions.forEach(evaluateAction);
  const sourceIndexes = new Map(
    walkthrough.actions.map((action, index) => [action.id, index]),
  );
  const orderedEvaluations = [...walkthrough.actions]
    .sort((left, right) => compareSourceOrder(left, right, sourceIndexes))
    .map(action => evaluations.get(action.id)!);
  const knownBlocker = orderedEvaluations.some(evaluation => evaluation.knownFailure);
  const hasIncompleteEvidence = orderedEvaluations.some(
    evaluation => evaluation.incompleteEvidence,
  );
  const actions = orderedEvaluations.map(evaluation => evaluation.value);

  return deepFreeze(structuredClone({
    questId: walkthrough.questId,
    releaseStatus: walkthrough.releaseStatus,
    status: knownBlocker ? 'BLOCKED' : hasIncompleteEvidence ? 'INCOMPLETE' : 'READY',
    actions,
    blockers: actions.flatMap(action => action.blockers),
    hasIncompleteEvidence,
    sourceLines: walkthrough.sourceLines,
    source: walkthrough.source,
  })) as QuestWalkthroughAnalysis;
};
