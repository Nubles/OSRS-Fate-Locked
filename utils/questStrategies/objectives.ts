import type { RuneProofCatalogueSummary } from '../../data/questWalkthroughLoader';
import type { QuestStrategyDefinition } from './model';
import type { RuneProofProofState } from './packModel';
import type { RuneProofProgressIndexV2 } from './progress';
import {
  evaluateRequirementExpression,
  type RuneProofRequirementSnapshot,
} from './requirements';

export type RuneProofObjectiveReadiness = RuneProofProofState;

export interface RuneProofObjectiveCandidate {
  readonly questId: string;
  readonly milestone: 1 | 2 | 3 | 4 | 5;
  readonly progressionPriority: number;
  readonly proofState: RuneProofObjectiveReadiness;
  readonly progress: Readonly<{ completed: number; total: number }>;
  readonly actionable: boolean;
  readonly blockerReason?: string;
  readonly unblockAction?: string;
}

export interface RuneProofObjectiveRecommendation {
  readonly questId: string;
  readonly reason: string;
  readonly progress: RuneProofObjectiveCandidate['progress'];
  readonly readiness: Exclude<RuneProofObjectiveReadiness, 'NEEDS_REVIEW' | 'COMPLETE'>;
}

export interface RuneProofPreflightMetrics {
  readonly headerEvaluations: number;
  readonly progressIndexLookups: number;
  readonly packLoads: 0;
  readonly deepAnalyses: 0;
}

export interface RuneProofObjectivePreflightResult {
  readonly candidates: readonly RuneProofObjectiveCandidate[];
  readonly metrics: RuneProofPreflightMetrics;
}

export interface RuneProofObjectivePreflightInput {
  readonly summaries: readonly RuneProofCatalogueSummary[];
  readonly snapshot: RuneProofRequirementSnapshot;
  readonly progressIndex: RuneProofProgressIndexV2;
}

const frozenProgress = (
  completed: number,
  total: number,
): RuneProofObjectiveCandidate['progress'] => Object.freeze({ completed, total });

const isReleasedPlayableSummary = (summary: RuneProofCatalogueSummary): boolean => (
  summary.packDisposition === 'RELEASED'
  && summary.lifecycle !== undefined
  && summary.lifecycle !== 'DRAFT'
  && summary.reviewStatus === summary.lifecycle
  && summary.playable
);

export const preflightRuneProofObjectives = (
  input: RuneProofObjectivePreflightInput,
): RuneProofObjectivePreflightResult => {
  const candidates: RuneProofObjectiveCandidate[] = [];
  const snapshot = input.snapshot.observedCanonicalCompletion
    ? { ...input.snapshot, observedCanonicalCompletion: false as const }
    : input.snapshot;
  let headerEvaluations = 0;
  let progressIndexLookups = 0;

  for (const summary of input.summaries) {
    headerEvaluations += 1;
    progressIndexLookups += 1;
    const indexed = input.progressIndex.entries[summary.slug];
    const progress = indexed?.questId === summary.questId
      && indexed.packRevision === summary.packRevision
      ? indexed
      : undefined;
    const counts = frozenProgress(
      progress?.completedActionCount ?? 0,
      progress?.totalActionCount ?? 0,
    );

    if (input.snapshot.completedQuestIds.has(summary.questId) || progress?.complete === true) {
      candidates.push(Object.freeze({
        questId: summary.questId,
        milestone: summary.milestone,
        progressionPriority: summary.progressionPriority,
        proofState: 'COMPLETE',
        progress: counts,
        actionable: false,
      }));
      continue;
    }

    if (!isReleasedPlayableSummary(summary) || summary.requirementStatus === 'UNRESOLVED') {
      candidates.push(Object.freeze({
        questId: summary.questId,
        milestone: summary.milestone,
        progressionPriority: summary.progressionPriority,
        proofState: 'NEEDS_REVIEW',
        progress: counts,
        actionable: false,
      }));
      continue;
    }

    const evaluation = evaluateRequirementExpression(summary.preflight, snapshot);
    const blockerReason = evaluation.reasons[0];
    const unblockAction = evaluation.unblockActions[0];
    candidates.push(Object.freeze({
      questId: summary.questId,
      milestone: summary.milestone,
      progressionPriority: summary.progressionPriority,
      proofState: evaluation.state,
      progress: counts,
      actionable: evaluation.state === 'READY'
        || evaluation.state === 'CONFIRM'
        || (evaluation.state === 'BLOCKED'
          && blockerReason !== undefined
          && unblockAction !== undefined),
      ...(blockerReason === undefined ? {} : { blockerReason }),
      ...(unblockAction === undefined ? {} : { unblockAction }),
    }));
  }

  return Object.freeze({
    candidates: Object.freeze(candidates),
    metrics: Object.freeze({
      headerEvaluations,
      progressIndexLookups,
      packLoads: 0,
      deepAnalyses: 0,
    }),
  });
};

