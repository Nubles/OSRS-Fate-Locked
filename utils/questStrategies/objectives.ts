import type { QuestStrategyDefinition } from './model';

export type RuneProofObjectiveReadiness = 'READY' | 'CONFIRM' | 'BLOCKED';

export interface RuneProofObjectiveCandidate {
  readonly strategy: QuestStrategyDefinition;
  readonly readiness: RuneProofObjectiveReadiness;
  readonly completed: boolean;
  readonly progress: Readonly<{ completed: number; total: number }>;
}

export interface RuneProofObjectiveRecommendation {
  readonly questId: string;
  readonly reason: string;
  readonly progress: RuneProofObjectiveCandidate['progress'];
  readonly readiness: RuneProofObjectiveReadiness;
}

const DEFAULT_OBJECTIVE_LIMIT = 3;

const readinessRank = (readiness: RuneProofObjectiveReadiness): number => {
  switch (readiness) {
    case 'READY': return 0;
    case 'CONFIRM': return 1;
    case 'BLOCKED': return 2;
  }
};

const reasonFor = (readiness: RuneProofObjectiveReadiness): string => {
  switch (readiness) {
    case 'READY': return 'Ready with your current unlocks.';
    case 'CONFIRM': return 'Continue its reviewed route after confirming the current step.';
    case 'BLOCKED': return 'Has a reviewed route with an actionable blocker.';
  }
};

const compareQuestIds = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

export function rankRuneProofObjectives(
  candidates: readonly RuneProofObjectiveCandidate[],
  limit = DEFAULT_OBJECTIVE_LIMIT,
): readonly RuneProofObjectiveRecommendation[] {
  const resolvedLimit = Math.max(0, Math.floor(limit));

  return candidates
    .filter(candidate => !candidate.completed)
    .slice()
    .sort((left, right) => (
      readinessRank(left.readiness) - readinessRank(right.readiness)
      || left.strategy.progressionPriority - right.strategy.progressionPriority
      || compareQuestIds(left.strategy.questId, right.strategy.questId)
    ))
    .slice(0, resolvedLimit)
    .map(candidate => ({
      questId: candidate.strategy.questId,
      reason: reasonFor(candidate.readiness),
      progress: candidate.progress,
      readiness: candidate.readiness,
    }));
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
