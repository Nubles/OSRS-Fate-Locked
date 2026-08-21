import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  normalizeRuneProofPreviewActions,
  readRuneProofPreviewActions,
  type RuneProofPreviewActions,
  writeRuneProofPreviewActions,
} from '../utils/questStrategies/previewActions';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import type { RuneProofStorage } from '../utils/questRoutes/previewChecks';

const unavailableStorage: RuneProofStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const defaultStorage = (): RuneProofStorage => {
  try {
    return typeof window === 'undefined' ? unavailableStorage : window.localStorage;
  } catch {
    return unavailableStorage;
  }
};

interface RuneProofPreviewActionState {
  readonly runId: string;
  readonly strategies: readonly QuestStrategyDefinition[];
  readonly actions: RuneProofPreviewActions;
}

const actionsForCurrentScope = (
  state: RuneProofPreviewActionState,
  runId: string,
  strategies: readonly QuestStrategyDefinition[],
): RuneProofPreviewActions => (
  state.runId === runId && state.strategies === strategies ? state.actions : {}
);

export interface RuneProofPreviewActionControls {
  readonly actionsByQuest: RuneProofPreviewActions;
  confirmedActionIdsFor(questId: string): ReadonlySet<string>;
  setActionConfirmed(questId: string, actionId: string, confirmed: boolean): void;
}

export function useRuneProofPreviewActions(
  runId: string,
  strategies: readonly QuestStrategyDefinition[],
  storage?: RuneProofStorage,
): RuneProofPreviewActionControls {
  const activeStorage = useMemo(() => (
    strategies.length > 0 ? storage ?? defaultStorage() : unavailableStorage
  ), [storage, strategies]);
  const [state, setState] = useState<RuneProofPreviewActionState>(() => ({
    runId,
    strategies,
    actions: strategies.length > 0
      ? readRuneProofPreviewActions(activeStorage, runId, strategies)
      : {},
  }));

  useEffect(() => {
    setState({
      runId,
      strategies,
      actions: strategies.length > 0
        ? readRuneProofPreviewActions(activeStorage, runId, strategies)
        : {},
    });
  }, [activeStorage, runId, strategies]);

  const actionsByQuest = useMemo(() => normalizeRuneProofPreviewActions(
    actionsForCurrentScope(state, runId, strategies),
    strategies,
  ), [runId, state, strategies]);

  const confirmedActionIdsFor = useCallback((questId: string): ReadonlySet<string> => (
    new Set(actionsByQuest[questId] ?? [])
  ), [actionsByQuest]);

  const setActionConfirmed = useCallback((
    questId: string,
    actionId: string,
    confirmed: boolean,
  ) => {
    setState(current => {
      const currentActions = actionsForCurrentScope(current, runId, strategies);
      const existing = currentActions[questId] ?? [];
      const nextActionIds = confirmed
        ? [...existing, actionId]
        : existing.filter(id => id !== actionId);
      const next = normalizeRuneProofPreviewActions({
        ...currentActions,
        [questId]: nextActionIds,
      }, strategies);
      writeRuneProofPreviewActions(activeStorage, runId, strategies, next);
      return { runId, strategies, actions: next };
    });
  }, [activeStorage, runId, strategies]);

  return { actionsByQuest, confirmedActionIdsFor, setActionConfirmed };
}