const readinessRank = (
  readiness: RuneProofObjectiveRecommendation['readiness'],
): number => readiness === 'READY' ? 0 : readiness === 'CONFIRM' ? 1 : 2;

const retainedProgressRatio = (
  progress: RuneProofObjectiveCandidate['progress'],
): number => progress.total === 0 ? 0 : progress.completed / progress.total;

const compareQuestIds = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

type PlayableObjectiveCandidate =
  | RuneProofObjectiveCandidate & { proofState: 'READY' | 'CONFIRM' }
  | RuneProofObjectiveCandidate & {
    proofState: 'BLOCKED';
    blockerReason: string;
    unblockAction: string;
  };

const toRecommendation = (
  candidate: PlayableObjectiveCandidate,
): RuneProofObjectiveRecommendation => ({
  questId: candidate.questId,
  reason: candidate.proofState === 'READY'
    ? 'Ready with your current unlocks.'
    : candidate.proofState === 'CONFIRM'
      ? 'Deterministic gates pass; confirm the reviewed manual requirement.'
      : `${candidate.blockerReason} ${candidate.unblockAction}`,
  progress: candidate.progress,
  readiness: candidate.proofState,
});

export function rankRuneProofObjectives(
  candidates: readonly RuneProofObjectiveCandidate[],
  limit = 3,
): readonly RuneProofObjectiveRecommendation[] {
  return candidates
    .filter((candidate): candidate is PlayableObjectiveCandidate => (
      candidate.proofState !== 'COMPLETE'
      && candidate.proofState !== 'NEEDS_REVIEW'
      && (candidate.proofState !== 'BLOCKED' || (
        candidate.actionable
        && candidate.blockerReason !== undefined
        && candidate.unblockAction !== undefined
      ))
    ))
    .slice()
    .sort((left, right) =>
      readinessRank(left.proofState) - readinessRank(right.proofState)
      || left.milestone - right.milestone
      || left.progressionPriority - right.progressionPriority
      || retainedProgressRatio(right.progress) - retainedProgressRatio(left.progress)
      || right.progress.completed - left.progress.completed
      || compareQuestIds(left.questId, right.questId))
    .slice(0, Math.max(0, Math.min(3, Math.floor(limit))))
    .map(toRecommendation);
}

type StrategyAction = QuestStrategyDefinition['actions'][number];

const orderedActions = (strategy: QuestStrategyDefinition): readonly StrategyAction[] => (
  strategy.actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => left.action.sourceOrder - right.action.sourceOrder || left.index - right.index)
    .map(({ action }) => action)
);

const isDirectlyConfirmed = (
  action: StrategyAction,
  strategy: QuestStrategyDefinition,
  confirmedActionIds: ReadonlySet<string>,
  confirmedItemKeys: ReadonlySet<string>,
  completedQuestIds: ReadonlySet<string>,
): boolean => {
  if (confirmedActionIds.has(action.id)) return true;
  if (completedQuestIds.has(strategy.questId)) return true;

  switch (action.coach.completion.kind) {
    case 'MANUAL':
      return false;
    case 'ITEM_CONFIRMED':
      return confirmedItemKeys.has(action.coach.completion.itemKey);
    case 'QUEST_COMPLETED':
      return completedQuestIds.has(action.coach.completion.questId);
  }
};

/** Derives isolated RuneProof route progress with the coach's proof and dependency rules. */
export function questStrategyProgress(
  strategy: QuestStrategyDefinition,
  confirmedActionIds: ReadonlySet<string>,
  confirmedItemKeys: ReadonlySet<string>,
  completedQuestIds: ReadonlySet<string>,
): Readonly<{ completed: number; total: number }> {
  const ordered = orderedActions(strategy);
  const actionById = new Map(ordered.map(action => [action.id, action]));
  const completed = new Set(ordered
    .filter(action => isDirectlyConfirmed(
      action,
      strategy,
      confirmedActionIds,
      confirmedItemKeys,
      completedQuestIds,
    ))
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
  return { completed: completed.size, total: ordered.length };
}
