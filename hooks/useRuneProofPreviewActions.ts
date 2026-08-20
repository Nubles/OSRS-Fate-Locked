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
  readonly strategy: QuestStrategyDefinition | null;
  readonly actions: RuneProofPreviewActions;
}

const actionsForCurrentScope = (
  state: RuneProofPreviewActionState,
  runId: string,
  strategy: QuestStrategyDefinition | null,
): RuneProofPreviewActions => (
  state.runId === runId && state.strategy === strategy ? state.actions : {}
);

export interface RuneProofPreviewActionControls {
  readonly confirmedActionIds: ReadonlySet<string>;
  setActionConfirmed(actionId: string, confirmed: boolean): void;
}

export function useRuneProofPreviewActions(
  runId: string,
  strategy: QuestStrategyDefinition | null,
  storage?: RuneProofStorage,
): RuneProofPreviewActionControls {
  const activeStorage = useMemo(() => (
    strategy ? storage ?? defaultStorage() : unavailableStorage
  ), [storage, strategy]);
  const [state, setState] = useState<RuneProofPreviewActionState>(() => ({
    runId,
    strategy,
    actions: strategy ? readRuneProofPreviewActions(activeStorage, runId, strategy) : {},
  }));

  useEffect(() => {
    setState({
      runId,
      strategy,
      actions: strategy ? readRuneProofPreviewActions(activeStorage, runId, strategy) : {},
    });
  }, [activeStorage, runId, strategy]);

  const actions = actionsForCurrentScope(state, runId, strategy);
  const confirmedActionIds = useMemo(() => new Set(
    strategy
      ? normalizeRuneProofPreviewActions(actions, strategy)[strategy.questId] ?? []
      : [],
  ), [actions, strategy]);

  const setActionConfirmed = useCallback((actionId: string, confirmed: boolean) => {
    if (!strategy) return;

    setState(current => {
      const existing = actionsForCurrentScope(current, runId, strategy)[strategy.questId] ?? [];
      const nextActionIds = confirmed
        ? [...existing, actionId]
        : existing.filter(id => id !== actionId);
      const next = normalizeRuneProofPreviewActions({
        [strategy.questId]: nextActionIds,
      }, strategy);
      writeRuneProofPreviewActions(activeStorage, runId, strategy, next);
      return { runId, strategy, actions: next };
    });
  }, [activeStorage, runId, strategy]);

  return { confirmedActionIds, setActionConfirmed };
}
